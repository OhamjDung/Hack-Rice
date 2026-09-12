import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyTransactions,advanceTurn} from '../src/engine/RulesEngine.ts';
import {buyFurniture,finishEnding} from '../src/engine/Progression.ts';
import {localDailyReview,applyDailyReview,remainderPlan} from '../src/engine/DailyReview.ts';
import type {BankTransaction} from '../src/engine/Types.ts';
const transactions:BankTransaction[]=[
 {id:'saving',amount:150,kind:'saving',category:'savings',description:'Savings transfer'},
 {id:'gym',amount:25,kind:'purchase',category:'leisure',description:'Gym membership'},
 {id:'health',amount:30,kind:'purchase',category:'leisure',description:'Pharmacy'}
].map(t=>({...t,payerId:'bank',medium:'balance',paymentDate:'2026-09-11'})) as BankTransaction[];
test('only bank updates reward missions, and duplicate updates never reward twice',()=>{
 const manual=applyTransactions(createGame(),transactions.map(t=>({...t,origin:'nessie',purpose:'saving'})));
 assert.equal(manual.progression.coins,0);
 const bank=applyTransactions(createGame(),transactions,2795,'nessie');
 assert.equal(bank.progression.coins,140);assert.equal(bank.progression.claimed.length,3);
 assert.equal(applyTransactions(bank,transactions,2795,'nessie').progression.coins,140);
 const nextMonth=structuredClone(bank);nextMonth.metrics.turn=31;
 assert.equal(applyTransactions(nextMonth,transactions,2795,'nessie').progression.coins,140);
});
test('furniture debits coins alone, with ownership and affordability enforced',()=>{
 const bank=applyTransactions(createGame(),transactions,2795,'nessie');
 const upgraded=buyFurniture(bank,'house');assert.equal(upgraded.progression.coins,20);
 assert.equal(upgraded.metrics.cashBalance,2795);assert.equal(upgraded.metrics.roomLevel,2);
 assert.deepEqual(buyFurniture(upgraded,'house'),upgraded);assert.deepEqual(buyFurniture(upgraded,'plant'),upgraded);
});
test('spending has no review until day close; risky spending is fined once',()=>{
 const spent=applyTransactions(createGame(),[{...transactions[1],id:'shopping',description:'Shopping',amount:500}]);
 assert.equal(spent.reviews.length,0);assert.equal(spent.progression.coins,0);
 const review=localDailyReview(spent,'close');const next=applyDailyReview(advanceTurn(spent),review);
 assert.ok(next.progression.coins<0);assert.deepEqual(applyDailyReview(next,review),next);
 assert.ok(next.dialogue.some(d=>d.kind==='warning'));assert.ok(next.command.message.length<=160);
 assert.deepEqual(applyDailyReview(spent,localDailyReview(spent,'preview')),spent);
});
test('forecast endings survive provider outages and complete separately',()=>{
 const s=createGame();s.metrics.cashBalance=100;
 const review=localDailyReview(s,'close');review.source='gemini';review.analysis.riskRating='CRITICAL';review.analysis.ending='eviction';review.analysis.failureConfidence=1;
 const next=applyDailyReview(advanceTurn(s),review);assert.equal(next.ending.phase,'playing');
 assert.equal(finishEnding(next).ending.phase,'complete');assert.ok(remainderPlan(next).shortfall>0);
 review.source='fallback';assert.equal(applyDailyReview(advanceTurn(s),review).isGameOver,true);
 review.source='gemini';review.analysis.failureConfidence=.5;assert.equal(applyDailyReview(advanceTurn(s),review).isGameOver,false);
});
