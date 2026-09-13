import test from 'node:test';
import assert from 'node:assert/strict';
import { stepAccountGrowth } from '../src/financegraph/engine/growth.ts';
import { monthlyPayment, amortizationSchedule, stepAmortization } from '../src/financegraph/engine/amortization.ts';
import { stepCarDepreciation } from '../src/financegraph/engine/depreciation.ts';
import { stepRevolvingBalance, projectMinimumPaymentPayoff } from '../src/financegraph/engine/revolving.ts';
import { progressiveTax, taxOnWithdrawal, requiredMinimumDistribution } from '../src/financegraph/engine/tax.ts';
import { simulate } from '../src/financegraph/engine/simulate.ts';
import { simulateBenchmark, buildWaterfallEdges } from '../src/financegraph/engine/benchmark.ts';
import { buildInitialGraph, placeNode, nextDrawerNodeId, returnNodeToDrawer, setNodeCost } from '../src/financegraph/graphFactory.ts';
import { DEFAULT_RANKING } from '../src/financegraph/data/defaults.ts';
import { rollEventsForMonth } from '../src/financegraph/engine/events.ts';
import type { GraphState } from '../src/financegraph/types.ts';

// --- Phase 0 validation gate: engine formulas vs. known public-calculator values ---

test('account growth compounds monthly and matches manual calculation with no match/limit', () => {
  const step = stepAccountGrowth({ balance: 1000, monthlyContribution: 100, annualGrowthRate: 0.12 });
  // (1000 + 100) * (1 + 0.12/12) = 1100 * 1.01 = 1111
  assert.equal(step.balance, 1111);
});

test('401k employer match is applied before growth, capped by match limit % of income', () => {
  const step = stepAccountGrowth({
    balance: 0, monthlyContribution: 500, annualGrowthRate: 0,
    employerMatch: { pct: 50, limitPct: 6 }, monthlyIncomeForMatch: 5000,
  });
  // matchable = min(500, 5000*0.06=300) = 300; match = 300*0.5 = 150
  assert.equal(step.matchApplied, 150);
  assert.equal(step.balance, 650); // 0 + 500 contribution + 150 match, 0% growth
});

test('annual contribution limit is enforced and does not silently overflow', () => {
  const step = stepAccountGrowth({ balance: 0, monthlyContribution: 2000, annualGrowthRate: 0, contributionLimit: 3000, contributedThisYear: 2500 });
  assert.equal(step.contributionApplied, 500); // only 500 of room left
  assert.equal(step.contributedThisYear, 3000);
});

test('mortgage monthly payment matches the well-known $300k/6%/30yr figure (~$1798.65)', () => {
  const payment = monthlyPayment(300_000, 0.06, 360);
  assert.ok(Math.abs(payment - 1798.65) < 0.5, `expected ~1798.65, got ${payment}`);
});

test('amortization schedule fully pays off the loan by the last period', () => {
  const schedule = amortizationSchedule(50_000, 0.05, 60);
  assert.equal(schedule.length, 60);
  assert.equal(schedule.at(-1)!.paidOff, true);
  assert.equal(schedule.at(-1)!.remainingPrincipal, 0);
});

test('amortization payment covers interest before principal each period', () => {
  const step = stepAmortization(50_000, 0.05, 943.56);
  assert.ok(step.interestPaid > 0);
  assert.ok(step.principalPaid > 0);
  assert.ok(step.remainingPrincipal < 50_000);
});

test('car depreciation compounds monthly to ~20% cumulative loss by month 12, then floors at salvage', () => {
  let value = 30_000;
  for (let month = 1; month <= 12; month++) value = stepCarDepreciation(30_000, value, month);
  assert.ok(value < 30_000 * 0.85 && value > 30_000 * 0.75, `expected ~20% cumulative drop, got ${value}`);
  const nearSalvage = stepCarDepreciation(30_000, 3_100, 200, 0.10);
  assert.ok(nearSalvage >= 3_000);
});

test('credit card balance grows forever when the minimum payment does not cover interest', () => {
  const projection = projectMinimumPaymentPayoff(8_000, 0.26, 0.02); // 2%/mo payment vs ~2.2%/mo interest rate
  assert.equal(projection.neverPaidOff, true);
});

test('credit card minimum payments take a very long time and rack up large interest — the intended lesson', () => {
  const projection = projectMinimumPaymentPayoff(5_000, 0.22, 0.03);
  assert.ok(projection.months > 100, `expected a slow payoff, got ${JSON.stringify(projection)}`);
  assert.ok(projection.totalInterest > 1000, `expected large accrued interest, got ${JSON.stringify(projection)}`);
});

test('revolving balance step applies interest after payment, not before', () => {
  const step = stepRevolvingBalance(1000, 0.24, 100);
  // (1000 - 100) * (1 + 0.24/12) = 900 * 1.02 = 918
  assert.equal(step.balance, 918);
});

test('progressive federal tax matches manual bracket math for a $50,000 single-filer taxable income', () => {
  // 10% of 11600 + 12% of (47150-11600) + 22% of (50000-47150) = 1160 + 4266 + 627 = 6053
  assert.equal(progressiveTax(50_000, 'single'), 6053);
});

test('pre-tax withdrawal is taxed as ordinary income stacked on other income; Roth withdrawal is untaxed', () => {
  const pretaxTax = taxOnWithdrawal(10_000, 'pre_tax', 'single', 40_000);
  assert.ok(pretaxTax > 0);
  assert.equal(taxOnWithdrawal(10_000, 'post_tax', 'single', 40_000), 0);
});

test('required minimum distribution is zero before age 73 and positive after', () => {
  assert.equal(requiredMinimumDistribution(500_000, 72), 0);
  assert.ok(requiredMinimumDistribution(500_000, 75) > 0);
});

test('life events are deterministic for a given seed and month', () => {
  const a = rollEventsForMonth(42, 100, true);
  const b = rollEventsForMonth(42, 100, true);
  assert.deepEqual(a, b);
  assert.deepEqual(rollEventsForMonth(42, 100, false), []);
});

// --- Simulation orchestrator ---

function baseGraph(): GraphState {
  return buildInitialGraph(
    { age: 30, filingStatus: 'single', dependents: 0, jobStatus: 'employed', riskTolerance: 'medium' },
    60_000,
    DEFAULT_RANKING,
  );
}

test('over-allocated percent edges block the simulation with a clear error state, not broken math', () => {
  const graph = baseGraph();
  graph.edges = [
    { id: 'e1', source: 'income-primary', target: 'cash-buffer', type: 'allocation', amountType: 'percent', value: 80 },
    { id: 'e2', source: 'income-primary', target: 'node-401k', type: 'allocation', amountType: 'percent', value: 30 },
  ];
  const result = simulate(graph, 12);
  assert.equal(result.overAllocated, true);
  assert.equal(result.months.length, 0);
});

test('90% allocated (2% + 88%) is not over-allocated even though tax makes net income less than 90% of gross', () => {
  const graph = baseGraph();
  graph.edges = [
    { id: 'e1', source: 'income-primary', target: 'node-401k', type: 'allocation', amountType: 'percent', value: 2 },
    { id: 'e2', source: 'income-primary', target: 'cash-buffer', type: 'allocation', amountType: 'percent', value: 88 },
  ];
  const result = simulate(graph, 1);
  assert.equal(result.overAllocated, false);
  assert.ok(result.months.length > 0);
});

test('leak equals net income minus allocated total when nothing is assigned', () => {
  const graph = baseGraph();
  const result = simulate(graph, 1);
  assert.equal(result.overAllocated, false);
  assert.equal(result.months[0].allocatedTotal, 0);
  assert.equal(result.months[0].leak, result.months[0].netIncome);
});

test('income node reports its current monthly gross in nodeValues, not a stuck $0 balance', () => {
  const graph = baseGraph();
  const result = simulate(graph, 1);
  assert.equal(result.months[0].nodeValues['income-primary'], 5_000); // 60,000/12
});

test('allocating into cash raises net worth by the allocated amount, ignoring growth', () => {
  const graph = baseGraph();
  graph.edges = [{ id: 'e1', source: 'income-primary', target: 'cash-buffer', type: 'allocation', amountType: 'fixed', value: 1000 }];
  const result = simulate(graph, 1);
  assert.equal(result.months[0].netWorth, 1000);
});

test('benchmark ghost-line simulation never mutates the user\'s actual edges', () => {
  const graph = baseGraph();
  graph.nodes = graph.nodes.map(n => (n.id === 'node-401k' ? { ...n, unlocked: true } : n));
  const before = JSON.stringify(graph.edges);
  simulateBenchmark(graph, 12);
  assert.equal(JSON.stringify(graph.edges), before);
});

test('the waterfall reserves mandatory costs (rent, mortgage payment) before recommending anything else', () => {
  const graph = baseGraph();
  graph.nodes = graph.nodes.map(n => {
    if (n.id === 'node-401k') return { ...n, unlocked: true };
    if (n.id === 'node-rent') return { ...n, unlocked: true, currentValue: 1500 };
    if (n.id === 'node-mortgage') return { ...n, unlocked: true, currentValue: 200_000, properties: { ...n.properties, apr: 0.06, termMonths: 360 } };
    return n;
  });
  const edges = buildWaterfallEdges(graph);
  const rentEdge = edges.find(e => e.target === 'node-rent');
  const mortgageEdge = edges.find(e => e.target === 'node-mortgage');
  assert.equal(rentEdge?.value, 1500);
  assert.ok(mortgageEdge && mortgageEdge.value > 0);
  assert.equal(mortgageEdge?.type, 'payment');
  // Mandatory costs come before the 401(k) match step: 401k should get whatever's left, capped by match limit.
  const four01kEdge = edges.find(e => e.target === 'node-401k');
  assert.ok(four01kEdge && four01kEdge.value <= 60_000 / 12 * 0.06 + 0.01);
});

test('nodes outside the 5 waterfall categories with no mandatory cost get 0%, not removed from the graph', () => {
  const graph = baseGraph();
  graph.nodes = graph.nodes.map(n => (n.id === 'node-life' ? { ...n, unlocked: true, currentValue: 0 } : n));
  const edges = buildWaterfallEdges(graph);
  assert.equal(edges.find(e => e.target === 'node-life'), undefined);
  assert.ok(graph.nodes.some(n => n.id === 'node-life')); // still on the graph, just unrecommended
});

test('locked concepts start off the board; only the next-ranked one can be placed from the drawer', () => {
  const graph = baseGraph();
  const unlockedBefore = graph.nodes.filter(n => n.unlocked).length;
  assert.equal(unlockedBefore, 7); // income + cash + 5 auto-placed spending nodes; everything else starts in the drawer

  const nextId = nextDrawerNodeId(graph);
  assert.ok(nextId);

  // Dragging the wrong (not-next) node onto the board is a no-op.
  const lockedIds = graph.nodes.filter(n => !n.unlocked).map(n => n.id);
  const wrongId = lockedIds.find(id => id !== nextId)!;
  const rejected = placeNode(graph, wrongId, { x: 100, y: 100 });
  assert.equal(rejected, graph);

  const placed = placeNode(graph, nextId!, { x: 100, y: 100 });
  assert.equal(placed.nodes.filter(n => n.unlocked).length, unlockedBefore + 1);
  assert.deepEqual(placed.layout[nextId!], { x: 100, y: 100 });
});

test('a placed node can be dragged back to the drawer: re-locks it, drops its edges and layout', () => {
  const graph = baseGraph();
  const nextId = nextDrawerNodeId(graph)!;
  let placed = placeNode(graph, nextId, { x: 100, y: 100 });
  placed = { ...placed, edges: [{ id: 'e1', source: 'income-primary', target: nextId, type: 'allocation', amountType: 'percent', value: 10 }] };

  const returned = returnNodeToDrawer(placed, nextId);
  assert.equal(returned.nodes.find(n => n.id === nextId)!.unlocked, false);
  assert.equal(returned.layout[nextId], undefined);
  assert.equal(returned.edges.length, 0);
  assert.equal(nextDrawerNodeId(returned), nextId); // back at the front of the queue
});

test('income, cash, and spending cannot be returned to the drawer — they are foundational', () => {
  const graph = baseGraph();
  assert.equal(returnNodeToDrawer(graph, 'income-primary'), graph);
  assert.equal(returnNodeToDrawer(graph, 'cash-buffer'), graph);
  assert.equal(returnNodeToDrawer(graph, 'node-rent'), graph);
});

test('spending nodes are auto-placed and unlocked from the start, and their cost is editable', () => {
  const graph = baseGraph();
  const rent = graph.nodes.find(n => n.id === 'node-rent')!;
  assert.equal(rent.category, 'spending');
  assert.equal(rent.unlocked, true);
  assert.ok(graph.layout['node-rent']);
  assert.equal(rent.currentValue, 0);

  const updated = setNodeCost(graph, 'node-rent', 1500);
  assert.equal(updated.nodes.find(n => n.id === 'node-rent')!.currentValue, 1500);

  // Setting a cost creates a visible Income -> node edge carrying that dollar amount.
  const edge = updated.edges.find(e => e.target === 'node-rent');
  assert.equal(edge?.source, 'income-primary');
  assert.equal(edge?.value, 1500);

  // Dropping the cost back to 0 removes the edge again.
  const cleared = setNodeCost(updated, 'node-rent', 0);
  assert.equal(cleared.edges.find(e => e.target === 'node-rent'), undefined);

  // Non-spending/insurance nodes are not editable this way.
  assert.equal(setNodeCost(graph, 'income-primary', 999), graph);
});
