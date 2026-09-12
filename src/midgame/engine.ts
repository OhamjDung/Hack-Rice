import type { MidgameState, PendingAllocation, RoundSummaryData, Debuff } from './types.ts';
import {
  ROUNDS_PER_YEAR, EMERGENCY_FUND_MULTIPLIER, PRE_UNLOCK_TICK_AMOUNT,
  PAYCHECK_BASE, PAYCHECK_VARIANCE, MATCH_RATE, MATCH_CAP, IRA_ANNUAL_CAP,
  HAPPINESS_MAX, HAPPINESS_START, HAPPINESS_DECAY_PER_SEC_BASE, HAPPINESS_DEBUFF_THRESHOLD,
  HAPPINESS_SPEND_UNIT, HAPPINESS_REFILL_PER_UNIT, FOOD_WEEKLY_COST,
  HUNGRY_DECAY_MULTIPLIER, UNHAPPY_FOOD_COST_MULTIPLIER, UPGRADE_DECAY_FLOOR_RATIO,
  UPGRADES, AUTOMATION_UNLOCK_ROUND, AUTOMATION_EVENT_CHANCE, MISSED_BILL_PENALTY,
  INVEST_NOW_STREAK_FOR_RISKY_TIER, WEEKS_PER_ROUND,
} from './constants.ts';

const clone = <T,>(s: T): T => structuredClone(s);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function createMidgameState(monthlyExpenses = 1200): MidgameState {
  return {
    unlocked: false,
    monthlyExpenses,
    emergencyFundBalance: 0,
    emergencyFundThreshold: monthlyExpenses * EMERGENCY_FUND_MULTIPLIER,
    buckets: { four01k: 0, ira: 0, cashReserve: 0, invested: 0 },
    iraAnnualContributed: 0,
    matchStreak: 0,
    lastEfficiency: null,
    round: 1,
    year: 1,
    week: 1,
    isRoundActive: false,
    pendingPaycheck: null,
    happiness: HAPPINESS_START,
    happinessDecayPerSec: HAPPINESS_DECAY_PER_SEC_BASE,
    foodMetThisWeek: false,
    foodCostThisWeek: FOOD_WEEKLY_COST,
    debuffs: [],
    upgrades: [],
    automations: { four01k: false, ira: false },
    automationInterrupted: { four01k: false, ira: false },
    investNowStreak: 0,
    readyForRiskyTier: false,
    netWorthHistory: [],
    log: ['Building your emergency fund...'],
    isGameOver: false,
  };
}

function effectiveDecayRate(state: MidgameState): number {
  const reduction = state.upgrades.reduce((sum, id) => {
    const u = UPGRADES.find(u => u.id === id);
    return sum + (u?.decayReduction ?? 0);
  }, 0);
  const floor = HAPPINESS_DECAY_PER_SEC_BASE * UPGRADE_DECAY_FLOOR_RATIO;
  let rate = HAPPINESS_DECAY_PER_SEC_BASE * (1 - Math.min(reduction, 1 - UPGRADE_DECAY_FLOOR_RATIO));
  rate = Math.max(rate, floor);
  if (state.debuffs.some(d => d.id === 'hungry')) rate *= HUNGRY_DECAY_MULTIPLIER;
  return rate;
}

// Passive safe-tier growth before mid-game unlocks. Call every tick while !unlocked.
export function tickPreUnlock(input: MidgameState, deltaMs: number): MidgameState {
  if (input.unlocked || input.isGameOver) return input;
  const state = clone(input);
  state.emergencyFundBalance = round2(state.emergencyFundBalance + PRE_UNLOCK_TICK_AMOUNT * (deltaMs / 1000));
  if (state.emergencyFundBalance >= state.emergencyFundThreshold) {
    state.unlocked = true;
    state.log.push('Emergency fund reached 3x monthly expenses. 401(k) match unlocked — welcome to Bookkeeping.');
    state.pendingPaycheck = round2(PAYCHECK_BASE + (Math.random() * 2 - 1) * PAYCHECK_VARIANCE);
  }
  return state;
}

// Real-time happiness drain while a round is active (allocation already made).
export function tickHappiness(input: MidgameState, deltaMs: number): MidgameState {
  if (!input.unlocked || !input.isRoundActive || input.isGameOver) return input;
  const state = clone(input);
  state.happinessDecayPerSec = effectiveDecayRate(state);
  state.happiness = Math.max(0, round2(state.happiness - state.happinessDecayPerSec * (deltaMs / 1000)));
  return state;
}

export function matchFor(contribution: number): number {
  return round2(Math.min(contribution, MATCH_CAP) * MATCH_RATE);
}

export function iraRemainingCap(state: MidgameState): number {
  return round2(Math.max(0, IRA_ANNUAL_CAP - state.iraAnnualContributed));
}

// Roll whether any currently-automated bucket gets knocked back to manual this round.
function rollAutomationEvents(state: MidgameState): MidgameState {
  const next = clone(state);
  (['four01k', 'ira'] as const).forEach(bucket => {
    next.automationInterrupted[bucket] = next.automations[bucket] && Math.random() < AUTOMATION_EVENT_CHANCE;
    if (next.automationInterrupted[bucket]) {
      next.log.push(`${bucket === 'four01k' ? '401(k)' : 'IRA'} automation interrupted this round — reallocate it once, then it resumes.`);
    }
  });
  return next;
}

// Begin a new round: paycheck lands, automation resolves or the allocation modal opens.
export function startRound(input: MidgameState): MidgameState {
  if (input.isGameOver || !input.unlocked) return input;
  let state = clone(input);
  state.week = 1;
  state.foodMetThisWeek = false;
  state.foodCostThisWeek = FOOD_WEEKLY_COST * (state.debuffs.some(d => d.id === 'unhappy') ? UNHAPPY_FOOD_COST_MULTIPLIER : 1);
  state.pendingPaycheck = round2(PAYCHECK_BASE + (Math.random() * 2 - 1) * PAYCHECK_VARIANCE);
  state.isRoundActive = false;
  state = rollAutomationEvents(state);
  state.log.push(`Round ${state.round} paycheck: $${(state.pendingPaycheck ?? 0).toFixed(2)}`);
  return state;
}

// Apply the player's (or automation's) chosen allocation for the current paycheck.
export function finalizeAllocation(input: MidgameState, alloc: PendingAllocation, bills: number): MidgameState {
  if (input.isGameOver || input.pendingPaycheck == null) return input;
  const state = clone(input);
  const paycheck: number = state.pendingPaycheck ?? 0;
  const spent = alloc.four01k + alloc.ira + alloc.cashReserve + alloc.investNow + bills;

  if (spent > paycheck + 0.01) {
    // Shortfall: pull from cash reserve first, then a flat penalty if still short.
    const shortfall = round2(spent - paycheck);
    if (state.buckets.cashReserve >= shortfall) {
      state.buckets.cashReserve = round2(state.buckets.cashReserve - shortfall);
    } else {
      state.buckets.cashReserve = 0;
      state.log.push(`Missed bill coverage — $${MISSED_BILL_PENALTY} penalty applied.`);
      state.buckets.invested = round2(Math.max(0, state.buckets.invested - MISSED_BILL_PENALTY));
    }
  }

  const irap = Math.min(alloc.ira, iraRemainingCap(state));
  state.iraAnnualContributed = round2(state.iraAnnualContributed + irap);
  state.buckets.ira = round2(state.buckets.ira + irap);

  const match = matchFor(alloc.four01k);
  state.buckets.four01k = round2(state.buckets.four01k + alloc.four01k + match);

  state.buckets.cashReserve = round2(state.buckets.cashReserve + alloc.cashReserve);
  state.buckets.invested = round2(state.buckets.invested + alloc.investNow);

  const efficiency = round2((match / (MATCH_CAP * MATCH_RATE)) * 100);
  state.lastEfficiency = efficiency;
  state.matchStreak = efficiency >= 99.9 ? state.matchStreak + 1 : 0;

  state.investNowStreak = alloc.investNow > alloc.cashReserve ? state.investNowStreak + 1 : 0;
  state.readyForRiskyTier = state.investNowStreak >= INVEST_NOW_STREAK_FOR_RISKY_TIER;

  state.pendingPaycheck = null;
  state.isRoundActive = true;
  state.log.push(`Allocated: 401(k) $${alloc.four01k} (+$${match} match), IRA $${irap}, reserve $${alloc.cashReserve}, invested $${alloc.investNow}. Match efficiency ${efficiency}%.`);
  return state;
}

export function buyUpgrade(input: MidgameState, upgradeId: string): MidgameState {
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade || input.upgrades.includes(upgradeId) || input.buckets.cashReserve < upgrade.cost) return input;
  const state = clone(input);
  state.buckets.cashReserve = round2(state.buckets.cashReserve - upgrade.cost);
  state.upgrades.push(upgradeId);
  state.happinessDecayPerSec = effectiveDecayRate(state);
  state.log.push(`Bought ${upgrade.name} — happiness decay reduced.`);
  return state;
}

export function spendOnHappiness(input: MidgameState): MidgameState {
  if (input.buckets.cashReserve < HAPPINESS_SPEND_UNIT || input.isGameOver) return input;
  const state = clone(input);
  state.buckets.cashReserve = round2(state.buckets.cashReserve - HAPPINESS_SPEND_UNIT);
  state.happiness = Math.min(HAPPINESS_MAX, round2(state.happiness + HAPPINESS_REFILL_PER_UNIT));
  return state;
}

export function payForFood(input: MidgameState): MidgameState {
  if (input.foodMetThisWeek || input.isGameOver) return input;
  if (input.buckets.cashReserve < input.foodCostThisWeek) return input;
  const state = clone(input);
  state.buckets.cashReserve = round2(state.buckets.cashReserve - state.foodCostThisWeek);
  state.foodMetThisWeek = true;
  state.log.push('Food covered for the week.');
  return state;
}

function upsertDebuff(debuffs: Debuff[], id: Debuff['id']): Debuff[] {
  const existing = debuffs.find(d => d.id === id);
  if (existing) { existing.weeksRemaining = 1; return debuffs; }
  return [...debuffs, { id, weeksRemaining: 1 }];
}

// Advance one week: evaluate/clear debuffs, reset weekly need state. If this was
// the last week of the round, also runs endRound and returns the summary via
// state.log (call getRoundSummary before calling this if the UI needs the numbers).
export function advanceWeek(input: MidgameState): MidgameState {
  if (input.isGameOver || !input.unlocked) return input;
  let state = clone(input);

  const foodMissed = !state.foodMetThisWeek;
  const happinessMissed = state.happiness < HAPPINESS_DEBUFF_THRESHOLD;

  let debuffs = state.debuffs.map(d => ({ ...d }));
  debuffs = debuffs.filter(d => {
    if (d.id === 'hungry') return foodMissed; // cleared only if food was met this week
    if (d.id === 'unhappy') return happinessMissed;
    return true;
  });
  if (foodMissed) debuffs = upsertDebuff(debuffs, 'hungry');
  if (happinessMissed) debuffs = upsertDebuff(debuffs, 'unhappy');
  state.debuffs = debuffs;

  state.week += 1;
  state.foodMetThisWeek = false;
  state.foodCostThisWeek = FOOD_WEEKLY_COST * (debuffs.some(d => d.id === 'unhappy') ? UNHAPPY_FOOD_COST_MULTIPLIER : 1);
  state.happinessDecayPerSec = effectiveDecayRate(state);

  if (state.week > WEEKS_PER_ROUND) {
    state = endRound(state);
  }
  return state;
}

function netWorth(state: MidgameState): number {
  return round2(state.buckets.four01k + state.buckets.ira + state.buckets.cashReserve + state.buckets.invested);
}

export function getRoundSummary(state: MidgameState): RoundSummaryData {
  const tips: string[] = [];
  if ((state.lastEfficiency ?? 0) < 100) tips.push('You left employer match on the table this round.');
  if (state.debuffs.some(d => d.id === 'hungry')) tips.push('Food went unmet — cash reserve ran dry before the week closed.');
  if (state.debuffs.some(d => d.id === 'unhappy')) tips.push('Happiness bottomed out — spend a little from reserve each week.');
  if (tips.length === 0) tips.push('Clean round — needs met, match captured.');
  return {
    efficiency: state.lastEfficiency ?? 0,
    matchStreak: state.matchStreak,
    happiness: state.happiness,
    foodMet: !state.debuffs.some(d => d.id === 'hungry'),
    debuffs: state.debuffs,
    coachTip: tips[0],
    netWorth: netWorth(state),
  };
}

function endRound(input: MidgameState): MidgameState {
  const state = clone(input);
  state.netWorthHistory.push(netWorth(state));
  state.round += 1;
  if ((state.round - 1) % ROUNDS_PER_YEAR === 0) {
    state.year += 1;
    if (state.iraAnnualContributed < IRA_ANNUAL_CAP) {
      state.log.push(`Unused IRA room ($${iraRemainingCap(state)}) lost — annual cap doesn't roll over.`);
    }
    state.iraAnnualContributed = 0;
  }
  state.isRoundActive = false;
  return startRound(state);
}

export function toggleAutomation(input: MidgameState, bucket: 'four01k' | 'ira'): MidgameState {
  if (input.round < AUTOMATION_UNLOCK_ROUND) return input;
  const state = clone(input);
  state.automations[bucket] = !state.automations[bucket];
  state.log.push(`${bucket === 'four01k' ? '401(k)' : 'IRA'} automation ${state.automations[bucket] ? 'enabled' : 'disabled'}.`);
  return state;
}
