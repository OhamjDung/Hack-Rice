'use client';
import { useEffect, useRef, useState } from 'react';
import { Home, BookOpen, Settings2, ArrowRight, ChevronRight, RotateCcw, Download, Upload, Landmark, Utensils, Bus, Armchair, Zap, PiggyBank, Info } from 'lucide-react';
import { Heart, Smile, Battery, Moon, Sparkles, Menu, X } from 'lucide-react';
import {appendDialogue,buyFurniture,beginEnding,finishEnding} from '@/engine/Progression';
import {FurnitureShop,DialogueHistory} from '@/components/modals/ProgressModals';
import {MessageSquare,Coins,Store} from 'lucide-react';
import BalancePanel from './BalancePanel';
import MissionPanel from './MissionPanel';
import { dayOfMonth,monthOfRun,applyDailyReview,localDailyReview } from '@/engine/DailyReview';
import { roomConditions } from '@/engine/Life';
import RoomCanvas from '@/components/canvas/RoomCanvas';
import { money } from '@/components/hud/TopStatusBar';
import TransactionFeed from '@/components/hud/TransactionFeed';
import OnboardingModal from '@/components/modals/OnboardingModal';
import InspectModal from '@/components/modals/InspectModal';
import AuthModal from '@/components/modals/AuthModal';
import GameOverModal from '@/components/modals/GameOverModal';
import Modal from '@/components/ui/Modal';
import { categories, stateSchema, transactionSchema, type GameState, type CategoryKey, type Profile } from '@/engine/Types';
import { createGame, applyTransactions, advanceTurn, careForHome } from '@/engine/RulesEngine';
import { loadGame, saveGame, exportGame } from '@/lib/storage';
import { responseSchema, syncOutput, dailyOutput } from '@/schemas/api';
const icons = { food: Utensils, housing: Home, transit: Bus, leisure: Armchair, utilities: Zap, savings: PiggyBank };
type Dialog = 'onboard' | 'budget' | 'connect' | 'guide' | 'settings' | 'restart' | 'gameover' | 'journal' | 'events' | 'history' | 'shop' | 'objects' | 'coach' | CategoryKey | 'desk' | null;
export default function Game() {
    const [game, setGame] = useState<GameState>(() => createGame());
    const [ready, setReady] = useState(false);
    const [dialog, setDialog] = useState<Dialog>(null);
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
        const saved = loadGame();
        if (saved)
            setGame(saved);
    }
    catch (e) {
        saveEnabled.current = false;
        setError(e instanceof Error ? e.message : 'Could not load your saved game.');
    } setReady(true); }, []);
    useEffect(() => { if (!ready || !saveEnabled.current)
        return; try {
        saveGame(game);
    }
    catch {
        saveEnabled.current = false;
        setError('Autosave is unavailable. Export your save to keep your progress.');
    } }, [game, ready]);
    useEffect(() => { if (game.isGameOver&&game.ending.phase!=='playing'&&!busy)
        setDialog('gameover'); }, [game.isGameOver,game.ending.phase,busy]);
    useEffect(()=>{if(game.mode!=='nessie'||game.isGameOver)return;const timer=setInterval(()=>{if(!document.hidden)sync(false);},60000);return()=>clearInterval(timer);},[game.mode,game.isGameOver]);
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
            const res=await fetch('/api/gemini/day',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,kind}),signal:AbortSignal.timeout(65000)});
            return responseSchema(dailyOutput).parse(await readResponse(res)).data;
        }catch {return {...localDailyReview(snapshot,kind),providerNotice:'Review service unavailable. Local analysis is active.'};}
    }
    function endDay(){void request(async()=>{
        const snapshot=liveGame.current,runId=epoch.current;
        if(snapshot.isGameOver)return;
        setSceneLine('');setReviewing('Reviewing Day '+dayOfMonth(snapshot.metrics.turn)+'…');
        const next=advanceTurn(snapshot);setGame(next.isGameOver?beginEnding(next,'exhaustion',next.gameOverReason||'This run reached its limit.'):next);
        try{const review=await getReview(snapshot,'close');if(runId===epoch.current)setGame(s=>applyDailyReview(s,review));}finally{setReviewing('');}
    });}
    function addTransaction(category?: CategoryKey, amount?: number) { void request(async () => { const res = await fetch('/api/nessie/mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turn: game.metrics.turn, index: game.transactions.filter(t => t.payerId === 'demo' && t.kind !== 'income').length, category, amount }) }); const { data } = responseSchema(transactionSchema).parse(await readResponse(res)); setGame(s=>{const next=applyTransactions(s,[data]);return next.isGameOver?beginEnding(next,'bankruptcy',next.gameOverReason||'The run reached its limit.'):next;}); setNotice(`${data.description} added to your ledger.`); if (category)
        setDialog(null); }); }
    function sync(interactive=true) { void request(async () => { const res = await fetch('/api/nessie/sync'); const { data } = responseSchema(syncOutput).parse(await readResponse(res)); setGame(s => { const base = s.mode === 'nessie' ? s : { ...createGame(s.profile), mode: 'nessie' as const }; const next=applyTransactions(base,data.transactions,data.balance,'nessie');return next.isGameOver?beginEnding(next,'bankruptcy',next.gameOverReason||'The run reached its limit.'):next; }); if(interactive)setDialog(null); setNotice(`Synced ${data.accountName}. Duplicate transactions are skipped.`); }); }
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
        setError('Could not import this file. Choose a valid RoomEconomy JSON save under 2 MB.');
    }
    finally {
        e.target.value = '';
    } }
    const day=dayOfMonth(game.metrics.turn);
    const warnings=roomConditions(game);
    const isWarning=game.command.severity!=='info'||warnings.length>0;
    const thought=game.isGameOver?(game.command.message||'This chapter ends here. Time for a better plan.'):game.command.severity!=='info'?game.command.message:warnings[0]||sceneLine||game.command.message||game.life.lastEvent;
    useEffect(()=>{if(ready&&thought)setGame(s=>appendDialogue(s,thought,isWarning?'warning':'action'));},[thought,day,ready,isWarning]);
    return <div className={`game-world ${!game.life.powerOn?'blackout':''} ${game.life.stress>=35?'stressed':''}`} data-testid="game-world">
      <div className="world-grain" aria-hidden="true"/>
      <header className="game-hud">
        <div className="world-name"><span className="world-logo"><Home size={21}/></span><div><h1>Room<span>Economy</span></h1><p>one room. your whole life.</p></div></div>
        <div className="vitals" aria-label="Character wellbeing">
          {[{label:'Health',value:game.metrics.health,Icon:Heart,style:'health'},{label:'Entertainment',value:game.metrics.happiness,Icon:Smile,style:'mood'},{label:'Energy',value:game.life.energy,Icon:Battery,style:'energy'}].map(({label,value,Icon,style})=><div className={`vital ${style}`} key={label} title={`${label}: ${Math.round(value)} of 100`}><Icon size={17}/><div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${value}%`}}/></div><span className="sr-only">{label}: {Math.round(value)}</span></div>)}
        </div>
        <div className="hud-coins" aria-label={`${game.progression.coins} game coins`}><Coins size={18}/><strong>{game.progression.coins}</strong><span>coins</span></div>
        <button className="world-button menu-toggle" onClick={()=>setDialog('settings')} aria-label="Open game menu"><Menu size={21}/></button>
      </header>
      <div className="chapter-marker"><span>CHAPTER {String(game.completedMonths+1).padStart(2,'0')}</span><h2>{game.isGameOver?'A chance to begin again':game.housingDeficits?'A notice at the door':!game.life.powerOn?'When the lights go out':game.life.stress>=35?'Too much of a good thing':'A place to call your own'}</h2><p>Month {monthOfRun(game.metrics.turn)} · Day {day} / 30 <i/> {game.mode==='demo'?'A simulated life':'Linked to your transactions'}</p></div>
      <div className="world-stage"><RoomCanvas key={run} game={game} onInspect={setDialog} onScene={line=>{setSceneLine(line);setGame(s=>appendDialogue(s,line));}} onEndingComplete={()=>setGame(s=>finishEnding(s))} paused={!!dialog}/></div>
      {!ready&&<div className="world-loading" role="status">Opening the door…</div>}
      <div className="world-location"><span>MAPLE STREET · APARTMENT 04</span><small>{game.metrics.roomLevel>1?`Making it your own · Level ${game.metrics.roomLevel}`:'Your first little corner of the world'}</small></div>
      <div className={`character-thought ${isWarning?'warning-command':''}`} role="status"><span className="thought-avatar" style={{background:game.player.shirtColor}}>{game.player.name.slice(0,1)}</span><div><strong>{game.player.name}<span>{isWarning?'spending warning':'is living your story'}</span></strong><p>{thought}</p></div></div>
      {error&&<div className="world-alert" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
      <MissionPanel game={game}/>
      <BalancePanel game={game} busy={busy||!ready} reviewing={reviewing} lastSync={lastSync} onAction={setDialog} onSync={()=>game.mode==='nessie'?sync():setDialog('connect')}/>
      {game.ending.phase==='playing'&&<div className="ending-caption" role="status">A glimpse ahead: {game.ending.kind==='food_shortage'?'the fridge is empty…':game.ending.kind==='power_cut'||game.ending.kind==='eviction'?'the lights go out…':'the strain catches up…'}</div>}
      {dialog==='history'&&<DialogueHistory game={game} onClose={()=>setDialog(null)}/>}
      {dialog==='shop'&&<FurnitureShop game={game} onClose={()=>setDialog(null)} onBuy={id=>setGame(s=>buyFurniture(s,id))}/>}
      <footer className="game-controls">
        <div className="world-tools" aria-label="Game tools"><button className="world-button" aria-label="Open dialogue history" onClick={()=>setDialog('history')}><MessageSquare size={20}/><span>History</span></button>
          <button className="world-button" aria-label="Open journal" title="Transaction journal" onClick={()=>setDialog('journal')}><BookOpen size={20}/><span>Journal</span></button>
          <button className="world-button" aria-label="Open room objects" title="Interact with your room" onClick={()=>setDialog('objects')}><Home size={20}/><span>Room</span></button>
          <button className="world-button shop-toggle" aria-label="Open furniture shop" onClick={()=>setDialog('shop')}><Store size={20}/><span>Shop</span></button>

        </div>
        <p className="play-hint">Click the floor to walk <span>·</span> Explore the things you own</p>
        <button className="end-week" disabled={busy||game.isGameOver||!ready} onClick={endDay}><Moon size={18}/><span>{reviewing?'Analyzing…':'End day'}<small>Day {day} · {31-day} days until payday</small></span><ChevronRight size={18}/></button>
      </footer>
      {dialog==='journal'&&<Modal title="The story behind your days" onClose={()=>setDialog(null)}><p className="muted">These are the moments your character is living. Every transaction leaves a little trace at home.</p><TransactionFeed transactions={game.transactions} expanded={expanded} onExpand={()=>setExpanded(v=>!v)}/><div className="journal-balance"><span>In your pocket</span><strong>{money(game.metrics.cashBalance)}</strong></div><button className="button secondary full-width" onClick={()=>setDialog('budget')}>Open the budget notebook</button></Modal>}
      {dialog==='objects'&&<Modal title="Everything here has a story" onClose={()=>setDialog(null)}><div className="room-object-grid">{categories.map(c=>{const Icon=icons[c];return <button key={c} onClick={()=>setDialog(c)}><Icon size={27}/><strong>{({food:'The fridge',housing:'Your bed',leisure:'The sofa',utilities:'The lights',transit:'Your keys',savings:'The little ledger'})[c]}</strong></button>;})}<button onClick={()=>setDialog('desk')}><BookOpen size={27}/><strong>Your work desk</strong></button></div></Modal>}
      {dialog==='coach'&&<DialogueHistory game={game} onClose={()=>setDialog(null)}/>}
 {(dialog === 'onboard' || dialog === 'budget') && <OnboardingModal profile={dialog === 'budget' ? game.profile : undefined} onStart={start} onClose={() => setDialog(null)}/>} {dialog && ([...categories, 'desk'] as string[]).includes(dialog) && <InspectModal category={dialog as CategoryKey | 'desk'} game={game} onClose={() => setDialog(null)} onPurchase={addTransaction} busy={busy||game.isGameOver} error={error} onCare={action=>{setSceneLine('');setGame(s=>careForHome(s,action));setDialog(null);}}/>}{dialog === 'connect' && <AuthModal onClose={() => setDialog(null)} onConnect={()=>sync()} busy={busy} error={error}/>}{dialog === 'gameover' && <GameOverModal game={game} onClose={() => setDialog(null)} onRestart={() => setDialog('onboard')}/>}
 {dialog === 'settings' && <Modal title="Make it your own" onClose={() => setDialog(null)}><p className="muted">Your progress is saved in this browser. Export a copy to take your apartment with you.</p><div className="settings-actions"><button className="button secondary" onClick={()=>setDialog('connect')}><Landmark size={17}/>Connect my transactions</button><button className="button secondary" onClick={()=>setDialog('coach')}><Sparkles size={17}/>A moment to reflect</button><button className="button secondary" onClick={()=>setDialog('guide')}><Info size={17}/>How this life works</button><button className="button secondary" onClick={() => setDialog('budget')}><Settings2 size={17}/>Character & budget</button><button className="button secondary" onClick={() => exportGame(game)}><Download size={17}/>Export save</button><button className="button secondary" onClick={() => fileRef.current?.click()}><Upload size={17}/>Import save</button><button className="button secondary" onClick={() => setDialog('restart')}><RotateCcw size={17}/>Start a new run</button></div></Modal>}
 {dialog === 'restart' && <Modal title="Ready for a fresh start?" onClose={() => setDialog(null)}><p>Your current autosave will be replaced when you move into the new apartment. Export it first if you would like to keep it.</p><div className="modal-actions"><button className="button secondary" onClick={() => exportGame(game)}>Export current run</button><button className="button primary" onClick={() => setDialog('onboard')}>Create new run<ArrowRight size={16}/></button></div></Modal>}
 {dialog === 'guide' && <Modal title="A small guide to your new life" onClose={() => setDialog(null)}><ol className="guide-list"><li><strong>Live in the room.</strong><p>Click the floor to walk, or click furniture to interact. Room buttons offer the same actions with a keyboard.</p></li><li><strong>Let money become moments.</strong><p>Use the right-side actions for groceries, shopping, rent, and bills. Savings, gym, and health missions require bank updates and award furniture coins. Risky optional spending can cost coins at End day. Connected transactions are checked every minute while this tab is visible. Your character acts out new transactions in order.</p></li><li><strong>Time has consequences.</strong><p>End day uses food and reviews yesterday's spending. Empty supplies damage health; low energy slows your character. At month end, unpaid power goes dark and missed rent leaves a notice. Two missed rent months end the run.</p></li><li><strong>Recover through choices.</strong><p>Groceries replenish food. Rest in bed once per day to restore energy and heal a little if fed. Tidy the sofa area to reduce clutter and stress. Pay utilities to restore light. Tidying does not pay your bills.</p></li><li><strong>Keep the numbers tucked away.</strong><p>The journal contains your transactions and budget notebook. The menu contains account linking, character setup, saves, and coaching.</p></li></ol><button className="button primary full-width" onClick={() => setDialog(null)}>Got it. Let’s build a life.</button></Modal>}
 <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Import saved game" onChange={importSave}/></div>;
}
