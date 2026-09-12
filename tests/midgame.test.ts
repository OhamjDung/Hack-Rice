import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMidgameState, tickPreUnlock, finalizeAllocation, advanceWeek, beginNextRound,
  payForFood, spendOnHappiness, matchFor, iraRemainingCap, getRoundSummary,
} from '../src/midgame/engine/roundLifecycle.ts';
import { applyDebuffs, hasDebuff } from '../src/midgame/engine/debuffEngine.ts';
import { trySideHustleTap } from '../src/midgame/engine/sideHustleEngine.ts';
import { detectAudit, correctAudit } from '../src/midgame/engine/eventEngine.ts';
import { interruptAutomation, resolveInterruptedBucket } from '../src/midgame/engine/automationEngine.ts';
import { spawnMicroEvent, expireStaleMicroEvents, resolveMicroEvent } from '../src/midgame/engine/microEventEngine.ts';
import { config } from '../src/midgame/config.ts';

test('mid-game stays locked until emergency fund hits 3x monthly expenses', () => {
  const s = createMidgameState(1000);
  assert.equal(s.meta.unlocked, false);
  assert.equal(s.meta.emergencyFundThreshold, 3000);
  const next = tickPreUnlock(s, 1000);
  assert.equal(next.meta.unlocked, false);
  assert.ok(next.meta.emergencyFundBalance > 0);
});

test('unlock fires exactly at threshold and opens the first paycheck', () => {
  let s = createMidgameState(100);
  for (let i = 0; i < 20 && !s.meta.unlocked; i++) s = tickPreUnlock(s, 2000);
  assert.equal(s.meta.unlocked, true);
  assert.equal(s.round.phase, 'allocation');
  assert.ok(s.round.paycheckAmount != null && s.round.paycheckAmount > 0);
});

test('401k contribution up to match cap earns 50% free money, capped beyond that', () => {
  assert.equal(matchFor(400), 200);
  assert.equal(matchFor(800), 200);
  assert.equal(matchFor(0), 0);
});

test('finalizeAllocation moves money into buckets and computes match efficiency', () => {
  let s = createMidgameState(600);
  s.meta.unlocked = true;
  s.round.paycheckAmount = 2400;
  s.round.billsAmount = 600;
  s = finalizeAllocation(s, { four01k: 400, ira: 300, cashReserve: 500, investNow: 400 });
  assert.equal(s.player.buckets.four01k, 600);
  assert.equal(s.player.buckets.ira, 300);
  assert.equal(s.player.buckets.cashReserve, 500);
  assert.equal(s.player.buckets.invested, 400);
  assert.equal(s.player.lastEfficiency, 100);
  assert.equal(s.round.phase, 'weekly-survival');
  assert.equal(s.round.paycheckAmount, null);
});

test('IRA contributions cannot exceed the annual cap and it does not roll over', () => {
  let s = createMidgameState(600);
  s.meta.unlocked = true;
  s.round.paycheckAmount = 5000;
  s.round.billsAmount = 0;
  s = finalizeAllocation(s, { four01k: 0, ira: 10000, cashReserve: 0, investNow: 0 });
  assert.ok(s.player.buckets.ira <= config.iraAnnualCap);
  assert.equal(iraRemainingCap(s), 0);
});

test('missing food for a week applies the Hungry debuff; a clean week clears it', () => {
  let s = createMidgameState(600);
  s.meta.unlocked = true;
  s.round.phase = 'weekly-survival';
  s = advanceWeek(s);
  assert.ok(hasDebuff(s.round.activeDebuffs, 'hungry'));
  s.player.buckets.cashReserve = 1000;
  s = payForFood(s);
  assert.equal(s.week.foodMetThisWeek, true);
  s = advanceWeek(s);
  assert.ok(!hasDebuff(s.round.activeDebuffs, 'hungry'));
});

test('debuffs stack: missing both Food and Happiness in the same week applies both', () => {
  const result = applyDebuffs([], false, false);
  assert.equal(result.length, 2);
  assert.ok(result.some(d => d.id === 'hungry'));
  assert.ok(result.some(d => d.id === 'unhappy'));
});

test('cash reserve of zero means a need is automatically missed, not borrowed', () => {
  const s = createMidgameState(600);
  s.meta.unlocked = true;
  s.player.buckets.cashReserve = 0;
  const afterFood = payForFood(s);
  assert.equal(afterFood.week.foodMetThisWeek, false);
  const afterHappiness = spendOnHappiness(s, 10);
  assert.equal(afterHappiness.week.happiness, s.week.happiness);
});

test('round rollover starts the next round awaiting a fresh allocation after summary', () => {
  let s = createMidgameState(600);
  s.meta.unlocked = true;
  s.round.paycheckAmount = 2400;
  s.round.billsAmount = 600;
  s = finalizeAllocation(s, { four01k: 0, ira: 0, cashReserve: 1800, investNow: 0 });
  for (let i = 0; i < 4; i++) s = advanceWeek(s);
  assert.equal(s.round.phase, 'summary');
  assert.equal(s.round.round, 2);
  const summary = getRoundSummary(s);
  assert.ok(summary.netWorth >= 0);
  s = beginNextRound(s);
  assert.equal(s.round.phase, 'allocation');
  assert.ok(s.round.paycheckAmount != null);
});

test('side hustle tap respects cooldown and per-round earnings cap', () => {
  const state = { lastTapAt: null, earnedThisRound: 0 };
  const first = trySideHustleTap(state, 1000, config);
  assert.equal(first.success, true);
  const second = trySideHustleTap(first.state, 1100, config); // still cooling down
  assert.equal(second.success, false);
  const capped = trySideHustleTap({ lastTapAt: null, earnedThisRound: config.sideHustle.earningsCapPerRound! }, 5000, config);
  assert.equal(capped.success, false);
});

test('audit detects IRA over-contribution and correction moves the excess back to Cash Reserve', () => {
  const over = detectAudit(config.iraAnnualCap + 200, config.iraAnnualCap);
  assert.equal(over, 200);
  const buckets = { four01k: 0, ira: config.iraAnnualCap + 200, cashReserve: 0, invested: 0 };
  const corrected = correctAudit(buckets, 200);
  assert.equal(corrected.ira, config.iraAnnualCap);
  assert.equal(corrected.cashReserve, 200);
});

test('automation interruption reverts to automated after one manual redo, never permanently lost', () => {
  const automated = { state: 'automated' as const };
  const interrupted = interruptAutomation(automated, 'bonus');
  assert.equal(interrupted.state, 'automated-interrupted');
  const resolved = resolveInterruptedBucket(interrupted);
  assert.equal(resolved.state, 'automated');
});

test('micro-events expire cleanly with no penalty if ignored', () => {
  const now = 1_000_000;
  const event = spawnMicroEvent(now, config);
  const stillActive = expireStaleMicroEvents([event], now + 100);
  assert.equal(stillActive.length, 1);
  const expired = expireStaleMicroEvents([event], now + config.microEvent.reactionWindowMs + 1);
  assert.equal(expired.length, 0);
});

test('micro-event resolution applies its effect exactly once when accepted, nothing when declined', () => {
  const def = { id: 'x', kind: 'windfall' as const, amount: 50, weight: 1 };
  assert.deepEqual(resolveMicroEvent(def, true), { cashReserveDelta: 50 });
  assert.equal(resolveMicroEvent(def, false), null);
});
