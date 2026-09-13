// Builds a starting GraphState from a profile + ranking order. Pure — no React, no I/O.
import type { GraphState, FinanceNode, IncomeNode, UserProfile, TaxonomySubtype, NodeCategory } from './types.ts';
import { NODE_TAXONOMY } from './types.ts';
import { DEFAULT_PROPERTIES } from './data/defaults.ts';

const SPENDING_SUBTYPES = NODE_TAXONOMY.spending as readonly TaxonomySubtype[];

const SUBTYPE_TO_CATEGORY: Record<TaxonomySubtype, NodeCategory | 'event'> = Object.fromEntries(
  (Object.entries(NODE_TAXONOMY) as [NodeCategory | 'event', readonly string[]][])
    .flatMap(([category, subtypes]) => subtypes.map(subtype => [subtype, category])),
) as Record<TaxonomySubtype, NodeCategory | 'event'>;

const LABELS: Record<string, string> = {
  '401k': '401(k)', roth_ira: 'Roth IRA', traditional_ira: 'Traditional IRA', brokerage: 'Brokerage',
  real_estate: 'Real Estate', car: 'Car', mortgage: 'Mortgage', credit_card: 'Credit Card',
  student_loan: 'Student Loan', health: 'Health Insurance', medicare: 'Medicare', life: 'Life Insurance',
  disability: 'Disability Insurance', home: 'Home Insurance', auto: 'Auto Insurance', rent: 'Rent',
  food: 'Food', utilities: 'Utilities', entertainment: 'Entertainment', other: 'Other Spending',
  job_loss: 'Job Loss', market_crash: 'Market Crash', medical_emergency: 'Medical Emergency',
};

export function buildInitialGraph(
  profile: UserProfile,
  annualGross: number,
  ranking: TaxonomySubtype[],
  reasoning: Partial<Record<TaxonomySubtype, string>> = {},
  instructions: Partial<Record<TaxonomySubtype, string>> = {},
): GraphState {
  const income: IncomeNode = {
    id: 'income-primary', category: 'income', subtype: 'primary', label: 'Income', unlocked: true, unlockRank: -1,
    currentValue: 0, properties: {}, careerTier: annualGross >= 150_000 ? 'executive' : annualGross >= 90_000 ? 'senior' : annualGross >= 55_000 ? 'mid' : 'entry',
    annualGross, expectedRaiseRate: 0.03,
  };

  const cash: FinanceNode = {
    id: 'cash-buffer', category: 'cash', subtype: 'cash', label: 'Cash', unlocked: true, unlockRank: 0,
    currentValue: 0, properties: { liquidity: 'high', taxTreatment: 'none' },
  };

  // Spending is a real-life necessity, not a concept to learn — auto-placed on the board
  // from the start, right alongside Income/Cash, instead of sitting in the drawer.
  const spendingNodes: FinanceNode[] = SPENDING_SUBTYPES.map((subtype, i) => ({
    id: `node-${subtype}`,
    category: 'spending',
    subtype,
    label: LABELS[subtype] ?? subtype,
    unlocked: true,
    unlockRank: 0,
    currentValue: 0, // monthly cost — set via the node's cost editor
    properties: DEFAULT_PROPERTIES[subtype] ?? {},
    reasoning: reasoning[subtype],
    instructions: instructions[subtype],
  }));
  const spendingLayout = Object.fromEntries(spendingNodes.map((n, i) => [n.id, { x: 40, y: 240 + i * 80 }]));

  // unlockRank is derived directly from the ranking array's index — this IS the unlock
  // order (index 0 unlocks first, etc). Never reorder `ranking` before this map, and never
  // assign unlockRank any other way, or the two would drift apart.
  const rankedNodes: FinanceNode[] = ranking
    .filter(subtype => SUBTYPE_TO_CATEGORY[subtype] !== 'event' && SUBTYPE_TO_CATEGORY[subtype] !== 'spending')
    .map((subtype, i) => ({
      id: `node-${subtype}`,
      category: SUBTYPE_TO_CATEGORY[subtype] as NodeCategory,
      subtype,
      label: LABELS[subtype] ?? subtype,
      unlocked: false, // lives in the drawer until the player drags it onto the board
      unlockRank: i + 1,
      currentValue: 0,
      properties: DEFAULT_PROPERTIES[subtype] ?? {},
      reasoning: reasoning[subtype],
      instructions: instructions[subtype],
    }));

  return {
    nodes: [income, cash, ...spendingNodes, ...rankedNodes],
    edges: [],
    profile,
    settings: { lifeEventsEnabled: false, sessionGoal: 'max_net_worth', inflationRate: 0.03, eventSeed: 42 },
    layout: { 'income-primary': { x: 40, y: 40 }, 'cash-buffer': { x: 40, y: 140 }, ...spendingLayout },
  };
}

// Spending/insurance nodes aren't funded by a user-drawn edge — their cost is a fixed
// monthly drain. But a cost with no visible line reads as disconnected/broken, so this
// keeps an informational edge (Income -> node) in sync with the cost: it renders the
// connection on the board and its dollar amount also counts toward `allocatedTotal` in
// simulate.ts, so a real cost actually reduces the leak instead of being invisible to it.
export function setNodeCost(graph: GraphState, nodeId: string, monthlyCost: number): GraphState {
  const node = graph.nodes.find(n => n.id === nodeId);
  if (!node || (node.category !== 'spending' && node.category !== 'insurance')) return graph;
  const cost = Math.max(0, monthlyCost);
  const income = graph.nodes.find((n): n is IncomeNode => n.category === 'income');
  const edgeId = `edge-cost-${nodeId}`;
  const edges = graph.edges.filter(e => e.id !== edgeId);
  if (income && cost > 0) {
    edges.push({ id: edgeId, source: income.id, target: nodeId, type: 'allocation', amountType: 'fixed', value: cost });
  }
  return {
    ...graph,
    nodes: graph.nodes.map(n => (n.id === nodeId ? { ...n, currentValue: cost } : n)),
    edges,
  };
}

// Only the lowest-unlockRank node still in the drawer can be dragged onto the board —
// preserves the "concepts unlock one at a time" teaching order even though placement is now
// a drag gesture rather than an automatic reveal.
export function nextDrawerNodeId(graph: GraphState): string | null {
  const locked = graph.nodes.filter(n => !n.unlocked).sort((a, b) => a.unlockRank - b.unlockRank);
  return locked[0]?.id ?? null;
}

export function placeNode(graph: GraphState, nodeId: string, position: GraphState['layout'][string]): GraphState {
  if (nextDrawerNodeId(graph) !== nodeId) return graph; // not the next concept in the queue
  return {
    ...graph,
    nodes: graph.nodes.map(n => (n.id === nodeId ? { ...n, unlocked: true } : n)),
    layout: { ...graph.layout, [nodeId]: position },
  };
}

export function moveNode(graph: GraphState, nodeId: string, position: GraphState['layout'][string]): GraphState {
  return { ...graph, layout: { ...graph.layout, [nodeId]: position } };
}

// Drag a placed node back onto the drawer: re-locks it, removes it from the board, and
// drops any edges that referenced it. Income/cash/spending are foundational and can't be returned.
export function returnNodeToDrawer(graph: GraphState, nodeId: string): GraphState {
  const node = graph.nodes.find(n => n.id === nodeId);
  if (!node || node.category === 'income' || node.category === 'cash' || node.category === 'spending') return graph;
  const { [nodeId]: _removed, ...restLayout } = graph.layout;
  return {
    ...graph,
    nodes: graph.nodes.map(n => (n.id === nodeId ? { ...n, unlocked: false } : n)),
    edges: graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    layout: restLayout,
  };
}
