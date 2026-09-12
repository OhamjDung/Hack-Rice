import type { SideHustleState, GameConfig } from '../types.ts';

export interface SideHustleTapResult { success: boolean; state: SideHustleState; cashReserveDelta: number }

// Tap handling with cooldown + optional per-round earnings cap (PLAN.md Section 5).
export function trySideHustleTap(state: SideHustleState, now: number, cfg: GameConfig): SideHustleTapResult {
  if (state.lastTapAt !== null && now - state.lastTapAt < cfg.sideHustle.cooldownMs) {
    return { success: false, state, cashReserveDelta: 0 };
  }
  const remainingCap = cfg.sideHustle.earningsCapPerRound != null
    ? Math.max(0, cfg.sideHustle.earningsCapPerRound - state.earnedThisRound)
    : Infinity;
  const earn = Math.min(cfg.sideHustle.perTapAmount, remainingCap);
  if (earn <= 0) return { success: false, state, cashReserveDelta: 0 };
  return {
    success: true,
    state: { ...state, lastTapAt: now, earnedThisRound: state.earnedThisRound + earn },
    cashReserveDelta: earn,
  };
}

export function resetSideHustleForRound(): SideHustleState {
  return { lastTapAt: null, earnedThisRound: 0 };
}
