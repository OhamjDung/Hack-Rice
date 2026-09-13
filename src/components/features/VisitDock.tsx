'use client';
import { useRef, useState } from 'react';
import { Users } from 'lucide-react';

// Swipe (or drag) this chip to open the "visit a friend" prompt — the gesture behind
// "jumping" your character over to someone else's room.
export default function VisitDock({ onSwipe }: { onSwipe: () => void }) {
    const start = useRef<{ x: number; id: number } | null>(null);
    const [dx, setDx] = useState(0);
    const THRESHOLD = 56;
    function onPointerDown(e: React.PointerEvent) { start.current = { x: e.clientX, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }
    function onPointerMove(e: React.PointerEvent) { if (!start.current || start.current.id !== e.pointerId) return; setDx(e.clientX - start.current.x); }
    function onPointerUp(e: React.PointerEvent) {
        if (!start.current || start.current.id !== e.pointerId) return;
        const moved = e.clientX - start.current.x;
        start.current = null; setDx(0);
        if (Math.abs(moved) > THRESHOLD) onSwipe();
    }
    return <div className="visit-dock" role="button" tabIndex={0} aria-label="Swipe to visit a friend's room"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={()=>{start.current=null;setDx(0);}}
        onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSwipe();}}}
        style={{ transform: `translateX(${Math.max(-40,Math.min(40,dx))}px)` }}>
        <Users size={18}/><span>Swipe to visit a friend</span>
    </div>;
}
