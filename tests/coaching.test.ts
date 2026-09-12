import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyTransactions,advanceTurn} from '../src/engine/RulesEngine.ts';
import {localDailyReview,applyDailyReview} from '../src/engine/DailyReview.ts';
import {rewindRun} from '../src/engine/Recovery.ts';
import type {BankTransaction} from '../src/engine/Types.ts';

const buy=(id:string,amount:number,category:BankTransaction['category']='leisure'):BankTransaction=>({id,amount,category,kind:'purchase',payerId:'demo',paymentDate:'today',medium:'balance',description:'Purchase'});
const warn=()=>{const s=applyTransactions(createGame(),[buy('extras',160)]);return applyDailyReview(advanceTurn(s),localDailyReview(s,'close'));};

test('pausing extras after a warning produces motivation despite historical overspending',()=>{
 const s=warn(),review=localDailyReview(s,'close');
 assert.equal(review.analysis.feedback,'encouragement');
 assert.equal(review.analysis.isWarning,false);
 assert.match(review.analysis.commentary,/doing great/);
 assert.ok(review.forecast.riskReasons.length>0);
 const next=applyDailyReview(advanceTurn(s),review);
 assert.equal(next.command.severity,'info');
 assert.equal(next.player.state,'idle');
 assert.equal(next.isGameOver,false);
 assert.equal(next.progression.coins,s.progression.coins);
});

test('covering essential bills earns encouragement; repeating optional spending does not',()=>{
 const s=warn();
 const paid=applyTransactions(s,[buy('rent',1200,'housing')]);
 assert.match(localDailyReview(paid,'close').analysis.commentary,/covered essentials/);
 const repeated=applyTransactions(s,[buy('more-extras',200)]);
 assert.equal(localDailyReview(repeated,'close').analysis.isWarning,true);
 assert.equal(localDailyReview(repeated,'close').analysis.feedback,'standard');
});

test('an essential purchase that worsens the funding gap does not receive reassurance',()=>{
 const s=applyTransactions(warn(),[buy('excess-food',2500,'food')]);
 const review=localDailyReview(s,'close');
 assert.equal(review.analysis.feedback,'standard');
 assert.equal(review.analysis.isWarning,true);
});

test('rewind clears old feedback and evaluates changed actions while retaining advice',()=>{
 const spent=applyTransactions(createGame(),[buy('risky',2000)]);
 const ended=applyDailyReview(advanceTurn(spent),localDailyReview(spent,'close'));
 const replay=rewindRun(ended);
 assert.deepEqual(replay.reviews,[]);
 assert.equal(replay.command.severity,'info');
 const better=applyTransactions(replay,[buy('food',80,'food')]);
 const review=localDailyReview(better,'close');
 assert.equal(review.analysis.feedback,'encouragement');
 assert.deepEqual(review.transactionIds,['food']);
 assert.notEqual(review.analysis.commentary,ended.reviews[0].analysis.commentary);
 const next=applyDailyReview(advanceTurn(better),review);
 assert.equal(next.isGameOver,false);
 assert.equal(next.reviews.length,1);
 assert.deepEqual(applyDailyReview(next,review),next);
 const same=applyTransactions(replay,[buy('risky-again',2000)]);
 assert.equal(localDailyReview(same,'close').analysis.feedback,'standard');
});

test('previous-month advice does not grant permanent encouragement',()=>{
 const s=warn();s.metrics.turn=31;
 assert.equal(localDailyReview(s,'close').analysis.feedback,'standard');
});

test('existing saves can earn encouragement from their previous warning',()=>{
 const s=warn();delete s.coachingBaseline;
 assert.equal(localDailyReview(s,'close').analysis.feedback,'encouragement');
});
