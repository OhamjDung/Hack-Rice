/* Pure money math for Nest Egg career mode (taxes, account limits, employer
   match, allocation cost, retirement payout). No DOM access. */
const roundMoney = n => Math.round(n * 100) / 100;
const roundTo = (n, step) => Math.round(n / step) * step;
const fmtMoney = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

function inflationFactor(yearIndex) { return Math.pow(1 + CAREER.inflation, yearIndex); }

function taxTables(yearIndex) {
  const f = inflationFactor(yearIndex);
  return {
    standardDeduction: roundTo(TAX.standardDeduction * f, 50),
    brackets: TAX.brackets.map(([top, rate]) => [top === Infinity ? Infinity : roundTo(top * f, 25), rate]),
    socialSecurityWageBase: roundTo(TAX.socialSecurityWageBase * f, 300),
  };
}

function federalIncomeTax(taxable, tables) {
  let tax = 0, lower = 0;
  for (const [top, rate] of tables.brackets) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, top) - lower) * rate;
    lower = top;
  }
  return tax;
}

function marginalRate(taxable, tables) {
  for (const [top, rate] of tables.brackets) if (taxable < top) return rate;
  return tables.brackets[tables.brackets.length - 1][1];
}

// `pretax` = traditional 401(k) + traditional IRA contributions: they lower
// income tax (federal + state) but not Social Security/Medicare.
function taxesFor(gross, pretax, yearIndex) {
  const t = taxTables(yearIndex);
  const taxable = Math.max(0, gross - pretax - t.standardDeduction);
  const federal = federalIncomeTax(taxable, t);
  const state = taxable * TAX.stateRate;
  const fica = Math.min(gross, t.socialSecurityWageBase) * TAX.socialSecurityRate + gross * TAX.medicareRate;
  return {
    taxable: roundMoney(taxable),
    standardDeduction: t.standardDeduction,
    federal: roundMoney(federal),
    state: roundMoney(state),
    fica: roundMoney(fica),
    total: roundMoney(federal + state + fica),
    marginal: marginalRate(taxable, t),
  };
}

function contributionLimits(age, yearIndex) {
  const f = inflationFactor(yearIndex);
  const catchUp = age >= ACCOUNT_RULES.catchUpAge;
  return {
    k401: roundTo(ACCOUNT_RULES.k401Limit * f, 500) + (catchUp ? roundTo(ACCOUNT_RULES.k401CatchUp * f, 500) : 0),
    ira: roundTo(ACCOUNT_RULES.iraLimit * f, 500) + (catchUp ? roundTo(ACCOUNT_RULES.iraCatchUp * f, 100) : 0),
  };
}

function employerMatch(salary, k401) {
  return roundMoney(Math.min(k401, salary * ACCOUNT_RULES.matchCapPct) * ACCOUNT_RULES.matchRate);
}

const ALLOC_FIELDS = ['k401', 'tradIra', 'roth', 'brokerage'];

function cleanAllocation(alloc) {
  const a = {};
  ALLOC_FIELDS.forEach(k => { const v = Number(alloc && alloc[k]); a[k] = Number.isFinite(v) && v > 0 ? roundMoney(v) : 0; });
  return a;
}

// What an allocation really costs. Pre-tax contributions are partly paid for
// by the income tax they remove, so $1,000 into a 401(k) costs less than $1,000.
// ctx = { gross, salary, age, yearIndex, available }
function planAllocation(ctx, alloc) {
  const a = cleanAllocation(alloc);
  const limits = contributionLimits(ctx.age, ctx.yearIndex);
  const errors = [];
  if (a.k401 > limits.k401) errors.push(`The 401(k) limit this year is ${fmtMoney(limits.k401)}.`);
  if (a.k401 + a.tradIra > ctx.gross) errors.push('Pre-tax contributions can\'t exceed your pay.');
  if (a.tradIra + a.roth > limits.ira) errors.push(`Traditional + Roth IRA share a ${fmtMoney(limits.ira)} limit this year.`);
  const taxSaved = roundMoney(taxesFor(ctx.gross, 0, ctx.yearIndex).total - taxesFor(ctx.gross, a.k401 + a.tradIra, ctx.yearIndex).total);
  const contributed = roundMoney(a.k401 + a.tradIra + a.roth + a.brokerage);
  const cashNeeded = roundMoney(contributed - taxSaved);
  if (cashNeeded > ctx.available + 0.005) errors.push(`That costs ${fmtMoney(cashNeeded)}, but you only have ${fmtMoney(ctx.available)}.`);
  return { alloc: a, limits, contributed, taxSaved, match: employerMatch(ctx.salary, a.k401), cashNeeded, remaining: roundMoney(ctx.available - cashNeeded), errors, ok: errors.length === 0 };
}

// Largest whole-dollar value for one field (others unchanged) that stays within limits and budget.
function maxAllocation(ctx, alloc, field, cap = Infinity) {
  const base = cleanAllocation(alloc);
  const limits = contributionLimits(ctx.age, ctx.yearIndex);
  let hi = Math.min(cap, ctx.available + ctx.gross);
  if (field === 'k401') hi = Math.min(hi, limits.k401, ctx.gross - base.tradIra);
  if (field === 'tradIra') hi = Math.min(hi, limits.ira - base.roth, ctx.gross - base.k401);
  if (field === 'roth') hi = Math.min(hi, limits.ira - base.tradIra);
  hi = Math.max(0, Math.floor(hi));
  const fits = v => planAllocation(ctx, { ...base, [field]: v }).ok;
  if (fits(hi)) return hi;
  if (!fits(0)) return 0;
  let lo = 0;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid; }
  return lo;
}

// What you keep when you cash everything out at `age`.
function retirementPayout(accounts, brokerageValue, age) {
  const early = age < CAREER.penaltyFreeAge;
  const rows = [];
  const add = (key, label, balance, tax, penalty, note) =>
    rows.push({ key, label, balance: roundMoney(balance), tax: roundMoney(tax), penalty: roundMoney(penalty), net: roundMoney(balance - tax - penalty), note });

  add('savings', 'Savings', accounts.savings, 0, 0, 'Already taxed.');
  const gains = Math.max(0, brokerageValue - accounts.brokerageBasis);
  add('brokerage', 'Brokerage (stocks)', brokerageValue, gains * TAX.capitalGainsRate, 0,
    gains > 0 ? `${Math.round(TAX.capitalGainsRate * 100)}% capital-gains tax on ${fmtMoney(gains)} of gains.` : 'No gains, no tax.');
  [['k401', '401(k)'], ['tradIra', 'Traditional IRA']].forEach(([key, label]) => {
    const b = accounts[key];
    add(key, label, b, b * TAX.retirementIncomeRate, early ? b * TAX.earlyPenaltyRate : 0,
      early ? 'Taxed as income, plus a 10% early-withdrawal penalty.' : 'Taxed as income when withdrawn.');
  });
  const rothEarnings = Math.max(0, accounts.roth - accounts.rothBasis);
  add('roth', 'Roth IRA', accounts.roth, early ? rothEarnings * TAX.retirementIncomeRate : 0, early ? rothEarnings * TAX.earlyPenaltyRate : 0,
    early ? 'Contributions come out free; earnings are taxed and penalized before 59½.' : 'Completely tax-free.');
  if (accounts.debt > 0) rows.push({ key: 'debt', label: 'Credit-card debt', balance: -roundMoney(accounts.debt), tax: 0, penalty: 0, net: -roundMoney(accounts.debt), note: 'Paid off first.' });

  const sum = k => roundMoney(rows.reduce((n, r) => n + r[k], 0));
  return { early, rows, gross: sum('balance'), taxes: sum('tax'), penalties: sum('penalty'), total: sum('net') };
}
