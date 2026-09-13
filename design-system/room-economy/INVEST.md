# CashBound: the Invest tab

This is the design + technical spec for porting `endgame/`'s Nest Egg
(the 401(k)/IRA/Roth/brokerage allocation screen and real-stock trading
floor) into CashBound itself as a first-class "Invest" tab, replacing
the standalone-HTML version for anyone playing inside the room game.
Written before implementation, per the plan discussed with the user —
this is the reference to build against and to update if anything here
turns out to be wrong once building starts.

`endgame/` itself is untouched by this work and keeps working as a
standalone demo (its own `HANDOFF.md` still governs it).

## 1. What changes for the player

Today, `Game.tsx` always shows the room. This adds a second top-level
view:

- **Home** — the room, exactly as it is today. Default view.
- **Invest** — a new full-page (not modal) screen with the Nest Egg
  allocation UI, the 6-real-stock trading floor, and a growth
  projection. Reachable only when the gate below is satisfied.

Clicking **Invest** takes a snapshot of `game.metrics.cashBalance`
("Current balance" in the room's balance panel, the same number shown
there right now) as that visit's **available funds**. The player
splits it across 401(k), Traditional IRA, Roth IRA, and a brokerage
account they can actively trade — same math and screens Nest Egg
already has. Whatever they actually commit is **deducted from
`cashBalance` for real** (the same way a purchase is), using the same
"real cost after the tax break it creates" math `planAllocation`
already computes in `endgame/js/finance.js` — so a 401(k) contribution
costs less than its face value, exactly like today.

There is no year loop, no "Retire at age X" button, and no forced
retirement. The player can return to Invest as often as the gate
allows and add more, for as long as they keep playing CashBound. After
committing an allocation, instead of Nest Egg's year-end review, they
see a **projection**: if they kept contributing today's amounts on a
recurring schedule they choose, roughly where that money would be in
1/5/10/20/30 years. Only 401(k) + Traditional IRA + Roth IRA are
projected — the brokerage account is excluded from the compounding
line entirely and shown only as "$X in stocks today," since it has no
fixed assumed growth rate the way the others do.

## 2. The gate: when is "Invest" clickable

> "ONLY let them go to invest when they have kept up with their
> expenses transactions." — confirmed default for what that means per
> mode, since the two modes have no equivalent concept of a "day" being
> settled:

- **`nessie` mode**: gated on `bankTransactionsUpdatedToday(game)`
  (`src/engine/TransactionUpdates.ts`) — true once that day's real bank
  transactions have been pulled in via "Keep updated with
  transactions." This is a real, already-existing signal: it's exactly
  what turns the sync button itself grey once satisfied.
- **`demo` mode**: **no gate** — always clickable. Demo mode has no
  bank sync step to hook into at all (`bankTransactionsUpdatedToday`
  is hard-coded `false` whenever `mode !== 'nessie'`), so gating on it
  literally would make Invest permanently unreachable in the mode most
  people will actually try first.

The Invest tab button is disabled (not hidden) when gated, with a
short explanation on hover/focus: *"Update today's transactions first"*
in `nessie` mode. `game.isGameOver` also disables it, same as every
other action.

## 3. Data model: new persisted state

Nest Egg's balances currently live in `endgame/`'s own localStorage key,
independent of the room game. Once Invest is inside CashBound, those
balances need to live in `GameState` itself so they save/export/import
with everything else. This means a schema version bump.

```ts
// New top-level field on GameState, added at version 3.
investing: {
  accounts: {
    k401: number; tradIra: number; roth: number; rothBasis: number;
  };
  brokerage: {
    cash: number;
    holdings: Record<string, number>;   // ticker id -> shares
    cost: Record<string, number>;       // ticker id -> total cost basis
  };
  stats: { match: number; taxSaved: number; contributed: number; tradingPnl: number };
  lastAlloc: { k401: number; tradIra: number; roth: number; brokerage: number }; // prefills the next visit's form
  today: {
    turn: number;                       // which game day `todayAlloc` belongs to
    alloc: { k401: number; tradIra: number; roth: number; brokerage: number };
  } | null;                             // feeds the projection screen; cleared when a new game day starts
}
```

`stateSchema`'s preprocessor migration (the same pattern already used
for the `version: 1 -> 2` save-format bump in `Types.ts`) gets a
`2 -> 3` step: old saves get `investing` defaulted to all-zero
accounts, empty brokerage, no `today`. Brokerage `holdings`/`cost`
should be empty whenever there's no open trading session, same
invariant `endgame/`'s career mode already relies on (see its
`HANDOFF.md`) — a session's leftover position is sold to cash the
moment it ends, so nothing here needs to track a live market between
visits.

**Contribution limits, per game-month instead of per year.** Nest
Egg's 401(k)/IRA limits (`ACCOUNT_RULES` in `endgame/data/life.js`) are
annual, which assumed a year-long round. CashBound has no calendar
year concept — only a 30-day game month
(`DAYS_PER_MONTH`/`monthOfRun` in `DailyReview.ts`). **Recommended
default:** track contributions against the limit **per game month**
(reset when `monthOfRun(turn)` changes), i.e. treat a game month as
the "year" for limit-tracking purposes. This is a genuine simplification
of what the limits mean and is worth flagging to the user again once
something's on screen to look at, but it keeps the feature from
needing an entirely new time unit.

## 4. Where the logic comes from

Nothing here is new math — it's a straight port of what's already
working in `endgame/`, from plain JS to TypeScript, following
`RulesEngine.ts`'s existing conventions (pure functions,
`structuredClone`, no in-place mutation):

| New file | Ported from | Contents |
|---|---|---|
| `src/engine/Investing.ts` | `endgame/js/finance.js` | `taxesFor`, `contributionLimits`, `employerMatch`, `planAllocation`, `maxAllocation`. Tax table constants (`TAX`, `ACCOUNT_RULES`) move to `src/engine/Constants.ts` alongside `CATEGORY_META`. |
| `src/engine/Market.ts` | `endgame/js/market.js` | `createMarket`, `stepMarket`, `sessionDurationMs`, `marketFinished`, `holdingsValue`. `drawYearlyMarketReturn` is **not** ported — see §6, retirement accounts get a different growth model here. |
| `src/data/realStocks.ts` | `endgame/data/real-stocks.js` | Same `REAL_STOCKS` pool, typed. Refresh instructions stay as documented in `endgame/HANDOFF.md` (Yahoo Finance's public chart endpoint) — regenerate both copies together when refreshing. |

No dependency on `endgame/`'s files at runtime — this is a genuine
port, not an import, so `endgame/` keeps working standalone and
un-networked exactly as today.

## 5. Retirement account growth (no year loop to hook it to)

Nest Egg grew 401(k)/IRA/Roth balances once per *year* via
`drawYearlyMarketReturn()`. CashBound has no year boundary. **Proposed
model:** grow those three balances once per **game month**, at the
same point `advanceTurn` already settles everything else for the
month (`RulesEngine.ts`, the `(turn - 1) % DAYS_PER_MONTH !== 0`
branch) — same random draw (~7% mean, realistic spread), just applied
monthly instead of yearly, prorated for a ~1/12th-of-a-year period so
the actual expected growth rate stays sane
(`(1+annualReturn)^(1/12) - 1` for that month's draw, not the full
annual figure). This is the natural existing seam — jars already roll
over there, so retirement accounts compounding alongside them keeps
all of "what happens when a month ends" in one place.

## 6. The projection screen

Triggered right after committing an allocation (replaces Nest Egg's
year-end review entirely — no "Retire at X" / "Start year N+1"
buttons anywhere in this integration).

**Inputs:**
- `today.alloc` — what was actually contributed to each of
  401(k)/Traditional IRA/Roth IRA *today* (brokerage excluded, per the
  user's direction).
- A frequency the player picks on this screen: **weekly (52/yr),
  biweekly (26/yr), semi-monthly (24/yr), or monthly (12/yr)** — a
  live selector, not a saved profile setting; changing it instantly
  recalculates the chart. Default to biweekly.
- Current balance of each of the three accounts (so the chart
  reflects money already in there, not just future contributions).

**Formula**, applied per account then summed, for each shown
horizon `t` in {1, 5, 10, 20, 30} years:

```
periodsPerYear = { weekly: 52, biweekly: 26, semiMonthly: 24, monthly: 12 }[frequency]
r = (1 + 0.07) ** (1 / periodsPerYear) - 1        // periodic rate from the same 7% assumption Nest Egg uses
n = t * periodsPerYear                             // total periods by year t
growthOfCurrentBalance = currentBalance * (1 + 0.07) ** t
growthOfContributions   = contributionPerPeriod * (((1 + r) ** n - 1) / r)   // future value of an ordinary annuity
projected(t) = growthOfCurrentBalance + growthOfContributions
```

401(k) contributions in this projection **include the recurring
employer match** on the same terms as today (`employerMatch` in
`finance.js`: 50% up to 6% of salary) — `profile.income` (monthly)
converts to a per-period salary figure at whatever frequency is
selected. This is a real, already-built piece of the math; skipping it
would understate the number for no real reason.

This is a **deterministic estimate** (average-return compounding), not
a Monte Carlo simulation — intentionally different from Nest Egg's
`drawYearlyMarketReturn`, which is a randomized *outcome* generator
appropriate for "what actually happened this round." A forward-looking
"if you keep this up" chart should show the expected trend line, not
one random draw. Label it clearly as an estimate based on a 7%/year
average, not a guarantee — same spirit as the disclaimer language
already used elsewhere in CashBound's forecast copy
(`GameOverModal.tsx`, `DailyReview.ts`).

Brokerage: shown as a separate, non-projected line — *"$X in stocks
today"* — with a one-line note that it isn't included in the growth
chart because trading results aren't a fixed rate the way the
retirement accounts are.

## 7. Visual design: what to match, deep-dive findings

Studied before writing any of this, per the user's instruction. Full
findings for reference:

**Two coexisting visual languages already exist in this codebase**,
and Invest belongs with the second one:

1. **The room itself** ("Home") — dark, immersive, `src/app/game.css`.
   `#27322d` background, `#344238` panels, `#edf2e7` text. This is
   deliberately atmospheric, not a "screen full of numbers."
2. **Every dialog that's about numbers or decisions** — budget setup,
   journal, settings, game-over, the shop — uses a separate light
   theme from `src/app/globals.css`: `--bg:#f7f8f4`, `--card:#fff`,
   `--ink:#303a32`, `--green:#647950`, `--line:#e6e9e1`,
   `--danger:#a44737`, `--muted:#65705b`, radius `12px`. Modal titles
   (`.modal-heading h2`) render in **Georgia serif, 25px, weight 400**;
   everything else — labels, numbers, buttons — is system sans
   (Arial/Helvetica).

**Invest is a numbers-and-decisions screen, so it uses palette #2**,
full-page rather than in a `<dialog>`, but the same visual language —
not a third theme, and not the room's dark palette. This also happens
to already match the light palette `endgame/`'s Nest Egg was re-themed
to a few iterations ago, so the port should read as a translation, not
a redesign.

**Confirmed-dead CSS to ignore** (checked actual usage across every
`.tsx` file — zero references): `.sidebar`, `.app-shell`, `.topbar`,
`.nav-item`, `.page-heading`, `.page-footer`, `.jars-list`,
`.budget-panel`, `.room-heading`, `.milestone`, `.turn-bar`,
`.week-dots`, `.object-toolbar`, `.demo-controls`, `.audit-result`,
`.inspect-total`. `design-system/room-economy/MASTER.md` already notes
this composition was superseded; this confirms it at the code level.

**Reusable primitives to build Invest's screens from**, all
confirmed live in current components:

| Class | Where it's used today | Use it for |
|---|---|---|
| `.button` / `.primary` / `.secondary` | everywhere | every button on the Invest screens |
| `.modal-heading h2` (Georgia 25px) | every dialog title | section headings within Invest |
| `.stat` / `.stat-icon` | (status-grid pattern) | account balance tiles (401k/IRA/Roth/brokerage at a glance) |
| `.inspect-total` / `.inspect-breakdown` | `InspectModal.tsx` | "Available funds" big number + what it's made of |
| `.notice` | `AuthModal.tsx` etc. | the "this is an estimate" / "real data, no predictions" disclaimers |
| `.form-grid`, bare `input`, `.color-fields` | `OnboardingModal.tsx` | allocation amount inputs |
| `.modal-actions`, `.full-width`, `.settings-actions` | throughout | action rows, primary CTAs |

Icons: reuse `lucide-react` choices already established in-app —
`Wallet` (balance), `PiggyBank` (savings/retirement), `Landmark`
(bank/institution, already used for "Connect my transactions"),
`TrendingUp` (new, for the projection/growth screen — not yet used
elsewhere in the app, safe to introduce).

## 8. New component plan

```
src/components/features/
  InvestScreen.tsx        top-level container: gate check, tab chrome, routes the 3 sub-screens
  AllocationPanel.tsx      "available funds" + 4-way split form (401k/IRA/Roth/brokerage)
  TradingFloor.tsx         React port of endgame's 6-card real-stock grid (chart + buy/sell inline)
  ProjectionPanel.tsx      frequency selector + horizon chart/table, brokerage called out separately
src/components/canvas/
  StockChart.tsx           React port of endgame/js/chart.js (small SVG line + trade markers)
```

`Game.tsx` gets a `view: 'home' | 'invest'` piece of state, two tab
buttons in `.game-hud` next to the existing profile/menu buttons, and
renders `<RoomCanvas>` or `<InvestScreen>` based on it. `RoomCanvas`'s
`paused` prop (already used while a dialog is open) applies whenever
`view !== 'home'` too, so the room's animation/physics don't run
underneath an inactive tab.

## 9. Explicitly out of scope for this pass

- **No cash-out/"retire" mechanic.** Money that goes into
  401(k)/IRA/Roth/brokerage stays there and contributes to net worth,
  but there's no flow to convert it back into spendable `cashBalance`
  within CashBound. (Nest Egg's `retirementPayout`/`retireCareer` are
  not ported.) A future pass could add this; out of scope here.
- **No age input anywhere** — the projection is phrased in years from
  now, not "until age 65," specifically so this isn't needed.
- **No new onboarding fields.** Pay frequency is a per-visit selector
  on the projection screen, not a saved profile setting.

## 10. Open items to confirm once something's on screen

- Contribution limits tracked **per game month** (§3) is a real
  simplification of what "annual limit" means — flag it again once
  there's a build to look at, in case monthly turns out to feel too
  strict or too loose in practice.
- Retirement-account growth **monthly instead of yearly** (§5) changes
  the effective volatility players will see compared to Nest Egg's
  once-a-year draws — worth a playtest pass once it's running.
