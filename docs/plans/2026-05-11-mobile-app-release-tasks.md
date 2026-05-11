# Mobile App Release Task List

## Scope

This task list implements the `2026-05-11-mobile-app-release-design.md` plan in small, verifiable steps. The order favors Android first for faster release feedback, then iOS polish and submission.

## Phase 0: Baseline And Tooling

### Task 1: Verify Web Baseline

OWNS: `package.json`, current test/build outputs only

Files: `package.json`, `vite.config.js`, `src/main.jsx`, `src/designs/design1-mono/index.jsx`

What to implement: no code change unless baseline commands reveal a mobile-release blocker. Run `bun install`, `bun run lint`, `bun run type-check`, `bun run test`, and `bun run build` in the worktree.

TDD steps:

1. Run baseline commands.
2. Record any existing failures exactly.
3. If failures are unrelated to mobile release, document and continue only with approval.
4. If failures block native packaging, fix in the smallest related patch.

Expected output: current web app baseline is known before native work starts.

### Task 2: Add Capacitor Project Configuration

OWNS: `package.json`, `bun.lock`, `capacitor.config.ts`

Files: `package.json`, `bun.lock`, `capacitor.config.ts`

What to implement: install Capacitor core/CLI, configure app id, app name, and `webDir: "dist"` for Vite output.

TDD steps:

1. Add a config test or static check that `webDir` is `dist`.
2. Run build and Capacitor sync command.
3. Confirm native sync reads from `dist`.
4. Commit: `build: add capacitor config`

Expected output: Capacitor can consume the existing Vite build.

## Phase 1: Shared Mobile Runtime

### Task 3: Add Mobile Runtime Adapter

OWNS: `src/mobile/*`, `src/main.jsx`

Files: `src/mobile/platform.js`, `src/mobile/lifecycle.js`, `src/main.jsx`

What to implement: create a small wrapper for platform detection, app resume/pause, and future native APIs without scattering Capacitor imports across UI components.

TDD steps:

1. Write tests for web fallback behavior when Capacitor is unavailable.
2. Implement adapter returning web-safe defaults.
3. Wire lifecycle logging only where useful.
4. Commit: `feat: add mobile runtime adapter`

Expected output: app can run on web and native without platform import crashes.

### Task 4: Protect Active Scoring From Native Back/Resume Loss

OWNS: `src/mobile/backButton.js`, `src/designs/design1-mono/index.jsx`

Files: `src/mobile/backButton.js`, `src/designs/design1-mono/index.jsx`

What to implement: reuse the existing active-game protection behavior for Android hardware back and native app resume.

TDD steps:

1. Write tests for scoring route detection.
2. Simulate back event on scoring route and non-scoring route.
3. Implement route-aware native back handling.
4. Commit: `fix: protect scoring routes in native shell`

Expected output: Android back button does not accidentally discard an active score.

### Task 5: Harden Match-Critical Persistence

OWNS: `src/utils/storage.js`, `src/utils/universalStorage.js`, related tests

Files: `src/utils/storage.js`, `src/utils/universalStorage.js`, `src/utils/storage.test.js`

What to implement: audit local persistence for active scoring and add fallback checks. If WebView storage is not enough after testing, introduce Capacitor Preferences only for active match/session recovery.

TDD steps:

1. Add tests for active match save/load after simulated app restart.
2. Add malformed/corrupt local data test.
3. Implement minimal hardening.
4. Commit: `fix: harden mobile scoring persistence`

Expected output: scoring state survives close/reopen and bad stored data does not crash the app.

## Phase 2: Native UX Polish

### Task 6: Add Native Shell Polish

OWNS: `src/mobile/nativeChrome.js`, `src/main.jsx`, `public/*`

Files: `src/mobile/nativeChrome.js`, `src/main.jsx`, `public/icons/*`, `public/splash/*`

What to implement: configure status bar, splash screen, safe-area CSS variables, and production-ready icon/splash assets.

TDD steps:

1. Add web fallback tests for native chrome adapter.
2. Verify app renders with safe-area padding on iOS simulator.
3. Verify Android status bar color and splash behavior.
4. Commit: `feat: add native app chrome`

Expected output: app looks intentional on iOS and Android, not like a browser page.

### Task 7: Add Native Share For Match Results

OWNS: `src/mobile/share.js`, scoring/result components

Files: `src/mobile/share.js`, relevant result/share UI components discovered during implementation

What to implement: add a share result action using Capacitor Share when native and Web Share when browser, with clipboard fallback.

TDD steps:

1. Test share payload formatting.
2. Test native/web/fallback branch selection.
3. Add result share UI on completed match/tournament result surfaces.
4. Commit: `feat: share match results on mobile`

Expected output: users can share a completed score from the native app.

### Task 8: Add Haptics For Score Actions

OWNS: `src/mobile/haptics.js`, scoring components

Files: `src/mobile/haptics.js`, scoring components discovered by search

What to implement: add lightweight haptic feedback on score increments, guarded by capability checks and user/device availability.

TDD steps:

1. Test no-op behavior on web.
2. Test score action calls haptic wrapper once.
3. Verify on physical Android/iPhone.
4. Commit: `feat: add scoring haptics`

Expected output: scoring taps feel responsive without breaking web.

## Phase 3: Android Release

### Task 9: Generate And Configure Android Project

OWNS: `android/*`, `capacitor.config.ts`

Files: `android/*`, `capacitor.config.ts`

What to implement: run Capacitor Android add/sync, configure package id, app name, permissions, app icon, splash, orientation policy, and release build settings.

TDD steps:

1. Run `bun run build`.
2. Run `npx cap sync android`.
3. Build debug APK/AAB.
4. Smoke test routes, auth, scoring, offline, resume, back button.
5. Commit: `build: add android native project`

Expected output: Android debug and release builds are reproducible.

### Task 10: Prepare Android Store Package

OWNS: `docs/mobile/android-release.md`, Android store metadata assets

Files: `docs/mobile/android-release.md`, `public/store/android/*`

What to implement: document signing, versioning, Play Console checklist, screenshots, privacy/data safety inputs, and release notes.

TDD steps:

1. Verify `.aab` generation.
2. Verify screenshots match current app.
3. Verify privacy notes match Clerk/Convex/Sentry usage.
4. Commit: `docs: add android release checklist`

Expected output: Android can be submitted with known release artifacts.

## Phase 4: iOS Release

### Task 11: Generate And Configure iOS Project

OWNS: `ios/*`, `capacitor.config.ts`

Files: `ios/*`, `capacitor.config.ts`

What to implement: run Capacitor iOS add/sync, configure bundle id, app name, icons, splash, URL scheme/universal links, safe-area behavior, and signing placeholders.

TDD steps:

1. Run `bun run build`.
2. Run `npx cap sync ios`.
3. Build in Xcode simulator.
4. Smoke test auth, scoring, offline, resume, rotation, keyboard, and safe areas.
5. Commit: `build: add ios native project`

Expected output: iOS simulator and device builds are reproducible.

### Task 12: Prepare iOS Store Package

OWNS: `docs/mobile/ios-release.md`, iOS store metadata assets

Files: `docs/mobile/ios-release.md`, `public/store/ios/*`

What to implement: document App Store Connect checklist, review notes, screenshots, privacy nutrition labels, Sign in with Apple check, versioning, and archive steps.

TDD steps:

1. Verify archive path in Xcode.
2. Verify screenshots cover mobile-specific value.
3. Verify review notes explain why this is not just a website wrapper.
4. Commit: `docs: add ios release checklist`

Expected output: iOS can be submitted with review-risk mitigations.

## Phase 5: Final Verification

### Task 13: Mobile Smoke Test Matrix

OWNS: `MOBILE_TESTING.md`, `docs/mobile/smoke-test-results.md`

Files: `MOBILE_TESTING.md`, `docs/mobile/smoke-test-results.md`

What to implement: extend the existing mobile testing guide with native app checks and record final smoke test results.

TDD steps:

1. Test Android emulator and physical device.
2. Test iOS simulator and physical iPhone.
3. Test offline/resume/auth/deep-link/back/share/haptic flows.
4. Commit: `test: record native mobile smoke tests`

Expected output: release readiness is backed by device evidence.

## Release Order

1. PWA/web baseline stays green.
2. Capacitor shared runtime.
3. Android build and Play internal testing.
4. iOS build and TestFlight.
5. Fix real device findings.
6. Submit Android production.
7. Submit iOS App Store after review-note polish.

## Deferred Improvements

- Push notifications for live tournaments.
- Native widgets.
- Offline conflict resolution across multiple logged-in devices.
- Full Expo/React Native rewrite if WebView performance becomes the actual bottleneck.
