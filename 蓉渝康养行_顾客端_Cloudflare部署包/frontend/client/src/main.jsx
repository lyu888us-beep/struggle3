import React,{useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate,useLocation,Link} from 'react-router-dom';
import {AuthContext,ToastProvider,api,AppShell,Loading,Empty} from './shared';
import {AuthPage,Dashboard,Bookings,Records,Journal,Subscriptions,Health,SOS,Profile} from './customer-core';
import {Hospitals,Therapies,Recipes,Knowledge,Article,Trips,Download} from './customer-content';
import {Admin} from './admin';
import {OfflineArchive} from './archive';
import {CustomerMessages} from './messages';
import {PublicTcm} from './public-tcm';
import './styles.css';

function AuthProvider({children}){
 const [user,setUser]=useState(null),[meta,setMeta]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{const data=await api('/api/me');setUser(data.user);return data.user},[]);
 const logout=useCallback(async()=>{await api('/api/logout',{method:'POST'});setUser(null)},[]);
 useEffect(()=>{let active=true;Promise.all([api('/api/me'),api('/api/meta')]).then(([m,d])=>{if(active){setUser(m.user);setMeta(d)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <AuthContext.Provider value={{user,setUser,refresh,logout,meta,loading,error}}>{children}</AuthContext.Provider>
}
function Protected({children}){
 const {user,loading,error}=React.useContext(AuthContext),loc=useLocation();
 if(loading)return <div className="center-screen"><Loading/></div>;
 if(error)return <div className="center-screen"><Loading error={error}/><Link to="/offline-vault" className="text-link">打开本机离线档案</Link><a href="/">返回首页</a></div>;
 if(!user)return <Navigate to={'/login?next='+encodeURIComponent(loc.pathname+loc.search)} replace/>;
 return <AppShell>{children}</AppShell>;
}
function AdminRoute(){const {loading,error}=React.useContext(AuthContext);if(loading)return <div className="center-screen"><Loading/></div>;if(error)return <div className="center-screen"><Loading error={error}/><Link to="/admin/offline-vault" className="text-link">打开本机离线档案</Link></div>;return <Admin/>}
function App(){
 useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{})},[]);
 return <Routes><Route path="/tcm" element={<PublicTcm/>}/><Route path="/login" element={<AuthPage/>}/><Route path="/register" element={<AuthPage register/>}/><Route path="/download" element={<Download/>}/><Route path="/offline-vault" element={<OfflineArchive/>}/><Route path="/admin/offline-vault" element={<OfflineArchive mode="admin"/>}/><Route path="/admin" element={<AdminRoute/>}/>
 <Route path="/messages" element={<Protected><CustomerMessages/></Protected>}/><Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/><Route path="/bookings" element={<Protected><Bookings/></Protected>}/><Route path="/records" element={<Protected><Records/></Protected>}/><Route path="/journal" element={<Protected><Journal/></Protected>}/><Route path="/subscriptions" element={<Protected><Subscriptions/></Protected>}/><Route path="/health" element={<Protected><Health/></Protected>}/><Route path="/sos" element={<Protected><SOS/></Protected>}/><Route path="/profile" element={<Protected><Profile/></Protected>}/><Route path="/hospitals" element={<Protected><Hospitals/></Protected>}/><Route path="/therapies" element={<Protected><Therapies/></Protected>}/><Route path="/recipes" element={<Protected><Recipes/></Protected>}/><Route path="/knowledge" element={<Protected><Knowledge/></Protected>}/><Route path="/knowledge/:id" element={<Protected><Article/></Protected>}/><Route path="/trips" element={<Protected><Trips/></Protected>}/>
 <Route path="*" element={<div className="center-screen"><Empty title="页面不存在" action={<a href="/" className="text-link">返回首页</a>}/></div>}/></Routes>
}
createRoot(document.getElementById('root')).render(<BrowserRouter><ToastProvider><AuthProvider><App/></AuthProvider></ToastProvider></BrowserRouter>);
