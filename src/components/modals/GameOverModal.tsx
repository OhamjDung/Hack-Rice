'use client';
import Modal from '@/components/ui/Modal';
import type {GameState} from '@/engine/Types';
import {dayOfMonth,monthOfRun,remainderPlan} from '@/engine/DailyReview';
export default function GameOverModal({game,onClose,onRestart}:{game:GameState;onClose:()=>void;onRestart:()=>void}){
 const plan=remainderPlan(game),forecast=game.reviews.find(r=>r.kind==='close')?.forecast,money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
 return <Modal title="This chapter can teach you something." onClose={onClose}><div className="eyebrow">CHAPTER ENDED · MONTH {monthOfRun(game.metrics.turn)} · DAY {dayOfMonth(game.metrics.turn)}</div><p>{game.gameOverReason}</p><h3>A plan for the rest of the month</h3><div className="inspect-breakdown"><span>Days remaining<b>{plan.days}</b></span><span>Cash available<b>{money(plan.cash)}</b></span><span>Essential money needed<b>{money(plan.essential)}</b></span></div>
 {forecast&&forecast.threats.length>0&&<section className="forecast-shortfalls"><h3>If this spending pace continues</h3><p>{forecast.runoutDay&&forecast.runoutDay<=30?`Flexible cash is projected to run out around day ${forecast.runoutDay}.`:'The current pace leaves these planned needs unfunded.'}</p><ul>{forecast.threats.map(t=><li key={t.category}>{t.category}: projected gap of {money(t.shortfall)}</li>)}</ul></section>}
 <div className="object-story"><p>{plan.shortfall>0?`${money(plan.shortfall)} short of essentials.`:`Keep optional spending below ${money(plan.daily)} a day.`}</p><small>{plan.shortfall>0?'Pause optional purchases. Reducing treats alone cannot cover this gap: your game budget needs extra income or a revised essential-cost plan.':'Reserve essential bill money first. This daily amount is the remaining flexible budget, not a target to spend.'}</small></div>
 <ol className="recovery-list">{plan.steps.map(step=><li key={step}>{step}</li>)}</ol><p className="muted">This is the game’s forecast under your current plan. Try a fresh run with a more sustainable budget.</p><button className="button primary full-width" onClick={onRestart}>Try a fresh start</button></Modal>;
}
