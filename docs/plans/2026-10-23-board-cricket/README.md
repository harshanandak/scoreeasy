# Board G1: cricket scoring screen

Decisions needed: none. Keep PR #187 in draft: the compact powerplay/chase layout clips Undo.

## Captured evidence

28 after PNGs render the real guided scorer, tournament scorer (`MonoCricketLiveScore`), Test scorer and innings-break route. Each of the eight demo states below has a 390 x 844 light capture, a 360 x 640 light capture and a 390 x 844 dark capture. The two existing before images remain unchanged: [390 x 844](before-390.png), [360 x 640](before-360.png).

| State | Light 390 x 844 | Light 360 x 640 | Dark 390 x 844 |
| --- | --- | --- | --- |
| Limited-overs mid-innings | [PNG](after-mid-light-390x844.png) | [PNG](after-mid-light-360x640.png) | [PNG](after-mid-dark-390x844.png) |
| Chase: NEED / OFF / RRR | [PNG](after-chase-light-390x844.png) | [PNG](after-chase-light-360x640.png) | [PNG](after-chase-dark-390x844.png) |
| Wicket sheet | [PNG](after-wicket-light-390x844.png) | [PNG](after-wicket-light-360x640.png) | [PNG](after-wicket-dark-390x844.png) |
| FREE HIT | [PNG](after-freehit-light-390x844.png) | [PNG](after-freehit-light-360x640.png) | [PNG](after-freehit-dark-390x844.png) |
| Innings-break handoff | [PNG](after-break-light-390x844.png) | [PNG](after-break-light-360x640.png) | [PNG](after-break-dark-390x844.png) |
| Test: Lead by 74 | [PNG](after-test-lead-light-390x844.png) | [PNG](after-test-lead-light-360x640.png) | [PNG](after-test-lead-dark-390x844.png) |
| Test: Trail by 76 | [PNG](after-test-trail-light-390x844.png) | [PNG](after-test-trail-light-360x640.png) | [PNG](after-test-trail-dark-390x844.png) |
| Tournament: lean keys | [PNG](after-tournament-light-390x844.png) | [PNG](after-tournament-light-360x640.png) | [PNG](after-tournament-dark-390x844.png) |

Additional 360 x 640 light evidence: [Powerplay](after-powerplay-light-360x640.png), [Last Man Batting](after-lastman-light-360x640.png), [draft remount / Undo](after-restore-light-360x640.png), [powerplay + chase failure](after-powerplay-chase-light-360x640.png).

## Rendered measurements (rung 5)

[All per-control rectangles, label contrast samples and viewport measurements](measurements.json).

- The standard guided, chase, FREE HIT, tournament and Test scoring documents are exactly 360 x 640 or 390 x 844 with no horizontal or vertical overflow. Last Man also fits 360 x 640. Wicket sheets fit, with board interaction covered by the modal.
- Normal Undo: y=574..630 at 360 x 640 and y=778..834 at 390 x 844. The complete 56 px button is in the bottom third, 10 px above the bottom. Hints include `Back to 12.2 ? 97/0`, `Back to 12.3 ? 101/0`, tournament `Back to 12.3 ? 80/0`, and Test `Back to 3rd ? 0.3 ? 20/0`. Its geometry is not a claim of accessibility through the open wicket modal.
- Every measured scoring control and wicket choice is at least 48 x 48 px. At 360 px, guided Big-5 keys are approximately 61.6 x 64 px, extras/other runs 78.75 x 48 px, and bottom options/swap 50 x 56 px. Tournament run keys are 78 x 78 px; extras are 150 x 48 px. The per-capture JSON lists all measured controls.
- No capture has horizontal overflow.
- Key-label contrast: blue run keys 6.99:1; wicket key 5.61:1 light / 7.25:1 dark; neutral keys 19.66:1 / 15.92:1; Undo restore hint 6.78:1 / 5.59:1; FREE HIT 6.00:1 / 8.32:1; tournament yellow keys 11.78:1. The rendered hero-core samples are 6.99:1 and its numeral scrim 10.87:1. The real `contrastReport` separately checks gradient/motif bounds: all pairs pass, minimum label 4.63:1 and minimum numeral 8.02:1. Flat/core samples alone do not prove every gradient pixel.
- **Failure:** powerplay + chase at 360 x 640 makes the document 658 px tall. Undo is y=591.63..647.63 and is clipped by 7.63 px. Powerplay without the chase row has a 641 px document. Filed as `c55d7bd5-e98d-42d3-9b6c-e2520f3f8d57` (P2).
- Handoff: its form fits visually, but nested full-height setup adds 98 px of unused scroll: document 738 px at 360 x 640 and 942 px at 390 x 844. There is no Undo in this phase. Extra scroll filed as `05c2ba52-6492-47bb-bea1-bf60d600093d` (P3); the existing reverse-path gap remains separately tracked.

## Shared checklist

| Item | Evidence and status |
| --- | --- |
| Team labels and mark contrast | Pass for the seeded blue/yellow pair: rendered ratios above plus real engine gradient/motif bounds. Existing automated tests cover distinct, clashing, bright and deep pairs. |
| Undo visible, reachable, restore hint | Pass on the normal boards; **fails on compact powerplay + chase**. Wicket modal covers the underlying bar; the innings-break phase has no reverse control. |
| Every named state and reverse path | All eight requested demo states captured in three viewport/theme combinations. Browser actions passed for 12 run/extra keys each followed by Undo, wicket/Bowled/new batter/Undo, swap twice, options scorecards, guided Finish callback and the innings-1-to-break handoff. Powerplay and Last Man rendered. Full secondary-options and Test declaration/draw browser walks remain incomplete; automated coverage is separate. Existing innings-break reverse-path gap remains open. |
| Scoring zone works at 360 x 640 without scrolling | Standard boards pass. **Powerplay + chase fails**; screenshot and coordinates above. |
| Light and dark | Pass for all eight requested demo states. |
| Targets >=48 px; refresh restore | All measured scoring controls pass. A real guided route draft was saved, unmounted and rehydrated: 105/0 restored with team colours, then Undo returned to 101/0. This is a component/route remount, not a full browser-process restart. Existing persistence tests cover refresh. |
| Setup colours reach board and saved state | Seeded persisted blue/yellow identity appears on guided/tournament/Test boards; real guided draft/remount retains it. The quick setup picker-to-board browser path was not walked; its existing automated test passes. |

## Method, validation and scope

Captures use only T3 `html_preview`, with an inlined Vite IIFE, CSS and embedded app fonts in an iframe sized to the target phone viewport. Viewport units are converted to the equivalent pixel height, preserving the original media-query viewport. Wicket retakes disable animation/transition in the local harness to capture the settled sheet. Auth, Convex and broadcast hooks are mocked; a Convex mutation would throw. Fixtures and storage writes are local only. The harness remains untracked in `.capture-g1/`.

The rendered source was PR head `85c4eb976621d9e17a14a8184eb733e80600c057`. The required rebase onto master `997abde` retained both palette reductions (598 minus cricket's 4 = 594). The four scorer components, cricket CSS, shared mono CSS and index CSS are byte-identical to the captured source after rebase.

- Focused validation: 5 files / 46 tests passed (board controls, aggregate boards, quick colours/draft restore, persistence and guided route transitions). No product tests added in this evidence-only task.
- Screenshot verifier: all 28 after files are exactly 390 x 844 or 360 x 640. Per-capture records enumerate the controls and measurements.
- Palette check and commit/push hook results are recorded in the PR body after they run. Existing full-suite results in that body belong to the earlier implementation head; they are not a new full-suite run.
- No scoring/product changes were made for either visual finding. The only product-file integration change is the required shared palette-baseline conflict resolution.

Follow-ups: compact powerplay/chase clipping (`c55d7bd5-e98d-42d3-9b6c-e2520f3f8d57`); handoff empty scroll (`05c2ba52-6492-47bb-bea1-bf60d600093d`); guided innings-break correction (`43e7ddce-0740-41c8-986f-e794cb43a7c4`); SA-08 Test innings advance/Undo (`8b0316bd-bcda-40b9-877a-f4188f5dd5dc`); spectator cards (`eda76029-9be1-467b-bcc9-b56a2bd57f53`).
