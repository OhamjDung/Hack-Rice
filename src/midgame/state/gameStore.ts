import { create } from 'zustand';
import type { MidgameState, PendingAllocation, AutomationBucket } from '../types.ts';
import { config, UPGRADES } from '../config.ts';
import {
  createMidgameState, finalizeAllocation, payForFood, spendOnHappiness, beginNextRound,
} from '../engine/roundLifecycle.ts';
import { tick as tickEngine } from '../engine/tickEngine.ts';
import { trySideHustleTap } from '../engine/sideHustleEngine.ts';
import { canToggleAutomation } from '../engine/automationEngine.ts';
import { resolveMicroEvent, findMicroEventDefinition } from '../engine/microEventEngine.ts';
import { correctAudit } from '../engine/eventEngine.ts';

const STORAGE_KEY = 'midgame-bookkeeping-v2';
const round2 = (n: number) => Math.round(n * 100) / 100;

interface GameStore {
  state: MidgameState;
  hydrated: boolean;
  hydrate: () => void;
  tick: (deltaMs: number, now: number) => void;
  allocate: (alloc: PendingAllocation) => void;
  continueToNextRound: () => void;
  spendHappiness: () => void;
  payFood: () => void;
  buyUpgrade: (id: string) => void;
  tapSideHustle: () => void;
  toggleAutomation: (bucket: AutomationBucket) => void;
  resolveMicroEvent: (id: string, accepted: boolean) => void;
  resolveAudit: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  state: createMidgameState(),
  hydrated: false,

  hydrate: () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) set({ state: JSON.parse(raw) as MidgameState });
    } catch { /* ignore corrupt save */ }
    set({ hydrated: true });
  },

  tick: (deltaMs, now) => set(s => ({ state: tickEngine(s.state, deltaMs, now) })),

  allocate: (alloc) => set(s => ({ state: finalizeAllocation(s.state, alloc) })),

  continueToNextRound: () => set(s => ({ state: beginNextRound(s.state) })),

  spendHappiness: () => set(s => ({ state: spendOnHappiness(s.state, 10) })),

  payFood: () => set(s => ({ state: payForFood(s.state) })),

  buyUpgrade: (id) => set(s => {
    const upgrade = UPGRADES.find(u => u.id === id);
    const state = s.state;
    if (!upgrade || state.player.upgrades.some(u => u.id === id) || state.player.buckets.cashReserve < upgrade.cost) return s;
    const next = structuredClone(state);
    next.player.buckets.cashReserve = round2(next.player.buckets.cashReserve - upgrade.cost);
    next.player.upgrades.push({ id: upgrade.id, decayReduction: upgrade.decayReduction });
    next.meta.log.push(`Bought ${upgrade.name} — happiness decay reduced.`);
    return { state: next };
  }),

  tapSideHustle: () => set(s => {
    const now = Date.now();
    const result = trySideHustleTap(s.state.player.sideHustle, now, config);
    if (!result.success) return s;
    const next = structuredClone(s.state);
    next.player.sideHustle = result.state;
    next.player.buckets.cashReserve = round2(next.player.buckets.cashReserve + result.cashReserveDelta);
    return { state: next };
  }),

  toggleAutomation: (bucket) => set(s => {
    if (!canToggleAutomation(s.state.round.round, config)) return s;
    const next = structuredClone(s.state);
    const current = next.player.automations[bucket];
    next.player.automations[bucket] = current.state === 'automated' || current.state === 'automated-interrupted'
      ? { state: 'manual' }
      : { state: 'automated' };
    return { state: next };
  }),

  resolveMicroEvent: (id, accepted) => set(s => {
    const active = s.state.round.activeMicroEvents.find(e => e.id === id);
    if (!active || active.resolved) return s;
    const def = findMicroEventDefinition(active.definitionId);
    if (!def) return s;
    const effect = resolveMicroEvent(def, accepted);
    const next = structuredClone(s.state);
    next.round.activeMicroEvents = next.round.activeMicroEvents.map(e => (e.id === id ? { ...e, resolved: true } : e));
    if (effect?.cashReserveDelta) next.player.buckets.cashReserve = round2(Math.max(0, next.player.buckets.cashReserve + effect.cashReserveDelta));
    if (effect?.happinessDelta) next.week.happiness = Math.min(config.happinessMax, round2(next.week.happiness + effect.happinessDelta));
    if (effect?.discountOnNeed === 'food') next.week.foodCostThisWeek = round2(Math.max(0, next.week.foodCostThisWeek - effect.percentOff!));
    return { state: next };
  }),

  resolveAudit: () => set(s => {
    const over = s.state.round.auditOverContribution;
    if (over == null) return s;
    const next = structuredClone(s.state);
    next.player.buckets = correctAudit(next.player.buckets, over);
    next.player.iraAnnualContributed = round2(next.player.iraAnnualContributed - over);
    next.round.auditOverContribution = null;
    next.meta.log.push(`Audit correction: $${over} moved back from IRA to Cash Reserve.`);
    return { state: next };
  }),
}));

if (typeof window !== 'undefined') {
  useGameStore.subscribe((s) => {
    if (!s.hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s.state)); } catch { /* quota/private mode */ }
  });
}
