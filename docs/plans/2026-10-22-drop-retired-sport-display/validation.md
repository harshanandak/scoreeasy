# Unregistered saved data: pre-push validation

Decision: 2026-10-22, before any users. Saved matches and drafts for unregistered sports are ignored, without a display or recovery path. Retired rows are ignored on read and may be dropped the next time that collection is saved. Read-side normalization stays in memory; no migration is added.

## Historical first-round verification

`bun run test --maxWorkers=1` passed **10 files: 270 passed + 1 unchanged expected failure = 271 cases** (50.28 seconds).

Files: `UnregisteredSavedData.test.jsx`, `storage.test.js`, `storage.stability.test.js`, `appEntry.test.js`, `sportRegistry.test.js`, `MonoHistory.test.jsx`, `MonoStatistics.test.jsx`, `DashboardLanding.test.jsx`, `AppRouteRecovery.test.jsx`, and `palette.test.js`.

At the first-round head, the 22 boundary regressions covered all five removed sports plus an unknown sport, malformed peers, History and stats, Home, returning-player detection, mismatched drafts, missing sport ids, prototype keys, registered records, unrelated generic data, and unchanged storage bytes. Old deep links for all five sports use the existing 404 with Play and Home. The palette ratchet still asserts exact equality with **BASELINE 669**, unchanged.

## Counterfactual

The then-current **21 regression cases all failed** against `origin/master` (`5dc93bf2d792ef5c2a86b588da75509016884258`), in 11.19 seconds. There were no worker-start or runner errors. This was a deliberate source substitution, not a retry of a flaky run:

1. Backed up the six changed production files: `storage.js`, `sportFocus.js`, `sportRegistry.js`, `MonoHistory.jsx`, `index.jsx`, and `DashboardLanding.jsx`.
2. Replaced each with its exact `git show origin/master:<path>` source and ran `UnregisteredSavedData.test.jsx` with `--maxWorkers=1`.
3. Restored all six files in `finally` and verified their original SHA-256 hashes.

The subsequent 22nd regression exposed a write from the tournament loader's existing format migration: one `localStorage.setItem` call would persist the filtered collection. It failed before the fix and passed after format adaptation was kept in memory. Quick-match normalization likewise no longer writes on read. Spy assertions cover both `setItem` and `removeItem`.

Full-suite and pre-push build validation were deliberately not run at this hold point; another worker owns that lane. No dev server was started for this task.

## Publication follow-up

After the lane opened, the first normal pre-push run completed without worker errors: 129 files, 1,498 passes, 9 expected failures and 3 failures; the production build passed. Two failures used sportless quick-match fixtures; the first-round change added sport ids. Round 2 corrects the broader mistake of requiring sport on legacy factory records. The third showed that RA-9 had genuinely been fixed by the own-key registry lookup: its unchanged route assertions passed, so only that `it.fails` marker was converted to a normal `it`.

The affected `OfflineFallback.test.jsx`, `AppEntryRoute.test.jsx` and `routes.contract.test.jsx` then passed with **57 passes + 5 expected failures = 62 cases** (40.47 seconds), using `--maxWorkers=1`. That follow-up only changed tests and documentation; the historical counterfactual above applies to the first-round implementation. The remaining full-suite expected-failure count is nine. This is correction of deterministic failures, not a flaky-run retry.

## CI gate decision

Harsha moved the full-suite and build gate to GitHub CI's required `verify` check. The RAM poller was stopped. Publication uses the explicitly authorized `LEFTHOOK_EXCLUDE=test,build`; local pre-commit lint, type-check and configuration checks remain enabled. No current-head local full-suite or build pass is claimed. Their publication result comes from CI `verify`.

Master's completion lock (`c324713`, PR #172) was merged without conflicts. Its completion and navigation changes remain intact alongside the `loadData` filter. Focused verification after this merge includes the route contracts, completion lock, completed-match hydration, cricket finish navigation and completion hook.

The post-merge focused run passed **17 files: 368 passes + 6 expected failures = 374 cases**, with `--maxWorkers=1` (219.84 seconds). Normal pre-commit hooks also passed: lint had 0 errors and 29 warnings, type-check passed, and configuration sync passed. The palette assertion remains exact equality with BASELINE 669.

## Round 2: preserve legacy factory records

The first-round predicate incorrectly treated a missing sport as an unregistered sport. The shared predicate now retains object records without a sport, resolves only known built-in sport template ids, and rejects invalid envelopes or an explicitly unregistered sport. Custom and unknown template ids do not imply a sport. Both the local load boundary and the client live-feed strip use this predicate; Convex is unchanged.

Real `createGameSession` and `createHistoryRecord` factories now supply compatibility fixtures. Seven legacy regressions and two new live-strip regressions failed against the blocked first-round head (`44c4b6c`): **9 failures, 5 existing live-strip passes**, in 26.41 seconds, with no worker-start errors. This includes a seven-point volleyball session on Home/app entry and its history record. The older History fixture also uses the real factories instead of adding a sport field.

Retired rows are ignored on read and may be dropped the next time that collection is saved. No peer-preserving write machinery or migration is added. Simple in-memory read adaptation remains; assertions about unchanged storage apply only to the read being tested. A regression explicitly verifies that quick-match, tournament and session collection saves can drop ignored rows.

The current expected-failure inventory is **5 routing / 9 repository-wide**. RA-9 genuinely passes after the own-key registry lookup fix; the other five routing and four stability expected failures remain unchanged. Historical validation counts above refer to their recorded heads.

Round 2 focused verification passed **17 files: 375 ordinary passes + 6 expected failures = 381 cases**, with zero failures and --maxWorkers=1. It includes 39 route contracts (34 ordinary passes + 5 expected failures), the one storage stability expected failure, the factory compatibility tests, live-strip filtering, and completed-match hydration. Palette exact equality passed at BASELINE 669.
