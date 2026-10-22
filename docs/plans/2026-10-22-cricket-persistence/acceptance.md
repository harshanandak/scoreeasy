Decisions needed: none.

# Cricket persistence

Guided cricket left the scorer after a failed final save and deleted its raw
innings on success. Test cricket's active Finish & save left an in-progress
record. These repairs use the existing completion hook and protected navigation
seam. They do not change the cricket rules or deploy Convex.

## Save contracts

Guided's child completion lock freezes an ended innings. The route's completion
lock commits the match only when local storage reports success. A failed match
save displays an alert and Retry save outside the frozen scorer. Retry uses the
same engine innings. Its winning delivery is also retained in the ordinary draft
when draft storage remains available, so refreshing can recover it. A browser
that rejects every write cannot durably store new balls; the scorer retains the
pending innings in memory and stays open.

Completed guided matches archive the first and second engine innings in
`guidedInnings`, ordered by `battingOrder`, before clearing `draftState`. Existing
aggregate-only records cannot recover historical deliveries; their missing first
innings is represented by null rather than invented data.

Test manual Finish snapshots the current innings, innings index, and follow-on
state. A naturally settled result wins; an unfinished match finishes as a draw.
Both quick and tournament storage use the same completed-result writer as natural
completion. Finalization and protected navigation occur only after local success.
A failed manual save leaves the scorer editable for Undo, another delivery, or
another Finish. Natural terminal results keep their existing locked retry screen.

## Acceptance checklist

- [x] Guided final save failure stays on the scorer and exposes an error and retry.
- [x] Guided terminal Undo cannot alter the winning innings after save failure.
- [x] Guided failed result save retains its winning draft across remount when draft writes succeed.
- [x] Guided retry stores the preserved winning delivery and exits exactly once.
- [x] Guided completion keeps both raw innings, player identifiers, extras, and deliveries while clearing the draft.
- [x] Guided opening lineup, first innings, break, remount, second lineup, chase and completion are walked with the real scorer.
- [x] Test active Finish persists completed status, timestamp, result and four innings in quick and tournament modes.
- [x] Test failed manual Finish stays editable; Undo and a replacement delivery precede a successful retry.
- [x] Existing natural completion, pending terminal recovery, completed hydration and protected Finish navigation remain covered by focused tests.
- [x] Current expected-failure inventory after the navigation decisions is **4 routing / 7 repository-wide**. Cricket persistence repairs convert no expected failures; the navigation guard fix converts RA-5 and its round-two persistence fix converts SA-07. Counts in dated validation runs below describe those historical heads.

## Counterfactual

Before production edits, the six tests in `CricketPersistence.test.jsx` ran against
the exact source from `origin/master` (61c729d). All six failed at the intended
assertions: guided wrongly navigated after a quota failure; guided's completed
record lacked raw innings; Test manual Finish retained in-progress status in both
storage modes; and failed Test manual Finish navigated in both modes. That run
took 33.44 seconds and rendered the real scorer components with real storage
utilities and localStorage. Only the Convex transport was mocked; storage quota
failure was injected at the browser storage boundary. This is evidence rung 4.

The first fixed run passed two files and 21 tests in 72.27 seconds. Final focused
validation, phone-size captures, and hook results are recorded in the PR.

The expanded counterfactual restored both production files from the same master
ref and ran the persistence and navigation files again: nine tests failed and
13 passed. See [the complete output](counterfactual.txt). Both fixed production
files were restored byte-for-byte afterward.

The broad focused run passed 24 files, with 421 passing tests and eight expected
failures; the new persistence file had two replacement taps rejected by the
scorer's debounce. Its clock is now controlled and advances before that tap.
The subsequent four-file run passed 27 tests in navigation and natural Test
completion; persistence and palette workers failed to start. That run is not
green. The PR records the normal pre-push hook separately, and CI `verify` owns
the full-suite result. No timeout, worker-start assertion, or gate was weakened.

## Running-app demo

These are running-app captures at exactly 390 by 844 CSS pixels, with synthetic
Alpha/Beta matches and external requests blocked. The collaborative preview and
fallback browser timed out; local headless Chromium captured the evidence.
The dev server was stopped after capture. This reaches evidence rung 5 for local
browser storage and navigation, not hosted Convex or public broadcast.

- Guided: [before the failed save](before/guided-failed-save.png),
  [failure remains on the scorer](after/guided-failed-save.png), and
  [retry completes the match](after/guided-retry-saved.png).
- Test tournament: [before the fix](before/test-tournament-failed-save.png),
  [failure stays editable](after/test-tournament-failed-save.png), and
  [retry saves the Undo correction](after/test-tournament-retry-saved.png).
- Test quick: [before the fix](before/test-quick-failed-save.png),
  [failure stays editable](after/test-quick-failed-save.png), and
  [retry reaches completed history](after/test-quick-retry-saved.png).
- [Before storage readback](before/evidence.json) includes the completed guided
  record without its archive. [After storage readback](after/evidence.json)
  includes both raw guided innings and both completed Test records after Undo.

Separate follow-ups filed during this work: legacy guided overs mapping
(`7c0ee44e`) and Forge's native-Bun/Vitest validation wrapper (`e302f676`).

The palette ratchet remains exact equality at 668. Historical counts in the
completion-lock audit describe its earlier heads and remain historical.

## Review: prove the tests detect the defects

The post-Finish regression enables the real desktop keyboard handler and proves
keyboard scoring works before Finish. Each later keyboard/tap attempt occurs one
second beyond the preceding attempt, outside the 150 ms debounce, and checks both
the visible score and completed stored innings. Its fixture keeps the chase open
so natural completion cannot supply a second lock that masks a broken Finish lock.

The retry regression checks Undo's visible zero-run, zero-ball state and disabled
Undo control, then records a dot. It checks the visible and draft zero-run,
one-ball innings before retry and the completed zero-run, one-ball innings after.

Both deliberately broken variants fail in tournament and quick modes (rung 4):

- Disconnect the scoring prompt's completion lock and bypass the innings lock:
  two failures, with visible runs expected 1 and received 5 after keyboard Four.
- Save the hydrated draft innings instead of current innings on Finish: two
  failures, with completed runs expected 0 and received the stale 1 after retry.

The production file was restored byte-for-byte after each mutation, verified by
SHA-256. The restored regression file passes all seven tests (38.60 seconds).
See [the complete mutation and restoration evidence](review-test-counterfactuals.txt).
These changes cover the two review test gaps; the separate storage-growth finding
is unchanged.
