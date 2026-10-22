# Board G1: cricket scoring screen

Decisions needed: none. Browser acceptance is pending.

Cricket scoring now uses the shared board header and thumb bar, batting-team colour, the cricket seam mark, and flat run keys with the Mono control edge and shadow. Guided figures still come from the delivery engine; tournament and quick scorers retain their existing aggregate state. Test innings retain declaration and draw actions.

## Evidence

The before images below render the engine-seeded guided scorer from master (1ccbb24). They were captured in the integrated T3 preview before the screenshot-method update.

- [Before, 390 x 844](before-390.png)
- [Before, 360 x 640](before-360.png)

After images are **pending**. Both attempts with the requested `html_preview` iframe method returned: "the page did not finish loading within 20 seconds." The attempts used the local Vite server on port 5191 at the requested widths. No standalone browser was launched. This does not establish viewport fit, rendered touch dimensions, or light/dark visual acceptance.

## Shared acceptance checklist

| Item | Evidence and status |
| --- | --- |
| Team labels and mark contrast | Automated: `contrastReport` over distinct, clashing, bright and deep team pairs; shared palette ratchet. Rendered inspection pending. |
| Undo always visible, reachable, restore hint | Automated: shared bar, disabled initial state, actual guided/tournament/Test restore hint, illegal-delivery correction and Power-mode access. Thumb position pending browser verification. |
| Every G1 state and reverse path | Engine/component tests exercise run keys, all extras, wicket flow, partnership, bowler figures/quota, chase, FREE HIT, Last Man, powerplay and innings transitions. Full browser walk pending. The existing guided innings-break correction gap is a follow-up. |
| Scoring zone fits at 360 x 640 | Pending. The compact CSS is implemented; no passing rendered measurement is claimed. |
| Light and dark | Token-based implementation and contrast tests; after screenshots and visual inspection pending. |
| Targets at least 48 px; refresh restore | Scoped minimum sizes are implemented. Persistence tests cover restore and undo; rendered target measurement pending. |
| Setup team colours appear on the board and remain in saved state | Registry opt-in, engine-derived CSS variables and draft/refresh test coverage. Picker-to-board browser walk pending. |

## G1 walkthrough to finish in the integrated browser

At both 390 x 844 and 360 x 640: limited-overs mid-innings; chase (runs/wickets, overs, CRR, NEED/OFF and RRR); striker/non-striker and bowler figures; partnership and current-over future slots; DOT/1/4/6/W; other runs 2/3/5/7; Wide/No-ball/Bye/Leg-bye; wicket sheet; score/undo; swap strike; options; powerplay; Last Man Batting; FREE HIT; Target; innings break; Test Nth Innings with Lead/Trail, declaration and draw; tournament scorer's lean key set; Finish; refresh restore. Repeat a representative chase and FREE HIT in dark mode. Undo is exercised where the existing scorer allows it; terminal completion locks are preserved.

## Scope

The scoring callbacks, scoring rules, completion locks, storage writes, draft restore, and live outbox are unchanged. Shared scorecard components accept optional rows from the guided engine; delivery-based callers keep their original default path. Spectator and `live/` files are outside this PR.

## Validation and follow-ups

Final command results, issue references and PR evidence are recorded in the PR body. SA-08 remains linked: `8b0316bd-bcda-40b9-877a-f4188f5dd5dc` (Test innings advance timer can override Undo).

Follow-ups: spectator cards (`eda76029-9be1-467b-bcc9-b56a2bd57f53`); guided innings-break correction (`43e7ddce-0740-41c8-986f-e794cb43a7c4`).
