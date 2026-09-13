// Life-event injection — seeded and deterministic so a run is reproducible.
import type { EventSubtype } from '../types.ts';

// mulberry32: small, fast, deterministic PRNG.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LifeEventDefinition { type: EventSubtype; monthlyChance: number; cost: number }

export const LIFE_EVENT_POOL: LifeEventDefinition[] = [
  { type: 'job_loss', monthlyChance: 0.003, cost: 0 }, // cost modeled as income loss in simulate.ts
  { type: 'market_crash', monthlyChance: 0.002, cost: 0 }, // modeled as a one-time % hit to accounts
  { type: 'medical_emergency', monthlyChance: 0.004, cost: 8000 },
];

// Deterministic per-month roll: same seed + month always produces the same result.
export function rollEventsForMonth(seed: number, month: number, enabled: boolean): EventSubtype[] {
  if (!enabled) return [];
  const rand = mulberry32(seed + month * 7919); // distinct stream per month
  const fired: EventSubtype[] = [];
  for (const def of LIFE_EVENT_POOL) {
    if (rand() < def.monthlyChance) fired.push(def.type);
  }
  return fired;
}

export function eventCost(type: EventSubtype): number {
  return LIFE_EVENT_POOL.find(e => e.type === type)?.cost ?? 0;
}
