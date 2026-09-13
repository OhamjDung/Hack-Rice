# CashBound design system

## Current direction (user correction)

The room occupies the viewport. Budgets, transactions, settings, and coaching are optional dialogs. Persistent UI is limited to character wellbeing, time, a short thought, and game controls. Gameplay and flow take priority over further visual polish. The earlier dashboard composition below is superseded.

The UI/UX skill search returned a generic showcase pattern, then a gaming 3D pattern. Neither is a direct match for this financial simulation workspace. The following project-specific direction uses the applicable interaction and accessibility guidance rather than persisting an unrelated template.

- Product: responsive desktop-first financial survival simulation.
- Composition: fixed navigation, compact financial HUD, prominent isometric apartment, budget jars and coach sidebar.
- Mood: calm, tactile, welcoming. Sage green, cream, and natural wood; no neon gradients.
- Tokens: background `#f7f8f4`, foreground `#303a32`, card `#ffffff`, primary `#647950`, border `#e6e9e1`. Defined in globals.css.
- Type: system sans for controls and numerals; Georgia for editorial headings and coach commentary. No external font dependency.
- Spacing: four-pixel base with 8/12/16/20/24/32 rhythm; card radius 12, controls 7–8.
- Feedback: hover, focus-visible, pressed and disabled states; explicit errors, transaction empty state, pending request labels.
- Accessibility: native buttons and dialogs, labels on controls, canvas alternative furniture controls, reduced-motion behavior.
- Assets: procedural canvas furniture and avatar; Lucide icons per the supplied architecture.
