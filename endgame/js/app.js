/* Investing mini-game: sector news events move sector stocks/ETFs,
   a session timer locks trading, and results are scored against a
   persisted personal record with diminishing-returns rewards. */
(function () {
  'use strict';

  // ---------- configurable constants ----------
  const SESSION_DURATION_MINUTES = 12; // 10-15 min per spec
  const STARTING_CASH = 10000;
  const EVENT_MIN_MS = 8000;
  const EVENT_MAX_MS = 20000;
  const IDLE_TICK_MS = 2500;
  const IDLE_JITTER_PCT = 0.3; // cosmetic-only drift between news events, keeps charts alive
  const MAX_HISTORY_POINTS = 240;
  const MAX_NEWS_FEED = 8;
  const MAX_TRADE_LOG = 6;

  // ---------- helpers ----------
  const round2 = n => Math.round(n * 100) / 100;
  const avg = arr => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

  // ---------- state ----------
  const state = {
    companies: [],
    etfs: [],
    cash: STARTING_CASH,
    holdings: {},
    selectedId: null,
    collapsedSectors: new Set(),
    sessionActive: false,
    sessionEndAt: 0,
    recentEvents: [],
    scheduler: null,
    idleTimer: null,
    rafId: null,
  };

  function getById(id) {
    return state.companies.find(c => c.id === id) || state.etfs.find(e => e.id === id) || null;
  }

  function updateSectorEtf(sectorId) {
    const etf = state.etfs.find(e => e.sector === sectorId);
    if (!etf) return;
    const cons = state.companies.filter(c => c.sector === sectorId);
    etf.price = round2(avg(cons.map(c => c.price)));
    etf.history.push({ t: Date.now(), price: etf.price });
    if (etf.history.length > MAX_HISTORY_POINTS) etf.history.shift();
  }

  function updateMarketEtf() {
    const market = state.etfs.find(e => e.sector === 'market');
    if (!market) return;
    const sectorEtfs = state.etfs.filter(e => e.sector !== 'market');
    market.price = round2(avg(sectorEtfs.map(e => e.price)));
    market.history.push({ t: Date.now(), price: market.price });
    if (market.history.length > MAX_HISTORY_POINTS) market.history.shift();
  }

  function portfolioValue() {
    let v = state.cash;
    for (const id in state.holdings) {
      const qty = state.holdings[id];
      if (!qty) continue;
      const inst = getById(id);
      if (inst) v += qty * inst.price;
    }
    return round2(v);
  }

  function changePct(inst) {
    const start = inst.history[0]?.price;
    if (!start) return 0;
    return round2(((inst.price - start) / start) * 100);
  }

  // ---------- init world ----------
  function initWorld() {
    // Seed two points per series so a flat line renders immediately,
    // before the first idle tick or news event lands.
    state.companies = COMPANIES.map(c => ({ ...c, price: c.basePrice, history: [{ t: Date.now() - 1, price: c.basePrice }, { t: Date.now(), price: c.basePrice }], trades: [] }));
    state.etfs = ETFS.map(e => ({ ...e, price: 0, history: [], trades: [] }));
    // Called twice so each ETF also starts with two history points (see companies above).
    SECTORS.forEach(s => updateSectorEtf(s.id));
    updateMarketEtf();
    SECTORS.forEach(s => updateSectorEtf(s.id));
    updateMarketEtf();
  }

  // ---------- DOM refs ----------
  const el = id => document.getElementById(id);
  const sidebarEl = el('sidebar');
  const cashValEl = el('cashVal');
  const portfolioValEl = el('portfolioVal');
  const timerMetricEl = el('timerMetric');
  const timerValEl = el('timerVal');
  const tickerBannerEl = el('tickerBanner');
  const tickerHeadlineEl = el('tickerHeadline');
  const statStartEl = el('statStart');
  const statTotalEl = el('statTotal');
  const statGainEl = el('statGain');
  const holdingsBodyEl = el('holdingsBody');
  const holdingsEmptyEl = el('holdingsEmpty');
  const holdingsTableEl = el('holdingsTable');
  const newsListEl = el('newsList');

  const detailOverlayEl = el('detailOverlay');
  const detailTickerEl = el('detailTicker');
  const detailNameEl = el('detailName');
  const detailPriceEl = el('detailPrice');
  const detailChangeEl = el('detailChange');
  const detailChartSvg = el('detailChart');
  const ownedLineEl = el('ownedLine');
  const qtyInputEl = el('qtyInput');
  const buyBtnEl = el('buyBtn');
  const sellBtnEl = el('sellBtn');
  const tradeMsgEl = el('tradeMsg');
  const tradeLogEl = el('tradeLog');
  const lockedBannerEl = el('lockedBanner');
  const miniTickerEl = el('miniTicker');

  const summaryBackdropEl = el('summaryBackdrop');
  const summaryTitleEl = el('summaryTitle');
  const recordBadgeWrapEl = el('recordBadgeWrap');
  const sumFinalEl = el('sumFinal');
  const sumGainEl = el('sumGain');
  const sumBestEl = el('sumBest');
  const sumImproveEl = el('sumImprove');
  const sumRewardEl = el('sumReward');

  // ---------- sidebar ----------
  function renderSidebar() {
    let html = '';
    SECTORS.forEach(sector => {
      const collapsed = state.collapsedSectors.has(sector.id);
      const companies = state.companies.filter(c => c.sector === sector.id).sort((a, b) => a.ticker.localeCompare(b.ticker));
      const etf = state.etfs.find(e => e.sector === sector.id);
      html += `<div class="sector-group ${collapsed ? 'collapsed' : ''}" data-sector="${sector.id}">
        <button class="sector-head" data-toggle="${sector.id}">${sector.label}<span class="chev">&#9660;</span></button>
        <div class="sector-rows">
          ${etf ? stockRowHtml(etf, true) : ''}
          ${companies.map(c => stockRowHtml(c, false)).join('')}
        </div>
      </div>`;
    });
    const market = state.etfs.find(e => e.sector === 'market');
    if (market) {
      html += `<h3>Market Index</h3><div class="sector-rows">${stockRowHtml(market, true)}</div>`;
    }
    sidebarEl.innerHTML = html;

    sidebarEl.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle');
        if (state.collapsedSectors.has(id)) state.collapsedSectors.delete(id);
        else state.collapsedSectors.add(id);
        renderSidebar();
      });
    });
    sidebarEl.querySelectorAll('.stock-row').forEach(row => {
      row.addEventListener('click', () => openDetail(row.getAttribute('data-id')));
    });
  }

  function stockRowHtml(inst, isEtf) {
    const chg = changePct(inst);
    const chgClass = chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat';
    const selected = state.selectedId === inst.id ? 'selected' : '';
    return `<button class="stock-row ${isEtf ? 'etf' : ''} ${selected}" data-id="${inst.id}">
      <span class="ticker">${inst.ticker}</span>
      <span class="name">${inst.name}</span>
      <span class="price">$${inst.price.toFixed(2)}</span>
      <span class="chg ${chgClass}">${fmtPct(chg)}</span>
    </button>`;
  }

  // ---------- portfolio / news ----------
  function renderPortfolio() {
    cashValEl.textContent = money(state.cash);
    const total = portfolioValue();
    portfolioValEl.textContent = money(total);
    statStartEl.textContent = money(STARTING_CASH);
    statTotalEl.textContent = money(total);
    const gain = round2(total - STARTING_CASH);
    statGainEl.textContent = (gain >= 0 ? '+' : '') + money(gain);
    statGainEl.style.color = gain >= 0 ? 'var(--green)' : 'var(--red)';

    const rows = Object.entries(state.holdings).filter(([, qty]) => qty > 0);
    if (rows.length === 0) {
      holdingsTableEl.style.display = 'none';
      holdingsEmptyEl.style.display = 'block';
    } else {
      holdingsTableEl.style.display = 'table';
      holdingsEmptyEl.style.display = 'none';
      holdingsBodyEl.innerHTML = rows.map(([id, qty]) => {
        const inst = getById(id);
        if (!inst) return '';
        return `<tr><td>${inst.ticker}</td><td>${qty}</td><td>$${inst.price.toFixed(2)}</td><td>$${(qty * inst.price).toFixed(2)}</td></tr>`;
      }).join('');
    }
  }

  function sectorLabel(id) {
    const s = SECTORS.find(s => s.id === id);
    return s ? s.label : id;
  }

  function renderNewsFeed() {
    if (state.recentEvents.length === 0) {
      newsListEl.innerHTML = '<div class="news-empty">Headlines will appear here as the market moves.</div>';
      return;
    }
    newsListEl.innerHTML = state.recentEvents.slice(0, MAX_NEWS_FEED).map(ev => `
      <div class="news-card">
        <div class="tag ${ev.direction}">${ev.direction === 'positive' ? 'BULLISH' : ev.direction === 'negative' ? 'BEARISH' : 'MIXED'} · ${ev.magnitude.toUpperCase()}</div>
        <h3>${ev.headline}</h3>
        <div class="sector">${sectorLabel(ev.sector)}</div>
      </div>
    `).join('');
  }

  function renderTickerBanner(latestEvent) {
    if (!latestEvent) return;
    tickerBannerEl.classList.remove('empty');
    tickerHeadlineEl.textContent = latestEvent.headline;
    tickerBannerEl.style.background = '#20201a';
    setTimeout(() => { tickerBannerEl.style.background = ''; }, 500);
    if (state.selectedId) miniTickerEl.innerHTML = `BREAKING: <b>${latestEvent.headline}</b>`;
  }

  // ---------- detail / fullscreen ----------
  function openDetail(id) {
    if (!id) return;
    state.selectedId = id;
    detailOverlayEl.classList.add('active');
    renderSidebar();
    renderDetail();
  }

  function closeDetail() {
    state.selectedId = null;
    detailOverlayEl.classList.remove('active');
    renderSidebar();
  }

  function renderDetail() {
    const inst = getById(state.selectedId);
    if (!inst) return;
    detailTickerEl.textContent = inst.ticker;
    detailNameEl.textContent = inst.name;
    detailPriceEl.textContent = '$' + inst.price.toFixed(2);
    const chg = changePct(inst);
    detailChangeEl.textContent = fmtPct(chg) + ' this session';
    detailChangeEl.style.color = chg > 0 ? 'var(--green)' : chg < 0 ? 'var(--red)' : 'var(--muted)';
    renderChart(detailChartSvg, inst.history, inst.trades);

    const owned = state.holdings[inst.id] || 0;
    ownedLineEl.textContent = `${owned} share${owned === 1 ? '' : 's'} owned · worth $${(owned * inst.price).toFixed(2)}`;

    const locked = !state.sessionActive;
    lockedBannerEl.style.display = locked ? 'block' : 'none';
    buyBtnEl.disabled = locked;
    sellBtnEl.disabled = locked;

    renderTradeLog(inst);
  }

  function renderTradeLog(inst) {
    if (!inst.trades.length) {
      tradeLogEl.innerHTML = '<li style="color:#666;">No trades yet</li>';
      return;
    }
    tradeLogEl.innerHTML = inst.trades.slice(-MAX_TRADE_LOG).reverse().map(tr => `
      <li><span class="${tr.type}">${tr.type.toUpperCase()} ${tr.qty}</span><span>@ $${tr.price.toFixed(2)}</span></li>
    `).join('');
  }

  function showTradeMsg(text, kind) {
    tradeMsgEl.textContent = text;
    tradeMsgEl.className = 'trade-msg ' + (kind || '');
    clearTimeout(showTradeMsg._t);
    showTradeMsg._t = setTimeout(() => { tradeMsgEl.textContent = ''; }, 2600);
  }

  function currentQty() {
    const q = Math.floor(Number(qtyInputEl.value));
    return Number.isFinite(q) && q > 0 ? q : 1;
  }

  function buy() {
    if (!state.sessionActive) { showTradeMsg('Trading is locked — session ended.', 'err'); return; }
    const inst = getById(state.selectedId);
    if (!inst) return;
    const qty = currentQty();
    const cost = round2(qty * inst.price);
    if (cost > state.cash + 0.001) { showTradeMsg('Not enough cash for that.', 'err'); return; }
    state.cash = round2(state.cash - cost);
    state.holdings[inst.id] = (state.holdings[inst.id] || 0) + qty;
    inst.trades.push({ index: inst.history.length - 1, type: 'buy', qty, price: inst.price, t: Date.now() });
    showTradeMsg(`Bought ${qty} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok');
    renderDetail();
    renderPortfolio();
    renderSidebar();
  }

  function sell() {
    if (!state.sessionActive) { showTradeMsg('Trading is locked — session ended.', 'err'); return; }
    const inst = getById(state.selectedId);
    if (!inst) return;
    const qty = currentQty();
    const owned = state.holdings[inst.id] || 0;
    if (qty > owned) { showTradeMsg(`You only own ${owned} share${owned === 1 ? '' : 's'}.`, 'err'); return; }
    state.cash = round2(state.cash + qty * inst.price);
    state.holdings[inst.id] = owned - qty;
    inst.trades.push({ index: inst.history.length - 1, type: 'sell', qty, price: inst.price, t: Date.now() });
    showTradeMsg(`Sold ${qty} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok');
    renderDetail();
    renderPortfolio();
    renderSidebar();
  }

  // ---------- news events ----------
  function applyEventToSector(event) {
    const affected = state.companies.filter(c => c.sector === event.sector);
    const [lo, hi] = event.priceChangeRange;
    affected.forEach(c => {
      const basePct = lo + Math.random() * (hi - lo);
      const scaledPct = basePct * (0.6 + c.volatility * 0.6);
      const newPrice = Math.max(0.5, round2(c.price * (1 + scaledPct / 100)));
      c.price = newPrice;
      c.history.push({ t: Date.now(), price: newPrice });
      if (c.history.length > MAX_HISTORY_POINTS) c.history.shift();
    });
    updateSectorEtf(event.sector);
    updateMarketEtf();
  }

  function handleEvent(event) {
    state.recentEvents.unshift({ ...event, firedAt: Date.now() });
    if (state.recentEvents.length > 20) state.recentEvents.length = 20;
    applyEventToSector(event);
    renderTickerBanner(event);
    renderNewsFeed();
    renderSidebar();
    renderPortfolio();
    if (state.selectedId) {
      const sel = getById(state.selectedId);
      if (sel && (sel.sector === event.sector || sel.sector === 'market')) renderDetail();
    }
  }

  // Cosmetic-only tiny drift between news events so charts don't sit dead flat.
  // This never competes with event-driven moves in magnitude.
  function idleTick() {
    if (!state.sessionActive) return;
    state.companies.forEach(c => {
      const jitter = (Math.random() - 0.5) * IDLE_JITTER_PCT * 2;
      c.price = Math.max(0.5, round2(c.price * (1 + jitter / 100)));
      c.history.push({ t: Date.now(), price: c.price });
      if (c.history.length > MAX_HISTORY_POINTS) c.history.shift();
    });
    SECTORS.forEach(s => updateSectorEtf(s.id));
    updateMarketEtf();
    renderSidebar();
    renderPortfolio();
    if (state.selectedId) renderDetail();
  }

  // ---------- session timer ----------
  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function tickTimer() {
    if (!state.sessionActive) return;
    const remain = state.sessionEndAt - Date.now();
    timerValEl.textContent = formatClock(remain);
    timerMetricEl.classList.toggle('warn', remain <= 60000);
    if (remain <= 0) { endSession(); return; }
    state.rafId = requestAnimationFrame(tickTimer);
  }

  function startSession() {
    state.sessionActive = true;
    state.sessionEndAt = Date.now() + SESSION_DURATION_MINUTES * 60 * 1000;
    state.scheduler = new EventScheduler(EVENTS, handleEvent, { minMs: EVENT_MIN_MS, maxMs: EVENT_MAX_MS });
    state.scheduler.start();
    state.idleTimer = setInterval(idleTick, IDLE_TICK_MS);
    tickTimer();
  }

  function endSession() {
    state.sessionActive = false;
    if (state.scheduler) state.scheduler.stop();
    if (state.idleTimer) clearInterval(state.idleTimer);
    if (state.rafId) cancelAnimationFrame(state.rafId);
    timerValEl.textContent = '00:00';
    if (state.selectedId) renderDetail();
    showSummary();
  }

  // ---------- reward / summary ----------
  function showSummary() {
    const finalValue = portfolioValue();
    const gain = round2(finalValue - STARTING_CASH);
    const record = loadRecord();
    const result = calcReward(gain, record);

    summaryTitleEl.textContent = result.isNewRecord ? 'New personal record!' : 'Session complete';
    recordBadgeWrapEl.innerHTML = result.isNewRecord ? '<span class="badge-record">&#9733; NEW RECORD</span>' : '';
    sumFinalEl.textContent = money(finalValue);
    sumGainEl.textContent = (gain >= 0 ? '+' : '') + money(gain);
    sumGainEl.style.color = gain >= 0 ? 'var(--green)' : 'var(--red)';
    sumBestEl.textContent = money(Math.max(record.bestGain, gain) + STARTING_CASH);
    sumImproveEl.textContent = (result.improvementRatio * 100).toFixed(0) + '%';
    sumRewardEl.textContent = result.reward;

    const updatedRecord = {
      bestGain: Math.max(record.bestGain, gain),
      bestValue: Math.max(record.bestValue, finalValue),
      runs: (record.runs || 0) + 1,
    };
    saveRecord(updatedRecord);

    summaryBackdropEl.classList.add('active');
  }

  // ---------- wire up controls ----------
  el('exitDetailBtn').addEventListener('click', closeDetail);
  buyBtnEl.addEventListener('click', buy);
  sellBtnEl.addEventListener('click', sell);
  el('qtyMinus').addEventListener('click', () => { qtyInputEl.value = Math.max(1, currentQty() - 1); });
  el('qtyPlus').addEventListener('click', () => { qtyInputEl.value = currentQty() + 1; });
  el('qtyMax').addEventListener('click', () => {
    const inst = getById(state.selectedId);
    if (!inst) return;
    const owned = state.holdings[inst.id] || 0;
    const affordable = Math.floor(state.cash / inst.price);
    qtyInputEl.value = Math.max(1, Math.max(affordable, owned));
  });
  el('summaryCloseBtn').addEventListener('click', () => summaryBackdropEl.classList.remove('active'));
  el('playAgainBtn').addEventListener('click', () => location.reload());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && detailOverlayEl.classList.contains('active')) closeDetail(); });

  // ---------- boot ----------
  initWorld();
  renderSidebar();
  renderPortfolio();
  renderNewsFeed();
  startSession();

  // debug hook for manual testing in the console
  window.__game = { state, handleEvent, endSession, EVENTS, COMPANIES };
})();
