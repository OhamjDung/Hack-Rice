import type { GameConfig } from './types.ts';

// Centralized tunable numbers per PLAN.md Section 4 — every value here maps to
// an open item in the design doc's Section 8. Change values here, not in
// engine code. Comments cite the section they came from.

export const config: GameConfig = {
  roundDurationMs: 240_000, // ~4 min/round — PLAN.md Section 4, open
  weekDurationMs: 60_000, // ~1 min/week
  weeksPerRound: 4,
  roundsPerYear: 12,

  matchPercent: 0.5,
  matchCap: 400,

  iraAnnualCap: 3600,

  emergencyFundMultiplier: 3,
  preUnlockTickMs: 2000,
  preUnlockTickAmount: 60,

  paycheckBase: 2400,
  paycheckVariance: 200,

  happinessMax: 100,
  happinessStart: 80,
  happinessDecayPerSecond: 100 / 90,
  happinessRefillPerDollar: 1.8, // $10 -> +18
  happinessMetThreshold: 30,

  foodWeeklyCost: 150,

  debuffDuration: 1, // weeks; clears after one clean week
  debuffHappinessHit: 1.5, // Hungry: happiness decay multiplier
  debuffFoodMaxReduction: 1.5, // Unhappy: food cost multiplier next week

  upgradeDecayReductionFloor: 0.4, // decay can never drop below 40% of base

  missedBillPenaltyFlat: 75,

  microEvent: {
    spawnIntervalMs: 5000,
    reactionWindowMs: 3500,
    missedEventPenalty: false, // upside-only if ignored, per design lean
  },

  sideHustle: {
    perTapAmount: 1,
    cooldownMs: 1500,
    earningsCapPerRound: 60,
  },

  automationUnlockRound: 3,
  automationEventChance: 0.2,

  investNowStreakForRiskyTier: 3,
};

export const UPGRADES = [
  { id: 'phone-declutter', name: 'Phone Declutter', cost: 600, decayReduction: 0.15 },
  { id: 'meditation-habit', name: 'Meditation Habit', cost: 1200, decayReduction: 0.2 },
  { id: 'better-sleep', name: 'Better Sleep Routine', cost: 2000, decayReduction: 0.25 },
] as const;

export const MICRO_EVENT_POOL = [
  { id: 'spare-change', kind: 'windfall', amount: 15, weight: 3 },
  { id: 'tax-refund-trickle', kind: 'windfall', amount: 40, weight: 1 },
  { id: 'grocery-coupon', kind: 'discount', targetNeed: 'food', amount: 50, weight: 2 },
  { id: 'happy-hour', kind: 'happiness_boost', amount: 12, weight: 2 },
  { id: 'parking-ticket', kind: 'minor_cost', amount: 20, weight: 2 },
] as const;
