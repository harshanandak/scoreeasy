# Kit S6: the Live tab

Decisions needed: none.

The implementation adds a public Live destination to Home, Play, Live, History, Account / Sign in. Account remains conditional on cloud availability. The page reads only the public discovery feed and offers Score a match when it has nothing to show.

## Rendered evidence (rung 5: isolated fixture pages)

Captured only with T3 `html_preview` using a self-contained inlined IIFE, the existing read-only Convex/auth fixture and embedded app fonts. No localhost, standalone browser or live backend was used. Every PNG was decoded from the tool response and checked at exactly 390x844 or 360x640; no screenshot was resized.

Before renders master navigation and Home strip (the captured files are identical on master 0e7d3b7 and 997abde). After renders the PR components. S5 was rebased in; it changes neither captured baseline file. The temporary harness eagerly imports the captured routes, omits uncaptured route implementations and settles only Home's mount fade. It remains uncommitted in `.kit-preview/`. The Clerk Account control is the supplied fixture button; these dimensions do not independently prove the external Clerk widget.

At **360x640**, signed in: Home 64.390625x62.84375, Play 64.40625x62.84375, Live 64.390625x62.84375, History 64.40625x62.84375, Account cell 64.40625x62.84375; Account's actual mocked button is **48x48**. Signed out: the same widths, all five buttons **54px high**, including Sign in. Every label fits its cell and its text bounds. Document and body scroll widths are **360px**, so horizontal page overflow is **0px**.

The full feed renders **4 rows, 1 Paused, 1 dock Live dot**. Empty and loading each render **0 dock dots**; at 360, error and cloud-off also render 0 dots and the empty CTA. Light and dark list/empty views were checked; dark resolves the canvas token to **#0e0f12**. At 360x640 the fourth row is below the initial dock; the additional scrolled screenshot shows its Paused state above the dock. Horizontal scrolling inside the sport-filter rail is intentional and does not overflow the page.

No visual bug was identified in these captured states; no follow-up issue was filed. Filter and browser-back interactions retain the implementation's existing unit-test evidence; this capture task does not add a browser interaction claim for them. Previous preview timeouts and an early route-skeleton/fade capture were discarded.

### Screenshot files

- [after-home-in-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-home-in-360.png?raw=true)
- [after-home-in-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-home-in-390.png?raw=true)
- [after-home-out-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-home-out-360.png?raw=true)
- [after-home-out-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-home-out-390.png?raw=true)
- [after-live-dark-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-dark-360.png?raw=true)
- [after-live-dark-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-dark-390.png?raw=true)
- [after-live-empty-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-empty-360.png?raw=true)
- [after-live-empty-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-empty-390.png?raw=true)
- [after-live-empty-dark-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-empty-dark-360.png?raw=true)
- [after-live-empty-dark-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-empty-dark-390.png?raw=true)
- [after-live-error-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-error-360.png?raw=true)
- [after-live-full-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-full-360.png?raw=true)
- [after-live-full-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-full-390.png?raw=true)
- [after-live-loading-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-loading-360.png?raw=true)
- [after-live-loading-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-loading-390.png?raw=true)
- [after-live-offline-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-offline-360.png?raw=true)
- [after-live-scrolled-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/after-live-scrolled-360.png?raw=true)
- [before-home-in-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/before-home-in-360.png?raw=true)
- [before-home-in-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/before-home-in-390.png?raw=true)
- [before-home-out-360.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/before-home-out-360.png?raw=true)
- [before-home-out-390.png](https://github.com/harshanandak/scoreeasy/blob/feat/kit-s6-live-tab/docs/plans/2026-10-23-kit-s6/before-home-out-390.png?raw=true)

## Acceptance evidence

- [x] Public feed only: `MonoLiveNow.test.jsx` pins `listLiveFeed` and its arguments, fields, engine-derived team colours/defaults, and zero sets.
- [x] Paused boundary: `liveStatus.test.js` pins 89s Live, 90s Live, 91s Paused, matching the spectator's strict `> 90000` rule. Timer tests cover stale -> fresh.
- [x] Empty, no-cloud and query-error CTA -> `/play`: component route tests pass. Loading has a quiet four-block skeleton.
- [x] Five tabs physically fit at 360 with >=48px targets: rendered measurements above and in browser-evidence.json.
- [x] Presence dot/count only for a nonempty feed: tests cover nonempty -> empty -> loading, unavailable cloud and query errors.
- [x] Live active on `/live`: navigation test checks dock, header and mobile menu. Existing Home, Play, History and Account tests remain green. Row token links are pinned.
- [x] Signed-out, signed-in Account, Clerk-loading fallback and no-cloud variants: unit tests pass.
- [x] Dark visual check in T3: list and empty at both sizes, linked above. After the S5 rebase, the palette baseline drops 598 -> 597; the palette regression passed all 129 tests.
- [x] Filters contain All and only returned sports, use `aria-pressed`, reverse to All, and recover when the selected sport disappears. Home See all targets `/live`; the freshness footnote says 30 minutes.

## Local test evidence (rung 4)

The full command completed with 141 files passing, 1,797 passed tests and 7 expected failures, plus two worker-start errors before `ReportMatch.test.jsx` and `LiveNavButton.test.jsx` could run. Isolated retries passed both files (2 and 3 tests respectively); liveStatus also reran (4 tests already counted in the full run). Across those runs, all 143 files have passing evidence: 1,802 passed tests and 7 expected failures. The single full-suite command was **not** a clean pass; its two startup errors remain disclosed.

Navigation regression: 22 passed. Lint: 0 errors, 29 warnings in untouched files. Type-check passed. Pre-commit agent-config, lint and type-check checks passed. No gate, expected-failure assertion or timeout was weakened.

## Follow-up

S5 owns `MonoWatchMatch.jsx`: replace its stale constant/comparison with `liveStatus.js`, retaining the Final-state guard. That file is untouched here.
