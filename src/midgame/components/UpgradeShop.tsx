import type { MidgameState } from '../types';
import { UPGRADES } from '../config';

interface Props { state: MidgameState; onBuy: (id: string) => void; onClose: () => void }

export default function UpgradeShop({ state, onBuy, onClose }: Props) {
  return (
    <dialog open className="mg-modal">
      <h2>Self-improvement upgrades</h2>
      <p className="mg-muted">One-time purchases from Cash Reserve that permanently reduce happiness decay.</p>
      <ul className="mg-upgrade-list">
        {UPGRADES.map(u => {
          const owned = state.player.upgrades.some(owned => owned.id === u.id);
          return (
            <li key={u.id}>
              <span>{u.name} — ${u.cost} ({Math.round(u.decayReduction * 100)}% decay reduction)</span>
              <button className="mg-button mg-secondary" disabled={owned || state.player.buckets.cashReserve < u.cost} onClick={() => onBuy(u.id)}>
                {owned ? 'Owned' : 'Buy'}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mg-modal-actions">
        <button className="mg-button mg-text-button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}
