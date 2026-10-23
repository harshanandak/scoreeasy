Decisions needed: none.

Starting a second quick match used the first match's storage slot, and drafts older than 24 hours disappeared from both storage reads and resume lists. History only showed completed results. This change keeps separate resumable snapshots until confirmed deletion, and shares the same In progress component and catalog between Home and History.

The screenshots render real components with local fixtures and mocked auth/Convex. T3 `html_preview` was the only screenshot renderer. The app was built as an inline IIFE with inline CSS and fonts, inside exact phone frames. Entry motion was disabled in the fixture to capture its settled state. No live data or backend writes were used.

The product source for the after captures is `8509bbabc95534e2dc1151c6229b373a8286362f`. The before source is tracked master `4a3ba4494f47fe8294a518abdc1c95e017f075b8`. The baseline fixture uses legacy per-sport slots: cricket B overwrites cricket A, and the older volleyball draft is hidden by expiry. Its Home therefore shows only cricket B; its History shows only the completed kabaddi result. The after fixture holds all three independent records.

| Capture | Evidence |
| --- | --- |
| Before History, 390×844 light | [PNG](before-history-390x844-light.png) |
| Before Home, 390×844 light | [PNG](before-home-390x844-light.png) |
| History, 390×844 light | [PNG](history-390x844-light.png) |
| History, 360×640 light | [PNG](history-360x640-light.png) |
| History, 360×640 dark | [PNG](history-360x640-dark.png) |
| Delete confirmation, 390×844 light | [PNG](delete-390x844-light.png) |
| Delete confirmation, 360×640 light | [PNG](delete-360x640-light.png) |
| Home, 390×844 light | [PNG](home-390x844-light.png) |
| Home, 360×640 light | [PNG](home-360x640-light.png) |

All seven after captures enumerate the same three resume paths. Their new Resume/Delete controls measure at least 88.39×48 px, with no horizontal overflow. History fits the three rows at 360×640; Home is a normal vertically scrolling list. The raw console measurements are in [rendered-measurements.json](rendered-measurements.json). Its row/control selectors target the new component; baseline legacy markup is evaluated visually rather than through those counters.

Every old `clearData(quickMatchDraftKey)` call was classified. The line references below are on the baseline commit, before this change.

| Baseline path | Before → after |
| --- | --- |
| `MonoQuickMatch.jsx:503` | One draft slot per sport → a random stable match id and a separate key, with `?resume=<id>` identifying the record. Existing numeric ids remain unchanged. |
| `MonoQuickMatch.jsx:578` | Terminal hydration cleared a draft on redirect even without a completed History record → cleanup requires the completed record; an orphan snapshot stays stored. |
| `MonoQuickMatch.jsx:581–582` | A draft older than 24 hours was cleared → no age-based clearing. |
| `MonoQuickMatch.jsx:941` | Successful Finish clears the draft after saving History → retained, using the selected match's key. Failed terminal saves retain their draft. |
| `MonoQuickMatch.jsx:990` | Confirmed Discard clears the sport slot → confirmed Discard names the teams and score and deletes only the selected record. |
| `MonoQuickMatch.jsx:1036` | Starting a match cleared the existing sport draft → starting allocates a new record. |
| `MonoQuickMatch.jsx:1695` | Reset/Rematch cleared the shared draft slot → reset allocates a fresh key without deleting other unfinished matches. |
| `storage.js:145–176` | Normalization removed old active records and could silently reject a legitimate scoreless Tie while Finish then cleared its draft → no unfinished-record expiry; explicit scoreless results with a valid start timestamp are retained. The existing phantom-shell cleanup remains tested. |
| `MonoTennisLiveScore.jsx:397–400` | Old tennis drafts were cleared and redirected to setup → old per-match drafts remain resumable. |
| `MonoTennisLiveScore.jsx:749` | Discard with no changes navigated through deletion without prompting → even scoreless Discard requires a named confirmation. |
| `appEntry.js:38,53,78` | Old records were filtered out of resume surfaces → all ages remain in the catalog, sorted by the latest saved time. |
| `MonoHistory.jsx:273` | Only completed results were listed → the shared In progress section appears above completed results. |

The web and native leave guards did not clear drafts. Their copy now says the match is saved, and an actual router regression confirms that leaving preserves the exact snapshot and resumes its score and Undo from Home. Guided cricket and tournament scorers already stored snapshots per fixture; those storage and scoring rules stay in place. The catalog now exposes started tournament fixtures directly. Deleting one resets only that fixture's progress and preserves the tournament draw and other fixtures.

The acceptance walk is backed by real storage and scorer tests, with cloud services mocked:

- Start cricket A, score 4, leave, start cricket B, score 6: both remain independent; Home and History expose the same paths.
- Migrate old cricket, volleyball and kabaddi slots: score, state and Undo snapshots survive; a quota failure leaves the original slot reachable. Old tennis and Test-cricket records remain listed.
- Confirm the leave guard: the stored snapshot stays identical, Home resumes it, and Undo restores the prior point.
- Cancel board Discard and History Delete: both records remain. Confirm deletion: only the selected record disappears. A scoreless tennis match also requires confirmation.
- Resume volleyball at 12–9, Undo to 11–9, Finish: the selected match moves into completed History and the other match remains active.
- Finish an explicitly started scoreless cricket or volleyball match: the 0–0 result remains in History. The phantom-result cleanup assertion is unchanged.
- Resume cricket innings 2 and Undo its delivery without changing another cricket match; resume kabaddi and Undo its score; resume tennis set 2 with games and point state, then Undo the point.
- Preserve an orphan terminal snapshot when its completed History record cannot be found.
- Delete one started tournament fixture: its peer's saved history is unchanged.
- Reload with an unchanged device clock: newly minted match identities remain distinct.
- Migrate a legacy numeric id of `0`, resume it from Home, and Finish: the same id and score remain in completed History.

Validation results are recorded in the PR. The full suite preserves the existing expected failures, including the storage-full-at-boot audit. No colour literals, palette exemptions, scoring rules, live outbox changes, Convex changes, or gate bypasses were introduced.

Storage full at boot remains a separate existing bug (Forge `7a50f38f-f619-445d-b791-68a16a422433`), as scoped by the brief. A tooling follow-up records the unavailable Forge skill adapter commands (Forge `200b8afc-e843-4e67-ab10-414a9f76f5df`). The Home audit issues are `82315578-d10f-4de3-b089-bc99c4fa9913` and `6fc57130-4f71-404c-b4a2-673929ba16b8`.

The source and test file inventory follows.

<!-- file inventory -->

- [`src/designs/design1-mono/KeepEveryMatch.test.jsx`](../../../src/designs/design1-mono/KeepEveryMatch.test.jsx)
- [`src/designs/design1-mono/MonoHistory.jsx`](../../../src/designs/design1-mono/MonoHistory.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.badmintonBoard.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.badmintonBoard.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.basketballBoard.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.basketballBoard.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.broadcast.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.broadcast.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.cricketBoard.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.cricketBoard.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.hardening.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.hardening.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.lastLine.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.lastLine.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.pointCue.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.pointCue.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.restoreNotice.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.restoreNotice.test.jsx)
- [`src/designs/design1-mono/MonoQuickMatch.tabletennisBoard.test.jsx`](../../../src/designs/design1-mono/MonoQuickMatch.tabletennisBoard.test.jsx)
- [`src/designs/design1-mono/components/InProgressMatches.jsx`](../../../src/designs/design1-mono/components/InProgressMatches.jsx)
- [`src/designs/design1-mono/components/inProgressMatches.css`](../../../src/designs/design1-mono/components/inProgressMatches.css)
- [`src/designs/design1-mono/index.jsx`](../../../src/designs/design1-mono/index.jsx)
- [`src/designs/design1-mono/landing/DashboardLanding.jsx`](../../../src/designs/design1-mono/landing/DashboardLanding.jsx)
- [`src/designs/design1-mono/routes.contract.test.jsx`](../../../src/designs/design1-mono/routes.contract.test.jsx)
- [`src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx`](../../../src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx)
- [`src/designs/design1-mono/scoring/MonoCricketTestLiveScore.jsx`](../../../src/designs/design1-mono/scoring/MonoCricketTestLiveScore.jsx)
- [`src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx`](../../../src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx)
- [`src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx`](../../../src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx)
- [`src/designs/design1-mono/scoring/MonoTennisLiveScore.jsx`](../../../src/designs/design1-mono/scoring/MonoTennisLiveScore.jsx)
- [`src/mobile/backButton.js`](../../../src/mobile/backButton.js)
- [`src/mobile/backButton.test.js`](../../../src/mobile/backButton.test.js)
- [`src/utils/appEntry.js`](../../../src/utils/appEntry.js)
- [`src/utils/appEntry.test.js`](../../../src/utils/appEntry.test.js)
- [`src/utils/inProgressMatch.js`](../../../src/utils/inProgressMatch.js)
- [`src/utils/keepEveryMatch.test.js`](../../../src/utils/keepEveryMatch.test.js)
- [`src/utils/quickMatchDrafts.js`](../../../src/utils/quickMatchDrafts.js)
- [`src/utils/storage.js`](../../../src/utils/storage.js)
- [`src/utils/storage.test.js`](../../../src/utils/storage.test.js)
