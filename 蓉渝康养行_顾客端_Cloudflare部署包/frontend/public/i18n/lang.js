/* Local-only language preview. The dictionary contains public static text only;
   customer-entered data is never sent to a translation service. */
(()=>{
 'use strict';
 const KEY='rongyu-language-v1',nodeState=new WeakMap(),attrState=new WeakMap();
 let choice='auto',language='zh',dictionary=null,loading=null,observer=null,ready=false;
 try{choice=localStorage.getItem(KEY)||'auto'}catch{}
 if(!['auto','zh','en'].includes(choice))choice='auto';
 function deviceLanguage(){
  const raw=String(navigator.language||(navigator.languages&&navigator.languages[0])||'').toLowerCase();
  if(/^zh(?:-|$)/.test(raw))return 'zh';
  if(raw&&raw!=='und')return 'en';
  // A coarse system time zone is used only if the device supplies no language.
  // We do not ask for GPS or send coordinates to any third party.
  try{return /^Asia\/(Shanghai|Chongqing|Urumqi|Hong_Kong|Taipei|Macau)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)?'zh':'en'}catch{return 'en'}
 }
 function currentLanguage(){return choice==='auto'?deviceLanguage():choice}
 function normalized(s){return String(s).replace(/\s+/g,' ').trim()}
 function translate(original){
  if(language!=='en'||!dictionary)return original;
  const match=String(original).match(/^(\s*)([\s\S]*?)(\s*)$/);if(!match||!match[2])return original;
  const key=normalized(match[2]),result=dictionary[key];
  return result?match[1]+result+match[3]:original;
 }
 const ignore='script,style,noscript,textarea,pre,code,[contenteditable="true"],[data-no-translate],.message-card p,.archive-patient p';
 function applyText(node){
  const parent=node.parentElement;if(!parent||parent.closest(ignore))return;
  const current=node.nodeValue||'',previous=nodeState.get(node);
  const original=previous&&current===previous.rendered?previous.original:current;
  const desired=translate(original);
  // An <option> without an explicit value uses its text as the submitted value.
  // Save its original value before translating its display label.
  if(desired!==original&&parent.tagName==='OPTION'&&!parent.hasAttribute('value'))parent.setAttribute('value',parent.value);
  nodeState.set(node,{original,rendered:desired});
  if(current!==desired)node.nodeValue=desired;
 }
 const attributes=['placeholder','title','aria-label','alt'];
 function applyAttributes(el){
  if(!el||el.nodeType!==1||el.closest('#ry-language-switch'))return;
  let states=attrState.get(el)||{};
  for(const name of attributes){
   if(!el.hasAttribute(name))continue;
   const current=el.getAttribute(name),old=states[name];
   const original=old&&current===old.rendered?old.original:current,desired=translate(original);
   states[name]={original,rendered:desired};if(current!==desired)el.setAttribute(name,desired);
  }
  attrState.set(el,states);
 }
 function applyTree(root){
  if(!root||root.closest?.('#ry-language-switch'))return;
  if(root.nodeType===3){applyText(root);return}
  if(root.nodeType!==1&&root.nodeType!==9)return;
  if(root.nodeType===1)applyAttributes(root);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){let n=walker.currentNode;if(n.nodeType===3)applyText(n);else applyAttributes(n)}
 }
 function loadDictionary(){
  if(dictionary)return Promise.resolve();if(loading)return loading;
  loading=fetch('/i18n/en.json',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('dictionary unavailable');return r.json()}).then(x=>{dictionary=x}).catch(()=>{loading=null});return loading;
 }
 function renderSwitch(){
  if(!document.body||document.getElementById('ry-language-switch'))return;
  const wrap=document.createElement('aside');wrap.id='ry-language-switch';wrap.setAttribute('aria-label','Language / 语言');
  wrap.innerHTML='<label for="ry-language-select">🌐 <span>语言 / Language</span></label><select id="ry-language-select"><option value="auto">跟随系统 / Auto</option><option value="zh">中文</option><option value="en">English</option></select><small class="ry-translation-note">English is machine-translated and not medically reviewed.</small>';
  document.body.appendChild(wrap);
  const select=wrap.querySelector('select');select.value=choice;select.addEventListener('change',()=>{choice=select.value;try{localStorage.setItem(KEY,choice)}catch{}setLanguage()});
 }
 function setLanguage(){
  language=currentLanguage();document.documentElement.lang=language==='zh'?'zh-CN':'en';
  const box=document.getElementById('ry-language-switch');if(box)box.classList.toggle('is-en',language==='en');
  if(language==='en')loadDictionary().then(()=>applyTree(document.documentElement));else applyTree(document.documentElement);
 }
 function start(){
  if(ready)return;ready=true;renderSwitch();setLanguage();
  observer=new MutationObserver(records=>{
   for(const r of records){if(r.type==='characterData')applyText(r.target);else if(r.type==='attributes')applyAttributes(r.target);else for(const node of r.addedNodes)applyTree(node)}
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  window.addEventListener('languagechange',()=>{if(choice==='auto')setLanguage()});
 }
 const style=document.createElement('style');style.textContent=`
 #ry-language-switch{position:fixed;left:12px;bottom:14px;z-index:950;display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid #d7e4dc;border-radius:11px;background:#fffffff5;box-shadow:0 4px 18px #173d2d22;color:#2c5143;font:12px/1.25 system-ui,sans-serif}
 #ry-language-switch label{font-weight:650;white-space:nowrap}#ry-language-switch select{max-width:155px;border:1px solid #d7e4dc;border-radius:7px;background:white;color:#244b3e;font:12px system-ui;padding:4px}
 #ry-language-switch .ry-translation-note{display:none;color:#76520f;font-size:10px;max-width:180px;line-height:1.3}#ry-language-switch.is-en{flex-wrap:wrap;max-width:248px}#ry-language-switch.is-en .ry-translation-note{display:block;flex-basis:100%;max-width:none}
 @media(max-width:700px){#ry-language-switch{bottom:76px;left:8px;padding:5px 7px}#ry-language-switch label span{display:none}#ry-language-switch select{max-width:120px}}
 `;document.head.appendChild(style);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
