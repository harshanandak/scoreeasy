# Routing audit (2026-10-21)

## Problem

Harsha, 2026-10-21: "check other routing also, I believe a lot of routing is bad right now; we need to improve application stability and reliability."

The decision is to stay on React Router v7 (`react-router-dom` 7.15) and clean it up. TanStack Router is off the table. This document covers:

- an inventory of every route, every navigation call site, and every place a path string is built;
- the problems found, with file:line evidence and a severity;
- a run of every route in the real app as a guest (headless Chrome, phone viewport);
- contract tests for the top findings;
- a fix plan of small, one-point PRs, ordered by how much each one matters to a scorer mid-match.

App code is not changed here. The only code added is `src/designs/design1-mono/routes.contract.test.jsx` and the sweep script `scripts/route-sweep.mjs`.

**Severity scale.** P0: a point or a match is lost, or the board lies. P1: a scorer can lose track of a match, gets stuck, or Back does something unsafe mid-match. P2: wrong or confusing behaviour with a way out. P3: polish, dead code, or a latent risk.

**In flight, not duplicated here:**
- PR #158 (`fix/start-match-routing`) repoints the generic "start a match" buttons to `/play` and adds `src/utils/appPaths.js`.
- `feat/icp-game-focus` deregisters pickleball, squash, rugby, futsal and handball, and decides what an unknown-sport URL does (e.g. `/pickleball/quick`). Findings that touch unknown sports are noted for that branch below. This audit does not propose a competing fix.
- PR #159 (`fix/flaky-tests`) adds `src/test/preloadAppRoutes.js`. It is not on master yet, so the new contract test uses the `AppRouteRecovery.test.jsx` harness. Switch it to the preload helper when #159 lands.

## Top findings in plain words

1. **Back after finishing a match goes back into the match** (RA-1, RA-2). Only volleyball-style (sets) tournament scorers leave the scorer cleanly. Football/basketball/hockey/kabaddi, tennis and cricket scorers *push* the next screen on Finish. So Back reopens the scorer you just finished. For a tennis quick match it opens a dead "Match not found" page that still has the exit guard on it.
2. **The Home screen cannot see a match in progress** (RA-3). `/app` only lists finished matches and tournaments. With one live quick match, the Home tab says "Play your first match". With two or more, the app entry sends you to `/app` on purpose so you can choose one, but there is nothing there to choose. In-progress tennis quick matches then have no way back in from the UI.
3. **Stale cricket Test links hang on "Loading..." forever** (RA-4). The bottom nav is hidden, and Back warns about losing unsaved progress for a match that does not exist.
4. **The exit warning fires before a match even starts** (RA-5). `/:sport/quick` is guarded by URL, so the untouched setup form already asks "Leave this page? Your unsaved scoring progress may be lost." That trains scorers to tap Leave without reading.
5. **One crash sticks** (RA-6). The route error boundary never resets. After any screen throws, every later in-app navigation still shows "App route crashed" until a full reload. The public `/live/:token` page has no boundary of its own (RA-11).
6. **Ids are validated five different ways** (RA-4, RA-7, RA-9). Some screens show recovery for a bad id, some spin forever, and `/constructor/quick` is accepted as a real sport.
7. **Back and Home are not consistent** (RA-8, RA-10, RA-12). `navigate(-1)` with no fallback can leave the app. In-app back arrows push while hardware Back pops. "Home" means `/` on some buttons and `/app` on others, so Home on a 404 can drop you straight into a live scorer.

There is no P0. No route path was found that drops a scored point: scorers autosave drafts before they navigate. The problems are lost *track* of matches, Back loops and dead ends.

## Method

- Static read of `src/designs/design1-mono/index.jsx` (39 `<Route>`s, 25 `lazy()` chunks), `src/mobile/backButton.js`, `src/mobile/deepLinks.js`, `src/utils/authRedirect.js`, `src/utils/appEntry.js`, `src/auth/CloudAuthRoot.jsx`, and every `navigate(`, `<Link`, `<Navigate`, `location.*`, `history.*` call outside tests. That is 94 `navigate('/…')` literal call sites, 6 `navigate(-1)`, and 37 `<Link>`/`<Navigate>`/`href="/…"`.
- Runtime: `bunx vite --port 5193 --strictPort` with `.env.local`, driven by `scripts/route-sweep.mjs`. The script uses the Chrome DevTools protocol at 390×844 with mobile emulation and a fresh browser context per case (guest, empty storage unless seeded). For each case it records the final URL, the visible heading, the page text, whether the bottom nav and the exit dialog are showing, and console errors. Seeded cases put realistic drafts and tournaments in localStorage. Flow cases click through and press Back.
- Environment caveat: the Convex dev deployment in `.env.local` does not have the `live` module pushed. `live:getByToken` and `live:listLiveFeed` return "Could not find public function" (checked with a direct `/api/query` call). That accounts for the `listLiveFeed (env)` errors in the run table. The *routing* consequence of a backend error on `/live/:token` is still a real finding (RA-11).

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
| Scorers (`scoring/*`) | 13 | `/:sport/tournament/:id`, `/:sport/quick`, `/history`, result path | completion pushes, except Sets (RA-1) |
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

Evidence marked "run #n" refers to the run table below. "Contract RA-n" is the matching `it.fails` test in `routes.contract.test.jsx`.

| ID | Sev | Finding | Evidence | Forge |
|----|-----|---------|----------|-------|
| RA-1 | P1 | Back after finishing a tournament match reopens its scorer (goals, tennis-tournament, cricket limited-overs, cricket Test, guided cricket). Only the sets scorer uses `completeProtectedScoring`. The others PUSH the tournament page. | `scoring/MonoGoalsLiveScore.jsx:198,290,397`; `scoring/MonoTennisLiveScore.jsx:687`; `scoring/MonoCricketLiveScore.jsx:600`; `scoring/MonoCricketTestLiveScore.jsx:596-602`; `scoring/MonoCricketGuidedScorerRoute.jsx:125`; vs `scoring/MonoSetsLiveScore.jsx:501-505`. Run #79: Finish → `/football/tournament/100` → Back → `/football/tournament/100/match/m1/score` "Football match scorer". Contract RA-1. | `a7088ac7-c11b-4a36-9012-25baacb4248f` |
| RA-2 | P1 | Back after finishing a tennis quick match lands on `/tennis/quick/live/<id>`, now "Match not found", with the exit guard armed again. | `scoring/MonoTennisLiveScore.jsx:630-632` (clear draft, push `/history`); `:711-723` recovery branch; protected by `backButton.js:10`. Run #78. Contract RA-2. | `80bba13a-e002-4a13-8dc8-600bc9cd430e` |
| RA-3 | P1 | `/app` never lists in-progress drafts. With 1 draft the Home tab shows "Play your first match". With 2+ drafts the app entry lands on `/app` on purpose, but nothing there lets the scorer pick one. Tennis drafts are then unreachable from the UI. | `landing/DashboardLanding.jsx:723-736` reads `gs_sessions`, `se_quickmatches`, tournaments only; `:758` `hasNoData`; `utils/appEntry.js:92-100` (2+ drafts → `/app`); tennis drafts are discovered only in `appEntry.js:39-51`. Runs #67-68 (`/` → `/app` "Welcome."), #86 (one volleyball draft, Home tab → "Welcome."). Contract RA-3. | `6fc57130-4f71-404c-b4a2-673929ba16b8` |
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

`src/designs/design1-mono/routes.contract.test.jsx`, 12 tests:
- **Pinned (pass today):** generic 404 with Play/Home; sport-scoped 404 on `/volleyball`; single draft auto-resumes from `/`.
- **`it.fails` (encode the correct behaviour, fail today):** RA-1, RA-2, RA-3, RA-4, RA-5, RA-6, RA-7, RA-8, RA-9. Each one was first run as a plain `it` to confirm it fails on its contract assertion, not on the harness. The fix PR for each finding flips its test to `it`.

## Fix plan

Small one-point PRs, ordered by scorer impact. Each one is verified by flipping its contract test(s) from `it.fails` to `it`, re-running the matching sweep cases (`ONLY=<regex> node scripts/route-sweep.mjs`), and a phone-viewport demo for the merge.

| # | PR | Fixes | Files | Risk | Verification |
|---|----|-------|-------|------|--------------|
| 1 | **Resume surface: `/app` lists every in-progress draft** | RA-3 (and gives RA-10's Home a useful target) | `landing/DashboardLanding.jsx` (read `loadQuickMatchDrafts`, `loadTennisQuickDrafts`, in-progress cricket Test from `utils/appEntry.js`; one resume card per `entryPath`) + test | Low: read-only UI over existing loaders | RA-3; runs #67-68, #86; demo with 2 drafts |
| 2a-c | **Back-stack: every scorer finishes through `completeProtectedScoring`**, one PR per game: (a) goals, (b) tennis quick + tournament, (c) cricket limited / Test / guided | RA-1, RA-2 | `scoring/MonoGoalsLiveScore.jsx`; `scoring/MonoTennisLiveScore.jsx`; `scoring/MonoCricketLiveScore.jsx`, `MonoCricketTestLiveScore.jsx`, `MonoCricketGuidedScorerRoute.jsx` + per-scorer tests modelled on `MonoSetsLiveScore.test.jsx:279-308` | Medium: history unwinding. The seam already exists and is tested, so each PR is a call-site swap | RA-1/RA-2; runs #78-79; Android device: Finish → hardware Back |
| 3 | **Validate `:id`/`:matchId` routes: one resolver, recovery instead of Loading** | RA-4, RA-7 | new `resolveTournamentMatch(sportId, id, matchId)` beside `utils/storage.js`; use it in the dispatcher, the result screen and every scorer; not-found branch in `MonoCricketTestLiveScore` quick mode (`RouteRecoveryActions`) | Low to medium: touches 6 screens, but they converge on the dispatcher's existing rule | RA-4, RA-7; runs #58-59, #82-83 |
| 4 | **Validate `:sport` with an own-key lookup** | RA-9, RA-18 | `models/sportRegistry.js:460` (`Object.hasOwn`; optional lowercase redirect for RA-18) | Low. Coordinate with `feat/icp-game-focus`, which edits the same registry | RA-9; runs #46, #89-91 |
| 5 | **Route error boundaries: reset on navigation, plus one around `/live/:token`** | RA-6, RA-11 | `index.jsx:1772` (key the boundary by `location.pathname`), `MonoWatchMatch` boundary falling back to `UnavailableScreen` | Low | RA-6; runs #33, #84 |
| 6 | **Arm the exit guard from the scorer, not from the URL** | RA-5 | `index.jsx` guard effect, `mobile/backButton.js` (`isProtectedScoringRoute`), `MonoQuickMatch.jsx` (signal "scoring" phase), bottom-nav visibility | **Medium to high**: every scorer depends on this guard. Needs a decision first (below) | RA-5; runs #77, #81; Android device: Back on setup vs. mid-match |
| 7 | **Safe Back and one meaning of Home** | RA-8, RA-10, RA-12 | `goBackOr(navigate, fallback)` helper; replace `navigate(-1)` in `MonoProfile`, `MonoUserSearch`; point in-app "Home" buttons at `/app` (`RouteRecoveryActions`, `MonoTournamentList`, `MonoTournamentSetup`, `MonoProfile`, `MonoAuthPageFrame`, `ErrorBoundary`); make scorer Cancel/Discard exits unwind instead of push | Low to medium | RA-8; runs #85, #87 |
| 8 | **Route table out of `index.jsx`** | maintainability | move the `<Route>` list, legacy redirects and guards into `routes.jsx` / `routeGuards.jsx`; `index.jsx` keeps the shell | Low: pure move, guarded by `routes.contract.test.jsx` + `AppRouteRecovery.test.jsx` | full suite + full sweep diff identical |
| 9 | **Path builders per area** (extends `src/utils/appPaths.js` from PR #158) | RA-14, RA-20, the 94 literals | `quickPath`, `tournamentPath`, `tournamentMatchPath(…, 'score'\|'result')`, `testMatchPath`, `tennisLivePath`, `livePath`, `loginPath(returnTo)`; replace call sites screen by screen, one PR per area (dashboard, quick match, tournaments, scorers, auth) | Low | grep for `navigate('/` literals trending to 0; sweep unchanged |
| 10 | **Dead routes and screens** | RA-16, RA-17, RA-20, RA-21 | delete ✱ screens and `gs_sessions` cards (or map them), heading on `TournamentNotFoundActions`, dispatcher fallbacks → `NotFoundRoute` | Low | runs #36-37, #51-52, #75-76 |
| 11 | **Small auth and result fixes** | RA-15, RA-19, RA-22 | honour `?sport` in Guided mode; `onSignIn` with `returnTo`; onboarding completion `replace`; consume or clear stored `returnTo` on every sign-in | Low | runs #13, #19 |

Not a code PR: **RA-13 App Links.** Publishing `assetlinks.json` and `apple-app-site-association` needs the release SHA-256 fingerprint and the Apple Team ID (`docs/mobile/app-link-associations.md`). Until they are published, shared live links open in the browser.

### Decisions for Harsha

> **Decided by Harsha, 2026-10-21:**
> - **RA-5:** the leave-match guard turns on only once scoring starts; quick-match setup shows the bottom nav and leaves without a warning.
> - **RA-10:** every in-app Home goes to `/app`; `/` stays for the logo and cold start.
> - **Rematch:** hidden on tournament match results (tournament results offer Back to tournament / Next match); quick-match results keep Rematch.
> - **RA-13** (who publishes the app-link files, and when) is still open: it needs the release signing fingerprint and Apple Team ID.


- **RA-5, quick-match setup.** (a) Keep the guard on setup but drop the "unsaved scoring progress" wording until a point is scored. (b) Arm the guard only once scoring starts, and show the bottom nav on setup (recommended: the setup form has nothing to lose). (c) Leave as is.
- **RA-10, what "Home" means.** (a) `/app` everywhere inside the app, and `/` only for the brand/logo and cold start (recommended). (b) `/` everywhere, accepting that Home can jump into a live scorer.
- **RA-13.** Who publishes the association files, and when.
- **RA-19.** Should Rematch from a tournament result open a quick match at all?

## Forge issues (P0/P1)

| Finding | Issue id |
|---|---|
| RA-1 Back after finishing a tournament match reopens its scorer | `a7088ac7-c11b-4a36-9012-25baacb4248f` |
| RA-2 Back after finishing a tennis quick match lands on a dead scorer | `80bba13a-e002-4a13-8dc8-600bc9cd430e` |
| RA-3 Home dashboard hides in-progress quick matches | `6fc57130-4f71-404c-b4a2-673929ba16b8` |
| RA-4 Unknown cricket Test match id shows endless Loading | `504a2ffb-85fa-4861-95b6-62954d7f34d3` |
