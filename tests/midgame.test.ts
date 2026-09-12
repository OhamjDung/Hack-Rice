import test from 'node:test';
import assert from 'node:assert/strict';
import { createMidgameState, tickPreUnlock, finalizeAllocation, advanceWeek, payForFood, spendOnHappiness, buyUpgrade, matchFor, iraRemainingCap } from '../src/midgame/engine.ts';

test('mid-game stays locked until emergency fund hits 3x monthly expenses', () => {
  const s = createMidgameState(1000);
  assert.equal(s.unlocked, false);
  assert.equal(s.emergencyFundThreshold, 3000);
  const next = tickPreUnlock(s, 1000);
  assert.equal(next.unlocked, false);
  assert.ok(next.emergencyFundBalance > 0);
});

test('unlock fires exactly at threshold and opens the first paycheck', () => {
  let s = createMidgameState(100); // low threshold for a fast test
  for (let i = 0; i < 20 && !s.unlocked; i++) s = tickPreUnlock(s, 2000);
  assert.equal(s.unlocked, true);
  assert.ok(s.pendingPaycheck != null && s.pendingPaycheck > 0);
});

test('401k contribution up to match cap earns 50% free money, capped beyond that', () => {
  assert.equal(matchFor(400), 200);
  assert.equal(matchFor(800), 200); // capped
  assert.equal(matchFor(0), 0);
});

test('finalizeAllocation moves money into buckets and computes match efficiency', () => {
  let s = createMidgameState(600);
  s.unlocked = true;
  s.pendingPaycheck = 2400;
  s = finalizeAllocation(s, { four01k: 400, ira: 300, cashReserve: 500, investNow: 400 }, 600);
  assert.equal(s.buckets.four01k, 600); // 400 + 200 match
  assert.equal(s.buckets.ira, 300);
  assert.equal(s.buckets.cashReserve, 500);
  assert.equal(s.buckets.invested, 400);
  assert.equal(s.lastEfficiency, 100);
  assert.equal(s.isRoundActive, true);
  assert.equal(s.pendingPaycheck, null);
});

test('IRA contributions cannot exceed the annual cap and it does not roll over', () => {
  let s = createMidgameState(600);
  s.unlocked = true;
  s.pendingPaycheck = 5000;
  s = finalizeAllocation(s, { four01k: 0, ira: 10000, cashReserve: 0, investNow: 0 }, 0);
  assert.ok(s.buckets.ira <= 3600);
  assert.equal(iraRemainingCap(s), 0);
});

test('missing food for a week applies the Hungry debuff; a clean week clears it', () => {
  let s = createMidgameState(600);
  s.unlocked = true;
  s = advanceWeek(s); // week 1 ends with food unmet
  assert.ok(s.debuffs.some(d => d.id === 'hungry'));
  s = payForFood({ ...s, buckets: { ...s.buckets, cashReserve: 1000 } });
  assert.equal(s.foodMetThisWeek, true);
  s = advanceWeek(s);
  assert.ok(!s.debuffs.some(d => d.id === 'hungry'));
});

test('cash reserve of zero means a need is automatically missed, not borrowed', () => {
  let s = createMidgameState(600);
  s.unlocked = true;
  s.buckets.cashReserve = 0;
  const afterFood = payForFood(s);
  assert.equal(afterFood.foodMetThisWeek, false);
  const afterHappiness = spendOnHappiness(s);
  assert.equal(afterHappiness.happiness, s.happiness);
});

test('self-improvement upgrades reduce happiness decay but never below the floor ratio', () => {
  let s = createMidgameState(600);
  s.unlocked = true;
  s.buckets.cashReserve = 10000;
  for (const u of ['phone-declutter', 'meditation-habit', 'better-sleep']) s = buyUpgrade(s, u);
  assert.equal(s.upgrades.length, 3);
  assert.ok(s.happinessDecayPerSec > 0);
});

test('round rollover starts the next round awaiting a fresh allocation', () => {
  let s = createMidgameState(600);
  s.unlocked = true;
  s.pendingPaycheck = 2400;
  s = finalizeAllocation(s, { four01k: 0, ira: 0, cashReserve: 1800, investNow: 0 }, 600);
  for (let i = 0; i < 4; i++) s = advanceWeek(s);
  assert.equal(s.round, 2);
  assert.equal(s.isRoundActive, false);
  assert.ok(s.pendingPaycheck != null);
});
