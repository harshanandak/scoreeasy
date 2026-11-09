# Guest upload evidence

Decisions needed: none. Upload is automatic, using the approved default.

PR B implements the write side of forge-1013 independently of History PR A.

The test-only commit was pushed first. [Red CI](https://github.com/harshanandak/scoreeasy/actions/runs/42598413311) reported `Failed to resolve import "./guestMatchUploads"`. No fix was pushed until that failure was fetched. Consult the draft PR for checks on the final head; this artifact does not claim they passed.

Acceptance walkthrough:

- Guest quick matches and completed tournament fixtures are claimed synchronously for the first account before the existing pending-save queue receives them. The claim survives refresh and stale local match snapshots. Client match ids retain server-side deduplication.
- Unit tests cover claim-once behavior, X then Y, a previously owned result, a stale board overwriting sync metadata, and a claim that cannot be persisted. Failed claim persistence leaves the match local for a later retry.
- Active guest matches are left intact. A test completes one later and verifies it can then be claimed. Existing scoring and completion paths continue to handle in-progress matches after sign-in.
- Offline tests retain the owner-bound queue through a hook remount, then reconnect and acknowledge one save. The existing queue supplies IndexedDB fallback, retry backoff, browser/native foreground recovery and expectedOwnerId enforcement.
- The shared enqueue boundary refuses a local result or guest claim bound to another account. A quick-board caller receives idle instead of reporting a rejected enqueue as pending.
- The notice counts only acknowledged results, persists a consumed receipt, and disappears when the active account changes. Hook tests hold the server promise open to verify no premature saved notice.
- `guest-sign-in-notice.png` shows two real queue records acknowledged by the showcase's fake server and the resulting `2 matches saved to your account` notice.
- `guest-account-switch.png` shows the subsequent account switch without X's saved notice. Automated tests assert no X records are sent for Y.

Screenshots were captured only in T3's integrated browser at a 390×844 CSS viewport (device pixel ratio 2). The showcase uses the real claiming, pending-save and notice code with fake account controls and a local fake server acknowledgement. It does not authenticate with Clerk or write to Convex. Production sign-in, real backgrounding and cross-device delivery remain unverified.

Evidence levels: the red CI run is externally verified; newly added green-path tests await final-head CI. Browser behavior is rung 5 for the mocked showcase only. No local tests ran. Commit hooks run lint and type-check. Evidence was compressed and checked with the repository scripts. No sport calculations changed.
