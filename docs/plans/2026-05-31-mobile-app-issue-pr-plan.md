# Mobile App Issue PR Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 2026-05-31 mobile app audit into a PR-by-PR execution plan for fixing broken flows, sparse non-home UX, and native Capacitor readiness gaps.

**Architecture:** Treat the app as a Capacitor mobile app first, with React routes as the shared runtime and Android/iOS shells as first-class release surfaces. Each PR is scoped to one product risk area so it can be reviewed, tested, and shipped independently.

**Tech Stack:** React 18, React Router 7, Vite 6, Capacitor 8, Android Gradle, iOS SwiftPM, Vitest, Testing Library.

---

## Summary

Total target: **7 PRs**.

Priority order:

1. **PR 1 - Validation and native run baseline:** restore build/native verification confidence.
2. **PR 2 - Critical dead-route and deep-link recovery:** remove broken end-to-end app flows.
3. **PR 3 - Dashboard start/resume correctness:** fix dashboard actions that start the wrong flow or block valid games.
4. **PR 4 - Direct-entry navigation and multi-sport recovery:** make direct launches, back actions, and fallback CTAs app-safe.
5. **PR 5 - Corrupted UI text and symbol cleanup:** remove visible mojibake from core non-home screens.
6. **PR 6 - Statistics mobile redesign:** make Statistics usable on phone screens.
7. **PR 7 - Sparse/non-home UX polish:** improve Find Players, Legal pages, and generic recovery states.

## Issue Inventory

### P0 - Validation Blockers

#### I-001: Local build fails because `@tailwindcss/vite` is missing from installed dependencies

Evidence:
- `npm run type-check` passed.
- `npm run build` failed with `Cannot find package '@tailwindcss/vite'`.
- `vite.config.js:3` imports `@tailwindcss/vite`.
- `package.json:38` declares `@tailwindcss/vite`.
- `node_modules/@tailwindcss/vite/package.json` was absent during audit.

Impact:
- Blocks `npm run build`, `mobile:build`, `mobile:android`, and `mobile:ios`.
- Prevents reliable Capacitor sync and native app verification.

Target PR:
- **PR 1**.

Files:
- Inspect: `package.json`
- Inspect: `bun.lock`
- Inspect: `vite.config.js`

Validation:
- `npm install` or the repo-approved package install command restores the package.
- `npm run type-check` passes.
- `npm run build` passes.
- `npm run mobile:android` reaches `cap sync android`.

#### I-002: Android emulator QA is blocked by local SDK environment

Evidence:
- `adb` was not available on PATH.
- `studio64.exe` was not available on PATH.
- Prior native audit found Android Studio, SDK tools, and AVD `Pixel_10` on disk, but no running device from absolute-path `adb devices`.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT` were not set.

Impact:
- Cannot honestly verify the actual Android app experience from this shell.
- Android Studio/emulator evaluation remains incomplete until environment is corrected.

Target PR:
- **PR 1** for repo runbook/script support.
- Local machine setup may be outside repo, but document the required commands.

Files:
- Modify or create: `docs/mobile/test-setup.md`
- Modify or create: `MOBILE_TESTING.md`

Validation:
- `adb devices` lists a running emulator.
- `npm run mobile:android` completes.
- Android Studio opens the project or `cap open android` works.
- App launches on emulator.

### P1 - Broken Product Flows

#### I-003: Active game resume navigates to dead `/game/:id`

Evidence:
- Active sessions come from `src/utils/universalStorage.js:47`.
- Dashboard resume navigates to `/game/${session.id}` in `src/designs/design1-mono/landing/DashboardLanding.jsx:572`.
- Route tree does not define `game/:id`; current app routes are under play, sport quick/tournament, statistics, history, and catch-all in `src/designs/design1-mono/index.jsx:1219`.

Impact:
- A user tapping Resume can land on not-found.
- This is severe in a mobile app because resume is a core app behavior.

Target PR:
- **PR 2** if treated as route recovery.
- **PR 3** if fixed together with dashboard session modeling.

Files:
- Modify: `src/designs/design1-mono/landing/DashboardLanding.jsx`
- Modify: `src/designs/design1-mono/index.jsx`
- Inspect: `src/utils/universalStorage.js`
- Add test: `src/designs/design1-mono/landing/DashboardLanding.test.jsx`

Validation:
- Seed legacy `gs_sessions` data.
- Tap Resume.
- Expected: user lands on the correct scorer or a clear recovery screen, not catch-all.

#### I-004: Tournament scoring deep links can hang forever on `Loading...`

Evidence:
- Route is `/:sport/tournament/:id/match/:matchId/score` in `src/designs/design1-mono/index.jsx:1228`.
- Missing data paths return early and keep loading in:
  - `src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx:77`
  - `src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx:411`
  - `src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx:88`
  - `src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx:364`
  - `src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx:92`
  - `src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx:474`

Impact:
- Deleted local data, stale links, and app-link launches can trap users.
- Mobile users cannot recover without force closing or using back navigation.

Target PR:
- **PR 2**.

Files:
- Modify: `src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx`
- Modify: `src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx`
- Modify: `src/designs/design1-mono/scoring/MonoCricketLiveScore.jsx`
- Add or update tests near existing scoring route tests.

Validation:
- Open missing tournament route.
- Open missing match route.
- Expected: actionable not-found/recovery state with sport-aware CTAs.

#### I-005: Native app links are declared, but web association assets were not found

Evidence:
- Android declares verified `https://scoreeasy.app` links in `android/app/src/main/AndroidManifest.xml:26`.
- iOS declares `applinks:scoreeasy.app` in `ios/App/App/App.entitlements:5`.
- JS accepts `https://scoreeasy.app` in `src/mobile/deepLinks.js:4` and `src/mobile/deepLinks.js:11`.
- Audit found no `public/.well-known/assetlinks.json`.
- Audit found no `public/.well-known/apple-app-site-association`.

Impact:
- Android App Links and iOS Universal Links may not verify in production.
- App-link launch behavior cannot be trusted as an app core flow.

Target PR:
- **PR 2** for user-facing deep-link reliability.
- If certificates/team IDs are missing, split asset generation into its own PR.

Files:
- Create: `public/.well-known/assetlinks.json`
- Create: `public/.well-known/apple-app-site-association`
- Modify or confirm: `src/mobile/deepLinks.js`
- Modify or confirm: `android/app/src/main/AndroidManifest.xml`
- Modify or confirm: `ios/App/App/App.entitlements`

Validation:
- Android: `adb shell am start -a android.intent.action.VIEW -d https://scoreeasy.app/play com.scoreeasy.app`
- iOS simulator: open `https://scoreeasy.app/play` once association is hosted.
- Expected: app opens the intended route.

### P1 - Dashboard Start Flow

#### I-006: New-user dashboard blocks valid 2-team tournaments

Evidence:
- `teamsReady` requires `filledTourneyTeams >= 3` in `src/designs/design1-mono/landing/DashboardLanding.jsx:177`.
- Preview/start area is disabled until `teamsReady` in `src/designs/design1-mono/landing/DashboardLanding.jsx:518`.
- Tournament setup supports 2 teams through `teamCountOptions` in `src/designs/design1-mono/MonoTournamentSetup.jsx:188`.
- 2-team tournaments generate a single match in `src/designs/design1-mono/MonoTournamentSetup.jsx:269`.

Impact:
- A common final/head-to-head tournament cannot be started from the new-user flow.

Target PR:
- **PR 3**.

Files:
- Modify: `src/designs/design1-mono/landing/DashboardLanding.jsx`
- Add test: `src/designs/design1-mono/landing/DashboardLanding.test.jsx`

Validation:
- New-user dashboard.
- Select Tournament.
- Enter tournament name and two teams.
- Expected: Ready/start state becomes active.

#### I-007: Empty dashboard `New tournament` goes to generic `/play`

Evidence:
- Existing-user empty dashboard `New tournament` and `Start a game` both call `navigate('/play')` at `src/designs/design1-mono/landing/DashboardLanding.jsx:638`.

Impact:
- The tournament CTA does not do what it says.
- It adds unnecessary choice friction in the mobile app.

Target PR:
- **PR 3**.

Files:
- Modify: `src/designs/design1-mono/landing/DashboardLanding.jsx`
- Add test: `src/designs/design1-mono/landing/DashboardLanding.test.jsx`

Validation:
- Signed-in existing user with no active games.
- Tap New tournament.
- Expected: user lands in a tournament-focused route or chooser state.

### P2 - Mobile Navigation and Multi-Sport Recovery

#### I-008: Quick Match setup back navigation can exit or go to an unrelated page

Evidence:
- `/:sport/quick` route is defined in `src/designs/design1-mono/index.jsx:1229`.
- Setup back handler calls `navigate(-1)` in `src/designs/design1-mono/MonoQuickMatch.jsx:1364`.

Impact:
- Direct app launches, app links, and shortcuts may have no meaningful previous route.
- The app can feel like it exits unexpectedly.

Target PR:
- **PR 4**.

Files:
- Modify: `src/designs/design1-mono/MonoQuickMatch.jsx`
- Add or update test: `src/designs/design1-mono/MonoQuickMatch.test.jsx`

Validation:
- Open `/volleyball/quick` directly.
- Tap back from setup step.
- Expected: route goes to `/play` or sport home fallback, not browser/native exit.

#### I-009: Offline recovery always sends users to Volleyball quick match

Evidence:
- Global fallback mounted at `src/designs/design1-mono/index.jsx:1198`.
- Primary offline CTA opens `/volleyball/quick` in `src/components/OfflineFallback.jsx:81`.

Impact:
- Cricket, football, and tennis users are sent into the wrong sport.
- Multi-sport positioning breaks in offline mode.

Target PR:
- **PR 4**.

Files:
- Modify: `src/components/OfflineFallback.jsx`
- Update test: `src/components/OfflineFallback.test.jsx`

Validation:
- Simulate offline state.
- Expected: primary CTA uses `/play` or last selected sport, not hard-coded Volleyball.

#### I-010: Empty History tournament CTA is hard-coded to Volleyball

Evidence:
- `/history` route is defined at `src/designs/design1-mono/index.jsx:1245`.
- Empty state `Create tournament` navigates to `/volleyball/tournament/new` in `src/designs/design1-mono/MonoHistory.jsx:711`.

Impact:
- History is multi-sport, but recovery action is not.

Target PR:
- **PR 4**.

Files:
- Modify: `src/designs/design1-mono/MonoHistory.jsx`
- Update test: `src/designs/design1-mono/MonoHistory.test.jsx`

Validation:
- Empty history state.
- Tap Create tournament.
- Expected: `/play` tournament chooser or last sport tournament setup.

#### I-011: NotFound recovery does not preserve sport-scoped failures

Evidence:
- Catch-all route is `src/designs/design1-mono/index.jsx:1246`.
- Recovery buttons go to `/play` or `/` in `src/designs/design1-mono/index.jsx:73` and `src/designs/design1-mono/index.jsx:81`.

Impact:
- Mistyped sport routes lose sport context.
- App-link failures do not help users recover to the relevant sport.

Target PR:
- **PR 4**.

Files:
- Modify: `src/designs/design1-mono/index.jsx`
- Add route recovery tests.

Validation:
- Open `/tennis/not-a-real-route`.
- Expected: NotFound offers tennis-aware recovery.

### P2 - UI Corruption and Mobile Polish

#### I-012: Visible mojibake leaks into UI strings and icons

Evidence:
- Stats quick-match icon and empty-state icon: `src/designs/design1-mono/MonoStatistics.jsx:416`, `src/designs/design1-mono/MonoStatistics.jsx:430`.
- Tournament setup checkmarks/dividers/copy: `src/designs/design1-mono/MonoTournamentSetup.jsx:489`, `src/designs/design1-mono/MonoTournamentSetup.jsx:1656`.
- Quick-match controls: `src/designs/design1-mono/MonoQuickMatch.jsx:48`.

Impact:
- The app visually looks broken on core non-home flows.
- This is high perception risk for mobile app store testing.

Target PR:
- **PR 5**.

Files:
- Modify: `src/designs/design1-mono/MonoStatistics.jsx`
- Modify: `src/designs/design1-mono/MonoTournamentSetup.jsx`
- Modify: `src/designs/design1-mono/MonoQuickMatch.jsx`

Validation:
- Search for replacement characters and broken encoded symbols.
- Run affected page tests.
- Visual check on mobile viewport.

#### I-013: Statistics empty overview is dense before it is helpful

Evidence:
- Empty overview renders three stat cards and nine insight cards first in `src/designs/design1-mono/MonoStatistics.jsx:373` through `src/designs/design1-mono/MonoStatistics.jsx:389`.
- Actual empty-state CTA appears later at `src/designs/design1-mono/MonoStatistics.jsx:427`.

Impact:
- New users see lots of zero-value content before a useful action.

Target PR:
- **PR 6**.

Files:
- Modify: `src/designs/design1-mono/MonoStatistics.jsx`
- Update test: `src/designs/design1-mono/MonoStatistics.test.jsx`

Validation:
- With no stats, first screen should show concise empty state and primary action.

#### I-014: Statistics tables are not wrapped for narrow screens

Evidence:
- `QuickTeamTable` renders 7 columns at `src/designs/design1-mono/MonoStatistics.jsx:661`.
- `TeamStatsTable` renders 8 columns at `src/designs/design1-mono/MonoStatistics.jsx:830`.
- Profile table already uses `overflowX: "auto"` at `src/designs/design1-mono/MonoProfile.jsx:286`.

Impact:
- Mobile screens can overflow or compress columns into unreadable layouts.

Target PR:
- **PR 6**.

Files:
- Modify: `src/designs/design1-mono/MonoStatistics.jsx`
- Reference: `src/designs/design1-mono/MonoProfile.jsx`

Validation:
- Mobile viewport: 360px wide.
- Tables remain readable with horizontal scroll or card layout.

#### I-015: Find Players screen is sparse and weak on recovery

Evidence:
- Initial state helper copy appears after input with no useful suggested card at `src/designs/design1-mono/MonoUserSearch.jsx:83`.
- No-results state is only a line of text at `src/designs/design1-mono/MonoUserSearch.jsx:162`.

Impact:
- Non-home screen feels unfinished.
- Search failure does not offer useful next actions.

Target PR:
- **PR 7**.

Files:
- Modify: `src/designs/design1-mono/MonoUserSearch.jsx`
- Add or update test: `src/designs/design1-mono/MonoUserSearch.test.jsx`

Validation:
- Empty state shows useful next action.
- No-results state includes recovery CTA.

#### I-016: Legal pages feel detached from the app shell

Evidence:
- Route tree wraps pages in the global shell at `src/designs/design1-mono/index.jsx:1195`.
- `LegalPage` builds a separate full-height editorial layout at `src/designs/design1-mono/landing/LegalPage.jsx:40`.

Impact:
- Legal pages feel like a separate website inside the app.
- Non-home app consistency suffers.

Target PR:
- **PR 7**.

Files:
- Modify: `src/designs/design1-mono/landing/LegalPage.jsx`

Validation:
- Privacy, Terms, and Contact use app-consistent spacing, navigation, and action styling.

### P3 - Native Maintenance

#### I-017: iOS Capacitor SwiftPM version skew

Evidence:
- `package.json` uses Capacitor `^8.3.4`.
- `ios/App/CapApp-SPM/Package.swift:14` pins `capacitor-swift-pm` to `8.3.3`.
- No `Package.resolved` was found in repo.

Impact:
- Native iOS dependency resolution may drift from JS Capacitor version.

Target PR:
- **PR 1**.

Files:
- Modify: `ios/App/CapApp-SPM/Package.swift`
- Consider adding: `ios/App/CapApp-SPM/Package.resolved`

Validation:
- `npm run mobile:ios` completes.
- Xcode resolves SwiftPM without version mismatch.

#### I-018: Generated native Capacitor config disagrees with source on StatusBar style

Evidence:
- Source has `style: 'LIGHT'` in `capacitor.config.ts:17`.
- Generated Android config had `"style": "DARK"` at `android/app/src/main/assets/capacitor.config.json:15`.
- Generated iOS config had `"style": "DARK"` at `ios/App/App/capacitor.config.json:15`.

Impact:
- Native status bar appearance may not match source intent.

Target PR:
- **PR 1**.

Files:
- Modify or regenerate: `android/app/src/main/assets/capacitor.config.json`
- Modify or regenerate: `ios/App/App/capacitor.config.json`
- Source: `capacitor.config.ts`

Validation:
- Run `npm run mobile:android`.
- Run `npm run mobile:ios`.
- Confirm generated configs match intended source mapping.

#### I-019: Android sample test packages still use Capacitor starter namespace

Evidence:
- `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java:1`
- `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java:1`
- App namespace/applicationId is `com.scoreeasy.app` in `android/app/build.gradle:4`.

Impact:
- Native test structure is stale.
- Not necessarily build-breaking, but it weakens Android Studio project hygiene.

Target PR:
- **PR 1**.

Files:
- Move or modify: `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java`
- Move or modify: `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`

Validation:
- `./gradlew testDebugUnitTest`
- `./gradlew connectedDebugAndroidTest` when emulator is available.

## PR Execution Map

### PR 1: Validation and Native Run Baseline

Priority: **P0/P3**

Targets:
- I-001 build blocker
- I-002 Android emulator QA setup
- I-017 iOS SwiftPM version skew
- I-018 generated Capacitor config drift
- I-019 stale Android test namespace

Expected outcome:
- Repo can build.
- Capacitor sync can run.
- Android/iOS generated configs are not stale.
- Native testing instructions are executable.

Validation gate:
- `npm run type-check`
- `npm run build`
- `npm run mobile:android`
- `npm run mobile:ios` when iOS tooling is available
- Android emulator listed by `adb devices`

### PR 2: Critical Dead-Route and Deep-Link Recovery

Priority: **P1**

Targets:
- I-003 active game resume dead route
- I-004 scoring deep-link infinite loading
- I-005 app-link association assets

Expected outcome:
- No core resume/deep-link flow ends in not-found or permanent loading.
- Stale data routes show clear recovery UI.
- Native app-link verification assets exist or are explicitly documented as environment-owned.

Validation gate:
- Resume active session.
- Open missing tournament scorer route.
- Open missing match scorer route.
- Launch Android VIEW intent for `https://scoreeasy.app/play`.

### PR 3: Dashboard Start and Resume Correctness

Priority: **P1**

Targets:
- I-006 new-user 2-team tournament block
- I-007 New tournament CTA goes to generic play
- Any DashboardLanding-specific tests needed for I-003 if not fixed in PR 2

Expected outcome:
- Dashboard actions match labels.
- New users can start valid 2-team tournaments.
- Resume/start/tournament choices are test-covered.

Validation gate:
- New-user tournament with two teams becomes startable.
- Existing-user empty dashboard New tournament opens tournament-focused flow.

### PR 4: Direct-Entry Navigation and Multi-Sport Recovery

Priority: **P2**

Targets:
- I-008 Quick Match direct-entry back fallback
- I-009 OfflineFallback hard-coded Volleyball
- I-010 History empty tournament CTA hard-coded Volleyball
- I-011 NotFound loses sport context

Expected outcome:
- Direct entry feels native-app safe.
- Recovery actions preserve sport context or route to a neutral chooser.
- Hard-coded Volleyball exits are removed from multi-sport surfaces.

Validation gate:
- Open `/tennis/quick` directly and press back.
- Simulate offline mode.
- Open empty History.
- Open mistyped sport route.

### PR 5: Corrupted UI Text and Symbol Cleanup

Priority: **P2**

Targets:
- I-012 visible mojibake

Expected outcome:
- Core non-home pages contain no broken encoded text or icons.

Validation gate:
- Static search for replacement characters and known mojibake patterns.
- Mobile screenshots of Quick Match, Tournament Setup, and Statistics.

### PR 6: Statistics Mobile Redesign

Priority: **P2**

Targets:
- I-013 dense empty Statistics overview
- I-014 unwrapped Statistics tables

Expected outcome:
- Empty stats are action-first.
- Populated stats are readable on phone widths.

Validation gate:
- Empty stats at 360px width.
- Populated quick/team tables at 360px width.
- Existing `MonoStatistics` tests pass or are updated.

### PR 7: Sparse Non-Home UX Polish

Priority: **P2**

Targets:
- I-015 sparse Find Players recovery
- I-016 detached Legal page visual system

Expected outcome:
- Find Players has useful empty and no-result states.
- Legal pages feel like part of the app, not a separate website.

Validation gate:
- `/users/search` empty state.
- `/users/search` no-results state.
- `/privacy`, `/terms`, `/contact` mobile viewport review.

## Execution Rules

- Do not combine PRs unless the same file change is required for correctness.
- Each PR must include its own tests or a written reason why the validation is manual.
- Each PR must pass `npm run type-check`.
- Each product PR should pass `npm run build` after PR 1 lands.
- Android emulator proof is required before claiming native app experience is verified.
- Keep AI/design rewrite work separate from functional route fixes.
