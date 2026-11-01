import React,{useState} from 'react';
import {api,Button,Field} from './shared';

// Deliberately isolated test flow: no message is sent and no real account is verified.
export function TestCodeAuth({channel,enabled,onSuccess}){
 const [identifier,setIdentifier]=useState(channel==='phone'?'00012345678':'test@example.invalid');
 const [challenge,setChallenge]=useState(null),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function start(){
  setBusy(true);setError('');setCode('');setChallenge(null);
  try{setChallenge(await api('/api/test-code/start',{method:'POST',body:{channel,identifier}}))}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function verify(e){
  e.preventDefault();if(!challenge)return;setBusy(true);setError('');
  try{let result=await api('/api/test-code/verify',{method:'POST',body:{challenge:challenge.challenge,code}});await onSuccess(result)}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <form className="stack-form" onSubmit={verify}>
  <div className="warning-box"><strong>仅供演示，不是真实验证。</strong><br/>测试码会直接显示在页面，不会发送短信或邮件。请勿填写真实手机号、邮箱或病历。</div>
  {!enabled&&<div className="error-box">测试验证码当前未启用；真实验证码服务尚未开通。</div>}
  <Field label={channel==='phone'?'虚构测试手机号':'虚构测试邮箱'} hint={channel==='phone'?'仅接受 000 开头的 11 位测试号码':'仅接受以 @example.invalid 结尾的测试邮箱'}>
   <input type="text" inputMode={channel==='phone'?'numeric':'email'} autoComplete="off" value={identifier} onChange={e=>{setIdentifier(e.target.value);setChallenge(null)}} required/>
  </Field>
  <Button type="button" variant="secondary" disabled={busy||!enabled} onClick={start}>获取测试码</Button>
  {challenge&&<div className="demo-code" role="status">本次测试码：<strong data-testid="demo-code">{challenge.demoCode}</strong><small>仅在本页面显示，5 分钟内有效。</small></div>}
  <Field label="输入测试码"><input value={code} onChange={e=>setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="输入页面显示的 6 位测试码" required/></Field>
  {error&&<div className="error-box" role="alert">{error}</div>}
  <Button type="submit" className="full" disabled={busy||!enabled||!challenge}>{busy?'请稍候…':'使用测试码登录 / 注册'}</Button>
 </form>
}
