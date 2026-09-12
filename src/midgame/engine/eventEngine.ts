import type { EventType, GameEvent, Buckets } from '../types.ts';
import { config } from '../config.ts';

export interface EventEffect {
  cashReserveDelta?: number;
  iraAnnualCapDelta?: number;
  log: string;
}

const CAR_REPAIR_COST = 300;
const BONUS_AMOUNT = 150;

// One larger random event per round, low probability, drawn independently of micro-events.
export function rollRandomEvent(round: number): GameEvent | null {
  if (Math.random() > 0.15) return null;
  const pool: EventType[] = ['bonus', 'cap_change', 'car_repair'];
  const type = pool[Math.floor(Math.random() * pool.length)];
  return { type, round, payload: {} };
}

export function applyEventEffect(event: GameEvent): EventEffect {
  switch (event.type) {
    case 'bonus': return { cashReserveDelta: BONUS_AMOUNT, log: `Bonus! +$${BONUS_AMOUNT} to Cash Reserve.` };
    case 'car_repair': return { cashReserveDelta: -CAR_REPAIR_COST, log: `Car repair — $${CAR_REPAIR_COST} out of Cash Reserve.` };
    case 'cap_change': {
      const delta = Math.round((Math.random() * 400 - 200) / 10) * 10;
      return { iraAnnualCapDelta: delta, log: `IRA annual cap adjusted by $${delta} this year.` };
    }
    default: return { log: 'Event occurred.' };
  }
}

// Detects an over-cap IRA contribution (from a mid-year cap_change event) that needs correction.
export function detectAudit(iraAnnualContributed: number, iraAnnualCap: number = config.iraAnnualCap): number | null {
  const over = iraAnnualContributed - iraAnnualCap;
  return over > 0 ? Math.round(over * 100) / 100 : null;
}

// Applied by AuditCorrectionModal: pulls the excess out of IRA back into Cash Reserve.
export function correctAudit(buckets: Buckets, overContribution: number): Buckets {
  return {
    ...buckets,
    ira: Math.round((buckets.ira - overContribution) * 100) / 100,
    cashReserve: Math.round((buckets.cashReserve + overContribution) * 100) / 100,
  };
}
