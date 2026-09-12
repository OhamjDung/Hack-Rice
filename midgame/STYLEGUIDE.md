# RoomEconomy Styling Guide

Extracted from `src/app/globals.css`, `src/app/game.css`, and actual
component usage in `src/components/`. This is a **reference**, not a
new stylesheet — copy tokens/patterns from here when building in
`midgame/`, don't invent new colors or spacing.

No Tailwind utility classes are used anywhere in `src/components` or
`src/app` (checked). Tailwind is imported only for its reset +
`@theme` token bridge in `globals.css`; the entire UI is hand-written
CSS classes. Treat this as a hand-authored design system, not a
Tailwind project.

## Two surfaces, one system

The app has **two visual surfaces** that share the same primitives
(buttons, modals, forms, status colors) but invert light/dark:

1. **World surface** (`game.css`) — the live, full-viewport room game.
   Dark forest palette. This is the current primary UI
   (`Game.tsx` renders `.game-world` as the whole page).
2. **Light surface** (`globals.css`) — cards, modals, forms, an
   earlier full dashboard layout. The dashboard *layout* classes
   (`.sidebar`, `.topbar`, `.status-grid`, `.room-heading` dashboard
   version, etc.) are superseded per
   `design-system/room-economy/MASTER.md` and no longer used as a
   page layout — but the **primitives** in the same file (`.button`,
   `.modal`, `.panel`, form inputs, `.message`/`.error`/`.success`,
   `.muted`/`.eyebrow`) are still actively used *inside* the dark
   world as floating light-surface dialogs (see
   `.game-world .modal{color:var(--ink)}` in `game.css`, and every
   modal component importing `.modal`/`.button`/`.form-grid` etc.
   from the global stylesheet).

So: **dark surface for the persistent game chrome, light surface for
anything that opens as a dialog on top of it.**

## Color tokens

### Light surface (`:root` in `globals.css`)
```css
--bg:      #f7f8f4   /* page background */
--card:    #ffffff   /* card/modal fill */
--ink:     #303a32   /* primary text */
--muted:   #65705b   /* secondary text, labels, captions */
--line:    #e6e9e1   /* borders, dividers */
--green:   #647950   /* brand green */
--soft:    #eef1e8   /* subtle fill (hovers, chips) */
--radius:  12px       /* default panel/card radius */
--danger:  #a44737   /* negative amounts, error accents */
```
Tailwind `@theme` bridge mirrors the core three:
`--color-background:#f7f8f4` `--color-foreground:#303a32`
`--color-primary:#657951` `--font-sans:Arial,Helvetica,sans-serif`.

Frequently reused hand-picked shades on the light surface (not
tokenized, but consistent throughout `globals.css`):
- Text/label gray-green: `#65705b` (most muted text), `#5e6d51`,
  `#536445`, `#536843`
- Hover/selected fills: `#eaf0e1`, `#eff2ea`, `#f0f3eb`, `#edf1e4`
- Success: bg `#eaf0df` text `#576a43`
- Error: bg `#fff0e9` text `#9a4433`
- Positive amount: `#66834f`
- Negative amount: `var(--danger)` `#a44737`

### World (dark) surface (`game.css`)
Not tokenized as CSS vars — these are the literal, repeated hex
values. Reuse them verbatim for consistency.
```css
#27322d   /* .game-world background (darkest) */
#344238   /* panel fill — missions-panel, balance-panel, vitals, character-thought, world-button */
#41513c   /* interactive row fill inside panels — balance-actions button, missions-toggle */
#506148 / #536648   /* panel hover states */
#68785f / #62715a / #6b785e / #748467   /* panel borders (muted sage) */
#f5f1e7   /* primary text on dark (cream) */
#edf2e7   /* secondary text on dark */
#c5d0bf / #c1cbb9 / #ced9c3 / #d0dbc7 / #d4dfc7   /* tertiary/caption text on dark, pick nearest */
#e7dca0   /* focus outline + gold accent (mission highlight, hud-coins) */
#d4dcb6   /* primary CTA fill on dark (End day, Sync) */
#283622   /* CTA text on the pale-lime buttons above */
#edf1d8   /* CTA hover */
#cc9a80 / #d6bc77 / #acc695   /* vital bars: health / mood / energy */
#e4ab56 border, #604320 bg, #fff0ce text   /* warning/alert state on dark (character-thought.warning-command) */
#ead69c bg, #f3e3b8 border, #46391b text   /* currency/coin chip (coin-shop, hud-coins uses #f1dfa8 text) */
#202731   /* blackout/power-off tint */
```

### Global focus ring (both surfaces)
```css
outline: 3px solid #8d9e6d;
outline-offset: 3px;
```
(the dark surface tightens this to `2px solid #e7dca0` on scroll
containers/panels — same idea, gold instead of olive, offset -2px
for contained scroll regions).

## Typography

- **Body/UI**: Arial, Helvetica, sans-serif. Base `14px` on `body`,
  but almost all UI chrome runs smaller — `11px`–`13px` is the
  dominant size for labels, captions, buttons, stat sub-text. This
  is a **dense, small-type UI**; don't default to 14–16px controls.
- **Serif accent**: Georgia, 'Times New Roman', serif — reserved for
  *emotional/narrative* moments, not general headings:
  - `h1` (32px, weight 400, -1px letter-spacing)
  - Modal titles (`.modal-heading h2`, 25px, weight 400)
  - Character/advisor voice (`.advisor-message`, 16px, line-height 1.65)
  - Sidebar note headline (`.sidebar-note h3`, 20px)
  - Chapter marker in-game (`.chapter-marker h2`, 22px Georgia)
  - Profile/character name preview (22px)
  - `.ending-caption` (22px, in-game ending sequence)
- Everything else (`h2`/`h3` by default, all data/labels/buttons) is
  sans-serif. Rule of thumb: **numbers and UI = sans; a character
  "speaking" or a big narrative beat = Georgia serif.**
- Large numerals (stat values, balances) use
  `font-variant-numeric: tabular-nums` and tight negative
  letter-spacing (-0.6 to -1px) at sizes 20–40px, weight 500.
- `.eyebrow` label style: 11px, letter-spacing 1.65px, weight 600,
  muted color — used above headings as a section kicker.

## Spacing & radius

No strict 8pt grid — spacing is a dense, hand-tuned 4–6px rhythm
(values like 5, 7, 9, 11, 13, 17, 21, 23 show up constantly, not just
multiples of 4/8). `design-system/room-economy/MASTER.md` names the
intended system as "four-pixel base with 8/12/16/20/24/32 rhythm" —
treat that as the target when adding new spacing, but don't be
surprised by odd numbers in the existing CSS.

Radius scale in actual use:
- `4px` — small chips (`.level-pill`, `.count`)
- `5–6px` — hover backgrounds, `.icon-button`, `.jar-row:hover`
- `7–8px` — buttons, `.notice`, `.calendar-icon`
- `9–10px` — panels, stat cards, `.world-button`, `.stat-icon`
- `12px` (`--radius`) — `.panel`, `.sidebar-note`, `.demo-controls`
- `16px` — `.modal`

## Buttons

Base `.button` class: `inline-flex`, `gap:9px`, `min-height:39px`,
`padding:10px 15px`, `border-radius:7px`, `font-size:11px`,
`font-weight:600`. Variants layer on top:

```css
.primary   { background:#667b52; border:1px solid #667b52; color:#fff; }
.primary:hover:not(:disabled) { background:#526741; }
.secondary { background:#fff; border:1px solid #dfe4d8; color:#5e6d51; }
.secondary:hover:not(:disabled) { background:#f0f3eb; }
```
`.text-button` — transparent, `#6c7f57`, underline+darken on hover.
`.icon-button` — 32×32, transparent, `#65705b`, `#eef1e8` hover fill.
All buttons: `:disabled{opacity:.5}`, `:active{translateY(1px)}`.

World-surface equivalents (same shape, dark palette):
`.world-button` (chrome buttons), `.end-week`/`.sync-life` (primary
CTA, pale-lime fill `#d4dcb6`/text `#283622`), `.balance-actions
button` (list-style action row, `#41513c` fill).

## Forms

```css
label { font-size:11px; font-weight:500; color:#68745b; }
input:not([type=file]) {
  padding:10px 12px; border:1px solid #d9dfcf; border-radius:7px;
  background:#fff; color:#34402c; font-size:14px; margin-top:7px;
}
```
`input[type=color]` gets fixed `height:38px`. Grids: `.form-grid`
(2-col), `.color-fields` (4-col) — both `gap:14px`.

## Cards, panels, status

- `.panel` — the base light-surface card: white, `1px solid
  var(--line)`, `border-radius:var(--radius)`.
- `.stat` cards (dashboard) — icon chip + label + big tabular number
  + optional `.mini-track` progress bar underneath.
- `.jar-row` (budget category) — icon, label row, thin progress
  `.jar-track`, detail caption. Same progress-bar pattern reused in
  `.milestone .mini-track` and the in-game `.vital` bars.
- Message banners: `.message` base, `.error` (bg `#fff0e9`/text
  `#9a4433`), `.success` (bg `#eaf0df`/text `#576a43`), `.notice`
  (bg `#edf2e6`/text `#667b53`), `.forecast-shortfalls` (warning, bg
  `#fbefcf`/border `#d9b779`).
- In-game warning state: `.character-thought.warning-command` — amber
  border `#e4ab56`, bg `#604320`, text `#fff0ce`.

## Modals

`<dialog class="modal">` via native `<dialog>` element (see
`Modal.tsx`) — `560px` wide, `16px` radius, `1px solid #e2e7d8`,
background `#fcfcf8`, heavy soft shadow
(`0 24px 90px #28332233`), `::backdrop` is `#25311fd0` +
`blur(4px)`. Entrance animation: fade+slide-up 180ms, disabled under
`prefers-reduced-motion`. Modal title uses the Georgia serif
treatment (25px/400).

## Icons

`lucide-react` throughout. Sizes cluster tightly: `15–20px` for
inline/button icons (17 and 20 most common), `27px` for a small
number of larger feature icons (room-object grid), `44px` for a rare
large illustrative icon. Don't introduce a different icon set.

## Responsive behavior

Dashboard layout (`globals.css`) collapses the sidebar through
breakpoints at `1500px → 1200px → 1000px → 800px → 520px`, going
icon-only below `1000px`. The world surface (`game.css`) reflows its
absolutely-positioned HUD panels (missions/balance) from fixed side
rails into stacked/relative blocks below `1000px` and `650px`. Both
respect `prefers-reduced-motion: reduce` by killing all
transitions/animations globally.

## What to reuse for `midgame/`

- Pick **one surface** deliberately (dark world-style HUD, or light
  card/modal style) rather than mixing ad hoc — the real app mixes
  them only because dialogs float over the game, not because both
  are "the theme."
- Keep type small (11–13px UI text) and reserve Georgia serif for a
  genuine narrative/character beat, not section headings in general.
- Reuse the exact hex values above rather than approximating —
  they're intentionally slightly desaturated/muted (sage-green,
  cream, dusty gold), and a slightly-off shade will read as a
  different, uncoordinated palette.
