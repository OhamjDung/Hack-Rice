# Handoff: Nest Egg + Grapefruit Trading (`endgame/`)

Standalone game, isolated in `endgame/`. Plain HTML/CSS/JS — **no
build step, no framework, no bundler.** All scripts are non-module
`<script src>` tags sharing global scope (deliberate: keeps file://
double-click working, no CORS issues). Don't introduce ES modules,
npm, or a bundler here unless asked. Not wired into the Next.js app
in `src/` — don't do that unless the user asks.

Visual style matches the main room game (`src/`): light cream
background, sage green, warm ink text (`css/investing.css`'s `:root`
tokens mirror `src/app/globals.css`). It used to be a dark neon
theme — if you see any leftover dark hex colors, that's a bug.

## Run it

Double-click `career.html` (or `investing.html`), or:

```
cd endgame
python -m http.server 8000
```
Then open `http://localhost:8000/career.html`.

Engine tests (Node 22, no install): `node --test endgame/tests/nestegg.test.mjs`

## The two pages

**`career.html` — Nest Egg (the main game).** One round = one year of a
career, starting at 22, **played by hand — there is no fast-forward or
skip-ahead anywhere in the game.**

1. **Paycheck** — pick a job at the start; salary minus simplified 2026
   federal brackets, flat 4% state tax, and FICA = take-home. A random
   life event may hit (car repair, bonus, promotion…).
2. **Expenses** — player writes monthly expenses (essentials have
   inflation-adjusted minimums; custom lines can be added/removed).
   A shortfall comes out of savings → brokerage cash → credit card (22% APR).
3. **Invest** — leftover + existing savings can go into 401(k) (pre-tax,
   50% employer match up to 6% of salary), Traditional IRA (pre-tax),
   Roth IRA (after-tax), or a brokerage account. Pre-tax contributions
   show the income tax they remove, so they cost less than they add.
   2026 limits ($24,500 / $7,500 shared IRA, catch-up at 50) inflate yearly.
   Uninvested money pays debt first, then stays in savings (3.5% APY).
4. **Trade (optional)** — a real-data trading session on the Grapefruit
   Trading floor using the brokerage account (see "How the trading floor
   works" below). Whatever's still held when the session ends is
   automatically sold at its last price and folded into cash — brokerage
   holdings never carry between years, only the cash does, because each
   session deals a completely different random 6 stocks.
5. **Year end** — retirement accounts (401k/Traditional IRA/Roth) grow
   off a random yearly market return (~7% average, realistic spread —
   see `drawYearlyMarketReturn()` in `market.js`); interest; raise;
   age + 1. Includes a one-line lesson tailored to what happened.

**Retire** is allowed at the start of a year or at year end (forced at 70).
Payout: savings as-is; brokerage pays 15% on gains; 401(k)/Traditional
IRA taxed at a flat 15%; Roth tax-free. Before 60 (59½ rounded) retirement
accounts take a 10% penalty (Roth: on earnings only). The **leaderboard**
(top 10, localStorage) ranks the after-tax total kept.

**`investing.html` — standalone trading floor.** Just the Grapefruit
Trading floor on its own, with a fixed $10k starting cash and a session
summary scored against a persisted personal record.

`index.html` is an earlier static dashboard mockup, unrelated.

## How the trading floor works (`market.js` + `js/trading.js`)

This used to be a synthetic 26-stock/6-ETF/news-headline simulation.
**It is now real historical data, deliberately simplified for newbies:**

- Every session deals **6 stocks at random** from a pool of ~28 real
  companies in `data/real-stocks.js` (Apple, Tesla, JPMorgan, etc.) — no
  sectors, no ETFs, no news feed, no headlines, no direction hints of any
  kind. The colored `+2.3% / -1.1%` change numbers are the only signal,
  same as any real ticker — that's what the playtester feedback asked for.
- Each stock's `prices` array is ~2 real trading days of **actual 1-minute
  closing prices**, fetched once from Yahoo Finance's public chart
  endpoint and frozen into the data file (see "Refreshing the real
  price data" below). The game never calls out to the network.
- Playback: **1 real second = 5 stock-minutes** (`REAL_TICK_MS = 200`ms
  per bar in `market.js`). A full 780-bar session takes exactly 156
  real seconds (~2:36) — `sessionDurationMs()` derives this from the
  data itself, so both pages' sessions are this length automatically.
  Once a stock's history runs out it just holds its last real price.
- There is no synthetic event layer of any kind now — prices move
  exactly the way they actually did. Nothing on the page predicts
  which way a price is about to go.
- The always-visible **Trade History** panel (next to the portfolio,
  on the main browse screen — not just inside the fullscreen chart
  view) logs every trade made this session across all 6 stocks, so
  players can track what they've done without hunting through each
  stock's small in-overlay log.
- Chart line/marker colors (`chart.js`) are CSS custom properties
  (`var(--green)`, `var(--red)`, `var(--border)`, `var(--bg)`), not
  hardcoded hex — they follow whatever theme is loaded.

### Refreshing the real price data

`data/real-stocks.js` is hand-frozen, like the other data files — there's
no build step to rerun automatically. To pull fresh data, hit Yahoo
Finance's public chart endpoint per ticker and take the last ~780
non-null closes:

```
curl "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1m&range=5d&includePrePost=false" -H "User-Agent: Mozilla/5.0"
```
`chart.result[0].timestamp` / `.indicators.quote[0].close` are parallel
arrays; `meta.longName` is the company name. Write the result as
`{ id, ticker, name, prices }` objects into a `REAL_STOCKS` array, same
shape as the existing entries. This is an unauthenticated public
endpoint (no API key), used only at data-prep time, never during play.

## Files

| File | Purpose |
|---|---|
| `data/real-stocks.js` | `REAL_STOCKS` — ~28 real tickers, each with ~780 real 1-minute closing prices. Hand-frozen, see refresh instructions above |
| `data/life.js` | Nest Egg data: `CAREER` tuning, `JOBS`, `TAX`, `ACCOUNT_RULES`, `DEFAULT_EXPENSES`, `LIFE_EVENTS`. Plain data — balance here |
| `js/finance.js` | Pure money math: `taxesFor`, `contributionLimits`, `employerMatch`, `planAllocation`, `maxAllocation`, `retirementPayout` |
| `js/market.js` | Real-data trading engine: `createMarket` (deals 6 random real stocks), `stepMarket`, `sessionDurationMs`, `marketFinished`, `holdingsValue`, plus the unrelated `drawYearlyMarketReturn()` used only for retirement-account growth |
| `js/career-engine.js` | Pure yearly loop: `newCareer`, `beginYear`, `payExpenses`, `investLeftover`, `recordTradingSession`, `finishYear`, `retireCareer`, `addToLeaderboard`. Mutates a plain `career` object. No fast-forward/skip function exists anywhere in this file |
| `js/trading.js` | `createTradingFloor(root, opts)` — reusable trading UI (topbar, 6-stock sidebar, portfolio, trade history, fullscreen chart + buy/sell) |
| `js/chart.js` | `renderChart(svg, history, trades)` — SVG line + buy/sell markers (matched by history `seq`), colored via CSS vars |
| `js/career.js` | Nest Egg screens. Owns `career`/`market`/`floor`, saves to localStorage, delegated `data-action` buttons |
| `js/app.js` | Standalone floor page: session summary + personal record around a trading floor |
| `js/rewards.js` | Personal record (`endgame-investing-record-v1`) + `calcReward()` |
| `css/investing.css` | Palette tokens (matches the room game) + trading floor styles (both pages) |
| `css/career.css` | Nest Egg screens |
| `tests/nestegg.test.mjs` | Loads the pure scripts into a `vm` context and tests taxes, limits, payout, the real-data replay, a full year, essential minimums, a whole career to retirement (played year by year), and the leaderboard |

Script order: data → `chart` → `market` → `finance` → `trading` →
`career-engine` → page script last (see each HTML file).

## Storage keys

- `endgame-nestegg-save-v1` — career in progress (`version: 2`; cleared on retire). Old saves from before the trading-floor rework won't load — that's intentional, the account shape changed
- `endgame-nestegg-leaderboard-v1` — top 10 retirements
- `endgame-investing-record-v1` — standalone-floor personal record

## Debug hooks

- Career: `window.__nestEgg` → `{ career, market, floor, save, render }`
  (`market` is `null` except while a trading session is actively open)
- Standalone floor: `window.__game` → `{ market, account, endSession }`

## Verified

- `node --test endgame/tests/nestegg.test.mjs` — 16/16.
- Headless Chrome run (24 checks, no console errors): standalone floor
  shows exactly 6 real stocks with no news/sector markup, colored %
  change intact, countdown ticking off real data, buy/sell, real price
  replay confirmed to actually move tick-by-tick, trade history panel,
  session end + Results button, no mobile overflow; career mode reaches
  the trade phase with no sector/ETF/GRPX language, opens the floor,
  trades, ends the session and confirms the position was liquidated to
  cash (not carried over), year-end review has no fast-forward button
  anywhere, reload + continue works with the new save schema, no mobile
  overflow.

## Known gaps / next ideas

- Tax model is intentionally simplified (single filer, no Roth income
  phase-out, flat retirement tax, no RMDs, no Social Security benefits).
- Balance numbers in `data/life.js` are first guesses — playtest.
- Retirement accounts only track an abstract market return (no fund
  choice, no connection to the real stock data used for trading).
- No sell-down of brokerage holdings to cover a shortfall (goes to debt).
- Leaderboard is per-browser; a shared one needs a backend.
- There's currently no mechanical incentive to retire *early* — every
  extra year worked (almost) only adds net worth, so the rational play
  is to always work until 70. Discussed with the user; one option on
  the table is a second leaderboard ranked by retirement age among runs
  that cleared some money threshold, so "retire young" has its own
  bragging rights without changing the core money math.
- No connection yet to the main `src/` room game — discussed with the
  user (loose one-time cash handoff vs. tight per-month integration),
  not yet decided.
