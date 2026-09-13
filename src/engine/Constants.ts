import type { CategoryKey, Profile } from './Types.ts';
export const CATEGORY_META: Record<CategoryKey, {
    label: string;
    color: string;
    minimum: number;
    description: string;
}> = {
    food: { label: 'Food', color: '#c47742', minimum: 240, description: 'Keep the fridge stocked and yourself healthy.' }, housing: { label: 'Housing', color: '#858869', minimum: 1000, description: 'Pay rent each month. Two missed payments end your run.' }, transit: { label: 'Transport', color: '#658f9e', minimum: 80, description: 'A little mobility opens up a lot of possibilities.' }, leisure: { label: 'Fun & leisure', color: '#b18aa2', minimum: 0, description: 'Make room for the things that make you happy.' }, utilities: { label: 'Utilities', color: '#c7a24a', minimum: 100, description: 'Keep the lights on and your connection running.' }, savings: { label: 'Savings', color: '#518577', minimum: 0, description: 'Build your safety net. Every $500 unlocks a room level.' }
};
export const DEFAULT_PROFILE: Profile = { name: 'Alex', skinTone: '#d9a17a', hairColor: '#49372e', shirtColor: '#738269', pantsColor: '#455264', income: 3000, allocations: { food: 400, housing: 1200, transit: 150, leisure: 200, utilities: 150, savings: 600 } };
// 2026 federal brackets, single filer: [top of bracket, rate]. Simplified (no phase-outs) — this is a game, not tax advice.
export const TAX = { standardDeduction: 16100, brackets: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]] as const, socialSecurityRate: 0.062, socialSecurityWageBase: 184500, medicareRate: 0.0145, stateRate: 0.04 };
// Contribution limits are tracked per game-month rather than per year (CashBound has no year loop) — see design-system/room-economy/INVEST.md §3.
export const ACCOUNT_RULES = { k401Limit: 24500, iraLimit: 7500, matchRate: 0.5, matchCapPct: 0.06 };
