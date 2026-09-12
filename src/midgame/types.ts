// --- Config ---
export interface GameConfig {
  roundDurationMs: number;
  weekDurationMs: number;
  weeksPerRound: number;
  roundsPerYear: number;

  matchPercent: number;
  matchCap: number;

  iraAnnualCap: number;

  emergencyFundMultiplier: number;
  preUnlockTickMs: number;
  preUnlockTickAmount: number;

  paycheckBase: number;
  paycheckVariance: number;

  happinessMax: number;
  happinessStart: number;
  happinessDecayPerSecond: number;
  happinessRefillPerDollar: number;
  happinessMetThreshold: number;

  foodWeeklyCost: number;

  debuffDuration: number;
  debuffHappinessHit: number;
  debuffFoodMaxReduction: number;

  upgradeDecayReductionFloor: number;

  missedBillPenaltyFlat: number;

  microEvent: {
    spawnIntervalMs: number;
    reactionWindowMs: number;
    missedEventPenalty: boolean;
  };

  sideHustle: {
    perTapAmount: number;
    cooldownMs: number;
    earningsCapPerRound?: number;
  };

  automationUnlockRound: number;
  automationEventChance: number;

  investNowStreakForRiskyTier: number;
}

// --- Player / round state ---
export type DebuffId = 'hungry' | 'unhappy';
export interface Debuff { id: DebuffId; triggeredBy: 'food' | 'happiness'; weeksRemaining: number }

export type AutomationBucket = 'four01k' | 'ira';
export type AutomationStatus =
  | { state: 'locked' }
  | { state: 'manual' }
  | { state: 'automated' }
  | { state: 'automated-interrupted'; reason: EventType };

export interface PurchasedUpgrade { id: string; decayReduction: number }

export interface Buckets { four01k: number; ira: number; cashReserve: number; invested: number }

export interface SideHustleState {
  lastTapAt: number | null;
  earnedThisRound: number;
}

export interface PlayerFinancialState {
  buckets: Buckets;
  iraAnnualContributed: number;
  automations: Record<AutomationBucket, AutomationStatus>;
  matchStreak: number;
  lastEfficiency: number | null;
  upgrades: PurchasedUpgrade[];
  sideHustle: SideHustleState;
  investNowStreak: number;
  readyForRiskyTier: boolean;
  netWorthHistory: number[];
}

// --- Micro-events (Section 3.5.1) ---
export type MicroEventKind = 'windfall' | 'discount' | 'happiness_boost' | 'minor_cost';
export interface MicroEventDefinition {
  id: string;
  kind: MicroEventKind;
  targetNeed?: 'food' | 'happiness';
  amount: number;
  weight: number;
}
export interface ActiveMicroEvent {
  id: string;
  definitionId: string;
  spawnedAt: number;
  expiresAt: number;
  resolved: boolean;
}

// --- Larger random events + automation interruption ---
export type EventType = 'bonus' | 'cap_change' | 'early_withdrawal' | 'job_change' | 'car_repair' | 'audit' | 'other';
export interface GameEvent { type: EventType; round: number; week?: number; payload: Record<string, unknown> }

export type RoundPhase = 'pre-unlock' | 'allocation' | 'weekly-survival' | 'summary';

export interface PendingAllocation { four01k: number; ira: number; cashReserve: number; investNow: number }

export interface RoundState {
  round: number;
  year: number;
  paycheckAmount: number | null;
  billsAmount: number;
  phase: RoundPhase;
  weekIndex: number; // 1..weeksPerRound
  activeDebuffs: Debuff[];
  events: GameEvent[];
  activeMicroEvents: ActiveMicroEvent[];
  auditOverContribution: number | null; // set when IRA over-cap detected, drives AuditCorrectionModal
  microEventElapsedMs: number; // time since last spawn, drives the fixed spawn cadence
  weekElapsedMs: number; // time since the current week began, drives the week boundary
}

export interface WeekState {
  happiness: number;
  happinessDecayPerSec: number;
  foodMetThisWeek: boolean;
  foodCostThisWeek: number;
}

export interface MetaState {
  unlocked: boolean;
  monthlyExpenses: number;
  emergencyFundBalance: number;
  emergencyFundThreshold: number;
  isGameOver: boolean;
  log: string[];
}

export interface MidgameState {
  meta: MetaState;
  player: PlayerFinancialState;
  round: RoundState;
  week: WeekState;
}

export interface RoundSummaryData {
  efficiency: number;
  matchStreak: number;
  happiness: number;
  foodMet: boolean;
  debuffs: Debuff[];
  coachTip: string;
  netWorth: number;
}
