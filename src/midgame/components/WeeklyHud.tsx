import type { MidgameState } from '../types';
import { AUTOMATION_UNLOCK_ROUND, HAPPINESS_SPEND_UNIT } from '../constants';

interface Props {
  state: MidgameState;
  onSpendHappiness: () => void;
  onPayFood: () => void;
  onOpenUpgrades: () => void;
  onToggleAutomation: (bucket: 'four01k' | 'ira') => void;
}

export default function WeeklyHud({ state, onSpendHappiness, onPayFood, onOpenUpgrades, onToggleAutomation }: Props) {
  const netWorth = state.buckets.four01k + state.buckets.ira + state.buckets.cashReserve + state.buckets.invested;
  return (
    <section className="mg-panel mg-hud">
      <div className="mg-vital">
        <span className="mg-eyebrow">Happiness</span>
        <div className="mg-track"><div className="mg-track-fill mood" style={{ width: `${state.happiness}%` }} /></div>
        <button className="mg-button mg-secondary" onClick={onSpendHappiness} disabled={state.buckets.cashReserve < HAPPINESS_SPEND_UNIT}>
          Spend ${HAPPINESS_SPEND_UNIT} on happiness
        </button>
      </div>

      <div className="mg-vital">
        <span className="mg-eyebrow">Food this week</span>
        <button className="mg-button mg-secondary" onClick={onPayFood} disabled={state.foodMetThisWeek || state.buckets.cashReserve < state.foodCostThisWeek}>
          {state.foodMetThisWeek ? 'Groceries covered' : `Buy groceries ($${state.foodCostThisWeek.toFixed(0)})`}
        </button>
      </div>

      {state.debuffs.length > 0 && (
        <div className="mg-debuffs">
          {state.debuffs.map(d => (
            <span key={d.id} className="mg-debuff-chip">{d.id === 'hungry' ? 'Hungry — happiness drains faster' : 'Unhappy — food costs more'}</span>
          ))}
        </div>
      )}

      <div className="mg-buckets">
        <span>Cash Reserve <b>${state.buckets.cashReserve.toFixed(0)}</b></span>
        <span>Invested <b>${state.buckets.invested.toFixed(0)}</b></span>
        <span>401(k) <b>${state.buckets.four01k.toFixed(0)}</b></span>
        <span>IRA <b>${state.buckets.ira.toFixed(0)}</b></span>
        <span>Net Worth <b>${netWorth.toFixed(0)}</b></span>
      </div>

      <div className="mg-hud-actions">
        <button className="mg-button mg-text-button" onClick={onOpenUpgrades}>Self-improvement upgrades</button>
        {state.round >= AUTOMATION_UNLOCK_ROUND && (
          <div className="mg-automation-row">
            <label><input type="checkbox" checked={state.automations.four01k} onChange={() => onToggleAutomation('four01k')} /> Auto 401(k){state.automationInterrupted.four01k ? ' (interrupted — reallocate this round)' : ''}</label>
            <label><input type="checkbox" checked={state.automations.ira} onChange={() => onToggleAutomation('ira')} /> Auto IRA{state.automationInterrupted.ira ? ' (interrupted — reallocate this round)' : ''}</label>
          </div>
        )}
      </div>

      {state.matchStreak > 0 && <p className="mg-streak">Match streak: {state.matchStreak} round{state.matchStreak === 1 ? '' : 's'}</p>}
      {state.readyForRiskyTier && <p className="mg-streak">Ready for the risky/late-game tier.</p>}
    </section>
  );
}
