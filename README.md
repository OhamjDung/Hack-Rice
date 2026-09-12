# RoomEconomy

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

Progress, dialogue, rewards, furniture, and endings autosave locally. The menu provides export/import and restart. Older saves receive compatible defaults.

## Verification

`npm test`, `npm run typecheck`, and `npm run build` validate game logic and production compilation.
`npm run test:browser` uses installed Windows Chrome and a running dev server. It mocks provider responses to check daily review timing, coin progression, transaction deduplication, persistence, mobile layout, and the ending sequence. Reports and screenshots are in `artifacts/`. Live Gemini is checked separately; a live Nessie account has not been verified.

Room camera arrows rotate through 360 degrees; Reset restores the view. Furniture clicks walk the character to the item before its dialog opens. Camera controls have their own row above the character dialogue. Gemini uses low thinking effort and one bounded application retry, with SDK retries disabled to avoid stacked waits.
