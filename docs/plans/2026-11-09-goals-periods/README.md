Decisions needed: none.

# Goal-sport periods: acceptance evidence

Draft PR [#228](https://github.com/harshanandak/scoreeasy/pull/228). Scope is setup, board, persistence, Undo and viewer for football, basketball and field hockey. Kabaddi keeps its existing clock.

## Red proof

The test-only commit (`ba47cca8b3c98a9df32ec7f20454d86e842147fe`) ran in [CI](https://github.com/harshanandak/scoreeasy/actions/runs/42522153593). Exactly two new integration tests failed. The assertions for `Pause clock` and `End half` used `queryByRole(...).toBeInTheDocument()` and received `null`, because the board lacked those controls. The run had 2 failed, 2453 passed and 7 expected failures. This replaces the earlier missing-import failure as the feature's red proof.

The implementation and integration tests passed [CI on the intermediate head](https://github.com/harshanandak/scoreeasy/actions/runs/42523900331) (`c325101e36960bbdca9f1458dd73618ac8f2a4be`). That result does not certify later commits; the PR check list reports the current head.

## Browser walkthrough

All PNGs came from the T3 integrated browser, one preview call at a time. The app was served using `bun run build` and `bun run preview`. CSS viewport sizes are 360×640 and 390×844; captures use the browser's 2× pixel ratio.

The 42 PNGs follow `<sport>-<state>-<width>.png`. Sports are football, basketball and hockey. States are setup, running, paused, period-end, half-time, full-time and viewer. `screenshots.json` enumerates every file and its dimensions.

| Acceptance item | Walkthrough and evidence | Limit |
| --- | --- | --- |
| Setup | Captured labelled IFAB 2026/27, FIBA 5-on-5 2024 and FIH outdoor 2027 timing baselines. Custom period count and duration are editable. CI covers casual play hiding timing controls. | These are timing baselines, not complete federation officiating support. |
| Running and pause | Started a custom one-minute period for each sport, then used Pause clock. The running and paused boards were captured at both sizes. New controls measured 44 CSS px high; the boards had no horizontal overflow. | No physical-phone or sunlight check. |
| Refresh | Football's paused clock stayed at 43:33 across navigation. CI covers paused restore, resumed timing, tournament reload and running-clock reconstruction. | The browser walkthrough did not close a native app process. |
| Clock zero | Seeded stored elapsed time to the period limit, reloaded, and captured the scorer confirmation. Confirm period end led to an interval. Zero did not save a result. | Stored time was advanced to avoid waiting through full match durations. |
| Half-time and Undo | For each sport, confirmed the half-time boundary, started the next period and pressed Undo. The board returned to Half-time with Team A's score still 1. | Basketball and hockey used a stored Q2 boundary fixture. |
| Full time | Seeded the last period at its limit, confirmed its end, then separately confirmed full time and saved. The result screen recorded Team A's 1–0 win. | Earlier elapsed periods were seeded, not played in real time. |
| Extra time and corrections | CI covers two football extra-time halves, repeated basketball overtime, score attribution by period, early abandonment, and atomic Undo. Later tests cover correcting a previous period and keeping a long match's stored history linear. | Later tests require current-head CI; the intermediate green run predates them. |
| Viewer | Captured the shipped watch component showing `2nd half · paused` or `Q3 · paused`, totals, and score-by-period rows. | Presentation fixture only. No live Convex deployment or public match was created. |

## Viewer fixture

The files in `viewer/` build the real `MonoWatchMatch` component with local read-only Convex hook fixtures. They are separate from the application's default build. They do not add an app route or publish a match.

```sh
bun run build -- --config docs/plans/2026-11-09-goals-periods/viewer/vite.config.js
bun run preview -- --config docs/plans/2026-11-09-goals-periods/viewer/vite.config.js --port 4189
```

Open `/period-viewer/?sport=football`, `?sport=basketball` or `?sport=hockey` on that preview origin. Use a separate port from the app preview because the app's service worker handles navigation requests.

## Verification limits and deployment

No tests were run locally. Lint, type-check and production builds were run. The existing lint warnings remain; no gate was disabled.

The backend change adds an optional, whitelisted clock basis to live snapshots. Ownership and publication checks stay in the existing mutation/query paths. CI tests publish and read that snapshot and reject an unauthenticated write. Production sharing was not exercised. Update the development backend schema with the frontend before checking the live scorer-to-viewer path.

Old saved matches without versioned period rules keep their previous reader and timing semantics. The feature does not retrofit fabricated period scores. Matches ended before their configured end retain #221's Abandoned / no result outcome, including after a period is skipped early.

The supplied real-world scoring research did not justify a new default duration. Source-labelled baseline durations remain 2×45, 4×10 and 4×15 minutes. Shot clocks, shootout adjudication, player requirements and 3x3 are outside this PR.
