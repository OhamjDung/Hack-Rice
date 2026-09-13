// Top-level simulation orchestrator. Pure: given a GraphState and a horizon in months,
// produces a monthly time series. No React, no I/O, no Date.now() — event seed is explicit.
import type {
  GraphState, FinanceNode, IncomeNode, AllocationEdge, MonthResult, SimulationResult, CareerTier,
} from '../types.ts';
import { stepAccountGrowth } from './growth.ts';
import { stepAmortization } from './amortization.ts';
import { stepCarDepreciation, stepAppreciation } from './depreciation.ts';
import { stepRevolvingBalance } from './revolving.ts';
import { annualNetIncome } from './tax.ts';
import { rollEventsForMonth, eventCost } from './events.ts';

const round2 = (n: number) => Math.round(n * 100) / 100;

const CAREER_RAISE_MULTIPLIER: Record<CareerTier, number> = {
  entry: 1.0, mid: 0.9, senior: 0.8, executive: 0.7,
};

// Insurance subtype -> event it offsets (approximation; documented simplification).
const INSURANCE_OFFSETS: Record<string, import('../types.ts').EventSubtype> = {
  health: 'medical_emergency',
  medicare: 'medical_emergency',
  life: 'job_loss',
  disability: 'job_loss',
  home: 'market_crash',
  auto: 'market_crash',
};

function edgesFrom(edges: AllocationEdge[], sourceId: string) {
  return edges.filter(e => e.source === sourceId);
}

function edgeAmount(edge: AllocationEdge, monthlyIncome: number): number {
  return edge.amountType === 'percent' ? round2(monthlyIncome * (edge.value / 100)) : edge.value;
}

function isOverAllocated(incomeNodes: IncomeNode[], edges: AllocationEdge[]): boolean {
  for (const income of incomeNodes) {
    const percentTotal = edgesFrom(edges, income.id)
      .filter(e => e.amountType === 'percent')
      .reduce((sum, e) => sum + e.value, 0);
    if (percentTotal > 100.0001) return true;
  }
  return false;
}

export function simulate(graph: GraphState, months: number): SimulationResult {
  const incomeNodes = graph.nodes.filter((n): n is IncomeNode => n.category === 'income');
  if (isOverAllocated(incomeNodes, graph.edges)) {
    return { months: [], overAllocated: true };
  }

  // Working copies keyed by node id — engine never mutates the input graph.
  const values = new Map<string, number>(graph.nodes.map(n => [n.id, n.currentValue]));
  const annualGross = new Map<string, number>(incomeNodes.map(n => [n.id, n.annualGross]));
  const contributedThisYear = new Map<string, number>(graph.nodes.map(n => [n.id, 0]));
  const originalAssetValue = new Map<string, number>(
    graph.nodes.filter(n => n.category === 'asset').map(n => [n.id, n.currentValue]),
  );
  const spendingCost = new Map<string, number>(
    graph.nodes.filter(n => n.category === 'spending' || n.category === 'insurance').map(n => [n.id, n.currentValue]),
  );

  const results: MonthResult[] = [];
  let overAllocated = false;
  let eventLossesAccumulated = 0;

  for (let month = 1; month <= months && !overAllocated; month++) {
    if (month > 1 && (month - 1) % 12 === 0) {
      // New year: apply raises, inflate spending/insurance costs, reset annual contribution counters.
      for (const income of incomeNodes) {
        const raise = income.expectedRaiseRate * CAREER_RAISE_MULTIPLIER[income.careerTier];
        annualGross.set(income.id, round2((annualGross.get(income.id) ?? income.annualGross) * (1 + raise)));
      }
      for (const [id, cost] of spendingCost) spendingCost.set(id, round2(cost * (1 + graph.settings.inflationRate)));
      for (const id of contributedThisYear.keys()) contributedThisYear.set(id, 0);
    }

    const eventsFired = rollEventsForMonth(graph.settings.eventSeed, month, graph.settings.lifeEventsEnabled);
    const offsetEvents = new Set(eventsFired); // consumed by matching insurance nodes below

    let grossIncomeTotal = 0;
    let netIncomeTotal = 0;
    let allocatedTotal = 0;

    for (const income of incomeNodes) {
      const monthlyGross = round2((annualGross.get(income.id) ?? income.annualGross) / 12);
      grossIncomeTotal = round2(grossIncomeTotal + monthlyGross);
      values.set(income.id, monthlyGross); // income has no balance — display its current monthly gross instead

      const outgoing = edgesFrom(graph.edges, income.id);
      const preTaxMonthly = outgoing
        .filter(e => {
          const target = graph.nodes.find(n => n.id === e.target);
          return target?.properties.taxTreatment === 'pre_tax';
        })
        .reduce((sum, e) => sum + edgeAmount(e, monthlyGross), 0);

      const netMonthly = round2(annualNetIncome(monthlyGross * 12, preTaxMonthly * 12, graph.profile.filingStatus) / 12);
      netIncomeTotal = round2(netIncomeTotal + netMonthly);

      let allocatedForThisIncome = 0;
      for (const edge of outgoing) {
        const amount = edgeAmount(edge, monthlyGross);
        allocatedForThisIncome = round2(allocatedForThisIncome + amount);
        applyContribution(edge.target, amount, monthlyGross);
      }
      // Percent edges are always a percentage of gross (matches the allocation editor's own
      // estimate and the static isOverAllocated check above) — gate against gross here too.
      // Comparing against post-tax net would falsely block legitimate allocations, since tax
      // alone can eat well over 10% of gross.
      if (allocatedForThisIncome > monthlyGross + 0.01) overAllocated = true;
      allocatedTotal = round2(allocatedTotal + allocatedForThisIncome);
    }

    // Autonomous per-node evolution not driven by an incoming edge this month (growth/decay/events).
    for (const node of graph.nodes) {
      if (node.category === 'income') continue;
      applyAutonomousStep(node, month, offsetEvents);
    }

    for (const uninsuredEvent of offsetEvents) eventLossesAccumulated = round2(eventLossesAccumulated + eventCost(uninsuredEvent));

    const leak = round2(netIncomeTotal - allocatedTotal);
    const netWorth = round2(computeNetWorth(graph.nodes, values) - eventLossesAccumulated);
    const nodeValues: Record<string, number> = {};
    for (const [id, v] of values) nodeValues[id] = v;

    results.push({ month, grossIncome: grossIncomeTotal, netIncome: netIncomeTotal, allocatedTotal, leak, netWorth, nodeValues, eventsFired });
  }

  function applyContribution(targetId: string, amount: number, monthlyIncomeForMatch: number) {
    const node = graph.nodes.find(n => n.id === targetId);
    if (!node) return;
    if (node.category === 'account') {
      const step = stepAccountGrowth({
        balance: values.get(node.id) ?? 0,
        monthlyContribution: amount,
        annualGrowthRate: node.properties.growthRate ?? 0,
        employerMatch: node.properties.employerMatch,
        monthlyIncomeForMatch,
        contributionLimit: node.properties.contributionLimit,
        contributedThisYear: contributedThisYear.get(node.id) ?? 0,
      });
      values.set(node.id, step.balance);
      contributedThisYear.set(node.id, step.contributedThisYear);
    } else if (node.category === 'debt') {
      applyDebtPayment(node, amount);
    } else if (node.category === 'cash') {
      values.set(node.id, round2((values.get(node.id) ?? 0) + amount));
    } else if (node.category === 'asset') {
      // A payment edge into a real_estate asset (down payment / extra principal) just adds value directly.
      values.set(node.id, round2((values.get(node.id) ?? 0) + amount));
    }
  }

  function applyDebtPayment(node: FinanceNode, payment: number) {
    if (node.subtype === 'credit_card') {
      const step = stepRevolvingBalance(values.get(node.id) ?? 0, node.properties.apr ?? 0, payment);
      values.set(node.id, step.balance);
    } else {
      const step = stepAmortization(values.get(node.id) ?? 0, node.properties.apr ?? 0, payment);
      values.set(node.id, step.remainingPrincipal);
    }
  }

  function applyAutonomousStep(node: FinanceNode, month: number, offsetEvents: Set<string>) {
    if (node.category === 'asset' && node.subtype === 'car') {
      const original = originalAssetValue.get(node.id) ?? node.currentValue;
      values.set(node.id, stepCarDepreciation(original, values.get(node.id) ?? node.currentValue, month, node.properties.salvagePct));
    } else if (node.category === 'asset' && node.subtype === 'real_estate') {
      values.set(node.id, stepAppreciation(values.get(node.id) ?? node.currentValue, node.properties.growthRate ?? 0));
    } else if (node.category === 'spending') {
      values.set(node.id, round2((values.get(node.id) ?? 0) + (spendingCost.get(node.id) ?? node.currentValue)));
    } else if (node.category === 'insurance') {
      const premium = spendingCost.get(node.id) ?? node.currentValue;
      values.set(node.id, round2((values.get(node.id) ?? 0) + premium));
      const offsetType = INSURANCE_OFFSETS[node.subtype];
      if (offsetType && offsetEvents.has(offsetType)) offsetEvents.delete(offsetType); // event's cost considered absorbed
    } else if (node.category === 'debt') {
      // Debts with no incoming payment edge this month still don't grow on their own here —
      // amortizing/revolving debt only moves via applyDebtPayment. Left as-is intentionally.
    }
  }

  return { months: results, overAllocated };
}

function computeNetWorth(nodes: FinanceNode[], values: Map<string, number>): number {
  let total = 0;
  for (const node of nodes) {
    const v = values.get(node.id) ?? 0;
    if (node.category === 'account' || node.category === 'asset' || node.category === 'cash') total += v;
    else if (node.category === 'debt') total -= v;
  }
  return round2(total);
}
