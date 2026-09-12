'use client';
import { Wallet,Utensils,Armchair,Home,Zap,PiggyBank,Bus,RefreshCw,CheckCircle2,AlertTriangle } from 'lucide-react';
import type { CategoryKey,GameState } from '@/engine/Types';
import { dayOfMonth,monthOfRun } from '@/engine/DailyReview';
const actions=[{category:'food',label:'Groceries',Icon:Utensils},{category:'leisure',label:'Shopping & fun',Icon:Armchair},{category:'housing',label:'Pay rent',Icon:Home},{category:'utilities',label:'Utilities',Icon:Zap},{category:'transit',label:'Transport',Icon:Bus}] as const;
export default function BalancePanel({game,busy,reviewing,lastSync,onAction,onSync}:{game:GameState;busy:boolean;reviewing:string;lastSync:string;onAction:(c:CategoryKey)=>void;onSync:()=>void}){
 const latest=game.reviews[0];
 return <aside className="balance-panel" aria-label="Balance and life actions">
 <div className="balance-summary"><div className="balance-heading"><Wallet size={19}/><span>Current balance</span></div><strong className="visible-balance">{game.metrics.cashBalance.toLocaleString('en-US',{style:'currency',currency:'USD'})}</strong><p className="balance-calendar">Month {monthOfRun(game.metrics.turn)} · Day {dayOfMonth(game.metrics.turn)} / 30</p></div><div className="balance-scroll" tabIndex={0} aria-label="Life actions and daily review">
 <div className="balance-actions">{actions.map(({category,label,Icon})=><button key={category} onClick={()=>onAction(category)} disabled={busy||game.isGameOver}><Icon size={18}/><span>{label}</span><small>+</small></button>)}</div>

 <button className="sync-life" onClick={onSync} disabled={busy||game.isGameOver}><RefreshCw size={17}/>{busy&&!reviewing?'Checking transactions…':'Keep updated with transactions'}</button><p className="sync-status" role="status">{lastSync||(game.mode==='nessie'?'Connected · checks every minute':'Connect Nessie to follow bank activity')}</p>
 <div className={`review-status ${latest?.analysis.isWarning?'has-warning':''}`} role="status">{latest?.analysis.isWarning?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}<div><strong>{reviewing|| (latest?`${latest.source==='gemini'?'Gemini':'Local'} review · Day ${dayOfMonth(latest.assessedDay)}`:'Review happens at End day')}</strong><p>{latest?.providerNotice|| (latest?.analysis.isWarning?'Yesterday’s spending put future needs at risk.':'Spend and play now. Reflect tomorrow morning.')}</p></div></div>
 </div></aside>;
}
