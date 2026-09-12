'use client';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { emergencyFundProgress } from '../state/selectors';
import { getRoundSummary } from '../engine/roundLifecycle';
import RoundStartAllocation from './RoundStartAllocation';
import WeeklySurvivalHUD from './WeeklySurvivalHUD';
import RoundEndSummary from './RoundEndSummary';
import UpgradeShop from './UpgradeShop';
import MicroEventPopup from './MicroEventPopup';
import AuditCorrectionModal from './AuditCorrectionModal';
import '../midgame.css';

export default function BookkeepingGame() {
  const { state, hydrated, hydrate, tick, allocate, continueToNextRound, spendHappiness, payFood, buyUpgrade, tapSideHustle, toggleAutomation, resolveMicroEvent, resolveAudit } = useGameStore();
  const [showUpgrades, setShowUpgrades] = useState(false);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    let raf: number;
    const frame = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      tick(delta, Date.now());
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tick]);

  if (!hydrated) return null;

  const { meta, round } = state;

  return (
    <div className="mg-root">
      <header className="mg-topbar">
        <span className="mg-eyebrow">Bookkeeping</span>
        <h1>Round {round.round} · Week {Math.min(round.weekIndex, 4)}/4 · Year {round.year}</h1>
      </header>

      {!meta.unlocked && (
        <section className="mg-panel mg-lockscreen">
          <p className="mg-eyebrow">Emergency fund</p>
          <div className="mg-track"><div className="mg-track-fill" style={{ width: `${emergencyFundProgress(state)}%` }} /></div>
          <p className="mg-muted">${meta.emergencyFundBalance.toFixed(0)} / ${meta.emergencyFundThreshold.toFixed(0)} (3x monthly expenses)</p>
          <p className="mg-muted">Once your safe tier hits this threshold, Bookkeeping unlocks: employer 401(k) match, an IRA, and real paycheck decisions.</p>
        </section>
      )}

      {meta.unlocked && (
        <>
          <WeeklySurvivalHUD
            state={state}
            onSpendHappiness={spendHappiness}
            onPayFood={payFood}
            onOpenUpgrades={() => setShowUpgrades(true)}
            onToggleAutomation={toggleAutomation}
            onTapSideHustle={tapSideHustle}
          />

          {round.phase === 'weekly-survival' && round.activeMicroEvents.filter(e => !e.resolved).map(e => (
            <MicroEventPopup key={e.id} event={e} onResolve={resolveMicroEvent} />
          ))}

          {round.phase === 'allocation' && round.auditOverContribution == null && (
            <RoundStartAllocation mode="allocate" state={state} onAllocate={allocate} />
          )}

          {round.phase === 'allocation' && round.auditOverContribution != null && (
            <AuditCorrectionModal overContribution={round.auditOverContribution} onResolve={resolveAudit} />
          )}

          {showUpgrades && (
            <UpgradeShop state={state} onBuy={buyUpgrade} onClose={() => setShowUpgrades(false)} />
          )}

          {round.phase === 'summary' && (
            <RoundEndSummary summary={getRoundSummary(state)} onContinue={continueToNextRound} />
          )}

          <div className="mg-log">
            {meta.log.slice(-6).map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </>
      )}
    </div>
  );
}
