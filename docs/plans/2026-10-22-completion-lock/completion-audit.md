Decisions needed: none.

# Completion lock

Baseline: `origin/master` (`cdae97d`, fetched before branching).
Scope: completion authority and completion navigation for Forge issues
`20089bdb-84b4-40d4-ad91-4661819cab0f` and
`0014115d-668d-48dd-ac2b-8ad8fedf1f9b`.

## What each scorer did on the baseline

| Scorer | Completion behavior | Reproduced failure |
| --- | --- | --- |
| Goals: football, basketball, hockey, kabaddi | Manual Finish saved and finalized immediately, then navigated after 300 ms. Target and clock completion each had their own delayed save callback. Scoring, Undo, Finish and draft autosave shared no terminal lock. | All three completion paths accepted later actions. Drafts could replace a completed result; repeated Finish could finalize twice; target completion could save a later score. Twelve fake-timer cases failed. |
| Sets | A won match saved and finalized on Finish, then used protected history unwinding to open its result. A completed set blocked new points, but Undo remained available. An incomplete Finish intentionally saved a draft. | Undo reopened the set while navigation was pending; scoring/correction and another Finish replaced the completed match with an in-progress result. |
| Tennis, including the separate quick-tennis route | A won match finalized before its save and navigated through the protected completion seam. Natural completion blocked new points, but Undo remained available. Incomplete Finish saved a draft. | Undo restored an unfinished set during navigation. The next save could replace the completed result with a draft. A failed final save also happened after broadcast finalization. |
| Limited-overs cricket | Finish validated the innings, wrote the completed match, finalized its live session and used a 300 ms navigation timeout. Undo and continuous draft saving remained active. | Undo plus another delivery replaced the completed match with an in-progress draft. Super-over handlers also lacked a terminal lock. |
| Test cricket | Natural completion switched to a result-only screen, stopped draft autosave and finalized the broadcast. It persisted the result only on Save & Return. | The result-only screen prevented the ordinary post-Finish scoring race, but the winning delivery was never saved before broadcast finalization. The regression found no completed save after the winning ball. |
| Guided cricket | An innings completion ref suppressed duplicate callbacks. It did not block scoring; Undo explicitly reset the ref. The route persisted the second-innings result and navigated without checking save success. | Undo and another delivery emitted two additional state writes after completion. Those writes could reach the route's in-progress persistence bridge while navigation was pending. |
| Quick match: goals/sets | Completion persisted a result and immediately switched phase to result. Draft autosave ran only in the scoring phase. The winning-point broadcast effect preceded the finalize effect. | The result phase already removed ordinary later scoring controls. The shared mechanism now also rejects stale callbacks and repeated completion, and a failed final save stays open for retry. |
| Quick match: cricket | The handler published a delivery; a later effect decided innings transitions and match completion. | A winning four from 1 to 5, followed by Undo in the same React batch, stored 4. The winning event could also be replaced by an Undo broadcast intent. |
| Protected completion routing | After unwinding to a tournament entry, the app pushed that same tournament URL again. | The BrowserRouter reproduction stayed on the tournament after one Back. |

The reproductions above reach evidence rung 4: tests render the real scorers and
exercise their persistence and broadcast calls. Remote transport is mocked; these
tests do not claim hosted Convex or public-broadcast verification.

## Shared mechanism

`useMatchCompletion` owns the synchronous lock, single successful commit and
single navigation. Its ref blocks stale callbacks before React renders disabled
controls. A winning handler can acquire the lock immediately and commit the
settled snapshot in an effect, preserving the winning-point-before-finalize
ordering. A failed local save releases the lock for retry. Unmount cancels a
pending navigation timer. Completion state belongs to the hydrated match identity;
a different match starts a new scope, while a persisted completed match restores
its committed lock.

The existing scoring-prompt hook exposes that same lock to control disabling and
the existing scoring/draft guards. Goals' three save paths now share one result
writer and only navigation is delayed. Sets and tennis retain their intentional
incomplete-draft behavior. Test cricket saves the terminal state before finalizing;
Save & Return leaves the saved result exactly once. Guided cricket freezes its
engine innings and the parent persistence bridge. Guided's existing unchecked
save/navigation behavior is explicitly outside this task: its follow-up can return
the save boolean from the commit callback to use the shared retry/navigation
contract. Quick cricket decides whether
to acquire the lock using the same transition helper used by its completion effect.

The app's history completion seam replaces an unwound entry when it already is
the requested destination. It still pushes a distinct result page and still
replaces deep-linked scorers.

Cricket adapter changes cover the four cricket scorer files and the cricket
completion section of quick match. Round 3 also puts Test terminal detection in
the cricket calculation module so live scoring and hydration share it.
Master `28ada35` (PR #170) was merged
after the lane was released. Limited, Test and guided completion retain its
`completeProtectedScoring` navigation, with the shared hook owning the commit and
single navigation. Test quick completion retains its `/history` destination.
The later tests-only master update `5dc93bf` (PR #171) was also merged normally.
Its SA-07 test was temporarily run as an ordinary test to inspect the failure:
the initial point-save assertion passed, then the final undo persistence assertion
failed with expected 0, received 1 (line 126). The test was restored byte-for-byte
with `it.fails` retained. Completion locking does not fix undo-to-empty autosave.

## Acceptance and demo

- Goals: manual, target and timed completion reject scoring, Undo and repeated
  Finish; the first result remains completed with no draft. All four goals sports
  are exercised. A new 1-0 match's event stream agrees with the persisted result.
- Sets and tennis: completed Finish rejects Undo, corrections, scoring and repeat
  Finish; a failed save remains retryable and does not finalize.
- Limited-overs cricket: completed Finish rejects later actions and draft writes;
  failed completion remains retryable.
- Test cricket: terminal deliveries, including the final wicket, synchronously
  lock one innings/result snapshot. Undo cannot alter that snapshot. Failed saves
  retain it as a terminal-pending draft across refresh; Return retries persistence
  or leaves a committed result without saving/finalizing twice.
- Guided cricket: a completed innings cannot be undone or extended. The parent
  rejects further state writes after completion. Its existing failed-save
  navigation and raw-innings retention are reserved for separate follow-ups.
- Quick match: the winning point reaches broadcast before finalize; the result
  phase does not recreate a draft. Cricket locks before publishing a winning ball,
  so same-batch Undo cannot alter the saved score. Failed saves remain retryable.
- Routing: one Back after tournament completion leaves the tournament. Existing
  deep-link and distinct-result contracts remain covered.

The local running-app demo uses synthetic Red/Blue data at **390 x 844** and
reaches evidence rung 5 for goals completion and browser history. It attempts both
a same-turn tap and a second tap after 160 ms. Storage remains completed at 1-0,
with no draft, and one Back lands on `/football/tournament`.

Screenshots, each visually inspected:

1. [1-0 before Finish](01-before-finish.png)
2. [Finish followed by the fast tap](02-after-finish-fast-tap.png)
3. [Completed result remains 1-0](03-finished-result.png)
4. [One Back leaves the tournament](04-one-back.png)

Timing, disabled controls, stored result and final URL are captured in
[demo-evidence.json](demo-evidence.json).

## Validation

Pre-merge focused result: **21 files passed; 288 tests passed and 9 existing
expected failures remained (297 total)**. After merging PR #170, the same selection
also includes `CricketFinishNavigation`: **22 files passed; 306 tests passed and 9
expected failures remained (315 total); zero runner errors**, in 231.36 seconds
with two workers. Earlier runs encountered worker-start timeouts at default
concurrency; the same checks remained enabled in the passing run.

```text
bun run test src/designs/design1-mono/scoring src/designs/design1-mono/MonoQuickMatch.broadcast.test.jsx src/designs/design1-mono/MonoQuickMatch.hardening.test.jsx src/designs/design1-mono/routes.contract.test.jsx src/hooks/useMatchCompletion.test.jsx src/designs/design1-mono/theme/palette.test.js --maxWorkers=2
```

`bun run lint` passed with zero errors and 29 warnings. `bun run type-check` passed.
The palette test still requires equality with **669**, and passed unchanged.
`git diff --check` and the staged equivalent passed.

The first normal pre-push hook, under its full-suite/build behavior at the time,
passed **130 files, 1,510 tests and 10 expected
failures (1,520 total)** in 443.26 seconds. Its production build transformed
**658 modules**, compiled in 43.03 seconds and generated **70 PWA precache entries
(1,246.57 KiB)**. After master moved to PR #171, the focused selection and normal
push hooks were rerun; their final results are recorded in the PR.

Failing-before evidence was captured for goals' three completion modes across all
four sports (12 cases), sets/tennis/limited-overs cricket (3 cases), guided cricket,
Test cricket's unsaved winning ball, quick cricket's winning-ball/Undo race and
the duplicate tournament history entry. Stronger same-batch Test-cricket cases
also exposed deferred updater execution; synchronous innings publication fixed
those without weakening their assertions. All corresponding regressions pass in
the final focused run.

The owner released the full-suite lane. At the time, the normal pre-push hook ran
the full suite and build; their terminal results are reported in the PR. Current
validation uses the required CI `verify` check as the full-suite/build gate. The running-app
demo was repeated after the merge: attempted taps at 2.6 ms and 174 ms left the
completed 1-0 result intact. No Convex deployment or production write is part of
this work. SA-07, SA-09, guided failed-save navigation,
Test cricket's active "Finish & save" persistence, and guided raw-innings retention
remain outside scope. Test cricket's terminal result commit is distinct from its
active "Finish & save" action.

## Round 2: persisted completion owns hydration

The review reproduced a missing boundary on PR head `ce2bf6b`: the latch survived
only within a mount. Completed records could therefore reopen through refresh or
Forward, and a completed quick match's latch could survive into another sport's
draft. A staged winning ball also skipped draft autosave before its result save
had succeeded.

`isCompletedMatch` and `useMatchCompletion.hydrate` now own the shared rule. A
loader binds the match identity and persisted status before publishing mutable
state. A completed record is already committed: it cannot score, autosave, save
again or finalize again. A different identity resets the completion scope and
cancels the previous scope's pending navigation. A stale in-progress snapshot of
the same identity cannot release an existing committed latch.

| Hydration path | Completed record behavior |
| --- | --- |
| Goals, all four sports | Lock and return through protected completion to the tournament. Browser Forward cannot reopen scoring. |
| Sets | Lock and open the existing match result. |
| Tennis tournament | Lock and return to the tournament. |
| Tennis quick | Check completed history before restoring a draft, remove only that match's obsolete draft and open history. This also handles a completed match whose draft was already removed. |
| Limited-overs cricket | Lock and return through protected completion to the tournament. |
| Guided cricket | Initialize the latch from persisted status, render no mutable child and return through protected completion. |
| Test cricket, tournament and quick | Restore the persisted innings, innings index, follow-on state, winner and description into the terminal screen. Save & Return only navigates; it does not save or finalize the record again. |
| Quick goals, sets and cricket | Bind the restored draft's match identity. Completed history overrides a stale draft of that same match and routes to history. A different match gets its own unlocked scope. Result persistence retains the stable draft/live match ID and explicitly records completed status. |

Quick and Test-cricket draft autosave now distinguish a staged UI lock from a
successful terminal commit. The settled winning snapshot is still saved as a
draft until the result save succeeds. Thus a failed result save can release its
latch for retry without dropping the winning ball on refresh. After a successful
commit or completed hydration, draft autosave stops.

Failing-before evidence (rung 4), written and run before the implementation:

- Test draw, refresh before Return: both storage branches lost their terminal
  screen and reopened at the first innings.
- Real BrowserRouter Finish then Forward then attempted score: completed 1-0
  changed to an in-progress draft at 2-0.
- Complete football, then hydrate a volleyball draft in the same mounted quick
  route: the new point and draft write were blocked by the old latch.
- Quick cricket failed result save: the last persisted draft still held 1 run
  instead of the settled winning 5.

Those four scenarios produced five failing tests (both Test storage branches are
covered), with 54 passing tests and six existing expected failures in the same
three-file run. Two hook lifecycle regressions also failed before implementation.
The subsequent targeted run passed all five files: 74 tests plus six expected
failures. This includes the nine-case completed-hydration matrix, seeded through
the ordinary storage APIs so format migrations are not mistaken for score writes.

An additional Test-cricket failed-save assertion reproduced the same draft gap:
its winning 2 remained persisted as 0. The shared committed-state autosave rule
fixes that path too; the focused Test/tennis/quick-hardening run then passed all
36 tests. SA-07's empty-history guard is unchanged. The separate active Test
"Finish & save", guided failed-save navigation, guided raw-innings retention and
SA-09 remain outside this round.

Final round-2 focused result: **24 files passed; 335 tests passed and nine existing
expected failures remained (344 total); zero runner errors**, in 650.98 seconds.
This expands the hydration matrix to ten cases, including tennis quick completion
after its draft has already been removed, and includes quick team-colour tests
whose storage mock gained the completed-history lookup.

```text
bun run test src/designs/design1-mono/scoring src/designs/design1-mono/MonoQuickMatch.broadcast.test.jsx src/designs/design1-mono/MonoQuickMatch.hardening.test.jsx src/designs/design1-mono/MonoQuickMatch.teamColour.test.jsx src/designs/design1-mono/routes.contract.test.jsx src/hooks/useMatchCompletion.test.jsx src/designs/design1-mono/theme/palette.test.js --maxWorkers=1
```

The preceding two-worker attempt passed 21 files / 298 tests, but three workers
failed to start (sets stability, routing contracts and cricket extras). That was
not a passing matrix. The complete selection was rerun with one worker; no
assertion, test isolation or timeout was weakened. Palette equality still passes
at **669**. SA-07 was also rerun temporarily as an ordinary test: the point-save
prerequisite passed, then its final undo persistence assertion failed with
expected 0, received 1. Its `it.fails` source was restored byte-for-byte.

Lint, type-check and agent-config sync run through the normal commit hook. At the
initial round-2 hold point, the full suite, push and PR-body update were held for
the owner's full-suite lane release. Shipping validation is recorded in PR #172;
no production write or deployment is part of this round.

## Round 3: one terminal Test snapshot

The review of `2ee552a` found a second Test completion path that the earlier chase
tests did not exercise. All-out, declaration and ball-limit boundaries deferred
`advanceInnings(updated)` by 300 ms. The callback decided the result from captured
innings, but the save effect persisted the current innings. Keyboard Undo could
therefore produce a completed defending win with only nine wickets. Separately,
the completed-status hydration rule did not recognize a winning in-progress draft
left by a failed result save.

`getTestMatchCompletion` now owns the Test terminal predicate beside the cricket
result calculations. Live deliveries and both loaders use it for a chase, an
ended fourth innings, a third-innings innings victory or a stored declared result.
Mid-third-innings leads remain in play. The scorer removes all six delayed innings
callbacks. Its delivery boundary synchronously locks and captures one cloned
snapshot containing innings, innings index, follow-on state and result. Terminal
state, result persistence and failed-save draft recovery all use that snapshot;
result selection cannot drift from the innings saved. The winning ball's live
snapshot still precedes finalization.

Hydrating a terminal in-progress draft restores the result screen and locks input
before exposing mutable state. It says "Result not saved. Save & Return to retry."
and waits for an explicit retry. Return distinguishes an already committed result
from a pending result, so a pending lock does not prevent its save. A declared draw
is also retained in the draft even when no scoring history exists. Ordinary
undo-to-empty saving is unchanged; SA-07 remains an expected failure.

### Counterfactuals and regression evidence (rung 4)

`MonoCricketTestLiveScore.completion.test.jsx` uses the real scorer, real storage
utilities and localStorage, with mocked remote transport. Its first four tests
failed on `2ee552a` before any implementation changes:

- OUT from nine wickets, keyboard Undo at fake time 299 ms, then advance to 300 ms:
  both quick and tournament records became completed defending wins with nine
  wickets, zero balls and `allOut: false` rather than ten wickets and one ball.
- A failed winning save retained two runs as an in-progress draft. Remount and
  attempt Four: both storage branches saved six runs rather than preserving two.

After the fix, the exact reviewed component and calculation-module blobs were
temporarily restored from `2ee552a` and the same four cases rerun. All four failed
for those exact assertions again (6.10 s; eight other cases skipped). Both fixed
source files were then restored byte-for-byte. No expected-failure declarations
were changed.

The twelve-case regression file additionally covers pending all-out, declaration
and draw hydration, explicit retry, and a failed declared draw without scoring
history, for both quick and tournament storage. The expanded targeted run passed
**5 files / 78 tests** (99.88 s), including the existing innings, completion-lock,
finish-navigation and cricket-calculation checks.

### Other scorer timers inspected

| Scorer | Timer/decision boundary |
| --- | --- |
| Goals, all four sports | Finish and automatic completion enter the shared synchronous commit; navigation is delayed only after the commit. |
| Sets | Remaining component timeout dismisses the set-won decoration; Finish commits synchronously. |
| Tennis, tournament and quick | Remaining timeout dismisses a milestone; Finish commits synchronously. |
| Limited-overs cricket | Finish commits before its navigation delay. Super Over timers switch phase UI; the terminal keypad is already hidden and the result reads current Super Over state, not a captured result paired with later innings. |
| Guided cricket, child and route | The child locks on its engine's terminal delivery; the parent commits through the shared hook. The remaining timeout dismisses a toast. |
| Quick match, goals/sets/cricket | Cricket locks from its transition predicate before publishing the winning delivery; the result writer commits synchronously. The remaining component timeout dismisses a warning. |

No other inspected scorer delays a captured match-result decision until a timer
then persists a separate current innings snapshot. The remaining UI timers are
unchanged. This timer audit is source evidence (rung 2), not a new device demo.

### Round-3 hold-point validation

The complete focused selection passed with **26 files, 388 passing tests and nine
existing expected failures (397 total), zero runner errors**, in **422.32 s**:

```text
bun run test src/designs/design1-mono/scoring src/designs/design1-mono/MonoQuickMatch.broadcast.test.jsx src/designs/design1-mono/MonoQuickMatch.hardening.test.jsx src/designs/design1-mono/MonoQuickMatch.teamColour.test.jsx src/designs/design1-mono/routes.contract.test.jsx src/hooks/useMatchCompletion.test.jsx src/designs/design1-mono/theme/palette.test.js src/utils/cricketCalculations.test.js --maxWorkers=1
```

Routing retains its six executed expected failures. A source inventory confirms
all ten repository-wide expected-failure declarations remain unchanged, including
SA-07 and the storage expected failure outside this focused selection. Palette
equality remains **669**. Diff whitespace checks pass. Normal commit hooks run
lint, type-check and agent-configuration sync. The full suite, build, push and PR
update remain held until the owner releases the lane; no dev server was started.
