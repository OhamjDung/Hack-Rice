/* Nest Egg career-mode data: jobs, expenses, tax tables, account rules and
   yearly life events. Plain data — edit/balance freely. Dollar figures are
   2026 values; finance.js / career-engine.js index them for inflation.
   Tax and account rules are deliberately simplified (single filer, flat
   state tax, no phase-outs) — this is a game, not tax advice. */

const CAREER = {
  startAge: 22,
  maxAge: 70,              // forced retirement
  penaltyFreeAge: 60,      // IRS rule is 59½; rounds are whole years
  inflation: 0.025,        // raises tax brackets, limits and expense minimums each year
  savingsApy: 0.035,       // high-yield savings account
  debtApr: 0.22,           // credit-card debt covers any shortfall
  tradingSessionSec: 90,
  tradingEventMinMs: 4000,
  tradingEventMaxMs: 9000,
  fastForwardYears: 5,
};

const JOBS = [
  { id: 'barista',  title: 'Barista',           salary: 34000, raise: 0.025, blurb: 'Tight budget. Every dollar has to work.' },
  { id: 'teacher',  title: 'Teacher',           salary: 52000, raise: 0.03,  blurb: 'Steady raises, modest paycheck.' },
  { id: 'nurse',    title: 'Registered Nurse',  salary: 78000, raise: 0.03,  blurb: 'Solid income with room to save.' },
  { id: 'engineer', title: 'Software Engineer', salary: 98000, raise: 0.04,  blurb: 'High income, and higher tax brackets.' },
];

// 2026 federal brackets, single filer: [top of bracket, rate].
const TAX = {
  standardDeduction: 16100,
  brackets: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184500,
  medicareRate: 0.0145,
  stateRate: 0.04,              // flat, on federal taxable income
  capitalGainsRate: 0.15,       // brokerage gains when you cash out
  retirementIncomeRate: 0.15,   // flat estimate on traditional 401(k)/IRA withdrawals
  earlyPenaltyRate: 0.10,       // withdrawing retirement money before 59½
};

const ACCOUNT_RULES = {
  k401Limit: 24500,
  k401CatchUp: 8000,
  iraLimit: 7500,               // shared by Traditional + Roth IRA
  iraCatchUp: 1100,
  catchUpAge: 50,
  matchRate: 0.5,               // employer adds 50 cents per $1 you put in...
  matchCapPct: 0.06,            // ...on up to 6% of your salary
};

// Monthly amounts. Essentials can't go below `min` (inflation-adjusted).
const DEFAULT_EXPENSES = [
  { id: 'rent',      label: 'Rent',              monthly: 1400, min: 900, essential: true },
  { id: 'food',      label: 'Groceries',         monthly: 450,  min: 250, essential: true },
  { id: 'transit',   label: 'Transportation',    monthly: 300,  min: 100, essential: true },
  { id: 'utilities', label: 'Utilities & phone', monthly: 220,  min: 120, essential: true },
  { id: 'health',    label: 'Health insurance',  monthly: 180,  min: 100, essential: true },
  { id: 'fun',       label: 'Dining & fun',      monthly: 250,  min: 0,   essential: false },
];

// One may happen at the start of a year. `cash` is after-tax (inflation-adjusted),
// `salaryPct` changes only this year's gross pay, `raisePct` is permanent.
const LIFE_EVENT_CHANCE = 0.5;
const LIFE_EVENTS = [
  { id: 'car',       text: 'Your car needed a new transmission.',                 cash: -1800 },
  { id: 'dentist',   text: 'Surprise dental work. Insurance covered only part.',  cash: -900 },
  { id: 'phone',     text: 'You cracked your phone beyond repair.',               cash: -700 },
  { id: 'wedding',   text: 'Your best friend got married across the country.',    cash: -1100 },
  { id: 'vet',       text: 'Your dog swallowed a sock. Vet bill.',                cash: -1300 },
  { id: 'bonus',     text: 'Great year at work: you earned a bonus.',             salaryPct: 0.06 },
  { id: 'gift',      text: 'A relative sent a birthday check.',                   cash: 500 },
  { id: 'promotion', text: 'You were promoted! Your salary jumps for good.',      raisePct: 0.10 },
  { id: 'hours',     text: 'Your hours were cut for part of the year.',           salaryPct: -0.08 },
];
