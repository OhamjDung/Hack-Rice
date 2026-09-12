// Engine tests for endgame/. The game uses plain <script> globals, so each test
// loads the same files into a fresh vm context, in page order.
// Run: node --test endgame/tests/nestegg.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILES = ['data/real-stocks.js', 'data/life.js', 'js/finance.js', 'js/market.js', 'js/career-engine.js'];
const root = new URL('../', import.meta.url);

function load({ random } = {}) {
  const ctx = vm.createContext({ console });
  for (const f of FILES) vm.runInContext(readFileSync(new URL(f, root), 'utf8'), ctx, { filename: f });
  if (random) { ctx.__random = random; vm.runInContext('Math.random = () => __random()', ctx); }
  return code => vm.runInContext(code, ctx);
}

// ---------- taxes / accounts / retirement payout (unaffected by the market rework) ----------

test('2026 taxes for a $34k barista', () => {
  const run = load();
  const t = run('taxesFor(34000, 0, 0)');
  assert.equal(t.taxable, 17900);          // 34,000 - 16,100 standard deduction
  assert.equal(t.federal, 1900);           // 10% of 12,400 + 12% of 5,500
  assert.equal(t.state, 716);
  assert.equal(t.fica, 2601);              // 7.65%
  assert.equal(t.total, 5217);
  assert.equal(t.marginal, 0.12);
});

test('pre-tax contributions cut income tax but not FICA', () => {
  const run = load();
  const base = run('taxesFor(98000, 0, 0)');
  const pre = run('taxesFor(98000, 10000, 0)');
  assert.ok(pre.federal < base.federal);
  assert.equal(pre.fica, base.fica);
  assert.equal(Math.round(base.total - pre.total), 2600); // 22% federal + 4% state on $10k
});

test('limits, catch-up and employer match', () => {
  const run = load();
  assert.deepEqual({ ...run('contributionLimits(22, 0)') }, { k401: 24500, ira: 7500 });
  assert.deepEqual({ ...run('contributionLimits(50, 0)') }, { k401: 32500, ira: 8600 });
  assert.equal(run('employerMatch(50000, 10000)'), 1500); // capped at 6% of salary
  assert.equal(run('employerMatch(50000, 1000)'), 500);
});

test('allocation plan: pre-tax costs less, limits and budget are enforced', () => {
  const run = load();
  run('var ctx = { gross: 98000, salary: 98000, age: 30, yearIndex: 0, available: 20000 }');
  const pre = run('planAllocation(ctx, { k401: 10000 })');
  assert.ok(pre.ok);
  assert.ok(pre.cashNeeded < 10000 && pre.taxSaved > 0);
  assert.equal(pre.match, 2940);
  assert.ok(!run('planAllocation(ctx, { k401: 30000 })').ok);
  assert.ok(!run('planAllocation(ctx, { tradIra: 5000, roth: 5000 })').ok);
  assert.ok(!run('planAllocation(ctx, { brokerage: 25000 })').ok);
  const max = run('maxAllocation(ctx, { roth: 7500 }, "brokerage")');
  assert.equal(max, 12500);
});

test('retirement payout: early penalty before 60, Roth tax-free after', () => {
  const run = load();
  run('var acc = { savings: 1000, debt: 0, k401: 100000, tradIra: 0, roth: 50000, rothBasis: 20000, brokerageBasis: 10000 }');
  const early = run('retirementPayout(acc, 15000, 45)');
  const late = run('retirementPayout(acc, 15000, 60)');
  assert.ok(early.early && !late.early);
  assert.equal(early.penalties, 10000 + 3000);            // 10% of 401k + 10% of Roth earnings
  assert.equal(late.penalties, 0);
  assert.equal(late.rows.find(r => r.key === 'roth').net, 50000);
  assert.equal(late.rows.find(r => r.key === 'brokerage').tax, 750); // 15% of $5k gain
  assert.ok(late.total > early.total);
});

// ---------- real-data market (market.js) ----------

test('real-stocks pool has enough real, well-formed history to deal from', () => {
  const run = load();
  const n = run('REAL_STOCKS.length');
  assert.ok(n >= 6, `expected a real pool, got ${n}`);
  assert.ok(run('REAL_STOCKS.every(s => Array.isArray(s.prices) && s.prices.length >= 100 && s.prices.every(p => typeof p === "number" && p > 0))'));
});

test('a session deals exactly 6 distinct real stocks and starts at their real opening price', () => {
  const run = load();
  run('var m = createMarket()');
  assert.equal(run('m.stocks.length'), 6);
  assert.equal(run('new Set(m.stocks.map(s => s.id)).size'), 6);
  assert.ok(run('m.stocks.every(s => { const real = REAL_STOCKS.find(r => r.id === s.id); return s.price === real.prices[0] && s.prices === real.prices; })'));
});

test('stepMarket replays real recorded prices exactly, one bar per tick', () => {
  const run = load();
  run('var m = createMarket(); var s0 = m.stocks[0]; var real = s0.prices;');
  run('stepMarket(m); stepMarket(m); stepMarket(m);');
  assert.equal(run('m.stocks[0].price'), run('real[3]'));
  assert.equal(run('m.stocks[0].idx'), 3);
  assert.equal(run('m.stocks[0].history.length'), 4); // seed point + 3 steps
  assert.equal(run('m.stocks[0].history[3].price'), run('real[3]'));
});

test('the market holds its last real price once a stock runs out of history, and reports finished', () => {
  const run = load();
  run('var m = createMarket(); var bars = m.barCount;');
  run('for (let i = 0; i < bars - 1; i++) stepMarket(m);');
  assert.equal(run('marketFinished(m)'), true);
  const lastPrices = run('m.stocks.map(s => s.prices[s.prices.length - 1])');
  assert.deepEqual(run('m.stocks.map(s => s.price)'), lastPrices);
  run('stepMarket(m);'); // stepping past the end just holds
  assert.deepEqual(run('m.stocks.map(s => s.price)'), lastPrices);
});

test('session duration matches the real history length (1 tick = REAL_TICK_MS)', () => {
  const run = load();
  run('var m = createMarket();');
  assert.equal(run('sessionDurationMs(m)'), run('m.barCount * REAL_TICK_MS'));
});

test('drawYearlyMarketReturn stays within its clamped bounds', () => {
  const run = load({ random: () => 0.999999 });
  const hi = run('drawYearlyMarketReturn()');
  assert.ok(hi <= 0.5);
  const lo = load({ random: () => 0.000001 })('drawYearlyMarketReturn()');
  assert.ok(lo >= -0.45);
});

// ---------- career loop (career-engine.js) ----------

test('a full year: paycheck -> expenses -> invest -> year end (no market needed outside a session)', () => {
  const run = load();
  run('var c = newCareer("Sam", "engineer"); beginYear(c, null);');
  assert.equal(run('c.phase'), 'paycheck');
  assert.deepEqual([...run('payExpenses(c)')], []);
  assert.equal(run('c.phase'), 'invest');
  const leftover = run('c.cur.leftover');
  assert.ok(leftover > 30000, `engineer should have room to save, got ${leftover}`);
  const plan = run('investLeftover(c, { k401: 5880, roth: 7500, brokerage: 5000 })');
  assert.ok(plan.ok, plan.errors.join(' '));
  assert.equal(run('c.accounts.k401'), 5880 + 2940);
  assert.equal(run('c.accounts.rothBasis'), 7500);
  assert.equal(run('c.brokerage.cash'), 5000);
  assert.equal(run('c.phase'), 'trade');
  run('finishYear(c)');
  assert.equal(run('c.phase'), 'review');
  assert.equal(run('c.age'), 23);
  assert.equal(run('c.timeline.length'), 2);
  assert.equal(run('c.timeline[1].netWorth'), run('netWorth(c)'));
  assert.ok(run('c.cur.review.lesson').length > 10);
  assert.equal(typeof run('c.cur.review.marketReturn'), 'number');
});

test('trading session cashes out into the brokerage: holdings never survive past the session', () => {
  const run = load();
  run('var c = newCareer("Robin", "nurse"); beginYear(c, null); payExpenses(c); investLeftover(c, { brokerage: 4000 });');
  run('var m = createMarket(); var startValue = c.brokerage.cash;');
  run('m.stocks[0].price = 50; c.brokerage.holdings[m.stocks[0].id] = 10; c.brokerage.cost[m.stocks[0].id] = 400;');
  run('var endValue = 4000 - 400 + 10 * m.stocks[0].price;'); // cash left + current value of the position
  run('recordTradingSession(c, m, startValue, endValue)');
  assert.equal(run('c.brokerage.cash'), run('endValue'));
  // spread into a plain object first: the vm context is a separate realm, so an
  // object handed back from it has a different Object.prototype than {} here.
  assert.deepEqual({ ...run('c.brokerage.holdings') }, {});
  assert.deepEqual({ ...run('c.brokerage.cost') }, {});
  assert.equal(run('c.cur.trade.pnl'), run('Math.round((endValue - startValue) * 100) / 100'));
  assert.equal(run('c.stats.tradingPnl'), run('c.cur.trade.pnl'));
});

test('essential minimums are enforced and a shortfall becomes debt', () => {
  const run = load();
  run('var c = newCareer("Jo", "barista"); beginYear(c, null);');
  run('c.expenses[0].monthly = 100');
  assert.ok(run('validateExpenses(c)').some(e => e.includes('Rent')));
  run('c.expenses[0].monthly = 3000');                  // way more than a barista takes home
  assert.deepEqual([...run('payExpenses(c)')], []);
  assert.ok(run('c.cur.shortfall.toDebt') > 0);
  assert.equal(run('c.accounts.debt'), run('c.cur.shortfall.toDebt'));
  assert.equal(run('c.cur.leftover'), 0);
});

test('a whole career to forced retirement at 70, played year by year (no skip-ahead exists)', () => {
  const run = load();
  run('var c = newCareer("Ana", "nurse"); payExpenses(c); investLeftover(c, { k401: 4680, roth: 7500 }); finishYear(c);');
  let years = 1;
  while (run('c.age') < 70) {
    run('beginYear(c, null); payExpenses(c); investLeftover(c, suggestedAllocation(c)); finishYear(c);');
    years++;
  }
  assert.equal(run('c.age'), 70);
  assert.equal(years, 70 - run('CAREER.startAge')); // 48 birthdays: age 22 -> 70
  const payout = run('retireCareer(c)');
  assert.equal(run('c.phase'), 'retired');
  assert.equal(payout.penalties, 0); // 70 is well past the penalty-free age
  assert.ok(payout.total > 0);
  const { board, rank } = run('addToLeaderboard([{ total: 1e12 }, { total: 1 }], { total: c.payout.total })');
  assert.equal(rank, 2);
  assert.equal(board.length, 3);
});

test('cannot retire mid-year, and there is no way to skip a year', () => {
  const run = load();
  assert.equal(run('typeof autoYear'), 'undefined'); // the fast-forward shortcut no longer exists in the engine
  run('var c = newCareer("Lee", "teacher"); payExpenses(c);');
  assert.equal(run('c.phase'), 'invest');
  assert.equal(run('retireCareer(c)'), null);
});
