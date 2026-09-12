import {createGame,applyTransactions} from '../src/engine/RulesEngine.ts';
const state=applyTransactions(createGame(),[{id:'live-verification',payerId:'demo',medium:'balance',paymentDate:'Month 1 · Day 1',amount:500,description:'Shopping spree',category:'leisure',kind:'purchase'}]);
const started=Date.now();
const res=await fetch('http://localhost:3000/api/gemini/day',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,kind:'close'})});
const body=await res.json();
// Only print a sanitized integration result; never raw upstream errors, prompts, or credentials.
console.log(JSON.stringify({status:res.status,elapsedMs:Date.now()-started,ending:body.data?.analysis?.ending,source:body.data?.source,notice:body.data?.providerNotice,warning:body.data?.analysis?.isWarning,balance:state.metrics.cashBalance,assessedDay:body.data?.assessedDay}));
