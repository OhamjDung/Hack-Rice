# Handoff: RoomEconomy Investing Mini-Game (`endgame/`)

Standalone mockup, isolated in `endgame/`. Plain HTML/CSS/JS — **no
build step, no framework, no bundler.** All scripts are non-module
`<script src>` tags sharing global scope (deliberate: keeps file://
double-click working, no CORS issues). Don't introduce ES modules,
npm, or a bundler here unless asked.

## Run it

```
cd endgame
python -m http.server 8000
```
Visit `http://localhost:8000/investing.html`. (Double-clicking the
file directly also works since there's no module/fetch dependency.)

`index.html` is a separate, earlier dashboard mockup (static, no
game logic) — not part of the investing feature. Ignore unless asked
to touch it.

## What exists

**Feature**: news-driven sector event system for an investing
mini-game. 5 sectors × 4 fictional companies each + 6 ETFs (5 sector
composites + 1 broad market index). Random breaking-news events move
sector stock prices. 12-minute session timer locks trading at zero
and shows a results/reward screen scored against a persisted
personal record.

### Files

| File | Purpose |
|---|---|
| `investing.html` | Page shell — sidebar (stock/ETF picker) + browse view (portfolio, news feed) + fullscreen trade overlay + summary modal |
| `css/investing.css` | All styling. Dark theme, tokens at top of file |
| `data/companies.js` | `COMPANIES` (20), `SECTORS` (5), `ETFS` (6) — plain data, edit freely |
| `data/events.js` | `EVENTS` — 150 headlines, 30/sector, tiered minor/moderate/major/crisis with `priceChangeRange` + `weight`. Plain data, edit freely |
| `js/scheduler.js` | `EventScheduler` class — weighted no-repeat draw, fires on random 8–20s interval |
| `js/rewards.js` | `loadRecord`/`saveRecord` (localStorage `endgame-investing-record-v1`), `calcReward()` — diminishing-returns formula vs personal best |
| `js/chart.js` | `renderChart(svg, history, trades)` — SVG line + buy/sell triangle markers |
| `js/app.js` | Everything else: state, rendering, event application, buy/sell, session timer, summary. Single IIFE, all consts at top |

Load order in `investing.html`: `companies.js` → `events.js` →
`rewards.js` → `chart.js` → `scheduler.js` → `app.js`. Keep that
order if adding scripts (data before logic, `app.js` last).

### How it works (read `js/app.js` top-to-bottom, it's one file)

- `state` object holds live clones of companies/ETFs (each with
  `price`, `history[]`, `trades[]`), `cash`, `holdings`, session
  status. Nothing is React — direct DOM writes via `innerHTML` and
  small render functions (`renderSidebar`, `renderPortfolio`,
  `renderDetail`, etc.), called after every mutation.
- `EventScheduler` (from `scheduler.js`) fires a random `EVENTS`
  entry every 8–20s → `handleEvent()` → `applyEventToSector()` moves
  every company in that sector by `priceChangeRange` scaled by each
  company's `volatility`, then recomputes that sector's ETF and the
  market ETF.
- A separate `idleTick()` (every 2.5s) adds a **tiny** (±0.3%)
  cosmetic jitter to all companies so charts don't sit dead flat
  between events — clearly commented in code as cosmetic-only, not a
  competing mechanic.
- Clicking a sidebar row opens `.detail-overlay` (real fullscreen via
  CSS `position:fixed;inset:0`, not the Fullscreen API) with a big
  chart + buy/sell panel. Buy/sell push into that instrument's
  `trades[]`; `chart.js` draws a green/red triangle at the trade's
  history index.
- Session: `SESSION_DURATION_MINUTES` const (currently 12) → 
  countdown via `requestAnimationFrame`. At zero: `endSession()`
  stops the scheduler/idle timer, locks buy/sell buttons, shows
  `showSummary()` — computes gain vs `STARTING_CASH`, calls
  `calcReward()`, persists new record if beaten.
- `window.__game` exposes `{state, handleEvent, endSession, EVENTS,
  COMPANIES}` in the console — useful for manually firing an event or
  ending the session without waiting, for testing.

### Verified working (headless Chromium smoke test, no console errors)

Open → view chart → buy → sell (markers appear on chart) → manually
fire event (sector price + ETF + market ETF move, ticker banner +
news feed update) → exit fullscreen → open an ETF → force session
end → summary modal with reward + new-record badge.

## Known gaps / things a fresh AI should know before changing this

- **No idle price movement is "real"** — only news events and the
  cosmetic jitter move prices. If asked for more organic-feeling
  price action, that's an intentional gap, not a bug.
- **Reward formula constants are untuned guesses** (`baseReward:100,
  scalingFactor:1.6, cap:3, floor:0.2, recordBonus:0.5` in
  `rewards.js`). Balance later against actual playtesting.
- **No sound/animation polish** beyond the CSS transitions already
  there (price flash, ticker banner background flash).
- **No integration with the main Next.js app** (`src/` at repo
  root) — this is a standalone mockup per explicit instruction
  ("work in endgame folder only"). Don't wire it into `src/` unless
  the user asks.
- **`index.html` vs `investing.html`** are unrelated pages sharing
  only the dark-theme visual language; no shared state or nav logic
  besides a plain `<a href>` back-link.
- Company/event data is meant to be **hand-edited directly** in the
  `data/*.js` files — there's no generator script, no build step to
  rerun after editing.
