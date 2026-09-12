import { Sparkles, ArrowUpRight } from 'lucide-react';
import type { GameState } from '@/engine/Types';
export default function GeminiAdvisorWidget({ game, busy, source, onAsk }: {
    game: GameState;
    busy: boolean;
    source: string;
    onAsk: () => void;
}) { const log = game.advisorLog[0]; return <section className="advisor panel"><div className="section-heading"><div className="advisor-title"><span className="advisor-icon"><Sparkles size={20}/></span><div><h2>A little perspective</h2><span className="eyebrow">{source === 'gemini' ? 'GEMINI COACH' : 'LOCAL COACH · DEMO READY'}</span></div></div><span className="online-dot"/></div><p className="advisor-message">“{log?.message}”</p>{log?.actionablePlan && <div className="advisor-tip"><span>YOUR NEXT GOOD MOVE</span><p>{log.actionablePlan[0]}</p></div>}<button className="text-button" onClick={onAsk} disabled={busy}>{busy ? 'Thinking it through…' : 'Check in with my coach'}<ArrowUpRight size={15}/></button></section>; }
