import type { SideHustleState } from '../types';
import { config } from '../config';

export default function SideHustleButton({ sideHustle, onTap }: { sideHustle: SideHustleState; onTap: () => void }) {
  const cooldownActive = sideHustle.lastTapAt != null && Date.now() - sideHustle.lastTapAt < config.sideHustle.cooldownMs;
  const capReached = config.sideHustle.earningsCapPerRound != null && sideHustle.earnedThisRound >= config.sideHustle.earningsCapPerRound;
  return (
    <button className="mg-button mg-secondary" onClick={onTap} disabled={cooldownActive || capReached}>
      {capReached ? 'Cap reached this round' : cooldownActive ? 'Cooling down...' : `Tap for $${config.sideHustle.perTapAmount}`}
    </button>
  );
}
