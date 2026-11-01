'use strict';
const express=require('express'),multer=require('multer'),crypto=require('node:crypto'),path=require('node:path');
const validImageDimensions=require('./image-check.cjs');
module.exports=function createApp({db,config,state}){
db.exec(`
 CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, account TEXT NOT NULL UNIQUE COLLATE NOCASE,
  city TEXT NOT NULL DEFAULT '', age INTEGER, gender TEXT NOT NULL DEFAULT '', special TEXT NOT NULL DEFAULT '',
  salt TEXT NOT NULL, passhash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
  createdAt TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS sessions(tokenHash TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expiresAt INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS item_owner_kind ON items(userId,kind);
 CREATE TABLE IF NOT EXISTS attachments(id INTEGER PRIMARY KEY AUTOINCREMENT, recordId INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, createdAt TEXT NOT NULL);
`);
const existingColumns=new Set(db.prepare("PRAGMA table_info(users)").all().map(x=>x.name));
for(const [name,type] of [["identity_type","TEXT"],["identity_cipher","TEXT"],["identity_consent_at","TEXT"]])if(!existingColumns.has(name))db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
const secure=require('./secure-worker.cjs')(db,config.DATA_ENCRYPTION_KEY);
const identities=require('./identity-store.cjs')(db,secure);
if(db.prepare('SELECT id FROM users WHERE NOT EXISTS (SELECT 1 FROM user_identity_vault v WHERE v.userId=users.id)').get())throw new Error('Identity vault missing; manual migration is required');
const TEST_OTP_ENABLED=config.ENABLE_TEST_OTP==='1'&&config.ENVIRONMENT==='demo';
const seeds={hospitals:require('./hospitals.json'),recipes:require('./recipes.json'),articles:require('./articles.json'),therapies:require('./therapies.json'),destinations:require('./destinations.json')};
const readSeed=n=>seeds[n];
// Optional public customer origin keeps the two independently installed PWAs
// on distinct hosts while retaining '/' for single-origin or local deployments.
const customerAppUrl=(()=>{try{const u=new URL(config.CUSTOMER_PUBLIC_URL||'');if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '/';return u.origin+'/'}catch{return '/'}})();
const meta = { hospitals:readSeed('hospitals'), recipes:readSeed('recipes'), articles:readSeed('articles'), therapies:readSeed('therapies'), destinations:readSeed('destinations'), testAuthEnabled:TEST_OTP_ENABLED, customerAppUrl };
const now = () => new Date().toISOString();
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
const hashPassword = (password,salt) => crypto.scryptSync(password,salt,64).toString('hex');
function makeUser(name, account, password, role='member', city='', options={}) {
 const salt=crypto.randomBytes(16).toString('hex'), hash=hashPassword(password,salt);
 return db.transaction(()=>{
  const synthetic=`internal-${crypto.randomUUID()}@invalid.local`;
  const id=Number(db.prepare('INSERT INTO users(name,account,city,salt,passhash,role,createdAt) VALUES(?,?,?,?,?,?,?)').run('',synthetic,'',salt,hash,role,now()).lastInsertRowid);
  identities.add(id,{name,account:account.toLowerCase(),city,age:null,gender:'',special:'',identity_type:null,identity_cipher:null,identity_consent_at:null,testOtp:!!options.testOtp});
  return id;
 })();
}
function ensureSeed(){
 if (!db.prepare('SELECT id FROM users WHERE role=?').get('admin')) {
  const password=config.ADMIN_PASSWORD;
  if(!password||password.length<12||password.length>128)throw new Error('ADMIN_PASSWORD secret must be 12 to 128 characters on first initialization');
  makeUser('平台管理员','admin@rongyu.local',password,'admin');
  console.log('Created the initial isolated administrator.');
 }
 if(!identities.findByAccount('demo@meditrip.cn')) {
  const id=makeUser('体验用户','demo@meditrip.cn','demo1234','member','成都');
  // Invented sample data only; never copy patient records from the original site.
  const visit=new Date(Date.now()+86400000*14).toISOString().slice(0,10);
  insertItem(id,'bookings',{hospitalId:meta.hospitals[0]?.id,hospitalName:meta.hospitals[0]?.name||'示例医院',patientName:'体验用户',phone:'',department:'待分诊',serviceType:'全程陪诊',visitDate:visit,period:'上午',needPickup:false,status:'confirmed',notes:'仅供测试的示例预约'});
  insertItem(id,'logs',{logDate:today(),meal:'早餐',content:'示例：小米粥与鸡蛋',feeling:'良好',notes:''});
  insertItem(id,'subscriptions',{topic:'术后饮食',frequency:'每周'});
 }
}
function insertItem(userId, kind, body){const t=now();return Number(db.prepare('INSERT INTO items(userId,kind,body,createdAt,updatedAt) VALUES(?,?,?,?,?)').run(userId,kind,secure.sealText(JSON.stringify(body)),t,t).lastInsertRowid);}
function itemOut(row){
 const o={...JSON.parse(secure.openText(row.body)),id:row.id,userId:row.userId,createdAt:row.createdAt,updatedAt:row.updatedAt};
 if(row.withUser){const u=identities.profileFor(row.userId);o.userName=u.name;o.userAccount=u.account;o.archiveNumber=u.archiveNumber;}
 if(row.kind==='records')o.attachments=db.prepare('SELECT id,name,mime,createdAt FROM attachments WHERE recordId=? ORDER BY id').all(row.id).map(a=>({...a,name:secure.openText(a.name)}));
 return o;
}
function listItems(kind,userId){return db.prepare('SELECT * FROM items WHERE kind=? AND userId=? ORDER BY id DESC').all(kind,userId).map(itemOut)}
function allItems(kind){return db.prepare('SELECT i.*,1 AS withUser FROM items i WHERE i.kind=? ORDER BY i.id DESC').all(kind).map(itemOut)}
const userOut = raw => {if(!raw)return null;const u=identities.hydrate(raw);let identity='';if(u.identity_cipher){const v=secure.openText(u.identity_cipher);identity='••••'+v.slice(-4)}return {id:u.id,name:u.name,account:u.account,city:u.city,age:u.age,gender:u.gender,special:u.special||'',role:u.role,createdAt:u.createdAt,identityType:u.identity_type||'',identityMasked:identity,identityConsentAt:u.identity_consent_at||null,archiveNumber:u.archiveNumber,testOtp:!!u.testOtp}};
ensureSeed();

const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Robots-Tag','noindex, nofollow');next()});
app.use('/api',express.json({limit:'300kb'}));
app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)){
 const origin=req.get('origin'); if(origin){try{if(new URL(origin).host!==req.get('host'))return res.status(403).json({error:'请求来源不匹配'});}catch{return res.status(403).json({error:'请求来源无效'})}}
 if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'跨站请求被拒绝'});
 }next()});
function cookieValue(req,name){for(const p of (req.get('cookie')||'').split(';')){const i=p.indexOf('=');if(i>=0&&p.slice(0,i).trim()===name)return p.slice(i+1).trim()}return null}
function tokenHash(t){return crypto.createHash('sha256').update(t).digest('hex')}
function currentUser(req){let t=cookieValue(req,'ry_session');if(!t||t.length>200)return null;let raw=db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.userId WHERE s.tokenHash=? AND s.expiresAt>?').get(tokenHash(t),Date.now());return raw?identities.hydrate(raw):null}
// Long-lived, rolling sessions are convenience for test devices, not a promise
// that a cleared browser or a revoked/expired session will remain signed in.
const cookieOpts={httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:365*86400000};
function renewSession(req,res){const t=cookieValue(req,'ry_session');if(!t||t.length>200)return;let r=db.prepare('UPDATE sessions SET expiresAt=? WHERE tokenHash=? AND expiresAt>?').run(Date.now()+cookieOpts.maxAge,tokenHash(t),Date.now());if(r.changes)res.cookie('ry_session',t,cookieOpts)}
function loginUser(res,user){const token=crypto.randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)').run(tokenHash(token),user.id,Date.now()+cookieOpts.maxAge);res.cookie('ry_session',token,cookieOpts)}
function requireUser(req,res,next){req.user=currentUser(req);if(!req.user)return res.status(401).json({error:'请先登录'});next()}
function requireAdmin(req,res,next){if(!req.user||req.user.role!=='admin')return res.status(403).json({error:'仅管理员可操作'});next()}
const clean=(x,max=4000)=>String(x??'').trim().slice(0,max);
const validAccount=a=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)||/^\+?[\d\s-]{7,24}$/.test(a);
const attempts=new Map();
function rateLimit(req,res,next){const ip=req.ip||'unknown',time=Date.now();let arr=(attempts.get(ip)||[]).filter(t=>time-t<15*60000);if(arr.length>=30)return res.status(429).json({error:'尝试次数过多，请稍后再试'});arr.push(time);attempts.set(ip,arr);next()}
app.get('/api/meta',(req,res)=>res.json(meta));
app.get('/api/me',(req,res)=>{const user=currentUser(req);if(user)renewSession(req,res);res.json({user:userOut(user)})});
app.post('/api/register',rateLimit,(req,res)=>{
 let name=clean(req.body.name,80),account=clean(req.body.account,120).toLowerCase(),password=String(req.body.password||''),city=clean(req.body.city,80);
 if(!name||!validAccount(account))return res.status(400).json({error:'请填写姓名及有效的手机号或邮箱'});
 if(password.length<8||password.length>128)return res.status(400).json({error:'密码长度需为 8 至 128 位'});
 try{let id=makeUser(name,account,password,'member',city),u=db.prepare('SELECT * FROM users WHERE id=?').get(id);loginUser(res,u);res.status(201).json({user:userOut(u)})}catch(e){if(String(e.code).startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'这个手机号或邮箱已注册'});throw e}
});
app.post('/api/login',rateLimit,(req,res)=>{
 const account=clean(req.body.account,120).toLowerCase(),password=String(req.body.password||'');const u=identities.findByAccount(account);
 let good=false;if(u&&password.length<=128){let h=Buffer.from(hashPassword(password,u.salt),'hex'),expected=Buffer.from(u.passhash,'hex');good=h.length===expected.length&&crypto.timingSafeEqual(h,expected)}
 if(!good)return res.status(401).json({error:'账号或密码不正确'});
 if(req.body.admin===true&&u.role!=='admin')return res.status(403).json({error:'该账号没有管理权限，请使用管理员账号登录'});
 loginUser(res,u);res.json({user:userOut(u)});
});

// This deliberately insecure-looking code is NOT delivered by SMS/email.
// It is shown on screen solely to exercise a synthetic test flow. It cannot
// authenticate an ordinary account or an administrator, and is off in prod.
const testChallenges=new Map();
app.post('/api/test-code/start',rateLimit,(req,res)=>{
 if(!TEST_OTP_ENABLED)return res.status(503).json({error:'测试验证码未启用，真实验证码尚未开通'});
 const channel=clean(req.body.channel,12),identifier=clean(req.body.identifier,120).toLowerCase();
 if(channel==='phone'&&!/^000\d{8}$/.test(identifier))return res.status(400).json({error:'测试手机号须为 000 开头的 11 位虚构号码'});
 if(channel==='email'&&!/^[a-z0-9._+-]{1,64}@example\.invalid$/.test(identifier))return res.status(400).json({error:'测试邮箱须以 @example.invalid 结尾'});
 if(!['phone','email'].includes(channel))return res.status(400).json({error:'请选择测试方式'});
 const id=crypto.randomBytes(24).toString('base64url'),code=String(crypto.randomInt(100000,1000000));
 const account='demo-'+channel+'-'+secure.lookup('demo-identifier',identifier).slice(0,32)+'@example.invalid';
 const expiresAt=Date.now()+5*60*1000;
 for(const [k,v] of testChallenges)if(v.expiresAt<Date.now())testChallenges.delete(k);
 if(testChallenges.size>1000)return res.status(429).json({error:'测试请求过多，请稍后重试'});
 testChallenges.set(id,{codeHash:tokenHash(code),account,expiresAt,attempts:0});
 res.json({challenge:id,demoCode:code,expiresIn:300,testOnly:true,notice:'测试码直接显示在页面，未发送短信或邮件。请勿使用真实资料。'});
});
app.post('/api/test-code/verify',rateLimit,(req,res)=>{
 if(!TEST_OTP_ENABLED)return res.status(503).json({error:'测试验证码未启用'});
 const id=String(req.body.challenge||''),code=String(req.body.code||''),challenge=testChallenges.get(id);
 if(!challenge||challenge.expiresAt<Date.now()||challenge.attempts>=5){testChallenges.delete(id);return res.status(400).json({error:'测试码已失效，请重新获取'})}
 challenge.attempts++;
 const actual=Buffer.from(tokenHash(code),'hex'),expected=Buffer.from(challenge.codeHash,'hex');
 if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return res.status(400).json({error:'测试码不正确'});
 testChallenges.delete(id);
 let user=identities.findByAccount(challenge.account),isNew=false;
 if(user&&(!user.testOtp||user.role!=='member'))return res.status(403).json({error:'此测试身份不可使用验证码'});
 if(!user){const uid=makeUser('测试顾客',challenge.account,crypto.randomBytes(24).toString('base64url'),'member','',{testOtp:true});user=identities.hydrate(db.prepare('SELECT * FROM users WHERE id=?').get(uid));isNew=true}
 loginUser(res,user);res.json({user:userOut(user),isNew,testOnly:true});
});
app.post('/api/logout',requireUser,(req,res)=>{let t=cookieValue(req,'ry_session');if(t)db.prepare('DELETE FROM sessions WHERE tokenHash=?').run(tokenHash(t));res.clearCookie('ry_session',{...cookieOpts,maxAge:undefined});res.json({ok:true})});
app.patch('/api/profile',requireUser,(req,res)=>{
 const name=clean(req.body.name,80),city=clean(req.body.city,80),gender=clean(req.body.gender,10),special=clean(req.body.special,2000),account=clean(req.body.account||req.user.account,120).toLowerCase();let age=req.body.age===''||req.body.age==null?null:Number(req.body.age);
 if(!name)return res.status(400).json({error:'请填写姓名'});if(!validAccount(account))return res.status(400).json({error:'请填写有效的手机号或邮箱'});if((req.user.account==='demo@meditrip.cn'||req.user.testOtp)&&account!==req.user.account)return res.status(403).json({error:'演示账号不可修改登录账号'});if(age!==null&&(!Number.isInteger(age)||age<0||age>125))return res.status(400).json({error:'年龄无效'});
 if(!['','男','女','其他'].includes(gender))return res.status(400).json({error:'性别无效'});
 let identityType=req.user.identity_type,identityCipher=req.user.identity_cipher,identityConsent=req.user.identity_consent_at;
 const number=String(req.body.identityNumber||'').replace(/\s+/g,'').toUpperCase();
 if(req.body.clearIdentity===true){identityType=null;identityCipher=null;identityConsent=null}
 else if(number){identityType=clean(req.body.identityType,16);if(req.body.identityConsent!==true)return res.status(400).json({error:'请先确认自愿填写证件信息'});if(!['idcard','passport'].includes(identityType))return res.status(400).json({error:'请选择证件类型'});if(identityType==='idcard'&&!/^(?:\d{15}|\d{17}[\dX])$/.test(number))return res.status(400).json({error:'身份证号格式应为15位或18位'});if(identityType==='passport'&&!/^[A-Z0-9-]{5,32}$/.test(number))return res.status(400).json({error:'护照号格式不正确'});identityCipher=secure.sealText(number);identityConsent=now()}
 try{identities.replace(req.user.id,{...identities.profileFor(req.user.id),name,account,city,age,gender,special,identity_type:identityType,identity_cipher:identityCipher,identity_consent_at:identityConsent})}catch(e){if(String(e.code).startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'这个手机号或邮箱已被使用'});throw e}res.json({user:userOut(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id))});
});
app.post('/api/password',requireUser,(req,res)=>{if(req.user.account==='demo@meditrip.cn'||req.user.testOtp)return res.status(403).json({error:'演示账号不可修改密码，请注册个人测试账号'});const old=String(req.body.current||''),next=String(req.body.next||'');if(next.length<8||next.length>128)return res.status(400).json({error:'新密码长度需为 8 至 128 位'});let h=Buffer.from(hashPassword(old,req.user.salt),'hex'),v=Buffer.from(req.user.passhash,'hex');if(h.length!==v.length||!crypto.timingSafeEqual(h,v))return res.status(400).json({error:'当前密码不正确'});let salt=crypto.randomBytes(16).toString('hex');db.prepare('UPDATE users SET salt=?,passhash=? WHERE id=?').run(salt,hashPassword(next,salt),req.user.id);db.prepare('DELETE FROM sessions WHERE userId=?').run(req.user.id);res.clearCookie('ry_session',{...cookieOpts,maxAge:undefined});res.json({ok:true});});
const kinds=new Set(['bookings','records','logs','subscriptions','vitals','reminders','contacts']);
const fields={
 bookings:['hospitalId','hospitalName','customHospital','patientName','phone','department','serviceType','visitDate','period','needPickup','status','notes'],
 records:['bookingId','patientName','category','description','notes','viewedByAdmin'],
 logs:['logDate','meal','content','feeling','notes'], subscriptions:['topic','frequency'],
 vitals:['reminderId','kind','logDate','logTime','medName','dosage','taken','val1','val2','val3','unit','context','note'],
 reminders:['title','kind','detail','remindTime','days','active','startDate','endDate','createdBy'],
 contacts:['label','name','phone']
};
function cleanBody(kind,input,prior={}){
 let out={...prior}; for(const k of fields[kind])if(Object.prototype.hasOwnProperty.call(input,k)){
  let v=input[k]; if(['needPickup','viewedByAdmin','taken','active'].includes(k))v=!!v;
  else if(k==='days')v=Array.isArray(v)?v.slice(0,7).map(x=>clean(x,8)):[];
  else if(['hospitalId','bookingId','reminderId','val1','val2','val3','createdBy'].includes(k))v=(v===''||v==null)?null:Number(v);
  else v=clean(v,k==='description'||k==='notes'||k==='content'?4000:300);
  out[k]=v;
 }return out;
}
function validateItem(kind,o){
 if(kind==='bookings'&&(!o.patientName||!o.hospitalName||!o.visitDate||!o.serviceType))return '请填写医院、患者姓名、服务类型和就诊日期';
 if(kind==='bookings'&&!['pending','confirmed','completed','cancelled'].includes(o.status))return '预约状态无效';
 if(kind==='records'&&(!o.patientName||!o.category||!o.description))return '请填写患者姓名、资料类别和病情描述';
 if(kind==='records'&&/(身份证|护照|证件照|identity card|passport)/i.test(o.category))return '身份证或护照照片不得作为病情资料上传';
 if(kind==='logs'&&(!o.logDate||!o.content))return '请填写日期和打卡内容';
 if(kind==='subscriptions'&&(!o.topic||!o.frequency))return '请选择主题和频率';
 if(kind==='vitals'&&(!o.kind||!o.logDate))return '请填写打卡类别和日期';
 if(kind==='reminders'){
  if(!o.title||!o.remindTime)return '请填写提醒标题和时间';
  if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(o.remindTime))return '提醒时间无效';
  if((o.startDate&&!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate))||(o.endDate&&!/^\d{4}-\d{2}-\d{2}$/.test(o.endDate)))return '提醒日期无效';
  if(o.startDate&&o.endDate&&o.startDate>o.endDate)return '结束日期不能早于开始日期';
  if(o.days&&(!Array.isArray(o.days)||o.days.some(x=>!['一','二','三','四','五','六','日'].includes(x))))return '提醒星期无效';
 }
 if(kind==='contacts'&&(!o.name||!o.phone))return '请填写联系人和电话';return null;
}
function validateRelations(kind,data,userId){
 if(kind==='records'&&data.bookingId&&!db.prepare('SELECT id FROM items WHERE id=? AND userId=? AND kind=?').get(data.bookingId,userId,'bookings'))return '关联预约不存在';
 if(kind==='vitals'&&data.reminderId&&!db.prepare('SELECT id FROM items WHERE id=? AND userId=? AND kind=?').get(data.reminderId,userId,'reminders'))return '关联提醒不存在';
 return null;
}
app.get('/api/items/:kind',requireUser,(req,res)=>{if(!kinds.has(req.params.kind))return res.status(404).json({error:'未知类别'});res.json(listItems(req.params.kind,req.user.id))});
app.post('/api/items/:kind',requireUser,(req,res)=>{
 let kind=req.params.kind;if(!kinds.has(kind)||kind==='reminders')return res.status(404).json({error:'未知类别'});let data=cleanBody(kind,req.body);
 if(kind==='bookings'){data.status='pending';data.department='待分诊'}if(kind==='records')data.viewedByAdmin=false;
 let err=validateItem(kind,data);if(err)return res.status(400).json({error:err});
 if(kind==='subscriptions'&&listItems(kind,req.user.id).some(s=>s.topic===data.topic))return res.status(409).json({error:'已订阅该主题'});
 let relationError=validateRelations(kind,data,req.user.id);if(relationError)return res.status(400).json({error:relationError});
 const id=insertItem(req.user.id,kind,data);res.status(201).json(itemOut(db.prepare('SELECT * FROM items WHERE id=?').get(id)));
});
app.patch('/api/items/:kind/:id',requireUser,(req,res)=>{
 let kind=req.params.kind;if(kind==='reminders')return res.status(403).json({error:'提醒由管理员管理'});let row=db.prepare('SELECT * FROM items WHERE id=? AND userId=? AND kind=?').get(req.params.id,req.user.id,kind);if(!row||!kinds.has(kind))return res.status(404).json({error:'记录不存在'});
 let prev=JSON.parse(secure.openText(row.body)),changes={...req.body};if(kind==='bookings'){delete changes.department;if(changes.status&&!['cancelled','completed'].includes(changes.status))return res.status(403).json({error:'该状态只能由管理员设置'})}if(kind==='records')delete changes.viewedByAdmin;
 let data=cleanBody(kind,changes,prev),err=validateItem(kind,data)||validateRelations(kind,data,req.user.id);if(err)return res.status(400).json({error:err});db.prepare('UPDATE items SET body=?,updatedAt=? WHERE id=?').run(secure.sealText(JSON.stringify(data)),now(),row.id);res.json(itemOut(db.prepare('SELECT * FROM items WHERE id=?').get(row.id)));
});
app.delete('/api/items/:kind/:id',requireUser,(req,res)=>{let kind=req.params.kind;if(kind==='reminders')return res.status(403).json({error:'提醒由管理员管理'});if(!kinds.has(kind))return res.status(404).json({error:'未知类别'});const result=db.prepare('DELETE FROM items WHERE id=? AND userId=? AND kind=?').run(req.params.id,req.user.id,kind);if(!result.changes)return res.status(404).json({error:'记录不存在'});res.json({ok:true})});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024,files:1}});
function fileIsImage(f){let b=f.buffer;return (f.mimetype==='image/jpeg'&&b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)||(f.mimetype==='image/png'&&b.length>8&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))||(f.mimetype==='image/webp'&&b.length>12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')}
app.post('/api/records/:id/attachments',requireUser,upload.single('file'),async(req,res)=>{let row=db.prepare('SELECT * FROM items WHERE id=? AND userId=? AND kind=?').get(req.params.id,req.user.id,'records');if(!row)return res.status(404).json({error:'资料不存在'});if(!req.file||!fileIsImage(req.file))return res.status(400).json({error:'仅支持有效的 JPG、PNG 或 WebP 图片'});if(/(?:身份证|护照|证件照|id[ _-]*card|passport)/i.test(req.file.originalname))return res.status(400).json({error:'禁止上传证件照片'});if(req.body.confirmNoIdPhoto!=='true')return res.status(400).json({error:'请确认图片不包含身份证或护照照片'});if(db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE recordId=?').get(row.id).n>=50)return res.status(400).json({error:'每份资料最多上传 50 张图片'});
 try{if(!validImageDimensions(req.file.buffer,req.file.mimetype))throw new Error('invalid image')}catch{return res.status(400).json({error:'图片格式或尺寸无效，请选择有效图片'})}
 let r=db.prepare('INSERT INTO attachments(recordId,name,mime,bytes,createdAt) VALUES(?,?,?,?,?)').run(row.id,secure.sealText(clean(path.basename(req.file.originalname),120)),req.file.mimetype,secure.sealBytes(req.file.buffer),now());res.status(201).json({id:Number(r.lastInsertRowid)})});
app.get('/api/attachments/:id',requireUser,(req,res)=>{let f=db.prepare('SELECT a.*,i.userId FROM attachments a JOIN items i ON i.id=a.recordId WHERE a.id=?').get(req.params.id);if(!f||(f.userId!==req.user.id&&req.user.role!=='admin'))return res.status(404).end();res.set({'Content-Type':f.mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(secure.openBytes(f.bytes))});
app.delete('/api/attachments/:id',requireUser,(req,res)=>{let f=db.prepare('SELECT a.id,i.userId FROM attachments a JOIN items i ON i.id=a.recordId WHERE a.id=?').get(req.params.id);if(!f||f.userId!==req.user.id)return res.status(404).json({error:'图片不存在'});db.prepare('DELETE FROM attachments WHERE id=?').run(f.id);res.json({ok:true})});
app.get('/api/admin/all',requireUser,requireAdmin,(req,res)=>{let users=db.prepare('SELECT * FROM users ORDER BY id DESC').all().map(userOut);let items={};for(let k of kinds)items[k]=allItems(k);res.json({users,items})});
app.post('/api/admin/reminders',requireUser,requireAdmin,(req,res)=>{let uid=Number(req.body.userId);if(!db.prepare('SELECT id FROM users WHERE id=?').get(uid))return res.status(404).json({error:'用户不存在'});let data=cleanBody('reminders',{...req.body,createdBy:req.user.id,active:true});let err=validateItem('reminders',data);if(err)return res.status(400).json({error:err});let id=insertItem(uid,'reminders',data);res.status(201).json(itemOut(db.prepare('SELECT * FROM items WHERE id=?').get(id)))});
app.patch('/api/admin/items/:id',requireUser,requireAdmin,(req,res)=>{let row=db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);if(!row||!kinds.has(row.kind))return res.status(404).json({error:'记录不存在'});let data=cleanBody(row.kind,req.body,JSON.parse(secure.openText(row.body))),err=validateItem(row.kind,data);if(err)return res.status(400).json({error:err});db.prepare('UPDATE items SET body=?,updatedAt=? WHERE id=?').run(secure.sealText(JSON.stringify(data)),now(),row.id);res.json(itemOut(db.prepare('SELECT * FROM items WHERE id=?').get(row.id)))});
app.delete('/api/admin/items/:id',requireUser,requireAdmin,(req,res)=>{const r=db.prepare('DELETE FROM items WHERE id=?').run(req.params.id);if(!r.changes)return res.status(404).json({error:'记录不存在'});res.json({ok:true})});
app.patch('/api/admin/users/:id',requireUser,requireAdmin,(req,res)=>{let u=identities.hydrate(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id));if(!u)return res.status(404).json({error:'用户不存在'});let role=clean(req.body.role,10);if(!['admin','member'].includes(role))return res.status(400).json({error:'角色无效'});if(u.testOtp&&role==='admin')return res.status(403).json({error:'测试验证码账号不能被设为管理员'});if(u.role==='admin'&&role!=='admin'&&db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n<=1)return res.status(400).json({error:'必须保留至少一名管理员'});db.prepare('UPDATE users SET role=? WHERE id=?').run(role,u.id);res.json({ok:true})});
app.delete('/api/admin/users/:id',requireUser,requireAdmin,(req,res)=>{let u=identities.hydrate(db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id));if(!u)return res.status(404).json({error:'用户不存在'});if(u.id===req.user.id)return res.status(400).json({error:'不能删除当前账号'});if(u.account==='demo@meditrip.cn')return res.status(400).json({error:'不能删除内置演示账号'});if(u.role==='admin'&&db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n<=1)return res.status(400).json({error:'必须保留至少一名管理员'});db.prepare('DELETE FROM users WHERE id=?').run(u.id);res.json({ok:true})});
function csvCell(x){let s=x==null?'':typeof x==='object'?JSON.stringify(x):String(x);if(/^[\u0000-\u0020]*[=+\-@]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
app.get('/api/admin/export/:kind',requireUser,requireAdmin,(req,res)=>{let kind=req.params.kind;if(!kinds.has(kind)&&kind!=='users')return res.status(404).end();let rows=kind==='users'?db.prepare('SELECT * FROM users').all().map(userOut).map(({id,name,account,city,age,gender,role,createdAt,archiveNumber})=>({id,name,account,city,age,gender,role,createdAt,archiveNumber})):allItems(kind);let keys=[...new Set(rows.flatMap(Object.keys))].filter(k=>k!=='attachments');let csv='\ufeff'+keys.map(csvCell).join(',')+'\r\n'+rows.map(r=>keys.map(k=>csvCell(r[k])).join(',')).join('\r\n');res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${kind}.csv"`}).send(csv)});
const features=require('./features.cjs')({app,db,config,state,secure,identities,requireUser,requireAdmin,clean,now,userOut,listItems,fileIsImage});
db.initializeImageCleanup();
app.use('/api',(err,req,res,next)=>{if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'图片不能超过 4 MB':'文件上传失败'});console.error('API error:',err.message);res.status(500).json({error:'服务暂时不可用，请稍后重试'})});

const customerManifest={id:'/',name:'蓉渝康养行 · 来华就诊陪诊',short_name:'蓉渝康养行',description:'成渝名院陪诊、中医国粹、康养与旅行疗愈。',lang:'zh-CN',start_url:'/?source=pwa',scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#0f766e',icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],shortcuts:[{name:'预约陪诊',url:'/bookings?new=1&source=shortcut',icons:[{src:'/icons/shortcut-96.png',sizes:'96x96',type:'image/png'}]},{name:'中医国粹',url:'/tcm',icons:[{src:'/icons/shortcut-96.png',sizes:'96x96',type:'image/png'}]},{name:'康养打卡',url:'/journal',icons:[{src:'/icons/shortcut-96.png',sizes:'96x96',type:'image/png'}]}]};
const adminManifest={id:'/admin',name:'蓉渝康养行 · 管理端',short_name:'康养行管理',lang:'zh-CN',start_url:'/admin?source=pwa',scope:'/admin',display:'standalone',background_color:'#0f172a',theme_color:'#0f172a',icons:[{src:'/icons/admin-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/admin-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/admin-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],shortcuts:[{name:'陪诊预约',url:'/admin?tab=bookings',icons:[{src:'/icons/admin-192.png',sizes:'192x192',type:'image/png'}]},{name:'注册用户',url:'/admin?tab=users',icons:[{src:'/icons/admin-192.png',sizes:'192x192',type:'image/png'}]}]};
function manifestForLanguage(req,manifest,admin=false){
 const first=String(req.get('accept-language')||'zh-CN').split(',')[0].trim().toLowerCase();
 if(first.startsWith('zh'))return manifest;
 const en={...manifest,lang:'en',name:admin?'Rongyu Care · Admin':'Rongyu Care · Medical Escort',short_name:admin?'Rongyu Admin':'Rongyu Care'};
 if(!admin)en.description='Medical accompaniment, traditional Chinese health education and recovery travel.';
 const names=admin?['Appointments','Customers']:['Book an escort','Traditional Chinese medicine','Recovery journal'];
 en.shortcuts=(manifest.shortcuts||[]).map((x,i)=>({...x,name:names[i]||x.name}));return en;
}
app.get('/manifest.webmanifest',(req,res)=>res.vary('Accept-Language').type('application/manifest+json').send(manifestForLanguage(req,customerManifest)));
app.get('/admin.webmanifest',(req,res)=>res.vary('Accept-Language').type('application/manifest+json').send(manifestForLanguage(req,adminManifest,true)));

return {app,dispatchDue:features.dispatchDue,pushEnabled:features.pushEnabled};
};
