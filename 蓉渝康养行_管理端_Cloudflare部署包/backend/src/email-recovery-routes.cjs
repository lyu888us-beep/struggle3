'use strict';
// Optional, explicitly enabled customer-only email recovery. No credentials in client.
module.exports=function setupEmailRecovery({app,db,config,secure,identities,requireUser,hashPassword,randomBytes,now=Date.now,sendEmail}){
 const origin=new URL(config.CUSTOMER_PUBLIC_URL);
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Invalid customer origin');
 const createChallenges=require('./email-challenges.cjs');
 const challenges=createChallenges({db,accountIndex:x=>secure.lookup('account-v1',x),now});
 db.exec('CREATE TABLE IF NOT EXISTS email_recovery_limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(key,bucket))');
 const generic={ok:true,message:'如果邮箱符合条件，验证邮件将发送，请检查收件箱。'};
 const eligible=u=>u&&u.role==='member'&&!u.testOtp&&u.account!=='demo@meditrip.cn'&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(u.account);
 function limit(ip,account){
  const bucket=Math.floor(now()/3600000),keys=[[secure.lookup('email-rate-ip',String(ip||'unknown')),20],[secure.lookup('email-rate-account',account),3]];
  return db.transaction(()=>{
   db.prepare('DELETE FROM email_recovery_limits WHERE bucket<?').run(bucket-2);
   for(const [key,max] of keys){const row=db.prepare('SELECT count FROM email_recovery_limits WHERE key=? AND bucket=?').get(key,bucket);if(row&&row.count>=max)return false}
   for(const [key] of keys)db.prepare('INSERT INTO email_recovery_limits(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1').run(key,bucket);
   return true;
  })();
 }
 const getAccount=id=>{const u=identities.hydrate(db.prepare('SELECT * FROM users WHERE id=?').get(id));return eligible(u)?u.account:null};
 async function dispatch(u,kind){
  const token=challenges.issue(Number(u.id),u.account,kind),url=new URL('/email-action',origin);
  url.hash=new URLSearchParams({kind,token}).toString();
  await sendEmail({recipient:u.account,resetUrl:url.href,purpose:kind});
 }
 app.get('/api/email-recovery/status',requireUser,(req,res)=>res.json({eligible:!!eligible(req.user),verified:!!eligible(req.user)&&challenges.verified(req.user.id,req.user.account)}));
 app.post('/api/email-recovery/verify-request',requireUser,async(req,res)=>{
  const u=req.user;if(!eligible(u))return res.status(400).json({error:'当前账号不可验证邮箱'});
  if(!limit(req.ip,u.account))return res.status(429).json({error:'请求过于频繁，请稍后再试'});
  try{await dispatch(u,'verify-email');res.json(generic)}catch{return res.status(503).json({error:'邮件暂时无法发送，请稍后重试'})}
 });
 app.post('/api/email-recovery/reset-request',async(req,res)=>{
  const account=typeof req.body.account==='string'?req.body.account.trim().toLowerCase().slice(0,120):'';
  if(!limit(req.ip,account))return res.json(generic);
  const u=identities.findByAccount(account);
  if(eligible(u)&&challenges.verified(u.id,u.account)){try{await dispatch(u,'reset-password')}catch{/* identical public response; provider credentials never logged */}}
  res.json(generic);
 });
 app.post('/api/email-recovery/verify', (req,res)=>{
  const ok=challenges.consume(req.body.token,'verify-email',getAccount,()=>{});
  if(!ok)return res.status(400).json({error:'链接无效或已过期，请重新申请'});
  res.json({ok:true});
 });
 app.post('/api/email-recovery/reset', (req,res)=>{
  const next=typeof req.body.password==='string'?req.body.password:'';
  if(next.length<8||next.length>128)return res.status(400).json({error:'新密码长度需为 8 至 128 位'});
  const ok=challenges.consume(req.body.token,'reset-password',getAccount,id=>{
   const salt=randomBytes(16).toString('hex');
   db.prepare('UPDATE users SET salt=?,passhash=? WHERE id=?').run(salt,hashPassword(next,salt),id);
   db.prepare('DELETE FROM sessions WHERE userId=?').run(id);
  });
  if(!ok)return res.status(400).json({error:'链接无效或已过期，请重新申请'});
  res.json({ok:true});
 });
 return challenges;
};
