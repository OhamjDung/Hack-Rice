import { useMemo, useState } from 'react';
import type { GraphState, IncomeNode } from '../types';
import { buildWaterfallEdges } from '../engine/benchmark';

// Optimal-split button: recomputes live from whatever nodes are actually placed on the
// board right now (via the same waterfall allocator that drives the ghost line) — add or
// remove a node and the recommendation reshapes around exactly what's there.
export default function RecommendedSplit({ graph }: { graph: GraphState }) {
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    if (!open) return [];
    const income = graph.nodes.find((n): n is IncomeNode => n.category === 'income');
    const monthlyIncome = income ? income.annualGross / 12 : 0;
    if (monthlyIncome <= 0) return [];
    const edges = buildWaterfallEdges(graph);
    const totalAllocated = edges.reduce((sum, e) => sum + e.value, 0);
    return edges
      .map(e => {
        const node = graph.nodes.find(n => n.id === e.target);
        const mandatory = e.id.startsWith('ghost-mandatory-');
        return node ? { label: `${node.label}${mandatory ? ' (mandatory)' : ''}`, percent: (e.value / monthlyIncome) * 100, dollars: e.value } : null;
      })
      .filter((r): r is { label: string; percent: number; dollars: number } => r != null)
      .concat([{ label: 'Unallocated (leak)', percent: ((monthlyIncome - totalAllocated) / monthlyIncome) * 100, dollars: monthlyIncome - totalAllocated }])
      .filter(r => r.percent > 0.05);
  }, [graph, open]);

  return (
    <div className="fg-panel">
      <button className="fg-button fg-secondary" onClick={() => setOpen(o => !o)}>
        {open ? 'Hide' : 'Show'} optimal split for this board
      </button>
      {open && (
        <ul className="fg-recommended-list">
          {rows.length === 0 && <li className="fg-muted">Place a node to see a recommendation.</li>}
          {rows.map(r => (
            <li key={r.label}>
              <span>{r.label}</span>
              <span>{r.percent.toFixed(0)}% (${r.dollars.toFixed(0)})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
