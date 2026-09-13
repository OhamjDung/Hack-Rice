// Asset depreciation. Real estate appreciates via growth.ts; this file is the car curve
// (non-linear: ~20% year 1, ~15%/yr after, floored at a salvage % of original value).
const round2 = (n: number) => Math.round(n * 100) / 100;

const YEAR_ONE_RATE = 0.20;
const SUBSEQUENT_RATE = 0.15;
const DEFAULT_SALVAGE_PCT = 0.10;

export function stepCarDepreciation(originalValue: number, currentValue: number, monthsOwned: number, salvagePct: number = DEFAULT_SALVAGE_PCT): number {
  const floor = originalValue * salvagePct;
  if (currentValue <= floor) return round2(floor);
  const annualRate = monthsOwned < 12 ? YEAR_ONE_RATE : SUBSEQUENT_RATE;
  const monthlyRate = 1 - Math.pow(1 - annualRate, 1 / 12);
  return round2(Math.max(floor, currentValue * (1 - monthlyRate)));
}

// Straight appreciation for real_estate (annual rate, monthly compounding) — kept here
// alongside depreciation since both drive asset.currentValue and share the same shape.
export function stepAppreciation(currentValue: number, annualGrowthRate: number): number {
  return round2(currentValue * (1 + annualGrowthRate / 12));
}
