# Kit S6: the Live tab

Decisions needed: none.

The implementation adds a public Live destination to Home, Play, Live, History, Account / Sign in. Account remains conditional on cloud availability. The page reads only the public discovery feed and offers Score a match when it has nothing to show.

## Screenshots pending for Harsha

The browser requirement changed during implementation to T3 tools only. T3's Preview panel was unavailable for this thread. The authorized `html_preview` fallback also failed: the 390x844 app iframe, a tiny page on the same local server, and the 360x640 dark empty iframe each returned `the page did not finish loading within 20 seconds`. No replacement PNG was produced. These are render/load failures; they do not establish a specific network root cause.

Earlier Chrome captures were made under the original brief, then removed from this PR's final contents when the browser rule changed. They remain recoverable from commit `486eadbbc38e2c960b723d0938f6ae32207bff7e`.

Please capture these in T3 at both 390x844 and 360x640:

- Before (supplied master baseline `42f9daf`): Home with its dock, `/live` with the list fixture, and `/live` with the empty fixture. The baseline has no `/live` route, so the last two show route recovery.
- After: Home with the five-tab dock; Live list with four rows, one Paused; Live empty.
- Dark: Live list and empty. Also walk loading, query error, no cloud, Account / Sign in, filters and the reverse paths.
- Measure every dock target at 360 and confirm labels fit. The old Chrome measurements are not being counted as the updated T3 acceptance evidence.

The temporary fixture harness remains **local and uncommitted** in the implementation worktree at `.kit-preview/`, on port 5181. It mocks `convex/react`; mutations throw. No deployment was seeded or written. Routes: `/app?feed=full`, `/live?feed=full`, `/live?feed=empty`, `/live?feed=loading`, `/live?feed=error`; add `&theme=dark`, `&cloud=off`, or `&signed=in` as needed. Its baseline mode reads the original navigation and strip from Git without editing source files.

## Acceptance evidence

- [x] Public feed only: `MonoLiveNow.test.jsx` pins `listLiveFeed` and its arguments, fields, engine-derived team colours/defaults, and zero sets.
- [x] Paused boundary: `liveStatus.test.js` pins 89s Live, 90s Live, 91s Paused, matching the spectator's strict `> 90000` rule. Timer tests cover stale -> fresh.
- [x] Empty, no-cloud and query-error CTA -> `/play`: component route tests pass. Loading has a quiet four-block skeleton.
- [ ] Five tabs physically fit at 360 with >=48px targets: T3 measurement pending.
- [x] Presence dot/count only for a nonempty feed: tests cover nonempty -> empty -> loading, unavailable cloud and query errors.
- [x] Live active on `/live`: navigation test checks dock, header and mobile menu. Existing Home, Play, History and Account tests remain green. Row token links are pinned.
- [x] Signed-out, signed-in Account, Clerk-loading fallback and no-cloud variants: unit tests pass.
- [ ] Dark visual check in T3: pending. Palette/token tests pass; baseline drops 638 -> 637 after replacing the Home strip's red dot literal.
- [x] Filters contain All and only returned sports, use `aria-pressed`, reverse to All, and recover when the selected sport disappears. Home See all targets `/live`; the freshness footnote says 30 minutes.

## Local test evidence (rung 4)

The full command completed with 141 files passing, 1,797 passed tests and 7 expected failures, plus two worker-start errors before `ReportMatch.test.jsx` and `LiveNavButton.test.jsx` could run. Isolated retries passed both files (2 and 3 tests respectively); liveStatus also reran (4 tests already counted in the full run). Across those runs, all 143 files have passing evidence: 1,802 passed tests and 7 expected failures. The single full-suite command was **not** a clean pass; its two startup errors remain disclosed.

Navigation regression: 22 passed. Lint: 0 errors, 29 warnings in untouched files. Type-check passed. Pre-commit agent-config, lint and type-check checks passed. No gate, expected-failure assertion or timeout was weakened.

## Follow-up

S5 owns `MonoWatchMatch.jsx`: replace its stale constant/comparison with `liveStatus.js`, retaining the Final-state guard. That file is untouched here.
