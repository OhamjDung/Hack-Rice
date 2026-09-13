import { useState } from 'react';
import type { AllocationEdge, AmountType, FinanceNode, IncomeNode } from '../types';

interface Props {
  node: FinanceNode;
  income: IncomeNode;
  existingEdge: AllocationEdge | null;
  onSave: (edge: AllocationEdge) => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function AllocationEdgeEditor({ node, income, existingEdge, onSave, onRemove, onClose }: Props) {
  const [amountType, setAmountType] = useState<AmountType>(existingEdge?.amountType ?? 'percent');
  const [value, setValue] = useState(existingEdge?.value ?? 0);
  const edgeType = node.category === 'debt' || node.category === 'asset' ? 'payment' : 'allocation';
  const monthlyIncome = income.annualGross / 12;
  const estimatedDollar = amountType === 'percent' ? monthlyIncome * (value / 100) : value;

  return (
    <dialog open className="fg-modal">
      <h2>{node.label}</h2>
      <p className="fg-muted" style={{ marginBottom: 13 }}>{edgeType === 'payment' ? 'Monthly payment toward this' : 'Monthly allocation into this'}, from Income.</p>

      <label>Type
        <select value={amountType} onChange={e => setAmountType(e.target.value as AmountType)}>
          <option value="percent">% of income</option>
          <option value="fixed">$ fixed / month</option>
        </select>
      </label>
      <label>{amountType === 'percent' ? 'Percent' : 'Dollars / month'}
        <span className="fg-slider-row">
          <input type="range" min={0} max={amountType === 'percent' ? 100 : Math.max(Math.round(monthlyIncome), 100)}
            step={amountType === 'percent' ? 1 : 10} value={value} onChange={e => setValue(Number(e.target.value))} />
          <span className="fg-slider-value">{amountType === 'percent' ? `${value}%` : `$${value}`}</span>
        </span>
      </label>
      <p className="fg-muted">≈ ${estimatedDollar.toFixed(0)}/month</p>

      <div className="fg-modal-actions">
        {existingEdge && <button className="fg-button fg-text-button" onClick={onRemove}>Remove</button>}
        <button className="fg-button fg-secondary" onClick={onClose}>Cancel</button>
        <button className="fg-button fg-primary" disabled={value <= 0}
          onClick={() => onSave({ id: existingEdge?.id ?? `edge-${income.id}-${node.id}`, source: income.id, target: node.id, type: edgeType, amountType, value })}>
          Save
        </button>
      </div>
    </dialog>
  );
}
