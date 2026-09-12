import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mockFeedSchema,importMockDay} from '../src/engine/MockFeed.ts';
import {createGame} from '../src/engine/RulesEngine.ts';
import {stateSchema} from '../src/engine/Types.ts';
import {rewindRun} from '../src/engine/Recovery.ts';

const feed=mockFeedSchema.parse(JSON.parse(readFileSync(new URL('../public/mock-transactions-30-days.json',import.meta.url),'utf8')));
test('all 30 file days import in order, once, without advancing game time',()=>{
 let state=createGame();
 for(let day=1;day<=30;day++){
  state.metrics.turn=day;
  state=importMockDay(state,feed,day);
  assert.ok(state.transactionUpdateTurns?.includes(day));
  assert.equal(state.metrics.turn,day);
  assert.equal(state.isGameOver,false);
  assert.equal(importMockDay(state,feed,day),state);
 }
 assert.equal(state.transactions.length,feed.days.flatMap(d=>d.transactions).length);
 assert.ok(state.transactions.every(t=>t.origin==='mock'&&t.gameDay!>=1&&t.gameDay!<=30));
 const total=feed.days.flatMap(d=>d.transactions).reduce((sum,t)=>sum+t.amount,0);
 assert.equal(state.metrics.cashBalance,3000-total);
 assert.equal(state.savedTotal,500);
 assert.equal(importMockDay(state,feed),state);
});
test('save reload keeps today updated and preserves existing progress',()=>{
 const state=createGame();state.metrics.turn=10;state.progression.coins=7;
 const first=importMockDay(state,feed);
 const restored=stateSchema.parse(JSON.parse(JSON.stringify(first)));
 assert.equal(importMockDay(restored,feed),restored);
 restored.metrics.turn=11;const second=importMockDay(restored,feed);
 assert.deepEqual(second.transactionUpdateTurns,[10,11]);assert.equal(second.metrics.turn,11);
 assert.equal(second.progression.coins,7);assert.equal(state.transactions.length,0);
});
test('mock mission purchases award coins once and remain labeled mock',()=>{
 let state=createGame();for(let day=1;day<=6;day++){state.metrics.turn=day;state=importMockDay(state,feed);}
 assert.ok(state.progression.claimed.includes('mission-1-gym'));
 assert.ok(state.progression.claimed.includes('mission-1-health'));
 assert.ok(state.transactions.every(t=>t.origin==='mock'));
 const replay=importMockDay(state,feed,6);assert.equal(replay,state);
});
test('game over prevents feed consumption and rewind restores its cursor',()=>{
 const state=importMockDay(createGame(),feed);
 assert.deepEqual(rewindRun(state).transactionUpdateTurns??[],[]);
 const ended={...state,isGameOver:true};assert.equal(importMockDay(ended,feed),ended);
});

test('Day 3 imports only fixture Day 3 even when earlier days were skipped',()=>{
 const state=createGame();state.metrics.turn=3;
 const next=importMockDay(state,feed);
 assert.deepEqual(next.transactions.map(t=>t.id),feed.days[2].transactions.map(t=>t.id).reverse());
 assert.ok(next.transactions.every(t=>t.gameDay===3));
 assert.equal(next.metrics.cashBalance,2982);
 assert.equal(importMockDay(next,feed),next);
});
test('Month 2 uses Day 1 again with distinct IDs and rejects stale requests',()=>{
 const first=importMockDay(createGame(),feed);first.metrics.turn=31;
 assert.equal(importMockDay(first,feed,1),first);
 const next=importMockDay(first,feed,31);
 assert.equal(next.transactions.filter(t=>t.gameDay===31).length,2);
 assert.equal(new Set(next.transactions.map(t=>t.id)).size,4);
 assert.deepEqual(next.transactionUpdateTurns,[1,31]);
});
test('legacy click-based saves do not debit an already imported fixture twice',()=>{
 const original=importMockDay(createGame(),feed);
 delete original.transactionUpdateTurns;original.mockFeedDay=1;
 const next=importMockDay(original,feed);
 assert.equal(next.metrics.cashBalance,original.metrics.cashBalance);
 assert.equal(next.transactions.length,original.transactions.length);
 assert.deepEqual(next.transactionUpdateTurns,[1]);
});
