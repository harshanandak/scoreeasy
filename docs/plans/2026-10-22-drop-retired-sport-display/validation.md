# Unregistered saved data: pre-push validation

Decision: 2026-10-22, before any users. Saved matches and drafts for unregistered sports are ignored, without a display or recovery path. Reads do not delete or rewrite their stored rows.

## Focused verification

`bun run test --maxWorkers=1` passed **10 files: 270 passed + 1 unchanged expected failure = 271 cases** (50.28 seconds).

Files: `UnregisteredSavedData.test.jsx`, `storage.test.js`, `storage.stability.test.js`, `appEntry.test.js`, `sportRegistry.test.js`, `MonoHistory.test.jsx`, `MonoStatistics.test.jsx`, `DashboardLanding.test.jsx`, `AppRouteRecovery.test.jsx`, and `palette.test.js`.

The 22 boundary regressions cover all five removed sports plus an unknown sport, malformed peers, History and stats, Home, returning-player detection, mismatched drafts, missing sport ids, prototype keys, registered records, unrelated generic data, and unchanged storage bytes. Old deep links for all five sports use the existing 404 with Play and Home. The palette ratchet still asserts exact equality with **BASELINE 669**, unchanged.

## Counterfactual

The then-current **21 regression cases all failed** against `origin/master` (`5dc93bf2d792ef5c2a86b588da75509016884258`), in 11.19 seconds. There were no worker-start or runner errors. This was a deliberate source substitution, not a retry of a flaky run:

1. Backed up the six changed production files: `storage.js`, `sportFocus.js`, `sportRegistry.js`, `MonoHistory.jsx`, `index.jsx`, and `DashboardLanding.jsx`.
2. Replaced each with its exact `git show origin/master:<path>` source and ran `UnregisteredSavedData.test.jsx` with `--maxWorkers=1`.
3. Restored all six files in `finally` and verified their original SHA-256 hashes.

The subsequent 22nd regression exposed a write from the tournament loader's existing format migration: one `localStorage.setItem` call would persist the filtered collection. It failed before the fix and passed after format adaptation was kept in memory. Quick-match normalization likewise no longer writes on read. Spy assertions cover both `setItem` and `removeItem`.

Full-suite and pre-push build validation were deliberately not run at this hold point; another worker owns that lane. No dev server was started for this task.
