# Mobile App Release Design

## Feature

- Slug: mobile-app-release
- Date: 2026-05-11
- Branch: feat/mobile-app-plan
- Status: planned

## Forge /plan Compliance

This plan is organized to match the Forge `/plan` skill workflow:

1. **Phase 1: Design Intent** - captured in this design doc: purpose, success criteria, out of scope, selected approach, constraints, edge cases, and ambiguity policy.
2. **Phase 2: Technical Research** - captured below under `Technical Research`, `Expected Issues And Solutions`, `OWASP / Security Notes`, and `TDD / Verification Scenarios`.
3. **Phase 3: Setup + Task List** - captured in `docs/plans/2026-05-11-mobile-app-release-tasks.md` with ordered tasks, owned files, TDD steps, expected outputs, and commits.

Forge setup note: the main repo was initialized with Forge after this planning worktree was first created. Future `/plan` runs should start from the initialized main repo, create a fresh `.worktrees/<slug>` worktree, create/link the Beads epic, then write the design and task docs in `docs/plans/`.

## Forge Folder Structure

Expected layout for this feature:

```text
Volleyball/
  .beads/                                      # Forge/Beads issue database in the main repo
  .worktrees/
    mobile-app-plan/                          # isolated planning worktree
      docs/
        plans/
          2026-05-11-mobile-app-release-design.md
          2026-05-11-mobile-app-release-tasks.md
      capacitor.config.ts                     # added during implementation
      android/                                # generated during Android phase
      ios/                                    # generated during iOS phase
      docs/
        mobile/
          android-release.md
          ios-release.md
          smoke-test-results.md
  docs/
    forge/                                    # Forge setup docs in main repo
  lefthook.yml                                # Forge-compatible hook config in main repo
```

Do not implement Android/iOS native folders in the main worktree directly. Implementation should happen in the feature worktree/branch, then merge back through the normal Forge flow.

## Purpose

Ship Score Easy as lightweight, fast, app-store-ready Android and iOS apps without rewriting the product. The first release should reuse the existing Vite React app, preserve the current web/PWA release path, and add only the native layer needed for store distribution, device polish, and mobile reliability.

## Current Repo Facts

- The app is a Vite React app with scripts for dev, build, preview, test, lint, and type-check in `package.json`.
- PWA support already exists through `vite-plugin-pwa` in `vite.config.js`.
- Runtime integrations already include Clerk, Convex, and Sentry in `src/main.jsx`.
- The route tree is React Router-based in `src/designs/design1-mono/index.jsx`.
- Offline UX already exists through `src/components/OfflineFallback.jsx`.
- Mobile test coverage is already documented in `MOBILE_TESTING.md`.

## Success Criteria

1. Android App Bundle builds from the same codebase and passes a smoke test on emulator and one real Android device.
2. iOS archive builds from the same codebase and passes a smoke test on simulator and one real iPhone.
3. Existing web/PWA build remains unchanged: `bun run build` still produces the web app.
4. Native shells use Capacitor with local bundled assets, not a remote-only WebView.
5. Auth, Convex sync, offline scoring, route refresh, app resume, and app close/reopen flows are tested.
6. App store submission package includes icons, splash assets, screenshots, privacy notes, and review notes.
7. Release v1 includes enough mobile-specific value to avoid "website wrapper" review risk: offline scoring, app resume, native status/safe-area polish, share flow, and optional haptics.

## Baseline Verification

Verified on 2026-05-11 in `.worktrees/mobile-app-plan`:

- `bun install`: passed.
- `bun run lint`: passed.
- `bun run type-check`: passed.
- `bun run test`: passed, 9 test files and 224 tests.
- `bun run build`: passed, PWA generated 37 precache entries.

Build warning to track during implementation: `MonoCricketTestLiveScore.jsx` is both dynamically imported by the route tree and statically imported by `MonoTournamentLiveScore.jsx`, so Vite does not split it into a separate chunk.

## Out Of Scope

- Full React Native or Expo rewrite.
- New backend architecture.
- Paid subscriptions or in-app purchases.
- Push notifications in v1 unless the native wrapper and auth flows are already stable.
- Reworking the scoring engines beyond mobile reliability fixes found during testing.

## Approach Selected

Use Capacitor in this repo.

Reasons:

- It is the fastest route because the existing Vite React app can be bundled into native Android and iOS shells.
- It keeps one source of truth for web, PWA, Android, and iOS.
- The repo already has PWA and mobile testing groundwork.
- Native APIs can be added incrementally for status bar, splash screen, haptics, sharing, app lifecycle, and deep links.

Alternatives rejected:

- Expo/React Native rewrite: better long-term native feel, but it requires rebuilding screens, navigation, auth storage, and Convex client wiring before release.
- Separate mobile repo: creates duplicated product logic and slows iteration.
- Remote WebView-only app: fastest technically, but weaker offline behavior and higher app review risk.

## Technical Research

Sources checked:

- Capacitor docs: `https://capacitorjs.com/docs`
- Capacitor build workflow: `https://capacitorjs.com/docs/basics/workflow`
- Capacitor deep links: `https://capacitorjs.com/docs/guides/deep-links`
- Apple App Store Review Guidelines: `https://developer.apple.com/appstore/resources/approval/guidelines.html`
- Android core app quality: `https://developer.android.com/docs/quality-guidelines/core-app-quality`
- Expo docs: `https://docs.expo.dev/`
- Convex auth docs: `https://docs.convex.dev/auth`
- Convex React Native docs: `https://docs.convex.dev/client/react-native`

Findings:

- Capacitor is intended for existing modern web apps and supports iOS/Android native shells while keeping web-standard app code.
- Capacitor builds require: build web assets, copy/sync assets to native projects, then compile with Android Studio or Xcode.
- Apple review guideline 4.2 creates a real risk for apps that are only repackaged websites; v1 must include mobile-specific behavior.
- Android quality guidance expects standard navigation, visual behavior, lifecycle handling, performance, and listing quality.
- Clerk and Convex are viable in mobile contexts, but auth redirect/deep-link/session persistence must be tested inside native shells, not assumed from browser behavior.

## Expected Issues And Solutions

### Shared Issues

- Issue: BrowserRouter refresh/deep links can fail in native shells.
  Solution: configure Capacitor deep links and verify route fallback with `navigateFallback: /index.html`.

- Issue: Auth redirects may return to browser instead of app.
  Solution: define app URL scheme/universal links, configure Clerk allowed redirect URLs, and test login/signup/SSO on device.

- Issue: Convex WebSocket behavior can differ on app background/resume.
  Solution: add lifecycle tests for pause/resume/offline/online and capture failures before adding native push.

- Issue: Local storage may be cleared or behave differently under WebView pressure.
  Solution: test active match resume; if unstable, add a Capacitor Preferences/SQLite-backed persistence layer for match-critical data.

- Issue: App feels like a wrapper.
  Solution: add status bar/safe-area polish, share result, haptics, offline resume, and native splash/icons before submission.

### Android Issues

- Issue: Back button can exit active scoring accidentally.
  Solution: handle Capacitor App backButton event on scoring routes and show the same leave confirmation already used for browser navigation.

- Issue: App Bundle/signing complexity.
  Solution: create a release keystore, document secure storage, and build `.aab` through Android Studio or Gradle.

- Issue: Device fragmentation and low-memory devices.
  Solution: test Pixel, Samsung, and one lower-memory Android device; keep bundles small and lazy-loaded.

### iOS Issues

- Issue: App Store minimum functionality rejection.
  Solution: write review notes explaining offline scorekeeping, saved match resume, native share/haptics, and live tournament utility.

- Issue: Safe area and keyboard behavior.
  Solution: test iPhone notch devices, landscape, iPad, auth forms, team/player inputs, and scoring screens.

- Issue: Apple Sign-In requirement if third-party social login is offered.
  Solution: verify Clerk provider configuration; add Sign in with Apple before iOS submission if other social providers are enabled.

## OWASP / Security Notes

- A01 Broken Access Control: verify Convex functions enforce user ownership and tournament permissions server-side.
- A02 Cryptographic Failures: do not store secrets in the app bundle; only public Clerk/Convex client env vars belong in Vite.
- A03 Injection: keep score/team/player inputs validated before persistence and display.
- A05 Security Misconfiguration: keep Android/iOS bundle IDs, URL schemes, domains, and store privacy declarations consistent.
- A07 Identification and Authentication Failures: test mobile auth redirect, session restore, sign-out, and expired sessions.
- A09 Logging and Monitoring Failures: configure Sentry environment/release per platform.

## TDD / Verification Scenarios

1. Happy path: create a volleyball quick match, score points, close/reopen app, confirm score resumes.
2. Failure path: start online, go offline during scoring, continue scoring, reconnect, confirm no crash and data is intact.
3. Auth path: sign in, complete onboarding, close/reopen app, confirm protected routes do not loop or drop session.
4. Android edge case: press hardware back on active scoring route, confirm leave protection works.
5. iOS edge case: rotate device and open keyboard during setup, confirm no hidden controls or layout overlap.

## Ambiguity Policy

Use a 7-dimension rubric before implementation decisions: user impact, release risk, review risk, implementation complexity, reversibility, testability, and consistency with current repo architecture. If confidence is at least 80%, proceed and document the decision. If below 80%, stop and ask before implementing.
