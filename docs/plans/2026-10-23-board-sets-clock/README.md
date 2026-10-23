# Sets scorer clock regression evidence

Decisions needed: none.

The quick-match clock now ticks through React StrictMode's effect replay and
resumes when another sport's draft is restored in the same scoring component.
The goals countdown uses the same hook and is covered by the fix. An expired
countdown remains paused, including after a sport switch.

## Root cause

The app mounts under StrictMode (`src/main.jsx`). `useTimer` initialized its
mounted ref once, then set it false in effect cleanup without resetting it in
effect setup. StrictMode's setup/cleanup/setup replay therefore left a mounted
timer whose interval rejected every tick. Independently, draft hydration restored
the timer with `running=false`, relying on the phase effect to start it. Switching
between sport drafts while phase stayed `scoring` never ran that phase effect.
Restoring the running state also requires the existing goals time-up effect to
observe `timer.isRunning`, so an already-expired draft is paused again.

## Fake-timer proof (evidence rung 4)

All tests use the real hook. Scorer integration tests mount the real component
and boards under StrictMode, mocking storage and external services only.

Command:

```sh
bun run test src/hooks/useTimer.test.jsx src/designs/design1-mono/MonoQuickMatch.clock.test.jsx --maxWorkers 1 --no-fileParallelism
```

- Final implementation: **14 passed**.
- Original `origin/master` code (1303745), injected through a temporary Vite
  loader without changing tracked files: **13 failed, 1 passed**. Failures include
  fresh `0:00` instead of `0:03`, restored `18:00` instead of `18:02`, and goals
  `0:05` instead of `0:04`. The already-expired goals compatibility case passes.
- Lifecycle fix alone, with the original scorer: **1 failed, 13 passed**. The
  remaining failure is same-component sport restore: `1:00` instead of `1:02`.
- Before adding the goals pause dependency, the expired-to-expired sport-switch
  regression failed with one active interval instead of zero; the final fix passes.

## Acceptance walked

| Requirement | Evidence |
| --- | --- |
| Fresh volleyball, badminton and table tennis clocks advance | Three StrictMode integration cases: `0:00` to `0:03` |
| Restore after 18 minutes and continue | Three cases: `18:00` to `18:02`, then a scoring save snapshots 1082 seconds |
| Finish-cancel | Existing behavior preserved: the live clock runs while confirmation is open and after Keep scoring |
| Undo | Score returns to zero while elapsed stays at `18:02`, then continues |
| Result stops the timer | Saved duration is 1086 seconds; after result timeouts settle, no timer remains |
| Rematch | Resets to `0:00` and advances to `0:01` |
| Same-component sport restore | Volleyball to badminton: restored `1:00` advances to `1:02` |
| Older draft | A draft with only `timerElapsed: 42` restores `0:42` and advances to `0:43` |
| Refresh preserves score and Undo | Save at `18:02`, unmount for two minutes, restore `20:02`, Undo score, tick to `20:03` |
| Goals countdown | Runs down, survives Finish-cancel and Undo, pauses and locks at zero |
| Expired sport restore | Football to kabaddi with expired clocks leaves no active interval |
| No per-second draft saves | Draft-save call count stays fixed across idle ticks; scoring snapshots current elapsed |
| Hook cleanup | Pause/resume, reset and interval removal on unmount are asserted |

## Shared board checklist

- Team-colour contrast and marks: existing engine/board tests remain the relevant
  automated checks; no colour or mark code changed.
- Undo visibility and restore hint: existing board-shell/sets-board tests cover
  rendering; the new integration tests exercise actual Undo and restored history.
- Clock transitions: every transition above has fake-timer proof.
- 360 by 640 fit, light/dark appearance and 48px targets: no new rendered
  measurement is claimed. This behavior-only fix changes no JSX layout or CSS.
- Refresh restoration: covered by the new saved-draft round trip.
- Setup team colours on the board: existing `MonoQuickMatch.teamColour` and
  per-sport board tests cover this path; no colour persistence fields changed.

The task-specific brief makes screenshots optional because a frozen screenshot
cannot prove ticking. No screenshots or live-system verification are claimed.
Scoring rules, elapsed persistence fields and the per-second autosave policy are
unchanged. No follow-up bug was identified within this scope.

## Final validation

- Rebased cleanly onto the restore-notice change on master (05b6ea6).
- Frozen final full run: `bun run test --maxWorkers 4` — **160 files passed,
  2044 tests passed and 7 expected failures**, in 373.71 seconds.
- Rebased focused run: **242 tests passed across 9 files**, including the 14 new
  clock regressions, restore-notice tests, team-colour tests, per-sport boards,
  goals board and palette ratchet.
- `bun run lint`: exit 0, no errors, 29 existing warnings in untouched files.
- `bun run type-check`: exit 0. Normal commit hooks also passed.
- Vite started on port 5204; its HTTP entry point returned 200. This verifies
  startup only, not ticking in a live browser.
