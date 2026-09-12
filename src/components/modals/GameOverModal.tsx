'use client';
import Modal from '@/components/ui/Modal';
import type {GameState} from '@/engine/Types';
import {endingAdvice} from '@/engine/EndingAdvice';
const endings={none:'This chapter ends here.',food_shortage:'The fridge emptied. Your character could not go on.',power_cut:'The bills caught up. The room went dark.',eviction:'Rent ran out. So did this chapter.',exhaustion:'Too much strain. Your character collapsed.',bankruptcy:'The wallet gave out.'};
export default function GameOverModal({game,onClose,onRestart,onRewind}:{game:GameState;onClose:()=>void;onRestart:()=>void;onRewind:()=>void}){
 const advice=endingAdvice(game);
 return <Modal title="A different tomorrow?" onClose={onClose}>
  <p className="ending-note">{endings[game.ending.kind]}</p>
  <p className="muted">{game.gameOverReason || game.ending.reason}</p>
  <div className="object-story" aria-label="Advice"><p>{advice.steps[0]}</p><small>{advice.steps[1]}</small></div>
  <details className="ending-details"><summary>A little advice</summary><ul>{advice.steps.slice(2).map(step=><li key={step}>{step}</li>)}</ul></details>
  <div className="ending-choices" aria-label="Choose how to continue">
   <button className="button primary" onClick={onRewind} disabled={!game.rewindCheckpoint} aria-describedby={!game.rewindCheckpoint?'rewind-unavailable':undefined}><strong>Travel back in time</strong><span>Return before the risky purchase and redo your action.</span></button>
   {!game.rewindCheckpoint&&<p className="muted" id="rewind-unavailable">No earlier purchase checkpoint exists for this save yet.</p>}
   <button className="button secondary" onClick={onRestart}><strong>New start</strong><span>Create a character and begin a fresh run.</span></button>
  </div>
 </Modal>;
}
