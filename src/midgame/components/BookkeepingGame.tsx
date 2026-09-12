'use client';
import { useEffect, useRef, useState } from 'react';
import type { MidgameState, PendingAllocation } from '../types';
import {
  createMidgameState, tickPreUnlock, tickHappiness, startRound, finalizeAllocation,
  advanceWeek, buyUpgrade, spendOnHappiness, payForFood, toggleAutomation,
  matchFor, iraRemainingCap, getRoundSummary,
} from '../engine';
import { WEEK_MS } from '../constants';
import PaycheckModal from './PaycheckModal';
import WeeklyHud from './WeeklyHud';
import RoundSummary from './RoundSummary';
import UpgradeShop from './UpgradeShop';
import '../midgame.css';

const STORAGE_KEY = 'midgame-bookkeeping-v1';

function loadInitial(): MidgameState {
  if (typeof window === 'undefined') return createMidgameState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MidgameState;
  } catch { /* ignore corrupt save */ }
  return createMidgameState();
}

export default function BookkeepingGame() {
  const [state, setState] = useState<MidgameState>(loadInitial);
  const [showSummary, setShowSummary] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const weekElapsedRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota/private mode */ }
  }, [state]);

  useEffect(() => {
    let raf: number;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setState(prev => {
        if (prev.isGameOver) return prev;
        if (!prev.unlocked) return tickPreUnlock(prev, delta);
        if (!prev.isRoundActive) return prev;
        weekElapsedRef.current += delta;
        let next = tickHappiness(prev, delta);
        if (weekElapsedRef.current >= WEEK_MS) {
          weekElapsedRef.current = 0;
          const wasLastWeek = next.week >= 4;
          next = advanceWeek(next);
          if (wasLastWeek) setShowSummary(true);
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const beginRoundIfNeeded = () => {
    setState(prev => (prev.unlocked && prev.pendingPaycheck == null && !prev.isRoundActive && prev.round > 1 ? startRound(prev) : prev));
  };

  const handleAllocate = (alloc: PendingAllocation, bills: number) => {
    setState(prev => finalizeAllocation(prev, alloc, bills));
    weekElapsedRef.current = 0;
  };

  const summary = showSummary ? getRoundSummary(state) : null;

  return (
    <div className="mg-root">
      <header className="mg-topbar">
        <span className="mg-eyebrow">Bookkeeping</span>
        <h1>Round {state.round} · Week {Math.min(state.week, 4)}/4 · Year {state.year}</h1>
      </header>

      {!state.unlocked && (
        <section className="mg-panel mg-lockscreen">
          <p className="mg-eyebrow">Emergency fund</p>
          <div className="mg-track"><div className="mg-track-fill" style={{ width: `${Math.min(100, (state.emergencyFundBalance / state.emergencyFundThreshold) * 100)}%` }} /></div>
          <p className="mg-muted">${state.emergencyFundBalance.toFixed(0)} / ${state.emergencyFundThreshold.toFixed(0)} (3x monthly expenses)</p>
          <p className="mg-muted">Once your safe tier hits this threshold, Bookkeeping unlocks: employer 401(k) match, an IRA, and real paycheck decisions.</p>
        </section>
      )}

      {state.unlocked && (
        <>
          <WeeklyHud
            state={state}
            onSpendHappiness={() => setState(spendOnHappiness)}
            onPayFood={() => setState(payForFood)}
            onOpenUpgrades={() => setShowUpgrades(true)}
            onToggleAutomation={(b) => setState(s => toggleAutomation(s, b))}
          />

          {state.pendingPaycheck != null && (
            <PaycheckModal
              state={state}
              matchFor={matchFor}
              iraRemainingCap={iraRemainingCap(state)}
              onAllocate={handleAllocate}
            />
          )}

          {showUpgrades && (
            <UpgradeShop state={state} onBuy={(id) => setState(s => buyUpgrade(s, id))} onClose={() => setShowUpgrades(false)} />
          )}

          {showSummary && summary && (
            <RoundSummary summary={summary} onContinue={() => { setShowSummary(false); beginRoundIfNeeded(); }} />
          )}

          <div className="mg-log">
            {state.log.slice(-6).map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </>
      )}
    </div>
  );
}
