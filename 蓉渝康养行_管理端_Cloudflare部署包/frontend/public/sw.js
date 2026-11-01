/* Cache public assets and app shells only. Private APIs are never cached. */
const V='rongyu-cloudflare-v12',STATIC=V+'-static',PAGES=V+'-pages',IMAGES=V+'-images';
const PUBLIC=['/','/medical','/tcm','/recovery','/travel','/offline'];
const SHELLS=['/offline-vault','/admin/offline-vault'];
const PRECACHE=['/offline','/manifest.webmanifest','/admin.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/admin-192.png','/icons/admin-512.png','/i18n/lang.js','/i18n/en.json'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const statics=await caches.open(STATIC),pages=await caches.open(PAGES);let assets=new Set();
 // Public shells are identical for every user. Same-origin credentials are
 // required for gateways with a visitor-confirmation cookie; private APIs are
 // never included. Reject a gateway's 200-OK HTML warning as an asset/shell.
 for(const url of PRECACHE){
  const r=await fetch(new Request(url,{credentials:'same-origin',cache:'reload'})),type=(r.headers.get('content-type')||'').toLowerCase();
  const expected=url==='/offline'?'text/html':url.endsWith('.json')||url.endsWith('.webmanifest')?'json':url.endsWith('.js')?'javascript':'image/';
  if(!r.ok||!type.includes(expected))throw new Error('Invalid public precache response: '+url);
  if(url==='/offline'&&!(await r.clone().text()).includes('蓉渝康养行'))throw new Error('Invalid offline page');
  await statics.put(url,r);
 }
 for(const url of [...PUBLIC,...SHELLS]){try{let r=await fetch(new Request(url,{credentials:'same-origin'}));let type=(r.headers.get('content-type')||'').toLowerCase();if(r.ok&&type.includes('text/html')){let text=await r.clone().text();if(!text.includes('蓉渝康养行'))continue;for(let m of text.matchAll(/\/(?:_next\/static|custom\/assets)\/[^"'\s)\\<>]+/g))assets.add(m[0]);await pages.put(url,r)}}catch{}}
 await Promise.all([...assets].map(async a=>{try{let r=await fetch(new Request(a,{credentials:'same-origin'})),type=(r.headers.get('content-type')||'').toLowerCase();if(r.ok&&type&&!type.includes('text/html'))await statics.put(a,r)}catch{}}));await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('rongyu-cloudflare-')&&!k.startsWith(V))await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);if(r.method!=='GET')return;if(u.origin===self.location.origin&&u.pathname.startsWith('/api/'))return;
 if(r.mode==='navigate'&&u.origin===self.location.origin){event.respondWith((async()=>{try{let result=await fetch(r);if(result.ok&&(PUBLIC.includes(u.pathname)||SHELLS.includes(u.pathname))){let c=await caches.open(PAGES);event.waitUntil(c.put(u.pathname,result.clone()))}return result}catch{let c=await caches.open(PAGES);if(PUBLIC.includes(u.pathname))return await c.match(u.pathname)||await caches.match('/offline');let shell=u.pathname.startsWith('/admin')?'/admin/offline-vault':'/offline-vault';return await c.match(shell)||await caches.match('/offline')||new Response('网络未连接，请联网后重试。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}})());return}
 if(u.origin===self.location.origin&&(u.pathname.startsWith('/_next/static/')||u.pathname.startsWith('/custom/assets/')||u.pathname.startsWith('/icons/')||u.pathname.startsWith('/i18n/'))){event.respondWith((async()=>{let c=await caches.open(STATIC),hit=await c.match(r);if(hit)return hit;let response=await fetch(r);if(response.ok)event.waitUntil(c.put(r,response.clone()));return response})());return}
 if((u.hostname==='images.pexels.com'||(u.origin===self.location.origin&&u.pathname.startsWith('/pexels/')))&&r.destination==='image'){event.respondWith((async()=>{let c=await caches.open(IMAGES),hit=await c.match(r);if(hit)return hit;let response=await fetch(r);if(response.ok||response.type==='opaque'){event.waitUntil((async()=>{await c.put(r,response.clone());let keys=await c.keys();if(keys.length>60)await Promise.all(keys.slice(0,keys.length-60).map(k=>c.delete(k)))})())}return response})())}
});
self.addEventListener('push',event=>{let data={};try{data=event.data?.json()||{}}catch{}event.waitUntil(self.registration.showNotification(data.title||'康养行提醒',{body:data.body||'请打开应用查看。',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:'rongyu-'+Date.now(),data:{url:typeof data.url==='string'?data.url:'/'}}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{let target;try{target=new URL(event.notification.data?.url||'/',self.location.origin);if(target.origin!==self.location.origin)target=new URL('/',self.location.origin)}catch{target=new URL('/',self.location.origin)}let windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(let w of windows){if(w.url===target.href){await w.focus();return}}await clients.openWindow(target.href)})())});
