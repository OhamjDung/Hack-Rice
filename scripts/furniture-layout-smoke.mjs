import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('artifacts');await mkdir(output,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9224',`--user-data-dir=${path.resolve('.browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const pending=new Map();let seq=0;const errors=[];let intercept=()=>{};const reviewRequests=[];const auditRequests=[];let bankSyncs=0;let failReview=false;let severe=false;let severeKind='eviction';
try{
 let pages;for(let i=0;i<50;i++){try{pages=await fetch('http://127.0.0.1:9224/json').then(r=>r.json());if(pages.length)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!pages?.length)throw new Error('Chrome debugging endpoint unavailable');
 ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=({data})=>{const msg=JSON.parse(data);if(msg.method==='Fetch.requestPaused')void intercept(msg.params);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p?.reject(new Error(msg.error.message));else p?.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text+': '+msg.params.exceptionDetails.exception?.description);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'Evaluation failed');return r.result.value;};
 const wait=async(expression)=>{for(let i=0;i<240;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}console.log(await evaluate('({url:location.href,body:document.body.innerText.slice(0,3000)})'));console.log(errors);throw new Error(`Timed out: ${expression}`);};
 const click=async(text)=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Button missing: '+${JSON.stringify(text)});b.click()})()`);};

 const aria=async(label)=>evaluate(`document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}).click()`);
 const choose=async(label)=>{await wait('!![...document.querySelectorAll("dialog button")].find(b=>b.textContent.trim().startsWith('+JSON.stringify(label)+')&&!b.disabled)');await evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent.trim().startsWith('+JSON.stringify(label)+')).click()');};
 const state=()=>evaluate('JSON.parse(localStorage.getItem("room-economy-v1"))');
 const close=()=>evaluate(`document.querySelector('dialog button[aria-label="Close dialog"]').click()`);
 const ready=()=>wait('!!document.querySelector("canvas")&&!document.querySelector(".world-loading")');

 intercept=async({requestId,request})=>{
   try{
    let body,status=200;
    if(request.url.includes('/gemini/audit')){
     const input=JSON.parse(request.postData);auditRequests.push(input);const valid=input.jars.food>=240&&Object.values(input.jars).reduce((a,b)=>a+b,0)<=input.income;
     body={success:true,source:'gemini',data:{isValid:valid,riskRating:valid?'LOW':'HIGH',commentary:valid?'Your essentials fit this plan.':'Food is underfunded. Keep room for groceries.',recommendedAdjustments:{...input.jars,food:240}}};await new Promise(r=>setTimeout(r,250));
    }else if(request.url.includes('/gemini/day')){
     const input=JSON.parse(request.postData);reviewRequests.push(input);
     const g=input.state,day=(g.metrics.turn-1)%30+1,warning=g.jars.leisure.spentAmount>=150;
     if(failReview){status=503;body={success:false,error:'Test outage'};}
     else body={success:true,source:'gemini',data:{assessedDay:g.metrics.turn,kind:input.kind,source:'gemini',analysis:{isWarning:warning,ending:severe?severeKind:'none',failureConfidence:severe?1:0,riskRating:severe?'CRITICAL':warning?'HIGH':'LOW',commentary:warning?'OMG, yesterday I bought too much. Now rent wants a word.':'Your wallet made it through today without calling for backup.',reason:warning?'Spending pace threatens upcoming essential bills.':'Essentials remain covered.',recoverySteps:['Keep rent and food money reserved.'],behavior:warning?'worried':'calm'},forecast:{day,daysRemaining:30-day,todaySpent:g.transactions.filter(t=>t.gameDay===g.metrics.turn&&t.kind==='purchase').reduce((n,t)=>n+t.amount,0),variableSpent:g.jars.food.spentAmount+g.jars.leisure.spentAmount+g.jars.transit.spentAmount,essentialsRemaining:1320,projectedBalance:warning?-100:1000,safeDailySpend:35,riskReasons:warning?['Future bill risk']:[]},transactionIds:g.transactions.filter(t=>t.gameDay===g.metrics.turn).map(t=>t.id)}};
     await new Promise(r=>setTimeout(r,250));
    }else {
     bankSyncs++;const transactions=[...([{id:'bank-saving',amount:150,description:'Savings transfer',category:'savings',kind:'saving'},{id:'bank-gym',amount:25,description:'Gym membership',category:'leisure',kind:'purchase'},{id:'bank-health',amount:30,description:'Pharmacy',category:'leisure',kind:'purchase'}].map(t=>({...t,payerId:'bank',medium:'balance',paymentDate:'2026-09-11'}))),{id:'bank-food',payerId:'bank',medium:'balance',paymentDate:'2026-09-11',amount:42.5,description:'Grocery market',category:'food',kind:'purchase'}];
     if(bankSyncs>1)transactions.push({id:'bank-shop',payerId:'bank',medium:'balance',paymentDate:'2026-09-11',amount:160,description:'Shopping',category:'leisure',kind:'purchase'});
     body={success:true,source:'nessie',data:{balance:bankSyncs>1?2940:3100,transactions,accountName:'Test checking'}};
    }
    await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
   }catch(e){errors.push(String(e));}
 };

 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://localhost:3000'});await ready();
 await evaluate(`document.querySelector('button[aria-label="Reset room view"]').click()`);
 await click('Arrange furniture');
 await wait('!!document.querySelector(".furniture-controls")');
 await click('Reset layout');await click('Move back');
 await wait('JSON.parse(localStorage.getItem("room-economy-v1"))?.roomLayout?.leisure?.y===5');
 const saved=await state();assert.equal(saved.roomLayout.leisure.x,6.5);
 await click('Done');await send('Page.reload');await ready();
 assert.equal((await state()).roomLayout.leisure.y,5);
 await click('Arrange furniture');
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'furniture-layout-desktop.png'),Buffer.from(shot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await new Promise(r=>setTimeout(r,300));
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 await click('Move forward');
 await wait('JSON.parse(localStorage.getItem("room-economy-v1"))?.roomLayout?.leisure?.y===6');
 const mobile=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'furniture-layout-mobile.png'),Buffer.from(mobile.data,'base64'));
 await click('Reset layout');await click('Done');
 assert.deepEqual(errors,[]);console.log('PASS: arrange controls, movement, persisted reload, reset, mobile width, runtime errors');
} finally {ws?.close();chrome.kill();}
