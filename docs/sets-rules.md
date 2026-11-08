# Sets scoring rules

New volleyball, badminton and table-tennis matches use `src/models/setsRules.js` in both quick match and tournament scoring. The scorer freezes a serializable `format.setsRules` snapshot at start, including its version, source edition, points, margin, cap, match length, deciding target, service policy and end-change thresholds. Resuming a match reads that snapshot rather than looking up the latest defaults.

The model checks a non-tied hard cap before the win margin. A new BWF 2025 badminton game therefore ends at 30–29. An ordinary 21–20 does not end the game. Custom formats can turn the cap off with an explicit `null`.

## Presets

| Choice | Rules |
| --- | --- |
| Quick casual | One set/game, initially 15 for volleyball or 11 for badminton/table tennis; editable using the existing format controls. |
| Custom school | The scorer's event settings. Check the competition circular; the app does not certify these as SGFI rules. |
| Official · FIVB indoor 2025–28 | Best of five, 25 points, deciding set 15, win by two, no cap, deciding end change at eight. |
| Official · BWF Laws 2025 | Best of three games, 21 points, win by two, cap 30, deciding end change at 11. |
| Official · ITTF Laws 2026 | Best of five games initially; event format can be customized. Games to 11, win by two, no cap, deciding end change at five. |

Each official option links to its source document in the rules controls. Editing an official target or match length marks the choice Custom school. Badminton stays on the 2025 edition; no unverified 2027 rule change is applied. Existing quick-match format defaults remain available; choosing a named preset explicitly applies its settings.

## Team-level service

The scorer can choose a first server or leave **Server unknown**. Unknown service produces no team serve marker or fabricated spectator team. The model tracks teams, not a doubles player's position or identity.

- Volleyball and badminton give the next serve to the rally winner. Volleyball retains a separate side-out mode; the serving team must be chosen before scoring a side-out rally.
- Badminton starts the next game with the previous game's winner.
- Table tennis serves every two points, and every point after deuce. First service alternates between games. An unrecorded first server remains unknown until recorded.
- Manual mode changes service only when the scorer records it. Volleyball asks for each new set's first server; this also covers a fresh deciding-set toss without inventing its result.

Service can be recorded in match options (or the classic tournament controls). The score, per-set first server, current service and side placement are captured together in undo history and drafts. Crossing the configured deciding threshold changes ends; crossing it in reverse through a correction reverses the change. A point correction cannot reconstruct an unknown rally winner, so winner-serve becomes unknown until the next rally or a manual record.

The configured end change applies in the last possible game, including a one-game match. A single table-tennis game therefore changes ends at five and Undo reverses that change. Side-out pressure cues offer a game/match point only to the serving team. Both single- and multiple-game broadcasts include the Game/Set unit.

Tournament completion repair reads each match's frozen `setsToWin`, so an individually customized match can be longer or shorter than the tournament default. New tournament scorers initialize and restore their active scoring mode from the same frozen snapshot, including inherited side-out mode.

## Saved-match compatibility

Unversioned in-progress drafts and scored tournament matches migrate to a frozen **version 0** compatibility snapshot. Their existing targets, service behavior and cap ordering are retained. In particular, an old tournament badminton draft retains the old margin-before-cap behavior and every-point service; an old quick table-tennis draft retains untracked service. This is deliberate compatibility with the task's requirement that saved matches keep their behavior, not a claim that those old rules are correct. New matches use version 1. Starting a rematch creates a new version-1 snapshot.

Tennis and throwball are outside this implementation. Tennis continues through its existing separate scorer. The independent historical volleyball event-replay model is not used to infer service for the active snapshot watch.

## Validation record

The test-only commit is `7fcf30f62244fc1eeeccf6caf10d93797d22b98c`. [Hosted CI](https://github.com/harshanandak/scoreeasy/actions/runs/42504511905) failed the 30–29 completion and tournament winner-serve regressions. The undo control passed. This is rung 4 executable evidence, not a live-match reproduction. No local tests were run; local validation is lint and type-check only.

Before/after screenshots are unavailable: the T3 integrated browser disconnected during both navigation and open, then timed out during snapshot. Both created tabs were closed and the dev server was stopped. The new setup and service controls have not been visually verified; this draft is not merge-ready.

During review follow-up, a production build and Vite preview replaced the dev server for capture. Both permitted T3 navigation attempts timed out after 15000 ms. Capture retries stopped after those two attempts; the preview tab and server were closed. Screenshots of the setup summary, service/unknown-server boards, pressure cue and spectator label remain unavailable.
