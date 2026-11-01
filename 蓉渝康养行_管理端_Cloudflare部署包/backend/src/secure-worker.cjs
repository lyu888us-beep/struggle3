'use strict';
// Data at rest is encrypted. This does not replace an independent security
// audit, access control, informed consent, backup, or medical-data compliance.
const crypto=require('node:crypto');
const TEXT_PREFIX='RYE1:',BLOB_PREFIX=Buffer.from('RYE1');
module.exports=function secureStorage(db,encoded){
 db.exec('CREATE TABLE IF NOT EXISTS security_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
 if(typeof encoded!=='string')throw new Error('DATA_ENCRYPTION_KEY is not configured');
 const raw=encoded.trim();
 if(!/^[0-9a-fA-F]{64}$/.test(raw)&&!/^[A-Za-z0-9+/]{43}=$/.test(raw))throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, as 64 hex characters or standard Base64');
 const key=/^[0-9a-fA-F]{64}$/.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');
 if(key.length!==32)throw new Error('DATA_ENCRYPTION_KEY must contain 32 bytes');
 function sealBytes(input){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(Buffer.from(input)),cipher.final()]);return Buffer.concat([BLOB_PREFIX,iv,cipher.getAuthTag(),body])}
 function openBytes(value){const b=Buffer.from(value);if(!b.subarray(0,4).equals(BLOB_PREFIX)||b.length<32)throw new Error('Encrypted data is invalid or truncated');const dec=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(4,16));dec.setAuthTag(b.subarray(16,32));return Buffer.concat([dec.update(b.subarray(32)),dec.final()])}
 function sealText(value){return TEXT_PREFIX+sealBytes(Buffer.from(String(value),'utf8')).subarray(4).toString('base64url')}
 function openText(value){const text=String(value??'');if(!text.startsWith(TEXT_PREFIX))throw new Error('Unencrypted data is not supported');return openBytes(Buffer.concat([BLOB_PREFIX,Buffer.from(text.slice(TEXT_PREFIX.length),'base64url')])).toString('utf8')}
 const sentinel=db.prepare("SELECT value FROM security_settings WHERE key='keycheck'").get();
 if(sentinel){try{if(openText(sentinel.value)!=='rongyu-security-keycheck-v1')throw new Error('invalid')}catch{throw new Error('DATA_ENCRYPTION_KEY does not match this database')}}
 else db.prepare("INSERT INTO security_settings(key,value) VALUES('keycheck',?)").run(sealText('rongyu-security-keycheck-v1'));
 const lookupKey=Buffer.from(crypto.hkdfSync('sha256',key,Buffer.alloc(0),Buffer.from('rongyu-keyed-lookup-v1'),32));
 function lookup(domain,value){return crypto.createHmac('sha256',lookupKey).update(String(domain)+'\0'+String(value)).digest('hex')}
 return {sealText,openText,sealBytes,openBytes,lookup};
};
