# Mobile Test Setup

This file covers build/test setup. Use `docs/mobile/native-device-verification-runbook.md` for the Android/iOS installed-app smoke matrix and PR evidence template.

## Web

Runs locally on Windows and in CI:

```powershell
bun run lint
bun run type-check
bun run test
bun run build
bun run preview -- --host 127.0.0.1 --port 4173
```

Verified locally:

- Unit tests: 229 passed.
- Production build: passed.
- Preview HTTP check: `200`.

## Android

Runs locally on Windows and in CI:

```powershell
bun run build
bunx cap sync android
Set-Location android
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
.\gradlew.bat bundleDebug
```

Verified locally:

- Debug APK builds.
- Debug AAB builds.

GitHub workflow:

- `.github/workflows/android-build.yml`
- Runs web unit tests.
- Runs Android unit tests.
- Builds APK and AAB.
- Uploads APK/AAB artifacts.

## iOS

Runs through a macOS runner:

```bash
bun run test
bun run build
bunx cap sync ios
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Verified locally on Windows:

- Capacitor iOS sync passes.
- Xcode project files exist.
- Synced web assets exist in `ios/App/App/public`.

GitHub workflow:

- `.github/workflows/ios-build.yml`
- Runs web unit tests.
- Syncs Capacitor iOS.
- Runs unsigned iOS Simulator build.
- Uploads the Xcode build log.

## What Requires Apple Infrastructure

Windows can generate and sync iOS files, but it cannot run Xcode, iOS Simulator, code signing, archive, or TestFlight upload. Those require macOS locally, GitHub-hosted macOS, Xcode Cloud, or a remote Mac that Codex controls through SSH.
