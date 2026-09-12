/* Market model shared by the trading floor (investing.html) and Nest Egg
   career mode's brokerage account. Plain object state, no DOM.

   Each session deals 6 stocks at random from REAL_STOCKS (data/real-stocks.js)
   and replays their real recorded 1-minute prices on a fast clock: one real
   REAL_TICK_MS advances one real stock-minute. At the default 200ms/tick,
   that's 1 real second = 5 stock-minutes, so a full 780-bar (~2 real trading
   day) session plays out in SESSION_DURATION_MS = 156 real seconds. There is
   no synthetic news layer here on purpose — prices move exactly the way they
   actually did; nothing hints at which way a price is about to go. */
const REAL_TICK_MS = 200;
const STOCKS_PER_SESSION = 6;

const roundPrice = n => Math.round(n * 100) / 100;

// Picks STOCKS_PER_SESSION distinct tickers at random from the pool.
function dealStocks() {
  const pool = [...REAL_STOCKS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, STOCKS_PER_SESSION);
}

function createMarket() {
  const stocks = dealStocks().map(s => ({
    id: s.id, ticker: s.ticker, name: s.name, prices: s.prices,
    idx: 0, price: s.prices[0], sessionStart: s.prices[0],
    history: [{ seq: 0, price: s.prices[0] }], trades: [],
  }));
  return { seq: 0, stocks, barCount: Math.min(...stocks.map(s => s.prices.length)) };
}

function marketInstrument(market, id) { return market.stocks.find(s => s.id === id) || null; }

// Total real time this session will run for, given how much real history each dealt stock has.
function sessionDurationMs(market) { return market.barCount * REAL_TICK_MS; }

function marketFinished(market) { return market.stocks.every(s => s.idx >= s.prices.length - 1); }

// Advances every stock one real recorded minute. Once a stock's history runs
// out it just holds its last real price for the remainder of the session.
function stepMarket(market) {
  market.seq++;
  market.stocks.forEach(s => {
    if (s.idx < s.prices.length - 1) s.idx++;
    s.price = roundPrice(s.prices[s.idx]);
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
