# Board G1: cricket scoring screen

Decisions needed: none. Round 3 completes the remaining board acceptance walks. All acceptance rows below have rendered or explicitly identified automated evidence; the excluded work stays in Linked follow-ups. PR #187 is not merged.

## Round 3 acceptance walk (rung 5: rendered components)

All 13 new PNGs are light, exactly 360 x 640, captured only through T3 `html_preview` with the retained untracked `.capture-g1/` inlined harness and the real components. Six affected Test Lead/Trail PNGs were also replaced at both light sizes and 390 x 844 dark. Product source: `c7c36b944ed3fac17d25c471e7f39c6c34f57db4`, rebased onto master including kabaddi #189 and badminton #190 (`167a74a`). Master's neutral-sport team-colour tests now use table tennis. Auth, Convex and broadcast are mocked; local draft writes are real; there are no live writes. Raw console checks and measurements are under `round3` in [measurements.json](measurements.json). The earlier records retain their original source head.

| Step | PNG |
| --- | --- |
| quick picker | [round3-quick-picker-light-360x640.png](round3-quick-picker-light-360x640.png) |
| quick board | [round3-quick-board-light-360x640.png](round3-quick-board-light-360x640.png) |
| quick restore | [round3-quick-restore-light-360x640.png](round3-quick-restore-light-360x640.png) |
| options full | [round3-options-full-light-360x640.png](round3-options-full-light-360x640.png) |
| options closed | [round3-options-closed-light-360x640.png](round3-options-closed-light-360x640.png) |
| Test options | [round3-test-r3-options-light-360x640.png](round3-test-r3-options-light-360x640.png) |
| Test declare confirm | [round3-test-r3-declare-confirm-light-360x640.png](round3-test-r3-declare-confirm-light-360x640.png) |
| Test declare cancel | [round3-test-r3-declare-cancel-light-360x640.png](round3-test-r3-declare-cancel-light-360x640.png) |
| Test declare declared | [round3-test-r3-declare-declared-light-360x640.png](round3-test-r3-declare-declared-light-360x640.png) |
| Test declare undo | [round3-test-r3-declare-undo-light-360x640.png](round3-test-r3-declare-undo-light-360x640.png) |
| Test draw confirm | [round3-test-r3-draw-confirm-light-360x640.png](round3-test-r3-draw-confirm-light-360x640.png) |
| Test draw cancel | [round3-test-r3-draw-cancel-light-360x640.png](round3-test-r3-draw-cancel-light-360x640.png) |
| Test draw complete | [round3-test-r3-draw-complete-light-360x640.png](round3-test-r3-draw-complete-light-360x640.png) |

**Quick setup → board → saved draft remount:** entered Falcons/Tigers, clicked Yellow for A (`#facc15`) and Green for B (`#16a34a`), then Start cricket. The board retains both engine cores (`#facc15` / `#00662a`), and its batting hero and run keys use A's selected yellow. Scored Four: the draft saves 4/0, 0.1 overs and both selected colours. Unmounted the route and mounted it again from that saved draft: score and both colours persist. The board has no document overflow; Undo is y=574–630, 56px high. The primary keys are 49.33 x 48px.

**Full secondary options:** all 12 guided controls are visible without scrolling: Guided, Power, Dead ball, Mankad, Penalty +5, Change bowler, Retire, Correct last ball, Penalty runs input, Add penalty, End innings and End match. All are at least 48 x 48px; the lowest action ends at y=447.41. Walked both scorer modes, dead ball/Undo, both penalty actions/Undo, Mankad/new batter/Undo, bowler picker/close, retirement modes/cancel, Correct last ball, and both end callbacks. Terminal callback probes remount the seeded scorer before continuing; they do not claim an innings-break reverse path. Closing returns to the board with Undo visible at y=574–630. Test options also show every entry: Done (48px), Declare innings, End as draw, Finish & save and Discard match (54px rows).

**Test declaration:** 3rd innings, 24/0 at 0.4 overs. Declare innings opens a confirmation naming that score; Keep batting cancels to the same board. Confirm Declare advances to the 4th innings. Undo restores the 3rd innings at 24/0, with the original prior-delivery hint. Confirmation/cancel buttons are 52px high; active board Undo remains y=574–630.

**Test draw:** End as draw opens its confirmation. Keep scoring cancels to the 3rd innings at 24/0; confirming End as draw shows Match Drawn and persists `status: completed`, `winner: draw`. Today's terminal state offers Save & Return, not Undo; cancellation before confirmation is the available reverse path. Save & Return is 48px high after the fix below.

## UI bugs found and fixed this round

- Guided option pills were 34px high: their inline `.menu-row .pill` rule overrode the board touch minimum. Raised it to 48px. The regression failed first with “Dead ball: expected 34 to be greater than or equal to 48”, then passed.
- Quick cricket inherited viewport-sized grid rows and placed six run keys in two rows. After Four, Undo ended at y=695.48 on the 640px phone. The cricket primary grid now has one six-key row and automatic row height; Undo ends at y=630, with every key still at least 48px. The regression failed on the old four-column grid before the CSS fix.
- The existing Test result Save & Return button measured 47px on the named draw-finish path. Added a 48px minimum. Both tournament and quick terminal-return regression cases failed before the fix and pass after it.

These are presentation changes only. Scoring rules, scoring handlers, persistence and live/spectator implementation are unchanged.

## Acceptance checklist

- [x] Team-colour keys/labels and seam mark pass contrast bounds: round-2 rendered samples plus engine assertions; round-3 picker/board proves the chosen yellow pair. Prior blue/yellow minima: label 4.63:1, numeral 8.02:1. The selected yellow board labels measure 12.84:1.
- [x] Undo stays visible within thumb reach and says what it restores: y=574–630 on compact scoring boards, including the round-2 banner matrix, quick setup/remount and Test. An open wicket modal intentionally covers the bar; that is expected modal behaviour, and Undo becomes accessible when the modal closes. The innings-break reverse-path gap is an excluded follow-up below.
- [x] Every named board state and in-scope transition/reverse path has evidence: prior runs/extras/wicket/swap/Finish/handoff walks plus round-3 setup/remount, full options, Test declaration/cancel/Undo and draw/cancel/finish. The completed draw has no engine-provided Undo.
- [x] The scoring zone fits 360 x 640 without scrolling: round-2 banner combinations and handoff; round-3 quick and Test documents are exactly 360 x 640 with Undo wholly visible.
- [x] Light and dark: the 13-state matrix below; Test Lead/Trail re-captured after the grid change at 360 x 640 and 390 x 844 light, plus 390 x 844 dark.
- [x] Touch targets >=48px and draft restore: full guided/Test options, compact keys, confirm/cancel and result-return targets measured. Real guided remount previously restored 105/0 then Undo to 101/0; new picker-created quick draft remount restores 4/0 and both colours. Automated persistence/terminal-hydration coverage passes separately; a full browser-process restart is deferred below.
- [x] Quick setup colours appear on the board and persist: Yellow/Green picker → Start cricket → yellow batting hero/keys → saved draft → route remount, shown in the three quick PNGs above.

## Prior matrix, with affected Test images refreshed

Before images remain [390 x 844](before-390.png) and [360 x 640](before-360.png). Round 2 fixed compact guided Undo clipping and 98px of empty handoff scroll by moving powerplay into the batting identity row and removing the nested handoff viewport minimum. Those banner states are retained; the Test rows use round-3 product source. At 390 x 844, Undo is y=778–834.

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



Additional historical evidence: [guided save/remount/Undo](after-restore-light-360x640.png). The prior walk covered all 12 run/extra keys followed by Undo, wicket/Bowled/new batter/Undo, swap twice, options/scorecards, guided Finish and innings-1-to-break handoff. Those actions remain in `browserWalk` in measurements.json and are not claimed as new round-3 actions.

## Validation

- Three regressions demonstrated red before their UI fixes and green afterwards.
- Final focused checks on the rebased tree: 6 files / 68 tests passed (guided board, quick cricket board, shared team colours, Test innings/completion and cricket finish navigation).
- Both round-3 product commits passed lint (0 errors, 29 existing warnings), type-check and agent-config sync checks; no hooks bypassed.
- A broad run was stopped before the second rebase and is not passing evidence. Final full-suite and push-gate results are recorded in the PR body after they finish.

## Linked follow-ups

- Guided innings-break reverse/correction control: Forge `43e7ddce-0740-41c8-986f-e794cb43a7c4`. This acceptance round does not fix it.
- Full browser-process restart: deferred; route remount is rendered evidence, and [cricket draft persistence](../../../src/designs/design1-mono/MonoQuickMatch.cricketBoard.test.jsx) / [terminal refresh persistence](../../../src/designs/design1-mono/scoring/CricketFinishNavigation.test.jsx) remain automated coverage. No full-process restart claim is made.
- SA-08 Test innings advance/Undo: Forge `8b0316bd-bcda-40b9-877a-f4188f5dd5dc`.
- Spectator cards: Forge `eda76029-9be1-467b-bcc9-b56a2bd57f53`; spectator files remain outside this PR.

Previously fixed findings: compact guided Undo clipping (`c55d7bd5-e98d-42d3-9b6c-e2520f3f8d57`) and handoff empty scroll (`05c2ba52-6492-47bb-bea1-bf60d600093d`).

Additional historical evidence: [guided save/remount/Undo](after-restore-light-360x640.png). The prior walk covered all 12 run/extra keys followed by Undo, wicket/Bowled/new batter/Undo, swap twice, options/scorecards, guided Finish and innings-1-to-break handoff. Those actions remain in `browserWalk` in measurements.json and are not claimed as new round-3 actions.

## Validation

- Three regressions demonstrated red before their UI fixes and green afterwards.
- Final focused checks on the rebased tree: 7 files / 89 tests passed (guided board, quick cricket board, shared team colours, Test innings/completion, cricket finish navigation and quick setup). The badminton-neutral setup fixture was switched to table tennis, as requested after #190 landed.
- Both round-3 product commits passed lint (0 errors, 29 existing warnings), type-check and agent-config sync checks; no hooks bypassed.
- A broad run was stopped before the second rebase and is not passing evidence. Final full-suite and push-gate results are recorded in the PR body after they finish.

## Linked follow-ups

- Guided innings-break reverse/correction control: Forge `43e7ddce-0740-41c8-986f-e794cb43a7c4`. This acceptance round does not fix it.
- Full browser-process restart: deferred; route remount is rendered evidence, and [cricket draft persistence](../../../src/designs/design1-mono/MonoQuickMatch.cricketBoard.test.jsx) / [terminal refresh persistence](../../../src/designs/design1-mono/scoring/CricketFinishNavigation.test.jsx) remain automated coverage. No full-process restart claim is made.
- SA-08 Test innings advance/Undo: Forge `8b0316bd-bcda-40b9-877a-f4188f5dd5dc`.
- Spectator cards: Forge `eda76029-9be1-467b-bcc9-b56a2bd57f53`; spectator files remain outside this PR.

Previously fixed findings: compact guided Undo clipping (`c55d7bd5-e98d-42d3-9b6c-e2520f3f8d57`) and handoff empty scroll (`05c2ba52-6492-47bb-bea1-bf60d600093d`).
