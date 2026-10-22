# Delete removed sports and local data

Decision: 2026-10-22, before any users. Delete the five removed sports and their identified saved local data, with no retention. This replaces the earlier read-only and read-filter approaches.

`purgeRetiredSportData()` runs at startup behind `se_retired_purge_v1`. It removes the five per-sport/draft keys and their old storage-prefix counterparts. Shared quick matches, sessions, history and templates lose only rows whose explicit `sport` names one of the five. Both statistics objects lose only properties keyed by those five sport ids; all other properties remain. Sportless rows (including real factory sessions/history), registered rows and malformed peers remain untouched. No schema repair or read-time predicate is added; storage readers retain master's behavior.

Deleted assets include five SVG icons, court motifs, showcase choices and obsolete sport fixtures. The retired catalog and recovery page are gone. Removed sport URLs use the ordinary not-found screen; direct live snapshots whose sport is absent from the registry use the existing unavailable screen. Live now cards use that same registry lookup to skip unregistered sports. Cricket batter retirement and Convex are unchanged. Harsha owns wiping backend data; this PR does not claim to delete Convex-backed Profile history.

## Validation

- Initial red run: 7 failures (two purge tests and five live-link cases), with `--maxWorkers=1`.
- Initial green run: 4 files, 115 passes, including purge, live links, URL recovery and palette.
- Palette exact equality is now BASELINE 668. Removing the remaining unregistered throwball motif also removes the unused hatch helper and one raw colour literal (669 -> 668).
- Current expected-failure inventory after the navigation decisions: **4 routing / 7 repository-wide**. RA-5 now passes normally after delaying the leave guard until scoring starts; RA-9 also passes normally after the own-key registry lookup. SA-07 now passes normally after round two saves the final Undo; four routing and three stability markers remain. Counts in dated validation runs below describe those historical heads.
- Required CI `verify` gates the full suite and build. The owner-authorized push uses `LEFTHOOK_EXCLUDE=test,build`; normal pre-commit lint, type-check and configuration checks remain enabled.

No dev server, Convex deployment or production writes were used.

Master counterfactual: **13 failures / 42 skipped**, in 44.05 seconds, at master c324713 (two purge, six old-URL, five live-link cases). All five substituted production files were restored and SHA-256 verified.

Earlier focused run: **22 files, 402 ordinary passes + 6 expected failures = 408 cases**, zero failures, using --maxWorkers=1. It covers storage, app entry, registered sport factories/registry, local history/stats/Home/Play, URL recovery, direct live links, the live strip, affected generic scorecard/event modules, scoring prompts, sport marks and palette.


## CI motif follow-up

CI exposed an obsolete minimum-count assertion in courtMotifs.test.js, which the earlier focused selection missed. Motif keys now match exactly the registered sets/goals sport ids, and sport marks may only name registered sports. The five deleted sport motifs were already gone; the remaining unregistered throwball motif and its unused hatch helper are now removed. Storage and sport-picker consumer tests derive their expected sports from the registry. The five-id lists left in frontend tests are intentional purge/404/unavailable regressions; the existing backend fixture is unchanged because Convex is outside this PR.

The new exact-set assertion failed before removing throwball. Related-test verification uses bun run test -- --changed origin/master --maxWorkers=1 across the entire diff.


After the app restart, the requested related-test rerun passed **60 files: 761 ordinary passes + 9 expected failures = 770 cases**, zero failures, with bun run test -- --changed origin/master --maxWorkers=1. This includes courtMotifs, sportMarks and the exact palette ratchet at BASELINE 668. No source changed between validation and commit.


## Live feed and statistics follow-up

Two new regressions failed before the fix: the mixed live feed rendered the removed-sport card, and current/legacy statistics retained the removed-sport properties. Each purge key is processed by synchronous, back-to-back read/filter/write calls with no await. A cross-tab lost update on shared arrays remains a known pre-existing read-modify-write limitation, filed separately as an issue; this PR does not add cross-tab coordination.


The live-feed/statistics follow-up passed related validation: **61 files, 768 ordinary passes + 9 expected failures = 777 cases**, zero failures, using bun run test -- --changed origin/master --maxWorkers=1. Both new regressions were red before the fixes. The long run completed successfully without retries; process diagnostics were captured while it was slow.
