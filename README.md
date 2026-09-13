# CashBound

A financial life game where the room is the play space. Gameplay and flow are the current priority.

## Run

Run `npm install`, then `npm run dev`, and open http://localhost:3000.
Configure server-only service credentials in `.env.local` using `.env.example`. Gemini defaults to `gemini-3.6-flash`. Nessie requires its API key and customer ID. Never put keys in client code.

## Game loop

- Balance and editable-amount life actions sit beside the room. Purchases affect health, entertainment, energy, supplies, stress, and clutter immediately.
- **End day** advances one day and sends the closing day's transactions plus monthly context to Gemini. There is no transaction-triggered analysis. Short next-morning warnings change the character's behavior and highlight the speech bubble. Service failures use a labeled local review.
- A month has 30 days. Food is consumed daily; rent and utilities settle monthly. Demo runs receive monthly income; connected runs use bank balances.
- **Update transactions** verifies monthly missions: savings transfers ($150 / 60 coins), gym ($25 / 40 coins), and health ($30 / 40 coins). Manual transactions cannot complete missions. Duplicate bank transactions cannot earn rewards twice.
- Coins buy furniture or a house upgrade. Risky discretionary spending incurs a 5/10/20 coin fine at day close according to review severity. Coins can fall below zero; fines never debit bank money.
- **History** keeps previous character lines, warnings, and rewards. Journal and budget details remain in overlays.
- A serious spending-pace forecast can trigger an ending while cash is still positive. The day-five / half-money-left case is evaluated against projected food, rent, utilities, and leisure gaps. Gemini reviews those forecasts; local forecasts still work during outages. Food shortage causes a collapse, rent or utility shortfalls darken the room, and unfunded recreation causes a fictional stress collapse. Recovery guidance follows the animation, showing remaining days, essential costs, and any funding gap. This is a simulated outcome, not a guarantee about real life.
- Rest and tidying each work once per day. They do not remove bills or transactions.

Nessie is read-only. Connecting starts a separate bank-linked run. Purchases and transfers are deduplicated; bank history is assigned to the current simulation period. Gym and health missions currently identify merchants by description. While connected, visible tabs sync every minute.

Progress, dialogue, rewards, furniture, and endings autosave locally. Profile beside the menu opens character customization and the budget. The home button is Tutorial, with instructions and access to room items. History contains past dialogue. The menu provides account linking, export/import, and restart. Older saves receive compatible defaults.

## Verification

`npm test`, `npm run typecheck`, and `npm run build` validate game logic and production compilation.
`npm run test:browser` uses installed Windows Chrome and a running dev server. It mocks provider responses to check daily review timing, coin progression, transaction deduplication, persistence, mobile layout, and the ending sequence. Reports and screenshots are in `artifacts/`. Live Gemini is checked separately; live Nessie reads are verified separately against the configured sandbox account.

Hold and drag on the room to rotate through 360 degrees. Click without dragging to inspect items; keyboard arrow keys rotate and Home or Reset restores the view. Exterior-facing walls stay opaque and cover interior furniture, labels, and click targets. A padded canvas keeps room edges visible up to 150% zoom. The gold keys on the small table near the front of the room open the transport amount input. Furniture clicks walk the character to the item before its dialog opens. Camera controls have their own row above the character dialogue. Daily reviews ask Gemini only for short prose using the game?s calculated assessment. Compatible Gemini 3 Flash models use minimal thinking (other Gemini 3 models use low), with a 40-second request timeout and no automatic retries. Slow or failed reviews fall back to local analysis. Client requests allow 45 seconds and API routes declare a 50-second execution limit; deployment platform limits still apply.

The room uses the reference layout with peach walls, beige tiles, a lavender refrigerator, retro desktop PC, twin bed pillows, pointed-leaf plants, and a mint sofa facing the coffee table. Sofa upholstery is sorted by camera depth so the back and arms properly cover the cushions from all viewing angles. The surrounding interface keeps its original style. Furniture is arranged into kitchen, office, sleeping, and sitting areas with clear paths. Daily Gemini reviews live in their own left panel, beneath the mission toggle. Forecast & next steps opens a scrollable popup. Endings offer a rewind to the saved purchase checkpoint or a new start. Ending notes are brief, with detailed recovery advice behind a disclosure. Walking is 0.7 tiles/second (0.3 when exhausted), with a slower 380 ms dialog entrance. In new-run setup, **Check with Gemini** sits to the left of **Move in**: it checks the current income and six allocations without starting the run or applying changes. Editing the budget clears stale feedback. Spending reviews still happen only at End day.

Rewinding clears the visible daily review and restores the purchase checkpoint. Previous advice is retained as a coaching baseline, so the next End day evaluates the changed choices. Pausing optional purchases or covering essentials earns encouragement when the remaining essential funding gap has not worsened; unresolved costs stay visible in the forecast.

The pixel home-and-coin logo is available as a scalable SVG at `public/room-economy-mark.svg` and is used in the header and browser tab.

On Day 30, End day opens a month summary before settlement: spending, savings transfers, cash, category plan versus usage, wins, and next-month priorities. Closing the summary keeps Day 30 open. Continue runs the closing review and month settlement once. Daily commentary uses current-day facts and recent reviews; repeated Gemini wording falls back to fresh local commentary without another API call.

Nessie transaction updates: **Keep updated with transactions** calls `/api/nessie/sync?day=N` on the server using `NESSIE_API_KEY`, `NESSIE_CUSTOMER_ID`, and `NESSIE_ACCOUNT_ID`. Use HTTPS (`https://api.nessieisreal.com`). Game Day 3 selects Day 3 of the latest transaction month; skipped days are not backfilled. Completed/executed purchases, transfers, deposits, and withdrawals are normalized; pending/cancelled entries and rewards purchases do not affect cash. The API's current transfer format uses `id` without payer/payee fields; a description of "Transfer to savings" identifies savings in this format. Legacy records with party IDs use direction and account ownership instead. Empty transaction collections may return 404.

The game applies only the selected day's amounts to its existing balance, preserving manual choices and rewind behavior. It does not overwrite that balance with the account snapshot, which can include other days and, on the current sandbox, does not change when transaction records are created. Updating twice cannot debit the same transaction twice. Existing matching file transactions adopt their bank IDs without replaying spending or rewards. Empty days remain retryable. Manual room actions remain game-only choices; they do not write to the bank. Connected runs receive income only from imported transactions, and existing bank IDs are not replayed in later months.

`public/mock-transactions-30-days.json` remains a fictional 30-day seed fixture for development and tests. The live account contains its 26 purchases and 5 savings records; the savings account has 5 matching deposit records. The game no longer fetches this file when updating transactions. Credentials belong only in `.env.local`, never in public assets or client environment variables.

To explicitly create or resume this sandbox setup, run `node scripts/seed-nessie.mjs` with a server key in `.env.local`. The current provider truncates fractional purchase amounts, so the seed script stores integer cents in dedicated ledger accounts and sets `NESSIE_AMOUNT_UNIT=cents` with their explicit account ID. The adapter converts amounts and balance to dollars exactly once. Normal accounts default to `NESSIE_AMOUNT_UNIT=dollars`. Keep the ignored `artifacts/nessie-seed-state.json` checkpoint to resume without creating duplicate records. The selected account is configured explicitly; earlier setup attempts are retained separately and are not imported.

The room starts at 110% zoom and supports 80-150% zoom. `npm run test:room` checks eight camera angles at maximum zoom, opaque wall pixels, blocked clicks through exterior walls, interior furniture interaction, and mobile layout against a running development server. The extracted sprite assets remain in `public/sprites/` for reuse but are not loaded by the room.
