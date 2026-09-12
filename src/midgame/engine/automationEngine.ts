import type { AutomationStatus, EventType, GameConfig } from '../types.ts';

export function interruptAutomation(status: AutomationStatus, reason: EventType): AutomationStatus {
  if (status.state !== 'automated') return status;
  return { state: 'automated-interrupted', reason };
}

// Called once the player manually redoes the allocation for that bucket this round.
export function resolveInterruptedBucket(status: AutomationStatus): AutomationStatus {
  return { state: 'automated' };
}

export function canToggleAutomation(round: number, cfg: GameConfig): boolean {
  return round >= cfg.automationUnlockRound;
}

// Rolls whether an automated bucket gets knocked back to manual this round (never permanently lost).
export function rollAutomationInterruptions(
  automations: Record<'four01k' | 'ira', AutomationStatus>,
  cfg: GameConfig,
  reason: EventType = 'other',
): Record<'four01k' | 'ira', AutomationStatus> {
  return {
    four01k: Math.random() < cfg.automationEventChance ? interruptAutomation(automations.four01k, reason) : automations.four01k,
    ira: Math.random() < cfg.automationEventChance ? interruptAutomation(automations.ira, reason) : automations.ira,
  };
}
