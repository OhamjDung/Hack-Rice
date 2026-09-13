'use client';
import { useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '../state/graphStore';
import { simulate } from '../engine/simulate';
import { simulateBenchmark } from '../engine/benchmark';
import type { FinanceNode, IncomeNode } from '../types';
import ProfileIntakeForm from './ProfileIntakeForm';
import GraphCanvas from './GraphCanvas';
import NodeDrawer from './NodeDrawer';
import AllocationEdgeEditor from './AllocationEdgeEditor';
import NodeCostEditor from './NodeCostEditor';
import GuidePanel from './GuidePanel';
import LeakIndicator from './LeakIndicator';
import TimeSlider from './TimeSlider';
import NetWorthChart from './NetWorthChart';
import SessionGoalPicker from './SessionGoalPicker';
import LifeEventsToggle from './LifeEventsToggle';
import RecommendedSplit from './RecommendedSplit';
import { nextDrawerNodeId } from '../graphFactory';
import '../financegraph.css';

export default function FinanceGraphApp() {
  const {
    graph, hydrated, hydrate, startFromProfile, setEdge, removeEdge, placeNodeOnBoard, moveNodeOnBoard,
    returnNodeToDrawer, setNodeCost, setSessionGoal, setLifeEventsEnabled, horizonMonths, reset,
  } = useGraphStore();
  const [month, setMonth] = useState(1);
  const [editingNode, setEditingNode] = useState<FinanceNode | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const simulation = useMemo(() => (graph ? simulate(graph, horizonMonths) : null), [graph, horizonMonths]);
  const benchmark = useMemo(() => (graph ? simulateBenchmark(graph, horizonMonths) : null), [graph, horizonMonths]);

  if (!hydrated) return null;

  if (!graph) {
    return (
      <div className="fg-root">
        <ProfileIntakeForm onSubmit={(profile, gross, ranking) => startFromProfile(profile, gross, ranking)} />
      </div>
    );
  }

  const income = graph.nodes.find((n): n is IncomeNode => n.category === 'income')!;
  const current = simulation?.overAllocated ? null : simulation?.months.find(m => m.month === month) ?? simulation?.months.at(-1) ?? null;
  const nodeValues = current?.nodeValues ?? Object.fromEntries(graph.nodes.map(n => [n.id, n.currentValue]));
  const lockedNodes = graph.nodes.filter(n => !n.unlocked).sort((a, b) => a.unlockRank - b.unlockRank);
  const nextNodeId = nextDrawerNodeId(graph);
  const existingEdge = editingNode ? graph.edges.find(e => e.target === editingNode.id) ?? null : null;

  return (
    <div className="fg-root">
      <header className="fg-topbar">
        <div>
          <span className="fg-eyebrow">Finance Graph</span>
          <h1>Net worth: ${(current?.netWorth ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</h1>
        </div>
        <p className="fg-disclaimer">Educational tool only — not financial advice.</p>
        <button className="fg-button fg-text-button" onClick={() => { if (confirm('Reset your Finance Graph and start over? This clears everything, including automations and the current ranking.')) reset(); }}>
          Reset
        </button>
      </header>

      <div className="fg-body">
        <div className="fg-canvas-wrap">
          <GraphCanvas
            graph={graph}
            nodeValues={nodeValues}
            onNodeClick={setEditingNode}
            onDropNode={placeNodeOnBoard}
            onMoveNode={moveNodeOnBoard}
            onReturnToDrawer={(nodeId) => { returnNodeToDrawer(nodeId); if (editingNode?.id === nodeId) setEditingNode(null); }}
            onConnectRequest={(aId, bId) => {
              // Right-click-hold-drag between two nodes: the non-income end is the
              // allocation target (income is always the implicit source/spender).
              const a = graph.nodes.find(n => n.id === aId);
              const b = graph.nodes.find(n => n.id === bId);
              const target = a?.category === 'income' ? b : b?.category === 'income' ? a : b;
              if (target && target.category !== 'income') setEditingNode(target);
            }}
          />
        </div>

        <aside className="fg-side-panel">
          <NodeDrawer lockedNodes={lockedNodes} nextNodeId={nextNodeId} />

          {simulation?.overAllocated && (
            <div className="fg-leak">Allocations exceed 100% of income — simulation blocked. Reduce an allocation below.</div>
          )}
          {!simulation?.overAllocated && current && <LeakIndicator leak={current.leak} />}

          <div className="fg-panel">
            <NetWorthChart userPath={simulation?.overAllocated ? [] : simulation?.months ?? []} ghostPath={benchmark?.months ?? []} markerMonth={month} />
          </div>

          <div className="fg-panel">
            <SessionGoalPicker goal={graph.settings.sessionGoal} onChange={setSessionGoal} />
          </div>

          <RecommendedSplit graph={graph} />

          <div className="fg-panel">
            <LifeEventsToggle enabled={graph.settings.lifeEventsEnabled} onChange={setLifeEventsEnabled} />
          </div>

          <GuidePanel nodes={graph.nodes} />
        </aside>
      </div>

      <TimeSlider month={month} maxMonth={horizonMonths} onChange={setMonth} />

      {editingNode && editingNode.category === 'spending' && (
        <NodeCostEditor
          node={editingNode}
          onSave={(cost) => { setNodeCost(editingNode.id, cost); setEditingNode(null); }}
          onClose={() => setEditingNode(null)}
        />
      )}

      {editingNode && editingNode.category !== 'spending' && (
        <AllocationEdgeEditor
          node={editingNode}
          income={income}
          existingEdge={existingEdge}
          onSave={(edge) => { setEdge(edge); setEditingNode(null); }}
          onRemove={() => { if (existingEdge) removeEdge(existingEdge.id); setEditingNode(null); }}
          onClose={() => setEditingNode(null)}
        />
      )}
    </div>
  );
}
