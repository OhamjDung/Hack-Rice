# Handoff: Nest Egg + Grapefruit Trading (`endgame/`)

Standalone game, isolated in `endgame/`. Plain HTML/CSS/JS — **no
build step, no framework, no bundler.** All scripts are non-module
`<script src>` tags sharing global scope (deliberate: keeps file://
double-click working, no CORS issues). Don't introduce ES modules,
npm, or a bundler here unless asked. Not wired into the Next.js app
in `src/` — don't do that unless the user asks.

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
career, starting at 22:

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
4. **Trade (optional)** — a 90-second session on the Grapefruit Trading
   floor using the brokerage account. Holdings persist across years.
5. **Year end** — the rest of the year's market move is applied; 401(k)
   and IRAs grow with the GRPX market index; interest; raise; age + 1.
   Includes a one-line lesson, and **Fast-forward 5 years** (reuses the
   last budget + plan, no trading).

**Retire** is allowed at the start of a year or at year end (forced at 70).
Payout: savings as-is; brokerage pays 15% on gains; 401(k)/Traditional
IRA taxed at a flat 15%; Roth tax-free. Before 60 (59½ rounded) retirement
accounts take a 10% penalty (Roth: on earnings only). The **leaderboard**
(top 10, localStorage) ranks the after-tax total kept.

**`investing.html` — trading sandbox.** The original mini-game: one
12-minute session, $10k starting cash, reward vs. personal record.

`index.html` is an earlier static dashboard mockup, unrelated.

## Files

| File | Purpose |
|---|---|
| `data/companies.js` | `COMPANIES` (20), `SECTORS` (5), `ETFS` (6). Plain data |
| `data/events.js` | `EVENTS` — 150 headlines with `priceChangeRange` + `weight`. Plain data |
| `data/life.js` | Nest Egg data: `CAREER` tuning, `JOBS`, `TAX`, `ACCOUNT_RULES`, `DEFAULT_EXPENSES`, `LIFE_EVENTS`. Plain data — balance here |
| `js/finance.js` | Pure money math: `taxesFor`, `contributionLimits`, `employerMatch`, `planAllocation`, `maxAllocation`, `retirementPayout` |
| `js/market.js` | Pure market model shared by both pages: `createMarket`, `applyMarketEvent`, `stepMarket`, `applyYearlyMarketMove`, `holdingsValue` |
| `js/career-engine.js` | Pure yearly loop: `newCareer`, `beginYear`, `payExpenses`, `investLeftover`, `finishYear`, `autoYear`, `retireCareer`, `addToLeaderboard`. Mutates a plain `career` object |
| `js/trading.js` | `createTradingFloor(root, opts)` — reusable trading UI (topbar, sidebar, portfolio, news, fullscreen chart + buy/sell) |
| `js/scheduler.js` | `EventScheduler` — weighted no-repeat news draw on a random interval |
| `js/chart.js` | `renderChart(svg, history, trades)` — SVG line + buy/sell markers (matched by history `seq`) |
| `js/career.js` | Nest Egg screens. Owns `career`/`market`, saves to localStorage, delegated `data-action` buttons |
| `js/app.js` | Sandbox page: session summary + personal record around a trading floor |
| `js/rewards.js` | Sandbox record (`endgame-investing-record-v1`) + `calcReward()` |
| `css/investing.css` | Tokens + trading floor styles (both pages) |
| `css/career.css` | Nest Egg screens |
| `tests/nestegg.test.mjs` | Loads the pure scripts into a `vm` context and tests taxes, limits, payout, news reaction, full years, fast-forward, leaderboard |

Script order: data → `chart`/`scheduler` → `market` → `finance` →
`trading` → `career-engine` → page script last (see each HTML file).

## How the market works

- Each company has an **anchor** (real price) plus a small cosmetic
  `drift` wiggle that decays each 1.5s step, so it can't accumulate.
- A news event moves the sector's anchors **35% immediately and the rest
  over 15 seconds** (`REACTION_*` in `market.js`), so reading headlines
  fast is a real edge. Session end lands any pending reaction.
- Between sessions (career mode), `applyYearlyMarketMove` applies a
  market return (~7% mean, 16% stdev) + sector shock + company noise.
- History points carry a shared `seq`; trades store `seq`, so chart
  markers survive history trimming (800 points).
- The sidebar is built once and updated in place (no mid-click rebuilds).

## Storage keys

- `endgame-nestegg-save-v1` — career in progress (cleared on retire)
- `endgame-nestegg-leaderboard-v1` — top 10 retirements
- `endgame-investing-record-v1` — sandbox personal record

## Debug hooks

- Career: `window.__nestEgg` → `{ career, market, floor, save, render }`
  e.g. `__nestEgg.floor.fireEvent(EVENTS[0])`, `__nestEgg.floor.end()`
- Sandbox: `window.__game` → `{ market, account, handleEvent, endSession, EVENTS, COMPANIES }`

## Verified

- `node --test endgame/tests/nestegg.test.mjs` — 11/11.
- Headless Chrome run (42 checks, no console errors): start → paycheck →
  expense minimum rejected → custom expense → invest (full match, Roth
  max, over-budget blocked) → trading floor (news, buy, reaction keeps
  moving price, marker, end early) → review → reload + continue →
  fast-forward → retire locked mid-year → retire with early penalty →
  leaderboard persists; sandbox session + Results button; no horizontal
  overflow at 400px.

## Known gaps / next ideas

- Tax model is intentionally simplified (single filer, no Roth income
  phase-out, flat retirement tax, no RMDs, no Social Security benefits).
- Balance numbers in `data/life.js` are first guesses — playtest.
- Retirement accounts only track the market index (no fund choice).
- No sell-down of brokerage holdings to cover a shortfall (goes to debt).
- Leaderboard is per-browser; a shared one needs a backend.
