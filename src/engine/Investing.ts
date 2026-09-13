import { z } from 'zod';
import type { GameState } from './Types.ts';
import { TAX, ACCOUNT_RULES } from './Constants.ts';
import { monthOfRun } from './DailyReview.ts';
const round = (n: number) => Math.round(n * 100) / 100;
export const allocationFieldsSchema = z.object({ k401: z.number().min(0), tradIra: z.number().min(0), roth: z.number().min(0), brokerage: z.number().min(0) });
export type AllocationFields = z.infer<typeof allocationFieldsSchema>;
export const investingSchema = z.object({
    accounts: z.object({ k401: z.number().min(0), tradIra: z.number().min(0), roth: z.number().min(0), rothBasis: z.number().min(0) }),
    brokerage: z.object({ cash: z.number().min(0), holdings: z.record(z.string(), z.number()), cost: z.record(z.string(), z.number()) }),
    stats: z.object({ match: z.number().min(0), taxSaved: z.number().min(0), contributed: z.number().min(0), tradingPnl: z.number().finite() }),
    lastAlloc: allocationFieldsSchema,
    today: z.object({ turn: z.number().int().positive(), alloc: allocationFieldsSchema }).nullable(),
    // Tracks contributions made within the current game-month so limits reset monthly instead of yearly (INVEST.md §3).
    monthToDate: z.object({ month: z.number().int().min(0), k401: z.number().min(0), tradIra: z.number().min(0), roth: z.number().min(0) }),
});
export type Investing = z.infer<typeof investingSchema>;
export const INITIAL_INVESTING: Investing = { accounts: { k401: 0, tradIra: 0, roth: 0, rothBasis: 0 }, brokerage: { cash: 0, holdings: {}, cost: {} }, stats: { match: 0, taxSaved: 0, contributed: 0, tradingPnl: 0 }, lastAlloc: { k401: 0, tradIra: 0, roth: 0, brokerage: 0 }, today: null, monthToDate: { month: 0, k401: 0, tradIra: 0, roth: 0 } };

function federalIncomeTax(taxable: number): number {
    let tax = 0, lower = 0;
    for (const [top, rate] of TAX.brackets) { if (taxable <= lower) break; tax += (Math.min(taxable, top) - lower) * rate; lower = top; }
    return tax;
}
// gross/pretax are annualized figures (profile.income has no separate "gross salary" concept — see INVEST.md §6).
export function taxesFor(gross: number, pretax: number) {
    const taxable = Math.max(0, gross - pretax - TAX.standardDeduction);
    const federal = federalIncomeTax(taxable);
    const state = taxable * TAX.stateRate;
    const fica = Math.min(gross, TAX.socialSecurityWageBase) * TAX.socialSecurityRate + gross * TAX.medicareRate;
    return { taxable: round(taxable), federal: round(federal), state: round(state), fica: round(fica), total: round(federal + state + fica) };
}
export function contributionLimits() { return { k401: ACCOUNT_RULES.k401Limit, ira: ACCOUNT_RULES.iraLimit }; }
export function employerMatch(salary: number, k401: number): number { return round(Math.min(k401, salary * ACCOUNT_RULES.matchCapPct) * ACCOUNT_RULES.matchRate); }

export function currentMonthToDate(state: GameState) {
    const month = monthOfRun(state.metrics.turn), m = state.investing.monthToDate;
    return m.month === month ? m : { month, k401: 0, tradIra: 0, roth: 0 };
}
export interface PlanContext { salary: number; available: number; monthToDate: { k401: number; tradIra: number; roth: number } }
export interface PlanResult { alloc: AllocationFields; limits: { k401: number; ira: number }; contributed: number; taxSaved: number; match: number; cashNeeded: number; remaining: number; errors: string[]; ok: boolean }
function cleanAllocation(alloc: Partial<AllocationFields>): AllocationFields {
    const clean = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? round(n) : 0; };
    return { k401: clean(alloc.k401), tradIra: clean(alloc.tradIra), roth: clean(alloc.roth), brokerage: clean(alloc.brokerage) };
}
// What today's allocation really costs: pre-tax contributions are partly paid for by the income tax they remove.
export function planAllocation(ctx: PlanContext, alloc: Partial<AllocationFields>): PlanResult {
    const a = cleanAllocation(alloc), limits = contributionLimits(), errors: string[] = [], m = ctx.monthToDate;
    const k401Total = m.k401 + a.k401, iraTotal = m.tradIra + a.tradIra + m.roth + a.roth, pretaxBefore = m.k401 + m.tradIra, pretaxAfter = pretaxBefore + a.k401 + a.tradIra;
    if (k401Total > limits.k401) errors.push(`The 401(k) limit this month is $${limits.k401.toLocaleString()}.`);
    if (pretaxAfter > ctx.salary) errors.push("Pre-tax contributions can't exceed your yearly pay.");
    if (iraTotal > limits.ira) errors.push(`Traditional + Roth IRA share a $${limits.ira.toLocaleString()} limit this month.`);
    // Tax break and match are measured against what was already contributed this month, so splitting one
    // contribution across several visits can't earn more than making it all at once.
    const taxSaved = round(taxesFor(ctx.salary, pretaxBefore).total - taxesFor(ctx.salary, pretaxAfter).total);
    const match = round(employerMatch(ctx.salary, k401Total) - employerMatch(ctx.salary, m.k401));
    const contributed = round(a.k401 + a.tradIra + a.roth + a.brokerage);
    const cashNeeded = round(contributed - taxSaved);
    if (cashNeeded > ctx.available + 0.005) errors.push(`That costs $${cashNeeded.toLocaleString()}, but you only have $${Math.max(0, ctx.available).toLocaleString()}.`);
    return { alloc: a, limits, contributed, taxSaved, match, cashNeeded, remaining: round(ctx.available - cashNeeded), errors, ok: errors.length === 0 };
}
// Largest whole-dollar value for one field (others unchanged) that stays within limits and budget.
export function maxAllocation(ctx: PlanContext, alloc: AllocationFields, field: keyof AllocationFields, cap = Infinity): number {
    const base = cleanAllocation(alloc), limits = contributionLimits();
    let hi = Math.min(cap, ctx.available + ctx.salary);
    const pretaxUsed = ctx.monthToDate.k401 + ctx.monthToDate.tradIra;
    if (field === 'k401') hi = Math.min(hi, limits.k401 - ctx.monthToDate.k401, ctx.salary - pretaxUsed - base.tradIra);
    if (field === 'tradIra') hi = Math.min(hi, limits.ira - ctx.monthToDate.tradIra - ctx.monthToDate.roth - base.roth, ctx.salary - pretaxUsed - base.k401);
    if (field === 'roth') hi = Math.min(hi, limits.ira - ctx.monthToDate.tradIra - ctx.monthToDate.roth - base.tradIra);
    hi = Math.max(0, Math.floor(hi));
    const fits = (v: number) => planAllocation(ctx, { ...base, [field]: v }).ok;
    if (fits(hi)) return hi;
    if (!fits(0)) return 0;
    let lo = 0;
    while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid; }
    return lo;
}

export function investGateReason(state: GameState): string | null {
    if (state.isGameOver) return null;
    if (state.mode !== 'nessie') return null;
    return state.transactionUpdateTurns?.includes(state.metrics.turn) ? null : "Update today's transactions first";
}
export function canInvest(state: GameState): boolean { return !state.isGameOver && investGateReason(state) === null; }

// Commits a visit's allocation for real: deducts the real cash cost from cashBalance, credits each account.
export function commitAllocation(state: GameState, alloc: Partial<AllocationFields>): GameState {
    if (!canInvest(state)) return state;
    const salary = state.profile.income * 12, monthToDate = currentMonthToDate(state);
    const plan = planAllocation({ salary, available: state.metrics.cashBalance, monthToDate }, alloc);
    if (!plan.ok) return state;
    const s = structuredClone(state);
    s.metrics.cashBalance = round(s.metrics.cashBalance - plan.cashNeeded);
    s.metrics.debtBalance = Math.max(0, -s.metrics.cashBalance);
    s.investing.accounts.k401 = round(s.investing.accounts.k401 + plan.alloc.k401 + plan.match);
    s.investing.accounts.tradIra = round(s.investing.accounts.tradIra + plan.alloc.tradIra);
    s.investing.accounts.roth = round(s.investing.accounts.roth + plan.alloc.roth);
    s.investing.accounts.rothBasis = round(s.investing.accounts.rothBasis + plan.alloc.roth);
    s.investing.brokerage.cash = round(s.investing.brokerage.cash + plan.alloc.brokerage);
    s.investing.stats.match = round(s.investing.stats.match + plan.match);
    s.investing.stats.taxSaved = round(s.investing.stats.taxSaved + plan.taxSaved);
    s.investing.stats.contributed = round(s.investing.stats.contributed + plan.contributed);
    s.investing.lastAlloc = plan.alloc;
    s.investing.monthToDate = { month: monthToDate.month, k401: round(monthToDate.k401 + plan.alloc.k401), tradIra: round(monthToDate.tradIra + plan.alloc.tradIra), roth: round(monthToDate.roth + plan.alloc.roth) };
    const earlier = s.investing.today?.turn === s.metrics.turn ? s.investing.today.alloc : { k401: 0, tradIra: 0, roth: 0, brokerage: 0 };
    s.investing.today = { turn: s.metrics.turn, alloc: { k401: round(earlier.k401 + plan.alloc.k401), tradIra: round(earlier.tradIra + plan.alloc.tradIra), roth: round(earlier.roth + plan.alloc.roth), brokerage: round(earlier.brokerage + plan.alloc.brokerage) } };
    return s;
}
// A trading-floor session's leftover position is sold to cash the moment the session ends — nothing here tracks a live market between visits.
export function settleBrokerage(state: GameState, finalCash: number, sessionPnl: number): GameState {
    if (state.isGameOver) return state;
    const s = structuredClone(state);
    s.investing.brokerage = { cash: round(finalCash), holdings: {}, cost: {} };
    s.investing.stats.tradingPnl = round(s.investing.stats.tradingPnl + sessionPnl);
    return s;
}

// Retirement balances aren't hand-traded; they grow once a month off a random draw (mean 7%/yr, realistic spread),
// prorated to a monthly rate so a year's worth of expected growth isn't applied every month. See INVEST.md §5.
const MARKET_ASSUMPTION = { meanReturn: 0.07, stdev: 0.16 };
function randomNormal(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function drawMonthlyRetirementReturn(): number {
    const annual = Math.max(-0.45, Math.min(0.5, MARKET_ASSUMPTION.meanReturn + MARKET_ASSUMPTION.stdev * randomNormal()));
    return Math.pow(1 + annual, 1 / 12) - 1;
}
export function growAccounts(accounts: Investing['accounts'], rate = drawMonthlyRetirementReturn()): Investing['accounts'] {
    return { ...accounts, k401: round(accounts.k401 * (1 + rate)), tradIra: round(accounts.tradIra * (1 + rate)), roth: round(accounts.roth * (1 + rate)) };
}

// Deterministic "if you kept this up" estimate — average-return compounding, not a randomized outcome. INVEST.md §6.
export const PROJECTION_HORIZONS = [1, 5, 10, 20, 30] as const;
export const PAY_FREQUENCIES = { weekly: 52, biweekly: 26, semiMonthly: 24, monthly: 12 } as const;
export type PayFrequency = keyof typeof PAY_FREQUENCIES;
export function projectAccount(currentBalance: number, contributionPerPeriod: number, periodsPerYear: number, years: number): number {
    const r = Math.pow(1 + 0.07, 1 / periodsPerYear) - 1, n = years * periodsPerYear;
    const growthOfCurrentBalance = currentBalance * Math.pow(1.07, years);
    const growthOfContributions = r === 0 ? contributionPerPeriod * n : contributionPerPeriod * ((Math.pow(1 + r, n) - 1) / r);
    return round(growthOfCurrentBalance + growthOfContributions);
}
export function projectRetirement(state: GameState, frequency: PayFrequency) {
    const periodsPerYear = PAY_FREQUENCIES[frequency], alloc = state.investing.today?.alloc;
    // Today's amounts repeat every pay period; the match uses that period's share of yearly salary.
    const perPeriodSalary = state.profile.income * 12 / periodsPerYear;
    const k401Contribution = (alloc?.k401 ?? 0) + employerMatch(perPeriodSalary, alloc?.k401 ?? 0);
    const tradIraContribution = alloc?.tradIra ?? 0, rothContribution = alloc?.roth ?? 0;
    const rows = { k401: PROJECTION_HORIZONS.map(t => projectAccount(state.investing.accounts.k401, k401Contribution, periodsPerYear, t)), tradIra: PROJECTION_HORIZONS.map(t => projectAccount(state.investing.accounts.tradIra, tradIraContribution, periodsPerYear, t)), roth: PROJECTION_HORIZONS.map(t => projectAccount(state.investing.accounts.roth, rothContribution, periodsPerYear, t)) };
    const total = PROJECTION_HORIZONS.map((_, i) => round(rows.k401[i] + rows.tradIra[i] + rows.roth[i]));
    return { rows, total, brokerageToday: round(state.investing.brokerage.cash) };
}
