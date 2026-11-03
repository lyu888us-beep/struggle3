import React,{useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {api,Button,Field,useAuth} from './shared';

export function EmailVerification(){
 const {meta}=useAuth(),[state,setState]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(meta?.emailRecoveryEnabled)api('/api/email-recovery/status').then(setState).catch(()=>setError('无法读取邮箱验证状态，请稍后重试。'))},[meta]);
 if(!meta?.emailRecoveryEnabled)return null;
 async function request(){setBusy(true);setError('');try{await api('/api/email-recovery/verify-request',{method:'POST'});setMessage('验证邮件已请求，请检查邮箱。')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="card form-card"><h2>邮箱验证</h2>{state?.eligible?<><p>{state.verified?'邮箱已验证，可用于重置密码。':'请验证注册邮箱，才能通过邮箱重置密码。'}</p>{!state.verified&&<Button type="button" disabled={busy} onClick={request}>发送验证邮件</Button>}</>:<p>当前账号不是可验证的邮箱。</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</section>;
}
export function EmailRecoveryRequest(){
 const [account,setAccount]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const {meta}=useAuth();
 async function submit(e){e.preventDefault();setBusy(true);setError('');try{await api('/api/email-recovery/reset-request',{method:'POST',body:{account}});setMessage('如果该邮箱已验证，重置邮件将发送，请检查收件箱。')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <main className="auth-form-wrap"><h1>忘记密码</h1>{meta?.emailRecoveryEnabled?<><p>请输入已验证的注册邮箱。</p><form className="stack-form" onSubmit={submit}><Field label="注册邮箱"><input type="email" autoComplete="email" value={account} onChange={e=>setAccount(e.target.value)} required/></Field><Button type="submit" disabled={busy}>发送重置邮件</Button></form>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</>:<p>邮箱重置功能尚未开通。</p>}<p><Link to="/login">返回登录</Link></p></main>;
}
export function EmailAction(){
 const [values]=useState(()=>{const h=new URLSearchParams(window.location.hash.slice(1));return {kind:h.get('kind'),token:h.get('token')}}),[password,setPassword]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const cleaned=useRef(false);const {meta}=useAuth();
 useEffect(()=>{if(!cleaned.current){history.replaceState(history.state,'',location.pathname);cleaned.current=true}},[]);
 const valid=values.kind==='verify-email'||values.kind==='reset-password';
 async function submit(e){e.preventDefault();setError('');if(values.kind==='reset-password'&&password!==again){setError('两次输入的新密码不一致');return}setBusy(true);try{await api(values.kind==='verify-email'?'/api/email-recovery/verify':'/api/email-recovery/reset',{method:'POST',body:{token:values.token,...(values.kind==='reset-password'?{password}:{})}});setMessage(values.kind==='verify-email'?'邮箱验证成功。':'密码已重置，请使用新密码登录。');setPassword('');setAgain('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <main className="auth-form-wrap"><h1>{values.kind==='verify-email'?'验证邮箱':'重置密码'}</h1>{!meta?.emailRecoveryEnabled?<p>邮箱重置功能尚未开通。</p>:!valid||!values.token?<p>链接无效，请重新申请。</p>:message?<p role="status">{message}</p>:<form className="stack-form" onSubmit={submit}>{values.kind==='reset-password'&&<><Field label="新密码"><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required/></Field><Field label="确认新密码"><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={again} onChange={e=>setAgain(e.target.value)} required/></Field></>}<Button type="submit" disabled={busy}>{values.kind==='verify-email'?'确认验证邮箱':'设置新密码'}</Button></form>}{error&&<p role="alert">{error}</p>}<p><Link to="/login">返回登录</Link></p></main>;
}
