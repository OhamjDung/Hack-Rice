// Standard amortization — mortgage, student loan. Pure, no I/O.
const round2 = (n: number) => Math.round(n * 100) / 100;

// M = P * [r(1+r)^n] / [(1+r)^n - 1]
export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  const r = annualRate / 12;
  if (r === 0) return round2(principal / termMonths);
  const factor = Math.pow(1 + r, termMonths);
  return round2((principal * r * factor) / (factor - 1));
}

export interface AmortizationStepResult {
  remainingPrincipal: number;
  interestPaid: number;
  principalPaid: number;
  paidOff: boolean;
}

// One period of principal/interest split given a fixed payment.
export function stepAmortization(remainingPrincipal: number, annualRate: number, payment: number): AmortizationStepResult {
  if (remainingPrincipal <= 0) return { remainingPrincipal: 0, interestPaid: 0, principalPaid: 0, paidOff: true };
  const interest = round2(remainingPrincipal * (annualRate / 12));
  const principalPortion = Math.min(remainingPrincipal, Math.max(0, payment - interest));
  const remaining = round2(Math.max(0, remainingPrincipal - principalPortion));
  return {
    remainingPrincipal: remaining,
    interestPaid: interest,
    principalPaid: round2(principalPortion),
    paidOff: remaining <= 0,
  };
}

// Full schedule, for validation against known amortization tables/calculators. The final
// period pays off the exact remaining balance rather than the fixed payment, so rounding
// drift across the term never leaves a trailing balance.
export function amortizationSchedule(principal: number, annualRate: number, termMonths: number): AmortizationStepResult[] {
  const payment = monthlyPayment(principal, annualRate, termMonths);
  const schedule: AmortizationStepResult[] = [];
  let remaining = principal;
  for (let i = 0; i < termMonths && remaining > 0; i++) {
    const isLastPeriod = i === termMonths - 1;
    const interest = round2(remaining * (annualRate / 12));
    const thisPayment = isLastPeriod ? remaining + interest : payment;
    const step = stepAmortization(remaining, annualRate, thisPayment);
    schedule.push(step);
    remaining = step.remainingPrincipal;
  }
  return schedule;
}
