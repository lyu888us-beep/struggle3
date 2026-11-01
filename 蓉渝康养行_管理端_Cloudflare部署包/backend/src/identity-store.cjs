'use strict';
// Separates encrypted identifying/profile data from the pseudonymous users and
// records tables. This is table/field separation, not a separate trust domain:
// an operator with the database AND the key can still decrypt the data.
const crypto=require('crypto');

module.exports=function createIdentityStore(db,secure){
 db.exec(`CREATE TABLE IF NOT EXISTS user_identity_vault(
   userId INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
   accountIndex TEXT NOT NULL UNIQUE,
   profileCipher TEXT NOT NULL,
   archiveNumber TEXT NOT NULL UNIQUE
 );`);
 const getVault=db.prepare('SELECT * FROM user_identity_vault WHERE userId=?');
 const getByIndex=db.prepare('SELECT userId FROM user_identity_vault WHERE accountIndex=?');
 const insert=db.prepare('INSERT INTO user_identity_vault(userId,accountIndex,profileCipher,archiveNumber) VALUES(?,?,?,?)');
 const update=db.prepare('UPDATE user_identity_vault SET accountIndex=?,profileCipher=? WHERE userId=?');
 const accountIndex=account=>secure.lookup('account-v1',String(account).trim().toLowerCase());
 const makeArchiveNumber=()=>`RY-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
 function add(userId,profile){
  if(!profile||!profile.account)throw new Error('Missing account for identity vault');
  const normalized={...profile,account:String(profile.account).trim().toLowerCase()};
  for(let i=0;i<5;i++){
   try{insert.run(userId,accountIndex(normalized.account),secure.sealText(JSON.stringify(normalized)),makeArchiveNumber());return}
   catch(e){if(!String(e.message).includes('archiveNumber')||i===4)throw e}
  }
 }
 function profileFor(userId){
  const entry=getVault.get(userId);if(!entry)throw new Error('User identity is missing; restore the correct database backup');
  let profile;try{profile=JSON.parse(secure.openText(entry.profileCipher))}catch{throw new Error('Cannot decrypt user identity; verify the encryption key and backup')}
  return {...profile,archiveNumber:entry.archiveNumber};
 }
 function hydrate(user){return user?{...user,...profileFor(user.id)}:null}
 function findByAccount(account){let hit=getByIndex.get(accountIndex(account));return hit?hydrate(db.prepare('SELECT * FROM users WHERE id=?').get(hit.userId)):null}
 function replace(userId,profile){
  const existing=getVault.get(userId);if(!existing)throw new Error('User identity is missing');
  const {archiveNumber,...data}=profile;
  if(!data.account)throw new Error('Missing account for identity vault');
  data.account=String(data.account).trim().toLowerCase();
  update.run(accountIndex(data.account),secure.sealText(JSON.stringify(data)),userId);
 }
 // Startup migration is transactional; the caller must first take a consistent
 // DB+key backup. Keep IDs intact for sessions, appointments and attachments.
 function migrate(){
  const rows=db.prepare('SELECT * FROM users WHERE NOT EXISTS (SELECT 1 FROM user_identity_vault v WHERE v.userId=users.id)').all();
  if(!rows.length)return 0;
  db.pragma('secure_delete = ON');
  const clear=db.prepare('UPDATE users SET name=?,account=?,city=?,age=NULL,gender=?,special=?,identity_type=NULL,identity_cipher=NULL,identity_consent_at=NULL WHERE id=?');
  db.transaction(()=>{
   for(const u of rows){
    if(String(u.account).startsWith('internal-')&&String(u.account).endsWith('@invalid.local'))throw new Error('Pseudonymous user has no identity vault; refusing incomplete migration');
    add(u.id,{name:u.name,account:u.account,city:u.city||'',age:u.age??null,gender:u.gender||'',special:secure.openText(u.special||''),identity_type:u.identity_type||null,identity_cipher:u.identity_cipher||null,identity_consent_at:u.identity_consent_at||null,testOtp:false});
    clear.run('',`internal-${crypto.randomUUID()}@invalid.local`,'','','',u.id);
   }
  })();
  // Remove recoverable plaintext from free SQLite pages and truncate the WAL.
  // Old backups remain sensitive; keep them access-controlled and encrypted.
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.exec('VACUUM');
  db.pragma('wal_checkpoint(TRUNCATE)');
  return rows.length;
 }
 return {add,profileFor,hydrate,findByAccount,replace,migrate};
};
