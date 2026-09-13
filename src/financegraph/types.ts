// Finance Graph — shared types + locked taxonomy. See financegraph/PLAN.md (handoff spec).
// Engine code (src/financegraph/engine/*) depends only on this file — no React, no I/O.

export const NODE_TAXONOMY = {
  account: ['401k', 'roth_ira', 'traditional_ira', 'brokerage'],
  asset: ['real_estate', 'car'],
  debt: ['mortgage', 'credit_card', 'student_loan'],
  insurance: ['health', 'medicare', 'life', 'disability', 'home', 'auto'],
  spending: ['rent', 'food', 'utilities', 'entertainment', 'other'],
  event: ['job_loss', 'market_crash', 'medical_emergency'],
} as const;

export type AccountSubtype = typeof NODE_TAXONOMY.account[number];
export type AssetSubtype = typeof NODE_TAXONOMY.asset[number];
export type DebtSubtype = typeof NODE_TAXONOMY.debt[number];
export type InsuranceSubtype = typeof NODE_TAXONOMY.insurance[number];
export type SpendingSubtype = typeof NODE_TAXONOMY.spending[number];
export type EventSubtype = typeof NODE_TAXONOMY.event[number];
export type TaxonomySubtype = AccountSubtype | AssetSubtype | DebtSubtype | InsuranceSubtype | SpendingSubtype | EventSubtype;

export type NodeCategory = 'income' | 'account' | 'asset' | 'spending' | 'debt' | 'insurance' | 'cash';

export type TaxTreatment = 'pre_tax' | 'post_tax' | 'taxable' | 'none';
export type Liquidity = 'high' | 'medium' | 'low';

export interface NodeProperties {
  growthRate?: number;
  depreciationRate?: number;
  apr?: number;
  taxTreatment?: TaxTreatment;
  liquidity?: Liquidity;
  employerMatch?: { pct: number; limitPct: number };
  contributionLimit?: number;
  termMonths?: number;
  salvagePct?: number; // asset: car — floor of depreciation, as % of original value
}

export interface FinanceNode {
  id: string;
  category: NodeCategory;
  subtype: string; // must be a member of NODE_TAXONOMY[category] for non-income/cash categories
  label: string;
  unlocked: boolean;
  unlockRank: number;
  currentValue: number;
  properties: NodeProperties;
  reasoning?: string; // why the ranking engine placed this concept here, shown on hover
  instructions?: string; // step-by-step guide for using this concept, shown in the Guide panel once unlocked
}

export type CareerTier = 'entry' | 'mid' | 'senior' | 'executive';

export interface IncomeNode extends FinanceNode {
  category: 'income';
  careerTier: CareerTier;
  annualGross: number;
  expectedRaiseRate: number;
}

export type EdgeType = 'allocation' | 'payment';
export type AmountType = 'percent' | 'fixed';

export interface AllocationEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  amountType: AmountType;
  value: number; // % of source income (0-100) or $/month
}

export type FilingStatus = 'single' | 'married_joint';

export interface UserProfile {
  age: number;
  filingStatus: FilingStatus;
  dependents: number;
  jobStatus: 'employed' | 'self_employed' | 'unemployed' | 'student';
  riskTolerance: 'low' | 'medium' | 'high';
}

export type SessionGoal = 'max_net_worth' | 'fastest_fi' | 'min_risk';

export interface GraphSettings {
  lifeEventsEnabled: boolean;
  sessionGoal: SessionGoal;
  inflationRate: number;
  eventSeed: number;
}

export interface GraphPosition { x: number; y: number }

export interface GraphState {
  nodes: FinanceNode[];
  edges: AllocationEdge[];
  profile: UserProfile;
  settings: GraphSettings;
  layout: Record<string, GraphPosition>; // canvas position for each node that's been placed on the board
}

// --- Simulation output ---

export interface NodeSnapshot {
  nodeId: string;
  month: number;
  value: number; // balance for accounts/assets/debts, cumulative spend for spending nodes
}

export interface MonthResult {
  month: number;
  grossIncome: number;
  netIncome: number;
  allocatedTotal: number;
  leak: number;
  netWorth: number;
  nodeValues: Record<string, number>;
  eventsFired: EventSubtype[];
}

export interface SimulationResult {
  months: MonthResult[];
  overAllocated: boolean;
}

export interface RankingRequest {
  age: number;
  income: number;
  jobStatus: UserProfile['jobStatus'];
  dependents: number;
  existingAccounts: string[]; // subtype strings already held
  riskTolerance: UserProfile['riskTolerance'];
}

export interface RankingResult {
  order: TaxonomySubtype[]; // validated against NODE_TAXONOMY
  reasoning: Partial<Record<TaxonomySubtype, string>>; // why each concept was ranked where it was
  instructions: Partial<Record<TaxonomySubtype, string>>; // step-by-step guide for using each concept
  source: 'llm' | 'fallback';
  disclaimer: string;
}
