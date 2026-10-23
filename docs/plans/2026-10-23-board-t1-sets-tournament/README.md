# Board T1: volleyball tournament scoring

Decisions needed: none.

Volleyball tournaments now reuse the quick-match `TeamSetsBoard` and `BoardShell`. The independent registry flag is named `teamColourTournament`: `teamColour` already controls quick matches, and the separate flag lets each tournament sport migrate without changing its quick-match opt-in. Volleyball alone enables it. Badminton and table tennis keep the classic tournament presentation.

All scoring, serve rotation, correction, undo, tournament autosave, completion, knockout storage updates, Convex payload construction, broadcast/outbox calls, prompts and confetti remain in the existing scorer. Point cues ask its existing `checkSetComplete` predicate about the next point, including side-out eligibility. They do not import quick-match completion rules. The tournament volleyball win-by-two behavior beyond 30 is explicitly covered.

Evidence levels: **rung 4** for automated tests against real scorer/storage code; **rung 5** for the rendered real React components with local tournament fixtures and mocked auth/Convex/broadcast transport. This is rendered fixture evidence, not a production sync or device-haptics test. The Vite app also started on the assigned port 5205. No live system was written.

## Acceptance walk

| Item | Evidence |
|---|---|
| Shared team-colour board, volleyball only | `MonoSetsLiveScore.teamColour.test.jsx`: registry opt-in and board render; badminton/table-tennis classic-path checks. [Before](before-360.png), [after](after-early-360.png). |
| A point scores, autosaves and broadcasts | Real `saveSportTournament` / `loadSportTournaments` test verifies the draft and broadcast snapshot after a tap. |
| Refresh restores score and Undo | Unmount/remount test reloads real tournament storage, verifies the board score, then undoes to zero. Set-win test also remounts before Undo. |
| Set point, set won, next set | [Set point 360](after-setpoint-360.png), [390](after-setpoint-390.png); [next set 360](after-set2-360.png), [390](after-set2-390.png). Capture executes the winning tap; stored state is 25–20 completed, then 0–0 in set 2. |
| Undo out of set win | [360](verified-undo-360.png), [390](verified-undo-390.png). Capture executes point then Undo; stored state returns to set 1, 24–20, incomplete. |
| Match point, match win, explicit Finish | [Match point 360](after-matchpoint-360.png), [390](after-matchpoint-390.png); [won before Finish 360](verified-completion-360.png), [390](verified-completion-390.png); [saved result 360](result-360.png), [390](verified-result-390.png). Winning the point keeps Undo available until Finish, exactly as before. Finish records winner 1 in `knockoutMatches`, calls finalize once, and takes the existing result route. Tests also undo the match-winning point and cover Finish on an incomplete draft. |
| Every existing operator action remains reachable | [Options at 360](options-360.png). Tests exercise side-out serve changes, corrections, Swap, Live mounting, discard cancellation and confirmed discard. Existing completion-lock tests still verify failed-save retry and double-Finish protection. |
| Colour fallback and existing team colours | Tests compare board CSS variables with `deriveTeamColours` for both absent colours and existing team `color` records. Quick-match colour tests are unchanged. Tournament setup has no new picker. |
| Contrast with sport mark underneath | `contrastReport` tests both the default pair and existing team colours, including gradient stops, sheen and motif surfaces. Default key-label minimum is **4.686:1**. [Serving mark in dark mode](dark-serve-360.png). |
| Undo visible and within thumb reach | 360×640: **x=14, y=562, width=253, height=60, bottom=622**. 390×844: **x=14, y=766, width=283, height=60, bottom=826**. Set-win hint says `back to 24–20 · Set 1`. |
| No scoring-zone scroll at 360×640 | Board body height **640px**, horizontal overflow **false**, keys **161px** wide and **412.70–416.70px** tall. The 390 board is **844px** high with **176px** keys. The options sheet can scroll to its lower rows. |
| Light and dark; targets at least 48px | All captured new-board and options checks report no undersized visible buttons. Finish is 48px tall; Undo/More are 60px tall. [Dark 390](dark-390.png), [dark side-out 360](dark-serve-360.png). |
| Badminton unchanged | [Before](badminton-before-390.png), [after](badminton-after-390.png), plus classic-board assertions for badminton and table tennis. The classic board's existing 44px controls remain outside this volleyball-only change. |

## Old element → new location

| Old tournament-screen element | New location |
|---|---|
| Sport name and scorer heading | Header sport subtitle and the same accessible h1 |
| Team names and current scores | Header title plus the two team-colour point keys |
| Lead-coloured score treatment | Team identity gradients; the numeric score remains authoritative |
| Set number / single-set badge | Status line above the keys (`Set N of M` / `Single Set`) |
| Rally / Side-out toggle | Match options, using the same toggle handler |
| Serve dot when the scorer exposes serve | Serving label and sport mark on the serving key, using the same serving state |
| Live disclosure, consent, Share, Stop, errors/outbox | Same mounted `LiveBroadcastBar` in Match options; shared Live indicator in the header |
| Accessible score announcements | Shared board's polite score line and labelled point keys |
| Team-specific −1 corrections | Match options, with the same handlers and zero/lock disabling |
| Target and win-by rule | Header subtitle; full untruncated rule in Match options |
| Desktop keyboard hint | Match options; Q/P/U handlers unchanged |
| Completed-set history | Match options, with scores and named winners; tally also on status line |
| Undo | Persistent bottom bar, now with score and set restore hint |
| Swap | Match options |
| Discard and confirmation | Match options → existing application discard prompt |
| Finish | Header → existing save/completion handler; no new finish confirmation |
| Save warning | Board notice slot, with alert semantics |
| Set-won toast, confetti and result transition | Existing toast and effects; unchanged result route after Finish |
| Loading / missing-match recovery | Existing early-return surfaces |
| Bracket round name / “Match N of M” | Not rendered by the old scorer at the pinned base; this PR invents neither. Tournament context remains available through the new Back to tournament options row and existing app navigation. |

## Capture method and inventory

All 21 PNGs came exclusively from T3 `html_preview`, using a self-contained iframe at exactly 390×844 or 360×640. The untracked `.t1/` harness library-builds the real components as one IIFE, embeds gzip/base64 JS, CSS with viewport units converted to the fixture height, and inline fonts. Auth, Convex mutation transport and broadcast transport are local mocks. The real scorer, local tournament storage, completion hook, existing Live controls and result route run inside it. Captures that lacked completed-action audit output were discarded.

Before images import `git show origin/master:src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx` from base **b0a527acdb04cf9ebca9843869942f1731519245**, rather than a recreation of the old UI. `measurements.json` records layout, targets, contrast and stored-state observations. The old-board target list is truncated by the preview tool and is marked as such; no new-board check is truncated. Browser-blocked vibration in the earlier set-transition captures is a fixture limitation; no hardware-haptic claim is made.

The six board states (early, set point, set 2, undo, match point, completed before Finish) each have both sizes. The saved result and master-before board also have both sizes. Extra coverage is dark 390, dark side-out/serving 360, options 360, and badminton before/after 390.

`bun run evidence:compress docs/plans/2026-10-23-board-t1-sets-tournament` reduced the 21 PNGs from **1,942,223 to 409,206 bytes**. Each is **8,607–26,936 bytes**; dimensions were checked with Sharp. `bun run evidence:check origin/master` passes (also rerun after the evidence commit so the HEAD-based checker sees every image).

## Tests and follow-ups

The new test file contains 12 cases. TDD first run: **7 failures / 2 passes** after correcting the storage fixture key, before implementing the registry helper or board path. Existing historical presentation tests explicitly retain the supported classic path; quick-match tests are unchanged. Completion-lock and app-route tests update only accessible button names for the new board and retain their behavioral assertions.

`bun run test`: **164 files passed, 2,127 tests passed, 7 existing expected failures** (2,134 total). `bun run lint`: **0 errors, 29 existing warnings**. `bun run type-check` and `bun run build`: **passed**. Hook results are recorded in the PR description after execution. The initial full run exposed three old accessible-name selectors; those were updated. The next run exposed a discard fixture whose mocked navigation did not unmount the scorer; modeling real navigation fixed the fixture without changing product code. The final full run above passed.

- Tournament colour picker: Forge **ca4f8555-cf80-4755-b82a-861aace434e7**.
- Extract the rules currently mixed into `MonoSetsLiveScore`: Forge **a6a07f04-2d89-44fb-997b-6db7f2903aff**. No rules extraction or reconciliation is included here; the SA-12 volleyball decision remains in force.
