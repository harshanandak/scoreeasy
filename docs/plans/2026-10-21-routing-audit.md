# Routing audit (2026-10-21)

## Problem

Harsha, 2026-10-21: "check other routing also, I believe a lot of routing is bad right now; we need to improve application stability and reliability."

The decision is to stay on React Router v7 (`react-router-dom` 7.15) and clean it up. TanStack Router is off the table. This document covers:

- an inventory of every route, every navigation call site, and every place a path string is built;
- the problems found, with file:line evidence and a severity;
- a 91-case guest sweep of public, app, sport and legacy routes (headless Chrome, phone viewport); three registered showcase routes were not exercised;
- contract tests for the top findings;
- a fix plan of small, one-point PRs, ordered by how much each one matters to a scorer mid-match.

The original audit did not change app code. Its only code additions were `src/designs/design1-mono/routes.contract.test.jsx` and the sweep script `scripts/route-sweep.mjs`. Follow-up implementation status is recorded below; the original inventories and runtime rows remain historical evidence.

**Severity scale.** P0: a point or a match is lost, or the board lies. P1: a scorer can lose track of a match, gets stuck, or Back does something unsafe mid-match. P2: wrong or confusing behaviour with a way out. P3: polish, dead code, or a latent risk.

**Related work (original snapshot; integration updates below):**
- PR #158 (`fix/start-match-routing`) repoints the generic "start a match" buttons to `/play` and adds `src/utils/appPaths.js`.
- `feat/icp-game-focus` deregisters pickleball, squash, rugby, futsal and handball, and decides what an unknown-sport URL does (e.g. `/pickleball/quick`). Findings that touch unknown sports are noted for that branch below. This audit does not propose a competing fix.
- PR #159 (`fix/flaky-tests`) added `src/test/preloadAppRoutes.js` and is now on master. The contract tests use that helper during collection instead of extending timeouts for cold route imports.

**Integration baseline.** The inventories, line numbers and 91 runtime rows below record the original audit at `bfbfae4`; they are historical evidence, not a fresh sweep of the integrated branch. This branch now includes master through PR #156 (`3e3cb754bcb6cd0ba946ba722e6e0a12c380116d`), including PR #158's path helpers and guest-entry links and PR #159's preload helper. References below to those PRs being in flight describe the original snapshot. The three omitted showcase routes are `/showcase/set-display`, `/showcase/brutalist-colors` and `/showcase/dashboard-variants`; their runtime behaviour remains unverified by this audit. No new browser sweep was run for this integration.

## Top findings in plain words

1. **Back after finishing a match goes back into the match** (RA-1, RA-2). **Goals tournament completion is fixed** for football, basketball, hockey and kabaddi: manual, timed and target-score completion now use the existing app completion seam after a successful local save. Sets tournament completion already used that seam. Cricket limited-overs, Test and guided tournament completion now also use the app completion seam; Test quick completion lands on History. Tennis remains open; a finished tennis quick match still reopens a dead "Match not found" page with the exit guard armed. Goals quick matches already finish in place; their saved result and Undo are pinned separately.
2. **RA-3 fixed: Home lists resumable matches.** Home and cold entry share a catalog of active-sport quick drafts, tennis drafts, cricket Test matches and unfinished tournaments. Each destination has a Resume action. Retired sports have no Resume; saved data stays intact and completed results remain readable in History. Originally, Home hid quick drafts and could strand an in-progress tennis match.
3. **Stale cricket Test links hang on "Loading..." forever** (RA-4). The bottom nav is hidden, and Back warns about losing unsaved progress for a match that does not exist.
4. **The exit warning fires before a match even starts** (RA-5). `/:sport/quick` is guarded by URL, so the untouched setup form already asks "Leave this page? Your unsaved scoring progress may be lost." That trains scorers to tap Leave without reading.
5. **One crash sticks** (RA-6). The route error boundary never resets. After any screen throws, every later in-app navigation still shows "App route crashed" until a full reload. The public `/live/:token` page has no boundary of its own (RA-11).
6. **Ids are validated five different ways** (RA-4, RA-7, RA-9). Some screens show recovery for a bad id, some spin forever, and `/constructor/quick` is accepted as a real sport.
7. **Back and Home are not consistent** (RA-8, RA-10, RA-12). `navigate(-1)` with no fallback can leave the app. In-app back arrows push while hardware Back pops. "Home" means `/` on some buttons and `/app` on others, so Home on a 404 can drop you straight into a live scorer.

No P0 was demonstrated by these routing cases. They exposed lost *track* of matches, Back loops and dead ends. This audit does not establish that autosave always succeeds or that scored points cannot be lost; persistence failures need separate stability proof.

### Goals completion follow-up

The goals portion of RA-1 is fixed for the four registered goals-engine sports: football, basketball, hockey and kabaddi. All three tournament completion paths (manual Finish, target score and time expiry) save before using the app-owned completion seam; a failed local save keeps the scorer open. Futsal, handball and rugby are retired and are not included. Cricket completion is fixed; tennis completion remains open; the tennis RA-2 expected-failure contract is unchanged.

The former goals RA-1 expected failure is now a normal contract parameterized over the registered goals sports. Additional normal quick-match contracts verify that restored Undo history corrects the score before Finish and that the saved result survives Back. Goals quick matches already use an in-place result, so this change does not claim to fix a quick-match scorer-reopening bug. Real-browser Back on that result still opens the existing leave-page warning; that guard behavior remains outside this completion fix.

Proof: restoring master's goals scorer makes all four tournament contracts fail by reopening the completed scorer (rung 4). At 390x844 in the running guest app, football tournament Finish → Back reopens the scorer before the fix and stays on the completed tournament afterward (rung 5). Football quick-match Undo → Finish → Back retains the corrected 2–1 result before and after; the leave warning remains visible. Screenshots, inspected individually, and structured run evidence are in [the goals demo](2026-10-21-routing-fixes/goals-back/README.md). Browser proof does not establish native Android behavior.

## Method

- Static read of `src/designs/design1-mono/index.jsx` (39 `<Route>`s, 25 `lazy()` chunks), `src/mobile/backButton.js`, `src/mobile/deepLinks.js`, `src/utils/authRedirect.js`, `src/utils/appEntry.js`, `src/auth/CloudAuthRoot.jsx`, and every `navigate(`, `<Link`, `<Navigate`, `location.*`, `history.*` call outside tests. That is 94 `navigate('/…')` literal call sites, 6 `navigate(-1)`, and 37 `<Link>`/`<Navigate>`/`href="/…"`.
- Runtime: `bunx vite --port 5193 --strictPort` with `.env.local`, driven by `scripts/route-sweep.mjs`. The script uses the Chrome DevTools protocol at 390×844 with mobile emulation and a fresh browser context per case (guest, empty storage unless seeded). For each case it records the final URL, the visible heading, the page text, whether the bottom nav and the exit dialog are showing, and console errors. Seeded cases put realistic drafts and tournaments in localStorage. Flow cases click through and press Back.
- Environment caveat: the Convex dev deployment in `.env.local` does not have the `live` module pushed. `live:getByToken` and `live:listLiveFeed` return "Could not find public function" (checked with a direct `/api/query` call). That accounts for the `listLiveFeed (env)` errors in the run table. The *routing* consequence of a backend error on `/live/:token` is still a real finding (RA-11).

## Runner security review (integration)

The script header describes the listed guest cases; it does not claim the three omitted showcase routes were visited. The 91 application rows below remain historical. The transport checks in this section are separate runner proof, not another application routing sweep.

- **Debugger ownership / S8480** (`AaFdmkHyJxOSk5CuI9Rk`, review thread `PRRT_kwDORJ8OJM6uuqq8`). The original bootstrap fetched `/json/version` from fixed port 9339 without checking the spawned child's lifetime. A different local listener could supply a remote `webSocketDebuggerUrl`. The runner now asks its own Chrome child for an OS-assigned port, reads that child's stderr announcement, validates the loopback host, numeric port and browser path, and constructs a loopback-only WebSocket URL. Child exit, spawn/connect error and the unchanged 10-second startup deadline fail the bootstrap; cleanup closes the socket and kills the child. No discovery HTTP response supplies a connection URL.
- **Caller-selected output / S8707** (`AaFdmkHyJxOSk5CuI9Rl`). `process.argv[2]` is the invoking local operator's output filename, passed directly to `writeFileSync`; its default is `results.json`. This standalone CLI has no server, elevated privilege, sandboxed output root or lower-trust request supplying that argument. Relative paths, `..` and absolute paths intentionally select the operator's destination under the same OS permissions as the caller. The destination is never evaluated as code or sent through a shell. This finding is assessed as a false positive at this trust boundary; no path restriction, rule exemption or gate change was added. An agent invoking the CLI remains responsible for choosing an authorized destination.
- **Proof (rung 4, executed).** A helper harness rejected a remote endpoint, an out-of-range port and a child that exited before connection; it accepted a split loopback announcement. A counterfactual executing the original bootstrap accepted a poisoned discovery URL even after its fake child exited. Two actual Chrome launches ran concurrently while a trap occupied port 9339; both wrote their selected empty-case outputs and the trap received zero requests. A missing Chrome executable failed without fallback or output. An actual CDP case against a disposable local HTML fixture also completed context creation, phone emulation, navigation, snapshot, target/context disposal and JSON output, with its expected heading and no browser errors. These smoke cases verify the runner, not the historical application findings.
- **Advisory findings.** Repeated awaits in dependent CDP/action loops preserve order, case labels are string literals, and `send` deliberately accepts an optional session after default params. Readability suggestions for escaped/nested templates and top-level await are tracked separately in Forge (`f6112e7c-3b8c-406b-b9df-8edfb621460d`), outside this audit integration.

SonarCloud's pre-fix snapshot reported `ERROR`, with `new_security_rating=3` and these two open vulnerabilities. Source assessment and local proof do not make that hosted gate green; the next analysis must be read separately.

## Route inventory

All routes are children of `<Routes>` in `src/designs/design1-mono/index.jsx:1774-1828`. They are wrapped, outside in, in `Suspense` → one `ErrorBoundary` → `OnboardingGuard`. `App.jsx` mounts the design at `/*`.

| # | Path | Element | Guards / checks | Params | Lazy |
|---|------|---------|-----------------|--------|------|
| 1 | `/` (path `""`) | `AppEntryRoute` → `<Navigate replace>` to a single in-progress draft, `/app`, or `/marketing` | auth loading → skeleton | – | no |
| 2 | `/marketing` | `MonoLanding` (GuestLanding) | – | – | no |
| 3 | `/app` | `DashboardLanding` | – | – | yes |
| 4-6 | `/privacy` `/terms` `/contact` | `LegalPage` | – | – | yes |
| 7 | `/login/*` | `MonoLogin` (Clerk `SignIn`) | `CloudAuthOnly` (→ `/` replace if no cloud) | `?returnTo` (`isSafeAppPath`) | yes |
| 8-9 | `/signin/*` `/sign-in/*` | `SignInAliasRedirect` → `/login` + search + hash | – | – | no |
| 10 | `/signup/*` | `MonoSignUp` | `CloudAuthOnly` | `?returnTo` | yes |
| 11 | `/sso-callback` | `SSOCallback` | `CloudAuthOnly` | sessionStorage returnTo | yes |
| 12 | `/onboarding` | `MonoOnboarding` | `CloudAuthOnly`; guest → `/login?returnTo=` replace | `?returnTo` | yes |
| 13-14 | `/profile`, `/profile/:username` | `MonoProfile` in its own ErrorBoundary | `CloudAuthOnly` | `:username` (Convex lookup) | yes |
| 15 | `/users/search` | `MonoUserSearch` | `CloudAuthOnly` | – | yes |
| 16 | `/play` | `MonoPlayHub` (Guided `NewUserFlow` / Browse `MonoSportHome`) | – | `?sport` (Browse only) | yes |
| 17 | `/dashboard` | `<Navigate to="/app" replace>` | – | – | – |
| 18 | `/quick-match` | `LegacyQuickMatchRoute` → `/:sport/quick`, **default volleyball** | – | `?sport` | – |
| 19 | `/tournament` | `LegacyTournamentRoute` → `/:sport/tournament` or `/play` | – | `?sport` | – |
| 20 | `/stats` | `<Navigate to="/history" replace>` | – | – | – |
| 21 | `/game/:id` | `GameResumeRecoveryRoute` (tennis draft / cricket Test → scorer, else recovery) | – | `:id` | – |
| 22 | `/live/:token` | `MonoWatchMatch` (public spectator) | onboarding bypass; **no route boundary** | `:token` (Convex) | yes |
| 23 | `/:sport/tournament` | `MonoTournamentList` | `SportRouteGuard` | `:sport` | yes |
| 24 | `/:sport/tournament/new` | `MonoTournamentSetup` | `SportRouteGuard` | – | yes |
| 25 | `/:sport/tournament/:id` | `TournamentDispatcher` → Cricket / GenericSets / GenericGoals | `SportRouteGuard` | `:id` | yes |
| 26 | `/:sport/tournament/:id/match/:matchId/score` | `MonoTournamentLiveScore` → engine scorer in ErrorBoundary | `SportRouteGuard`; **exit guard** | `:id`, `:matchId` | yes |
| 27 | `/:sport/tournament/:id/match/:matchId/result` | `MonoMatchResult` (sets verdict only) | `SportRouteGuard` | `:id`, `:matchId` | yes |
| 28 | `/:sport/quick` | `MonoQuickMatch` (setup → scoring → result, one URL) | `SportRouteGuard`; **exit guard on all phases** | `?format` (cricket) | yes |
| 29 | `/:sport/quick/test/:matchId` | `LegacyCricketQuickTestRoute` → `/cricket/quick/test-match/:id` | cricket only | `:matchId` | – |
| 30 | `/:sport/quick/test-match/:matchId` | `MonoCricketTestLiveScore storageMode="quick"` | cricket only; exit guard | `:matchId` | yes |
| 31 | `/:sport/quick/live/:matchId` | `MonoTennisLiveScore storageMode="quick"` | tennis only; exit guard | `:matchId` | yes |
| 32 | `/:sport/live/:matchId` | `LegacyTennisLiveRoute` → `/tennis/quick/live/:id` | tennis only | `:matchId` | – |
| 33 | `/statistics` | `<Navigate to="/history" replace>` | – | – | – |
| 34-37 | `/showcase/{match-card,set-display,brutalist-colors,dashboard-variants}` | showcases | only if `DEV` or `VITE_SHOW_INTERNAL_ROUTES` | – | yes |
| 38 | `/history` | `MonoHistory` (merged stats) | – | – | yes |
| 39 | `*` | `NotFoundRoute` (sport-aware 404 with Play/Home) | – | – | no |

Cross-cutting routing logic in `index.jsx`:
- `OnboardingGuard` (:367-378) sends a signed-in user who still needs onboarding to `/onboarding?returnTo=` (replace). It skips `GUARD_BYPASS_PREFIXES` (:265-278) and defers on `ONBOARDING_DEFER_PATHS`, scoring paths and sport paths (:279-289, :347-352).
- Bottom nav shows on `APP_SHELL_PREFIXES` and sport `quick`/`tournament` paths, except protected scoring paths (:293-334, :666).
- Scoring exit guard: browser popstate plus native Back on any `isProtectedScoringRoute` path (:1606-1715, `backButton.js:5-16`). It covers *every* `/:sport/quick*` path and `/:sport/tournament/:id/match/:matchId/score`.
- `completeProtectedScoring` (:1717-1760) is the completion seam that unwinds the scorer and guard entries. It is provided via `ScoringCompletionContext`. **Only `MonoSetsLiveScore` uses it** (`scoring/MonoSetsLiveScore.jsx:29,501-505`).
- Native deep links (:1585-1604, `deepLinks.js`) accept `https://scoreeasy.app/...` only, canonicalize `/stats`, `/statistics` and `/dashboard`, confirm before leaving a scorer, then *push*.

Routes reachable only by URL (no in-app link): 17 `/dashboard`, 18 `/quick-match`, 19 `/tournament`, 20 `/stats`, 29, 32, 8-9 sign-in aliases, 11 `/sso-callback` (Clerk), 34-37 showcases. `/game/:id` is linked only from legacy session cards (RA-16). `/statistics` has one in-app link (RA-20). These are deliberate legacy entry points. No two routes in the table overlap: `profile` and `profile/:username` share an element on purpose. No legacy redirect chains more than one hop.

## Navigation call sites by screen

Counts are `navigate(` calls, excluding tests. ✱ marks a screen that is not routed (dead code).

| Screen (file) | Calls | Targets built | Notes |
|---|---|---|---|
| Shell / routes (`index.jsx`) | 10 | `/`, `/app`, `/play`, `/history`, `/login`, `/profile`, `/onboarding?returnTo=`, `/play?sport=`, `/:sport/quick`, `/:sport/tournament`, `/:sport/quick/test-match/:id`, `/tennis/quick/live/:id`, `/history` (recovery) | Header Home = `/` (:757); bottom-nav Home = `/app` (:767) |
| Dashboard (`landing/DashboardLanding.jsx`) | 20 | `/profile`, `/login?returnTo=%2Fapp`, `/game/:id`, `/:sport/tournament/:id`, `/history`, `/play`, `/:sport/quick`, `/:sport/tournament` | `GO_LIVE_PATH = '/play'` (:21) |
| Landing (`landing/GuestLanding.jsx`) | 7 `<Link>` | `/login`, `/signup` or prod URL, `/play?sport=`, `/privacy` `/terms` `/contact` | `sportPlayPath` (:33-36) |
| Play hub (`MonoPlayHub`, `MonoSportHome`, `NewUserFlow`) | 4 | `/:sport/quick`, `/:sport/tournament`, `/:sport/tournament/new` with `state.teams` | `?sport` read only in Browse (`MonoSportHome.jsx:136-161`) |
| Quick match (`MonoQuickMatch.jsx`) | 9 | `/app`, `/:sport/quick/test-match/:id`, `/:sport/quick/live/:id`, `navigate(-1)`, `/play?sport=`, `/:sport/tournament`, `/history`, `/statistics` | setup back arrow :1666-1679 |
| Tournament list / setup / dispatcher views | 6 + 2 + 6 | `/`, `/:sport/tournament/new`, `/:sport/quick`, `/:sport/tournament/:id`, `…/match/:mid/score` | `KnockoutMatchCard`, `TournamentNotFoundActions` |
| Scorers (`scoring/*`) | 13 | `/:sport/tournament/:id`, `/:sport/quick`, `/history`, result path | audited completion: Sets, goals and cricket use the completion seam; tennis remains open (RA-1) |
| Result (`components/MonoMatchResult.jsx`) | 3 | `/:sport/tournament/:id` (replace), `/:sport/quick` (replace), `/login` | RA-19 |
| Auth (`MonoLogin`, `MonoSignUp`, `MonoAuthPageFrame`, `MonoOnboarding`, `SSOCallback`, `CloudAuthOnly`, `CloudAuthRoot`) | 6 + Clerk | `/signup?returnTo=`, `/login?returnTo=`, `DEFAULT_GUEST_SCORING_PATH` (`/volleyball/quick`, PR #158 → `/play`), `/`, `returnTo` | `CloudAuthRoot.navigateInApp` dispatches a synthetic popstate (:10-28) |
| Profile / search (`MonoProfile`, `MonoUserSearch`) | 5 + 3 | `/`, `navigate(-1)`, `/login?returnTo=%2Fprofile`, `/users/search`, `/volleyball/quick` (PR #158) | RA-8 |
| Live (`MonoWatchMatch`, `live/LiveBroadcastBar`, `live/LiveMatchCard`) | 2 + Links | `/signup`, `/login?returnTo=<scorer>`, `/live/:token`, `/` | |
| History / stats (`MonoHistory`, `MonoStatistics`) | 3 + 4 | `/:sport/quick` with state, `/app`, `/play`, `/volleyball/quick`, `/volleyball/tournament/new` (PR #158) | |
| Recovery (`RouteRecoveryActions`, `OfflineFallback`, `ErrorBoundary`) | 1 + 1 + 2 assign | `/play`, `/`, `/:sport/quick`, `/:sport/tournament`, `location.assign('/')`, `location.assign('/play')` | Home = `/` (RA-10) |
| Native (`mobile/backButton.js`, `mobile/deepLinks.js`) | 2 | `/play?sport=`, `/:sport/tournament/:id`, any deep-link path | |
| ✱ `MonoHome`, `MonoSetup`, `MonoLiveGame`, `MonoSportHome_TABBED`, `landing-designs/*` | 12 + `<a href>` | `/setup` (no route), `/game/:id`, `/statistics`, `/showcase/landing-designs` (no route) | RA-17 |

Path strings are built in place everywhere except `appEntry.js` (`APP_ENTRY_PATH`, `PUBLIC_MARKETING_PATH`, draft `entryPath`s), `authRedirect.js` and `deepLinks.js`/`watchUrl.js`. PR #158 starts `src/utils/appPaths.js` with `PLAY_HUB_PATH` and `quickMatchPath(sport)`.

## Findings

Evidence marked "run #n" refers to the original run table below. "Contract RA-n" is the matching route test in `routes.contract.test.jsx`; RA-3, goals and cricket completion now pass normally, while open findings retain `it.fails`.

| ID | Sev | Finding | Evidence | Forge |
|----|-----|---------|----------|-------|
| RA-1 | P1 | **Goals portion fixed:** football, basketball, hockey and kabaddi complete through `completeProtectedScoring` after saving. Cricket limited-overs, Test (tournament and quick) and guided completion are also fixed through the same seam. Tennis-tournament remains open. | `scoring/MonoGoalsLiveScore.jsx` (`completeMatch`, all three completion paths); normal RA-1 contracts for every registered goals sport. Original run #79 records the prior failure; the goals demo below records before/after. Cricket has normal route contracts, focused save/innings/Undo tests and phone demos under `2026-10-21-routing-fixes/cricket-back/`. Tennis evidence remains the original source inventory. | `a7088ac7-c11b-4a36-9012-25baacb4248f` |
| RA-2 | P1 | Back after finishing a tennis quick match lands on `/tennis/quick/live/<id>`, now "Match not found", with the exit guard armed again. | `scoring/MonoTennisLiveScore.jsx:630-632` (clear draft, push `/history`); `:711-723` recovery branch; protected by `backButton.js:10`. Run #78. Contract RA-2. | `80bba13a-e002-4a13-8dc8-600bc9cd430e` |
| RA-3 (fixed) | P1 | Original finding: `/app` never lists in-progress drafts. With 1 draft the Home tab shows "Play your first match". With 2+ drafts the app entry lands on `/app` on purpose, but nothing there lets the scorer pick one. Tennis drafts are then unreachable from the UI. | `landing/DashboardLanding.jsx:723-736` reads `gs_sessions`, `se_quickmatches`, tournaments only; `:758` `hasNoData`; `utils/appEntry.js:92-100` (2+ drafts → `/app`); tennis drafts are discovered only in `appEntry.js:39-51`. Runs #67-68 (`/` → `/app` "Welcome."), #86 (one volleyball draft, Home tab → "Welcome."). Contract RA-3. | `6fc57130-4f71-404c-b4a2-673929ba16b8` |
| RA-4 | P1 | Unknown cricket Test match id → "Loading..." forever, no nav, and Back asks about unsaved progress. | `scoring/MonoCricketTestLiveScore.jsx:695-698` (no not-found branch). Runs #58-59, #82 (exit dialog over "Loading..."). Contract RA-4. | `504a2ffb-85fa-4861-95b6-62954d7f34d3` |
| RA-5 | P2 | Exit guard and hidden bottom nav on the *untouched* quick-match setup. Protection is by path (every `/:sport/quick*`), not by "a match is being scored". Hardware Back and the in-app back arrow (`navigate(-1)` → popstate) both raise "Your unsaved scoring progress may be lost". | `mobile/backButton.js:5-16`; `index.jsx:315-317,666,1606-1715`; `MonoQuickMatch.jsx:1666-1679`. Runs #77, #81. Contract RA-5. | – |
| RA-6 | P2 | The route-tree `ErrorBoundary` has no reset on location change. After any route throws, in-app navigation keeps showing "App route crashed". Its Home/Play buttons do a full `location.assign` reload. | `index.jsx:1772`; `components/ErrorBoundary.jsx:5-45` (no `componentDidUpdate`/reset key). Run #84 (crash → in-app nav to `/history` → still crashed, nav visible). Contract RA-6. | – |
| RA-7 | P2 | Tournament and match ids are resolved five different ways. The dispatcher and result screen accept `t.id === Number(id) \|\| t.id === id`. The goals and tennis scorers accept only `Number(id)` and a strict `m.id === matchId`, so a match the dispatcher finds renders "Loading..." forever inside the scorer. | `MonoTournamentLiveScore.jsx:19-21`, `components/MonoMatchResult.jsx:202-203`, vs `scoring/MonoGoalsLiveScore.jsx:109-114,422-425`, `scoring/MonoTennisLiveScore.jsx:393-398`, `scoring/MonoSetsLiveScore.jsx:106`. Run #83 (string id `fx`). Contract RA-7. | – |
| RA-8 | P2 | `navigate(-1)` with no fallback. On a deep link (first history entry), Back leaves the app in a browser or does nothing in the Android WebView. | `MonoProfile.jsx:157,165`; `MonoUserSearch.jsx:33`; showcases `MonoMatchCardShowcase.jsx:33`, `MonoSetDisplayShowcase.jsx:30`. Run #85 (Back → `about:blank`). Contract RA-8. | – |
| RA-9 | P2 | `getSportById` is `SPORT_REGISTRY[id] \|\| null` on a plain object, so `Object.prototype` keys pass every sport check. `/constructor/quick` opens a startable quick match for sport "Object". `/toString/tournament` lists "toString Tournaments". | `models/sportRegistry.js:460`; consumers `index.jsx:157-160`, `backButton.js:9`. Runs #89-91. Contract RA-9. | – |
| RA-10 | P2 | "Home" means two things. `/` is the resolver: it jumps into the single in-progress draft, or to `/marketing` for a new guest. `/app` is the dashboard. Home on the 404 screen opened a live tennis scorer. | `/`: `components/RouteRecoveryActions.jsx:27`, `index.jsx:757,817`, `MonoTournamentList.jsx:101`, `MonoTournamentSetup.jsx:457`, `MonoProfile.jsx:141,149,181`, `MonoAuthPageFrame.jsx:60`, `components/ErrorBoundary.jsx:38`, `CloudAuthOnly.jsx:12`; `/app`: `index.jsx:767`, `MonoQuickMatch.jsx:934,3150`, `MonoHistory.jsx:515`. Run #87. | – |
| RA-11 | P2 | `/live/:token` has no route-level boundary. Any Convex error (e.g. version skew during a rollout) takes the spectator to "App route crashed" instead of the page's own "unavailable" state. | `MonoWatchMatch.jsx:647-666` (null → `UnavailableScreen`, throw → app boundary); `index.jsx:1802`. Runs #33, #35 (observed against the dev deployment, which lacks `live:getByToken`). | – |
| RA-12 | P2 | In-app exits push, hardware Back pops. Scorer Cancel/Discard/Save-draft *push* the setup or tournament page, so the stack grows and Back from there re-enters the scorer URL. After a discard that URL has no draft, which gives the same dead end as RA-2. | `scoring/MonoTennisLiveScore.jsx:309,695-709`; `scoring/MonoCricketTestLiveScore.jsx:596-602,604-622`; `scoring/MonoGoalsLiveScore.jsx:46`. Native Back instead unwinds to the prior route (`index.jsx:1644-1676`, `backButton.js:92-103`). Static evidence, same mechanism as runs #78-79. | – |
| RA-13 | P2 | App Links / Universal Links cannot verify. Production serves the SPA HTML at `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association`, so `https://scoreeasy.app/live/<token>` opens in the browser, not the app. Separately, `pathFromAppUrl` rejects `www.scoreeasy.app`. | `android/app/src/main/AndroidManifest.xml:26-33` (`autoVerify`); `ios/App/App/App.entitlements:5-7`; `docs/mobile/app-link-associations.md` (deployment-owned, needs signing data); `curl https://scoreeasy.app/.well-known/assetlinks.json` → `<!DOCTYPE html>` (2026-10-21); `mobile/deepLinks.js:27`. | – (needs Harsha) |
| RA-14 | P3 | Hard-coded sport default on the legacy route: `/quick-match` and `/quick-match?sport=bogus` → `/volleyball/quick`. The other `/volleyball/...` literals are handled by PR #158. | `index.jsx:195-200`; PR #158 covers `utils/authRedirect.js:2`, `MonoStatistics.jsx:374,375,555`, `MonoUserSearch.jsx:100,174`, `MonoProfile.jsx:81`. Runs #24, #26. Cosmetic: `MonoAuthPageFrame.jsx:28` volleyball icon. | – |
| RA-15 | P3 | `/play?sport=<id>` is ignored in Guided mode, the default for a new guest. In Browse it only scrolls. The 404 "Back to <Sport>" button, the native-Back fallback, the setup back arrow and the landing CTAs all target it. | `MonoPlayHub.jsx:31-39,99`; producers `index.jsx:152`, `backButton.js:23`, `MonoQuickMatch.jsx:1676`, `landing/GuestLanding.jsx:33-36`. Runs #19-21. | – |
| RA-16 | P3 | Legacy `gs_sessions` cards on `/app` link to `/game/:id`, which never reads `gs_sessions`, so they dead-end at "Resume link unavailable". Only dead screens write `gs_sessions`. | `landing/DashboardLanding.jsx:253`; `index.jsx:223-243`; writers `hooks/useGameSession.js:27` used only by ✱`MonoSetup`/`MonoLiveGame`. Runs #75-76. | – |
| RA-17 | P3 | Dead, unrouted screens still link to non-routes. | ✱`MonoHome.jsx:46,60` and `MonoSportHome_TABBED.jsx:156` → `/setup` (run #36: 404); `MonoSetup.jsx:49`, `MonoLiveGame.jsx:102`; `landing-designs/BrutalistColorShowcase.jsx:121` → `/showcase/landing-designs` (run #37: 404); `landing-designs/*` use `<a href>` full reloads. | – |
| RA-18 | P3 | Sport slugs are case-sensitive, and an uppercase slug gets the generic 404 without sport context. | `models/sportRegistry.js:460`. Run #46 (`/Volleyball/quick`). | – |
| RA-19 | P3 | Result screen: Sign in drops `returnTo`. Rematch from a tournament result opens a *quick* match with `replace`, which leaves the tournament. | `components/MonoMatchResult.jsx:254,257`. | – |
| RA-20 | P3 | An in-app link points at a legacy redirect: "See Stats" → `/statistics` → `/history`. | `MonoQuickMatch.jsx:3140`. | – |
| RA-21 | P3 | Not-found states with no heading, or as bare text: "Tournament not found" has no `h1`; the dispatcher prints "Sport not found" or "Engine type not supported". | `components/TournamentNotFoundActions.jsx`; `index.jsx:1484-1513`. Runs #51-52, #91. | – |
| RA-22 | P3 | Auth edges. Opening `/sso-callback` directly leaves for Clerk's hosted "Sign in to My Application" page. The stored `returnTo` is consumed only by `SSOCallback`, and `CloudAuthRoot` reads it once at mount, so a stale value can apply to a later OAuth sign-in. Onboarding completion *pushes* `returnTo`, so Back returns to the wizard. | Run #13; `auth/CloudAuthRoot.jsx:41-42`; `utils/authRedirect.js:27-46`; `MonoOnboarding.jsx:923`. No return-to loop was found: guest `/onboarding` → `/login?returnTo=` (replace, run #14), and `/login` honours safe `returnTo` and rejects `//evil` (runs #8-9). | – |

Checked and fine: unknown multi-segment paths and bad sports get the 404 with Play/Home (runs #39, #45, #55-56). Sport-scoped 404s keep sport context (#47, #57, #60, #63, #65). Bad tournament scorer and result ids get recovery (#53-54, #71-72). Tennis bad id gets recovery (#61, #64). Legacy redirects resolve in one hop (#10-11, #23, #25, #27-30, #32, #59, #64). A single draft auto-resumes from `/` (#66). `/live/` with no token gets the 404 (#34). Guests see recovery on `/profile` and `/profile/:x` and a working `/users/search` (#15-17). A completed sets result renders and Back goes to the tournament (#73, #80).

**For `feat/icp-game-focus` (not a competing fix).** `SportRouteGuard`, `isProtectedScoringRoute`, `isSportAppPath` and `NotFoundRoute` all key off `getSportById`. Deregistering a sport therefore turns its URLs into the generic 404 on its own (today `/pickleball/quick` still opens the scorer, run #44). Two side effects are worth handling in that branch:
- `loadQuickMatchDrafts` and `loadTournamentSummaries` iterate `getSportsList()` (`utils/appEntry.js:30-58`), so a saved in-progress pickleball/squash/rugby/futsal/handball draft or tournament silently drops out of resume and returning-player detection.
- The 404 for a deregistered sport shows the generic copy, not "this sport is no longer supported".

## Run table

Guest, fresh context per row, 390×844 mobile emulation, `bunx vite --port 5193`, 2026-10-21. "nav" = bottom nav visible. "listLiveFeed (env)" = the dev-deployment error described under Method; it is caught by the strip's silent boundary. Re-run with `node scripts/route-sweep.mjs out.json` (set `ONLY=<regex>` for a subset).

| # | Case | Start (seed) | Final URL | Heading / text | Shell | Console errors |
|---|------|--------------|-----------|----------------|-------|----------------|
| 1 | root resolver | `/` | `/marketing` | STARTA MATCH. | - | none |
| 2 | marketing | `/marketing` | `/marketing` | STARTA MATCH. | - | none |
| 3 | app dashboard | `/app` | `/app` | Welcome. | nav | listLiveFeed (env) |
| 4 | privacy | `/privacy` | `/privacy` | Privacy | - | none |
| 5 | terms | `/terms` | `/terms` | Terms | - | none |
| 6 | contact | `/contact` | `/contact` | Contact | - | none |
| 7 | login | `/login` | `/login` | SCOREEASY | - | none |
| 8 | login returnTo | `/login?returnTo=%2Fhistory` | `/login?returnTo=%2Fhistory` | SCOREEASY | - | none |
| 9 | login evil returnTo | `/login?returnTo=%2F%2Fevil.example` | `/login?returnTo=%2F%2Fevil.example` | SCOREEASY | - | none |
| 10 | signin alias | `/signin?returnTo=%2Fhistory` | `/login?returnTo=%2Fhistory` | SCOREEASY | - | none |
| 11 | sign-in alias | `/sign-in` | `/login` | SCOREEASY | - | none |
| 12 | signup | `/signup` | `/signup` | SCOREEASY | - | none |
| 13 | sso-callback | `/sso-callback` | `/sign-in` (Clerk hosted page) | Sign in to My Application | - | CSP notice from accounts.dev |
| 14 | onboarding (guest) | `/onboarding` | `/login?returnTo=%2F` | SCOREEASY | - | none |
| 15 | profile (guest) | `/profile` | `/profile` | Save your profile when you're ready | nav | none |
| 16 | profile/:username bad | `/profile/no-such-user-xyz` | `/profile/no-such-user-xyz` | Profile not found | nav | none |
| 17 | users/search (guest) | `/users/search` | `/users/search` | Find Players | - | none |
| 18 | play | `/play` | `/play` | text: GUIDED BROWSE 1 PICK A SPORT What are you scoring today? | nav | none |
| 19 | play ?sport=cricket | `/play?sport=cricket` | `/play?sport=cricket` | text: GUIDED … PICK A SPORT (sport ignored) | nav | none |
| 20 | play ?sport=cricket browse | `/play?sport=cricket` (browseMode) | `/play?sport=cricket` | Play | nav | none |
| 21 | play ?sport=bogus | `/play?sport=bogus` | `/play?sport=bogus` | text: GUIDED … PICK A SPORT | nav | none |
| 22 | history | `/history` | `/history` | History & Stats | nav | none |
| 23 | legacy dashboard | `/dashboard` | `/app` | Welcome. | nav | listLiveFeed (env) |
| 24 | legacy quick-match | `/quick-match` | `/volleyball/quick` | 🏐 Quick Match | - | none |
| 25 | legacy quick-match tennis | `/quick-match?sport=tennis` | `/tennis/quick` | 🎾 Quick Match | - | none |
| 26 | legacy quick-match bogus | `/quick-match?sport=bogus` | `/volleyball/quick` | 🏐 Quick Match | - | none |
| 27 | legacy tournament | `/tournament` | `/play` | text: GUIDED … PICK A SPORT | nav | none |
| 28 | legacy tournament football | `/tournament?sport=football` | `/football/tournament` | ⚽ Football Tournaments | nav | none |
| 29 | legacy stats | `/stats` | `/history` | History & Stats | nav | none |
| 30 | legacy statistics | `/statistics` | `/history` | History & Stats | nav | none |
| 31 | legacy game/:id unknown | `/game/123` | `/game/123` | Resume link unavailable | - | none |
| 32 | legacy game/:id tennis draft | `/game/1761000000000` (tennisDraft) | `/tennis/quick/live/1761000000000` | Tennis match scorer | - | none |
| 33 | live bad token | `/live/not-a-real-token` | `/live/not-a-real-token` | App route crashed | - | live:getByToken threw |
| 34 | live empty token | `/live/` | `/live/` | This screen is not available | - | none |
| 35 | live kiosk bad token | `/live/zzz?kiosk=1` | `/live/zzz?kiosk=1` | App route crashed | - | live:getByToken threw |
| 36 | dead /setup | `/setup` | `/setup` | This screen is not available | - | none |
| 37 | dead /showcase/landing-designs | `/showcase/landing-designs` | `/showcase/landing-designs` | This screen is not available | - | none |
| 38 | showcase match-card (dev only) | `/showcase/match-card` | `/showcase/match-card` | Match Card Design Variations | - | none |
| 39 | unknown path | `/this/does/not/exist` | `/this/does/not/exist` | This screen is not available | - | none |
| 40 | volleyball quick | `/volleyball/quick` | `/volleyball/quick` | 🏐 Quick Match | - | none |
| 41 | tennis quick | `/tennis/quick` | `/tennis/quick` | 🎾 Quick Match | - | none |
| 42 | cricket quick | `/cricket/quick` | `/cricket/quick` | 🏏 Quick Match | - | none |
| 43 | football quick | `/football/quick` | `/football/quick` | ⚽ Quick Match | - | none |
| 44 | pickleball quick (to deregister) | `/pickleball/quick` | `/pickleball/quick` | 🏓 Quick Match | - | none |
| 45 | bogus sport quick | `/madeupsport/quick` | `/madeupsport/quick` | This screen is not available | - | none |
| 46 | uppercase sport | `/Volleyball/quick` | `/Volleyball/quick` | This screen is not available | - | none |
| 47 | sport root only | `/volleyball` | `/volleyball` | This Volleyball screen is not available | - | none |
| 48 | quick trailing slash | `/volleyball/quick/` | `/volleyball/quick/` | 🏐 Quick Match | - | none |
| 49 | volleyball tournaments | `/volleyball/tournament` | `/volleyball/tournament` | 🏐 Volleyball Tournaments | nav | none |
| 50 | volleyball tournament new | `/volleyball/tournament/new` | `/volleyball/tournament/new` | New Tournament | - | none |
| 51 | volleyball tournament bad id | `/volleyball/tournament/999` | `/volleyball/tournament/999` | text: Tournament not found (no heading) | nav | none |
| 52 | volleyball tournament non-numeric id | `/volleyball/tournament/abc` | `/volleyball/tournament/abc` | text: Tournament not found (no heading) | nav | none |
| 53 | scorer bad ids | `/volleyball/tournament/999/match/1/score` | same | Match not found | - | none |
| 54 | result bad ids | `/volleyball/tournament/999/match/1/result` | same | Result unavailable | nav | none |
| 55 | bogus sport tournament | `/madeupsport/tournament` | same | This screen is not available | - | none |
| 56 | bogus sport tournament id | `/madeupsport/tournament/1` | same | This screen is not available | - | none |
| 57 | tournament match (no /score) | `/volleyball/tournament/999/match/1` | same | This Volleyball screen is not available | nav | none |
| 58 | cricket test bad id | `/cricket/quick/test-match/999` | same | text: Loading... | stuck Loading | none |
| 59 | cricket test legacy | `/cricket/quick/test/999` | `/cricket/quick/test-match/999` | text: Loading... | stuck Loading | none |
| 60 | cricket test on volleyball | `/volleyball/quick/test-match/1` | same | This Volleyball screen is not available | - | none |
| 61 | tennis live bad id | `/tennis/quick/live/999` | same | Match not found | - | none |
| 62 | tennis live good id | `/tennis/quick/live/1761000000000` (tennisDraft) | same | Tennis match scorer | - | none |
| 63 | tennis live on volleyball | `/volleyball/quick/live/1` | same | This Volleyball screen is not available | - | none |
| 64 | legacy tennis live | `/tennis/live/999` | `/tennis/quick/live/999` | Match not found | - | none |
| 65 | legacy live on volleyball | `/volleyball/live/1` | same | This Volleyball screen is not available | - | none |
| 66 | root with one tennis draft | `/` (tennisDraft) | `/tennis/quick/live/1761000000000` | Tennis match scorer | - | none |
| 67 | root with two drafts | `/` (twoDrafts) | `/app` | Welcome. (drafts not shown) | nav | listLiveFeed (env) |
| 68 | app with two drafts | `/app` (twoDrafts) | `/app` | Welcome. (drafts not shown) | nav | listLiveFeed (env) |
| 69 | football tournament good | `/football/tournament/100` (football) | same | Sunday League | nav | none |
| 70 | football scorer good | `/football/tournament/100/match/m1/score` (football) | same | Football match scorer | - | none |
| 71 | football scorer bad match | `/football/tournament/100/match/zzz/score` (football) | same | Match not found | - | none |
| 72 | football result (not completed) | `/football/tournament/100/match/m1/result` (football) | same | Result unavailable | nav | none |
| 73 | volleyball result completed | `/volleyball/tournament/200/match/m1/result` (volleyballDone) | same | Sharks win 2–0 | nav | none |
| 74 | football tournament under wrong sport | `/basketball/tournament/100` (football) | same | text: Tournament not found | nav | none |
| 75 | app with legacy session | `/app` (legacySession) | `/app` | Welcome back. (1 ACTIVE card) | nav | listLiveFeed (env) |
| 76 | FLOW legacy session card → Resume | `/app` (legacySession) | `/game/sess-1` | Resume link unavailable | - | listLiveFeed (env) |
| 77 | FLOW Back from untouched quick setup | `/app` → Play → Quick match: Volleyball → Back | `/volleyball/quick` | 🏐 Quick Match | exit dialog open | listLiveFeed (env) |
| 78 | FLOW tennis quick Finish → Back | `/app`, open scorer (tennisDraftWon) → Finish (`/history`) → Back | `/tennis/quick/live/1761000000000` | Match not found | - | listLiveFeed (env) |
| 79 | FLOW football Finish → Back | `/football/tournament/100` → Enter Score → Finish (`/football/tournament/100`) → Back | `/football/tournament/100/match/m1/score` | Football match scorer | - | none |
| 80 | FLOW result → Back (control) | `/volleyball/tournament/200` → result → Back | `/volleyball/tournament/200` | Beach Cup | nav | bfcache notices |
| 81 | FLOW in-app back arrow on untouched setup | `/app` → Play → Quick match: Volleyball → "Go back" | `/volleyball/quick` | 🏐 Quick Match | exit dialog open | listLiveFeed (env) |
| 82 | FLOW cricket Test bad id → Back | `/app` → `/cricket/quick/test-match/999` → Back | same | Loading... + "Leave this page?" | exit dialog open, stuck Loading | listLiveFeed (env) |
| 83 | FLOW string tournament id → Enter Score | `/football/tournament/fx` (stringIdFootball) | `/football/tournament/fx/match/m1/score` | text: Loading... | stuck Loading | none |
| 84 | FLOW crash → in-app nav | `/live/not-a-real-token` → push `/history` | `/history` | App route crashed | nav | live:getByToken threw |
| 85 | FLOW profile not-found → Back (deep link) | `/profile/no-such-user-xyz` → Back | `about:blank` | left the app | - | none |
| 86 | FLOW Home tab with one volleyball draft | `/play` (volleyDraftOnly) → Home | `/app` | Welcome. "Play your first match" | nav | listLiveFeed (env) |
| 87 | FLOW Home on 404 with one draft | `/this/does/not/exist` (tennisDraft) → Home | `/tennis/quick/live/1761000000000` | Tennis match scorer | - | none |
| 88 | FLOW Home tab (from tournament list) with one tennis draft | `/volleyball/tournament` (tennisDraft) → Home | `/app` | Welcome. | nav | listLiveFeed (env) |
| 89 | prototype key quick | `/constructor/quick` | same | 🏐 Quick Match, "Match rules Object" | - | none |
| 90 | prototype key tournament | `/toString/tournament` | same | toString Tournaments | nav | none |
| 91 | prototype key tournament id | `/constructor/tournament/1` | same | text: Engine type not supported | - | none |

## Contract tests

`src/designs/design1-mono/routes.contract.test.jsx`, 34 tests (27 normal, 7 expected failures):
- **Pinned (pass today):** generic 404 with Play/Home; sport-scoped 404 on `/volleyball`; single draft auto-resumes from `/`.
- **RA-3 fixed:** 10 normal passing cases verify Home Resume, the multi-match entry chooser and all eight generic sport quick scorers; tennis uses its dedicated saved-draft scorer.
- **Goals RA-1 fixed / quick regression:** 9 normal passing cases pin the four registered goals sports, tournament Finish and Back with Undo, and quick-match saved-result preservation. Cricket completion is now covered by normal passing contracts; tennis remains open.
- **`it.fails` (encode the correct behaviour, fail today):** RA-2, RA-4, RA-5, RA-6, RA-7, RA-8, RA-9. Each one was first run as a plain `it` to confirm it fails on its contract assertion, not on the harness. The fix PR for each finding flips its test to `it`.

Sync with RA-3 master (`4da859d`): routing expected failures decrease from 8 to 7 by replacing the single goals RA-1 expected failure with parameterized normal tests. The four stability cases are unchanged, so the repository total decreases from 12 to 11. Master's RA-3 tests and every contract from RA-2 onward are preserved without duplication.

### RA-3 integration evidence

Merged `origin/master` at `8384956` using the master audit files as the base, preserving the spawned-process Chrome debugger endpoint validation and the omitted-showcase disclosure. RA-3 phone evidence was refreshed from `bun run dev` on port 5173 at 390?844 CSS pixels (device scale 2): all 18 selected cases reached their intended surface without horizontal overflow or stuck loading; Home Resume targets measured at least 44px tall. Each refreshed screenshot in `2026-10-21-routing-fixes/RA-3/after/` was inspected. The local backend returned `live:listLiveFeed` errors that the existing silent Home error boundary caught; public live-feed availability is not proven by this demo. At that integration, the other eight route findings and all four stability cases remained expected failures. The palette ratchet was exactly 667; no baseline or exclusion changed in that integration.

## Fix plan

The original plan below groups fixes by scorer impact. Harsha's current delivery direction is to merge the appropriate existing PRs; this table does not authorize opening more PRs. A fix with a matching contract is verified by flipping it from `it.fails` to `it`, re-running the matching sweep cases (`ONLY=<regex> node scripts/route-sweep.mjs`), and a phone-viewport demo for the merge. Findings without a contract need focused proof in their owning implementation work.

| # | PR | Fixes | Files | Risk | Verification |
|---|----|-------|-------|------|--------------|
| 1 (fixed) | **Resume surface: `/app` lists every in-progress draft** | RA-3 (and gives RA-10's Home a useful target) | `landing/DashboardLanding.jsx` (read `loadQuickMatchDrafts`, `loadTennisQuickDrafts`, in-progress cricket Test from `utils/appEntry.js`; one resume card per `entryPath`) + test | Low: read-only UI over existing loaders | RA-3; runs #67-68, #86; demo with 2 drafts |
| 2a-c | **Back-stack: every scorer finishes through `completeProtectedScoring`**, one PR per game: (a) goals, (b) tennis quick + tournament, (c) cricket limited / Test / guided | RA-1, RA-2 | `scoring/MonoGoalsLiveScore.jsx`; `scoring/MonoTennisLiveScore.jsx`; `scoring/MonoCricketLiveScore.jsx`, `MonoCricketTestLiveScore.jsx`, `MonoCricketGuidedScorerRoute.jsx` + per-scorer tests modelled on `MonoSetsLiveScore.test.jsx:279-308` | Medium: history unwinding. The seam already exists and is tested, so each PR is a call-site swap | RA-1/RA-2; runs #78-79; Android device: Finish → hardware Back |
| 3 | **Validate `:id`/`:matchId` routes: one resolver, recovery instead of Loading** | RA-4, RA-7 | new `resolveTournamentMatch(sportId, id, matchId)` beside `utils/storage.js`; use it in the dispatcher, the result screen and every scorer; not-found branch in `MonoCricketTestLiveScore` quick mode (`RouteRecoveryActions`) | Low to medium: touches 6 screens, but they converge on the dispatcher's existing rule | RA-4, RA-7; runs #58-59, #82-83 |
| 4 | **Validate `:sport` with an own-key lookup** | RA-9, RA-18 | `models/sportRegistry.js:460` (`Object.hasOwn`; optional lowercase redirect for RA-18) | Low. Coordinate with `feat/icp-game-focus`, which edits the same registry | RA-9; runs #46, #89-91 |
| 5 | **Route error boundaries: reset on navigation, plus one around `/live/:token`** | RA-6, RA-11 | `index.jsx:1772` (key the boundary by `location.pathname`), `MonoWatchMatch` boundary falling back to `UnavailableScreen` | Low | RA-6; runs #33, #84 |
| 6 | **Arm the exit guard from the scorer, not from the URL** | RA-5 | `index.jsx` guard effect, `mobile/backButton.js` (`isProtectedScoringRoute`), `MonoQuickMatch.jsx` (signal "scoring" phase), bottom-nav visibility | **Medium to high**: every scorer depends on this guard. Decision recorded below: protect scoring, not setup | RA-5; runs #77, #81; Android device: Back on setup vs. mid-match |
| 7 | **Safe Back and one meaning of Home** | RA-8, RA-10, RA-12 | `goBackOr(navigate, fallback)` helper; replace `navigate(-1)` in `MonoProfile`, `MonoUserSearch`; point in-app "Home" buttons at `/app` (`RouteRecoveryActions`, `MonoTournamentList`, `MonoTournamentSetup`, `MonoProfile`, `MonoAuthPageFrame`, `ErrorBoundary`); make scorer Cancel/Discard exits unwind instead of push | Low to medium | RA-8; runs #85, #87 |
| 8 | **Route table out of `index.jsx`** | maintainability | move the `<Route>` list, legacy redirects and guards into `routes.jsx` / `routeGuards.jsx`; `index.jsx` keeps the shell | Low: pure move, guarded by `routes.contract.test.jsx` + `AppRouteRecovery.test.jsx` | full suite + full sweep diff identical |
| 9 | **Path builders per area** (extends `src/utils/appPaths.js` from PR #158) | RA-14, RA-20, the 94 literals | `quickPath`, `tournamentPath`, `tournamentMatchPath(…, 'score'\|'result')`, `testMatchPath`, `tennisLivePath`, `livePath`, `loginPath(returnTo)`; replace call sites screen by screen, one PR per area (dashboard, quick match, tournaments, scorers, auth) | Low | grep for `navigate('/` literals trending to 0; sweep unchanged |
| 10 | **Dead routes and screens** | RA-16, RA-17, RA-20, RA-21 | delete ✱ screens and `gs_sessions` cards (or map them), heading on `TournamentNotFoundActions`, dispatcher fallbacks → `NotFoundRoute` | Low | runs #36-37, #51-52, #75-76 |
| 11 | **Small auth and result fixes** | RA-15, RA-19, RA-22 | honour `?sport` in Guided mode; `onSignIn` with `returnTo`; onboarding completion `replace`; consume or clear stored `returnTo` on every sign-in | Low | runs #13, #19 |

Not a code PR: **RA-13 App Links.** Publishing `assetlinks.json` and `apple-app-site-association` needs the release SHA-256 fingerprint and the Apple Team ID (`docs/mobile/app-link-associations.md`). Until they are published, shared live links open in the browser.

Plan items 2a (goals tournament completion) and 2c (cricket limited-overs, Test and guided completion) are implemented. Item 2b (tennis) remains open.

### Recorded decisions and remaining release question

> **Decided by Harsha, 2026-10-21:**
> - **RA-5:** the leave-match guard turns on only once scoring starts; quick-match setup shows the bottom nav and leaves without a warning.
> - **RA-10:** every in-app Home goes to `/app`; `/` stays for the logo and cold start.
> - **Rematch:** hidden on tournament match results (tournament results offer Back to tournament / Next match); quick-match results keep Rematch.
> - **RA-13** (who publishes the app-link files, and when) is still open: it needs the release signing fingerprint and Apple Team ID.


The guard, Home and Rematch decisions above are settled. The remaining release question is **RA-13:** who publishes the association files, and when. It is outside this audit integration leaf.

## Forge issues (P0/P1)

| Finding | Issue id |
|---|---|
| RA-1 Back after finishing a tournament match reopens its scorer | `a7088ac7-c11b-4a36-9012-25baacb4248f` |
| RA-2 Back after finishing a tennis quick match lands on a dead scorer | `80bba13a-e002-4a13-8dc8-600bc9cd430e` |
| RA-3 Home dashboard hides in-progress quick matches | `6fc57130-4f71-404c-b4a2-673929ba16b8` |
| RA-4 Unknown cricket Test match id shows endless Loading | `504a2ffb-85fa-4861-95b6-62954d7f34d3` |

### Cricket RA-1 integration

Cricket finish exits use `completeProtectedScoring`, with replace navigation when the provider is absent. Limited-overs quick cricket already finishes in place; its restored Undo and saved innings are pinned as a regression. Draft/Discard navigation is outside this fix. Completed results retain their scores and innings; completed drafts are intentionally cleared, while Undo is verified before completion and across scorer remount.

Master (`0038e60`) contains no separate cricket expected-failure test. Five normal cricket route cases are added without altering tennis or any existing fixes: routing expected failures remain **7 before / 7 after**, and repository-wide expected failures remain **11 before / 11 after**. Full-suite execution is deferred to the normal pre-push hook after the lane-free checkpoint.
