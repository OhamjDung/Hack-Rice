import { create } from 'zustand';
import type { GraphState, AllocationEdge, UserProfile, RankingResult, SessionGoal, GraphPosition } from '../types.ts';
import { buildInitialGraph, placeNode, moveNode, returnNodeToDrawer, setNodeCost } from '../graphFactory.ts';
import { DEFAULT_RANKING } from '../data/defaults.ts';

const STORAGE_KEY = 'financegraph-v1';

interface GraphStore {
  graph: GraphState | null;
  hydrated: boolean;
  rankingSource: 'llm' | 'fallback' | null;
  disclaimer: string | null;
  horizonMonths: number;
  hydrate: () => void;
  startFromProfile: (profile: UserProfile, annualGross: number, ranking?: RankingResult) => void;
  setEdge: (edge: AllocationEdge) => void;
  removeEdge: (edgeId: string) => void;
  placeNodeOnBoard: (nodeId: string, position: GraphPosition) => void;
  moveNodeOnBoard: (nodeId: string, position: GraphPosition) => void;
  returnNodeToDrawer: (nodeId: string) => void;
  setNodeCost: (nodeId: string, monthlyCost: number) => void;
  setSessionGoal: (goal: SessionGoal) => void;
  setLifeEventsEnabled: (enabled: boolean) => void;
  setInflationRate: (rate: number) => void;
  setHorizonMonths: (months: number) => void;
  reset: () => void;
}

function persist(graph: GraphState | null) {
  if (typeof window === 'undefined' || !graph) return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(graph)); } catch { /* quota/private mode */ }
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  graph: null,
  hydrated: false,
  rankingSource: null,
  disclaimer: null,
  horizonMonths: 240, // 20 years default

  hydrate: () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GraphState;
        // Backfill `layout` for saves made before drag-to-place existed — unlocked nodes
        // without a stored position (they used to auto-layout) get a default column spot.
        if (!parsed.layout) parsed.layout = {};
        let column = 0;
        for (const node of parsed.nodes) {
          if (node.unlocked && !parsed.layout[node.id]) {
            parsed.layout[node.id] = { x: 40 + column * 240, y: 40 };
            column++;
          }
        }
        set({ graph: parsed });
      }
    } catch { /* ignore corrupt save */ }
    set({ hydrated: true });
  },

  startFromProfile: (profile, annualGross, ranking) => {
    const order = ranking?.order ?? DEFAULT_RANKING;
    const graph = buildInitialGraph(profile, annualGross, order, ranking?.reasoning ?? {}, ranking?.instructions ?? {});
    set({ graph, rankingSource: ranking?.source ?? 'fallback', disclaimer: ranking?.disclaimer ?? null });
    persist(graph);
  },

  setEdge: (edge) => {
    const graph = get().graph;
    if (!graph) return;
    const next: GraphState = { ...graph, edges: [...graph.edges.filter(e => e.id !== edge.id), edge] };
    set({ graph: next });
    persist(next);
  },

  removeEdge: (edgeId) => {
    const graph = get().graph;
    if (!graph) return;
    const next: GraphState = { ...graph, edges: graph.edges.filter(e => e.id !== edgeId) };
    set({ graph: next });
    persist(next);
  },

  placeNodeOnBoard: (nodeId, position) => {
    const graph = get().graph;
    if (!graph) return;
    const next = placeNode(graph, nodeId, position);
    set({ graph: next });
    persist(next);
  },

  moveNodeOnBoard: (nodeId, position) => {
    const graph = get().graph;
    if (!graph) return;
    const next = moveNode(graph, nodeId, position);
    set({ graph: next });
    persist(next);
  },

  returnNodeToDrawer: (nodeId) => {
    const graph = get().graph;
    if (!graph) return;
    const next = returnNodeToDrawer(graph, nodeId);
    set({ graph: next });
    persist(next);
  },

  setNodeCost: (nodeId, monthlyCost) => {
    const graph = get().graph;
    if (!graph) return;
    const next = setNodeCost(graph, nodeId, monthlyCost);
    set({ graph: next });
    persist(next);
  },

  setSessionGoal: (goal) => {
    const graph = get().graph;
    if (!graph) return;
    const next: GraphState = { ...graph, settings: { ...graph.settings, sessionGoal: goal } };
    set({ graph: next });
    persist(next);
  },

  setLifeEventsEnabled: (enabled) => {
    const graph = get().graph;
    if (!graph) return;
    const next: GraphState = { ...graph, settings: { ...graph.settings, lifeEventsEnabled: enabled } };
    set({ graph: next });
    persist(next);
  },

  setInflationRate: (rate) => {
    const graph = get().graph;
    if (!graph) return;
    const next: GraphState = { ...graph, settings: { ...graph.settings, inflationRate: rate } };
    set({ graph: next });
    persist(next);
  },

  setHorizonMonths: (months) => set({ horizonMonths: months }),

  reset: () => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    set({ graph: null, rankingSource: null, disclaimer: null });
  },
}));
