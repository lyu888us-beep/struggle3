import { DurableObject } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import http from 'node:http';
import createDatabase from './database.cjs';
import createApp from './app.cjs';

// One named instance owns the shared SQLite database, transactions and alarm.
export class RongyuStore extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);this.startError=null;
  try{
   this.db=createDatabase(ctx.storage);
   this.runtime=createApp({db:this.db,config:env,state:ctx});
   this.server=http.createServer(this.runtime.app);
   // A virtual port in the Worker, not a public network socket.
   this.server.listen(0);this.port=this.server.address().port;
  }catch(error){this.startError=error;console.error('Rongyu backend initialization failed:',error.message)}
 }
 async fetch(request){
  if(this.startError)return Response.json({error:'后台尚未正确配置。请检查加密密钥、初始管理员密码及数据库迁移状态。'}, {status:503,headers:{'Cache-Control':'no-store'}});
  if(this.runtime.pushEnabled&&await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+60000);
  return handleAsNodeRequest(this.port,request);
 }
 async alarm(){
  if(this.startError||!this.runtime?.pushEnabled)return;
  try{await this.runtime.dispatchDue(new Date());if(this.env.ALARM_DEBUG==='1')console.log('Reminder alarm test tick')}catch(error){console.error('Reminder alarm failed:',error.message)}
  finally{await this.ctx.storage.setAlarm(Date.now()+60000)}
 }
}
export default {
 async fetch(request,env){
  const p=new URL(request.url).pathname;
  if(!p.startsWith('/api/')&&p!=='/manifest.webmanifest'&&p!=='/admin.webmanifest')return new Response('Not found',{status:404});
  return env.STORE.getByName('rongyu-shared-data-v1').fetch(request);
 }
};
