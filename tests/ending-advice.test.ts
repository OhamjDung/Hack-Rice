import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyTransactions} from '../src/engine/RulesEngine.ts';
import {beginEnding} from '../src/engine/Progression.ts';
import {endingAdvice} from '../src/engine/EndingAdvice.ts';

test('ending advice targets the undone purchase and the rewind balance',()=>{
 const original=createGame();
 const spent=applyTransactions(original,[{id:'shopping',amount:2000,category:'leisure',kind:'purchase',description:'Shopping',paymentDate:'today',payerId:'demo',medium:'balance'}]);
 const ended=beginEnding(spent,'food_shortage','Food money ran out.');
 const advice=endingAdvice(ended);
 assert.match(advice.heading,/rewind/);
 assert.match(advice.steps[0],/Skip or reduce the \$2,000.00/);
 assert.match(advice.steps[1],/groceries before treats/);
 assert.match(advice.steps[2],/\$3,000.00/);
 assert.doesNotMatch(advice.steps.join(' '),/days left|survive|\/day/);
});

test('rent advice protects the essential payment rather than telling the player to skip it',()=>{
 const spent=applyTransactions(createGame(),[{id:'rent',amount:1200,category:'housing',kind:'purchase',description:'Rent',paymentDate:'today',payerId:'demo',medium:'balance'}]);
 const advice=endingAdvice(beginEnding(spent,'eviction','Rent was underfunded.'));
 assert.match(advice.steps[0],/housing payment a priority/);
 assert.match(advice.steps[1],/Pay rent first/);
});

test('saves without a rewind point offer next-run advice without inventing a purchase',()=>{
 const advice=endingAdvice(beginEnding(createGame(),'exhaustion','Too much strain.'));
 assert.match(advice.heading,/next run/);
 assert.match(advice.steps[1],/food and rest/);
 assert.doesNotMatch(advice.steps.join(' '),/\$|rewind point/);
});
