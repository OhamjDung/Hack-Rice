import type { ActiveMicroEvent } from '../types';
import { MICRO_EVENT_POOL } from '../config';
import { useDragChip } from '../hooks/useDragChip';

const LABELS: Record<string, string> = {
  'spare-change': 'Found spare change',
  'tax-refund-trickle': 'Small tax refund trickle',
  'grocery-coupon': 'Grocery coupon',
  'happy-hour': 'Happy hour',
  'parking-ticket': 'Parking ticket',
};

// Fast, short-lived popup — drag the chip onto Accept before it expires, or ignore it (no penalty).
export default function MicroEventPopup({ event, onResolve }: { event: ActiveMicroEvent; onResolve: (id: string, accepted: boolean) => void }) {
  const def = MICRO_EVENT_POOL.find(d => d.id === event.definitionId);
  if (!def) return null;
  const remaining = Math.max(0, event.expiresAt - Date.now());

  const { dragging, position, chipProps } = useDragChip({
    amount: def.amount,
    onDrop: (dropId) => { if (dropId === 'accept') onResolve(event.id, true); },
  });

  return (
    <div className="mg-micro-event">
      <span>{LABELS[def.id] ?? def.id}</span>
      <div className="mg-micro-event-row">
        <div className="mg-cash-chip mg-cash-chip-small" {...chipProps}>{def.kind === 'minor_cost' ? '−' : '+'}${def.amount}</div>
        <div className="mg-drop-target mg-drop-target-small" data-drop-target="accept">Accept</div>
        <button className="mg-text-button" onClick={() => onResolve(event.id, false)}>Ignore</button>
      </div>
      <div className="mg-micro-event-timer" style={{ width: `${(remaining / (event.expiresAt - event.spawnedAt)) * 100}%` }} />
      {dragging && position && (
        <div className="mg-cash-chip mg-cash-chip-ghost" style={{ left: position.x, top: position.y }}>${def.amount}</div>
      )}
    </div>
  );
}
