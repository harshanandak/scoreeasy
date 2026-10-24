# Kabaddi raid board: evidence

The board is the **v2 court design**: a top-down kabaddi court between the score and the Undo bar. These screenshots show the real app components, `MonoQuickMatch` → `KabaddiRaidBoard` → `KabaddiCourt` on the shipped `BoardShell`. Each one starts from a quick-match draft holding an engine state built by `kabaddiEngine.js`. The harness then taps through the board as a scorer would: it taps defender tokens, the bonus line, an outcome and Confirm.

Auth and Convex are local mocks; nothing is written to a live system. Captured with T3 `html_preview` with the app bundle inlined, no Chrome. The frame is pinned to the phone height so the `max-height` media queries and the options sheet behave as they do on a 360×640 or 390×844 phone.

**Team colours:** the shots use the app's real defaults, red v blue (`DEFAULT_TEAM_COLOURS`, `#d62828` / `#1d4ed8`), passed through the match draft. The earlier v1 set showed purple/orange because the evidence harness hard-coded the engine's default `colours` argument as the match colours; the board itself has always drawn the match's own colours. The `before-*` and `v1-*` shots are kept exactly as they were captured, so they still show purple/orange.

| State | 390×844 light | 360×640 light | 390×844 dark |
|---|---|---|---|
| Before (shipped goals board) | [before-390-light](before-390-light.png) | [before-360-light](before-360-light.png) | — |
| v1 of this PR: start / raid / touch | [v1-start](v1-start-390-light.png) · [v1-raid](v1-raid-390-light.png) · [v1-touch](v1-touch-390-light.png) | [v1-start](v1-start-360-light.png) · [v1-raid](v1-raid-360-light.png) · [v1-touch](v1-touch-360-light.png) | — |
| Start (tap a half: who raids first) | [start-390-light](start-390-light.png) | [start-360-light](start-360-light.png) | [start-390-dark](start-390-dark.png) |
| Raid (raider across the midline, 30 s clock) | [raid-390-light](raid-390-light.png) | [raid-360-light](raid-360-light.png) | [raid-390-dark](raid-390-dark.png) |
| Touch 2 + bonus line → preview | [touch-390-light](touch-390-light.png) | [touch-360-light](touch-360-light.png) | [touch-390-dark](touch-390-dark.png) |
| Super tackle (3 defenders, tackled) | [super-390-light](super-390-light.png) | [super-360-light](super-360-light.png) | [super-390-dark](super-390-dark.png) |
| All out moment | [allout-390-light](allout-390-light.png) | [allout-360-light](allout-360-light.png) | [allout-390-dark](allout-390-dark.png) |
| Do or die cue | [doordie-390-light](doordie-390-light.png) | [doordie-360-light](doordie-360-light.png) | [doordie-390-dark](doordie-390-dark.png) |
| Undo (whole raid restored) | [undo-390-light](undo-390-light.png) | [undo-360-light](undo-360-light.png) | [undo-390-dark](undo-390-dark.png) |
| Half time | [half-390-light](half-390-light.png) | [half-360-light](half-360-light.png) | [half-390-dark](half-390-dark.png) |
| Full time result | [result-390-light](result-390-light.png) | [result-360-light](result-360-light.png) | [result-390-dark](result-390-dark.png) |
| Raid log (⋯ sheet) | [log-390-light](log-390-light.png) | [log-360-light](log-360-light.png) | [log-390-dark](log-390-dark.png) |

## Measured in the rendered page

The audit ran in each capture. It used `getBoundingClientRect` for size, position and overlap, and `getComputedStyle` colours normalised through a canvas, with translucent layers composited before computing contrast.

- **Scoring zone at 360×640:** the board is exactly 640px tall in every state, and the action zone ends exactly where the Undo bar starts (560px).
  - The court is 262–263px at rest and during a raid, so it does not jump when a raid starts or ends; each half is 131px.
  - At 390×844 the court is 349px at rest and during a raid, and 469px at half time and full time.
  - Only the raid log scrolls, inside its sheet, by design.
- **No overlapping targets:** no two court controls overlap, in any state at either size. These were checked: defender tokens, the raider, the raid clock, Cancel raid, the bonus line, the pick-a-half pills and the tags.
  - The only overlap reported is a game-sense tag ("1 empty raid") sitting inside the full-width bonus-line band. The tag has `pointer-events: none`, so a tap there still reaches the bonus line.
- **Touch targets:** every enabled button is at least 48×48px in every state at both sizes. Defender tokens are 48×48 hit areas with 36px discs; at 360px wide, seven of them fit in one row.
- **Text contrast (all visible text on its real background):**
  - Light: minimum 5.61:1 (the do-or-die tag, danger ink on danger-soft); 6.0–6.21:1 elsewhere.
  - Dark: minimum 5.59:1; 6.1–6.7:1 on the raid screens.
  - The only text not measured sits on a gradient: the shipped green Go/Confirm button (`.se-go`, gated at 5.34:1 in `index.css`).
- **Team colours:** `contrastReport` gates the team-colour keys, numerals and the raider chip in `MonoQuickMatch.kabaddiBoard.test.jsx` for three pairs: purple/orange, black/yellow and white/white.
