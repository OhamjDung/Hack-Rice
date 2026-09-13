import type { TaxonomySubtype, NodeProperties } from '../types.ts';

// Deterministic fallback ranking — used at cold start and whenever the LLM call fails.
// Ordered roughly by "what a generic early-career person should learn about first."
export const DEFAULT_RANKING: TaxonomySubtype[] = [
  '401k', 'credit_card', 'rent', 'food', 'utilities',
  'roth_ira', 'health', 'traditional_ira', 'entertainment', 'auto',
  'student_loan', 'car', 'brokerage', 'disability', 'other',
  'home', 'mortgage', 'real_estate', 'life', 'medicare',
  'job_loss', 'market_crash', 'medical_emergency',
];

export const DEFAULT_GROWTH_RATES: Record<string, number> = {
  '401k': 0.07, roth_ira: 0.07, traditional_ira: 0.07, brokerage: 0.08, real_estate: 0.035,
};

export const DEFAULT_APR: Record<string, number> = {
  mortgage: 0.065, student_loan: 0.055, credit_card: 0.22,
};

export const DEFAULT_PROPERTIES: Record<TaxonomySubtype, NodeProperties> = {
  '401k': { growthRate: 0.07, taxTreatment: 'pre_tax', liquidity: 'low', employerMatch: { pct: 50, limitPct: 6 }, contributionLimit: 23_000 },
  roth_ira: { growthRate: 0.07, taxTreatment: 'post_tax', liquidity: 'low', contributionLimit: 7_000 },
  traditional_ira: { growthRate: 0.07, taxTreatment: 'pre_tax', liquidity: 'low', contributionLimit: 7_000 },
  brokerage: { growthRate: 0.08, taxTreatment: 'taxable', liquidity: 'high' },
  real_estate: { growthRate: 0.035, taxTreatment: 'none', liquidity: 'low' },
  car: { depreciationRate: 0.15, salvagePct: 0.10, taxTreatment: 'none', liquidity: 'low' },
  mortgage: { apr: 0.065, termMonths: 360, taxTreatment: 'none' },
  credit_card: { apr: 0.22, taxTreatment: 'none' },
  student_loan: { apr: 0.055, termMonths: 120, taxTreatment: 'none' },
  health: { taxTreatment: 'none' },
  medicare: { taxTreatment: 'none' },
  life: { taxTreatment: 'none' },
  disability: { taxTreatment: 'none' },
  home: { taxTreatment: 'none' },
  auto: { taxTreatment: 'none' },
  rent: { taxTreatment: 'none' },
  food: { taxTreatment: 'none' },
  utilities: { taxTreatment: 'none' },
  entertainment: { taxTreatment: 'none' },
  other: { taxTreatment: 'none' },
  job_loss: {},
  market_crash: {},
  medical_emergency: {},
};
