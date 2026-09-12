/* Renders a price-history line into an <svg> plus buy/sell trade markers.
   Reads the target <svg>'s own viewBox for its drawing size rather than
   assuming one, so it works at whatever aspect ratio a caller sets — a
   mismatch here previously clipped the line off the bottom of any chart
   shorter than the hardcoded 400 (the stock cards use a 900x300 viewBox). */
const CHART_W_DEFAULT = 900, CHART_H_DEFAULT = 400, CHART_PAD = 16;

function renderChart(svg, history, trades) {
  if (!history || history.length < 2) { svg.innerHTML = ''; return; }
  const vb = svg.viewBox && svg.viewBox.baseVal;
  const CHART_W = (vb && vb.width) || CHART_W_DEFAULT;
  const CHART_H = (vb && vb.height) || CHART_H_DEFAULT;
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
  // Trades point at a history `seq` (not an array index) so markers stay put
  // when old points are trimmed; a trade whose point was trimmed is skipped.
  (trades || []).forEach(tr => {
    const p = pts[history.findIndex(h => h.seq === tr.seq)];
    if (!p) return;
    const color = tr.type === 'buy' ? 'var(--green)' : 'var(--red)';
    const glyph = tr.type === 'buy'
      ? `M${(p.x - 6).toFixed(1)},${(p.y + 11).toFixed(1)} L${(p.x + 6).toFixed(1)},${(p.y + 11).toFixed(1)} L${p.x.toFixed(1)},${(p.y - 1).toFixed(1)} Z`
      : `M${(p.x - 6).toFixed(1)},${(p.y - 11).toFixed(1)} L${(p.x + 6).toFixed(1)},${(p.y - 11).toFixed(1)} L${p.x.toFixed(1)},${(p.y + 1).toFixed(1)} Z`;
    markers += `<path d="${glyph}" fill="${color}" stroke="var(--bg)" stroke-width="1"/>`;
  });

  // Colors are CSS custom properties so the chart follows whichever theme is loaded.
  svg.innerHTML = `
    <line x1="0" y1="${last.y.toFixed(1)}" x2="${CHART_W}" y2="${last.y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>
    <path d="${d}" fill="none" stroke="${up ? 'var(--green)' : 'var(--red)'}" stroke-width="2.5"/>
    ${markers}
  `;
  return last;
}
