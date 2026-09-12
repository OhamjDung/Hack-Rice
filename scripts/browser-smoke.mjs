import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve('artifacts');await mkdir(output,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9224',`--user-data-dir=${path.resolve('.browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const pending=new Map();let seq=0;const errors=[];let intercept=()=>{};const reviewRequests=[];let bankSyncs=0;let failReview=false;let severe=false;let severeKind='eviction';
try{
 let pages;for(let i=0;i<50;i++){try{pages=await fetch('http://127.0.0.1:9224/json').then(r=>r.json());if(pages.length)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!pages?.length)throw new Error('Chrome debugging endpoint unavailable');
 ws=new WebSocket(pages[0].webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=({data})=>{const msg=JSON.parse(data);if(msg.method==='Fetch.requestPaused')void intercept(msg.params);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p?.reject(new Error(msg.error.message));else p?.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text+': '+msg.params.exceptionDetails.exception?.description);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'Evaluation failed');return r.result.value;};
 const wait=async(expression)=>{for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,150));}console.log(await evaluate('({url:location.href,body:document.body.innerText.slice(0,3000)})'));console.log(errors);throw new Error(`Timed out: ${expression}`);};
 const click=async(text)=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Button missing: '+${JSON.stringify(text)});b.click()})()`);};

 const aria=async(label)=>evaluate(`document.querySelector(${JSON.stringify(`button[aria-label="${label}"]`)}).click()`);
 const choose=async(label)=>{await wait('!![...document.querySelectorAll("dialog button")].find(b=>b.textContent.trim().startsWith('+JSON.stringify(label)+')&&!b.disabled)');await evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent.trim().startsWith('+JSON.stringify(label)+')).click()');};
 const state=()=>evaluate('JSON.parse(localStorage.getItem("room-economy-v1"))');
 const close=()=>evaluate(`document.querySelector('dialog button[aria-label="Close dialog"]').click()`);
 const ready=()=>wait('!!document.querySelector("canvas")&&!document.querySelector(".world-loading")');

 intercept=async({requestId,request})=>{
   try{
    let body,status=200;
    if(request.url.includes('/gemini/day')){
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
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await send('Fetch.enable',{patterns:[{urlPattern:'*/api/gemini/day',requestStage:'Request'},{urlPattern:'*/api/nessie/sync',requestStage:'Request'}]});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://localhost:3000'});await ready();await send('Page.navigate',{url:'about:blank'});await wait('location.href==="about:blank"');await send('Storage.clearDataForOrigin',{origin:'http://localhost:3000',storageTypes:'local_storage'});await send('Page.navigate',{url:'http://localhost:3000'});await ready();await new Promise(r=>setTimeout(r,500));
 assert.equal(await evaluate('document.querySelector(".visible-balance").textContent'),'$3,000.00');
 assert.equal(await evaluate('document.querySelectorAll(".balance-actions button").length'),5);
 assert.equal(await evaluate('document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth'),true);
 await aria('Rotate room right');await new Promise(r=>setTimeout(r,600));
 let rotated=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'rotated.png'),Buffer.from(rotated.data,'base64'));
 for(let i=0;i<7;i++)await aria('Rotate room right');assert.ok(await evaluate('document.querySelector(".scene-controls").textContent.includes("0°")'));await aria('Reset room view');await new Promise(r=>setTimeout(r,500));
 assert.ok(await evaluate('document.querySelector(".scene-controls").getBoundingClientRect().bottom<document.querySelector(".character-thought").getBoundingClientRect().top'),'Camera controls clear dialogue');
 let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'desktop.png'),Buffer.from(shot.data,'base64'));
 const action=async(label,amount,submit)=>{
  await wait('![...document.querySelectorAll(".balance-actions button")].find(b=>b.textContent.includes('+JSON.stringify(label)+')).disabled');
  await evaluate('[...document.querySelectorAll(".balance-actions button")].find(b=>b.textContent.includes('+JSON.stringify(label)+')).click()');
  await wait('!!document.querySelector("dialog input[type=number]")');assert.equal(await evaluate('document.querySelector("dialog input[type=number]").value'),'','Amount must start blank');
  await evaluate('(()=>{const input=document.querySelector("dialog input[type=number]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,'+JSON.stringify(String(amount))+');input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await choose(submit);await wait('!document.querySelector("dialog[open]")');
 };
 await action('Groceries',83.75,'Bring home groceries');assert.equal((await state()).metrics.cashBalance,2916.25);assert.equal((await state()).transactions[0].gameDay,1);
 await action('Shopping & fun',160,'Treat myself');assert.equal((await state()).metrics.cashBalance,2756.25);
 await new Promise(r=>setTimeout(r,1500));assert.equal(reviewRequests.length,0,'Spending must not request analysis');
 await wait('!document.querySelector(".end-week").disabled');await evaluate('(()=>{const b=document.querySelector(".end-week");b.click();b.click();})()');
 await wait('document.querySelector(".balance-calendar").textContent.includes("Day 2 / 30")');
 await wait('JSON.parse(localStorage.getItem("room-economy-v1")).reviews.some(r=>r.kind==="close"&&r.assessedDay===1)');
 assert.equal((await state()).metrics.turn,2);assert.ok((await state()).progression.coins<0);assert.ok((await state()).dialogue.some(d=>d.kind==='warning'));assert.equal((await state()).command.behavior,'worried');const closing=reviewRequests.find(r=>r.kind==='close');assert.equal(closing.state.metrics.turn,1);assert.equal(closing.state.transactions.filter(t=>t.gameDay===1).length,2);
 const currentBalance=(await state()).metrics.cashBalance;await action('Transport',12.5,'Head out');assert.equal((await state()).metrics.cashBalance,currentBalance-12.5);
 await wait('!document.querySelector(".end-week").disabled');await evaluate('document.querySelector(".end-week").click()');await wait('JSON.parse(localStorage.getItem("room-economy-v1")).reviews.some(r=>r.kind==="close"&&r.assessedDay===2)');
 const dayTwo=(await state()).reviews.find(r=>r.kind==='close'&&r.assessedDay===2);assert.equal(dayTwo.transactionIds.length,1);assert.equal(dayTwo.forecast.todaySpent,12.5);
 failReview=true;await wait('!document.querySelector(".end-week").disabled');await evaluate('document.querySelector(".end-week").click()');await wait('JSON.parse(localStorage.getItem("room-economy-v1")).reviews.some(r=>r.kind==="close"&&r.assessedDay===3)');assert.equal((await state()).reviews[0].source,'fallback');assert.equal((await state()).metrics.turn,4);failReview=false;
 await send('Page.reload');await ready();assert.equal((await state()).metrics.turn,4);assert.ok((await state()).reviews.some(r=>r.assessedDay===1&&r.kind==='close'));
 await wait('!document.querySelector(".sync-life").disabled');await evaluate('document.querySelector(".sync-life").click()');await choose('Connect Nessie account');await wait('!document.querySelector("dialog[open]")');assert.equal((await state()).mode,'nessie');assert.equal((await state()).metrics.cashBalance,3100);assert.equal((await state()).transactions.length,4);assert.equal((await state()).progression.coins,140);
 await wait('!document.querySelector(".sync-life").disabled');await evaluate('document.querySelector(".sync-life").click()');await wait('JSON.parse(localStorage.getItem("room-economy-v1")).transactions.length===5');assert.equal((await state()).metrics.cashBalance,2940);assert.equal((await state()).jars.food.spentAmount,42.5);

 const reviewCount=reviewRequests.length;await new Promise(r=>setTimeout(r,1200));assert.equal(reviewRequests.length,reviewCount);assert.equal((await state()).progression.coins,140);
 await evaluate('document.querySelector(".shop-toggle").click()');await choose('120 coins');await wait('JSON.parse(localStorage.getItem("room-economy-v1")).progression.owned.includes("house")');assert.equal((await state()).progression.coins,20);await close();
 await send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,300));assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No mobile horizontal overflow');assert.ok(await evaluate('!!document.querySelector(".balance-panel .sync-life")'));assert.ok(await evaluate('document.querySelector(".scene-controls").getBoundingClientRect().bottom<document.querySelector(".character-thought").getBoundingClientRect().top'),'Mobile camera controls clear dialogue');shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(output,'mobile.png'),Buffer.from(shot.data,'base64'));
 const endingBase=await state();severe=true;await evaluate('(()=>{const s=JSON.parse(localStorage.getItem("room-economy-v1"));s.metrics.cashBalance=100;localStorage.setItem("room-economy-v1",JSON.stringify(s));})()');await send('Page.reload');await ready();await wait('!document.querySelector(".end-week").disabled');await evaluate('document.querySelector(".end-week").click()');await wait('JSON.parse(localStorage.getItem("room-economy-v1")).ending.phase==="playing"');assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),false);await wait('JSON.parse(localStorage.getItem("room-economy-v1")).ending.phase==="complete"');await wait('!!document.querySelector("dialog[open]")');assert.ok(await evaluate('document.querySelector("dialog").textContent.includes("essential")'));
 for(const kind of ['food_shortage','power_cut','exhaustion']){
 severeKind=kind;const fixture=structuredClone(endingBase);fixture.metrics.cashBalance=100;
 await evaluate('localStorage.setItem("room-economy-v1",'+JSON.stringify(JSON.stringify(fixture))+')');await send('Page.reload');await ready();await wait('!document.querySelector(".end-week").disabled');await evaluate('document.querySelector(".end-week").click()');await wait('JSON.parse(localStorage.getItem("room-economy-v1")).ending.phase==="playing"');await new Promise(r=>setTimeout(r,3900));assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),false,kind+' must animate before dialog');
 const frame=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'ending-'+kind+'.png'),Buffer.from(frame.data,'base64'));await wait('JSON.parse(localStorage.getItem("room-economy-v1")).ending.phase==="complete"');await wait('!!document.querySelector("dialog[open]")');
 }
 assert.deepEqual(errors,[],'No browser runtime errors');
 const report={passed:true,providerMode:'Mocked provider responses for reproducibility; live Gemini verified separately.',checks:['Balance visible on right with five action buttons and bank-only missions','Amount inputs blank and arbitrary cents accepted','Positive-balance warning is highlighted','No analysis until End day','Bank missions reward once','Coins buy house upgrades','Ending animation precedes recovery dialog','Gemini warning changes character command','End day advances once and reviews the old day','Second day review excludes previous-day transactions','Review outage uses labeled fallback without double progression','Days and reviews survive reload','Update button connects and deduplicates bank transactions','Mobile controls remain accessible','Full camera rotation','Camera controls clear dialogue on desktop and mobile','No browser runtime errors'],screenshots:['desktop.png','mobile.png']};await writeFile(path.join(output,'browser-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

}finally{ws?.close();chrome.kill();}

