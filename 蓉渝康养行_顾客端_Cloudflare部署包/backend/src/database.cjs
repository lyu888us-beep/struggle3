'use strict';
// Synchronous subset of better-sqlite3 backed by a single SQLite Durable Object.
// One named object is shared by both sites. Large encrypted images are split
// into sub-1-MiB rows to respect Cloudflare's per-row size limit.
const crypto=require('node:crypto');
module.exports=function database(storage){
 const sql=storage.sql;let depth=0;
 sql.exec('CREATE TABLE IF NOT EXISTS blob_chunks (fileKey TEXT NOT NULL, ordinal INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(fileKey,ordinal))');
 function query(statement,args=[]){
  try{return sql.exec(statement,...args)}catch(error){if(/(?:constraint|unique)/i.test(String(error.message)))error.code='SQLITE_CONSTRAINT';throw error}
 }
 function normalize(row){
  if(!row)return undefined;
  const r={...row};for(const [key,value] of Object.entries(r)){if(value instanceof ArrayBuffer)r[key]=Buffer.from(value);else if(ArrayBuffer.isView(value)&&!Buffer.isBuffer(value))r[key]=Buffer.from(value.buffer,value.byteOffset,value.byteLength)}
  if(typeof r.bytes==='string'&&r.bytes.startsWith('RYB2:')){
   const id=r.bytes.slice(5),chunks=query('SELECT bytes FROM blob_chunks WHERE fileKey=? ORDER BY ordinal',[id]).toArray();
   if(!chunks.length)throw new Error('Encrypted image chunks are missing');
   r.bytes=Buffer.concat(chunks.map(x=>Buffer.from(x.bytes)));
  }
  return r;
 }
 function write(statement,args){
  let values=[...args],blobIndex=-1;
  if(/^INSERT INTO attachments\s*\(/i.test(statement)||/^INSERT INTO message_attachments\s*\(/i.test(statement))blobIndex=3;
  const execute=()=>{
   if(blobIndex>=0){
    const source=values[blobIndex];if(!Buffer.isBuffer(source)&&!(source instanceof Uint8Array))throw new Error('Invalid encrypted image data');
    const bytes=Buffer.from(source),key=crypto.randomUUID(),chunkSize=512*1024;
    if(bytes.length===0)throw new Error('Empty image');
    for(let pos=0,part=0;pos<bytes.length;pos+=chunkSize,part++)query('INSERT INTO blob_chunks(fileKey,ordinal,bytes) VALUES(?,?,?)',[key,part,bytes.subarray(pos,Math.min(pos+chunkSize,bytes.length))]);
    values[blobIndex]='RYB2:'+key;
   }
   const c=query(statement,values),changes=c.rowsWritten;
   const last=query('SELECT last_insert_rowid() AS id').one();
   return {changes,lastInsertRowid:last.id};
  };
  return blobIndex>=0&&depth===0?storage.transactionSync(execute):execute();
 }
 const db={
  exec(statement){query(statement);return db},
  prepare(statement){return {
   get(...values){return normalize(query(statement,values).toArray()[0])},
   all(...values){return query(statement,values).toArray().map(normalize)},
   run(...values){return write(statement,values)}
  }},
  pragma(){return undefined},
  transaction(fn){return (...args)=>storage.transactionSync(()=>{depth++;try{return fn(...args)}finally{depth--}})},
  initializeImageCleanup(){
   query("CREATE TRIGGER IF NOT EXISTS delete_record_blob_chunks AFTER DELETE ON attachments WHEN typeof(OLD.bytes)='text' AND substr(OLD.bytes,1,5)='RYB2:' BEGIN DELETE FROM blob_chunks WHERE fileKey=substr(OLD.bytes,6); END");
   query("CREATE TRIGGER IF NOT EXISTS delete_message_blob_chunks AFTER DELETE ON message_attachments WHEN typeof(OLD.bytes)='text' AND substr(OLD.bytes,1,5)='RYB2:' BEGIN DELETE FROM blob_chunks WHERE fileKey=substr(OLD.bytes,6); END");
  }
 };
 return db;
};
