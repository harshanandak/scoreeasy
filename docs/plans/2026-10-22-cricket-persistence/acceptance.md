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
- [x] The known expected-failure inventory remains five routing and nine repository-wide; no expected failure is converted by these repairs.

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

The palette ratchet remains exact equality at 668. Historical counts in the
completion-lock audit describe its earlier heads and remain historical.
