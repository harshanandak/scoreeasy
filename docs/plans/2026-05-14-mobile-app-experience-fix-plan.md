# Mobile App Experience Fix Plan

Date: 2026-05-14

Scope: mobile-first web and Capacitor/Play Store experience. Desktop is secondary.

Source basis:
- Live Playwright audits against `http://127.0.0.1:5173/`
- Pixel-sized mobile viewport checks
- First-wave workflow agents: home, play discovery, quick match, live scoring, tournament, history/stats/results
- Second-wave workflow agents: auth/profile, navigation/routing/back, visual layout, multi-sport consistency, offline/PWA/Capacitor, prioritization

## Product Direction

The app should optimize for one phone-held job:

`Open app -> start scoring -> finish match -> share/save -> return later`

The current app can complete many of those steps, but it still feels like a responsive website wrapped in Capacitor. For Play Store use, the app should feel like a native scoring utility: immediate, thumb-friendly, reliable offline, and clear about what is saved.

## Target Mobile Flow

### Primary Guest Flow

1. Open app
2. See a mobile home screen with:
   - `Start Volleyball Match`
   - `Choose another sport`
   - `Resume match` if available
   - `History` if matches exist
3. Tap `Start Volleyball Match`
4. Land on one setup screen:
   - Team A
   - Team B
   - Rules summary: `Best of 3 · 25 pts · win by 2`
   - `Edit rules`
   - Sticky `Start Match`
5. Score match
6. Finish match
7. Result screen offers:
   - `Share`
   - `Rematch`
   - `View history`
   - `See stats`
   - `New match`

### Secondary Tournament Flow

1. `Play` or `Tournament`
2. `Create Tournament`
3. Three-step setup:
   - Basics
   - Rules
   - Teams
4. Review bottom sheet
5. Sticky `Start Tournament`
6. Tournament list becomes resume-first:
   - Next match
   - Progress
   - `Continue`
   - Overflow menu for delete/settings

## P0 Fixes

### P0.1 Fix Score Trust

Problem:
- A single volleyball quick-match score tap increments by 2.

Why it matters:
- The entire app is a scorekeeper. If one tap is wrong, users cannot trust anything else.

Evidence:
- Live scoring audit verified `0 -> 2` after one tap.
- Quick match mutates nested set objects in `MonoQuickMatch.jsx`.
- Tournament scoring clones set objects correctly in `MonoSetsLiveScore.jsx`.
- React StrictMode is enabled in `main.jsx`.

Required change:
- Make quick-match set updates immutable.
- Add a regression test for one tap equals one point.
- Confirm undo reverses exactly one point.

Acceptance:
- One tap: `0 -> 1`
- Two taps: `1 -> 2`
- Undo after two taps: `2 -> 1`
- Works in mobile viewport and production build.

### P0.2 Remove Dev Overlay From App Experience

Problem:
- React Grab toolbar appears on every live screen during development checks and blocks bottom-center mobile content.

Why it matters:
- It makes screenshots and app testing unreliable and would be unacceptable in a Play Store build if accidentally shipped.

Required change:
- Gate React Grab behind an explicit environment flag, not all dev runs.
- Ensure preview/native/release builds never load it.

Acceptance:
- No `Select element`, `Copy all comments`, or overlay toolbar appears in mobile QA unless explicitly enabled.

### P0.3 Make Start Scoring Fast

Problem:
- Fastest current path is too long:
  `/` -> `/play` -> find/search Volleyball -> Quick Match -> Standard/Custom -> Teams -> fill both names -> Start.

Required change:
- Add a direct mobile-first CTA: `Start Volleyball Match`.
- Preselect standard Volleyball rules.
- Prefill team names as `Team A` and `Team B`.
- Let user start immediately and rename if needed.

Acceptance:
- From cold open to score screen in 2 taps:
  `Start Volleyball Match` -> `Start Match`

## P1 Fixes

### P1.1 Redesign Mobile Home

Current issues:
- It behaves like a marketing page.
- Sport tabs are too short and clip horizontally.
- Signup competes with scoring even though guest scoring is supported.

Required change:
- Above the fold should be an app dashboard, not a landing page.
- Primary action: `Start Volleyball Match`
- Secondary action: `Choose another sport`
- Auth becomes a small save/sync affordance, not a co-primary CTA.
- Marketing sections move below the first decision or are hidden in app mode.

### P1.2 Replace Hamburger-Only Mobile Navigation

Current issues:
- Mobile navigation is hamburger-first.
- Menu opens as a partial panel without strong modal/backdrop behavior.
- Current route state is weaker on mobile than desktop.

Required change:
- Add bottom navigation for core app areas:
  - Play
  - History
  - Stats
  - Profile
- Keep hamburger/settings for secondary routes.
- During live scoring, hide bottom nav or convert it to match controls.

### P1.3 Fix Native Back Safety

Current issue:
- Native back handler can call `goBack()` before checking protected scoring routes when `canGoBack` is true.

Required change:
- Check protected scoring routes before native `goBack()`.
- Replace browser-style confirm with an app-styled bottom sheet:
  - `Stay in match`
  - `Save and leave`
  - `Discard`

### P1.4 Make Live Scoring Court-Side Friendly

Current issues:
- Score panels are large, which is good.
- `End Match` and `Swap` are too small and top-mounted.
- Missing match context: serve, last scorer, match point/deuce, set target, swapped-side state.

Required change:
- Bottom thumb controls:
  - Undo
  - Swap sides
  - End
- End Match requires hold or confirmation.
- Add `Last: Team A +1` chip.
- Add persistent rule/status strip:
  - `Best of 3`
  - `Set 1`
  - `First to 25`
  - `Win by 2`

### P1.5 Simplify Quick Match Setup

Current issues:
- First screen asks Standard vs Custom before the user names teams.
- Team names are required and empty by default.
- Add players appears inline and pushes core fields down.
- Custom controls are cramped.

Required change:
- One mobile setup screen with default teams and rule summary.
- Put custom rules in a bottom sheet.
- Put rosters behind optional full-width rows.
- Sticky `Start Match`.

### P1.6 Make Tournament Review Actually Review

Current issues:
- Step label says Review, but optional roster content pushes the actual summary/start below the fold.
- Primary CTAs are inline, not sticky.
- Back controls are small text.

Required change:
- Convert tournament setup to:
  - Basics
  - Rules
  - Teams
  - Review sheet
- Move roster to optional post-start prompt or collapsible section.
- Sticky bottom CTA on every step.

### P1.7 Fix Profile/Auth Dead Ends

Current issues:
- `/profile` unauthenticated state only says sign in and back.
- Public profile route can crash with Convex internals.
- Clerk development badge is visible in live auth screens.
- Guest option appears too low on signup.

Required change:
- Unauthenticated profile screen:
  - Primary: `Sign in`
  - Secondary: `Start scoring as guest`
- Public profile errors become not-found/loading states.
- Verify production Clerk keys and release auth surface.
- Move guest path above or beside auth card on mobile.

## P2 Fixes

### P2.1 Improve History, Results, and Stats Retention

Current issues:
- Result screen is an endpoint, not a loop.
- History empty state is passive.
- Stats are counts, not insights.

Required change:
- Result actions:
  - Share
  - Rematch
  - View history
  - See stats
  - New match
- History empty state:
  - `Start quick match`
  - `Create tournament`
  - Explain completed matches appear here.
- Stats insights:
  - Top team
  - Current streak
  - Closest match
  - Biggest win
  - Last 5 form

### P2.2 Wire Native Share and Haptics Into Core Flow

Current issues:
- Native share helper exists, but quick-match result uses clipboard directly.
- Haptics helper exists, but mobile scoring behavior was not visibly integrated in the verified flow.

Required change:
- Result `Share` uses native share with copy fallback.
- Score taps trigger light haptic feedback.
- Undo/end use distinct feedback.

### P2.3 Make Offline/Local Mode Explicit

Current issues:
- Native Capacitor skips service worker and clears SW caches.
- PWA uses service worker, but cloud requests are NetworkOnly.
- Offline fallback is passive.

Required change:
- Treat native as bundled app plus local storage.
- Show `Offline: saving locally` state.
- Disable cloud-only actions with clear messaging.
- Show pending sync count when relevant.

### P2.4 Add Safe Area and Play Store Polish

Current issues:
- No verified `viewport-fit=cover`.
- No safe-area inset CSS found.
- Manifest generated with SVG-only icons.

Required change:
- Add `viewport-fit=cover`.
- Apply `env(safe-area-inset-*)` to app shell, top nav, bottom nav, and sticky controls.
- Add maskable 192/512 PNG icons.
- Verify splash/status bar on Android.

### P2.5 Unify Multi-Sport Behavior

Current issues:
- Entry routes are mostly unified.
- Scoring engines diverge by sport.
- Tennis quick scoring uses generic points and reads unlike tennis, while tournament tennis has a dedicated scorer.

Required change:
- Quick match should dispatch to the same sport-specific scoring model as tournament where needed.
- Each sport gets a rule summary before start.
- Shared layout, sport-specific scoring controls.

## Mobile Design-System Requirements

Global minimums:
- Tappable controls: 44px minimum height, 48px preferred for primary actions.
- Back buttons and text actions must not be 16px-high tap targets.
- Sticky primary actions at the bottom for setup flows.
- Avoid horizontal clipping unless it is an intentional carousel with visible affordance.
- Define mobile type tokens:
  - label
  - body
  - title
  - display
- Avoid 8px labels for interactive items.
- Inactive tabs/chips need stronger contrast.

Recommended reusable components:
- Mobile app shell
- Bottom nav
- Full-screen mobile menu/settings sheet
- Sticky action bar
- Sport selector
- Rules summary row
- Rules edit bottom sheet
- Team setup form
- Scoreboard status strip
- Result action hub
- Empty state with primary/secondary CTA
- Offline/local mode banner

## Implementation Sequence

### Slice 1: Trust and Release Blockers

1. Fix volleyball scoring `+2` bug.
2. Remove/gate dev overlay.
3. Fix native back protection order.
4. Add not-found route for unknown direct paths.

### Slice 2: Fast Mobile Scoring Path

1. Mobile home becomes app dashboard.
2. Add `Start Volleyball Match` direct path.
3. Pre-fill Team A / Team B.
4. Sticky start action.
5. Rules summary with edit bottom sheet.

### Slice 3: Court-Side Scoring Screen

1. Bottom thumb controls.
2. Last-action chip and undo.
3. Safer End Match.
4. Serve/status/rule context.
5. Haptics.

### Slice 4: Tournament Mobile Flow

1. Three-step setup.
2. Review sheet.
3. Sticky CTAs.
4. Resume-first tournament list.
5. Better empty state.

### Slice 5: Retention and Native Polish

1. Result hub.
2. Native share.
3. History empty and filters.
4. Stats insights.
5. Offline/local mode.
6. Safe-area/icon/splash verification.

### Slice 6: Multi-Sport Consistency

1. Tennis quick scorer parity.
2. Shared sport-specific rule summaries.
3. Normalize scoring controls across engines.
4. Regression mobile route tests.

## Definition of Done

For each slice:
- Verified on Pixel-sized viewport.
- Verified in production build/preview, not just Vite dev.
- No debug overlay.
- No horizontal clipping.
- Main tappable controls meet 44px minimum.
- Core flow is reachable with one hand.
- App keeps or clearly saves match state on route/back/offline transitions.
- Play Store/native-specific screens account for status bar and safe areas.

