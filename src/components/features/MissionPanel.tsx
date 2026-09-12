'use client';
import {useState} from 'react';
import {Check,ClipboardList,ChevronDown} from 'lucide-react';
import type {GameState} from '@/engine/Types';
import {monthOfRun} from '@/engine/DailyReview';
import {MISSIONS,missionProgress} from '@/engine/Progression';
export default function MissionPanel({game}:{game:GameState}){
 const [open,setOpen]=useState(false);
 return <aside className={`missions-panel ${open?'is-open':'is-closed'}`} aria-label="Missions and tasks"><button className="missions-toggle" aria-expanded={open} aria-controls="mission-details" onClick={()=>setOpen(value=>!value)}><ClipboardList size={18}/><span>Missions &amp; tasks</span><ChevronDown size={16} style={{transform:open?'rotate(180deg)':undefined}}/></button> <section id="mission-details" hidden={!open} tabIndex={0} className="mission-list" aria-label="Monthly missions"><h3>Good habits · monthly missions</h3><p>Transaction updates count toward your monthly missions.</p>{MISSIONS.map(m=>{const progress=missionProgress(game,m.id),done=game.progression.claimed.includes(`mission-${monthOfRun(game.metrics.turn)}-${m.id}`);return <div className="mission" key={m.id}><div><strong>{m.title}</strong><span>{done?<><Check size={12}/> Complete</>:`+${m.reward} coins`}</span></div><p>{m.detail}</p><progress max={m.target} value={Math.min(m.target,progress)} aria-label={`${m.title} progress`}/><small>${Math.min(m.target,progress).toFixed(2)} / ${m.target} imported</small></div>;})}</section></aside>;
}
