'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createImageTools } = require('../server/image-tools');
test('image editing authenticates, rejects cross-site writes and saves a separate copy', async () => {
 const calls=[]; const app=express();
 app.use(createImageTools({config:{baseUrl:'https://openvibe.studio',imageWorkerUrl:'http://worker.test'},sso:{extractToken:r=>r.get('authorization') ? 'person' : r.get('cookie') ? 'session' : null},pics:{bytes:async(s,t)=>{calls.push([s,t]);return {bytes:Buffer.from([1]),contentType:'image/png',name:'Forest'};},save:async(t,b,m)=>({slug:'Abcdef23',listed:false})},fetchImpl:async(url,o)=>{assert.equal(o.headers.authorization,undefined); assert.equal(JSON.parse(o.body).operation,'restyle');return new Response(Buffer.from([1,2]),{headers:{'content-type':'image/png'}});}}));
 app.use((e,_q,r,_n)=>r.status(e.status||500).json({code:e.code}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r)); const url=`http://127.0.0.1:${server.address().port}/images/edit`;
 const body=JSON.stringify({picture:'Abcdef23',operation:'restyle',prompt:'Watercolour'});
 try {
 assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body})).status,401);
 assert.equal((await fetch(url,{method:'POST',headers:{'content-type':'application/json',cookie:'signed-in',origin:'https://evil.test'},body})).status,403);
 const result=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer person'},body});assert.equal(result.status,201);assert.equal((await result.json()).listed,false);assert.deepEqual(calls,[['Abcdef23','person']]);
 }finally{await new Promise(r=>server.close(r));}
});
