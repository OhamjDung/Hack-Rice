import type { GameState } from './Types.ts';

export function rewindRun(state: GameState): GameState {
    if (!state.rewindCheckpoint) return state;
    const restored = structuredClone(state.rewindCheckpoint);
    // Replaying imported purchases is a local simulation, detached from bank sync.
    const warning=state.reviews.find(r=>r.kind==='close'&&r.analysis.isWarning);
    restored.coachingBaseline=state.coachingBaseline ?? (warning?{review:warning,cashBalance:state.metrics.cashBalance,optionalSpent:state.transactions.filter(t=>t.gameDay===warning.assessedDay&&t.kind==='purchase'&&t.category==='leisure').reduce((sum,t)=>sum+t.amount,0)}:undefined);
    restored.reviews=[];
    restored.command={message:'A fresh chance. Choose your next action, then end the day for a new review.',severity:'info',behavior:'calm',day:restored.metrics.turn};
    restored.player.state='idle';restored.player.targetPosition=null;
    restored.mode = 'demo';
    return restored;
}
