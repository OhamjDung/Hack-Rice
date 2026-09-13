'use client';
import { useEffect, useRef, useState } from 'react';
import { Home, BookOpen, UserRound, ArrowRight, ChevronRight, RotateCcw, Download, Upload, Landmark, Utensils, Bus, Armchair, Zap, PiggyBank, TrendingUp } from 'lucide-react';
import { Heart, Smile, Battery, Moon, Menu, X } from 'lucide-react';
import {appendDialogue,buyFurniture,beginEnding,finishEnding} from '@/engine/Progression';
import {FurnitureShop,DialogueHistory} from '@/components/modals/ProgressModals';
import {MessageSquare,Coins,Store} from 'lucide-react';
import BalancePanel from './BalancePanel';
import MissionPanel from './MissionPanel';
import ReviewPanel, { ForecastModal } from './ReviewPanel';
import { dayOfMonth,monthOfRun,applyDailyReview,localDailyReview } from '@/engine/DailyReview';
import { roomConditions } from '@/engine/Life';
import RoomCanvas from '@/components/canvas/RoomCanvas';
import { money } from '@/components/hud/TopStatusBar';
import TransactionFeed from '@/components/hud/TransactionFeed';
import OnboardingModal from '@/components/modals/OnboardingModal';
import InspectModal from '@/components/modals/InspectModal';
import AuthModal from '@/components/modals/AuthModal';
import { rewindRun } from '@/engine/Recovery';
import MonthlySummaryModal from '@/components/modals/MonthlySummaryModal';
import DayTransactionsModal from '@/components/modals/DayTransactionsModal';
import GameOverModal from '@/components/modals/GameOverModal';
import Modal from '@/components/ui/Modal';
import InvestScreen, { type InvestScreenHandle } from './InvestScreen';
import { categories, stateSchema, transactionSchema, type GameState, type CategoryKey, type Profile } from '@/engine/Types';
import { createGame, applyTransactions, advanceTurn, careForHome } from '@/engine/RulesEngine';
import { canInvest, investGateReason, commitAllocation, settleBrokerage } from '@/engine/Investing';
import { loadGame, saveGame, exportGame } from '@/lib/storage';
import {importBankDay,bankTransactionsUpdatedToday} from '@/engine/TransactionUpdates';
import { responseSchema, dailyOutput, syncOutput } from '@/schemas/api';
const icons = { food: Utensils, housing: Home, transit: Bus, leisure: Armchair, utilities: Zap, savings: PiggyBank };
type Dialog = 'transactions-today' | 'monthsummary' | 'forecast' | 'onboard' | 'budget' | 'connect' | 'guide' | 'settings' | 'restart' | 'gameover' | 'journal' | 'events' | 'history' | 'shop' | 'objects' | CategoryKey | 'desk' | null;
export default function Game({ initialGame }: { initialGame?: GameState }) {
    const [game, setGame] = useState<GameState>(() => initialGame ?? createGame());
    const [ready, setReady] = useState(false);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [view, setView] = useState<'home' | 'invest'>('home');
    const [investWalk, setInvestWalk] = useState(false);
    const investScreenRef = useRef<InvestScreenHandle>(null);
    function goHome() { investScreenRef.current?.leaveTrading(); setInvestWalk(false); setView('home'); }
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [lastSync, setNotice] = useState('');
    const [reviewing,setReviewing]=useState('');
    const liveGame=useRef(game);liveGame.current=game;
    const epoch=useRef(0);
    const [expanded, setExpanded] = useState(false);
    const [sceneLine,setSceneLine]=useState('');
    const [run, setRun] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);
    const lock = useRef(false);
    const saveEnabled = useRef(true);
    useEffect(() => { try {
        const saved = initialGame ?? loadGame();
        if (saved)
            setGame(saved);
    }
    catch (e) {
        saveEnabled.current = false;
        setError(e instanceof Error ? e.message : 'Could not load your saved game.');
    } setReady(true); }, [initialGame]);
    useEffect(() => { if (!ready || !saveEnabled.current)
        return; try {
        saveGame(game);
    }
    catch {
        saveEnabled.current = false;
        setError('Autosave is unavailable. Export your save to keep your progress.');
    } }, [game, ready]);
    // Best-effort account sync: the DB copy trails localStorage by a debounce tick and
    // never blocks play if the network/account is unavailable — localStorage stays the floor.
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => { if (!ready) return; clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => {
        fetch('/api/game', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: game }) }).catch(() => {});
    }, 800); return () => clearTimeout(saveTimer.current); }, [game, ready]);
    // Presence heartbeat: lets other accounts' visit requests know this one is online.
    useEffect(() => { if (!ready) return; const beat = () => { fetch('/api/presence', { method: 'POST' }).catch(() => {}); }; beat(); const id = setInterval(beat, 8000); return () => clearInterval(id); }, [ready]);
    const [visiting, setVisiting] = useState<{ username: string; state: GameState } | null>(null);
    const [visitDialogOpen, setVisitDialogOpen] = useState(false);
    const [visitError, setVisitError] = useState('');
    const [visitors, setVisitors] = useState<string[]>([]);
    function leaveVisit() { fetch('/api/visit/leave', { method: 'POST' }).catch(() => {}); setVisiting(null); }
    async function goVisit(username: string) {
        setVisitError('');
        try {
            const res = await fetch(`/api/visit/${encodeURIComponent(username)}`);
            const value = await res.json();
            if (!res.ok || !value.success) throw new Error(value.error || 'Could not visit that room.');
            setVisiting({ username: value.data.username, state: value.data.state });
            setVisitDialogOpen(false);
        } catch (e) { setVisitError(e instanceof Error ? e.message : 'Could not visit that room.'); }
    }
    useEffect(() => { if (!visiting) return; const id = setInterval(async () => {
        try {
            const res = await fetch(`/api/visit/${encodeURIComponent(visiting.username)}`);
            const value = await res.json();
            if (!res.ok || !value.success) { setVisiting(null); return; }
            setVisiting({ username: value.data.username, state: value.data.state });
        } catch { setVisiting(null); }
    }, 3000); return () => clearInterval(id); }, [visiting?.username]);
    // Who is currently visiting my own room — surfaced as guest markers so a visit is mutual.
    useEffect(() => { if (!ready) return; const poll = async () => {
        try { const res = await fetch('/api/visitors'); const value = await res.json(); if (res.ok && value.success) setVisitors(value.data); } catch { /* keep last known list */ }
    }; poll(); const id = setInterval(poll, 3000); return () => clearInterval(id); }, [ready]);
    useEffect(() => { if (game.isGameOver&&game.ending.phase!=='playing'&&!busy)
        setDialog('gameover'); }, [game.isGameOver,game.ending.phase,busy]);
    async function request<T>(job: () => Promise<T>) { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        return await job();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    async function readResponse(res: Response) { const value: unknown = await res.json(); if (!res.ok) {
        const err = typeof value === 'object' && value !== null && 'error' in value ? String(value.error) : 'Request failed.';
        throw new Error(err);
    } return value; }
    async function getReview(snapshot:GameState,kind:'close'){
        try {
            const {rewindCheckpoint,...reviewState}=snapshot;
            const res=await fetch('/api/gemini/day',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:reviewState,kind}),signal:AbortSignal.timeout(45000)});
            return responseSchema(dailyOutput).parse(await readResponse(res)).data;
        }catch {return {...localDailyReview(snapshot,kind),providerNotice:'Review service unavailable. Local analysis is active.'};}
    }
    function endDay(confirmedMonth=false){
        if(!confirmedMonth&&dayOfMonth(liveGame.current.metrics.turn)===30&&!liveGame.current.isGameOver&&!lock.current){setDialog('monthsummary');return;}
        void request(async()=>{
        const snapshot=liveGame.current,runId=epoch.current;
        if(snapshot.isGameOver)return;
        setDialog(null);setSceneLine('');setNotice('');setReviewing('Reviewing Day '+dayOfMonth(snapshot.metrics.turn)+'…');
        const next=advanceTurn(snapshot);setGame(next.isGameOver?beginEnding(next,'exhaustion',next.gameOverReason||'This run reached its limit.'):next);
        try{const review=await getReview(snapshot,'close');if(runId===epoch.current)setGame(s=>applyDailyReview(s,review));}finally{setReviewing('');}
    });}
    function addTransaction(category?: CategoryKey, amount?: number) { void request(async () => { const res = await fetch('/api/nessie/mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turn: game.metrics.turn, index: game.transactions.filter(t => t.payerId === 'demo' && t.kind !== 'income').length, category, amount }) }); const { data } = responseSchema(transactionSchema).parse(await readResponse(res)); setGame(s=>{const next=applyTransactions(s,[data]);return next.isGameOver?beginEnding(next,'bankruptcy',next.gameOverReason||'The run reached its limit.'):next;}); setNotice(`${data.description} added to your ledger.`); if (category)
        setDialog(null); }); }
    function sync() { void request(async () => {
        const snapshot=liveGame.current,runId=epoch.current,updateTurn=snapshot.metrics.turn,updateDay=dayOfMonth(updateTurn);
        if(snapshot.isGameOver||bankTransactionsUpdatedToday(snapshot))return;
        const res=await fetch(`/api/nessie/sync?day=${updateDay}`,{cache:'no-store',signal:AbortSignal.timeout(35000)});
        const {data}=responseSchema(syncOutput).parse(await readResponse(res));
        if(runId!==epoch.current||liveGame.current.metrics.turn!==updateTurn)return;
        setGame(s=>{const next=importBankDay(s,data.transactions,updateTurn);return next.isGameOver?beginEnding(next,'bankruptcy',next.gameOverReason||'The run reached its limit.'):next;});
        setDialog(null);
        setNotice(data.transactions.length?`Day ${updateDay}/30 transactions updated (${data.transactions.length} transactions). End day when ready for your review.`:`No transactions for Day ${updateDay} yet. You can check again later.`);
    }); }
    function start(p: Profile) { epoch.current++;saveEnabled.current = true; if (dialog === 'budget') {
        setGame(s => ({ ...s, profile: p, player: { ...s.player, name: p.name, skinTone: p.skinTone, hairColor: p.hairColor, shirtColor: p.shirtColor, pantsColor: p.pantsColor }, jars: { ...s.jars, ...Object.fromEntries(categories.map(c => [c, { ...s.jars[c], allocatedAmount: p.allocations[c] }])) } }));
        setNotice('Budget updated. Existing spending and rollover are preserved.');
    }
    else {
        setGame(createGame(p));
        setRun(r => r + 1);
        setNotice('Welcome home. Your new chapter starts now.');
    } setSceneLine('');setDialog(null); }
    async function importSave(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file)
        return; try {
        if (file.size > 2000000)
            throw new Error('Save file is too large. Maximum size is 2 MB.');
        const state = stateSchema.parse(JSON.parse(await file.text()));
        saveEnabled.current = true;
        epoch.current++;setGame(state);
        setSceneLine('');
        setRun(r => r + 1);
        setDialog(null);
        setNotice('Your saved apartment is ready.');
    }
    catch {
        setDialog(null);
        setError('Could not import this file. Choose a valid CashBound JSON save under 2 MB.');
    }
    finally {
        e.target.value = '';
    } }
    const day=dayOfMonth(game.metrics.turn);
    const warnings=roomConditions(game);
    const encouraged=!game.isGameOver&&game.reviews[0]?.analysis.feedback==='encouragement';
    const isWarning=!encouraged&&(game.command.severity!=='info'||warnings.length>0);
    const thought=game.isGameOver?(game.command.message||'This chapter ends here. Time for a better plan.'):encouraged?game.command.message:game.command.severity!=='info'?game.command.message:warnings[0]||sceneLine||game.command.message||game.life.lastEvent;
    useEffect(()=>{if(ready&&thought)setGame(s=>appendDialogue(s,thought,isWarning?'warning':'action'));},[thought,day,ready,isWarning]);
    // This early return must come after every hook above — hooks must run in the
    // same order on every render, and this branch used to sit before the dialogue
    // useEffect, which crashed React (#300, "rendered fewer hooks than expected")
    // as soon as a visit actually succeeded.
    if (visiting) return <div className="game-world visiting-world" data-testid="game-world-visiting">
      <div className="visit-banner" role="status">Visiting <strong>{visiting.username}</strong>'s room (read-only, live) <button className="button secondary" onClick={leaveVisit}>Leave</button></div>
      <div className="world-stage"><RoomCanvas game={visiting.state} onLayoutChange={()=>{}} onInspect={()=>{}} guests={[{ label: 'You', color: game.player.shirtColor }]}/></div>
    </div>;
    return <div className={`game-world ${!game.life.powerOn?'blackout':''} ${game.life.stress>=35?'stressed':''}`} data-testid="game-world">
      <div className="world-grain" aria-hidden="true"/>
      <header className="game-hud">
        <div className="world-name"><img className="world-logo" src="/room-economy-mark.svg" width={56} height={56} alt="" aria-hidden="true"/><div><h1>Cash<span>Bound</span></h1><p>one room. your whole life.</p></div></div>
        <div className="view-tabs" role="tablist" aria-label="Room or Invest">
          <button className={`world-button ${view==='home'?'selected':''}`} role="tab" aria-selected={view==='home'} onClick={goHome}><Home size={20}/><span>Home</span></button>
          <button className={`world-button ${view==='invest'?'selected':''}`} role="tab" aria-selected={view==='invest'} aria-disabled={!canInvest(game)||investWalk} aria-label={canInvest(game)?'Invest':`Invest unavailable${investGateReason(game)?`: ${investGateReason(game)}`:''}`} title={investGateReason(game)??undefined} onClick={()=>{if(canInvest(game)&&!investWalk&&view==='home')setInvestWalk(true);}}><TrendingUp size={20}/><span>Invest</span></button>
        </div>
        <div className="vitals" aria-label="Character wellbeing">
          {[{label:'Health',value:game.metrics.health,Icon:Heart,style:'health'},{label:'Entertainment',value:game.metrics.happiness,Icon:Smile,style:'mood'},{label:'Energy',value:game.life.energy,Icon:Battery,style:'energy'}].map(({label,value,Icon,style})=><div className={`vital ${style}`} key={label} title={`${label}: ${Math.round(value)} of 100`}><Icon size={17}/><div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${value}%`}}/></div><span className="sr-only">{label}: {Math.round(value)}</span></div>)}
        </div>
        <div className="hud-coins" aria-label={`${game.progression.coins} game coins`}><Coins size={18}/><strong>{game.progression.coins}</strong><span>coins</span></div>
        <button className="world-button profile-toggle" onClick={()=>setDialog('budget')} aria-label="Open profile"><UserRound size={20}/><span>Profile</span></button>
        <button className="world-button menu-toggle" onClick={()=>setDialog('settings')} aria-label="Open game menu"><Menu size={21}/></button>
      </header>
      {view==='invest'&&<InvestScreen ref={investScreenRef} game={game} onClose={goHome} onCommit={alloc=>setGame(s=>commitAllocation(s,alloc))} onSettleBrokerage={(cash,pnl)=>setGame(s=>settleBrokerage(s,cash,pnl))}/>}
      <div className="chapter-marker"><span>CHAPTER {String(game.completedMonths+1).padStart(2,'0')}</span><h2>{game.isGameOver?'A chance to begin again':game.housingDeficits?'A notice at the door':!game.life.powerOn?'When the lights go out':game.life.stress>=35?'Too much of a good thing':'A place to call your own'}</h2><p>Month {monthOfRun(game.metrics.turn)} · Day {day} / 30 <i/> {game.mode==='demo'?'Your life, your choices':'Linked to your transactions'}</p></div>
      <div className="world-stage"><RoomCanvas key={run} game={game} onLayoutChange={roomLayout=>setGame(s=>({...s,roomLayout}))} investWalk={investWalk} onArriveInvest={()=>{setInvestWalk(false);setView('invest');}} onInspect={setDialog} onScene={line=>{setSceneLine(line);setGame(s=>appendDialogue(s,line));}} onEndingComplete={()=>setGame(s=>finishEnding(s))} onSwipeCharacter={()=>{setVisitError('');setVisitDialogOpen(true);}} guests={visitors.map(v=>({ label: v }))} paused={!!dialog||view!=='home'}/></div>
      {!ready&&<div className="world-loading" role="status">Opening the door…</div>}
      <div className="world-location"><span>MAPLE STREET · APARTMENT 04</span><small>{game.metrics.roomLevel>1?`Making it your own · Level ${game.metrics.roomLevel}`:'Your first little corner of the world'}</small></div>
      <div className={`character-thought ${isWarning?'warning-command':''}`} role="status"><span className="thought-avatar" style={{background:game.player.shirtColor}}>{game.player.name.slice(0,1)}</span><div><strong>{game.player.name}<span>{isWarning?'spending warning':'is living your story'}</span></strong><p>{thought}</p></div></div>
      {error&&<div className="world-alert" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
      <div className="left-panels"><MissionPanel game={game}/><ReviewPanel game={game} reviewing={reviewing} onForecast={() => setDialog('forecast')}/></div>
      <BalancePanel game={game} busy={busy||!ready} reviewing={reviewing} lastSync={lastSync} onAction={setDialog} onSync={()=>sync()} onViewTransactions={()=>setDialog('transactions-today')}/>
      {game.ending.phase==='playing'&&<div className="ending-caption" role="status">Forecast: {game.ending.kind==='food_shortage'?'no food left.':game.ending.kind==='power_cut'||game.ending.kind==='eviction'?'lights out.':'too much strain.'}</div>}
      {dialog==='transactions-today'&&<DayTransactionsModal game={game} turn={game.metrics.turn} onClose={()=>setDialog(null)}/>}
      {dialog==='monthsummary'&&<MonthlySummaryModal game={game} onClose={()=>setDialog(null)} onContinue={()=>endDay(true)}/>}
      {dialog==='forecast'&&<ForecastModal game={game} onClose={()=>setDialog(null)}/>}
      {dialog==='history'&&<DialogueHistory game={game} onClose={()=>setDialog(null)}/>}
      {dialog==='shop'&&<FurnitureShop game={game} onClose={()=>setDialog(null)} onBuy={id=>setGame(s=>buyFurniture(s,id))}/>}
      <footer className="game-controls">
        <div className="world-tools" aria-label="Game tools"><button className="world-button" aria-label="Open dialogue history" onClick={()=>setDialog('history')}><MessageSquare size={20}/><span>History</span></button>
          <button className="world-button" aria-label="Open journal" title="Transaction journal" onClick={()=>setDialog('journal')}><BookOpen size={20}/><span>Journal</span></button>
          <button className="world-button" aria-label="Open tutorial" title="Learn how to play" onClick={()=>setDialog('guide')}><Home size={20}/><span>Tutorial</span></button>
          <button className="world-button shop-toggle" aria-label="Open furniture shop" onClick={()=>setDialog('shop')}><Store size={20}/><span>Shop</span></button>

        </div>
        <p className="play-hint">Click to walk · Drag to rotate <span>·</span> Explore the things you own</p>
        <button className="end-week" disabled={busy||game.isGameOver||!ready} onClick={()=>endDay()}><Moon size={18}/><span>{reviewing?'Analyzing…':'End day'}<small>Day {day} · {31-day} days until payday</small></span><ChevronRight size={18}/></button>
      </footer>
      {dialog==='journal'&&<Modal title="The story behind your days" onClose={()=>setDialog(null)}><p className="muted">These are the moments your character is living. Every transaction leaves a little trace at home.</p><TransactionFeed transactions={game.transactions} expanded={expanded} onExpand={()=>setExpanded(v=>!v)}/><div className="journal-balance"><span>In your pocket</span><strong>{money(game.metrics.cashBalance)}</strong></div><button className="button secondary full-width" onClick={()=>setDialog('budget')}>Open the budget notebook</button></Modal>}
      {dialog==='objects'&&<Modal title="Everything here has a story" onClose={()=>setDialog(null)}><div className="room-object-grid">{categories.map(c=>{const Icon=icons[c];return <button key={c} onClick={()=>setDialog(c)}><Icon size={27}/><strong>{({food:'The fridge',housing:'Your bed',leisure:'The sofa',utilities:'The lights',transit:'Your keys',savings:'The little ledger'})[c]}</strong></button>;})}<button onClick={()=>setDialog('desk')}><BookOpen size={27}/><strong>Your work desk</strong></button></div></Modal>}
 {(dialog === 'onboard' || dialog === 'budget') && <OnboardingModal profile={dialog === 'budget' ? game.profile : undefined} onStart={start} onClose={() => setDialog(null)}/>} {dialog && ([...categories, 'desk'] as string[]).includes(dialog) && <InspectModal category={dialog as CategoryKey | 'desk'} game={game} onClose={() => setDialog(null)} onPurchase={addTransaction} busy={busy||game.isGameOver} error={error} onCare={action=>{setSceneLine('');setGame(s=>careForHome(s,action));setDialog(null);}}/>}{dialog === 'connect' && <AuthModal onClose={() => setDialog(null)} onConnect={()=>sync()} busy={busy} error={error}/>}{dialog === 'gameover' && <GameOverModal game={game} onClose={() => setDialog(null)} onRestart={() => setDialog('onboard')} onRewind={() => { epoch.current++; setGame(s => rewindRun(s)); setRun(r => r + 1); setSceneLine(''); setDialog(null); setNotice('Back before the risky purchase. Choose your next action again.'); }}/>}
 {dialog === 'settings' && <Modal title="Make it your own" onClose={() => setDialog(null)}><p className="muted">Your progress is saved to your account and follows you to any device you log into.</p><div className="settings-actions"><button className="button secondary" onClick={()=>sync()}><Landmark size={17}/>Update today's transactions</button><button className="button secondary" onClick={() => exportGame(game)}><Download size={17}/>Export save</button><button className="button secondary" onClick={() => fileRef.current?.click()}><Upload size={17}/>Import save</button><button className="button secondary" onClick={() => setDialog('restart')}><RotateCcw size={17}/>Start a new run</button><button className="button secondary" onClick={() => fetch('/api/auth/logout',{method:'POST'}).then(()=>{window.location.href='/';})}>Log out</button></div></Modal>}
 {dialog === 'restart' && <Modal title="Ready for a fresh start?" onClose={() => setDialog(null)}><p>Your current autosave will be replaced when you move into the new apartment. Export it first if you would like to keep it.</p><div className="modal-actions"><button className="button secondary" onClick={() => exportGame(game)}>Export current run</button><button className="button primary" onClick={() => setDialog('onboard')}>Create new run<ArrowRight size={16}/></button></div></Modal>}
 {dialog === 'guide' && <Modal title="Tutorial" onClose={() => setDialog(null)}><ol className="guide-list"><li><strong>Live in the room.</strong><p>Click the floor to walk, or click furniture to interact. Room buttons offer the same actions with a keyboard.</p></li><li><strong>Let money become moments.</strong><p>Use the right-side actions for groceries, shopping, rent, and bills. Savings, gym, and health missions require transaction updates and award furniture coins. Risky optional spending can cost coins at End day. Transaction updates match the current day of the month. Each day can be updated once; skipped days are not imported automatically. End day advances the calendar. Your character acts out new transactions in order.</p></li><li><strong>Time has consequences.</strong><p>End day uses food and reviews yesterday's spending. Empty supplies damage health; low energy slows your character. At month end, unpaid power goes dark and missed rent leaves a notice. Two missed rent months end the run.</p></li><li><strong>Recover through choices.</strong><p>Groceries replenish food. Rest in bed once per day to restore energy and heal a little if fed. Tidy the sofa area to reduce clutter and stress. Pay utilities to restore light. Tidying does not pay your bills.</p></li><li><strong>Keep the numbers tucked away.</strong><p>The journal contains your transactions and budget notebook. Profile opens your character and budget. History keeps past dialogue. The menu contains transaction updates and saves.</p></li></ol><button className="button secondary full-width" onClick={()=>setDialog('objects')}>Explore the room items</button><button className="button primary full-width" onClick={() => setDialog(null)}>Got it. Let’s build a life.</button></Modal>}
 {visitDialogOpen && <Modal title="Visit a friend" onClose={()=>setVisitDialogOpen(false)}><p className="muted">Enter their username. They need to have CashBound open right now to be visited.</p><form onSubmit={e=>{e.preventDefault();const input=(e.currentTarget.elements.namedItem('username') as HTMLInputElement).value.trim();if(input)void goVisit(input);}}><label>Username<input name="username" autoFocus/></label>{visitError&&<p className="error" role="alert">{visitError}</p>}<div className="modal-actions"><button type="submit" className="button primary">Visit<ArrowRight size={16}/></button></div></form></Modal>}
 <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Import saved game" onChange={importSave}/></div>;
}
