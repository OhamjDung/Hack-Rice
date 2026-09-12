import type { MidgameState, PendingAllocation, RoundSummaryData } from '../types.ts';
import { config } from '../config.ts';
import { applyDebuffs, resolveWeekEnd, hasDebuff } from './debuffEngine.ts';
import { resetSideHustleForRound } from './sideHustleEngine.ts';
import { rollAutomationInterruptions } from './automationEngine.ts';
import { rollRandomEvent, applyEventEffect, detectAudit } from './eventEngine.ts';

const clone = <T,>(s: T): T => structuredClone(s);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function createMidgameState(monthlyExpenses = 1200): MidgameState {
  return {
    meta: {
      unlocked: false,
      monthlyExpenses,
      emergencyFundBalance: 0,
      emergencyFundThreshold: monthlyExpenses * config.emergencyFundMultiplier,
      isGameOver: false,
      log: ['Building your emergency fund...'],
    },
    player: {
      buckets: { four01k: 0, ira: 0, cashReserve: 0, invested: 0 },
      iraAnnualContributed: 0,
      automations: { four01k: { state: 'manual' }, ira: { state: 'manual' } },
      matchStreak: 0,
      lastEfficiency: null,
      upgrades: [],
      sideHustle: resetSideHustleForRound(),
      investNowStreak: 0,
      readyForRiskyTier: false,
      netWorthHistory: [],
    },
    round: {
      round: 1,
      year: 1,
      paycheckAmount: null,
      billsAmount: monthlyExpenses,
      phase: 'pre-unlock',
      weekIndex: 1,
      activeDebuffs: [],
      events: [],
      activeMicroEvents: [],
      auditOverContribution: null,
      microEventElapsedMs: 0,
      weekElapsedMs: 0,
    },
    week: {
      happiness: config.happinessStart,
      happinessDecayPerSec: config.happinessDecayPerSecond,
      foodMetThisWeek: false,
      foodCostThisWeek: config.foodWeeklyCost,
    },
  };
}

function effectiveDecayRate(state: MidgameState): number {
  const reduction = state.player.upgrades.reduce((sum, u) => sum + u.decayReduction, 0);
  const floor = config.happinessDecayPerSecond * config.upgradeDecayReductionFloor;
  let rate = config.happinessDecayPerSecond * (1 - Math.min(reduction, 1 - config.upgradeDecayReductionFloor));
  rate = Math.max(rate, floor);
  if (hasDebuff(state.round.activeDebuffs, 'hungry')) rate *= config.debuffHappinessHit;
  return rate;
}

export function tickPreUnlock(input: MidgameState, deltaMs: number): MidgameState {
  if (input.meta.unlocked || input.meta.isGameOver) return input;
  const state = clone(input);
  state.meta.emergencyFundBalance = round2(state.meta.emergencyFundBalance + config.preUnlockTickAmount * (deltaMs / 1000));
  if (state.meta.emergencyFundBalance >= state.meta.emergencyFundThreshold) {
    state.meta.unlocked = true;
    state.meta.log.push('Emergency fund reached 3x monthly expenses. 401(k) match unlocked — welcome to Bookkeeping.');
    return startRound(state);
  }
  return state;
}

export function tickHappiness(input: MidgameState, deltaMs: number): MidgameState {
  if (!input.meta.unlocked || input.round.phase !== 'weekly-survival' || input.meta.isGameOver) return input;
  const state = clone(input);
  state.week.happinessDecayPerSec = effectiveDecayRate(state);
  state.week.happiness = Math.max(0, round2(state.week.happiness - state.week.happinessDecayPerSec * (deltaMs / 1000)));
  return state;
}

export function matchFor(contribution: number): number {
  return round2(Math.min(contribution, config.matchCap) * config.matchPercent);
}

export function iraRemainingCap(state: MidgameState): number {
  return round2(Math.max(0, config.iraAnnualCap - state.player.iraAnnualContributed));
}

export function startRound(input: MidgameState): MidgameState {
  if (input.meta.isGameOver || !input.meta.unlocked) return input;
  const state = clone(input);
  state.round.weekIndex = 1;
  state.round.weekElapsedMs = 0;
  state.round.phase = 'allocation';
  state.week.foodMetThisWeek = false;
  state.week.foodCostThisWeek = config.foodWeeklyCost * (hasDebuff(state.round.activeDebuffs, 'unhappy') ? config.debuffFoodMaxReduction : 1);
  state.round.paycheckAmount = round2(config.paycheckBase + (Math.random() * 2 - 1) * config.paycheckVariance);
  state.player.sideHustle = resetSideHustleForRound();
  state.player.automations = rollAutomationInterruptions(state.player.automations, config);
  if (state.player.automations.four01k.state === 'automated-interrupted') state.meta.log.push('401(k) automation interrupted this round — reallocate it once, then it resumes.');
  if (state.player.automations.ira.state === 'automated-interrupted') state.meta.log.push('IRA automation interrupted this round — reallocate it once, then it resumes.');
  state.meta.log.push(`Round ${state.round.round} paycheck: $${state.round.paycheckAmount.toFixed(2)}`);
  return state;
}

export function finalizeAllocation(input: MidgameState, alloc: PendingAllocation): MidgameState {
  if (input.meta.isGameOver || input.round.paycheckAmount == null) return input;
  const state = clone(input);
  const paycheck: number = state.round.paycheckAmount ?? 0;
  const bills = state.round.billsAmount;
  const spent = alloc.four01k + alloc.ira + alloc.cashReserve + alloc.investNow + bills;

  if (spent > paycheck + 0.01) {
    const shortfall = round2(spent - paycheck);
    if (state.player.buckets.cashReserve >= shortfall) {
      state.player.buckets.cashReserve = round2(state.player.buckets.cashReserve - shortfall);
    } else {
      state.player.buckets.cashReserve = 0;
      state.meta.log.push(`Missed bill coverage — $${config.missedBillPenaltyFlat} penalty applied.`);
      state.player.buckets.invested = round2(Math.max(0, state.player.buckets.invested - config.missedBillPenaltyFlat));
    }
  }

  const irap = Math.min(alloc.ira, iraRemainingCap(state));
  state.player.iraAnnualContributed = round2(state.player.iraAnnualContributed + irap);
  state.player.buckets.ira = round2(state.player.buckets.ira + irap);

  const match = matchFor(alloc.four01k);
  state.player.buckets.four01k = round2(state.player.buckets.four01k + alloc.four01k + match);
  state.player.buckets.cashReserve = round2(state.player.buckets.cashReserve + alloc.cashReserve);
  state.player.buckets.invested = round2(state.player.buckets.invested + alloc.investNow);

  const efficiency = round2((match / (config.matchCap * config.matchPercent)) * 100);
  state.player.lastEfficiency = efficiency;
  state.player.matchStreak = efficiency >= 99.9 ? state.player.matchStreak + 1 : 0;

  state.player.investNowStreak = alloc.investNow > alloc.cashReserve ? state.player.investNowStreak + 1 : 0;
  state.player.readyForRiskyTier = state.player.investNowStreak >= config.investNowStreakForRiskyTier;

  if (state.player.automations.four01k.state === 'automated-interrupted') state.player.automations.four01k = { state: 'automated' };
  if (state.player.automations.ira.state === 'automated-interrupted') state.player.automations.ira = { state: 'automated' };

  state.round.paycheckAmount = null;
  state.round.phase = 'weekly-survival';
  state.meta.log.push(`Allocated: 401(k) $${alloc.four01k} (+$${match} match), IRA $${irap}, reserve $${alloc.cashReserve}, invested $${alloc.investNow}. Match efficiency ${efficiency}%.`);
  return state;
}

export function payForFood(input: MidgameState): MidgameState {
  if (input.week.foodMetThisWeek || input.meta.isGameOver) return input;
  if (input.player.buckets.cashReserve < input.week.foodCostThisWeek) return input;
  const state = clone(input);
  state.player.buckets.cashReserve = round2(state.player.buckets.cashReserve - state.week.foodCostThisWeek);
  state.week.foodMetThisWeek = true;
  state.meta.log.push('Food covered for the week.');
  return state;
}

export function spendOnHappiness(input: MidgameState, dollars: number = 10): MidgameState {
  if (input.player.buckets.cashReserve < dollars || input.meta.isGameOver) return input;
  const state = clone(input);
  state.player.buckets.cashReserve = round2(state.player.buckets.cashReserve - dollars);
  state.week.happiness = Math.min(config.happinessMax, round2(state.week.happiness + dollars * config.happinessRefillPerDollar));
  return state;
}

export function advanceWeek(input: MidgameState): MidgameState {
  if (input.meta.isGameOver || !input.meta.unlocked) return input;
  let state = clone(input);

  const { happinessMet, foodMet } = resolveWeekEnd(state.week, config);
  state.round.activeDebuffs = applyDebuffs(state.round.activeDebuffs, happinessMet, foodMet);

  state.round.weekIndex += 1;
  state.round.weekElapsedMs = 0;
  state.week.foodMetThisWeek = false;
  state.week.foodCostThisWeek = config.foodWeeklyCost * (hasDebuff(state.round.activeDebuffs, 'unhappy') ? config.debuffFoodMaxReduction : 1);
  state.week.happinessDecayPerSec = effectiveDecayRate(state);

  if (state.round.weekIndex > config.weeksPerRound) {
    state = closeRound(state);
    state.round.phase = 'summary';
  }
  return state;
}

function netWorth(state: MidgameState): number {
  const b = state.player.buckets;
  return round2(b.four01k + b.ira + b.cashReserve + b.invested);
}

export function getRoundSummary(state: MidgameState): RoundSummaryData {
  const tips: string[] = [];
  if ((state.player.lastEfficiency ?? 0) < 100) tips.push('You left employer match on the table this round.');
  if (hasDebuff(state.round.activeDebuffs, 'hungry')) tips.push('Food went unmet — cash reserve ran dry before the week closed.');
  if (hasDebuff(state.round.activeDebuffs, 'unhappy')) tips.push('Happiness bottomed out — spend a little from reserve each week.');
  if (tips.length === 0) tips.push('Clean round — needs met, match captured.');
  return {
    efficiency: state.player.lastEfficiency ?? 0,
    matchStreak: state.player.matchStreak,
    happiness: state.week.happiness,
    foodMet: !hasDebuff(state.round.activeDebuffs, 'hungry'),
    debuffs: state.round.activeDebuffs,
    coachTip: tips[0],
    netWorth: netWorth(state),
  };
}

// Closes out the finished round (net worth snapshot, random event, year rollover, audit
// check) but leaves phase at 'summary' — the next round only starts once the player
// continues past the summary screen, via beginNextRound.
function closeRound(input: MidgameState): MidgameState {
  const state = clone(input);
  state.player.netWorthHistory.push(netWorth(state));
  state.round.round += 1;

  const event = rollRandomEvent(state.round.round);
  if (event) {
    const effect = applyEventEffect(event);
    if (effect.cashReserveDelta) state.player.buckets.cashReserve = round2(Math.max(0, state.player.buckets.cashReserve + effect.cashReserveDelta));
    state.round.events.push(event);
    state.meta.log.push(effect.log);
  }

  if ((state.round.round - 1) % config.roundsPerYear === 0) {
    state.round.year += 1;
    if (state.player.iraAnnualContributed < config.iraAnnualCap) {
      state.meta.log.push(`Unused IRA room ($${iraRemainingCap(state)}) lost — annual cap doesn't roll over.`);
    }
    state.player.iraAnnualContributed = 0;
  }

  state.round.auditOverContribution = detectAudit(state.player.iraAnnualContributed);
  return state;
}

export function beginNextRound(input: MidgameState): MidgameState {
  return startRound(input);
}
