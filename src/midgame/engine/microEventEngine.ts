import type { ActiveMicroEvent, MicroEventDefinition, MicroEventKind, GameConfig } from '../types.ts';
import { MICRO_EVENT_POOL } from '../config.ts';

function weightedRandomPick(pool: readonly MicroEventDefinition[]): MicroEventDefinition {
  const total = pool.reduce((sum, d) => sum + d.weight, 0);
  let roll = Math.random() * total;
  for (const def of pool) {
    roll -= def.weight;
    if (roll <= 0) return def;
  }
  return pool[pool.length - 1];
}

export function spawnMicroEvent(now: number, cfg: GameConfig, pool: readonly MicroEventDefinition[] = MICRO_EVENT_POOL): ActiveMicroEvent {
  const def = weightedRandomPick(pool);
  return {
    id: `${def.id}-${now}-${Math.random().toString(36).slice(2, 8)}`,
    definitionId: def.id,
    spawnedAt: now,
    expiresAt: now + cfg.microEvent.reactionWindowMs,
    resolved: false,
  };
}

// Events past expiresAt with resolved:false are dropped — upside-only, no penalty (design lean).
export function expireStaleMicroEvents(active: ActiveMicroEvent[], now: number): ActiveMicroEvent[] {
  return active.filter(e => e.resolved || now < e.expiresAt);
}

export interface MicroEventEffect {
  cashReserveDelta?: number;
  happinessDelta?: number;
  discountOnNeed?: 'food' | 'happiness';
  percentOff?: number;
}

export function resolveMicroEvent(def: MicroEventDefinition, accepted: boolean): MicroEventEffect | null {
  if (!accepted) return null;
  const kind: MicroEventKind = def.kind;
  switch (kind) {
    case 'windfall': return { cashReserveDelta: def.amount };
    case 'discount': return { discountOnNeed: def.targetNeed, percentOff: def.amount };
    case 'happiness_boost': return { happinessDelta: def.amount };
    case 'minor_cost': return { cashReserveDelta: -def.amount };
  }
}

export function findMicroEventDefinition(id: string, pool: readonly MicroEventDefinition[] = MICRO_EVENT_POOL): MicroEventDefinition | undefined {
  return pool.find(d => d.id === id);
}
