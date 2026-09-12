'use client';
import {Coins,Check,LockKeyhole} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type {GameState} from '@/engine/Types';
import {SHOP} from '@/engine/Progression';
import {dayOfMonth,monthOfRun} from '@/engine/DailyReview';
export function FurnitureShop({game,onBuy,onClose}:{game:GameState;onBuy:(id:typeof SHOP[number]['id'])=>void;onClose:()=>void}){
 return <Modal title="Make this place yours" onClose={onClose}><p className="muted">Earn coins through verified missions. Furniture costs game coins, never bank money.</p><div className="shop-wallet"><Coins size={20}/><strong>{game.progression.coins} coins</strong></div><div className="shop-list">{SHOP.map(item=>{const owned=game.progression.owned.includes(item.id),affordable=game.progression.coins>=item.cost;return <div className="shop-item" key={item.id}><div><strong>{item.name}</strong><p>{item.description}</p></div><button className="button secondary" disabled={owned||!affordable||game.isGameOver} onClick={()=>onBuy(item.id)}>{owned?<Check size={15}/>:!affordable?<LockKeyhole size={15}/>:<Coins size={15}/>} {owned?'Owned':`${item.cost} coins`}</button></div>;})}</div><details className="object-ledger"><summary>Coin history</summary>{game.progression.coinLog.length?game.progression.coinLog.map(e=><p key={e.id}>Day {dayOfMonth(e.day)} · {e.reason}: {e.amount>0?'+':''}{e.amount}</p>):<p>Complete your first verified mission to earn coins.</p>}</details></Modal>;
}
export function DialogueHistory({game,onClose}:{game:GameState;onClose:()=>void}){
 return <Modal title="Things I’ve said" onClose={onClose}><p className="muted">Character moments, yesterday’s warnings, and small wins.</p><ol className="dialogue-history">{game.dialogue.length?game.dialogue.map(line=><li className={line.kind==='warning'||line.kind==='ending'?'history-warning':''} key={line.id}><small>Month {monthOfRun(line.day)} · Day {dayOfMonth(line.day)} · {line.kind}</small><p>{line.message}</p></li>):<li>Your character’s first line will appear here.</li>}</ol></Modal>;
}
