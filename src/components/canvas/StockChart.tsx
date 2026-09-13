import type { Trade } from '@/engine/Market';
const PAD = 16, W = 900, H = 300;
export default function StockChart({ history, trades }: {
    history: { seq: number; price: number }[];
    trades: Trade[];
}) {
    if (history.length < 2) return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"/>;
    const prices = history.map(h => h.price);
    const min = Math.min(...prices), max = Math.max(...prices), span = Math.max(0.01, max - min);
    const pts = history.map((h, i) => ({ x: PAD + (i / (history.length - 1)) * (W - PAD * 2), y: H - PAD - ((h.price - min) / span) * (H - PAD * 2), price: h.price, seq: h.seq }));
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const first = pts[0], last = pts[pts.length - 1], up = last.price >= first.price;
    return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={0} y1={last.y} x2={W} y2={last.y} stroke="var(--line)" strokeWidth={1}/>
      <path d={d} fill="none" stroke={up ? 'var(--green)' : 'var(--danger)'} strokeWidth={2.5}/>
      {trades.map(tr => { const p = pts.find(pt => pt.seq === tr.seq); if (!p) return null; const glyph = tr.type === 'buy' ? `M${(p.x - 6).toFixed(1)},${(p.y + 11).toFixed(1)} L${(p.x + 6).toFixed(1)},${(p.y + 11).toFixed(1)} L${p.x.toFixed(1)},${(p.y - 1).toFixed(1)} Z` : `M${(p.x - 6).toFixed(1)},${(p.y - 11).toFixed(1)} L${(p.x + 6).toFixed(1)},${(p.y - 11).toFixed(1)} L${p.x.toFixed(1)},${(p.y + 1).toFixed(1)} Z`; return <path key={`${tr.seq}-${tr.type}`} d={glyph} fill={tr.type === 'buy' ? 'var(--green)' : 'var(--danger)'} stroke="var(--bg)" strokeWidth={1}/>; })}
    </svg>;
}
