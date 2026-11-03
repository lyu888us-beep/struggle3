'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const create=require('../蓉渝康养行_顾客端_Cloudflare部署包/backend/src/gmail-reset-mailer.cjs');
const config={clientId:'fictional-client',clientSecret:'fictional-secret',refreshToken:'fictional-refresh',customerOrigin:'https://example.test'};
test('sends a reset email using a mocked OAuth and Gmail API',async()=>{
 const requests=[];
 const send=create({...config,fetchFn:async (url,init)=>{requests.push({url,init});return {ok:true,json:async()=>({access_token:'fictional-access'})}}});
 await send({recipient:'customer@example.test',resetUrl:'https://example.test/reset?token=fictional-token'});
 assert.equal(requests.length,2);assert.equal(requests[1].init.headers.Authorization,'Bearer fictional-access');
 const mime=Buffer.from(JSON.parse(requests[1].init.body).raw,'base64url').toString();
 assert.match(mime,/To: customer@example\.test/);assert.match(mime,/Content-Transfer-Encoding: base64/);
 const body=Buffer.from(mime.split('\r\n\r\n')[1].replace(/\r\n/g,''),'base64').toString();
 assert.match(body,/https:\/\/example\.test\/reset\?token=fictional-token/);assert.doesNotMatch(mime,/fictional-secret|fictional-refresh/);
});
test('rejects header injection and external links before network calls',async()=>{
 let calls=0;const send=create({...config,fetchFn:async()=>{calls++;throw Error()}});
 await assert.rejects(send({recipient:'a@example.test\r\nBcc:other@example.test',resetUrl:'https://example.test/reset'}));
 await assert.rejects(send({recipient:'a@example.test',resetUrl:'https://evil.test/reset'}));assert.equal(calls,0);
});
test('does not expose provider response or credentials on failure',async()=>{
 const send=create({...config,fetchFn:async()=>({ok:false,json:async()=>({error:'fictional-secret'})})});
 await assert.rejects(send({recipient:'a@example.test',resetUrl:'https://example.test/reset'}),e=>e.message==='Gmail authorization unavailable');
});
test('requires https and configured credentials',()=>{
 assert.throws(()=>create({...config,customerOrigin:'http://example.test'}));
 assert.throws(()=>create({...config,refreshToken:''}));
});
