import type { MidgameState } from '../types.ts';
import { config } from '../config.ts';

export const netWorth = (state: MidgameState): number => {
  const b = state.player.buckets;
  return Math.round((b.four01k + b.ira + b.cashReserve + b.invested) * 100) / 100;
};

export const iraRemainingCap = (state: MidgameState): number =>
  Math.round(Math.max(0, config.iraAnnualCap - state.player.iraAnnualContributed) * 100) / 100;

export const matchFor = (contribution: number): number =>
  Math.round(Math.min(contribution, config.matchCap) * config.matchPercent * 100) / 100;

export const emergencyFundProgress = (state: MidgameState): number =>
  Math.min(100, (state.meta.emergencyFundBalance / state.meta.emergencyFundThreshold) * 100);
