import React,{useContext,useEffect,useMemo,useState,useCallback,createContext,useRef} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {Home, Users, TriangleAlert, Hospital, CalendarDays, Folder, Star, Activity, Heart, BookOpen, Check, Bell, Map, Smartphone, LogOut, Menu, X, Plus, ChevronRight, MessageSquare, Archive} from 'lucide-react';

export async function api(path,options={}){
 const opts={credentials:'same-origin',...options,headers:{...(options.headers||{})}};
 if(options.body&&!(options.body instanceof FormData)){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(options.body)}
 let response;try{response=await fetch(path,opts)}catch{throw new Error('网络连接失败，请检查网络后重试')}
 let data=null;try{data=await response.json()}catch{}
 if(!response.ok)throw new Error(data?.error||`请求失败（${response.status}）`);return data;
}
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'});
export function fmtDate(value){if(!value)return '待定';const d=new Date(String(value).length<=10?String(value)+'T12:00:00':value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString(document.documentElement.lang||'zh-CN',{year:'numeric',month:'long',day:'numeric'})}
export const statusLabels={pending:'待确认',confirmed:'已确认',completed:'已完成',cancelled:'已取消'};
export const kindsLabels={medication:'服药',blood_pressure:'血压',blood_sugar:'血糖',weight:'体重',temperature:'体温',other:'其他'};
export function money(x){return typeof x==='number'?'¥'+x:''}

export const AuthContext=createContext(null);
export function useAuth(){return useContext(AuthContext)}
const ToastContext=createContext(()=>{});
export function useToast(){return useContext(ToastContext)}
export function ToastProvider({children}){
 const [toasts,setToasts]=useState([]);
 const show=useCallback((text,type='success')=>{const id=Date.now()+Math.random();setToasts(t=>[...t,{id,text,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3800)},[]);
 return <ToastContext.Provider value={show}>{children}<div className="toast-stack" aria-live="polite">{toasts.map(t=><div key={t.id} className={'toast '+t.type}>{t.text}</div>)}</div></ToastContext.Provider>
}
export function useRemote(url,initial=[]){
 const [data,setData]=useState(initial),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{try{setLoading(true);setError('');let result=await api(url);setData(result);return result}catch(e){setError(e.message);throw e}finally{setLoading(false)}},[url]);
 useEffect(()=>{let active=true;setLoading(true);api(url).then(d=>{if(active){setData(d);setError('')}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[url]);
 return {data,setData,loading,error,reload};
}
export function Modal({title,onClose,children,wide=false}){
 const ref=useRef(null),closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{const prior=document.body.style.overflow;document.body.style.overflow='hidden';const onKey=e=>{if(e.key==='Escape')closeRef.current()};document.addEventListener('keydown',onKey);ref.current?.focus();return()=>{document.body.style.overflow=prior;document.removeEventListener('keydown',onKey)}},[]);
 return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={'modal '+(wide?'modal-wide':'')} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" type="button" onClick={onClose} aria-label="关闭"><X size={19}/></button></div><div className="modal-body">{children}</div></section></div>
}
export function Field({label,children,hint,full=false}){
 const generated=React.useId(),id='field-'+generated.replace(/:/g,''),hintId=id+'-hint';let assigned=false;
 function withId(node){return React.Children.map(node,child=>{if(!React.isValidElement(child))return child;if(!assigned&&['input','select','textarea'].includes(child.type)){assigned=true;return React.cloneElement(child,{id:child.props.id||id,...(hint?{'aria-describedby':hintId}:{})})}if(child.props.children)return React.cloneElement(child,{},withId(child.props.children));return child})}
 return <div className={'field '+(full?'field-full':'')}><label htmlFor={id}>{label}</label>{withId(children)}{hint&&<small id={hintId}>{hint}</small>}</div>
}
export function Button({children,variant='',className='',...props}){return <button className={`btn ${variant&&'btn-'+variant} ${className}`} {...props}>{children}</button>}
export function Badge({children,tone='slate'}){return <span className={'badge '+tone}>{children}</span>}
export function PageHeader({eyebrow,title,description,action}){return <div className="page-header"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div className="header-action">{action}</div>}</div>}
export function Empty({title='暂无内容',description,action}){return <div className="empty"><div className="empty-icon"><Folder size={22}/></div><strong>{title}</strong>{description&&<p>{description}</p>}{action}</div>}
export function Loading({error}){return <div className="loading-box">{error?<><TriangleAlert size={20}/>{error}</>:<>正在加载…</>}</div>}
export function Confirm(value){return window.confirm(typeof value==='string'?value:value?.message)}

const nav=[
 {label:'总览',to:'/dashboard',icon:Home},{label:'个人资料',to:'/profile',icon:Users},{label:'紧急求助',to:'/sos',icon:TriangleAlert},
 {section:'板块一 · 陪诊就医',to:'/medical'},{label:'成渝名院',to:'/hospitals',icon:Hospital},{label:'我的陪诊预约',to:'/bookings',icon:CalendarDays},{label:'健康档案',to:'/records',icon:Folder},{label:'服务消息',to:'/messages',icon:MessageSquare},{label:'本机离线档案',to:'/offline-vault',icon:Archive},
 {section:'板块二 · 中医国粹',to:'/tcm'},{label:'中医诊疗项目',to:'/therapies',icon:Star},
 {section:'板块三 · 康养之路',to:'/recovery'},{label:'用药监测',to:'/health',icon:Activity},{label:'术后食疗方',to:'/recipes',icon:Heart},{label:'康养知识',to:'/knowledge',icon:BookOpen},{label:'康养打卡',to:'/journal',icon:Check},{label:'主题订阅',to:'/subscriptions',icon:Bell},
 {section:'板块四 · 旅行疗愈',to:'/travel'},{label:'旅行目的地',to:'/trips',icon:Map},{label:'安装手机 App',to:'/download',icon:Smartphone}
];
const bottom=[{to:'/dashboard',label:'总览',icon:Home},{to:'/bookings',label:'陪诊',icon:CalendarDays},{to:'/therapies',label:'中医',icon:Star},{to:'/recipes',label:'康养',icon:Heart},{to:'/records',label:'档案',icon:Folder},{to:'/trips',label:'旅行',icon:Map}];
export function AppShell({children}){
 const {user,logout}=useAuth(),loc=useLocation(),navigate=useNavigate(),[menu,setMenu]=useState(false),toast=useToast();
 useEffect(()=>{setMenu(false)},[loc.pathname]);
 async function signOut(){try{await logout();navigate('/login')}catch(e){toast(e.message,'error')}}
 const links=<><a className="side-brand" href="/"><span className="brand-mark">✚</span><strong>蓉渝康养行</strong></a><nav className="side-nav">{nav.map((n,i)=>n.section?<a className="side-section" href={n.to} key={i}>{n.section}<span>↗</span></a>:<Link className={'side-link '+(loc.pathname===n.to?'active':'')} to={n.to} key={n.to}><n.icon size={18}/><span>{n.label}</span></Link>)}</nav><div className="side-user"><div className="avatar">{user?.name?.slice(0,1)||'会'}</div><div className="side-user-text"><b>{user?.name}</b><span>{user?.role==='admin'?'管理员':'会员'}</span></div><button className="side-logout" aria-label="退出登录" title="退出登录" onClick={signOut}><LogOut size={18}/></button></div></>;
 return <div className="app-shell"><aside className={'sidebar '+(menu?'sidebar-open':'')}>{links}</aside>{menu&&<button className="drawer-scrim" onClick={()=>setMenu(false)} aria-label="关闭菜单"/>}<div className="app-body"><header className="mobile-header"><button className="icon-btn" onClick={()=>setMenu(true)} aria-label="打开菜单"><Menu size={22}/></button><a className="mobile-brand" href="/"><span className="brand-mark small">✚</span> 蓉渝康养行</a><Link className="avatar" to="/profile" aria-label="个人资料">{user?.name?.slice(0,1)||'会'}</Link></header><main className="app-main">{children}</main></div><Link className="sos-float" to="/sos" aria-label="紧急求助"><strong>SOS</strong><small>求助</small></Link><nav className="bottom-nav" aria-label="底部导航">{bottom.map(n=><Link to={n.to} key={n.to} className={loc.pathname===n.to?'active':''}><span><n.icon size={19}/></span>{n.label}</Link>)}</nav></div>
}
export function FormActions({onCancel,submitLabel='保存',busy=false}){return <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>取消</Button><Button type="submit" disabled={busy}>{busy?'提交中…':submitLabel}</Button></div>}
export function Filters({items,value,onChange}){return <div className="filters">{items.map(x=>{let v=typeof x==='string'?x:x.value,label=typeof x==='string'?x:x.label;return <button type="button" key={v} onClick={()=>onChange(v)} className={'filter '+(value===v?'selected':'')}>{label}</button>})}</div>}
export function ItemStatus({value}){return <Badge tone={{pending:'amber',confirmed:'green',completed:'blue',cancelled:'slate'}[value]||'slate'}>{statusLabels[value]||value||'待确认'}</Badge>}
export function Divider(){return <hr className="divider"/>}
