# Board G3a: set point and match point

Decisions needed: none.

The team-colour sets board names the team whose next point can end the set, or the match. Badminton reuses its existing Game unit; table tennis keeps the board's existing Set unit. When either team can win the current unit, it says “Next point wins the game/set”; it says “match” only when both teams can win the match.

The pure `getSetPointState` helper in `src/utils/quickMatchSets.js` probes the scorer's existing completion predicates. Best-of formats reuse `getSetWinRule` and `isSetComplete`; single formats reuse `validateSingleSetScore`. It returns per-team set and match opportunities, with no persisted cue state. Points, completion, serve, Undo and persistence handlers are unchanged.

## Evidence and method

Rung 4: executable tests. Rung 5: the real `MonoQuickMatch` and board rendered in T3 `html_preview`, with local draft fixtures and mocked auth/Convex/broadcast transport. These are browser app demonstrations, not a connected production or physical-device claim. Vite also ran on the assigned port 5201. Every image below came from self-contained inlined app bundles and fonts, in exactly sized iframe viewports. Batched T3 PNGs were losslessly cropped to each individual viewport using Sharp; every PNG dimension was read back. No standalone browser or `preview_open` was used. The untracked harness stays in `.kit-g3a/`.

Before modules came from `origin/master` (`4145887c87a42088a0b6a590a1f7e4cc72dfbafd`): the real master scorer and TeamSetsBoard, rendered with the same fixtures. Six before images cover all three sports at both sizes. There are 36 distinct PNGs in this folder.

## Acceptance walked

- [x] Team keys and labels pass `contrastReport`, including the sport mark and sheen. The existing volleyball, badminton and table-tennis board suites passed unmodified. Every rendered fixture reported zero contrast failures.
- [x] Undo remains visible in the bottom thumb zone and names its destination. At 360×640 it is y=562–622, 253×60px; at 390×844 it is y=766–826, 283×60px. Point/Undo traces below demonstrate the cue and score reversing together.
- [x] Volleyball 24–22 set point; 2–1 sets and 24–22 match point; Undo back to 23–22 removes both cues; 14–13 in the deciding fifth set reads match point and a 15-point target. Pure tests also cover 25–24 and 24–24 without a cue.
- [x] Badminton 20–19 game point; 29–29 says “Next point wins the game”. A winning point advances to 0–0 in Game 2; Undo restores 29–29 and the cue. Undo from 29–29 to 28–29 correctly leaves game point for Strikers. Pure tests cover 20–20, 29–28, both teams' independent match stakes, and the 30 cap.
- [x] Table tennis 10–9 says Set point to match “Set 1”. 10–10 has no cue; a point produces 11–10 and Set point, and Undo removes it.
- [x] Single formats in all three sports say Match point. Pure tests include selected 7-point targets as well as configured sport targets.
- [x] The scoring zone fits at 360×640 and 390×844. Every rendered document's scroll width/height matched its viewport; the smallest key was 161×389.09px. No visible button was smaller than 48×48px.
- [x] Light and dark. The cue uses warning tokens with 1% existing ink mixed into its foreground: the unmixed light pair is 5.998:1; the rendered cue is **6.087:1 light and 8.326:1 dark**, exceeding 6 without rounding or changing shared tokens.
- [x] Draft restore recomputes the same cue in all three sports after a point and remount of the saved draft; tests also Undo after remount. No cue is stored.
- [x] Setup's picked team colours reach the board: the Purple/Yellow picker walk renders cores `#6838c6` and `#facc15`; seeded fixtures keep their own engine-derived `#6938c6` and `#fbbf24`. Existing colour/serve tests remain green.
- [x] Finish opens the existing confirmation with Set 1, 24–22; End match reaches the existing saved result. No cue remains on the result.

## Tests

Tests were written and run red before implementation: missing helper/cue assertions failed. Final focused run: **7 files, 217 tests passed**, including **37 new tests** (26 pure derivation and 11 real-board tests), the three existing board suites, the existing sets engine suite and the palette ratchet. Full suite: **156 files, 2,012 passed, 7 expected fail (2,019 total), after rebasing onto current master**. No test or hook was skipped. Lint: 0 errors, 29 pre-existing warnings. Type check passed. The palette baseline was not raised.

## Rendered transition traces

- **after-badminton-cap-undo-360-light:** mounted: 29–29 / Next point wins the game → winning point: 0–0 / no cue → Undo game win: 29–29 / Next point wins the game.
- **after-badminton-cap-undo-out-360-light:** mounted: 28–29 / Game point · Strikers → point Royals: 29–29 / Next point wins the game → Undo: 28–29 / Game point · Strikers.
- **after-badminton-restore-360-light:** mounted: 19–19 / no cue → point Royals: 20–19 / Game point · Royals → remount saved draft: 20–19 / Game point · Royals.
- **after-badminton-setupwalk-360-light:** mounted: result / no cue → setup colours to board: 0–0 / no cue.
- **after-badminton-undo-out-360-light:** mounted: 19–19 / no cue → point Royals: 20–19 / Game point · Royals → Undo: 19–19 / no cue.
- **after-tabletennis-deuce-undo-360-light:** mounted: 10–10 / no cue → point Royals: 11–10 / Set point · Royals → Undo: 10–10 / no cue.
- **after-tabletennis-restore-360-light:** mounted: 9–9 / no cue → point Royals: 10–9 / Set point · Royals → remount saved draft: 10–9 / Set point · Royals.
- **after-tabletennis-undo-out-360-light:** mounted: 9–9 / no cue → point Royals: 10–9 / Set point · Royals → Undo: 9–9 / no cue.
- **after-volleyball-enter-360-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Set point · Royals.
- **after-volleyball-enter-390-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Set point · Royals.
- **after-volleyball-finish-360-light:** mounted: 24–22 / Set point · Royals → Finish: 24–22 / Set point · Royals.
- **after-volleyball-finish-confirm-360-light:** mounted: 24–22 / Set point · Royals → Finish: 24–22 / Set point · Royals → End match: result / no cue.
- **after-volleyball-match-360-dark:** mounted: 23–22 / no cue → point Royals: 24–22 / Match point · Royals.
- **after-volleyball-match-360-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Match point · Royals.
- **after-volleyball-match-390-dark:** mounted: 23–22 / no cue → point Royals: 24–22 / Match point · Royals.
- **after-volleyball-match-390-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Match point · Royals.
- **after-volleyball-match-undo-360-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Match point · Royals → Undo: 23–22 / no cue.
- **after-volleyball-match-undo-390-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Match point · Royals → Undo: 23–22 / no cue.
- **after-volleyball-restore-360-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Set point · Royals → remount saved draft: 24–22 / Set point · Royals.
- **after-volleyball-undo-out-360-light:** mounted: 23–22 / no cue → point Royals: 24–22 / Set point · Royals → Undo: 23–22 / no cue.

## Screenshot inventory and measurements

Undo coordinates are relative to each phone frame. All 36 views had matching document/viewport dimensions, zero undersized visible buttons, and zero team-colour contrast failures.

| Screenshot | Viewport | Cue | Undo y–bottom (px) |
|---|---|---|---|
| [after-badminton-cap-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-cap-360-light.png?raw=true) | 360×640 | Next point wins the game | 562–622 |
| [after-badminton-cap-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-cap-390-light.png?raw=true) | 390×844 | Next point wins the game | 766–826 |
| [after-badminton-cap-undo-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-cap-undo-360-light.png?raw=true) | 360×640 | Next point wins the game | 562–622 |
| [after-badminton-cap-undo-out-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-cap-undo-out-360-light.png?raw=true) | 360×640 | Game point · Strikers | 562–622 |
| [after-badminton-cue-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-cue-360-light.png?raw=true) | 360×640 | Game point · Royals | 562–622 |
| [after-badminton-cue-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-cue-390-light.png?raw=true) | 390×844 | Game point · Royals | 766–826 |
| [after-badminton-restore-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-restore-360-light.png?raw=true) | 360×640 | Game point · Royals | 562–622 |
| [after-badminton-setupwalk-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-setupwalk-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [after-badminton-single-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-single-360-light.png?raw=true) | 360×640 | Match point · Royals | 562–622 |
| [after-badminton-undo-out-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-badminton-undo-out-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [after-tabletennis-cue-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-tabletennis-cue-360-light.png?raw=true) | 360×640 | Set point · Royals | 562–622 |
| [after-tabletennis-cue-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-tabletennis-cue-390-light.png?raw=true) | 390×844 | Set point · Royals | 766–826 |
| [after-tabletennis-deuce-undo-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-tabletennis-deuce-undo-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [after-tabletennis-restore-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-tabletennis-restore-360-light.png?raw=true) | 360×640 | Set point · Royals | 562–622 |
| [after-tabletennis-single-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-tabletennis-single-360-light.png?raw=true) | 360×640 | Match point · Royals | 562–622 |
| [after-tabletennis-undo-out-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-tabletennis-undo-out-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [after-volleyball-decider-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-decider-360-light.png?raw=true) | 360×640 | Match point · Royals | 562–622 |
| [after-volleyball-enter-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-enter-360-light.png?raw=true) | 360×640 | Set point · Royals | 562–622 |
| [after-volleyball-enter-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-enter-390-light.png?raw=true) | 390×844 | Set point · Royals | 766–826 |
| [after-volleyball-finish-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-finish-360-light.png?raw=true) | 360×640 | Set point · Royals | 562–622 |
| [after-volleyball-finish-confirm-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-finish-confirm-360-light.png?raw=true) | 360×640 | none | result |
| [after-volleyball-match-360-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-match-360-dark.png?raw=true) | 360×640 | Match point · Royals | 562–622 |
| [after-volleyball-match-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-match-360-light.png?raw=true) | 360×640 | Match point · Royals | 562–622 |
| [after-volleyball-match-390-dark.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-match-390-dark.png?raw=true) | 390×844 | Match point · Royals | 766–826 |
| [after-volleyball-match-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-match-390-light.png?raw=true) | 390×844 | Match point · Royals | 766–826 |
| [after-volleyball-match-undo-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-match-undo-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [after-volleyball-match-undo-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-match-undo-390-light.png?raw=true) | 390×844 | none | 766–826 |
| [after-volleyball-restore-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-restore-360-light.png?raw=true) | 360×640 | Set point · Royals | 562–622 |
| [after-volleyball-single-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-single-360-light.png?raw=true) | 360×640 | Match point · Royals | 562–622 |
| [after-volleyball-undo-out-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/after-volleyball-undo-out-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [before-badminton-cue-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/before-badminton-cue-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [before-badminton-cue-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/before-badminton-cue-390-light.png?raw=true) | 390×844 | none | 766–826 |
| [before-tabletennis-cue-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/before-tabletennis-cue-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [before-tabletennis-cue-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/before-tabletennis-cue-390-light.png?raw=true) | 390×844 | none | 766–826 |
| [before-volleyball-cue-360-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/before-volleyball-cue-360-light.png?raw=true) | 360×640 | none | 562–622 |
| [before-volleyball-cue-390-light.png](https://github.com/harshanandak/scoreeasy/blob/feat/sets-point-cue/docs/plans/2026-10-23-board-sets-point-cue/before-volleyball-cue-390-light.png?raw=true) | 390×844 | none | 766–826 |

## Follow-ups kept separate

- Reset 0–0 in the last-action line after a set/game win: `8d379415-fbe7-42c6-b760-a87c5af4e138` (older volleyball-specific report `0ba917ad-19c2-4e1c-85d9-833ff61499be`).
- Restore notice overlaps the header, visible in these fixtures: `0bc088ff-56cc-423d-a67a-3c40933c2168`.
- Badminton result chips say Set: `3624182d-848e-468f-b1c2-90c5dbf9d499`.
- Volleyball clock stays at 0:00: `match-clock-stays-at-49c8111d`.

Resolves the scope of Forge tasks `3a0dd547-a369-4924-9858-10dada6623f2` and `fb577c99-d82c-45c3-8899-d9de082fec87`. Live/spectator files are outside this diff.
