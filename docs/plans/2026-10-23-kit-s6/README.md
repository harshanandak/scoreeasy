# Kit S6: the Live tab

Decisions needed: none.

Home now links to a permanent public Live destination. The dock, desktop header and mobile menu agree: Home, Play, Live, History, Account / Sign in. With no cloud auth the account control stays absent and Live explains how to score a match.

## Evidence

Browser evidence is rung 5 in a **local Vite app with a disposable mocked `convex/react` feed**, not a production backend check. No backend was seeded or written. The harness is not committed. The baseline is the supplied master checkout (`42f9dafb8ba4c303a0cfcba556204df331339e85`), before implementation. `/live` did not exist there, so its before images show route recovery. All PNGs are headless Chrome at DPR 2.

- Before and after: Home, four-row Live list (one Paused), and Live empty at 390x844 and 360x640.
- Additional captures: loading, error, no-cloud, account, dark list / empty, and the 360 list scrolled to expose the last row above the dock.
- `browser-evidence.json` records the walkthrough and measured target sizes. At 360, five signed-out targets are 64.39-64.41 x 54px. At 390 they are 70.39-70.41 x 54px. Labels fit; no page overflow. The sport filter rail scrolls horizontally as designed.
- The reference image comes from the approved `kit-proto.html` Live list. The shipped sport badges and brand mark come from KitParts, matching Home / Play.

## Acceptance walked

- [x] List reads only `api.live.listLiveFeed`, using its whitelisted fields. Unit tests assert the query and team-colour engine output, including absent-colour defaults and zero sets.
- [x] `liveStatus` matches the spectator's strict `> 90000` boundary: 89s Live, 90s Live, 91s Paused. Unit tests cover every boundary. Timer test covers stale -> fresh; browser walkthrough advances and restores the clock while the real interval rerenders the rows.
- [x] Empty, no-cloud and query-error states offer Score a match -> `/play`; browser Back restores empty. Loading uses four quiet skeleton blocks.
- [x] Five dock targets exceed 48px at 360; measured sizes above.
- [x] Nonempty feed adds the green dot and count to the accessible name. Empty, loading, unavailable-cloud and query-error states omit the dot. Tests exercise count changes without remounting.
- [x] Live is active on `/live`; Home, Play, History and account active-state tests remain green. Header and mobile menu share the Live state. A row opens `/live/:token`; browser Back restores the list. The spectator has no app dock.
- [x] Signed-out five-tab, signed-in Account and no-cloud four-tab variants walked. Existing Clerk single-control and loading-fallback tests retained.
- [x] Dark list and empty checked. New styles use palette tokens and engine output. Palette ratchet drops from 638 to 637 after replacing the Home strip's red dot literal.
- [x] Filters contain All plus only sports in the result. Selection is ink and `aria-pressed`; All reverses filtering, and a removed sport selection falls back to All.
- [x] Home See all opens `/live`. The 30-minute freshness footnote matches the query constant.

## Follow-up

S5 owns `MonoWatchMatch.jsx`. Replace its local stale constant / comparison with `liveStatus.js` when that lane is integrated, retaining its Final-state guard. It is intentionally untouched in this PR.
