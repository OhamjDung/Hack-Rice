# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## RoomEconomy

A financial life simulation game (Next.js 16 / React 19 App Router). The room is the play space: budgets, transactions, and settings are optional dialogs layered over a persistent isometric apartment view. See `README.md` for full gameplay rules (day loop, missions, Nessie sync, endings) — don't duplicate that here.

### Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm test` — runs `tests/*.test.ts` via `node --experimental-strip-types --test` (no build step; run a single file with `node --experimental-strip-types --test tests/engine.test.ts`)
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — production build; also validates compilation
- `npm run test:browser` — `scripts/browser-smoke.mjs`; drives installed Windows Chrome via CDP against a **running dev server**, mocks Gemini/Nessie responses, and checks review timing, coin progression, dedup, persistence, mobile layout, and endings. Reports/screenshots land in `artifacts/`.
- `npm test`, `npm run typecheck`, and `npm run build` together are the standard verification pass before calling work done.

### Architecture

**Pure engine, dumb UI.** All game rules live in `src/engine/*.ts` as pure functions operating on an immutable `GameState` (each mutator `structuredClone`s and returns a new state; no state is mutated in place). React components only call these functions and re-render.

- `Types.ts` — `GameState` and all zod schemas (`stateSchema` is the single source of truth, including a `version: 1 -> 2` migration preprocessor for old saves). `CategoryKey` = `food | housing | transit | leisure | utilities | savings`.
- `RulesEngine.ts` — the core reducers: `createGame`, `applyTransactions` (spending/income effects on health/energy/stress/clutter, bankruptcy check), `advanceTurn` (one day; settles a 30-day month on day rollover: health/happiness/housing-deficit checks, jar rollover, demo paycheck), `careForHome` (rest/tidy, once per day each).
- `Life.ts` — non-financial room/character state (`foodStock`, `energy`, `stress`, `clutter`, `powerOn`) and flavor text (`roomConditions` warnings, `transactionScene` for character animation).
- `Progression.ts` — coins, missions (`MISSIONS`), furniture shop (`SHOP`), dialogue log, ending lifecycle (`beginEnding`/`finishEnding`). Missions only complete from **verified Nessie transactions** (`verifiedPurpose` matches gym/health by description regex); manual demo transactions can't complete them.
- `DailyReview.ts` — day-close review pipeline: `spendingForecast` (deterministic pace-based projection with threats/runout), `localDailyReview` (fallback analysis when Gemini is off/fails), `applyDailyReview` (merges a review into state — this is the only place an ending gets triggered from a forecast, gated by `failureConfidence >= .9` and `riskRating === 'CRITICAL'`).

**AI is advisory only, never authoritative.** `src/lib/geminiClient.ts` always computes `localDailyReview` first as a deterministic floor, then asks Gemini for prose commentary. Gemini's JSON is constrained by zod (`responseJsonSchema`), and `analyzeDay` post-processes the model's response so it **cannot** downgrade a locally-detected warning/ending, invent an ending the local forecast didn't flag, or emit malformed commentary (falls back to local commentary if the format doesn't match). Any Gemini failure (bad JSON, HTTP error, missing key) degrades to the local fallback with a labeled `providerNotice` — the game never blocks on the AI. This provider-can't-override-safety-floor pattern is the key invariant to preserve when touching `geminiClient.ts` or `DailyReview.ts`.

**API routes are thin schema-validated wrappers** (`src/app/api/gemini/*`, `src/app/api/nessie/*`) — validate input with `src/schemas/api.ts`, delegate to `lib/geminiClient.ts` or `lib/nessieClient.ts`, return `{success, data, source}`. `src/app/api/nessie/mock/route.ts` generates fake demo transactions; `nessie/sync` calls the real (sandbox) Nessie API via `nessieClient.ts`, which is read-only and categorizes merchants by regex.

**Client state lives in one component**: `src/components/features/Game.tsx` owns the entire `GameState` via `useState`, persists it to `localStorage` through `src/lib/storage.ts` (key `room-economy-v1`) on every change, and passes it down. Child components (`BalancePanel`, `MissionPanel`, HUD/modal components) are presentational and call back up via props — they don't own state. `RoomCanvas.tsx` + `IsometricEngine.ts` + `AvatarRenderer.ts` render the room on `<canvas>` with grid-based pathfinding (`findPath`/`blocked`/`gridToScreen`/`screenToGrid`), independent of the game logic.

**Two run modes**: `demo` (simulated income/spending via `/api/nessie/mock`) and `nessie` (real sandbox bank sync via `/api/nessie/sync`, polled every 60s while the tab is visible; balance is authoritative, no invented income). Switching to `nessie` starts a fresh run from the current profile.

### Conventions

- Formatting is intentionally dense/minified-looking (long single-line functions, minimal whitespace) — this is the existing house style in `src/engine/*` and `src/lib/*`; match it rather than reformatting. `scripts/format-source.mjs` exists for bulk formatting — check it before hand-reformatting a file.
- Money values go through `round()` (2 decimals) at the point they're written into state; don't leave unrounded floats in `GameState`.
- New engine mutators must handle `state.isGameOver` (usually a no-op early return) and go through `structuredClone` rather than mutating the input.
