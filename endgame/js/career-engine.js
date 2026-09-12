/* Nest Egg career engine: the yearly loop as plain functions over a career
   object (mutated in place). No DOM. career.js renders it; tests/nestegg.test.mjs
   drives it in Node.

   One round = one year of work, played by hand — there is no skip-ahead:
     beginYear      phase 'paycheck'  salary, life event, taxes -> take-home
     payExpenses    phase 'expenses'  player-written monthly costs x 12
     investLeftover phase 'invest'    401(k) / Traditional IRA / Roth IRA / brokerage
     (trading)      phase 'trade'     optional real-data trading session on the brokerage account
     finishYear     phase 'review'    market year, interest, raise, age + 1
   retireCareer is allowed at 'paycheck' or 'review' and ends the run ('retired').

   The brokerage account only holds live positions while a trading session is
   open (see recordTradingSession) — between sessions it's just cash, since
   each session deals a fresh random 6 real stocks and there's no ongoing
   price for a stock that isn't in play. 401(k)/Traditional IRA/Roth IRA
   balances aren't hand-traded at all; they grow once a year off
   drawYearlyMarketReturn() in market.js, same as a broad index fund. */

function newCareer(name, jobId) {
  const job = JOBS.find(j => j.id === jobId) || JOBS[0];
  const c = {
    version: 2,
    name: String(name || '').trim().slice(0, 24) || 'Player',
    jobId: job.id,
    jobTitle: job.title,
    salary: job.salary,
    raise: job.raise,
    age: CAREER.startAge,
    year: 0,
    phase: 'paycheck',
    expenses: DEFAULT_EXPENSES.map(e => ({ ...e })),
    accounts: { savings: 0, debt: 0, k401: 0, tradIra: 0, roth: 0, rothBasis: 0, brokerageBasis: 0 },
    brokerage: { cash: 0, holdings: {}, cost: {} },
    lastAlloc: { k401: 0, tradIra: 0, roth: 0, brokerage: 0 },
    stats: { match: 0, taxSaved: 0, contributed: 0, tradingPnl: 0 },
    timeline: [{ age: CAREER.startAge, netWorth: 0 }],
    cur: null,
    payout: null,
  };
  beginYear(c);
  return c;
}

function expenseMinimum(c, e) { return e.essential ? roundTo(e.min * inflationFactor(c.year), 10) : 0; }
function monthlyExpenses(c) { return roundMoney(c.expenses.reduce((n, e) => n + (Number(e.monthly) || 0), 0)); }
// `market` is only ever non-null transiently, while a trading session is open — see recordTradingSession.
function brokerageValue(c, market) { return roundMoney(c.brokerage.cash + holdingsValue(market, c.brokerage.holdings)); }
function netWorth(c) {
  const a = c.accounts;
  return roundMoney(a.savings + brokerageValue(c) + a.k401 + a.tradIra + a.roth - a.debt);
}
function canRetire(c) { return c.phase === 'paycheck' || c.phase === 'review'; }

// `forcedEvent`: omit for a random life event, pass null for none (tests).
function beginYear(c, forcedEvent) {
  const event = forcedEvent !== undefined ? forcedEvent
    : Math.random() < LIFE_EVENT_CHANCE ? LIFE_EVENTS[Math.floor(Math.random() * LIFE_EVENTS.length)] : null;
  if (event && event.raisePct) c.salary = roundMoney(c.salary * (1 + event.raisePct));
  const gross = roundMoney(c.salary * (1 + ((event && event.salaryPct) || 0)));
  const taxes = taxesFor(gross, 0, c.year);
  const bumped = [];
  c.expenses.forEach(e => {
    const min = expenseMinimum(c, e);
    if (!(Number(e.monthly) >= min)) { e.monthly = min; bumped.push(e.label); }
  });
  c.cur = {
    event: event ? { text: event.text, cash: event.cash ? roundMoney(event.cash * inflationFactor(c.year)) : 0, salaryPct: event.salaryPct || 0, raisePct: event.raisePct || 0 } : null,
    gross,
    taxes,
    takeHome: roundMoney(gross - taxes.total),
    bumped,
    netWorthStart: netWorth(c),
    expensesPaid: 0,
    leftover: 0,
    shortfall: null,
    plan: null,
    tradeUsed: false,
    trade: null,
    review: null,
  };
  c.phase = 'paycheck';
}

function validateExpenses(c) {
  const errors = [];
  c.expenses.forEach(e => {
    const v = Number(e.monthly);
    if (!String(e.label || '').trim()) errors.push('Every expense needs a name.');
    else if (e.monthly === '' || !Number.isFinite(v) || v < 0) errors.push(`${e.label} needs an amount of $0 or more.`);
    else if (v < expenseMinimum(c, e)) errors.push(`${e.label} can't be less than ${fmtMoney(expenseMinimum(c, e))} a month.`);
  });
  return [...new Set(errors)];
}

function leftoverPreview(c) {
  return roundMoney(c.cur.takeHome - monthlyExpenses(c) * 12 + (c.cur.event ? c.cur.event.cash : 0));
}

// Pays a year of expenses. A shortfall comes out of savings, then brokerage
// cash, then goes on a credit card. Returns validation errors (empty = paid).
function payExpenses(c) {
  const errors = validateExpenses(c);
  if (errors.length) return errors;
  c.expenses.forEach(e => { e.monthly = roundMoney(Number(e.monthly)); e.label = String(e.label).trim().slice(0, 40); });
  const cur = c.cur;
  cur.expensesPaid = roundMoney(monthlyExpenses(c) * 12);
  const leftover = leftoverPreview(c);
  if (leftover < 0) {
    let need = -leftover;
    const fromSavings = roundMoney(Math.min(c.accounts.savings, need));
    c.accounts.savings = roundMoney(c.accounts.savings - fromSavings);
    need = roundMoney(need - fromSavings);
    const fromBrokerage = roundMoney(Math.min(c.brokerage.cash, need));
    c.brokerage.cash = roundMoney(c.brokerage.cash - fromBrokerage);
    c.accounts.brokerageBasis = roundMoney(Math.max(0, c.accounts.brokerageBasis - fromBrokerage));
    need = roundMoney(need - fromBrokerage);
    c.accounts.debt = roundMoney(c.accounts.debt + need);
    cur.shortfall = { total: -leftover, fromSavings, fromBrokerage, toDebt: need };
    cur.leftover = 0;
  } else {
    cur.leftover = leftover;
  }
  c.phase = 'invest';
  return [];
}

// Money you can invest this year: what's left of your pay plus existing savings.
function investContext(c) {
  return { gross: c.cur.gross, salary: c.salary, age: c.age, yearIndex: c.year, available: roundMoney(c.cur.leftover + c.accounts.savings) };
}

// Moves money into accounts. Whatever isn't invested pays down debt, then stays in savings.
function investLeftover(c, alloc) {
  const plan = planAllocation(investContext(c), alloc);
  if (!plan.ok) return plan;
  const a = plan.alloc, acc = c.accounts;
  acc.k401 = roundMoney(acc.k401 + a.k401 + plan.match);
  acc.tradIra = roundMoney(acc.tradIra + a.tradIra);
  acc.roth = roundMoney(acc.roth + a.roth);
  acc.rothBasis = roundMoney(acc.rothBasis + a.roth);
  c.brokerage.cash = roundMoney(c.brokerage.cash + a.brokerage);
  acc.brokerageBasis = roundMoney(acc.brokerageBasis + a.brokerage);
  const debtPaid = roundMoney(Math.min(acc.debt, plan.remaining));
  acc.debt = roundMoney(acc.debt - debtPaid);
  const savingsBefore = acc.savings;
  acc.savings = roundMoney(plan.remaining - debtPaid);
  c.stats.match = roundMoney(c.stats.match + plan.match);
  c.stats.taxSaved = roundMoney(c.stats.taxSaved + plan.taxSaved);
  c.stats.contributed = roundMoney(c.stats.contributed + plan.contributed);
  c.lastAlloc = { ...a };
  c.cur.plan = { ...plan, debtPaid, savingsChange: roundMoney(acc.savings - savingsBefore) };
  c.phase = 'trade';
  return plan;
}

// Ends the brokerage's live trading session: whatever's still held gets
// marked to its last traded price and folded into cash, since next year's
// session deals a completely different random 6 stocks.
function recordTradingSession(c, market, startValue, endValue) {
  const pnl = roundMoney(endValue - startValue);
  c.brokerage.cash = endValue;
  c.brokerage.holdings = {};
  c.brokerage.cost = {};
  c.cur.tradeUsed = true;
  c.cur.trade = { startValue: roundMoney(startValue), endValue: roundMoney(endValue), pnl };
  c.stats.tradingPnl = roundMoney(c.stats.tradingPnl + pnl);
}

function yearLesson(c, marketReturn) {
  const cur = c.cur, salary = c.salary;
  const fullMatch = employerMatch(salary, salary * ACCOUNT_RULES.matchCapPct);
  const missedMatch = cur.plan ? roundMoney(fullMatch - cur.plan.match) : 0;
  if (c.accounts.debt > 0) return `Credit-card debt grows ${Math.round(CAREER.debtApr * 100)}% a year. Paying it off beats any investment.`;
  if (missedMatch > 1) return `You left ${fmtMoney(missedMatch)} of free employer match on the table. Putting ${Math.round(ACCOUNT_RULES.matchCapPct * 100)}% of your salary in your 401(k) gets all of it.`;
  const yearExpenses = cur.expensesPaid || monthlyExpenses(c) * 12;
  if (yearExpenses > 0 && c.accounts.savings > yearExpenses * 1.5) return `You have ${fmtMoney(c.accounts.savings)} sitting in savings, more than a year and a half of expenses. A cushion is smart, but past that, cash earning ${(CAREER.savingsApy * 100).toFixed(1)}% falls behind the market. Consider investing more of it.`;
  if (marketReturn <= -0.1) return `The market fell ${Math.abs(marketReturn * 100).toFixed(0)}%. Your retirement accounts dipped, but next year's contributions buy shares on sale. Staying invested is how downturns get recovered.`;
  if (cur.trade && cur.trade.pnl < 0) return `Trading lost ${fmtMoney(-cur.trade.pnl)} this year. Most investors do better simply holding the whole market.`;
  if (marketReturn >= 0.15) return `A great year: the market rose ${(marketReturn * 100).toFixed(0)}%. The longer money stays invested, the more of your growth comes from growth itself.`;
  return 'At 7% a year, money doubles about every 10 years. Every year you stay invested gives compounding more time.';
}

// The rest of the year: retirement accounts grow with the market, savings earn
// interest, debt accrues, salary gets a raise, and you turn a year older.
function finishYear(c) {
  const cur = c.cur, acc = c.accounts;
  const retirementBefore = acc.k401 + acc.tradIra + acc.roth;
  const marketReturn = drawYearlyMarketReturn();
  ['k401', 'tradIra', 'roth'].forEach(k => { acc[k] = roundMoney(acc[k] * (1 + marketReturn)); });
  const interest = roundMoney(acc.savings * CAREER.savingsApy);
  acc.savings = roundMoney(acc.savings + interest);
  const debtInterest = roundMoney(acc.debt * CAREER.debtApr);
  acc.debt = roundMoney(acc.debt + debtInterest);
  const debtPaidFromSavings = roundMoney(Math.min(acc.savings, acc.debt));
  acc.savings = roundMoney(acc.savings - debtPaidFromSavings);
  acc.debt = roundMoney(acc.debt - debtPaidFromSavings);

  const lesson = yearLesson(c, marketReturn);
  c.age += 1;
  c.year += 1;
  c.salary = roundMoney(c.salary * (1 + c.raise));
  const nw = netWorth(c);
  c.timeline.push({ age: c.age, netWorth: nw });
  cur.review = {
    marketReturn,
    retirementGrowth: roundMoney(acc.k401 + acc.tradIra + acc.roth - retirementBefore),
    interest,
    debtInterest,
    debtPaidFromSavings,
    netWorthStart: cur.netWorthStart,
    netWorthEnd: nw,
    newSalary: c.salary,
    lesson,
  };
  c.phase = 'review';
}

// Last year's allocation, clamped to this year's limits and scaled down until affordable.
function suggestedAllocation(c) {
  const ctx = investContext(c);
  const limits = contributionLimits(c.age, c.year);
  const a = cleanAllocation(c.lastAlloc);
  a.k401 = Math.min(a.k401, limits.k401);
  a.tradIra = Math.min(a.tradIra, limits.ira);
  a.roth = Math.min(a.roth, limits.ira - a.tradIra);
  const scaled = f => { const s = {}; ALLOC_FIELDS.forEach(k => { s[k] = Math.floor(a[k] * f); }); return s; };
  if (planAllocation(ctx, a).ok) return a;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (planAllocation(ctx, scaled(mid)).ok) lo = mid; else hi = mid; }
  return scaled(lo);
}

function previewRetirement(c) {
  return retirementPayout(c.accounts, brokerageValue(c), c.age);
}

function retireCareer(c) {
  if (!canRetire(c)) return null;
  c.payout = previewRetirement(c);
  c.phase = 'retired';
  return c.payout;
}

// Inserts an entry into a leaderboard sorted by total kept. Rank counts entries
// that fell off the bottom, so an 11th-place finish reports 11.
function addToLeaderboard(board, entry, size = 10) {
  const all = [...board, entry].sort((a, b) => b.total - a.total);
  return { board: all.slice(0, size), rank: all.indexOf(entry) + 1 };
}
