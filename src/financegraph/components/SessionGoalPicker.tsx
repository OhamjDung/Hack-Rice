import type { SessionGoal } from '../types';

const GOALS: { id: SessionGoal; label: string }[] = [
  { id: 'max_net_worth', label: 'Max net worth' },
  { id: 'fastest_fi', label: 'Fastest FI' },
  { id: 'min_risk', label: 'Min risk' },
];

export default function SessionGoalPicker({ goal, onChange }: { goal: SessionGoal; onChange: (g: SessionGoal) => void }) {
  return (
    <div>
      <span className="fg-eyebrow">Benchmark goal</span>
      <div className="fg-goal-row" style={{ marginTop: 7 }}>
        {GOALS.map(g => (
          <button key={g.id} className={`fg-goal-chip${g.id === goal ? ' active' : ''}`} onClick={() => onChange(g.id)}>{g.label}</button>
        ))}
      </div>
    </div>
  );
}
