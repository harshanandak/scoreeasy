Decisions needed: none.

Basketball now uses the shared team-colour goals board with its registry +1/+2/+3 actions and the existing scorer rules.

![Basketball before, 360×640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-basketball-early-360x640-light.png?raw=true)
![Basketball +3, 360×640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-three-360x640-light.png?raw=true)
![Basketball dark, 390×844](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-early-390x844-dark.png?raw=true)
![Basketball saved win, 360×640](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-win-360x640-light.png?raw=true)

## Acceptance walkthrough

- [x] Team-colour keys and labels: contrastReport passes black/yellow, orange/blue, and white/white, including the engine's hypothetical mark overlays. Minimum label contrast across black/yellow plus the basketball identity is 5.39:1; black normalizes to #383838. Decision 3=A: the real basketball mark appears only on the sport chip beside the clock, never a team key. (Rung 4 tests; rung 5 rendered chip.)
- [x] Undo stays in thumb reach and names its destination: +3 shows “back to 52–49”; other-team +2 shows “back to 55–49”; correction and swapped-side hints agree with the visual score order. Undo measures 253×60 at y=566–626 on 360×640, 283×60 at y=766–826 on 390×844. (Rungs 4 and 5.)
- [x] Every named state and reverse path: all six +1/+2/+3 actions → exact-value Undo; consecutive +3 retains button focus; +3 → other-team +2 → Undo both; correction → Undo; Finish → cancel; timer 39:48 → 39:47; expiry → stopped clock → Finish → saved Hoops 52–49 win; level 49–49 at expiry → enabled deciding score → lock at 49–51 → Undo back to playable 49–49; tied Finish rejected; saved +3 draft remount → Undo. No quarters, fouls, bonus, shot clock or new overtime phase. (Rung 4 tests; rung 5 inlined real scorer walkthrough. Tied-Finish rejection and swapped sides are covered by tests.)
- [x] 360×640 scoring zone fits without scrolling: document and board both 360×640; all scoring actions and Undo visible. 390×844 is also exact. (Rung 5 DOM measurements.)
- [x] Light and dark: black/yellow at both phone sizes, plus dark +3, level-at-expiry, and saved winner at 390×844. (Rung 5.)
- [x] Targets and restore: all visible basketball controls in the captured board, options and result states are ≥64px wide and ≥48px high; six score buttons are 139.5×48 at 360, 154.5×48 at 390. Real localStorage autosave is read on component teardown/remount; score, history and colours survive. The harness does not reload the browser document. (Rungs 4 and 5.)
- [x] Quick-setup colours persist to the board and draft: Black/Yellow picker → Start basketball → engine variables and saved colours asserted. (Rung 4.)
- [x] Shared-board regression: kabaddi, football and classic hockey before/after captures each have zero changed pixels at 360×640 light; shared scorer and volleyball tests pass unmodified except the explicit basketball opt-in expectations. (Rungs 4 and 5.)
- [x] Score bump and reduced motion: +1/+2/+3 bump only the scoring team's numeral; correction and Undo remove it. Reduced capture reports animation:none after applying the actual bundled prefers-reduced-motion rules through CSSOM. html_preview has no OS motion preference setting, so this is CSS media emulation, not a real OS preference toggle. (Rung 4 transitions; rung 5 rendered computed style.)

## Validation

Validation (rung 4): the full suite passed, 153 files / 1,959 passed / 7 expected failures. Focused goals/routing run: 175 passed / 4 expected failures. Basketball adds 14 cases, including three contrast pairs. Counterfactual against origin/master (f45df6b): 11 basketball cases fail, three pure engine contrast cases pass; implementation restored byte-for-byte. Lint: zero errors, 29 existing warnings. Type-check passes. Palette ratchet passes without changing its baseline.

## Capture method and limits

All 40 PNGs were captured only through T3 html_preview, with the real MonoQuickMatch and master-before version inlined as a Vite IIFE with bundled CSS/fonts. Auth and Convex are fixtures; no backend writes. The untracked .kit-g6 harness is not part of this PR. Vite also started on port 5196; screenshots use inlining because html_preview cannot reach localhost. Every saved PNG's dimensions were checked. Raw console measurements are in [measurements.json](./measurements.json).

## Follow-ups

Existing follow-ups, unchanged by this PR:
- Restore notice overlapping the header (0bc088ff-56cc-423d-a67a-3c40933c2168); the restore capture retains the notice.
- Half/period modelling (89ec1095-a7ea-4949-8a63-813fa8199920).
- Tournament adoption (c8fb66c6-b140-40d4-a30e-68a102cc84e4).
- SA-10 tournament clock/overtime refresh (134b5fe0-df42-4fe2-af45-2e1fb5924145).
- SA-08 delayed auto-finish/Undo (8b0316bd-bcda-40b9-877a-f4188f5dd5dc).

No new rules decision is needed: the current quick-match engine already permits a deciding score on a no-draw tie. No new follow-up was discovered in this change.

## Screenshot manifest

- [after-basketball-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-early-360x640-light.png?raw=true) (360×640)
- [after-basketball-win-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-win-360x640-light.png?raw=true) (360×640)
- [after-basketball-decider-undo-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-decider-undo-360x640-light.png?raw=true) (360×640)
- [after-basketball-two-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-two-360x640-light.png?raw=true) (360×640)
- [after-basketball-correction-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-correction-360x640-light.png?raw=true) (360×640)
- [after-basketball-three-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-three-360x640-light.png?raw=true) (360×640)
- [after-basketball-undo-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-undo-360x640-light.png?raw=true) (360×640)
- [after-basketball-timeup-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-timeup-360x640-light.png?raw=true) (360×640)
- [after-basketball-level-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-level-360x640-light.png?raw=true) (360×640)
- [after-basketball-decider-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-decider-360x640-light.png?raw=true) (360×640)
- [after-basketball-walk-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-walk-360x640-light.png?raw=true) (360×640)
- [after-basketball-restore-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-restore-360x640-light.png?raw=true) (360×640)
- [after-basketball-reduced-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-reduced-360x640-light.png?raw=true) (360×640)
- [after-basketball-three-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-three-390x844-light.png?raw=true) (390×844)
- [after-basketball-two-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-two-390x844-light.png?raw=true) (390×844)
- [after-basketball-early-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-early-390x844-light.png?raw=true) (390×844)
- [after-basketball-correction-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-correction-390x844-light.png?raw=true) (390×844)
- [after-basketball-timeup-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-timeup-390x844-light.png?raw=true) (390×844)
- [after-basketball-undo-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-undo-390x844-light.png?raw=true) (390×844)
- [after-basketball-decider-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-decider-390x844-light.png?raw=true) (390×844)
- [after-basketball-level-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-level-390x844-light.png?raw=true) (390×844)
- [after-basketball-win-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-win-390x844-light.png?raw=true) (390×844)
- [after-basketball-restore-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-restore-390x844-light.png?raw=true) (390×844)
- [after-basketball-walk-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-walk-390x844-light.png?raw=true) (390×844)
- [after-basketball-decider-undo-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-decider-undo-390x844-light.png?raw=true) (390×844)
- [after-basketball-options-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-options-360x640-light.png?raw=true) (360×640)
- [after-basketball-three-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-three-390x844-dark.png?raw=true) (390×844)
- [after-basketball-early-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-early-390x844-dark.png?raw=true) (390×844)
- [after-basketball-win-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-win-390x844-dark.png?raw=true) (390×844)
- [after-basketball-level-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-level-390x844-dark.png?raw=true) (390×844)
- [after-basketball-early-360x640-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-basketball-early-360x640-dark.png?raw=true) (360×640)
- [before-basketball-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-basketball-early-360x640-light.png?raw=true) (360×640)
- [before-basketball-early-390x844-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-basketball-early-390x844-light.png?raw=true) (390×844)
- [before-basketball-early-390x844-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-basketball-early-390x844-dark.png?raw=true) (390×844)
- [before-football-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-football-early-360x640-light.png?raw=true) (360×640)
- [before-kabaddi-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-kabaddi-early-360x640-light.png?raw=true) (360×640)
- [after-kabaddi-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-kabaddi-early-360x640-light.png?raw=true) (360×640)
- [before-hockey-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/before-hockey-early-360x640-light.png?raw=true) (360×640)
- [after-hockey-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-hockey-early-360x640-light.png?raw=true) (360×640)
- [after-football-early-360x640-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/board-g6-basketball/docs/plans/2026-10-23-board-basketball/after-football-early-360x640-light.png?raw=true) (360×640)
