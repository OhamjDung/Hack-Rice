export type DebuffId = 'hungry' | 'unhappy';

export interface Debuff { id: DebuffId; weeksRemaining: number }

export interface Buckets {
  four01k: number; // total contributed lifetime (display only, doesn't compound here)
  ira: number;
  cashReserve: number;
  invested: number; // medium-tier, compounds slowly each round
}

export interface AutomationState { four01k: boolean; ira: boolean }

export interface PendingAllocation {
  four01k: number;
  ira: number;
  cashReserve: number;
  investNow: number;
}

export interface MidgameState {
  unlocked: boolean;
  monthlyExpenses: number;
  emergencyFundBalance: number; // pre-unlock accumulator
  emergencyFundThreshold: number;

  buckets: Buckets;
  iraAnnualContributed: number;
  matchStreak: number;
  lastEfficiency: number | null;

  round: number;
  year: number;
  week: number; // 1..WEEKS_PER_ROUND
  isRoundActive: boolean; // false while the paycheck-allocation modal is open
  pendingPaycheck: number | null;

  happiness: number;
  happinessDecayPerSec: number; // current effective rate (base, upgrades, debuffs applied)
  foodMetThisWeek: boolean;
  foodCostThisWeek: number;

  debuffs: Debuff[];
  upgrades: string[];
  automations: AutomationState;
  automationInterrupted: AutomationState; // true = this round's bucket was knocked back to manual

  investNowStreak: number;
  readyForRiskyTier: boolean;

  netWorthHistory: number[];
  log: string[];

  isGameOver: boolean;
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
