import type { FinanceNode } from '../types';

// A running guide that grows as you unlock concepts — each unlocked concept keeps its
// step-by-step instructions here (separate from the "why" reasoning shown on hover).
export default function GuidePanel({ nodes }: { nodes: FinanceNode[] }) {
  const guided = nodes
    .filter(n => n.unlocked && n.category !== 'income' && n.category !== 'cash' && n.category !== 'spending' && n.instructions)
    .sort((a, b) => a.unlockRank - b.unlockRank);

  if (guided.length === 0) return null;

  return (
    <div className="fg-panel fg-guide">
      <p className="fg-eyebrow">Guide</p>
      <p className="fg-muted" style={{ marginBottom: 9 }}>Step-by-step for what you've unlocked so far.</p>
      <ul className="fg-guide-list">
        {guided.map(n => (
          <li key={n.id}>
            <span className="fg-guide-label">{n.label}</span>
            <span className="fg-guide-steps">{n.instructions}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
