/* Reusable trading floor UI: topbar, portfolio summary + trade history, and
   one card per dealt stock (chart + buy/sell right there, no separate
   fullscreen view — with only 6 stocks a session, all of them fit on one
   page). Used by investing.html (standalone) and career.html (Nest Egg
   brokerage account).

   createTradingFloor(root, {
     market,            // from createMarket()
     account,           // { cash, holdings: {id: qty}, cost: {id: totalCost} } — mutated in place
     durationMs, title, backLink: {href, label},
     onChange(account), // after every trade
     onEnd({ startValue, endValue }),
   }) -> { start, end, destroy, addTopbarButton, portfolioValue, isActive }

   Cards are built once and updated in place, so live price updates never
   replace a button mid-click. Prices come from real recorded history via
   market.js — there is no synthetic news layer here, on purpose. */
const MAX_HISTORY_FEED = 40;

function createTradingFloor(root, options) {
  const o = { durationMs: null, title: 'Grapefruit Trading', backLink: null, onChange() {}, onEnd() {}, ...options };
  const { market, account } = o;
  const durationMs = o.durationMs || sessionDurationMs(market);
  account.holdings = account.holdings || {};
  account.cost = account.cost || {};

  const round2 = n => Math.round(n * 100) / 100;
  const money = n => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

  let active = false, endAt = 0, startValue = 0;
  let stepTimer = null, rafId = null;
  const tradeHistory = []; // every trade this session, across all 6 stocks, newest first

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
    <main class="browse">
      <div class="how-card">
        <b>This is real stock data.</b> These are 6 real companies' actual prices from a recent trading day, replayed slower than real time. Buy or sell any of them right below its chart. Nothing on this page predicts which way a price is headed — you're watching it happen, same as any trader does.
      </div>
      <div class="panels">
        <div class="portfolio-card">
          <h2>Your Portfolio</h2>
          <div class="portfolio-stats">
            <div class="item"><div class="label">Session start</div><div class="val" data-ref="statStart">$0</div></div>
            <div class="item"><div class="label">Total value</div><div class="val" data-ref="statTotal">$0</div></div>
            <div class="item"><div class="label">Session P/L</div><div class="val" data-ref="statGain">$0</div></div>
          </div>
        </div>
        <div class="history-feed">
          <h2>Trade History</h2>
          <div class="history-list" data-ref="historyList"><div class="history-empty">Trades you make this session show up here.</div></div>
        </div>
      </div>
      <div class="locked-banner" data-ref="lockedBanner" style="display:none;">Session ended. Trading is locked.</div>
      <div class="stock-grid" data-ref="stockGrid"></div>
    </main>`;

  const ref = {};
  root.querySelectorAll('[data-ref]').forEach(node => { ref[node.dataset.ref] = node; });

  const changePct = inst => inst.sessionStart ? round2(((inst.price - inst.sessionStart) / inst.sessionStart) * 100) : 0;
  const portfolioValue = () => round2(account.cash + holdingsValue(market, account.holdings));

  // ---------- stock cards (built once, updated in place) ----------
  const cardRefs = {};
  function buildStockGrid() {
    ref.stockGrid.innerHTML = market.stocks.map(inst => `
      <div class="stock-card" data-id="${inst.id}">
        <div class="stock-head">
          <div class="who"><span class="ticker">${inst.ticker}</span><span class="name">${inst.name}</span></div>
          <div class="price-now"><span class="p" data-part="price">$0.00</span><span class="c" data-part="chg">+0.00%</span></div>
        </div>
        <div class="stock-body">
          <div class="stock-chart"><svg viewBox="0 0 900 300" preserveAspectRatio="none" data-part="chart"></svg></div>
          <div class="trade-col">
            <div class="owned-line" data-part="owned">No shares owned</div>
            <div class="qty-row">
              <button type="button" data-part="qtyMinus">−</button>
              <input type="number" data-part="qtyInput" value="1" min="1" step="1" aria-label="${inst.ticker} quantity"/>
              <button type="button" data-part="qtyPlus">+</button>
              <button type="button" data-part="qtyMax">MAX</button>
            </div>
            <div class="trade-buttons">
              <button class="buy-btn" data-part="buyBtn">BUY</button>
              <button class="sell-btn" data-part="sellBtn">SELL</button>
            </div>
            <div class="trade-msg" data-part="msg"></div>
          </div>
        </div>
      </div>`).join('');

    ref.stockGrid.querySelectorAll('.stock-card').forEach(card => {
      const id = card.dataset.id;
      const part = name => card.querySelector(`[data-part="${name}"]`);
      const c = { card, price: part('price'), chg: part('chg'), chart: part('chart'), owned: part('owned'), qtyInput: part('qtyInput'), buyBtn: part('buyBtn'), sellBtn: part('sellBtn'), msg: part('msg') };
      cardRefs[id] = c;
      part('qtyMinus').addEventListener('click', () => { c.qtyInput.value = Math.max(1, currentQty(id) - 1); });
      part('qtyPlus').addEventListener('click', () => { c.qtyInput.value = currentQty(id) + 1; });
      part('qtyMax').addEventListener('click', () => {
        const inst = marketInstrument(market, id);
        c.qtyInput.value = Math.max(1, Math.floor(account.cash / inst.price), account.holdings[id] || 0);
      });
      c.buyBtn.addEventListener('click', () => buy(id));
      c.sellBtn.addEventListener('click', () => sell(id));
    });
  }

  function updateStockCard(id) {
    const inst = marketInstrument(market, id), c = cardRefs[id];
    const chg = changePct(inst);
    c.price.textContent = '$' + inst.price.toFixed(2);
    c.chg.textContent = fmtPct(chg);
    c.chg.style.color = chg > 0 ? 'var(--green)' : chg < 0 ? 'var(--red)' : 'var(--muted)';
    renderChart(c.chart, inst.history, inst.trades);
    const owned = account.holdings[id] || 0;
    if (owned > 0) {
      const avg = (account.cost[id] || 0) / owned;
      const pl = round2(owned * inst.price - (account.cost[id] || 0));
      c.owned.innerHTML = `${owned} share${owned === 1 ? '' : 's'} · avg $${avg.toFixed(2)} · <span style="color:${pl >= 0 ? 'var(--green)' : 'var(--red)'}">${pl >= 0 ? '+' : ''}${money(pl)}</span>`;
    } else {
      c.owned.textContent = 'No shares owned';
    }
    c.buyBtn.disabled = !active;
    c.sellBtn.disabled = !active;
  }
  function updateAllCards() { market.stocks.forEach(inst => updateStockCard(inst.id)); }

  // ---------- portfolio / history ----------
  function renderPortfolio() {
    const total = portfolioValue();
    ref.cashVal.textContent = money(account.cash);
    ref.portfolioVal.textContent = money(total);
    ref.statStart.textContent = money(startValue);
    ref.statTotal.textContent = money(total);
    const gain = round2(total - startValue);
    ref.statGain.textContent = (gain >= 0 ? '+' : '') + money(gain);
    ref.statGain.style.color = gain >= 0 ? 'var(--green)' : 'var(--red)';
  }

  function renderHistoryFeed() {
    if (!tradeHistory.length) return;
    ref.historyList.innerHTML = tradeHistory.slice(0, MAX_HISTORY_FEED).map(tr => `
      <div class="history-card ${tr.type}">
        <span class="side">${tr.type.toUpperCase()}</span>
        <span class="what">${tr.qty} ${tr.ticker}</span>
        <span class="at">@ $${tr.price.toFixed(2)}</span>
      </div>`).join('');
  }

  function showTradeMsg(id, text, kind) {
    const c = cardRefs[id];
    c.msg.textContent = text;
    c.msg.className = 'trade-msg ' + (kind || '');
    clearTimeout(c.msgTimer);
    c.msgTimer = setTimeout(() => { c.msg.textContent = ''; }, 2600);
  }

  // ---------- trading ----------
  function currentQty(id) {
    const q = Math.floor(Number(cardRefs[id].qtyInput.value));
    return Number.isFinite(q) && q > 0 ? q : 1;
  }
  function lastSeq(inst) { return inst.history.length ? inst.history[inst.history.length - 1].seq : 0; }
  function logTrade(inst, type, qty, price) {
    inst.trades.push({ seq: lastSeq(inst), type, qty, price, t: Date.now() });
    tradeHistory.unshift({ ticker: inst.ticker, type, qty, price });
    if (tradeHistory.length > MAX_HISTORY_FEED) tradeHistory.length = MAX_HISTORY_FEED;
  }
  function afterTrade(id) { updateStockCard(id); renderPortfolio(); renderHistoryFeed(); o.onChange(account); }

  function buy(id) {
    if (!active) { showTradeMsg(id, 'Trading is locked. The session ended.', 'err'); return; }
    const inst = marketInstrument(market, id);
    const qty = currentQty(id);
    const cost = round2(qty * inst.price);
    if (cost > account.cash + 0.001) { showTradeMsg(id, 'Not enough cash for that.', 'err'); return; }
    account.cash = round2(account.cash - cost);
    account.holdings[id] = (account.holdings[id] || 0) + qty;
    account.cost[id] = round2((account.cost[id] || 0) + cost);
    logTrade(inst, 'buy', qty, inst.price);
    showTradeMsg(id, `Bought ${qty} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok');
    afterTrade(id);
  }

  function sell(id) {
    if (!active) { showTradeMsg(id, 'Trading is locked. The session ended.', 'err'); return; }
    const inst = marketInstrument(market, id);
    const qty = currentQty(id);
    const owned = account.holdings[id] || 0;
    if (qty > owned) { showTradeMsg(id, `You only own ${owned} share${owned === 1 ? '' : 's'}.`, 'err'); return; }
    account.cash = round2(account.cash + qty * inst.price);
    const remaining = owned - qty;
    if (remaining > 0) {
      account.holdings[id] = remaining;
      account.cost[id] = round2((account.cost[id] || 0) * remaining / owned);
    } else {
      delete account.holdings[id];
      delete account.cost[id];
    }
    logTrade(inst, 'sell', qty, inst.price);
    showTradeMsg(id, `Sold ${qty} ${inst.ticker} @ $${inst.price.toFixed(2)}`, 'ok');
    afterTrade(id);
  }

  // ---------- market clock ----------
  function renderLive() {
    updateAllCards();
    renderPortfolio();
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function tickTimer() {
    if (!active) return;
    const remain = endAt - Date.now();
    ref.timerVal.textContent = formatClock(remain);
    ref.timerMetric.classList.toggle('warn', remain <= Math.min(20000, durationMs / 4));
    if (remain <= 0) { end(); return; }
    rafId = requestAnimationFrame(tickTimer);
  }

  function stopClocks() {
    clearInterval(stepTimer);
    cancelAnimationFrame(rafId);
    stepTimer = null; rafId = null;
  }

  function start() {
    if (active) return;
    active = true;
    startValue = portfolioValue();
    endAt = Date.now() + durationMs;
    stepTimer = setInterval(() => {
      stepMarket(market);
      renderLive();
      if (marketFinished(market)) end();
    }, STEP_MS);
    renderLive();
    tickTimer();
  }

  function end() {
    if (!active) return;
    active = false;
    stopClocks();
    ref.timerVal.textContent = '00:00';
    ref.timerMetric.classList.remove('warn');
    ref.lockedBanner.style.display = 'block';
    renderLive();
    o.onEnd({ startValue, endValue: portfolioValue() });
  }

  function destroy() {
    active = false;
    stopClocks();
    Object.values(cardRefs).forEach(c => clearTimeout(c.msgTimer));
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

  buildStockGrid();
  startValue = portfolioValue();
  renderLive();

  return { start, end, destroy, addTopbarButton, portfolioValue, isActive: () => active };
}
