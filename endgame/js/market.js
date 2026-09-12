/* Market model shared by the trading sandbox (investing.html) and Nest Egg
   career mode. Plain object state, no DOM.

   Each company has an `anchor` (its "real" price, moved only by news and the
   yearly market move) plus a small cosmetic `drift` wiggle on top. A news
   event moves the anchor partly at once and the rest over REACTION_MS, so a
   player who reads the headline quickly can still trade on it. */
const MARKET_STEP_MS = 1500;
const MAX_HISTORY_POINTS = 800;          // ~20 minutes of steps
const REACTION_IMMEDIATE_SHARE = 0.35;   // share of an event's move that lands instantly
const REACTION_MS = 15000;               // the rest plays out over this long
const IDLE_JITTER_PCT = 0.3;             // cosmetic-only wiggle between news events
const IDLE_REVERT = 0.6;                 // share of the previous wiggle kept each step; <1 keeps it bounded
const PRICE_FLOOR = 0.5;
const YEARLY_MARKET = { meanReturn: 0.07, stdev: 0.16, sectorStdev: 0.06, companyStdev: 0.08 };

const roundPrice = n => Math.round(n * 100) / 100;
const averageOf = arr => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);

function createMarket(savedPrices) {
  const saved = savedPrices || {};
  const market = {
    seq: 0,
    companies: COMPANIES.map(c => {
      const p = Number(saved[c.id]) > 0 ? Number(saved[c.id]) : c.basePrice;
      return { ...c, price: p, anchor: p, drift: 0, reactions: [], history: [], trades: [], sessionStart: p };
    }),
    etfs: ETFS.map(e => ({ ...e, price: 0, history: [], trades: [], sessionStart: 0 })),
  };
  resetMarketHistory(market);
  return market;
}

function marketInstrument(market, id) {
  return market.companies.find(c => c.id === id) || market.etfs.find(e => e.id === id) || null;
}

function marketIndexPrice(market) {
  const idx = market.etfs.find(e => e.sector === 'market');
  return idx ? idx.price : 0;
}

function recomputeEtfs(market) {
  market.etfs.filter(e => e.sector !== 'market').forEach(etf => {
    etf.price = roundPrice(averageOf(market.companies.filter(c => c.sector === etf.sector).map(c => c.price)));
  });
  const idx = market.etfs.find(e => e.sector === 'market');
  if (idx) idx.price = roundPrice(averageOf(market.etfs.filter(e => e.sector !== 'market').map(e => e.price)));
}

// Every instrument gets a point with the same `seq`, so trade markers can find
// their point by seq even after old points are trimmed.
function recordMarketPoint(market) {
  market.seq++;
  [...market.companies, ...market.etfs].forEach(inst => {
    inst.history.push({ seq: market.seq, price: inst.price });
    if (inst.history.length > MAX_HISTORY_POINTS) inst.history.shift();
  });
}

// Fresh charts for a new session: clears history/markers and marks session-start prices.
function resetMarketHistory(market) {
  recomputeEtfs(market);
  [...market.companies, ...market.etfs].forEach(inst => { inst.history = []; inst.trades = []; inst.sessionStart = inst.price; });
  recordMarketPoint(market);
  recordMarketPoint(market);
}

function companyPrice(c) { return Math.max(PRICE_FLOOR, roundPrice(c.anchor * (1 + c.drift))); }

function applyMarketEvent(market, event) {
  const [lo, hi] = event.priceChangeRange;
  market.companies.filter(c => c.sector === event.sector).forEach(c => {
    const total = Math.max(-0.9, (lo + Math.random() * (hi - lo)) * (0.6 + c.volatility * 0.6) / 100);
    const now = total * REACTION_IMMEDIATE_SHARE;
    c.anchor = Math.max(PRICE_FLOOR, c.anchor * (1 + now));
    c.reactions.push({ logLeft: Math.log((1 + total) / (1 + now)), msLeft: REACTION_MS });
    c.price = companyPrice(c);
  });
  recomputeEtfs(market);
  recordMarketPoint(market);
}

function stepMarket(market, dtMs = MARKET_STEP_MS) {
  market.companies.forEach(c => {
    c.reactions = c.reactions.filter(r => {
      const share = Math.min(1, dtMs / r.msLeft);
      c.anchor *= Math.exp(r.logLeft * share);
      r.logLeft *= 1 - share;
      r.msLeft -= dtMs;
      return r.msLeft > 0;
    });
    c.anchor = Math.max(PRICE_FLOOR, c.anchor);
    c.drift = c.drift * IDLE_REVERT + (Math.random() - 0.5) * IDLE_JITTER_PCT * 2 / 100;
    c.price = companyPrice(c);
  });
  recomputeEtfs(market);
  recordMarketPoint(market);
}

// Lands every still-playing news reaction at once (used when a session ends).
function settleMarketReactions(market) {
  market.companies.forEach(c => {
    c.reactions.forEach(r => { c.anchor *= Math.exp(r.logLeft); });
    c.reactions = [];
    c.anchor = Math.max(PRICE_FLOOR, c.anchor);
    c.drift = 0;
    c.price = companyPrice(c);
  });
  recomputeEtfs(market);
}

function randomNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// The rest of the year, compressed into one move: a market-wide return,
// a per-sector shock, and per-company noise (bigger for volatile names).
// Returns the drawn market-wide return.
function applyYearlyMarketMove(market) {
  settleMarketReactions(market);
  const marketReturn = Math.max(-0.45, Math.min(0.5, YEARLY_MARKET.meanReturn + YEARLY_MARKET.stdev * randomNormal()));
  const sectorShock = {};
  SECTORS.forEach(s => { sectorShock[s.id] = YEARLY_MARKET.sectorStdev * randomNormal(); });
  market.companies.forEach(c => {
    const r = marketReturn * (0.5 + c.volatility * 0.5) + sectorShock[c.sector] + YEARLY_MARKET.companyStdev * c.volatility * randomNormal();
    c.anchor = Math.max(PRICE_FLOOR, c.anchor * Math.max(0.2, 1 + r));
    c.drift = 0;
    c.price = companyPrice(c);
  });
  resetMarketHistory(market);
  return marketReturn;
}

function marketPrices(market) {
  const out = {};
  market.companies.forEach(c => { out[c.id] = roundPrice(c.anchor); });
  return out;
}

function holdingsValue(market, holdings) {
  return roundPrice(Object.entries(holdings || {}).reduce((sum, [id, qty]) => {
    const inst = marketInstrument(market, id);
    return sum + (inst ? inst.price * qty : 0);
  }, 0));
}
