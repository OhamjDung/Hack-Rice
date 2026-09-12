'use client';
import { Wallet,Utensils,Armchair,Home,Zap,PiggyBank,Bus,RefreshCw,Eye } from 'lucide-react';
import {bankTransactionsUpdatedToday} from '@/engine/TransactionUpdates';
import type { CategoryKey,GameState } from '@/engine/Types';
import { dayOfMonth,monthOfRun } from '@/engine/DailyReview';
const actions=[{category:'food',label:'Groceries',Icon:Utensils},{category:'leisure',label:'Shopping & fun',Icon:Armchair},{category:'housing',label:'Pay rent',Icon:Home},{category:'utilities',label:'Utilities',Icon:Zap},{category:'transit',label:'Transport',Icon:Bus}] as const;
export default function BalancePanel({game,busy,reviewing,lastSync,onAction,onSync,onViewTransactions}:{game:GameState;busy:boolean;reviewing:string;lastSync:string;onAction:(c:CategoryKey)=>void;onSync:()=>void;onViewTransactions:()=>void}){
 return <aside className="balance-panel" aria-label="Balance and life actions">
 <div className="balance-summary"><div className="balance-heading"><Wallet size={19}/><span>Current balance</span></div><strong className="visible-balance">{game.metrics.cashBalance.toLocaleString('en-US',{style:'currency',currency:'USD'})}</strong><p className="balance-calendar">Month {monthOfRun(game.metrics.turn)} · Day {dayOfMonth(game.metrics.turn)} / 30</p></div><div className="balance-scroll" tabIndex={0} aria-label="Life actions and transaction updates">
 <div className="balance-actions">{actions.map(({category,label,Icon})=><button key={category} onClick={()=>onAction(category)} disabled={busy||game.isGameOver}><Icon size={18}/><span>{label}</span><small>+</small></button>)}</div>

 <div className="sync-controls">
 <button className="sync-life" onClick={onSync} disabled={busy||game.isGameOver||bankTransactionsUpdatedToday(game)}><RefreshCw size={17} aria-hidden="true"/>{busy&&!reviewing?'Checking transactions…':'Keep updated with transactions'}</button>
 <button className="transaction-eye" onClick={onViewTransactions} disabled={busy} aria-label="View transactions" title="View transactions"><Eye size={18} aria-hidden="true"/></button>
 </div><p className="sync-status" role="status">{bankTransactionsUpdatedToday(game)?`Day ${dayOfMonth(game.metrics.turn)} transactions are up to date. End day to continue.`:lastSync||`Update transactions for Day ${dayOfMonth(game.metrics.turn)} of Month ${monthOfRun(game.metrics.turn)}.`}</p>

 </div></aside>;
}
