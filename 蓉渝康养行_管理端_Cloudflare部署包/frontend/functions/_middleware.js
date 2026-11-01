// SITE_KIND differs between the two deployable ZIPs. Both still use the
// identical BACKEND service binding and therefore the same database.
const SITE_KIND='admin';
const chapters={'/':'home','/medical':'medical','/recovery':'recovery','/travel':'travel','/offline':'offline'};
const globalHead=`<script defer src="/i18n/lang.js"></script><script>window.addEventListener('error',function(e){var i=e.target;if(i&&i.tagName==='IMG'&&!i.dataset.ryFallback&&i.currentSrc&&i.currentSrc.indexOf('/pexels/')!==-1){i.dataset.ryFallback='1';i.removeAttribute('srcset');i.src='/pexels/photos/39192358/pexels-photo-39192358.jpeg'}},true);</script>`;
const publicFix=globalHead+`<style>@media(max-width:1023px){section[class~="lg:col-span-3"],section[class~="lg:col-span-2"]{min-width:0}}</style><script>document.addEventListener('click',function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target.closest&&e.target.closest('a[href]');if(!a||a.target||a.hasAttribute('download'))return;var raw=a.getAttribute('href');if(!raw||raw.startsWith('#')||raw.startsWith('tel:')||raw.startsWith('mailto:'))return;var u=new URL(a.href,location.href);if(u.origin===location.origin){e.preventDefault();e.stopImmediatePropagation();location.assign(u.href)}},true);</script>`;
const adminMeta='<link rel="manifest" crossorigin="use-credentials" href="/admin.webmanifest"><link rel="apple-touch-icon" href="/icons/admin-apple-touch-icon.png"><meta name="apple-mobile-web-app-title" content="康养行管理"><meta name="theme-color" content="#0f172a">';
const customerMeta='<link rel="manifest" crossorigin="use-credentials" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-title" content="蓉渝康养行"><meta name="theme-color" content="#0f766e">';
export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url),p=url.pathname;
 if(p.startsWith('/api/')||p==='/manifest.webmanifest'||p==='/admin.webmanifest'){
  if(!env.BACKEND)return Response.json({error:'网站尚未连接共享后台，请配置 BACKEND Service Binding。'},{status:503,headers:{'Cache-Control':'no-store'}});
  try{return await env.BACKEND.fetch(request)}catch(error){console.error('Shared backend binding failed:',error.message);return Response.json({error:'共享后台暂不可用，请检查部署和绑定。'},{status:502,headers:{'Cache-Control':'no-store'}})}
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return context.next();
 if(SITE_KIND==='admin'&&p==='/')return Response.redirect(new URL('/admin',url),302);
 if(['/_next/','/icons/','/pexels/','/custom/','/i18n/','/shells/'].some(prefix=>p.startsWith(prefix))||p==='/sw.js')return context.next();
 const chapter=chapters[p],assetUrl=new URL('/shells/'+(chapter||'custom')+'.txt',url);assetUrl.search='';
 const asset=await env.ASSETS.fetch(assetUrl);
 if(!asset.ok)return new Response('应用文件未找到，请检查 Pages 构建目录。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 let html=await asset.text();const extra=chapter?publicFix:globalHead+(p.startsWith('/admin')?adminMeta:customerMeta);
 html=html.replace('</head>',extra+'</head>');
 return new Response(request.method==='HEAD'?null:html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
}
