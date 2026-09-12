import type { Debuff, WeekState } from '../types.ts';
import type { GameConfig } from '../types.ts';

// Weekly need resolution: runs at week boundary, stacks (both can apply at once, per PLAN.md Section 5).
export function resolveWeekEnd(week: WeekState, cfg: GameConfig): { happinessMet: boolean; foodMet: boolean } {
  return {
    happinessMet: week.happiness >= cfg.happinessMetThreshold,
    foodMet: week.foodMetThisWeek,
  };
}

function upsert(debuffs: Debuff[], id: Debuff['id'], triggeredBy: Debuff['triggeredBy']): Debuff[] {
  const existing = debuffs.find(d => d.id === id);
  if (existing) return debuffs.map(d => (d.id === id ? { ...d, weeksRemaining: 1 } : d));
  return [...debuffs, { id, triggeredBy, weeksRemaining: 1 }];
}

// One clean week (need met) clears its debuff; missing it again keeps/renews it. Stacks independently.
export function applyDebuffs(current: Debuff[], happinessMet: boolean, foodMet: boolean): Debuff[] {
  let next = current.filter(d => (d.id === 'hungry' ? !foodMet : d.id === 'unhappy' ? !happinessMet : true));
  if (!foodMet) next = upsert(next, 'hungry', 'food');
  if (!happinessMet) next = upsert(next, 'unhappy', 'happiness');
  return next;
}

export function hasDebuff(debuffs: Debuff[], id: Debuff['id']): boolean {
  return debuffs.some(d => d.id === id);
}
