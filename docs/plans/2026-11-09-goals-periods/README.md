Decisions needed: none.

# Goal-sport periods: acceptance evidence

Draft PR [#228](https://github.com/harshanandak/scoreeasy/pull/228). Scope is setup, board, persistence, Undo and viewer for football, basketball and field hockey. Kabaddi keeps its existing clock.

## Round 1 clock-recovery review (2026-11-09)

The implementation head (`8c4cd1d82c36ed7af6bf83518ca13c69136b5917`) passed [CI](https://github.com/harshanandak/scoreeasy/actions/runs/42526890392): 2555 passed, 6 expected failures, 187 test files. This certifies that implementation head, not later documentation or assertion-only commits.

Round-1 [test-only CI](https://github.com/harshanandak/scoreeasy/actions/runs/42526591546) (`2bfadcadd02d6af26bb2a6ebebf369462a0dc5b5`) reached 12 new failing tests, with 2537 passed and 6 expected failures. Red assertions included `expected 10 to be 40` for delayed score Undo (also after refresh), `expected 130 to be 20` for two ten-second periods, a paused keyboard score losing its null clock basis, and a keyboard score reverting period index 1 to 0. No import failure.

Score and correction Undo now restore score/event state while keeping the current clock basis. Lifecycle Undo restores the previous phase/period and paused/running intent; actual playing time accumulated since the action remains in a per-period ledger. Restarting an undone period uses its retained time. Pause/interval gaps do not count. Time after zero counts as actual playing time until the scorer explicitly ends or pauses the period.

Both scorers freeze elapsed time once at terminal save. Finish/History persistence and the terminal broadcast snapshot use that frozen state. The broadcast hook queues the terminal correction through the existing owner-checked snapshot path before draining and finalizing. The viewer renders the frozen total as `0:30 played`; it does not project a final clock from the last scoring event. Duration sums actual ledger entries rather than configured period lengths.

### Capture blocker and measurements

**All 42 existing screenshots are preserved from the pre-review capture. Affected board images still show the old 44 px controls. They are not visual proof of the new 48 px controls. Re-capture is pending for the morning**, as instructed by the owner, who is away and cannot make the T3 preview panel visible tonight. T3 screenshot calls repeatedly returned `Preview automation snapshot timed out after 15000ms`. No other browser was used.

The built app was measured through T3 DOM `getBoundingClientRect()` at both requested viewports. The current stylesheet sets every primary clock/period button to at least 48 px. The rendered paused-state controls measured:

| Sport | CSS viewport | Resume clock | End half / End quarter | Horizontal overflow |
| --- | --- | --- | --- | --- |
| Football | 360?640 | 48 px | 48 px | none |
| Football | 390?844 | 48 px | 48 px | none |
| Basketball | 360?640 | 48 px | 48 px | none |
| Basketball | 390?844 | 48 px | 48 px | none |
| Hockey | 360?640 | 48 px | 48 px | none |
| Hockey | 390?844 | 48 px | 48 px | none |

The football running-state Pause clock button also measured 48 px at 360?640. Raw six-viewport readings are in `round1-dom-measurements.json`. The 24 running/paused/period-end/half-time PNGs are marked for replacement in `screenshots.json`; the other existing images also remain labelled pre-review evidence.

Using a seeded paused 30-second fixture for each sport, the built app showed `1:30` remaining in a 120-second period. Confirmed abandonment produced a Finish screen showing `30s`; the saved match had `elapsedSeconds: 30`, `periodState.elapsed: 30`, `startedAt: null`, and `resultType: abandoned`. These DOM walks do not prove production transport. CI covers running-clock finalization and the owned backend snapshot path.

The two task preview tabs were closed. Only the port-4190 preview listener (PID 20672) was stopped. Other preview servers were not stopped.

### Round-2 threat model

1. Score, period, clock or result disagree across scorer, Finish, History and viewer, including after refresh and Undo.
2. A scoring/lifecycle action is lost, or Undo leaves score and period out of sync. Challenge delayed score Undo, paused keyboard input, resumed input and period advance.
3. Early finish is recorded as decided, or a scorer-confirmed natural end is recorded as abandoned. Include actual early-ended period durations and overtime.

## Original red proof

The test-only commit (`ba47cca8b3c98a9df32ec7f20454d86e842147fe`) ran in [CI](https://github.com/harshanandak/scoreeasy/actions/runs/42522153593). Exactly two new integration tests failed. The assertions for `Pause clock` and `End half` used `queryByRole(...).toBeInTheDocument()` and received `null`, because the board lacked those controls. The run had 2 failed, 2453 passed and 7 expected failures. This replaces the earlier missing-import failure as the feature's red proof.

The implementation and integration tests passed [CI on the intermediate head](https://github.com/harshanandak/scoreeasy/actions/runs/42523900331) (`c325101e36960bbdca9f1458dd73618ac8f2a4be`). That result does not certify later commits; the PR check list reports the current head.

## Browser walkthrough

All PNGs came from the T3 integrated browser, one preview call at a time. The app was served using `bun run build` and `bun run preview`. CSS viewport sizes are 360×640 and 390×844; captures use the browser's 2× pixel ratio.

The 42 PNGs follow `<sport>-<state>-<width>.png`. Sports are football, basketball and hockey. States are setup, running, paused, period-end, half-time, full-time and viewer. `screenshots.json` enumerates every file and its dimensions.

| Acceptance item | Walkthrough and evidence | Limit |
| --- | --- | --- |
| Setup | Captured labelled IFAB 2026/27, FIBA 5-on-5 2024 and FIH outdoor 2027 timing baselines. Custom period count and duration are editable. CI covers casual play hiding timing controls. | These are timing baselines, not complete federation officiating support. |
| Running and pause | Started a custom one-minute period for each sport, then used Pause clock. The running and paused boards were captured at both sizes. The pre-review controls measured 44 CSS px high; the boards had no horizontal overflow. Current controls measured 48 px by DOM; replacement captures are pending. | No physical-phone or sunlight check. |
| Refresh | Football's paused clock stayed at 43:33 across navigation. CI covers paused restore, resumed timing, tournament reload and running-clock reconstruction. | The browser walkthrough did not close a native app process. |
| Clock zero | Seeded stored elapsed time to the period limit, reloaded, and captured the scorer confirmation. Confirm period end led to an interval. Zero did not save a result. | Stored time was advanced to avoid waiting through full match durations. |
| Half-time and Undo | For each sport, confirmed the half-time boundary, started the next period and pressed Undo. The board returned to Half-time with Team A's score still 1. | Basketball and hockey used a stored Q2 boundary fixture. |
| Full time | Seeded the last period at its limit, confirmed its end, then separately confirmed full time and saved. The result screen recorded Team A's 1–0 win. | Earlier elapsed periods were seeded, not played in real time. |
| Extra time and corrections | CI covers two football extra-time halves, repeated basketball overtime, score attribution by period, early abandonment, and atomic Undo. Later tests cover correcting a previous period and keeping a long match's stored history linear. | See the round-1 green implementation run above; later assertion-only changes require their own head checks. |
| Viewer | Captured the shipped watch component showing `2nd half · paused` or `Q3 · paused`, totals, and score-by-period rows. | Presentation fixture only. No live Convex deployment or public match was created. |

## Viewer fixture

The files in `viewer/` build the real `MonoWatchMatch` component with local read-only Convex hook fixtures. They are separate from the application's default build. They do not add an app route or publish a match.

```sh
bun run build -- --config docs/plans/2026-11-09-goals-periods/viewer/vite.config.js
bun run preview -- --config docs/plans/2026-11-09-goals-periods/viewer/vite.config.js --port 4189
```

Open `/period-viewer/?sport=football`, `?sport=basketball` or `?sport=hockey` on that preview origin. Use a separate port from the app preview because the app's service worker handles navigation requests.

## Verification limits and deployment

No tests were run locally. Lint and type-check were run; the production build was used for the explicitly requested browser checks. The existing lint warnings remain; no gate was disabled.

The backend change adds an optional, whitelisted clock basis to live snapshots. Ownership and publication checks stay in the existing mutation/query paths. CI tests publish and read that snapshot and reject an unauthenticated write. Production sharing was not exercised. Update the development backend schema with the frontend before checking the live scorer-to-viewer path.

Old saved matches without versioned period rules keep their previous reader and timing semantics. The feature does not retrofit fabricated period scores. Matches ended before their configured end retain #221's Abandoned / no result outcome, including after a period is skipped early.

The supplied real-world scoring research did not justify a new default duration. Source-labelled baseline durations remain 2×45, 4×10 and 4×15 minutes. Shot clocks, shootout adjudication, player requirements and 3x3 are outside this PR.
