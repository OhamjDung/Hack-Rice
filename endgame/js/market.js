/* Market model shared by the trading floor (investing.html) and Nest Egg
   career mode's brokerage account. Plain object state, no DOM.

   Each session deals 6 stocks at random from REAL_STOCKS (data/real-stocks.js)
   and replays their real recorded 1-minute prices. Every STEP_MS of real time,
   each stock advances BARS_PER_STEP real stock-minutes at once, averaged into
   a single displayed price — so the screen updates once a second instead of
   flickering on every raw minute bar, while the overall pace (1 real second =
   5 stock-minutes) and total session length are unchanged. A full 780-bar
   (~2 real trading day) session plays out in SESSION_DURATION_MS = 156 real
   seconds. There is no synthetic news layer here on purpose — prices move
   exactly the way they actually did; nothing hints at which way a price is
   about to go. */
const STEP_MS = 1000;
const BARS_PER_STEP = 5;
const STOCKS_PER_SESSION = 6;

const roundPrice = n => Math.round(n * 100) / 100;
const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

// Picks STOCKS_PER_SESSION distinct tickers at random from the pool.
function dealStocks() {
  const pool = [...REAL_STOCKS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, STOCKS_PER_SESSION);
}

function createMarket() {
  const stocks = dealStocks().map(s => ({
    id: s.id, ticker: s.ticker, name: s.name, prices: s.prices,
    cursor: 0, price: s.prices[0], sessionStart: s.prices[0], // cursor = next raw minute-bar to consume
    history: [{ seq: 0, price: s.prices[0] }], trades: [],
  }));
  return { seq: 0, stocks, barCount: Math.min(...stocks.map(s => s.prices.length)) };
}

function marketInstrument(market, id) { return market.stocks.find(s => s.id === id) || null; }

// Total real time this session will run for, given how much real history each dealt stock has.
function sessionDurationMs(market) { return Math.ceil(market.barCount / BARS_PER_STEP) * STEP_MS; }

function marketFinished(market) { return market.stocks.every(s => s.cursor >= s.prices.length); }

// Advances every stock by one averaged step (BARS_PER_STEP real recorded
// minutes at a time). Once a stock's history runs out it just holds its
// last averaged price for the remainder of the session.
function stepMarket(market) {
  market.seq++;
  market.stocks.forEach(s => {
    const group = s.prices.slice(s.cursor, s.cursor + BARS_PER_STEP);
    if (group.length) {
      s.price = roundPrice(average(group));
      s.cursor += group.length;
    }
    s.history.push({ seq: market.seq, price: s.price });
  });
}

function holdingsValue(market, holdings) {
  return roundPrice(Object.entries(holdings || {}).reduce((sum, [id, qty]) => {
    const inst = market && marketInstrument(market, id);
    return sum + (inst ? inst.price * qty : 0);
  }, 0));
}

/* --- Abstract yearly market return for Nest Egg's retirement accounts ---
   401(k)/Traditional IRA/Roth IRA balances aren't hand-traded, so they don't
   use the real-data replay above; they grow once a year off a simple random
   draw (mean 7%, realistic spread) the same way a broad index fund would. */
const YEARLY_MARKET = { meanReturn: 0.07, stdev: 0.16 };

function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function drawYearlyMarketReturn() {
  return Math.max(-0.45, Math.min(0.5, YEARLY_MARKET.meanReturn + YEARLY_MARKET.stdev * randomNormal()));
}
