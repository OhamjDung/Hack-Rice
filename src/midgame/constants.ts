// Tunable numbers for the Bookkeeping mid-game loop. Values are hackathon defaults
// per midgame/PLAN.md Section 8 (open numeric items) — tune freely, nothing else
// in engine.ts depends on the specific magnitudes.

export const ROUND_MS = 240_000; // one round = one paycheck cycle = ~4 min
export const WEEK_MS = ROUND_MS / 4; // ~1 min per week
export const WEEKS_PER_ROUND = 4;
export const ROUNDS_PER_YEAR = 12; // annual caps (IRA) reset every 12 rounds

export const EMERGENCY_FUND_MULTIPLIER = 3; // 3x monthly expenses unlocks mid-game
export const PRE_UNLOCK_TICK_MS = 2000; // passive safe-tier growth tick while locked
export const PRE_UNLOCK_TICK_AMOUNT = 60;

export const PAYCHECK_BASE = 2400;
export const PAYCHECK_VARIANCE = 200; // +/- randomized per round

export const MATCH_RATE = 0.5; // employer matches 50%...
export const MATCH_CAP = 400; // ...of up to $400 contributed ($200 free)

export const IRA_ANNUAL_CAP = 3600; // shared annual ceiling, use-it-or-lose-it

export const HAPPINESS_MAX = 100;
export const HAPPINESS_START = 80;
export const HAPPINESS_DECAY_PER_SEC_BASE = 100 / 90; // ~0 in 90s unattended
export const HAPPINESS_DEBUFF_THRESHOLD = 30; // below this at week-end -> Unhappy debuff
export const HAPPINESS_SPEND_UNIT = 10; // $ per "top up" action
export const HAPPINESS_REFILL_PER_UNIT = 18;

export const FOOD_WEEKLY_COST = 150;

export const HUNGRY_DECAY_MULTIPLIER = 1.5; // missed food -> happiness drains faster
export const UNHAPPY_FOOD_COST_MULTIPLIER = 1.5; // missed happiness -> food costs more next week

export const UPGRADE_DECAY_FLOOR_RATIO = 0.4; // upgrades can't push decay below 40% of base

export const UPGRADES = [
  { id: 'phone-declutter', name: 'Phone Declutter', cost: 600, decayReduction: 0.15 },
  { id: 'meditation-habit', name: 'Meditation Habit', cost: 1200, decayReduction: 0.2 },
  { id: 'better-sleep', name: 'Better Sleep Routine', cost: 2000, decayReduction: 0.25 },
] as const;

export const AUTOMATION_UNLOCK_ROUND = 3; // earliest round automation can be toggled on
export const AUTOMATION_EVENT_CHANCE = 0.2; // per-round chance an automated bucket is interrupted

export const MISSED_BILL_PENALTY = 75; // flat fee if paycheck+reserve can't cover bills

export const INVEST_NOW_STREAK_FOR_RISKY_TIER = 3; // consecutive rounds choosing invest > reserve
