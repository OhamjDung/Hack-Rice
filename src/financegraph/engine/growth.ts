// Account compounding — 401k/IRA/brokerage. Pure, no I/O.
import type { NodeProperties } from '../types.ts';

export interface GrowthStepInput {
  balance: number;
  monthlyContribution: number;
  annualGrowthRate: number;
  employerMatch?: NodeProperties['employerMatch'];
  monthlyIncomeForMatch?: number; // income this contribution is drawn from, for match % calc
  contributionLimit?: number; // annual
  contributedThisYear?: number;
}

export interface GrowthStepResult {
  balance: number;
  matchApplied: number;
  contributionApplied: number;
  contributedThisYear: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// balance = (balance + contribution) * (1 + r/12); employer match applied before growth for 401k.
export function stepAccountGrowth(input: GrowthStepInput): GrowthStepResult {
  const monthlyRate = input.annualGrowthRate / 12;
  const limit = input.contributionLimit ?? Infinity;
  const alreadyContributed = input.contributedThisYear ?? 0;
  const remainingRoom = Math.max(0, limit - alreadyContributed);
  const contribution = Math.min(input.monthlyContribution, remainingRoom);

  let match = 0;
  if (input.employerMatch && input.monthlyIncomeForMatch) {
    const matchableContribution = Math.min(contribution, input.monthlyIncomeForMatch * (input.employerMatch.limitPct / 100));
    match = matchableContribution * (input.employerMatch.pct / 100);
  }

  const balance = round2((input.balance + contribution + match) * (1 + monthlyRate));
  return {
    balance,
    matchApplied: round2(match),
    contributionApplied: round2(contribution),
    contributedThisYear: round2(alreadyContributed + contribution),
  };
}
