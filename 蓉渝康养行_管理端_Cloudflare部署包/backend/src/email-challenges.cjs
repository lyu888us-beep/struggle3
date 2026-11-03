'use strict';
// Internal building block only: no public HTTP endpoints are enabled here.
// Tokens are random, stored hashed, bound to the current account index, and
// consumed atomically with the caller's database-only action.
const crypto=require('node:crypto');
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
const validKind=kind=>kind==='verify-email'||kind==='reset-password';
module.exports=function createEmailChallenges({db,accountIndex,now=Date.now,randomBytes=crypto.randomBytes}){
 db.exec(`CREATE TABLE IF NOT EXISTS email_challenges (
  tokenHash TEXT PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accountIndex TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('verify-email','reset-password')),
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
 );
 CREATE INDEX IF NOT EXISTS email_challenges_user ON email_challenges(userId,kind);
 CREATE TABLE IF NOT EXISTS verified_emails (
  userId INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accountIndex TEXT NOT NULL,
  verifiedAt INTEGER NOT NULL
 );`);
 function verified(userId,account){
  if(typeof account!=='string'||!account)return false;
  const row=db.prepare('SELECT accountIndex FROM verified_emails WHERE userId=?').get(userId);
  return !!row&&row.accountIndex===accountIndex(account);
 }
 function issue(userId,account,kind,ttlMs=15*60*1000){
  if(!Number.isSafeInteger(userId)||userId<1||typeof account!=='string'||!account||!validKind(kind)||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>3600000)throw new Error('Invalid email challenge');
  if(kind==='reset-password'&&!verified(userId,account))throw new Error('Email not verified');
  const token=randomBytes(32).toString('base64url'),time=now(),hash=digest(token);
  db.transaction(()=>{
   db.prepare('DELETE FROM email_challenges WHERE userId=? AND kind=?').run(userId,kind);
   db.prepare('INSERT INTO email_challenges(tokenHash,userId,accountIndex,kind,expiresAt,createdAt) VALUES(?,?,?,?,?,?)').run(hash,userId,accountIndex(account),kind,time+ttlMs,time);
  })();
  return token;
 }
 // Call only with current account as fetched by trusted server code. Apply must
 // be synchronous and database-only; exceptions roll back token consumption.
 function consume(token,kind,getCurrentAccount,apply){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!validKind(kind))return false;
  return db.transaction(()=>{
   const row=db.prepare('SELECT * FROM email_challenges WHERE tokenHash=? AND kind=?').get(digest(token),kind);
   if(!row||row.expiresAt<=now())return false;
   const account=getCurrentAccount(row.userId);
   if(typeof account!=='string'||accountIndex(account)!==row.accountIndex)return false;
   if(kind==='reset-password'&&!verified(row.userId,account))return false;
   if(kind==='verify-email')db.prepare('INSERT INTO verified_emails(userId,accountIndex,verifiedAt) VALUES(?,?,?) ON CONFLICT(userId) DO UPDATE SET accountIndex=excluded.accountIndex,verifiedAt=excluded.verifiedAt').run(row.userId,row.accountIndex,now());
   apply(row.userId);
   // Invalidate all outstanding tokens for this user after an action.
   db.prepare('DELETE FROM email_challenges WHERE userId=?').run(row.userId);
   return true;
  })();
 }
 function invalidate(userId){db.prepare('DELETE FROM email_challenges WHERE userId=?').run(userId);db.prepare('DELETE FROM verified_emails WHERE userId=?').run(userId)}
 return {verified,issue,consume,invalidate};
};
