import type { MidgameState } from '../types.ts';
import { config } from '../config.ts';
import { tickPreUnlock, tickHappiness, advanceWeek } from './roundLifecycle.ts';
import { spawnMicroEvent, expireStaleMicroEvents } from './microEventEngine.ts';

const clone = <T,>(s: T): T => structuredClone(s);

// Single per-frame tick: happiness decay, micro-event spawn/expire, week-boundary
// advance, pre-unlock growth. `now` is a monotonic timestamp (e.g. performance.now())
// used for micro-event lifetimes.
export function tick(input: MidgameState, deltaMs: number, now: number): MidgameState {
  if (input.meta.isGameOver) return input;
  if (!input.meta.unlocked) return tickPreUnlock(input, deltaMs);

  let state = tickHappiness(input, deltaMs);

  if (state.round.phase === 'weekly-survival') {
    state = clone(state);
    state.round.microEventElapsedMs += deltaMs;
    state.round.activeMicroEvents = expireStaleMicroEvents(state.round.activeMicroEvents, now);
    if (state.round.microEventElapsedMs >= config.microEvent.spawnIntervalMs) {
      state.round.microEventElapsedMs = 0;
      state.round.activeMicroEvents = [...state.round.activeMicroEvents, spawnMicroEvent(now, config)];
    }

    state.round.weekElapsedMs += deltaMs;
    if (state.round.weekElapsedMs >= config.weekDurationMs) {
      state = advanceWeek(state);
    }
  }

  return state;
}
