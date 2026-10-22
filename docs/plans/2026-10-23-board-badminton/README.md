# Board G4: badminton scoring screen

Decisions needed: none.

Badminton now opts into the shipped team-colour sets board through its own registry entry. The board, completed-game history and Finish confirmation use **Game / Games** from `config.setLabel`. The existing shuttlecock mark and Serving tag follow the rally winner. Setup colours flow through the existing colour, draft and result paths.

Scoring callbacks, the 21-point target, 30-point cap, game completion, service handling, undo snapshots, storage and the live outbox are unchanged. Spectator and `live/` files are outside this PR.

## Acceptance evidence

The screenshots render the real `MonoQuickMatch` and shared board in a Vite library bundle. Auth and Convex are mocked; fixtures contain only synthetic teams. The bundle, CSS and fonts are inlined into a fixed-size iframe and captured with T3 `html_preview`. No browser was launched separately. The harness stays untracked in `.board-g4/`.

Before images use master's `MonoQuickMatch`, registry and `TeamSetsBoard`. Captures use 390 × 844 and 360 × 640. `measurements.json` records the browser console audits, including board and key bounds, Undo bounds, visible controls below 48 px, and contrast failures.

| Checklist item | Evidence |
| --- | --- |
| Team-colour labels pass with the sport mark underneath | `contrastReport` tests cover violet/yellow, black/yellow, red/blue and clashing violet/violet, including the engine's sheen and mark surfaces. Rendered audits report no failures. |
| Undo stays visible and says what it restores | Game-win images show `back to 20–19`; the actual Undo button restores Game 1, Games 0–0, 20–19 and its server. At 360 wide, Undo is 253 × 60 px and ends at y=622; at 390, it is 283 × 60 px and ends at y=826. |
| Named states and reverse paths | Early Game 1; 20–19 game-point boundary; score a game winner → Game 2 / Games 1–0; Undo back across that boundary; 20–19 match-point boundary; Finish confirmation and terminal 2–0 result. Component tests also cover deuce, both formats and the 30–29 cap. |
| Scoring zone fits at 360 × 640 | The board ends at y=640, the keys at y=548, and Undo at y=622. Keys are 161 px wide and about 417 px high. No horizontal overflow or scoring-zone scroll is needed. |
| Light and dark | Both light phone sizes plus a 360 dark board and dark Finish confirmation. Team gradients remain engine-gated in both themes. |
| Targets at least 48 px; draft restore | Rendered board audits report no undersized controls. The component test scores a game winner, saves the draft, unmounts/remounts, verifies Game 2 and the picked colours, then undoes to the original score and server. |
| Setup colours appear on the board | The integration test chooses Purple and Yellow using the actual picker, starts Single game and checks the board's engine-derived colour variables. Picked colours also survive draft restore and manual/automatic completion. |
| Volleyball stays unchanged | The existing volleyball board tests are unmodified and pass. The screenshot pair renders the same synthetic volleyball fixture through master's board and this branch's board; comparison is recorded below. |

Game-point and match-point **scores** are demonstrated. Their word cues are deliberately absent: the quick-match sets engine has no `pointState`, and the uncapped volleyball live model would mislabel badminton's cap. Service court, interval and deciding-game end-switch cues also await sport-owned state. The brief explicitly permits filing these instead of inventing state.

## Validation

- Initial TDD run against master: 6 failures in the original 11-test badminton group, before the board opt-in and labels were implemented.
- Final badminton group: **13 passing tests**.
- Full settled checkout: **145 files passed; 1,862 passing tests; 7 expected failures** (`bun run test --maxWorkers 4`).
- Lint: **0 errors, 29 existing warnings**. Type-check and agent-config sync pass. Commit hooks run normally.
- Palette ratchet and unmodified volleyball tests pass in the full suite. No palette baseline or raw product colour literal changed.
- An earlier full run overlapped a rebase and produced two stale-module LiveNowStrip failures. Its result is discarded. The isolated six-test rerun and subsequent settled full suite pass; the mistaken follow-up was corrected and closed.

PNG dimension verification, the final viewport audit and the volleyball pixel comparison are recorded with the screenshot inventory below.

## Follow-ups

- Game/match point derivation with the configured cap: `fb577c99-d82c-45c3-8899-d9de082fec87`.
- Service court, interval and deciding-game end-switch state: `f8d89046-d188-46c0-b221-d7f6704404a7`.
- Restored-draft notice overlaps the shared board header: `0bc088ff-56cc-423d-a67a-3c40933c2168`. The notice is preserved in the captures.
- Generic result chips still say Set 1 / Set 2: `3624182d-848e-468f-b1c2-90c5dbf9d499`. The scorer and Finish confirmation say Game / Games; result-screen wording is a separate display-model follow-up, preserved in terminal captures.
- Linked unchanged: SA-01 badminton tournament cap (`sa-01-badminton-tournament-b698365e`) and SA-12 volleyball rule decision (`sa-12-decision-volleyball-53d0d0ea`).

The parent badminton redesign (`2127094e-81ad-4255-9a76-9bb8696c5c19`) remains open.

## Final screenshot verification

All **25 PNGs** have exact requested dimensions. Every capture uses a fixed-size iframe, including 360 x 640 dialogs. Browser audits report no undersized visible controls or engine contrast failures on the new badminton board. The volleyball before/after pair has **zero differing RGBA channel bytes** with animations paused for the comparison; no product CSS is changed for that pause.

The normal pre-push hook passed **52 related files, 768 passing tests and 6 expected failures** before the evidence commit.

## Screenshot inventory

- [after-cap-360-light.png](after-cap-360-light.png)
- [after-early-360-dark.png](after-early-360-dark.png)
- [after-early-360-light.png](after-early-360-light.png)
- [after-early-390-light.png](after-early-390-light.png)
- [after-finish-360-dark.png](after-finish-360-dark.png)
- [after-finish-360-light.png](after-finish-360-light.png)
- [after-finish-390-light.png](after-finish-390-light.png)
- [after-finished-360-light.png](after-finished-360-light.png)
- [after-finished-390-light.png](after-finished-390-light.png)
- [after-gamepoint-360-light.png](after-gamepoint-360-light.png)
- [after-gamepoint-390-light.png](after-gamepoint-390-light.png)
- [after-gamewon-360-light.png](after-gamewon-360-light.png)
- [after-gamewon-390-light.png](after-gamewon-390-light.png)
- [after-history-360-light.png](after-history-360-light.png)
- [after-matchpoint-360-light.png](after-matchpoint-360-light.png)
- [after-matchpoint-390-light.png](after-matchpoint-390-light.png)
- [after-restore-360-light.png](after-restore-360-light.png)
- [after-setupwalk-360-light.png](after-setupwalk-360-light.png)
- [after-single-360-light.png](after-single-360-light.png)
- [after-undo-360-light.png](after-undo-360-light.png)
- [after-undo-390-light.png](after-undo-390-light.png)
- [after-volleyball-early-390-light.png](after-volleyball-early-390-light.png)
- [before-early-360-light.png](before-early-360-light.png)
- [before-early-390-light.png](before-early-390-light.png)
- [before-volleyball-early-390-light.png](before-volleyball-early-390-light.png)
