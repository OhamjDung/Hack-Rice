'use client';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeft, Landmark } from 'lucide-react';
import type { GameState } from '@/engine/Types';
import type { AllocationFields } from '@/engine/Investing';
import AllocationPanel from './AllocationPanel';
import TradingFloor, { type TradingFloorHandle } from './TradingFloor';
import ProjectionPanel from './ProjectionPanel';
type InvestTab = 'allocate' | 'trade' | 'projection';
export type InvestScreenHandle = { leaveTrading: () => void };
const InvestScreen = forwardRef<InvestScreenHandle, {
    game: GameState;
    onClose: () => void;
    onCommit: (alloc: Partial<AllocationFields>) => void;
    onSettleBrokerage: (finalCash: number, pnl: number) => void;
}>(function InvestScreen({ game, onClose, onCommit, onSettleBrokerage }, ref) {
    const [tab, setTab] = useState<InvestTab>(game.investing.today ? 'projection' : 'allocate');
    const floorRef = useRef<TradingFloorHandle>(null);
    useImperativeHandle(ref, () => ({ leaveTrading: () => floorRef.current?.leaveSession() }), []);
    // Leaving the Trade tab (for any tab, or for the room) settles the session right here, in the click
    // handler itself — not via effect cleanup, which Strict Mode double-invokes right after mount.
    function goTo(next: InvestTab) { if (tab === 'trade' && next !== 'trade') floorRef.current?.leaveSession(); setTab(next); }
    function close() { if (tab === 'trade') floorRef.current?.leaveSession(); onClose(); }
    return <div className="invest-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="invest-screen" role="region" aria-label="Invest">
        <header className="invest-topbar">
          <div className="invest-brand"><Landmark size={20}/><span>Invest</span></div>
          <nav className="invest-tabs">
            <button type="button" className={tab === 'allocate' ? 'selected' : ''} onClick={() => goTo('allocate')}>Allocate</button>
            <button type="button" className={tab === 'trade' ? 'selected' : ''} disabled={!game.investing.today} title={game.investing.today?undefined:'Submit an allocation first'} onClick={() => goTo('trade')}>Trade</button>
            <button type="button" className={tab === 'projection' ? 'selected' : ''} disabled={!game.investing.today} onClick={() => goTo('projection')}>Projection</button>
          </nav>
          <button type="button" className="button secondary" onClick={close}><ArrowLeft size={16}/>Back to room</button>
        </header>
        <main className="invest-main">
          {tab === 'allocate' && <AllocationPanel game={game} onCommit={alloc => { onCommit(alloc); goTo('projection'); }}/>}
          {tab === 'trade' && <TradingFloor ref={floorRef} startingCash={game.investing.brokerage.cash} onSettle={onSettleBrokerage}/>}
          {tab === 'projection' && <ProjectionPanel game={game}/>}
        </main>
      </div>
    </div>;
});
export default InvestScreen;
