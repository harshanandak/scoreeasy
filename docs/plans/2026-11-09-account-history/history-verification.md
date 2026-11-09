# Account History evidence

Decisions needed: none.

PR A implements the read side of forge-1013 independently of guest-upload PR B.

The test-only commit was pushed first. [Red CI](https://github.com/harshanandak/scoreeasy/actions/runs/42598348765) reported `Validator error: Unexpected field paginationOpts in object` and `Failed to resolve import "./accountHistory"`. The subsequent [implementation CI](https://github.com/harshanandak/scoreeasy/actions/runs/42599678522) passed on implementation commit `2d83ae210f016b6121715daee1935b6bc0db9540`. Evidence and an additional active-account binding fix follow that implementation; consult the PR for checks on its current head.

Acceptance walkthrough:

- Identity and ownership: Convex tests reject guests and another scorer, include only the caller's matches, and exercise two pages sorted by match date. The read uses the operator/date index and caps each page at 100; the UI requests 50.
- Union and deduplication: tests keep an unsynced local revision, replace an acknowledged local summary with its account result, deduplicate by clientMatchId, and sort newest first.
- Shared phone: component tests open X's cloud result, sign out, then switch to Y with stale X query results. X's rows and details sheet disappear. Cloud documents are never written into local history.
- Local fallback: loading and offline component tests retain local results. A query error is contained by a History-specific fallback.
- Cloud-only result: the existing details sheet shows the saved score and winner, labels the result read-only, and provides no Delete or Rematch action. Saved summaries do not contain a restorable scoring board; the UI states that limitation.
- Signed-out History: `history-signed-out.png` shows a local football result.
- Signed-in History: `history-account.png` shows the local football result and a cloud volleyball result, newest first.
- Cloud details: `history-cloud-details.png` shows the stored 3–1 result and Falcons winner in the read-only sheet.
- Offline History: `history-offline.png` shows local and already available mocked account results with the offline notice.

Screenshots were captured only in T3's integrated browser at a 390×844 CSS viewport (device pixel ratio 2). The isolated worktree had no Clerk configuration, so the committed showcase supplies a mocked account and result documents to the real History content component. It does not call Clerk or write to Convex. Its fixture storage was restored after capture.

Evidence levels: CI executes the privacy, merge and component tests (rung 4 for the code paths; the linked CI run is externally re-fetched evidence). The integrated browser renders the actual UI with mocked data (rung 5 for that showcase only). Production Clerk/Convex behavior and real cross-device sign-in remain unverified. No local tests ran. Local lint and type-check passed; evidence compression and size checks passed. No sport calculations changed.
