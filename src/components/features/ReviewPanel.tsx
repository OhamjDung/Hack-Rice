'use client';
import {Sparkles, AlertTriangle, ArrowUpRight} from 'lucide-react';
import type {GameState} from '@/engine/Types';
import {dayOfMonth} from '@/engine/DailyReview';
import Modal from '@/components/ui/Modal';

export function ForecastModal({game,onClose}:{game:GameState;onClose:()=>void}){
 const latest=game.reviews.find(r=>r.kind==='close');
 return <Modal title="Forecast & next steps" onClose={onClose}>
  {latest?<div className="forecast-content">
   <p className="muted">Day {dayOfMonth(latest.assessedDay)} - {latest.analysis.riskRating.toLowerCase()} risk</p>
   <h3>Your forecast</h3><p>{latest.analysis.reason}</p>
   <h3>Next steps</h3><ol>{latest.analysis.recoverySteps.map(step=><li key={step}>{step}</li>)}</ol>
  </div>:<p className="muted">End a day to see your forecast.</p>}
  <button className="button primary full-width" onClick={onClose}>Back to my day</button>
 </Modal>;
}

export default function ReviewPanel({game,reviewing,onForecast}:{game:GameState;reviewing:string;onForecast:()=>void}){
 const latest=game.reviews.find(r=>r.kind==='close');
 return <aside className="review-panel" aria-label="Daily review">
  <h2><Sparkles size={17}/> Daily review</h2>
  <div className={`review-status ${latest?.analysis.isWarning?'has-warning':''}`} role="status"><div>
   <strong>{reviewing||(latest?`Daily review - Day ${dayOfMonth(latest.assessedDay)}`:'Ready at End day')}</strong>
   <p>{latest?.analysis.commentary||'Live your day. Check in here tomorrow morning.'}</p>
  </div></div>
  {latest&&<button className="forecast-button" onClick={onForecast} aria-haspopup="dialog">{latest.analysis.isWarning&&<AlertTriangle size={15} aria-hidden="true"/>} Forecast &amp; next steps <ArrowUpRight size={15} aria-hidden="true"/></button>}
 </aside>;
}
