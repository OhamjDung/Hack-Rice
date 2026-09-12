import type { MidgameState, AutomationBucket } from '../types';
import { netWorth } from '../state/selectors';
import { config } from '../config';
import AutomationBadge from './AutomationBadge';
import SideHustleButton from './SideHustleButton';

interface Props {
  state: MidgameState;
  onSpendHappiness: () => void;
  onPayFood: () => void;
  onOpenUpgrades: () => void;
  onToggleAutomation: (bucket: AutomationBucket) => void;
  onTapSideHustle: () => void;
}

export default function WeeklySurvivalHUD({ state, onSpendHappiness, onPayFood, onOpenUpgrades, onToggleAutomation, onTapSideHustle }: Props) {
  const { week, player, round } = state;

  return (
    <section className="mg-panel mg-hud">
      <div className="mg-vital">
        <span className="mg-eyebrow">Happiness</span>
        <div className="mg-track"><div className="mg-track-fill mood" style={{ width: `${week.happiness}%` }} /></div>
        <button className="mg-button mg-secondary" onClick={onSpendHappiness} disabled={player.buckets.cashReserve < 10}>
          Spend $10 on happiness
        </button>
      </div>

      <div className="mg-vital">
        <span className="mg-eyebrow">Food this week</span>
        <button className="mg-button mg-secondary" onClick={onPayFood} disabled={week.foodMetThisWeek || player.buckets.cashReserve < week.foodCostThisWeek}>
          {week.foodMetThisWeek ? 'Groceries covered' : `Buy groceries ($${week.foodCostThisWeek.toFixed(0)})`}
        </button>
      </div>

      <div className="mg-vital">
        <span className="mg-eyebrow">Side hustle</span>
        <SideHustleButton sideHustle={player.sideHustle} onTap={onTapSideHustle} />
      </div>

      {round.activeDebuffs.length > 0 && (
        <div className="mg-debuffs">
          {round.activeDebuffs.map(d => (
            <span key={d.id} className="mg-debuff-chip">{d.id === 'hungry' ? 'Hungry — happiness drains faster' : 'Unhappy — food costs more'}</span>
          ))}
        </div>
      )}

      <div className="mg-buckets">
        <span>Cash Reserve <b>${player.buckets.cashReserve.toFixed(0)}</b></span>
        <span>Invested <b>${player.buckets.invested.toFixed(0)}</b></span>
        <span>401(k) <b>${player.buckets.four01k.toFixed(0)}</b></span>
        <span>IRA <b>${player.buckets.ira.toFixed(0)}</b></span>
        <span>Net Worth <b>${netWorth(state).toFixed(0)}</b></span>
      </div>

      <div className="mg-hud-actions">
        <button className="mg-button mg-text-button" onClick={onOpenUpgrades}>Self-improvement upgrades</button>
        {round.round >= config.automationUnlockRound && (
          <div className="mg-automation-row">
            <AutomationBadge label="401(k)" status={player.automations.four01k} onToggle={() => onToggleAutomation('four01k')} />
            <AutomationBadge label="IRA" status={player.automations.ira} onToggle={() => onToggleAutomation('ira')} />
          </div>
        )}
      </div>

      {player.matchStreak > 0 && <p className="mg-streak">Match streak: {player.matchStreak} round{player.matchStreak === 1 ? '' : 's'}</p>}
      {player.readyForRiskyTier && <p className="mg-streak">Ready for the risky/late-game tier.</p>}
    </section>
  );
}
