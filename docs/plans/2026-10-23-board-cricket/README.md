# Board G1: cricket scoring screen

Decisions needed: none. Round 2 fixes both visual findings. PR #187 remains draft because the broader feature acceptance still has unwitnessed browser paths and the separately tracked innings-break reverse-path gap.

## Round 2 layout fixes

Powerplay now shares the batting-team identity row instead of consuming a separate paragraph and its margins. FREE HIT, Last Man Batting, target/chase figures and powerplay remain independently visible when applicable; there is no priority rule hiding a truthful state. No scoring handler, engine rule or persistence path changed.

The innings-break route resets its nested lineup screen's minimum height. The outer handoff owns the viewport height, so the lineup no longer adds another full viewport below the banner. Standalone opening-lineup setup keeps its existing height.

## Captured evidence

All after PNGs are captured with T3 `html_preview`, using the retained untracked `.capture-g1/` harness, the real components, embedded fonts and a Vite IIFE. The rendered product source is the rebased layout-fix commit (`3a1670623c2ef7aa4155e5622575fdf8c31225e6`); the scorer files and relevant CSS are byte-identical across rebase. Auth/Convex/broadcast are mocked and no live writes occur. Measurements wait for fonts and two animation frames. Motion is disabled to capture settled sheets. Before images are unchanged: [390 x 844](before-390.png), [360 x 640](before-360.png).

The state matrix and all per-control measurements are in [measurements.json](measurements.json). Each state below has light captures at 390 x 844 and 360 x 640, plus dark at 390 x 844.

| State | Light 390 x 844 | Light 360 x 640 | Dark 390 x 844 |
| --- | --- | --- | --- |
| Mid-innings | [PNG](after-mid-light-390x844.png) | [PNG](after-mid-light-360x640.png) | [PNG](after-mid-dark-390x844.png) |
| Chase / target | [PNG](after-chase-light-390x844.png) | [PNG](after-chase-light-360x640.png) | [PNG](after-chase-dark-390x844.png) |
| Wicket sheet | [PNG](after-wicket-light-390x844.png) | [PNG](after-wicket-light-360x640.png) | [PNG](after-wicket-dark-390x844.png) |
| FREE HIT + chase | [PNG](after-freehit-light-390x844.png) | [PNG](after-freehit-light-360x640.png) | [PNG](after-freehit-dark-390x844.png) |
| Innings break | [PNG](after-break-light-390x844.png) | [PNG](after-break-light-360x640.png) | [PNG](after-break-dark-390x844.png) |
| Test Lead by 74 | [PNG](after-test-lead-light-390x844.png) | [PNG](after-test-lead-light-360x640.png) | [PNG](after-test-lead-dark-390x844.png) |
| Test Trail by 76 | [PNG](after-test-trail-light-390x844.png) | [PNG](after-test-trail-light-360x640.png) | [PNG](after-test-trail-dark-390x844.png) |
| Tournament | [PNG](after-tournament-light-390x844.png) | [PNG](after-tournament-light-360x640.png) | [PNG](after-tournament-dark-390x844.png) |
| Powerplay | [PNG](after-powerplay-light-390x844.png) | [PNG](after-powerplay-light-360x640.png) | [PNG](after-powerplay-dark-390x844.png) |
| Last Man Batting | [PNG](after-lastman-light-390x844.png) | [PNG](after-lastman-light-360x640.png) | [PNG](after-lastman-dark-390x844.png) |
| Powerplay + chase | [PNG](after-powerplay-chase-light-390x844.png) | [PNG](after-powerplay-chase-light-360x640.png) | [PNG](after-powerplay-chase-dark-390x844.png) |
| FREE HIT + chase + powerplay | [PNG](after-freehit-powerplay-chase-light-390x844.png) | [PNG](after-freehit-powerplay-chase-light-360x640.png) | [PNG](after-freehit-powerplay-chase-dark-390x844.png) |
| Last Man Batting + chase | [PNG](after-lastman-chase-light-390x844.png) | [PNG](after-lastman-chase-light-360x640.png) | [PNG](after-lastman-chase-dark-390x844.png) |

Additional evidence: [guided draft save/remount/Undo at 360 x 640](after-restore-light-360x640.png).

## Compact measurements (rung 5: rendered components)

Every scoring document is exactly 360 x 640, with no horizontal or vertical overflow. Undo is 56px high, fully visible in the bottom third, and shows the previous score/over. Its measured y-range is **574..630px** in every compact combination: powerplay alone; chase alone; powerplay + chase; FREE HIT + chase; FREE HIT + chase + powerplay; Last Man Batting alone; Last Man Batting + chase; Test Lead; Test Trail; standard mid-innings and tournament boards. The open wicket modal covers the underlying bar; its rectangle is not a claim that Undo is accessible through the modal.

At 390 x 844, Undo is y=778..834px. Handoff documents are now exactly 360 x 640 and 390 x 844, removing the prior 98px of empty scroll at both sizes. This phase still has no reverse control; that existing functional gap is separately tracked.

Every measured scoring button is at least 48 x 48px. At 360px, guided run keys are about 61.6 x 64px, extras/other runs 78.75 x 48px, and bottom options/swap 50 x 56px. Team contrast bounds pass for the seeded blue/yellow pair: minimum label 4.63:1 and numeral 8.02:1. Rendered labels retain the existing passing ratios: blue keys 6.99:1; warning labels 6.00:1 light / 8.32:1 dark; wicket 5.61:1 / 7.25:1; Undo hint 6.78:1 / 5.59:1.

## Acceptance and remaining evidence

- Team colour and mark contrast: passing rendered samples plus automated engine bounds; tests cover additional team pairs.
- Compact scoring / Undo: the two visual findings are fixed, with the combinations and geometry above. All screenshots are dimension-checked and their scroll/control bounds verified by script.
- Light and dark: captured for every state in the matrix.
- Prior browser walk: all 12 run/extra keys followed by Undo, wicket/Bowled/new batter/Undo, swap twice, options/scorecards, guided Finish callback and innings-1-to-break handoff passed in the previous round. These historical actions are retained in `browserWalk` in the JSON and are not represented as a new complete walkthrough.
- Draft restore: real guided route saved, unmounted and rehydrated 105/0 with team colours, then Undo returned to 101/0. This is a route remount, not a full browser-process restart. Persistence tests cover refresh separately.
- Remaining feature acceptance: quick setup picker-to-board browser path, full secondary-options walkthrough, Test declare/draw walkthrough and every reverse path remain incomplete. No ready claim is made.

## Validation and scope

The regression was observed failing before the product fix: powerplay was outside the identity row. It now asserts that powerplay stays in that row across a no-ball, FREE HIT and Undo. CSS geometry is verified in rendered pages rather than jsdom.

- Focused board/persistence/route validation: 5 files / 46 tests passed.
- After rebase, palette, guided-board and innings-handoff tests: 3 files / 163 tests passed. Combined palette baseline is 593 (master 597 minus cricket's four removed literals).
- Product commit hooks passed lint (0 errors, 29 existing warnings), type-check and all five agent-config checks.
- Final full-suite, evidence-commit hooks and push-gate results are recorded in the PR body after execution.

Only the guided scorer markup, cricket CSS, handoff CSS and the board regression changed for these fixes. No scoring rules, persistence, live or spectator implementation was edited. Rebase retained master's changes and both palette reductions.

Fixed findings: compact Undo clipping (`c55d7bd5-e98d-42d3-9b6c-e2520f3f8d57`) and handoff empty scroll (`05c2ba52-6492-47bb-bea1-bf60d600093d`). Remaining follow-ups: guided innings-break correction (`43e7ddce-0740-41c8-986f-e794cb43a7c4`); SA-08 Test innings advance/Undo (`8b0316bd-bcda-40b9-877a-f4188f5dd5dc`); spectator cards (`eda76029-9be1-467b-bcc9-b56a2bd57f53`).
