// Credit card revolving balance. Must visibly blow up under minimum payments — that's the lesson.
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface RevolvingStepResult { balance: number; interestAccrued: number; paidOff: boolean }

// balance = (balance - payment) * (1 + apr/12)
export function stepRevolvingBalance(balance: number, apr: number, payment: number): RevolvingStepResult {
  if (balance <= 0) return { balance: 0, interestAccrued: 0, paidOff: true };
  const afterPayment = Math.max(0, balance - payment);
  const interest = round2(afterPayment * (apr / 12));
  const next = round2(afterPayment + interest);
  return { balance: next, interestAccrued: interest, paidOff: next <= 0 };
}

// Minimum-payment-only payoff time and total interest — used to demonstrate the trap.
export function projectMinimumPaymentPayoff(balance: number, apr: number, minPaymentPct: number, maxMonths = 600): { months: number; totalInterest: number; neverPaidOff: boolean } {
  let bal = balance;
  let totalInterest = 0;
  for (let m = 1; m <= maxMonths; m++) {
    const payment = Math.max(bal * minPaymentPct, 25);
    const step = stepRevolvingBalance(bal, apr, payment);
    totalInterest = round2(totalInterest + step.interestAccrued);
    if (step.paidOff) return { months: m, totalInterest, neverPaidOff: false };
    if (step.balance >= bal) return { months: m, totalInterest, neverPaidOff: true }; // payment doesn't even cover interest
    bal = step.balance;
  }
  return { months: maxMonths, totalInterest, neverPaidOff: true };
}
