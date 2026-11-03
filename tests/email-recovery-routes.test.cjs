'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const crypto=require('node:crypto');
const dir='../蓉渝康养行_顾客端_Cloudflare部署包/backend/';const express=require(dir+'node_modules/express');const setup=require(dir+'src/email-recovery-routes.cjs');
test('mocked email verification and reset only affect verified member, revoke sessions and reject replay',async t=>{
 const db=new DatabaseSync(':memory:');db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY,account TEXT,role TEXT,salt TEXT,passhash TEXT); CREATE TABLE sessions(userId INTEGER); INSERT INTO users VALUES(1,'member@example.invalid','member','salt','old'); INSERT INTO users VALUES(2,'admin@example.invalid','admin','salt','old'); INSERT INTO sessions VALUES(1);");db.transaction=fn=>(...args)=>{db.exec('BEGIN');try{let r=fn(...args);db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
 const identities={hydrate:u=>u,findByAccount:a=>db.prepare('SELECT * FROM users WHERE account=?').get(a)};const secure={lookup:(domain,s)=>crypto.createHmac('sha256','fictional-key').update(domain+':'+s).digest('hex')};const sent=[];
 const app=express();app.use(express.json());const requireUser=(req,res,next)=>{req.user=identities.findByAccount('member@example.invalid');next()};
 const c=setup({app,db,config:{CUSTOMER_PUBLIC_URL:'https://example.test'},secure,identities,requireUser,hashPassword:p=>'hash:'+p,randomBytes:crypto.randomBytes,sendEmail:async mail=>sent.push(mail)});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});t.after(()=>{server.close();db.close()});const base=`http://127.0.0.1:${server.address().port}`;
 async function post(path,body={}){let r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}
 const extract=i=>new URLSearchParams(new URL(sent[i].resetUrl).hash.slice(1)).get('token');
 await post('/api/email-recovery/reset-request',{account:'member@example.invalid'});assert.equal(sent.length,0);
 assert.equal((await post('/api/email-recovery/verify-request')).status,200);assert.equal(sent[0].purpose,'verify-email');let verify=extract(0);
 assert.equal((await post('/api/email-recovery/verify',{token:verify})).status,200);assert.equal((await post('/api/email-recovery/verify',{token:verify})).status,400);assert.equal(c.verified(1,'member@example.invalid'),true);
 await post('/api/email-recovery/reset-request',{account:'admin@example.invalid'});assert.equal(sent.length,1);
 await post('/api/email-recovery/reset-request',{account:'member@example.invalid'});assert.equal(sent.length,2);let token=extract(1);
 assert.equal((await post('/api/email-recovery/reset',{token,password:'newpassword'})).status,200);assert.equal((await post('/api/email-recovery/reset',{token,password:'newpassword'})).status,400);
 assert.equal(db.prepare('SELECT passhash FROM users WHERE id=1').get().passhash,'hash:newpassword');assert.equal(db.prepare('SELECT count(*) AS n FROM sessions WHERE userId=1').get().n,0);
});
