/* Reusable trading floor UI: topbar, stock/ETF sidebar, portfolio, news feed
   and fullscreen chart + buy/sell overlay. Used by investing.html (sandbox)
   and career.html (Nest Egg brokerage account).

   createTradingFloor(root, {
     market,            // from createMarket()
     account,           // { cash, holdings: {id: qty}, cost: {id: totalCost} } — mutated in place
     durationMs, eventMinMs, eventMaxMs, title, backLink: {href, label},
     onChange(account), // after every trade
     onEnd({ startValue, endValue }),
   }) -> { start, end, destroy, fireEvent, addTopbarButton, portfolioValue, isActive }

   The sidebar is built once and updated in place, so live price updates never
   replace a button mid-click. */
const MAX_NEWS_FEED = 8;
const MAX_TRADE_LOG = 6;

function createTradingFloor(root, options) {
  const o = { durationMs: 12 * 60 * 1000, eventMinMs: 8000, eventMaxMs: 20000, title: 'Grapefruit Trading', backLink: null, onChange() {}, onEnd() {}, ...options };
  const { market, account } = o;
  account.holdings = account.holdings || {};
  account.cost = account.cost || {};

  const round2 = n => Math.round(n * 100) / 100;
  const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  const sectorLabel = id => (SECTORS.find(s => s.id === id) || { label: id }).label;

  let active = false, selectedId = null, endAt = 0, startValue = 0;
  let scheduler = null, stepTimer = null, rafId = null, msgTimer = null, flashTimer = null;
  const recentEvents = [];

  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="logo">&#127818;</span>${o.title}</div>
      ${o.backLink ? `<a class="back" href="${o.backLink.href}">${o.backLink.label}</a>` : ''}
      <div class="topbar-actions" data-ref="actions"></div>
      <div class="spacer"></div>
      <div class="metric cash"><div class="label">Cash</div><div class="val" data-ref="cashVal">$0.00</div></div>
      <div class="metric"><div class="label">Portfolio</div><div class="val" data-ref="portfolioVal">$0.00</div></div>
      <div class="metric timer" data-ref="timerMetric"><div class="label">Time left</div><div class="val" data-ref="timerVal">--:--</div></div>
    </header>
    <div class="layout">
      <aside class="sidebar" data-ref="sidebar"></aside>
      <main class="browse">
        <div class="ticker-banner empty" data-ref="tickerBanner">
          <span class="badge">BREAKING</span>
          <span class="headline" data-ref="tickerHeadline">Waiting on the wire for the first headline…</span>
        </div>
        <div class="panels">
          <div>
            <div class="portfolio-card">
              <h2>Your Portfolio</h2>
              <div class="portfolio-stats">
                <div class="item"><div class="label">Session start</div><div class="val" data-ref="statStart">$0</div></div>
                <div class="item"><div class="label">Total value</div><div class="val" data-ref="statTotal">$0</div></div>
                <div class="item"><div class="label">Session P/L</div><div class="val" data-ref="statGain">$0</div></div>
              </div>
              <div class="table-scroll">
                <table class="holdings-table" data-ref="holdingsTable">
                  <thead><tr><th>Ticker</th><th>Shares</th><th>Avg cost</th><th>Price</th><th>Value</th><th>P/L</th></tr></thead>
                  <tbody data-ref="holdingsBody"></tbody>
                </table>
              </div>
              <div class="holdings-empty" data-ref="holdingsEmpty">No positions yet. Pick something on the left to start trading.</div>
            </div>
            <div class="how-card">
              <b>How news moves prices:</b> a headline moves its whole sector a little right away, and the rest of the move plays out over the next ~15 seconds. Read fast, trade fast.
            </div>
          </div>
          <div class="news-feed">
            <h2>Latest News</h2>
            <div data-ref="newsList"><div class="news-empty">Headlines will appear here as the market moves.</div></div>
          </div>
        </div>
      </main>
    </div>
    <div class="detail-overlay" data-ref="detailOverlay">
      <div class="detail-top">
        <button class="exit-btn" data-ref="exitDetailBtn">&#8592; Exit</button>
        <div class="who"><div class="tk" data-ref="detailTicker">—</div><h2 data-ref="detailName">—</h2></div>
        <div class="price-now"><div class="p" data-ref="detailPrice">$0.00</div><div class="c" data-ref="detailChange">+0.00%</div></div>
      </div>
      <div class="detail-body">
        <div class="chart-wrap"><svg data-ref="detailChart" viewBox="0 0 900 400" preserveAspectRatio="none"></svg></div>
        <div class="trade-panel">
          <div class="locked-banner" data-ref="lockedBanner" style="display:none;">Session ended. Trading is locked.</div>
          <h3>Position</h3>
          <div class="owned" data-ref="ownedLine">0 shares owned</div>
          <h3>Trade</h3>
          <div class="qty-row">
            <button type="button" data-ref="qtyMinus">−</button>
            <input type="number" data-ref="qtyInput" value="1" min="1" step="1" aria-label="Quantity"/>
            <button type="button" data-ref="qtyPlus">+</button>
            <button type="button" data-ref="qtyMax">MAX</button>
          </div>
          <div class="trade-buttons">
            <button class="buy-btn" data-ref="buyBtn">BUY</button>
            <button class="sell-btn" data-ref="sellBtn">SELL</button>
          </div>
          <div class="trade-msg" data-ref="tradeMsg"></div>
          <h3>Recent trades</h3>
          <ul class="trade-log" data-ref="tradeLog"><li style="color:#666;">No trades yet</li></ul>
        </div>
      </div>
      <div class="mini-ticker" data-ref="miniTicker">BREAKING: waiting on the wire…</div>
    </div>`;

  const ref = {};
  root.querySelectorAll('[data-ref]').forEach(node => { ref[node.dataset.ref] = node; });

  const allInstruments = () => [...market.companies, ...market.etfs];
  const changePct = inst => inst.sessionStart ? round2(((inst.price - inst.sessionStart) / inst.sessionStart) * 100) : 0;
  const portfolioValue = () => round2(account.cash + holdingsValue(market, account.holdings));

  // ---------- sidebar (built once, updated in place) ----------
  const rowRefs = {};
  function rowHtml(inst, isEtf) {
    return `<button class="stock-row ${isEtf ? 'etf' : ''}" data-id="${inst.id}">
      <span class="ticker">${inst.ticker}</span><span class="name">${inst.name}</span>
      <span class="price" data-part="price"></span><span class="chg flat" data-part="chg"></span></button>`;
  }
  function buildSidebar() {
    let html = '';
    SECTORS.forEach(sector => {
      const etf = market.etfs.find(e => e.sector === sector.id);
      const companies = market.companies.filter(c => c.sector === sector.id).sort((a, b) => a.ticker.localeCompare(b.ticker));
      html += `<div class="sector-group"><button class="sector-head" data-toggle="1">${sector.label}<span class="chev">&#9660;</span></button>
        <div class="sector-rows">${etf ? rowHtml(etf, true) : ''}${companies.map(c => rowHtml(c, false)).join('')}</div></div>`;
    });
    const idx = market.etfs.find(e => e.sector === 'market');
    if (idx) html += `<h3>Market Index</h3><div class="sector-rows">${rowHtml(idx, true)}</div>`;
    ref.sidebar.innerHTML = html;
    ref.sidebar.querySelectorAll('.stock-row').forEach(row => {
      rowRefs[row.dataset.id] = { row, price: row.querySelector('[data-part="price"]'), chg: row.querySelector('[data-part="chg"]') };
    });
    ref.sidebar.addEventListener('click', e => {
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) { toggle.parentElement.classList.toggle('collapsed'); return; }
      const row = e.target.closest('.stock-row');
      if (row) openDetail(row.dataset.id);
    });
  }
  function updateSidebar() {
    allInstruments().forEach(inst => {
      const r = rowRefs[inst.id];
      if (!r) return;
      const chg = changePct(inst);
      r.price.textContent = '$' + inst.price.toFixed(2);
      r.chg.textContent = fmtPct(chg);
      r.chg.className = 'chg ' + (chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat');
      r.row.classList.toggle('selected', inst.id === selectedId);
    });
  }

  // ---------- portfolio / news ----------
  function renderPortfolio() {
    const total = portfolioValue();
    ref.cashVal.textContent = money(account.cash);
    ref.portfolioVal.textContent = money(total);
    ref.statStart.textContent = money(startValue);
    ref.statTotal.textContent = money(total);
    const gain = round2(total - startValue);
    ref.statGain.textContent = (gain >= 0 ? '+' : '') + money(gain);
    ref.statGain.style.color = gain >= 0 ? 'var(--green)' : 'var(--red)';

    const rows = Object.entries(account.holdings).filter(([, qty]) => qty > 0);
    ref.holdingsTable.style.display = rows.length ? 'table' : 'none';
    ref.holdingsEmpty.style.display = rows.length ? 'none' : 'block';
    ref.holdingsBody.innerHTML = rows.map(([id, qty]) => {
      const inst = marketInstrument(market, id);
      if (!inst) return '';
      const avg = (account.cost[id] || 0) / qty;
      const pl = round2(qty * inst.price - (account.cost[id] || 0));
      return `<tr><td>${inst.ticker}</td><td>${qty}</td><td>$${avg.toFixed(2)}</td><td>$${inst.price.toFixed(2)}</td><td>$${(qty * inst.price).toFixed(2)}</td>
        <td style="color:${pl >= 0 ? 'var(--green)' : 'var(--red)'}">${pl >= 0 ? '+' : ''}${money(pl)}</td></tr>`;
    }).join('');
  }

  function renderNewsFeed() {
    if (!recentEvents.length) return;
    ref.newsList.innerHTML = recentEvents.slice(0, MAX_NEWS_FEED).map(ev => `
      <div class="news-card">
        <div class="tag ${ev.direction}">${ev.direction === 'positive' ? 'BULLISH' : ev.direction === 'negative' ? 'BEARISH' : 'MIXED'} · ${ev.magnitude.toUpperCase()}</div>
        <h3>${ev.headline}</h3>
        <div class="sector">${sectorLabel(ev.sector)}</div>
      </div>`).join('');
  }

  function renderTickerBanner(ev) {
    ref.tickerBanner.classList.remove('empty');
    ref.tickerHeadline.textContent = ev.headline;
    ref.tickerBanner.style.background = '#20201a';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { ref.tickerBanner.style.background = ''; }, 500);
    ref.miniTicker.innerHTML = `BREAKING: <b>${ev.headline}</b>`;
  }

  // ---------- detail overlay ----------
  function openDetail(id) {
    if (!marketInstrument(market, id)) return;
    selectedId = id;
    ref.detailOverlay.classList.add('active');
    updateSidebar();
    renderDetail();
  }
  function closeDetail() {
    selectedId = null;
    ref.detailOverlay.classList.remove('active');
    updateSidebar();
  }
  function renderDetail() {
    const inst = marketInstrument(market, selectedId);
    if (!inst) return;
    ref.detailTicker.textContent = inst.ticker;
    ref.detailName.textContent = inst.name;
    ref.detailPrice.textContent = '$' + inst.price.toFixed(2);
    const chg = changePct(inst);
    ref.detailChange.textContent = fmtPct(chg) + ' this session';
    ref.detailChange.style.color = chg > 0 ? 'var(--green)' : chg < 0 ? 'var(--red)' : 'var(--muted)';
    renderChart(ref.detailChart, inst.history, inst.trades);
    const owned = account.holdings[inst.id] || 0;
    ref.ownedLine.textContent = `${owned} share${owned === 1 ? '' : 's'} owned · worth $${(owned * inst.price).toFixed(2)}`;
    ref.lockedBanner.style.display = active ? 'none' : 'block';
    ref.buyBtn.disabled = !active;
    ref.sellBtn.disabled = !active;
    ref.tradeLog.innerHTML = inst.trades.length
      ? inst.trades.slice(-MAX_TRADE_LOG).reverse().map(tr => `<li><span class="${tr.type}">${tr.type.toUpperCase()} ${tr.qty}</span><span>@ $${tr.price.toFixed(2)}</span></li>`).join('')
      : '<li style="color:#666;">No trades yet</li>';
  }

  function showTradeMsg(text, kind) {
    ref.tradeMsg.textContent = text;
    ref.tradeMsg.className = 'trade-msg ' + (kind || '');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { ref.tradeMsg.textContent = ''; }, 2600);
  }

  // ---------- trading ----------
  function currentQty() {
    const q = Math.floor(Number(ref.qtyInput.value));
    return Number.isFinite(q) && q > 0 ? q : 1;
  }
  function lastSeq(inst) { return inst.history.length ? inst.history[inst.history.length - 1].seq : 0; }
  function afterTrade() { renderDetail(); renderPortfolio(); updateSidebar(); o.onChange(account); }

  function buy() {
    if (!active) { showTradeMsg('Trading is locked. The session ended.', 'err'); return; }
    const inst = marketInstrument(market, selectedId);
    if (!inst) return;
    const qty = currentQty();
    const cost = round2(qty * inst.price);
    if (cost > account.cash + 0.001) { showTradeMsg('Not enough cash for that.', 'err'); return; }
    account.cash = round2(account.cash - cost);
    account.holdings[inst.id] = (account.holdings[inst.id] || 0) + qty;
    account.cost[inst.id] = round2((account.cost[inst.id] || 0) + cost);
    inst.trades.push({ seq: lastSeq(inst), type: 'buy', qty, price: inst.price, t: Date.now() });
    showTradeMsg(`Bought ${qty} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok');
    afterTrade();
  }

  function sell() {
    if (!active) { showTradeMsg('Trading is locked. The session ended.', 'err'); return; }
    const inst = marketInstrument(market, selectedId);
    if (!inst) return;
    const qty = currentQty();
    const owned = account.holdings[inst.id] || 0;
    if (qty > owned) { showTradeMsg(`You only own ${owned} share${owned === 1 ? '' : 's'}.`, 'err'); return; }
    account.cash = round2(account.cash + qty * inst.price);
    const remaining = owned - qty;
    if (remaining > 0) {
      account.holdings[inst.id] = remaining;
      account.cost[inst.id] = round2((account.cost[inst.id] || 0) * remaining / owned);
    } else {
      delete account.holdings[inst.id];
      delete account.cost[inst.id];
    }
    inst.trades.push({ seq: lastSeq(inst), type: 'sell', qty, price: inst.price, t: Date.now() });
    showTradeMsg(`Sold ${qty} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok');
    afterTrade();
  }

  // ---------- market clock ----------
  function renderLive() {
    updateSidebar();
    renderPortfolio();
    if (selectedId) renderDetail();
  }

  function fireEvent(event) {
    recentEvents.unshift(event);
    if (recentEvents.length > 20) recentEvents.length = 20;
    applyMarketEvent(market, event);
    renderTickerBanner(event);
    renderNewsFeed();
    renderLive();
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function tickTimer() {
    if (!active) return;
    const remain = endAt - Date.now();
    ref.timerVal.textContent = formatClock(remain);
    ref.timerMetric.classList.toggle('warn', remain <= Math.min(60000, o.durationMs / 4));
    if (remain <= 0) { end(); return; }
    rafId = requestAnimationFrame(tickTimer);
  }

  function stopClocks() {
    if (scheduler) scheduler.stop();
    clearInterval(stepTimer);
    cancelAnimationFrame(rafId);
    scheduler = null; stepTimer = null; rafId = null;
  }

  function start() {
    if (active) return;
    resetMarketHistory(market);
    active = true;
    startValue = portfolioValue();
    endAt = Date.now() + o.durationMs;
    scheduler = new EventScheduler(EVENTS, fireEvent, { minMs: o.eventMinMs, maxMs: o.eventMaxMs });
    scheduler.start();
    stepTimer = setInterval(() => { stepMarket(market, MARKET_STEP_MS); renderLive(); }, MARKET_STEP_MS);
    renderLive();
    tickTimer();
  }

  function end() {
    if (!active) return;
    active = false;
    stopClocks();
    settleMarketReactions(market);
    recordMarketPoint(market);
    ref.timerVal.textContent = '00:00';
    ref.timerMetric.classList.remove('warn');
    renderLive();
    o.onEnd({ startValue, endValue: portfolioValue() });
  }

  function onKey(e) {
    if (e.key === 'Escape' && !e.defaultPrevented && ref.detailOverlay.classList.contains('active')) closeDetail();
  }

  function destroy() {
    active = false;
    stopClocks();
    clearTimeout(msgTimer);
    clearTimeout(flashTimer);
    document.removeEventListener('keydown', onKey);
    root.innerHTML = '';
  }

  function addTopbarButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    ref.actions.appendChild(btn);
    return btn;
  }

  // ---------- wire up ----------
  ref.exitDetailBtn.addEventListener('click', closeDetail);
  ref.buyBtn.addEventListener('click', buy);
  ref.sellBtn.addEventListener('click', sell);
  ref.qtyMinus.addEventListener('click', () => { ref.qtyInput.value = Math.max(1, currentQty() - 1); });
  ref.qtyPlus.addEventListener('click', () => { ref.qtyInput.value = currentQty() + 1; });
  ref.qtyMax.addEventListener('click', () => {
    const inst = marketInstrument(market, selectedId);
    if (!inst) return;
    ref.qtyInput.value = Math.max(1, Math.floor(account.cash / inst.price), account.holdings[inst.id] || 0);
  });
  document.addEventListener('keydown', onKey);

  buildSidebar();
  startValue = portfolioValue();
  renderLive();

  return { start, end, destroy, fireEvent, addTopbarButton, portfolioValue, isActive: () => active, closeDetail };
}
