'use strict';
// Gmail API sender for customer email verification and password reset.
// The routes using it are disabled unless explicitly configured and enabled.
// Credentials must come from server-side secrets, never from a browser.
const OAUTH_URL='https://oauth2.googleapis.com/token';
const GMAIL_URL='https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

module.exports=function createGmailResetMailer({clientId,clientSecret,refreshToken,customerOrigin,fetchFn=fetch}){
 if(!clientId||!clientSecret||!refreshToken)throw new Error('Gmail authorization is not configured');
 const base=new URL(customerOrigin);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('Invalid customer origin');
 return async function sendResetEmail({recipient,resetUrl,purpose='reset-password'}){
  // Keep mail headers single-line; deliberately use a conservative address format.
  if(typeof recipient!=='string'||recipient.length>254||/[\r\n]/.test(recipient)||!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(recipient))throw new Error('Invalid recipient');
  const link=new URL(resetUrl);
  if(link.origin!==base.origin||link.username||link.password||link.protocol!=='https:'||/[\r\n]/.test(resetUrl))throw new Error('Invalid reset link');
  let tokenResponse;
  try{tokenResponse=await fetchFn(OAUTH_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'}).toString()})}catch{throw new Error('Gmail authorization unavailable')}
  if(!tokenResponse.ok)throw new Error('Gmail authorization unavailable');
  let token;try{token=(await tokenResponse.json()).access_token}catch{throw new Error('Gmail authorization unavailable')}
  if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw new Error('Gmail authorization unavailable');
  if(!['reset-password','verify-email'].includes(purpose))throw new Error('Invalid email purpose');
  const subject=Buffer.from(purpose==='verify-email'?'蓉渝康养行 | Verify your email':'蓉渝康养行 | Reset your password','utf8').toString('base64');
  const body=['您好，','',purpose==='verify-email'?'请打开以下链接验证您的邮箱：':'我们收到了重置密码的请求。请打开以下链接设置新密码：',link.href,'','链接有效期为 15 分钟，使用一次后失效。如果这不是您的操作，请忽略此邮件。请勿将链接转发给他人。','','Hello,','',purpose==='verify-email'?'Please open the link above to verify your email address.':'We received a password reset request. Open the link above to set a new password.','The link expires in 15 minutes and can be used once. If you did not make this request, ignore this email. Do not share the link.'].join('\r\n');
  const encodedBody=Buffer.from(body,'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
  const raw=Buffer.from(['To: '+recipient,'Subject: =?UTF-8?B?'+subject+'?=','MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encodedBody].join('\r\n'),'utf8').toString('base64url');
  let result;try{result=await fetchFn(GMAIL_URL,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw})})}catch{throw new Error('Gmail delivery request failed')}
  if(!result.ok)throw new Error('Gmail delivery request failed');
 };
};
