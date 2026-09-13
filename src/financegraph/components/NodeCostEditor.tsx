import { useState } from 'react';
import type { FinanceNode } from '../types';

interface Props {
  node: FinanceNode;
  onSave: (monthlyCost: number) => void;
  onClose: () => void;
}

// Spending/insurance nodes aren't funded by an edge from Income — they're a fixed monthly
// drain the model reserves before anything else (see benchmark.ts's mandatory-cost pass).
// This is the only place that monthly amount gets set.
export default function NodeCostEditor({ node, onSave, onClose }: Props) {
  const [cost, setCost] = useState(node.currentValue);

  return (
    <dialog open className="fg-modal">
      <h2>{node.label}</h2>
      <p className="fg-muted" style={{ marginBottom: 13 }}>Monthly cost — reserved automatically before any investing recommendation.</p>
      <label>Monthly cost ($)
        <span className="fg-slider-row">
          <input type="range" min={0} max={5000} step={25} value={cost} onChange={e => setCost(Number(e.target.value))} />
          <span className="fg-slider-value">${cost}</span>
        </span>
      </label>
      <div className="fg-modal-actions">
        <button className="fg-button fg-secondary" onClick={onClose}>Cancel</button>
        <button className="fg-button fg-primary" onClick={() => onSave(cost)}>Save</button>
      </div>
    </dialog>
  );
}
