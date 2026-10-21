# Stability and reliability audit (2026-10-21)

**Decisions needed:** sport-rule alignment (SA-12), public-profile privacy (SA-16), and ownership of shared dev deployment recovery (SA-05). These are follow-up decisions; this audit PR makes no rule, application, or deployment changes.

**Why this exists.** Harsha, 2026-10-21: "we need to improve application stability and reliability." AGENTS.md has two non-negotiables that matter most here: *the scorer never loses a point*, and *the board stays truthful*. The original audit found failures of both on the base below.

- **Storage.** When device storage is full, points go into memory and vanish on refresh.
  - Nothing tells the scorer.
  - A full disk at boot hides every match already saved on the device.
- **Badminton cap.** In a tournament, a game at 30-29 never ends. In a quick match, the same score ends it.
- **Undo.** Undoing back to 0-0 is not saved. A refresh brings the undone point back.

Everything below has evidence: a browser run, a failing test, or a quoted `file:line`.

**Scope.** Out of scope, because other audits own them:
- routing correctness (only crash-causing routing items are listed here)
- colour and design
- flaky tests (#159)
- game-registry changes (`feat/icp-game-focus`)

**Base.** Original audit: `origin/master` at `9f263b1`. Recovery fetched `origin/master` again on 2026-10-21 and confirmed the same commit (`9f263b1a88d82ddcbf15b891a60ce51126a75c60`); no merge was needed. Source references below refer to that base, not another worker's branch.

## Recovery evidence and limits

The previous worker committed this report and four expected-failure tests in `fdf8674`. Its browser observations, deployment inventories, and build measurements are **historical evidence**, retained from that report. The external browser script, screenshots, recording, and raw deployment inventories are not attached to this PR. No fresh browser sweep, native-device run, or deployment read/write was performed during recovery. Treat **B** as previously reported rung 5, not independently reverified rung 5; **C** as rung 2 source evidence; **T** as rung 4 executable evidence; and **S** as an unproven scenario.

Fresh recovery checks and ownership boundaries are recorded below. A passing `it.fails` is evidence that an assertion still fails, not evidence of a fix. Fix PRs must convert the relevant test to ordinary `it` and prove the corrected behavior.

### Fresh recovery acceptance checklist (2026-10-21)

- [x] Read `AGENTS.md`, `CODING_STANDARDS.md`, `README.md` and the existing audit; work only in the supplied worktree on `docs/stability-audit`.
- [x] Fetch the remote base and confirm the original commit is preserved. Re-read the cap ordering, storage-backend selection, completed tennis/cricket autosave guards, goals draft fields and provider-tree switch on `origin/master` (rung 2).
- [x] Run `bun run test -- src/designs/design1-mono/scoring/MonoSetsLiveScore.stability.test.jsx src/utils/storage.stability.test.js`: two files passed, four expected failures (rung 4).
- [x] Temporarily run those four cases as ordinary `it`: all four failed for the documented cap, storage, undo and cross-team assertions; restore both files byte-for-byte afterward (rung 4). The temporary conversion is not committed.
- [x] Read the live Forge inventory and verify every SA-01 through SA-20 ID against the report: 20 issues, four P0 and sixteen P1, all open with acceptance criteria. No issue was closed or duplicated.
- [x] Separate historical browser/deployment evidence from fresh checks and identify parallel ownership overlaps. No app fixes or deployment operations are included.

Commit/push hooks run lint, type checking, agent-config synchronization, the full test suite and a build. Their final outcomes and the hosted-check snapshot belong in the PR handoff; the focused checks above do not substitute for those hooks. Native behavior and the historical browser table still need fresh proof in the relevant fix PRs.

## Original audit method (historical)

- **Browser sweep.**
  - Headless Chrome 155 driven over the Chrome DevTools Protocol: a ~100-line Node script kept outside the repo. No new dependencies.
  - 390×844 mobile viewport with touch emulation, guest (signed out).
  - `bunx vite --port 5194` against the shared **dev** Convex deployment `notable-hippopotamus-913`.
  - Per screen, it captured console errors and warnings, uncaught exceptions, failed or 4xx/5xx requests, and ErrorBoundary fallbacks.
  - Scripted flows:
    - start, score, refresh and undo for a sets sport (volleyball, badminton), a goals sport (football), cricket T20 and tennis
    - a badminton round-robin tournament played to 30-29
    - double-tap timing
    - localStorage filled to quota mid-match
    - booting offline, then firing `online`
- **Code reading.** Scoring, persistence, outbox, auth bootstrap, ErrorBoundary placement, service worker and the Capacitor glue.
  - Two parallel read-only passes, then spot-checked.
  - Every P0 and P1 below was re-read by hand, or reproduced.
- **Build.** `bun run build` (vite 6.4.2, vite-plugin-pwa 1.3.0).
- **Convex.** `functionSpec` of the dev and prod deployments (read-only).

**Expected-failure tests added.** These are the only code in this PR. Each encodes the intended behavior as `it.fails`. The previous worker reported also running each as plain `it` to confirm the reason for failure. Recovery validation is recorded separately below. When a fix makes an assertion pass, Vitest reports the unexpected pass as a failure until the test becomes ordinary `it`. An unrelated harness failure could also satisfy `it.fails`, so inspect ordinary-test failure reasons when maintaining these tests.

| Test | Finding | Fails today because |
|---|---|---|
| `src/designs/design1-mono/scoring/MonoSetsLiveScore.stability.test.jsx` › SA-01 | Badminton 30-point cap | `Unable to find … /wins Set 1!/` after 29-29 → 30-29 (a guard asserts the 29-29 draft really restored) |
| same › SA-07 | Undo-to-zero not persisted | `expected 1 to be +0`: the last saved draft still holds the undone point |
| same › SA-11 | Cross-team tap dropped | `Beta: 0 points`: a tap on Team B 60 ms after Team A is ignored |
| `src/utils/storage.stability.test.js` › SA-02 | Storage full at boot hides saved data | `expected null to deeply equal { phase: 'scoring' }` |

## Historical per-screen console and crash table (guest, 390×844, dev deployment)

Noise present on every screen, and not listed per row:
- `Manifest: Line: 1, column: 1, Syntax error`. In dev, the PWA plugin does not serve `/manifest.webmanifest`, so the SPA fallback returns `index.html`. P3.
- Clerk's "development keys" warning. Expected in dev.

`Blocked call to navigator.vibrate` appeared on synthetic scoring taps without user activation. Real-device haptic behavior was not verified.

| Screen | Renders? | Errors captured | Notes |
|---|---|---|---|
| `/` (no draft) | yes → `/marketing` | none | |
| `/` (one quick draft) | yes → resumes `/volleyball/quick` | none | Shows "Resumed your in-progress quick match on this device." |
| `/marketing`, `/privacy` | yes | none | |
| `/app` dashboard (no data) | yes | **uncaught** `[CONVEX Q(live:listLiveFeed)] Could not find public function for 'live:listLiveFeed'` + "The above error occurred in the `<LiveNowStrip>` component" | Caught by the silent boundary at `DashboardLanding.jsx:768`, so the strip just disappears. **Every load**, not only after a quick match (see SA-05). |
| `/app` with an in-progress quick match | yes, **wrong** | same LiveNowStrip throw | Says "Play your first match. Your matches will appear here." The 6-4 volleyball match in progress is not shown (SA-19). |
| `/app` after a finished match | yes | same LiveNowStrip throw | "LAST MATCH FOOTBALL TEAM A 1 — 0 TEAM B" is correct. |
| `/play` | yes | none | |
| `/volleyball/quick`, `/football/quick`, `/cricket/quick`, `/tennis/quick` (setup) | yes | none | |
| volleyball quick scoring | yes | none (quota run: `QuotaExceededError` warnings only, see SA-02 and SA-03) | Refresh keeps 3-1. Undo after refresh is correct twice. |
| football quick scoring | yes | none | Refresh keeps 1-2. Undo after refresh is correct. "End match?" confirm works. |
| cricket T20 quick scoring | yes | none | 1, 4, wide → 6/0 (0.2). Refresh keeps it. Undo removes the wide, then the 4. OUT records 1/1. |
| tennis quick scoring (`/tennis/quick/live/:id`) | yes | none | Refresh keeps game 1 plus 15-0. Undo after refresh is correct. |
| quick match result screen | yes | none | "Match saved to History on this device." **Refreshing the result screen lands on Setup.** The data is safe in History; only the result view is lost (P2). |
| `/history` (Matches and Stats tabs) | yes | none | The finished match is listed, and the stats agree with it. |
| `/statistics` | redirects to `/history` | none | |
| `/volleyball/tournament`, `/football/tournament`, `/tennis/tournament` (list) | yes | none | |
| `/badminton/tournament/new` → create, `/cricket/tournament/new` | yes | none | 4-step wizard; the tournament was created. |
| badminton tournament scorer `/…/match/:mid/score` | yes, **wrong** | none | 30-29 does not end the game (SA-01). Undo to 0-0 then refresh comes back as 1-0 (SA-07). |
| `/volleyball/tournament/does-not-exist` | recovery panel | none | "Tournament not found" |
| `/volleyball/tournament/x/match/y/score` | recovery panel | none | "Match not found" with 4 recovery actions |
| `/volleyball/tournament/x/match/y/result` | recovery panel | none | "Result unavailable" |
| `/tennis/quick/live/nope` | recovery panel | none | |
| `/cricket/quick/test-match/nope` | **"Loading..." forever** | none | No not-found state (SA-09). |
| `/game/nope` | recovery panel | none | |
| `/notasport/quick` | "Page not found" | none | |
| `/profile` (guest), `/profile/nobody-xyz` | yes | none | |
| `/users/search` | yes | none | |
| `/login` | yes (Clerk) | none | |
| `/onboarding` (guest) | redirects to `/login?returnTo=/` | none | |
| `/live/not-a-real-token` | **"App route crashed"** (route-level boundary) | **uncaught** `[CONVEX Q(live:getByToken)] Could not find public function for 'live:getByToken'` | The dev deployment lacks the live functions (SA-05). `MonoWatchMatch` also has no local boundary, so *any* server error takes down the spectator's whole route, prod included. |

## LiveNowStrip throwing on the dashboard (forge `livenowstrip-throws-on-the-a1784d4e`)

**Historical diagnosis.** The reported missing-function errors match the reported dev deployment inventory. This does not establish the deployment's current state or rule out separate code failures.

- `functionSpec` of the dev deployment `notable-hippopotamus-913` lists only 16 functions, all in `users.js`, `matches.js` and `teams.js`. It has **no `live.*` functions**.
- Prod (`tremendous-anaconda-408`) has the full `live.*` set.
- So in dev, `useQuery(api.live.listLiveFeed, …)` (`LiveNowStrip.jsx:14`) throws on **every** `/app` mount. "After leaving a quick match" is simply the most common way people land on `/app`.
- The silent boundary (`DashboardLanding.jsx:768`, `fallback={null} captureToSentry={false}`) hides it, apart from the dev console.

**Origin of the drift is unknown.** The previous worker reported finding `convex/live.ts` in all nine inspected local checkouts. That snapshot cannot identify which checkout, branch, machine, or deployment command produced the deployed function inventory. A shared dev deployment still needs coordinated ownership.

**Effects in dev.**
- `/live/:token` crashes.
- Going live cannot work.
- Any demo recorded on dev shows a dashboard without the strip.

**Fix (needs Harsha; not done here).** It touches shared state other sessions may be using.
- Re-push dev from current master with `npx convex dev --once`.
- Better: give each worktree or agent its own dev deployment, so one session's push cannot strip functions from another.
- Code side: give `MonoWatchMatch` its own boundary (SA-05). Let the strip's boundary log in dev, so drift like this is visible.

A root-cause comment was added to the forge issue.

## Tap guard: does the 150 ms debounce lose points? (coordinator question)

**How it works.**
- Every scorer has **one** `lastClickRef` per screen, and a tap within 150 ms of the previous accepted tap returns silently (`if (now - lastClickRef.current < 150) return;`).
- That ref is shared by **both teams and every action**:
  - `MonoQuickMatch.jsx:1055, 1080, 1107, 1273, 1466`
  - `MonoSetsLiveScore.jsx:240, 341`
  - `MonoGoalsLiveScore.jsx:230`
  - `MonoTennisLiveScore.jsx:429`
  - `MonoCricketLiveScore.jsx:227–447`
  - `MonoCricketTestLiveScore.jsx:345–418`
- Guided cricket has **no guard at all** (`MonoCricketGuidedScorer.jsx:166-176`).

**Measured** on quick volleyball, headless Chrome, `click()` dispatched at controlled intervals:

| Input | Expected | Got |
|---|---|---|
| Team B, second tap after 40 ms | +2 | +1 |
| Team B, second tap after 120 ms | +2 | +1 |
| Team B, second tap after 180 ms | +2 | +2 |
| Team A, then Team B 100 ms later | A+1, B+1 | A+1, **B+0** |
| Team A ×8 at 60 ms (pointerdown/up + click) | +8 | +3 |
| Badminton tournament: Team 1, then Team 2 at 60 ms (unit test SA-11) | B+1 | B+0 |

**Assessment.**
- **Touch-device protection is unverified.** This sweep used synthetic input and did not measure accidental physical double taps or device event delivery.
- **It drops distinct synthetic input.** The measured cross-team and repeated-tap cases fall inside the shared window. A scorer entering multiple missed events could encounter the same guard; actual device input needs a follow-up run.
- **The drop is silent.** No haptic, no flash, and the "Last: …" ticker stays on the previous action.
- **The board stays internally consistent.** The history agrees with what is shown. So this is P1, not P0, but it is a lost point the scorer did not choose to lose.
- This also explains the colour audit's "8 rapid synthetic taps register as one".

**Recommendation: replace the guard, don't shorten it.**
1. Guard **per target button**, never across teams or actions.
2. Evaluate gesture identity and keyboard input rather than assuming a shorter time window is safe. Neither a replacement algorithm nor a safe duration was validated by this audit.
3. Give every accepted tap the existing haptic plus a press animation. Never ignore a tap silently: if one is rejected (for example while scoring is locked), flash the button.
4. Add the same guard to guided cricket.

Tracked as **SA-11** with test `SA-11` (`it.fails`).

## Findings

Severity:
- **P0:** can lose a point or a match, or crash the scorer.
- **P1:** stuck screen, wrong data shown, or broken recovery.
- **P2:** noisy errors or degraded UX.
- **P3:** hygiene.

**How each was checked:**
- **B:** previously reported browser reproduction (historical rung 5; artifacts unavailable here).
- **T:** executable expected-failure test (rung 4 when freshly run).
- **C:** source inspection (rung 2); scenario and absence claims remain unproven at runtime.
- **S:** suspected; needs a device or more repro (unproven).

### P0: can lose a point or match

| ID | Finding | Evidence | Repro | Scorer impact | Forge |
|---|---|---|---|---|---|
| SA-01 | Badminton tournament game never ends at the 30-point cap | `MonoSetsLiveScore.jsx:193-196` checks `max - min < winBy` *before* `maxPoints` (and the same at `:179-180` for single-game). Quick match gets it right in `quickMatchSets.js:41`. | Badminton round-robin, score to 29-29, then Team 1 +1. The board stays at "SET 1 OF 3, 30–29". Quick match at the same score moves to set 2. **B, T** | The board breaks the BWF rules. The game runs past 30, and standings and history record an impossible score. | `b698365e-92df-488b-ab8c-6fde42a8d0f9` |
| SA-02 | Storage full at boot means a memory-only session that hides every saved match | `storage.js:186-205`: one test write at import; if it throws, `getStorage()` returns a memory store for reads **and** writes. The original source pass found no consumer of `isPrivateMode` (`:447`); that absence is not a runtime guarantee. | Fill localStorage mid-match, score 3, reload. The page lands on the **Setup** screen and the match is invisible. **B, T** | Writes after quota can fail and previously saved data becomes hidden after reload, without a warning. Private-mode behavior needs browser-specific verification. | `7a50f38f-f619-445d-b791-68a16a422433` |
| SA-03 | Autosave failures are swallowed while the board shows the point | Return value ignored at: `MonoQuickMatch.jsx:588`, `MonoSetsLiveScore.jsx:402`, `MonoGoalsLiveScore.jsx` (~`:323`), `MonoCricketTestLiveScore.jsx:649,655`, `MonoTennisLiveScore.jsx:516` (quick) and `MonoCricketGuidedScorerRoute.jsx:162`. `handleComplete2` (`:257-258`) navigates away even when the save failed. Only `console.warn` fires (`storage.js:223,270`). | Same quota run. The board showed 2–3, the saved draft held `[{score1:2,score2:0}]`, and three `QuotaExceededError` console warnings appeared with no UI. **B** | The scorer keeps scoring into nothing. | `6c1a0fa5-9462-4cf3-a150-297d77606f9d` |
| SA-04 | The match-winning point or ball is never autosaved | Autosave early-returns once complete: `MonoTennisLiveScore.jsx:513`, `MonoCricketLiveScore.jsx:629`, `MonoCricketTestLiveScore.jsx:639`. Super-over state is missing from `draftState` (`MonoCricketLiveScore.jsx:476-488, 632-641`). | Tennis at match point: win the point, then refresh (or be backgrounded and killed, or hit SA-06) before tapping Save. The board reopens one point earlier. **C** | The deciding point is lost, and a super over restarts. | `0bc3c8a0-36f9-4584-9051-95d08e9cfd03` |

### P1: stuck screens, wrong data, broken recovery

| ID | Finding | Evidence | Repro | Impact | Forge |
|---|---|---|---|---|---|
| SA-05 | Dev Convex deployment lacks every `live:*` function, and `/live/:token` has no local boundary | `functionSpec` (dev vs prod, above); `MonoWatchMatch` is covered only by the route boundary (`index.jsx:1772`) | Open `/app` (strip throws) or `/live/anything` ("App route crashed"). **B** | Dev demos and live sharing are broken. In prod, any transient query error blanks the spectator page. | `11d4379b-c56d-4190-a8fa-7018110fc591` |
| SA-06 | Coming back online remounts the whole app mid-match | `main.jsx:236-258` flips local→cloud on `online`. The root element changes from `<ConvexProvider>` (`:352`) to `<Suspense><CloudAuthRoot>` (`:324`), which forces a full unmount. On native the same happens when the probe flips (`:262-316`). | Boot offline, score, open "End match?", fire `online`. The DOM marker is gone and the sheet is closed; the score survives through the draft. **B** | Anything not persisted is lost: SA-04, SA-08, SA-10, open sheets, and the in-flight sync. | `ef68c0b5-97d7-45c0-a120-618c111e20a1` |
| SA-07 | Undo back to 0-0 is not saved, so a refresh resurrects the point | `if (history.length === 0) return;` at `MonoSetsLiveScore.jsx:388`, `MonoGoalsLiveScore.jsx:312`, `MonoTennisLiveScore.jsx:513`, `MonoCricketLiveScore.jsx:630` and `MonoCricketTestLiveScore.jsx:640` | Badminton tournament: tap, Undo (0–0), reload. It shows 1–0. **B, T** | The board disagrees with the undo the scorer made. Quick match is fine. | `35cbce6e-7e28-49de-826a-204bb3e46904` |
| SA-08 | Uncancelled 300 ms timers override undo | Test cricket: `setTimeout(() => advanceInnings(updated), 300)` inside updaters (`MonoCricketTestLiveScore.jsx:366,398,403,439,468`); undo (`:492-500`) cannot cancel it. Goals points-mode auto-finish (`MonoGoalsLiveScore.jsx:266-290`) saves closure scores and navigates away. | At 9 down, Wicket then Undo within 300 ms: innings 2 starts anyway. Goals target 11, reach 11, Undo at 200 ms: the match is saved as 11. **C** | The innings or match ends against the scorer's undo. | `8b0316bd-bcda-40b9-877a-f4188f5dd5dc` |
| SA-09 | Test cricket: follow-on and result not persisted, idle matches pruned, quick Test route spins forever | `followOnPrompt`/`matchComplete`/`matchResult` are not in `draftState` (`MonoCricketTestLiveScore.jsx:506-512, 641-646`). In-progress quick matches idle more than 24 h are deleted on read (`storage.js:108-116, 137-138, 388-394`). No not-found state on `/cricket/quick/test-match/:id`. | Refresh at the follow-on prompt and the board is stuck. A rest day deletes the Test. `/cricket/quick/test-match/nope` shows "Loading..." forever. **B** (Loading) **, C** | The scorer is stuck or the match is deleted. | `d6656085-2cc6-49c0-976e-7203e308285f` |
| SA-10 | Goals tournament clock and overtime reset on refresh | `MonoGoalsLiveScore.jsx:313-323` saves only `{score1, score2, history, savedAt}`; quick match does persist the clock (`MonoQuickMatch.jsx:285-291, 612`). | Timed football tournament at 30:00, refresh: the clock reads 0:00. **C** | Match length is wrong. | `134b5fe0-df42-4fe2-af45-2e1fb5924145` |
| SA-11 | A shared 150 ms tap guard silently drops fast and cross-team taps | See the tap-guard section above. | **B, T** | Lost taps with no feedback. | `ab161889-442c-42f5-8edf-3ca42078c4c3` |
| SA-12 | **Decision needed:** volleyball 27-point cap and badminton serve differ between quick match and tournament | Volleyball quick caps sets at 27 (`sportDefaults.js:12` → `quickMatchSets.getSetWinRule`); tournament volleyball has no cap (`sportRegistry.js`). Badminton/pickleball serve goes to the rally winner in quick (`MonoQuickMatch.jsx:762, 1257`) but alternates every point in tournament (`sportRegistry.js:53, 141`, `MonoSetsLiveScore.jsx:213-216`, locked by `MonoSetsLiveScore.test.jsx:252`). | The same rallies produce two different boards. **C** | The board disagrees with the rules: FIVB has no cap, and in BWF the rally winner serves. This is a sport-rule change, so it is Harsha's call. | `53d0d0ea-d7c5-49cc-b4a0-61f535c11f6e` |
| SA-13 | Finished matches are never retried to the cloud, but the offline banner promises they will be | Sync state lives in refs (`useMatchSync.js:37-38`); retry is only a button (`MonoQuickMatch.jsx:943-965`); matches finished offline or signed out are skipped (`:858-862`); tournament saves use `saveMatchMutation(payload).catch(() => {})` (`MonoSetsLiveScore.jsx:94` and Goals/Tennis/Cricket/Test); quick tennis, quick Test and guided cricket never sync. `OfflineFallback.jsx:74` says "Cloud sync and sign-in will resume when the connection is back" (seen in the sweep). | Finish a match offline, then reconnect: nothing syncs. **B** (copy) **, C** | Cloud history silently misses matches, and the copy says otherwise. | `d8c42ce8-9555-46b8-9da3-b501bb1be873` |
| SA-14 | No root error boundary, and the route boundary never resets | Providers and shell sit outside any boundary: `main.jsx:324-361`, `App.jsx:5-14`, `CloudAuthProvider.jsx:31`, and the shell at `index.jsx:1765-1768, 1834`. `ErrorBoundary.jsx` has no reset key. | Crash `/history`, then tap Home in the bottom nav: the URL changes but "App route crashed" stays. A provider throw gives a white screen. **C** | Stuck screen. "Try again" re-crashes. | `591852ea-964f-4784-b5f0-25d91af55006` |
| SA-15 | Stale tab after a deploy: lazy chunks 404, and the reload can fire mid-match | `skipWaiting`/`clientsClaim`/`cleanupOutdatedCaches` (`vite.config.js:44-46, 111-112`). The controller-change reload runs once per tab session and unconditionally (`main.jsx:158-166`). No `vite:preloadError` anywhere. The SPA fallback serves `index.html` for missing `/assets/*` (`wrangler.jsonc`) under `nosniff` (`public/_headers`). | Two deploys in one session, then open a lazy route: "Failed to fetch dynamically imported module", then "App route crashed". **C** | Crash after a deploy, or a reload on the scorer. | `01582321-9007-4bc7-b345-295a4a3228b9` |
| SA-16 | Public username queries return raw match documents without identity | `convex/matches.ts:211-231`: `getPublicUserStatsByUsername` / `getPublicRecentByUsername` are plain `query()` and return full `matches` docs. `teams.search` is unauthenticated too. | Call `getPublicRecentByUsername({username})` signed out. **C** | Breaks "a match is private to its scorer until shared". Needs a decision on what a public profile shows. | `f210fff9-5107-400a-830b-d5951e7a92b3` |
| SA-17 | Native launch deep link replays on every navigation | The effect deps include `navigate` (`index.jsx:1601-1604`), whose identity changes per pathname in react-router 7. `App.getLaunchUrl()` is re-read every time (`deepLinks.js:66-72`). | Cold-launch from a `/live/X` link, then navigate: the app is pulled back, or a spurious Leave prompt appears. **C, S** (needs a device) | Navigation hijack mid-match. | `0f63165d-0168-4024-8a11-f346b4e0fa3a` |
| SA-18 | Live outbox: a permanent error blocks the queue, and earlier match events are dropped | `outbox.js:113-123` stops at the first failure. `useLiveBroadcast.js:92-97` drops only `match_final`. Plain `Error`s at `convex/live.ts:197-199` stay at the head with no backoff or cap. Events from the previous match are dropped (`useLiveBroadcast.js:63-65`). The `saveSession` result is ignored (`:109`). | The live match is deleted or the account changes mid-match: the spectator board freezes while the scorer still sees LIVE. **C** | Spectators see the wrong score, and `se_outbox` grows toward quota (feeds SA-02). | `2f2ce343-5c01-4dab-80d3-db2a7f8c79c3` |
| SA-19 | The dashboard ignores an in-progress quick match | `readDashboardState` (`DashboardLanding.jsx:723-736`) never reads `se_quickmatch_draft_*` (`appEntry.js:9`). | Volleyball quick match in progress at 6–4, open `/app`: "Play your first match". **B** | The match looks lost. Recovery depends on `/` auto-resume. Related: `dashboard-live-now-band-35e51f04`. | `82315578-d10f-4de3-b089-bc99c4fa9913` |
| SA-20 | A signed-in scorer can sit on a loading screen after refresh on captive or flaky wifi | `OnboardingGuard` (`index.jsx:367-372`) gates every route on `isLoading` (`CloudAuthProvider.jsx:126-131`). Web has no timeout. | Online but Clerk blocked, refresh mid-match. **S** (the gate is verified in code, not reproduced) | Locked out of the live board. | `02d3daac-0e70-40b8-8013-239c2347d141` |

### P2: noisy errors, degraded UX (no forge issue; fold into the PRs below)

- **Updater side effects under `React.StrictMode`** (`main.jsx:366`). `MonoSetsLiveScore.jsx:281,299,325` (serve rotation, `setCurrentSet`, confetti inside `setSets`), the Test-cricket timers and `useGameSession.js:84`. Dev only, but demos run on `bun run dev`.
- **Guided cricket:**
  - no undo of the innings-ending or match-winning ball (`MonoCricketGuidedScorer.jsx:131-141`)
  - the all-out check ignores `lastManStands` (`MonoCricketGuidedScorerRoute.jsx:44-47`)
- **A malformed saved draft can crash-loop (suspected).** Restore checks only top-level types (`MonoQuickMatch.jsx:559`, `MonoSetsLiveScore.jsx:151`). `/` auto-resumes it (`appEntry.js:92-100`), and the boundary has no "discard draft" action.
- **`loadSportTournaments` throws** on a stored object or a `null` element (`storage.js:347, 360-368`).
- **Convex functions throw plain `Error`.** Prod redacts these to "Server Error". Onboarding matches on message strings (`MonoOnboarding.jsx:925-935`), and `useMatchSync.js:58` shows `error.message`.
- **Duplicate archive rows.** Live `finalize` dedupes by a `clientMatchId` that never equals the save path's id (`live.ts` finalize vs `MonoQuickMatch.jsx:770, 876`, `tournamentSync.js:123`).
- **Local or native-offline mode points `useQuery` at a placeholder Convex URL** (`main.jsx:28, 352-354`). `LiveNowStrip` and `/live/:token` can spin forever.
- **Sentry gaps.** Init is deferred up to 5 s (`main.jsx:184-208`), and the `LiveNowStrip` boundary opts out of reporting.
- **A malformed `VITE_CONVEX_URL`** (missing `https://`) throws inside `new ConvexReactClient` (`CloudAuthRoot.jsx:32`) with no boundary, giving a white screen. A missing key falls back to local mode cleanly (`bootstrap.js:7-9`).
- **Refreshing the quick-match result screen lands on Setup** (B). The data is safe in History.
- **`ReportMatch` shows "Thanks — reported" even when the mutation fails** (`ReportMatch.jsx:26-32`).
- **Docs asserting what the code does not do.** AGENTS.md treats this class as must-fix:
  - `DEPLOYMENT.md:13`: "The app will fail to boot if the Clerk key is missing." It boots in local mode.
  - `README.md:42`: type-check "over the JS/JSX sources". `tsconfig.json` has `checkJs: false`.
  - `README.md:53` and `DEPLOYMENT.md:28-76`: Vercel. Hosting is Cloudflare (`wrangler.jsonc`, `.github/workflows/cloudflare-*`), and because of that the `VERCEL_ENV`-gated preview SW cleanup (`vite.config.js:6, 43`) never runs, so Cloudflare PR previews register the production service worker.

### P3: hygiene

- **Unused code.** `src/mobile/lifecycle.js` `addAppStateChangeListener` has no callers. Every local write is synchronous today, so no flush is needed, but in-flight Convex writes die on kill.
- **Mismatched undo caps.** Saved undo history is capped at 50 (`MonoSetsLiveScore.jsx:396`), while memory holds 100. Swapped sides are not persisted.
- **Unhandled rejection.** `void cleanupServiceWorkerCache().finally(...)` (`main.jsx:219`).
- **Convex hygiene:**
  - `returns` validators missing on `live.ts` mutations and on `matches.ts`, `users.ts` and `teams.ts`
  - unbounded `.collect()` in `getMatchesForUserId` (`matches.ts:17`)
- **Rules duplicated outside the sport module.** The tennis point/game/set engine lives in `MonoTennisLiveScore.jsx:93-270`, while `src/models/live/tennis.js` is unused by the scorer. The sets rules are duplicated in `MonoSetsLiveScore`, which is the root of SA-01.
- **Console noise:**
  - the dev manifest syntax error
  - `navigator.vibrate` called before user activation (`haptics.js`); harmless with real taps, but it could check `navigator.userActivation.hasBeenActive`
- **Build:**
  - `bun run build` is clean apart from "Browserslist: caniuse-lite is 9 months old"
  - the largest chunks are `index-*.js` at 271.5 kB (86.3 kB gzip), then `MonoTournamentLiveScore` at 104.8 kB (26.8 kB gzip), which bundles every tournament scorer
  - the PWA precache holds 70 entries / 1217.7 KiB, including showcase chunks behind `SHOW_INTERNAL_ROUTES` (`DashboardShowcase`, `BrutalistColorShowcase`, `MonoMatchCardShowcase`, `LandingDesignA`)
  - nothing is alarming; splitting the tournament scorer per family and keeping showcases out of precache would trim first-install bytes

## Positive evidence on the original base (bounded to the inspected paths)

- **Quick-match draft.** It is written after every committed change (`MonoQuickMatch.jsx:584-619`). It carries all three undo histories, the serve, innings, free hit and the live id, and the clock is rebuilt from wall time.
  - Verified in the browser for volleyball, football, cricket and tennis, including undo after refresh.
- **Finishing a quick match.** The result is saved before the draft is cleared. If the save fails, the draft is kept and a warning shows (`MonoQuickMatch.jsx:873-887`).
  - B: "Match saved to History on this device"; History and Stats agree.
- **Undo across a set boundary.** It restores a full snapshot in quick match, the sets tournament scorer and tennis.
- **Inspected local-first paths.** The inspected scoring paths update local state before cloud sync; awaited mutations have try/catch in `useMatchSync.js:50-68` and `useLiveBroadcast.js:66-98` (C; not an exhaustive absence proof).
- **Outbox mechanisms found in source** (`outbox.js`, C; SA-18 still applies):
  - a persisted FIFO queue
  - each acknowledgement saved as it arrives
  - concurrent drains coalesced
  - `finalize` refuses to archive with an undrained tail
  - the server dedupes on `(matchId, clientEventId)` before checking final status
- **Convex identity wrappers.** `authedMutation`/`authedQuery` require identity (`convex/lib/functions.ts`), and `loadOwnedMatch` checks ownership (C). SA-16 identifies public-query concerns; this is not a complete authorization audit.
- **Recovery panels.** Tournament, match, result, tennis and resume links all show recovery panels with actions (B).
- **Native glue (C; not device-tested):**
  - the back button confirms before leaving a scorer, and its async listener is removed correctly (`backButton.js:74-128`)
  - deep-link parsing is wrapped and limited to https on `scoreeasy.app` (`deepLinks.js:22-33`)
  - plugin calls are platform- and availability-guarded
  - no service worker on native, and its caches are cleared (`main.jsx:121-156`)
- **Missing env keys** give a clean local mode (`bootstrap.js:7-27`).

## Fix plan: one-point PRs, in order

One concern per PR, each shipped with a phone-viewport demo per AGENTS.md.

**Ordering.** Data-loss fixes go first. Cheap fixes that unblock verification go early. Decision items wait for Harsha.

| # | PR | Fixes | Files | Risk | How verified |
|---|---|---|---|---|---|
| 0 | **ops:** re-push dev Convex from master; decide per-worktree dev deployments | SA-05 (env half) | none (Harsha runs `npx convex dev --once`; never `deploy`) | Low; overwrites whatever a stale session pushed | `functionSpec` lists `live:*`; `/app` console is clean; `/live/<token>` shows "not found" |
| 1 | `docs: correct deploy/README claims and the offline-sync banner copy` | P2 docs list; SA-13 copy half | `DEPLOYMENT.md`, `README.md`, `src/components/OfflineFallback.jsx` (copy only) | Trivial | Read-through, plus OfflineFallback test copy update |
| 2 | `fix(sets): tournament scorer uses quickMatchSets.isSetComplete` | SA-01 | `MonoSetsLiveScore.jsx` (delete `checkSetComplete`, call `getSetWinRule`/`isSetComplete`) | Low; the rule is already proven in quick match | Flip SA-01 to `it`; add 30-29, 31-30 and 29-30 cases; demo the badminton tournament at 29-29 |
| 3 | `fix(storage): quota at boot must not hide saved data` | SA-02 | `src/utils/storage.js` (separate read and write availability; re-probe on save), banner wiring in `index.jsx` | Medium; storage is shared by everything | Flip SA-02; new test for memory-only mode raising the banner; the quota sweep repro now resumes the match |
| 4 | `fix(scorers): surface every failed autosave` | SA-03 | `MonoQuickMatch.jsx`, `MonoSetsLiveScore.jsx`, `MonoGoalsLiveScore.jsx`, `MonoTennisLiveScore.jsx`, `MonoCricketTestLiveScore.jsx`, `MonoCricketGuidedScorerRoute.jsx` (reuse `saveWarning`) | Low | One test per scorer family with `saveData` returning false; the quota sweep shows the banner |
| 5 | `fix(scorers): persist the draft after undo-to-empty and after the winning point` | SA-07, SA-04 | The five autosave effects; super-over in `draftState` | Low–medium; must not leave blank drafts (clear instead of saving empty) | Flip SA-07; tests: winning point then remount restores the completed state; browser refresh walk |
| 6 | `fix(scorers): per-target tap guard + visible ignored-tap feedback` | SA-11 | A shared `useTapGuard` hook in `src/hooks/`, adopted by every scorer and guided cricket | Medium; touches every scoring button | Flip SA-11; 8 taps at 60 ms register 8; cross-team taps count; Android device check |
| 7 | `fix(cricket-test): move innings/finish transitions out of updaters` | SA-08 (+ StrictMode P2) | `MonoCricketTestLiveScore.jsx`, `MonoGoalsLiveScore.jsx`, `MonoSetsLiveScore.jsx` updaters | Medium | Undo-within-300 ms tests; StrictMode render test |
| 8 | `fix(cricket-test): persist follow-on/result; no prune of Test; not-found panel` | SA-09 | `MonoCricketTestLiveScore.jsx`, `storage.js` prune, `index.jsx` quick-Test route | Low | Refresh-at-follow-on test; 25 h idle fixture survives; `/cricket/quick/test-match/nope` shows recovery |
| 9 | `fix(goals): persist the tournament clock` | SA-10 | `MonoGoalsLiveScore.jsx` | Low | Refresh test: elapsed time restored from wall clock |
| 10 | `fix(boot): keep one provider tree across offline↔online` | SA-06 | `src/main.jsx`, `src/auth/*` | **High**; auth bootstrap | The online-flip sweep keeps the DOM marker; native probe test |
| 11 | `fix(errors): root boundary + route boundary keyed on pathname + spectator boundary` | SA-14, SA-05 (code half) | `main.jsx`, `index.jsx`, `MonoWatchMatch.jsx` route | Low | Crash-then-navigate test; `/live` server-error fallback test |
| 12 | `fix(pwa): recover from stale chunks; no reload on a scorer` | SA-15 | `main.jsx` (`vite:preloadError`, defer controllerchange on protected paths) | Medium | Preview build with a deleted chunk; sweep on a scorer during an SW update |
| 13 | `fix(dashboard): show in-progress quick matches with Resume` | SA-19 | `DashboardLanding.jsx` (+ `appEntry.js` helper) | Low | Dashboard test with a draft; demo |
| 14 | `fix(live): poison-message handling in the outbox` | SA-18 | `useLiveBroadcast.js`, `outbox.js`, `convex/live.ts` (ConvexError codes) | Medium | Outbox tests: permanent error dropped, live-error state shown, previous-match drain, seq seeded from server |
| 15 | `fix(sync): persisted unsynced-results queue` | SA-13 | `useMatchSync.js`, tournament scorers, new `src/lib/sync/` | Medium–high | Finish offline → reconnect → row in Convex; dedupe by `clientMatchId` |
| 16 | `fix(native): consume the launch URL once` | SA-17 | `index.jsx`, `deepLinks.js` | Low | Unit test with a changing `navigate`; Android cold-launch check |
| 17 | `fix(auth): scoring routes bypass the onboarding loading gate` | SA-20 | `index.jsx` OnboardingGuard | Medium | Repro with Clerk blocked; guard test |
| D1 | **Decision → PR:** volleyball cap and badminton/pickleball serve | SA-12 | `sportDefaults.js` / `sportRegistry.js`, then one rule source | Rule change | Harsha decides; tests for both scorers |
| D2 | **Decision → PR:** what a public profile may expose | SA-16 | `convex/matches.ts`, `convex/teams.ts` | Privacy | convex-test with signed-out identity |

P2 and P3 items need their own bounded follow-up unless they are required to satisfy the active PR's acceptance criteria. Sharing a file is not sufficient reason to expand a fix PR.

## Parallel ownership and handoff

This PR owns this audit and the two `.stability.test` files only. It preserves `fdf8674` and does not edit app behavior, `AGENTS.md`, `README.md`, coding standards, or their mirrors.

- **Routing worker:** Home/resume (overlap with SA-19), goals, tennis and cricket finish/recovery paths (overlap with SA-04, SA-07, SA-08, SA-09, SA-10). Coordinate acceptance coverage before opening a second fix for the same path.
- **Sets-cap worker:** shared set helper and rule consumers (SA-01, with possible SA-12 rule-decision overlap). Convert the SA-01 expected-failure test when integrating the fix; do not silently change the sport-rule decision.
- **Dialogs worker:** shell CSS. No CSS changes belong to this audit; phone-modal evidence must come from that worker's PR.
- **Docs-drift worker:** `AGENTS.md`, `README.md`, `CODING_STANDARDS.md` and mirrors. Deployment/copy findings above are handoff context, not authorization to edit those files here.

These assignments were supplied in the recovery brief; they do not assert that another worker's changes have landed. Check the current remote before starting each follow-up.

## Forge issues

There is one issue per P0 and P1, all labelled `stability-audit`. Each has a body with evidence and acceptance criteria.

| ID | Pri | Forge id |
|---|---|---|
| SA-01 | P0 | `b698365e-92df-488b-ab8c-6fde42a8d0f9` |
| SA-02 | P0 | `7a50f38f-f619-445d-b791-68a16a422433` |
| SA-03 | P0 | `6c1a0fa5-9462-4cf3-a150-297d77606f9d` |
| SA-04 | P0 | `0bc3c8a0-36f9-4584-9051-95d08e9cfd03` |
| SA-05 | P1 | `11d4379b-c56d-4190-a8fa-7018110fc591` |
| SA-06 | P1 | `ef68c0b5-97d7-45c0-a120-618c111e20a1` |
| SA-07 | P1 | `35cbce6e-7e28-49de-826a-204bb3e46904` |
| SA-08 | P1 | `8b0316bd-bcda-40b9-877a-f4188f5dd5dc` |
| SA-09 | P1 | `d6656085-2cc6-49c0-976e-7203e308285f` |
| SA-10 | P1 | `134b5fe0-df42-4fe2-af45-2e1fb5924145` |
| SA-11 | P1 | `ab161889-442c-42f5-8edf-3ca42078c4c3` |
| SA-12 | P1 (decision) | `53d0d0ea-d7c5-49cc-b4a0-61f535c11f6e` |
| SA-13 | P1 | `d8c42ce8-9555-46b8-9da3-b501bb1be873` |
| SA-14 | P1 | `591852ea-964f-4784-b5f0-25d91af55006` |
| SA-15 | P1 | `01582321-9007-4bc7-b345-295a4a3228b9` |
| SA-16 | P1 (decision) | `f210fff9-5107-400a-830b-d5951e7a92b3` |
| SA-17 | P1 | `0f63165d-0168-4024-8a11-f346b4e0fa3a` |
| SA-18 | P1 | `2f2ce343-5c01-4dab-80d3-db2a7f8c79c3` |
| SA-19 | P1 | `82315578-d10f-4de3-b089-bc99c4fa9913` |
| SA-20 | P1 | `02d3daac-0e70-40b8-8013-239c2347d141` |

The existing `livenowstrip-throws-on-the-a1784d4e` has a root-cause comment pointing at SA-05.

## Notes for AGENTS.md (escape hatch)

- **`forge issue create --help` prints no flags.** The flags that work are `--title --type --priority P0|P1 --body --acceptance --label` (from `forge-workflow/lib/kernel/broker.js` `buildCreatePayload`). Worth one line in AGENTS.md.
- **The shared dev Convex deployment is a reliability hazard for parallel agent sessions** (SA-05). AGENTS.md says "Development is `npx convex dev` — always", but says nothing about which dev deployment. Choosing between per-worktree deployments and "re-push from master before demoing" is Harsha's decision.
