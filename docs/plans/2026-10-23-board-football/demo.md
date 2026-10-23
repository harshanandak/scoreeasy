# Football board evidence

Decisions needed: none.

Football quick match now uses the shared team-colour goals board. The full team key adds one goal; the correction lives in Match options, and Undo stays at the bottom with the score it restores. Only football opts in. The existing scoring, clock, history, local draft writer, result writer and broadcast paths remain responsible for match state.

## Evidence boundary

Rung 4: real-component tests and the full local suite. Rung 5: the real app components rendered through T3 html_preview with the app bundle and fonts inlined, fixture auth/Convex, and real browser localStorage. Vite also ran on port 5195. These captures are local fixture evidence, not a cloud-sync or deployed-device claim. No Chrome process or preview_open was used. The capture harness stays untracked in .kit-g5/.

Before: origin/master's MonoQuickMatch and registry captured before football opted in. After: the G5 implementation, rebased onto master including table tennis (a095e8e). The three regression pairs use identical fixtures; raw decoded pixel buffers are identical for Kabaddi, basketball and hockey at 360x640.

## Acceptance checklist

- [x] Team labels pass contrastReport for black/yellow, green/blue and white/white pairs, including the football identity mark surfaces. The rendered fixture's worst ratio divided by its required minimum is 1.04648. The football ball appears only on the sport chip.
- [x] Undo is always visible on the board and says the previous score. At 360x640 it is 253x60 at y=566..626; at 390x844 it is 283x60 at y=766..826. Goal: 3-2 -> 4-2 -> Undo 3-2. Correction: 3-2 -> 2-2 -> Undo 3-2. Swap keeps score and colour with the team.
- [x] Existing states walked: running countdown (9:48 -> 9:47), a goal for either team, repeated goals without replacing the focused key, correction, Undo, side swap, Full Time, Finish cancellation, drawn Finish with zero winner cards, and won Finish with one winner card. Free and points-target modes remain covered by component tests. No half-time or OT states are invented.
- [x] Scoring zone fits without scrolling: document and board are exactly 360x640 / 390x844 with no horizontal overflow. The whole-key targets measure 159.5x404.64 / 174.5x598.64 at rest.
- [x] Light at both phone sizes, plus dark at 390x844 for early match, goal, options, drawn Finish and won Finish.
- [x] Every visible control is at least 48x48: Finish and sheet Done 48px high; Undo/More 60px; correction, swap and discard rows 54px. Result actions are 48px or 56px. This resolves the classic scorer's 40px correction and 46px bottom-action problem.
- [x] Draft restore: score 4-2, two history entries and picked black/yellow colours survive a localStorage-backed unmount/remount; Undo then restores 3-2. Expired draft restoration is also tested. The setup test actually picks Yellow/Blue, starts football and checks board variables against the saved colours.
- [x] Reduced motion: the existing CSS reduce clause was forced active in the inlined fixture, along with matchMedia, and the goal reports animationName=none. This is CSS preference emulation, not an OS-setting change. The last-action text remains available.

## Test results

- TDD: the initial football suite failed 10 cases on the classic scorer, then passed after opting in and extending the shared board.
- 15 football component tests cover colours/setup, countdown, whole-key scoring for either team, goal moments and focus, correction/swap/Undo, restored history, expired draft, draw/win Finish, Finish cancellation, free play and points-target completion, and contrast pairs.
- Updated the existing goals-board opt-out list to basketball/hockey and opened Match options before the existing football broadcast correction assertion. Existing Kabaddi and volleyball behavior assertions pass.
- Final rebased full suite: 152 files passed, 1946 tests passed, 7 expected failures (1953 total).
- Lint: 0 errors, 29 existing warnings. Type-check and agent-config-sync pass in normal pre-commit hooks. Palette ratchet passes with BASELINE unchanged.
- Normal pre-push hook: 61 test files passed, 871 passed and 6 expected failures (877 total). No bypass or retry.

## Follow-ups, deliberately deferred

- Shared half states: 89ec1095-a7ea-4949-8a63-813fa8199920 (comment added for football).
- Tournament goals-board adoption: c8fb66c6-b140-40d4-a30e-68a102cc84e4 (comment added for football). Tournament uses MonoGoalsLiveScore, a separate component.
- Restore notice overlaps header: 0bc088ff-56cc-423d-a67a-3c40933c2168.
- Tournament clock restore: sa-10-goals-tournament-134b5fe0.
- Existing auto-finish timer: sa-08-uncancelled-300-8b0316bd.
- Touch-target issue addressed by this PR: 2a2bc2bf-2061-4c64-aab6-7cd8eb0a6d4e.

## Screenshots

All 35 files below are original PNG output from html_preview, with dimensions checked. The walk image records the final state of its interaction sequence; the 390 walk also logs both-team goal/Undo, restored goal/Undo, swap, correction/Undo and Finish cancellation.

- [after-basketball-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-basketball-early-360x640-light.png?raw=true)
- [after-football-correction-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-correction-360x640-light.png?raw=true)
- [after-football-correction-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-correction-390x844-light.png?raw=true)
- [after-football-draw-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-draw-360x640-light.png?raw=true)
- [after-football-draw-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-draw-390x844-dark.png?raw=true)
- [after-football-draw-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-draw-390x844-light.png?raw=true)
- [after-football-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-early-360x640-light.png?raw=true)
- [after-football-early-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-early-390x844-dark.png?raw=true)
- [after-football-early-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-early-390x844-light.png?raw=true)
- [after-football-goal-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-goal-360x640-light.png?raw=true)
- [after-football-goal-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-goal-390x844-dark.png?raw=true)
- [after-football-goal-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-goal-390x844-light.png?raw=true)
- [after-football-options-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-options-360x640-light.png?raw=true)
- [after-football-options-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-options-390x844-dark.png?raw=true)
- [after-football-options-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-options-390x844-light.png?raw=true)
- [after-football-reduced-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-reduced-360x640-light.png?raw=true)
- [after-football-restore-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-restore-360x640-light.png?raw=true)
- [after-football-restore-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-restore-390x844-light.png?raw=true)
- [after-football-timeup-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-timeup-360x640-light.png?raw=true)
- [after-football-timeup-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-timeup-390x844-light.png?raw=true)
- [after-football-undo-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-undo-360x640-light.png?raw=true)
- [after-football-undo-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-undo-390x844-light.png?raw=true)
- [after-football-walk-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-walk-360x640-light.png?raw=true)
- [after-football-walk-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-walk-390x844-light.png?raw=true)
- [after-football-win-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-win-360x640-light.png?raw=true)
- [after-football-win-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-win-390x844-dark.png?raw=true)
- [after-football-win-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-football-win-390x844-light.png?raw=true)
- [after-hockey-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-hockey-early-360x640-light.png?raw=true)
- [after-kabaddi-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/after-kabaddi-early-360x640-light.png?raw=true)
- [before-basketball-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/before-basketball-early-360x640-light.png?raw=true)
- [before-football-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/before-football-early-360x640-light.png?raw=true)
- [before-football-early-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/before-football-early-390x844-dark.png?raw=true)
- [before-football-early-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/before-football-early-390x844-light.png?raw=true)
- [before-hockey-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/before-hockey-early-360x640-light.png?raw=true)
- [before-kabaddi-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g5-football/docs/plans/2026-10-23-board-football/before-kabaddi-early-360x640-light.png?raw=true)
