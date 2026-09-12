/* Renders a price-history line into an <svg> plus buy/sell trade markers. */
const CHART_W = 900, CHART_H = 400, CHART_PAD = 16;

function renderChart(svg, history, trades) {
  if (!history || history.length < 2) { svg.innerHTML = ''; return; }
  const prices = history.map(h => h.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const span = Math.max(0.01, max - min);

  const pts = history.map((h, i) => ({
    x: CHART_PAD + (i / (history.length - 1)) * (CHART_W - CHART_PAD * 2),
    y: CHART_H - CHART_PAD - ((h.price - min) / span) * (CHART_H - CHART_PAD * 2),
    price: h.price,
  }));

  const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const first = pts[0], last = pts[pts.length - 1];
  const up = last.price >= first.price;

  let markers = '';
  (trades || []).forEach(tr => {
    const p = pts[tr.index];
    if (!p) return;
    const color = tr.type === 'buy' ? '#3ddc5a' : '#e5473f';
    const glyph = tr.type === 'buy'
      ? `M${(p.x - 6).toFixed(1)},${(p.y + 11).toFixed(1)} L${(p.x + 6).toFixed(1)},${(p.y + 11).toFixed(1)} L${p.x.toFixed(1)},${(p.y - 1).toFixed(1)} Z`
      : `M${(p.x - 6).toFixed(1)},${(p.y - 11).toFixed(1)} L${(p.x + 6).toFixed(1)},${(p.y - 11).toFixed(1)} L${p.x.toFixed(1)},${(p.y + 1).toFixed(1)} Z`;
    markers += `<path d="${glyph}" fill="${color}" stroke="#0a0a0b" stroke-width="1"/>`;
  });

  svg.innerHTML = `
    <line x1="0" y1="${last.y.toFixed(1)}" x2="${CHART_W}" y2="${last.y.toFixed(1)}" stroke="#3a3a3e" stroke-width="1"/>
    <path d="${d}" fill="none" stroke="${up ? '#3ddc5a' : '#f5e642'}" stroke-width="2.5"/>
    ${markers}
  `;
  return last;
}
