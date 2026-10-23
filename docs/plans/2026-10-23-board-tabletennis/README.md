# Board G8: table tennis scoring screen

Table tennis quick matches now use the shipped team-colour sets board. The product change is the table tennis registry opt-in. Score, set completion, save/restore, Undo, and the live outbox retain their existing handlers.

## Evidence and limits

The 31 PNGs in this folder were captured only through T3 `html_preview`, using a Vite library bundle of the real `MonoQuickMatch` component in exact-size srcdoc iframes. Auth and Convex are mocked; points, Finish, setup, local draft writes and remounts use the app code. This is rung 5 rendered local-app evidence, not a deployed-backend or spectator test. Each image is exactly 390x844 or 360x640. `measurements.json` records the console measurements for every capture.

The first table tennis before images use master at dispatch (167a74a). The final volleyball and badminton comparisons use rebased master (21661fb), with CSS animation/transition disabled equally on both sides to remove transient restore-toast entrance timing. Both pairs have **zero differing pixels**. The scoring board CSS and `TeamSetsBoard` are unchanged upstream; the shared bar's new optional accessibility labels keep the same defaults for sets boards.

## Acceptance walk

| Item | Evidence | Result |
| --- | --- | --- |
| Team labels over sheen and sport mark | Four engine colour pairs in `MonoQuickMatch.tabletennisBoard.test.jsx`: purple/yellow, black/yellow, red/blue, same-colour | `contrastReport` has no failures, including the modelled motif overlay. The bat-and-ball mask is wired; quick serve cues remain unavailable as described below. |
| Undo visible, thumb reachable, restore hint | `after-gamewon-360-light.png`, `after-undo-360-light.png` | Undo is 253x60 at y=562..622. After the set win it says `back to 10-9`; Undo restores 10-9 and Sets 0-0. |
| Early set | `after-early-390-light.png`, `after-early-360-light.png` | 8-6, Set 1, Sets 0-0. |
| Deuce score and Undo | `after-deuce-390-light.png`, `after-deuce-360-light.png`, `after-undo-deuce-360-light.png` | 10-10 stays in Set 1; point and Undo restore the tie. The tests also prove 11-10 is not complete. No invented Deuce label. |
| Set win and reverse path | `after-gamewon-{390,360}-light.png`, `after-undo-{390,360}-light.png`, `after-history-360-light.png` | 10-9 -> 11-9 opens Set 2 at 0-0 with Sets 1-0; options show completed Set 1; Undo restores the prior set. |
| Late set / match ending | `after-matchpoint-{390,360}-light.png`, `after-undo-late-360-light.png`, `after-finished-{390,360}-light.png` | Late Set 3 at 10-9, Sets 2-0; terminal point saves 3-0 with colours. The filenames identify the fixture, not a rendered Match point cue. Terminal result has no Undo, matching existing completion behavior. |
| Finish and cancel | `after-finish-{390,360}-light.png`, `after-finish-360-dark.png`, `after-cancel-finish-360-light.png`, `after-manual-finished-360-light.png` | Confirmation names the active set, set tally and 8-6 score. Keep scoring returns to the board; End match saves the result. |
| Draft restore | `after-restore-{390,360}-light.png` plus transition/remount tests | A real set-winning tap is saved, unmounted and remounted into Set 2, Sets 1-0 with the same colours and Undo hint. Tests undo after remount and assert the stored server remains intact. |
| Compact viewport | All 360px board captures | Board and document are 360x640 with no scoring-zone overflow; keys are 161px wide and at least 421px tall. Undo ends at 622px. |
| Light and dark | Early light at both sizes, `after-early-360-dark.png`, Finish dark | Neutral theme tokens change; team colours stay engine-gated. |
| Touch targets | All after-capture measurements | No visible button below 48x48, including Finish/options/result controls. Undo is 60px high. |
| Setup colours and formats | `after-setupwalk-360-light.png`, `after-single-360-light.png` plus setup tests | Purple and yellow chosen in real quick setup reach the board. Best of 5, Best of 7 and Single game are offered. The existing shared board says `Set 1` / `Sets 0-0`, or `First to 11` for single play; setup keeps its current `Single game` wording. |
| Volleyball / badminton unchanged | `before-volleyball-early-390-light.png` vs `after-volleyball-early-390-light.png`; equivalent badminton pair | Zero differing pixels per pair; existing sport tests remain unmodified. |

## Existing engine boundaries and follow-ups

- **Quick serve tracking** (81512a55-b1ef-4401-9c70-57bacb4aa0bd): quick scoring only updates/announces serve for volleyball and badminton. Table tennis's `serviceRotation: 2` is used by the tournament scorer, including every-point service at deuce, but not by `MonoQuickMatch`. Do not paint the stored/default server as a current server. G8 keeps it through save/restore/Undo but shows neither Serving nor a server mark. This brief item remains an engine follow-up.
- **Derived point labels** (fb577c99-d82c-45c3-8899-d9de082fec87): `quickMatchSets` computes completion, not `pointState`. The shared issue now records table tennis too. No Game point, Match point or Deuce words were added.
- **Classic quick sets removal** (bc22c306-95c0-4c99-8983-80b415f51bef): retain the path here. Audit tournament scoring first: `MonoSetsLiveScore` still uses its own classic arena and serve engine.
- Restore notice overlapping the header (0bc088ff-56cc-423d-a67a-3c40933c2168), the last-action line showing the new set's 0-0 after a set-winning point, and generic result chips saying Set (3624182d-848e-468f-b1c2-90c5dbf9d499) remain shared follow-ups. The captures show these existing behaviors.

## Preserved test guarantees

The former table-tennis classic-screen checks now test the team board: Discard only clears after confirmation, cancel keeps the match, danger styling remains, last action is in a polite live region, and live-sharing stays mounted when cloud auth is available and is absent offline. Reserving a fixed top live slot was specific to the classic layout; the shared board keeps that control mounted in its hidden options sheet instead. Registry opt-out coverage remains with an explicit test flag rather than assuming a real sport stays classic. The cricket PR's neutral-setup test similarly stubs the registry flag for that test only.

## Validation

- New board tests first failed on the classic implementation (8 failures), then all 14 passed after opt-in.
- Before rebase: full suite 147 files, 1,894 passing tests, 7 expected failures; focused board/hardening/colour 42 passing tests; palette/colour/badminton/tournament regression 183 passing tests.
- After rebase: board/hardening/colour/setup 63 passing tests, including the reproduced and repaired neutral-setup fixture.
- Lint: no errors (29 existing warnings). Type-check: exit 0. Commit hooks passed.
- Final full-suite and pre-push hook results are recorded in the PR body after completion.
