// Engine tests for endgame/. The game uses plain <script> globals, so each test
// loads the same files into a fresh vm context, in page order.
// Run: node --test endgame/tests/nestegg.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILES = ['data/companies.js', 'data/events.js', 'data/life.js', 'js/finance.js', 'js/market.js', 'js/career-engine.js'];
const root = new URL('../', import.meta.url);

function load({ random } = {}) {
  const ctx = vm.createContext({ console });
  for (const f of FILES) vm.runInContext(readFileSync(new URL(f, root), 'utf8'), ctx, { filename: f });
  if (random) { ctx.__random = random; vm.runInContext('Math.random = () => __random()', ctx); }
  return code => vm.runInContext(code, ctx);
}

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

test('news reaction: part lands now, the rest over REACTION_MS', () => {
  const run = load({ random: () => 0.5 }); // mid-range move, zero cosmetic jitter
  run('var m = createMarket(); var c = m.companies.find(x => x.id === "drwl"); var p0 = c.anchor;');
  run('applyMarketEvent(m, { sector: "oil", priceChangeRange: [9, 15] })');
  const total = 12 * (0.6 + 1.1 * 0.6) / 100;           // DRWL volatility 1.1
  assert.ok(Math.abs(run('c.anchor / p0') - (1 + total * 0.35)) < 1e-9);
  run('for (let t = 0; t < REACTION_MS; t += MARKET_STEP_MS) stepMarket(m)');
  assert.ok(Math.abs(run('c.anchor / p0') - (1 + total)) < 1e-9);
  assert.equal(run('c.reactions.length'), 0);
});

test('history is trimmed but keeps seq ids for trade markers', () => {
  const run = load();
  run('var m = createMarket(); for (let i = 0; i < 900; i++) stepMarket(m)');
  assert.equal(run('m.companies[0].history.length'), 800);
  assert.equal(run('m.companies[0].history[799].seq'), run('m.seq'));
  assert.equal(run('m.etfs[5].history[0].seq'), run('m.companies[0].history[0].seq'));
});

test('a full year: paycheck -> expenses -> invest -> year end', () => {
  const run = load();
  run('var m = createMarket(); var c = newCareer("Sam", "engineer", m); beginYear(c, m, null);');
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
  run('finishYear(c, m)');
  assert.equal(run('c.phase'), 'review');
  assert.equal(run('c.age'), 23);
  assert.equal(run('c.timeline.length'), 2);
  assert.equal(run('c.timeline[1].netWorth'), run('netWorth(c, m)'));
  assert.ok(run('c.cur.review.lesson').length > 10);
});

test('essential minimums are enforced and a shortfall becomes debt', () => {
  const run = load();
  run('var m = createMarket(); var c = newCareer("Jo", "barista", m); beginYear(c, m, null);');
  run('c.expenses[0].monthly = 100');
  assert.ok(run('validateExpenses(c)').some(e => e.includes('Rent')));
  run('c.expenses[0].monthly = 3000');                  // way more than a barista takes home
  assert.deepEqual([...run('payExpenses(c)')], []);
  assert.ok(run('c.cur.shortfall.toDebt') > 0);
  assert.equal(run('c.accounts.debt'), run('c.cur.shortfall.toDebt'));
  assert.equal(run('c.cur.leftover'), 0);
});

test('fast-forward runs whole years and retirement ranks on the leaderboard', () => {
  const run = load();
  run('var m = createMarket(); var c = newCareer("Ana", "nurse", m); payExpenses(c); investLeftover(c, { k401: 4680, roth: 7500 }); finishYear(c, m);');
  let years = 0;
  while (run('autoYear(c, m)')) years++;
  assert.equal(run('c.age'), 70);
  assert.equal(years, 70 - 23);
  assert.ok(run('autoYear(c, m)') === false);
  const payout = run('retireCareer(c, m)');
  assert.equal(run('c.phase'), 'retired');
  assert.equal(payout.penalties, 0);
  assert.ok(payout.total > 0);
  const { board, rank } = run('addToLeaderboard([{ total: 1e12 }, { total: 1 }], { total: c.payout.total })');
  assert.equal(rank, 2);
  assert.equal(board.length, 3);
});

test('cannot retire mid-year', () => {
  const run = load();
  run('var m = createMarket(); var c = newCareer("Lee", "teacher", m); payExpenses(c);');
  assert.equal(run('c.phase'), 'invest');
  assert.equal(run('retireCareer(c, m)'), null);
});
