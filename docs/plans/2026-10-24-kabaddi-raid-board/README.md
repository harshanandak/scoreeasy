# Kabaddi raid board: evidence

These screenshots show the real app components: `MonoQuickMatch` → `KabaddiRaidBoard` on the shipped `BoardShell`. Each one starts from a quick-match draft that holds an engine state built by `kabaddiEngine.js`, and the harness then taps through the board as a scorer would. Auth and Convex are local mocks; nothing is written to a live system. Captured with T3 `html_preview`, no Chrome. The app bundle is inlined, and the frame is pinned to the phone height so the `max-height` media queries and the options sheet behave as they do on a 360×640 or 390×844 phone.

| State | 390×844 light | 360×640 light | 390×844 dark |
|---|---|---|---|
| Before (shipped kabaddi board) | [before-390-light](before-390-light.png) | [before-360-light](before-360-light.png) | — |
| Start (who raids first) | [start-390-light](start-390-light.png) | [start-360-light](start-360-light.png) | [start-390-dark](start-390-dark.png) |
| Raid outcome picker | [raid-390-light](raid-390-light.png) | [raid-360-light](raid-360-light.png) | [raid-390-dark](raid-390-dark.png) |
| Touch 2 + bonus → preview | [touch-390-light](touch-390-light.png) | [touch-360-light](touch-360-light.png) | [touch-390-dark](touch-390-dark.png) |
| Super tackle (3 defenders) | [super-390-light](super-390-light.png) | [super-360-light](super-360-light.png) | [super-390-dark](super-390-dark.png) |
| All out moment | [allout-390-light](allout-390-light.png) | [allout-360-light](allout-360-light.png) | [allout-390-dark](allout-390-dark.png) |
| Do or die cue | [doordie-390-light](doordie-390-light.png) | [doordie-360-light](doordie-360-light.png) | [doordie-390-dark](doordie-390-dark.png) |
| Undo (whole raid restored) | [undo-390-light](undo-390-light.png) | [undo-360-light](undo-360-light.png) | [undo-390-dark](undo-390-dark.png) |
| Half time | [half-390-light](half-390-light.png) | [half-360-light](half-360-light.png) | [half-390-dark](half-390-dark.png) |
| Full time result | [result-390-light](result-390-light.png) | [result-360-light](result-360-light.png) | [result-390-dark](result-390-dark.png) |
| Raid log (⋯ sheet) | [log-390-light](log-390-light.png) | [log-360-light](log-360-light.png) | [log-390-dark](log-390-dark.png) |

## Measured in the rendered page

The audit ran in each capture: `getBoundingClientRect` for size and position, and `getComputedStyle` colours normalised through a canvas, with translucent layers composited before computing contrast.

- **Scoring zone at 360×640:** the board is exactly 640px tall in every state. The board body (`.kb-body`) clips 0px in every state, including the touch + bonus preview, which is the tallest. Only the raid log scrolls, inside its sheet, by design.
- **Touch targets:** every enabled button is at least 48×48px in every state at both sizes.
- **Text contrast (all visible text on its real background):**
  - Light: minimum 5.61:1 (the do-or-die note, danger ink on danger-soft); 6.2–6.21:1 on the other states re-measured.
  - Dark: minimum 5.59:1 (the half time, result, log, undo, do-or-die and all-out screens); 6.1:1 on touch and super tackle.
  - The only text not measured sits on a gradient: the shipped green Go button (`.se-go`, gated at 5.34:1 in `index.css`).
- **Team colours:** the team-colour keys, numerals and the raider chip pass the engine's `contrastReport`, asserted in `MonoQuickMatch.kabaddiBoard.test.jsx` for three pairs: purple/orange, black/yellow and white/white.
