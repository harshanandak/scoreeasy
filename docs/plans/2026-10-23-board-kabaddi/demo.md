# Kabaddi board: verification and pending capture

The quick-match scorer now uses `TeamGoalsBoard` on the existing `BoardShell`.
Only Kabaddi opts in. Its registry supplies +1, Super Tackle (+2), and All Out (+2).
The raider already shipped in `sportMarks.js`; the board reuses it on the sport chip.
Football, basketball, hockey, tournament scorers and spectator views retain their existing paths.

## Engine boundary

At the inspected base (`0e7d3b702e524e32e62352cb8341d7601ee31947`), quick-match
Kabaddi has a total countdown and time-up lock, with no half state or half-time handoff.
`MonoGoalsLiveScore` derives half labels for football only. The board does not invent
Kabaddi half transitions or change timer, persistence, scoring, completion or undo rules.
It displays the current countdown and, when expired, “Time's up!” and “Full Time”.
Undo reverses a scoring action; it does not rewind elapsed time or reopen a committed match.

Follow-ups:

- Half states and an undoable half-time handoff: Forge `89ec1095-a7ea-4949-8a63-813fa8199920`.
- Separate tournament scorer integration: Forge `c8fb66c6-b140-40d4-a30e-68a102cc84e4`.
- Raid rules: existing `kabaddi-raid-engine-696a8cf7`.
- Tournament clock restoration: existing `sa-10-goals-tournament-134b5fe0`.
- Goals auto-finish timer: existing `sa-08-uncancelled-300-8b0316bd`.

## Automated acceptance walkthrough

`MonoQuickMatch.goalsBoard.test.jsx` drives the real quick-match component with mocked
storage, auth and live transport. It covers a running clock; every scoring action on
both teams and Undo; named All Out feedback; score correction and side swap; a saved
draft remount with colours/history; countdown expiry and refresh; locked score buttons
with score Undo still available; Finish cancellation and confirmation; points-target
completion; setup colour pickers; and all three goals sports staying on their old boards.
Contrast assertions call the real `contrastReport` for team keys and Kabaddi identity,
including the engine's mark-overlay surfaces and the black/yellow and same-colour pairs.

## Parent capture checklist — pending

No screenshots or rendered measurements were attempted, as required by the implementation brief.
Run `bunx vite --port 5192 --strictPort` and open `/kabaddi/quick` in the parent's
integrated preview. Capture master before and this branch after at 390×844 and 360×640
in light and dark. Save PNGs in this directory and link them in the PR using
`https://github.com/harshanandak/scoreeasy/blob/feat/board-g2-kabaddi/docs/plans/2026-10-23-board-kabaddi/<filename>.png?raw=true`.

- Pick both team colours in setup and verify they reach the board.
- Capture the running countdown, each +1/+2 action, All Out, and Undo back to the displayed score.
- Swap sides, correct a score, then Undo the correction.
- Refresh after scoring; compare scores, colours, clock and Undo history.
- At time up, dismiss Finish, undo the last score, then Finish and confirm the result.
- Check the scoring zone and Undo fit at 360×640 without scrolling and all targets measure ≥48px.
- Verify light/dark contrast and All Out with reduced motion enabled.
- Capture football to confirm its existing board is unchanged.
- Half-time and second-half captures remain blocked on the half-state follow-up above.

CSS specifies 48px minimum scoring buttons, 60px shell Undo/options controls, engine
colours for both themes, and disables All Out animation under reduced motion. These
source constraints are not a substitute for the pending rendered checks.
