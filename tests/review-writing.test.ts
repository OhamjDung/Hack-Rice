import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTurn,applyTransactions} from '../src/engine/RulesEngine.ts';
import {localDailyReview,applyDailyReview} from '../src/engine/DailyReview.ts';
import {mergeReviewProse} from '../src/engine/ReviewWriting.ts';
import {monthlySummary} from '../src/engine/MonthlySummary.ts';

test('twenty quiet days each have their own stored review and relevant commentary',()=>{
 let state=createGame();
 for(let day=1;day<=20;day++){
  const review=localDailyReview(state,'close');
  assert.equal(review.assessedDay,day);
  assert.ok(review.analysis.commentary.length<=160);
  state=applyDailyReview(advanceTurn(state),review);
 }
 assert.equal(state.reviews.length,20);
 assert.equal(new Set(state.reviews.map(r=>r.analysis.commentary)).size,20);
});

test('repeated Gemini commentary is replaced with current-day feedback without another request',()=>{
 const initial=createGame(),first=localDailyReview(initial,'close');
 const state=applyDailyReview(advanceTurn(initial),first),local=localDailyReview(state,'close');
 const merged=mergeReviewProse(state,local,{commentary:first.analysis.commentary,reason:'Updated reasoning.',recoverySteps:['Keep essentials reserved.']});
 assert.equal(merged.analysis.commentary,local.analysis.commentary);
 assert.notEqual(merged.analysis.commentary,first.analysis.commentary);
 assert.equal(merged.analysis.reason,'Updated reasoning.');
});

test('month summary preserves closing balances and excludes savings from purchases',()=>{
 let state=createGame();state.metrics.turn=30;
 state=applyTransactions(state,[{id:'rent',amount:1200,kind:'purchase',category:'housing',payerId:'demo',medium:'balance',paymentDate:'today',description:'Rent'},{id:'save',amount:200,kind:'saving',category:'savings',payerId:'demo',medium:'balance',paymentDate:'today',description:'Saving'}]);
 const original=structuredClone(state),summary=monthlySummary(state);
 assert.equal(summary.month,1);assert.equal(summary.spent,1200);assert.equal(summary.saved,200);assert.equal(summary.cash,1600);
 assert.deepEqual(state,original);
 const next=advanceTurn(state);
 assert.equal(next.metrics.turn,31);assert.equal(next.metrics.cashBalance,4600);
 assert.equal(monthlySummary(next).saved,0);assert.equal(monthlySummary(next).spent,0);
 assert.equal(summary.spent,1200);
});

test('reviews evaluate responsible spending, balanced treats, and overspending',()=>{
 const purchase=(category:'housing'|'leisure',amount:number)=>applyTransactions(createGame(),[{id:'choice',category,amount,kind:'purchase',payerId:'demo',medium:'balance',paymentDate:'today',description:'Purchase'}]);
 const rent=localDailyReview(purchase('housing',1200),'close');
 assert.match(rent.analysis.commentary,/responsible/);
 const treat=localDailyReview(purchase('leisure',12),'close');
 assert.match(treat.analysis.commentary,/reasonable/);
 const excess=localDailyReview(purchase('leisure',500),'close');
 assert.match(excess.analysis.commentary,/risky/);
 for(const review of [rent,treat,excess])assert.ok(review.analysis.commentary.length<=160);
});

test('numeric recaps and technical commentary fall back to a spending assessment',()=>{
 const state=createGame(),local=localDailyReview(state,'close');
 for(const commentary of ['You spent $20 today and have $2,980 left.','Gemini says your spending is good.']){
  const review=mergeReviewProse(state,local,{commentary,reason:'A quiet day.',recoverySteps:['Protect essentials.']});
  assert.equal(review.analysis.commentary,local.analysis.commentary);
 }
});
