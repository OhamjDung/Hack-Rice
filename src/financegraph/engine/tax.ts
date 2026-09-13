// Global tax engine — applied across the graph, not per node.
import type { FilingStatus, TaxTreatment } from '../types.ts';
import { FEDERAL_BRACKETS, STANDARD_DEDUCTION, LONG_TERM_CAPITAL_GAINS_RATE, RMD_DIVISORS } from '../data/taxBrackets.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Progressive marginal-bracket tax on annual taxable income.
export function progressiveTax(taxableIncome: number, filingStatus: FilingStatus): number {
  const brackets = FEDERAL_BRACKETS[filingStatus];
  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= lower) break;
    const upTo = Math.min(taxableIncome, bracket.upTo);
    tax += (upTo - lower) * bracket.rate;
    lower = bracket.upTo;
    if (taxableIncome <= bracket.upTo) break;
  }
  return round2(tax);
}

// pre_tax contributions (401k, traditional IRA) reduce taxable income for the year.
export function taxableIncomeAfterPreTax(annualGross: number, preTaxContributions: number, filingStatus: FilingStatus): number {
  return Math.max(0, annualGross - preTaxContributions - STANDARD_DEDUCTION[filingStatus]);
}

export function annualNetIncome(annualGross: number, preTaxContributions: number, filingStatus: FilingStatus): number {
  const taxable = taxableIncomeAfterPreTax(annualGross, preTaxContributions, filingStatus);
  const tax = progressiveTax(taxable, filingStatus);
  return round2(annualGross - preTaxContributions - tax);
}

// Withdrawal taxation per account taxTreatment — this is where 401k-vs-Roth actually lives.
export function taxOnWithdrawal(amount: number, taxTreatment: TaxTreatment, filingStatus: FilingStatus, otherTaxableIncomeThisYear: number): number {
  if (taxTreatment === 'post_tax' || taxTreatment === 'none') return 0; // Roth: already taxed going in
  if (taxTreatment === 'taxable') return round2(amount * LONG_TERM_CAPITAL_GAINS_RATE); // brokerage gains
  // pre_tax (traditional 401k/IRA): taxed as ordinary income, stacked on top of other income
  const before = progressiveTax(otherTaxableIncomeThisYear, filingStatus);
  const after = progressiveTax(otherTaxableIncomeThisYear + amount, filingStatus);
  return round2(after - before);
}

// Required Minimum Distribution — simplified IRS Uniform Lifetime Table approximation.
export function requiredMinimumDistribution(balance: number, age: number): number {
  if (age < 73) return 0;
  const divisor = RMD_DIVISORS[Math.min(age, 100)] ?? RMD_DIVISORS[100];
  return round2(balance / divisor);
}
