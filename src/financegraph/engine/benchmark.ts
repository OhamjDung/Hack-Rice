// Ghost-line benchmark: a rule-based waterfall allocator, not a true optimizer.
// Reweights by session goal but never mutates the user's actual graph/edges.
import type { GraphState, FinanceNode, AllocationEdge, SessionGoal, SimulationResult, IncomeNode } from '../types.ts';
import { simulate } from './simulate.ts';
import { monthlyPayment } from './amortization.ts';

type WaterfallStep = (node: FinanceNode) => boolean;

const STEP_ORDER_DEFAULT: WaterfallStep[] = [
  (n) => n.category === 'account' && n.subtype === '401k' && !!n.properties.employerMatch, // 1. capture full match
  (n) => n.category === 'debt' && n.subtype === 'credit_card', // 2. pay high-interest debt
  (n) => n.category === 'cash', // 3. emergency cash buffer
  (n) => n.category === 'account' && (n.subtype === 'roth_ira' || n.subtype === 'traditional_ira'), // 4. tax-advantaged space
  (n) => n.category === 'account' && n.subtype === 'brokerage', // 5. taxable brokerage
];

// Session goal reweights ordering only for the ghost line (LOCKED).
function orderForGoal(goal: SessionGoal): WaterfallStep[] {
  if (goal === 'min_risk') {
    // Debt payoff and cash buffer take priority over growth accounts.
    return [STEP_ORDER_DEFAULT[1], STEP_ORDER_DEFAULT[2], STEP_ORDER_DEFAULT[0], STEP_ORDER_DEFAULT[3], STEP_ORDER_DEFAULT[4]];
  }
  if (goal === 'fastest_fi') {
    // Skip the cash buffer step, push everything into tax-advantaged + brokerage after the match/debt.
    return [STEP_ORDER_DEFAULT[0], STEP_ORDER_DEFAULT[1], STEP_ORDER_DEFAULT[3], STEP_ORDER_DEFAULT[4], STEP_ORDER_DEFAULT[2]];
  }
  return STEP_ORDER_DEFAULT; // max_net_worth
}

function matchCapAmount(node: FinanceNode, monthlyIncome: number): number {
  if (!node.properties.employerMatch) return 0;
  return monthlyIncome * (node.properties.employerMatch.limitPct / 100);
}

// The waterfall's 5 wealth-building steps say nothing about money you don't actually have a
// choice about — rent, insurance premiums, an amortizing mortgage/student loan payment.
// Credit card is excluded here: it's already one of the 5 steps (a debt you choose to attack),
// not a fixed bill like the others.
function mandatoryMonthlyCost(node: FinanceNode): number {
  if (node.category === 'spending' || node.category === 'insurance') return node.currentValue;
  if (node.category === 'debt' && node.subtype !== 'credit_card') {
    const { apr, termMonths } = node.properties;
    if (apr != null && termMonths != null && node.currentValue > 0) {
      return monthlyPayment(node.currentValue, apr, termMonths);
    }
  }
  return 0;
}

// Builds a synthetic edge set: mandatory fixed costs are reserved first (rent, insurance,
// mortgage/student loan payments), then whatever's left is greedily filled through the 5
// wealth-building waterfall steps — using only the nodes the user has actually placed.
export function buildWaterfallEdges(graph: GraphState): AllocationEdge[] {
  const incomeNodes = graph.nodes.filter((n): n is IncomeNode => n.category === 'income');
  const totalMonthlyIncome = incomeNodes.reduce((sum, n) => sum + n.annualGross / 12, 0);
  const unlockedTargets = graph.nodes.filter(n => n.unlocked && n.category !== 'income');
  const steps = orderForGoal(graph.settings.sessionGoal);

  let remaining = totalMonthlyIncome;
  const edges: AllocationEdge[] = [];
  const primaryIncome = incomeNodes[0];
  if (!primaryIncome) return edges;

  for (const node of unlockedTargets) {
    if (remaining <= 0) break;
    const cost = Math.min(mandatoryMonthlyCost(node), remaining);
    if (cost <= 0) continue;
    edges.push({ id: `ghost-mandatory-${node.id}`, source: primaryIncome.id, target: node.id, type: node.category === 'debt' ? 'payment' : 'allocation', amountType: 'fixed', value: Math.round(cost * 100) / 100 });
    remaining = Math.round((remaining - cost) * 100) / 100;
  }

  for (const stepMatch of steps) {
    const candidates = unlockedTargets.filter(stepMatch);
    for (const node of candidates) {
      if (remaining <= 0) break;
      const cap = node.properties.employerMatch ? matchCapAmount(node, totalMonthlyIncome) : remaining;
      const amount = Math.min(remaining, cap);
      if (amount <= 0) continue;
      edges.push({ id: `ghost-${node.id}`, source: primaryIncome.id, target: node.id, type: 'allocation', amountType: 'fixed', value: Math.round(amount * 100) / 100 });
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
  }
  return edges;
}

export function simulateBenchmark(graph: GraphState, months: number): SimulationResult {
  const ghostGraph: GraphState = {
    ...graph,
    edges: buildWaterfallEdges(graph),
  };
  return simulate(ghostGraph, months);
}
