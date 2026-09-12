import type { AutomationStatus } from '../types';

// "On autopilot" indicator — automated buckets stay visible, never disappear from the UI.
export default function AutomationBadge({ label, status, onToggle }: { label: string; status: AutomationStatus; onToggle: () => void }) {
  const automated = status.state === 'automated' || status.state === 'automated-interrupted';
  const interrupted = status.state === 'automated-interrupted';
  return (
    <label className={`mg-automation-badge${automated ? ' on' : ''}${interrupted ? ' interrupted' : ''}`}>
      <input type="checkbox" checked={automated} onChange={onToggle} />
      {label} {interrupted ? '(interrupted — reallocate this round)' : automated ? '(on autopilot)' : ''}
    </label>
  );
}
