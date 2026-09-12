import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyTransactions,advanceTurn} from '../src/engine/RulesEngine.ts';
import {localDailyReview,applyDailyReview} from '../src/engine/DailyReview.ts';
import {projectRoom,unprojectRoom} from '../src/components/canvas/IsometricEngine.ts';
test('half of monthly cash spent by day five predicts starvation before cash runs out',()=>{
 const start=createGame();start.metrics.turn=5;
 const s=applyTransactions(start,[{id:'spree',amount:1500,kind:'purchase',category:'leisure',description:'Shopping',payerId:'demo',medium:'balance',paymentDate:'Day 5'}]);
 const review=localDailyReview(s,'close');assert.equal(s.metrics.cashBalance,1500);assert.equal(s.isGameOver,false);
 assert.equal(review.analysis.ending,'food_shortage');assert.ok(review.forecast.threats.some(t=>t.category==='food'));assert.equal(applyDailyReview(advanceTurn(s),review).ending.phase,'playing');
});
test('unfunded rent predicts darkness; unfunded recreation predicts fictional exhaustion',()=>{
 const rent=createGame();rent.metrics.cashBalance=500;
 assert.equal(localDailyReview(rent,'close').analysis.ending,'power_cut');
 const leisure=createGame();leisure.metrics.cashBalance=100;leisure.jars.food.spentAmount=240;leisure.jars.housing.spentAmount=1200;leisure.jars.utilities.spentAmount=100;leisure.jars.transit.spentAmount=80;
 const review=localDailyReview(leisure,'close');assert.equal(review.analysis.ending,'exhaustion');assert.equal(applyDailyReview(advanceTurn(leisure),review).ending.phase,'playing');
});
test('paying monthly rent early does not falsely extrapolate daily rent',()=>{
 const s=applyTransactions(createGame(),[{id:'rent',amount:1500,kind:'purchase',category:'housing',description:'Rent',payerId:'demo',medium:'balance',paymentDate:'Day 1'}]);
 assert.equal(localDailyReview(s,'close').analysis.ending,'none');
});
test('camera projection and click mapping agree across a full circle',()=>{
 for(let degrees=0;degrees<=360;degrees+=15){const angle=degrees*Math.PI/180;for(const [x,y] of [[2.5,2.5],[9.5,7.5],[5.5,4.5]]){const p=projectRoom(x,y,angle);assert.deepEqual(unprojectRoom(p.screenX,p.screenY,angle),{gridX:Math.floor(x),gridY:Math.floor(y)});}}
});
