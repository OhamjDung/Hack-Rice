// 2024 federal tax brackets (simplified — no state tax, no standard-deduction nuance beyond
// a flat standard deduction). Versioned so future years are a new export, not an edit in place.
// Source shape matches IRS published brackets; treat as approximate/educational, not tax advice.
import type { FilingStatus } from '../types.ts';

export interface TaxBracket { upTo: number; rate: number } // upTo: Infinity for the top bracket

export const TAX_YEAR = 2024;

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 14_600,
  married_joint: 29_200,
};

export const FEDERAL_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { upTo: 11_600, rate: 0.10 },
    { upTo: 47_150, rate: 0.12 },
    { upTo: 100_525, rate: 0.22 },
    { upTo: 191_950, rate: 0.24 },
    { upTo: 243_725, rate: 0.32 },
    { upTo: 609_350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { upTo: 23_200, rate: 0.10 },
    { upTo: 94_300, rate: 0.12 },
    { upTo: 201_050, rate: 0.22 },
    { upTo: 383_900, rate: 0.24 },
    { upTo: 487_450, rate: 0.32 },
    { upTo: 731_200, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

export const LONG_TERM_CAPITAL_GAINS_RATE = 0.15; // flat simplification for v1

// Simplified IRS Uniform Lifetime Table (age -> divisor), ages 73-100.
// Approximation for RMD calc (Phase 4 retirement withdrawal) — not the full published table.
export const RMD_DIVISORS: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7,
  89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4,
  97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
};
