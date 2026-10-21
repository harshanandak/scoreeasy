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
pending navigation timer. Only starting a new quick match resets a completed lock.

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

Cricket adapter changes are confined to the four cricket scorer files and the
cricket completion section of quick match. Master `28ada35` (PR #170) was merged
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
- Test cricket: the winning ball is persisted before finalize; same-batch Undo is
  blocked; a failed save can be retried; Return does not save/finalize twice.
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

The first normal pre-push hook passed **130 files, 1,510 tests and 10 expected
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

The owner released the full-suite lane. The normal pre-push hook runs the full
suite and build; their terminal results are reported in the PR. The running-app
demo was repeated after the merge: attempted taps at 2.6 ms and 174 ms left the
completed 1-0 result intact. No Convex deployment or production write is part of
this work. SA-07, SA-09, guided failed-save navigation,
Test cricket's active "Finish & save" persistence, and guided raw-innings retention
remain outside scope. Test cricket's terminal result commit is distinct from its
active "Finish & save" action.
