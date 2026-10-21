# Goals Finish and Back demo

Football tournament Finish used to push the tournament page above the scorer and its guard entries. Browser Back reopened the completed scorer. Completion now uses the existing app seam after saving successfully.

Captured in the running guest app at `http://localhost:5173`, CSS viewport and PNG dimensions 390×844. Before uses the goals scorer from master (28c4bdb); after uses the fix. Only local synthetic Red/Blue matches were scored. All eight screenshots were opened and inspected.

| Flow | After Finish | After browser Back |
|---|---|---|
| Tournament, before | [Completed tournament, 1–0](before-tournament-finish.png) | [Completed scorer reopened](before-tournament-back.png) |
| Tournament, after | [Completed tournament, 1–0](after-tournament-finish.png) | [Still the completed tournament](after-tournament-back.png) |
| Quick match, before | [Corrected result, 2–1](before-quick-finish.png) | [Result retained with leave warning](before-quick-back.png) |
| Quick match, after | [Corrected result, 2–1](after-quick-finish.png) | [Result retained with leave warning](after-quick-back.png) |

Goals quick matches use a different component and already finish in place. Their requested “before reopens the scorer” condition did not reproduce. Both quick demos restore a 3–1 draft, Undo to 2–1, Finish, confirm End match, then press browser Back. The saved result remains 2–1. The existing route-level guard still warns on leaving the result; that behavior is outside this goals tournament fix. No native Android proof is claimed.

[Before run evidence](before.json) and [after run evidence](after.json) contain the URL, heading, viewport, dialogs and saved quick scores at each step. The repository Chrome/CDP route-sweep harness was adapted temporarily to add the quick flow and capture intermediate screenshots. Missed controls are rejected. Each final run logged one blocked `navigator.vibrate` warning because CDP evaluated the click without a trusted hardware gesture; no application exception was logged.

Acceptance is parameterized over every registered goals-engine sport: football, basketball, hockey and kabaddi. Per sport, focused tests cover manual Finish, target score, timed completion, save failure on all three paths, provider-free replacement, restored Undo, tournament Back and quick-match saved-result preservation. The registry assertion excludes retired futsal, handball and rugby.

Focused validation: six files, 153 normal passes and 12 expected failures (165 total). The 12 markers are eight remaining routing findings and four stability-audit cases; none flipped unexpectedly. With master's scorer restored, all four tournament Back contracts fail at the scorer URL. Palette remains exactly 669 raw literals; no baseline or exclusion changes. Lint: zero errors, 29 existing warnings. Type-check: pass (`checkJs: false`, so JS/JSX is not type-checked).
