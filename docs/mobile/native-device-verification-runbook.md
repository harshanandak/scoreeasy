# Native Device Verification Runbook

Use this runbook before merging mobile-sensitive UI, scoring, routing, auth, offline, or native shell changes. CI proves that the native projects build. This runbook proves that the installed Android and iOS apps behave correctly on real or simulator devices.

## When To Run

Run the full matrix for:

- Changes touching `android/`, `ios/`, `capacitor.config.ts`, `src/mobile/`, auth routes, deep links, storage, scoring exits, bottom navigation, landing/play entry points, scoring screens, or tournament setup/scoring.
- Any PR labeled as app-store, native, mobile, release, or verification.
- Any PR that changes device-visible layout or input behavior.

Run the focused matrix for:

- Copy-only changes: install, launch, one quick match, and one scoring action on each platform.
- Test-only changes: CI workflows plus one installed app launch per platform when practical.

## Required Evidence

Attach or paste this evidence into the PR or verification comment:

- Branch, commit SHA, build time, and tester name.
- Android device model or emulator profile, Android version, and APK/AAB source.
- iOS simulator/device model, iOS version, Xcode version, and build source.
- Screenshots for Home, Play, Quick Match setup, active scoring, result/history, and one auth or guest route.
- Notes for any skipped check with reason and follow-up owner.

## Preflight

From the repo root:

```powershell
bun install
bun run lint
bun run type-check
bun run test
bun run build
bun run mobile:android
bun run mobile:ios
```

On Windows, use the Android environment helper before emulator QA:

```powershell
.\scripts\mobile-android-env.ps1 -RequireDevice
```

The helper exports the Android Studio JBR and `%LOCALAPPDATA%\Android\Sdk` paths when present, prints the resolved `JAVA_HOME`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT`, then runs `adb devices`. The `-RequireDevice` flag fails when no running emulator or device is listed.

To start the first available AVD and wait for boot from a clean shell:

```powershell
.\scripts\mobile-android-env.ps1 -StartEmulator -Headless -RequireDevice
```

Headless mode starts the emulator with `-gpu swiftshader_indirect` so the app window can render in no-window QA runs.

To target a specific AVD:

```powershell
.\scripts\mobile-android-env.ps1 -StartEmulator -AvdName Pixel_10 -Headless -RequireDevice
```

If Gradle is launched from a separate terminal and cannot see `ANDROID_HOME`, write the local Android SDK path before building:

```powershell
.\scripts\mobile-android-env.ps1 -WriteLocalProperties
```

This writes an ignored `android/local.properties` file with `sdk.dir=<resolved Android SDK path>`.

Expected:

- Web tests, lint, type-check, and build pass.
- Capacitor Android sync passes.
- Capacitor iOS sync passes.
- `android/app/build.gradle`, `android/capacitor.settings.gradle`, and `ios/App/CapApp-SPM/Package.swift` do not contain accidental local path drift after sync.

## Android Build And Install

Set the local toolchain:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

Build and install:

```powershell
bun run build
bunx cap sync android
Push-Location android
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
.\gradlew.bat bundleDebug
Pop-Location
.\scripts\mobile-android-env.ps1 -RequireDevice -InstallDebug -LaunchApp
```

Capture logs while testing:

```powershell
adb logcat -c
adb logcat | Select-String -Pattern "scoreeasy|Capacitor|AndroidRuntime"
```

## iOS Build And Install

Windows can sync iOS files but cannot run Xcode, iOS Simulator, signing, archive, or TestFlight upload. Use a macOS machine, GitHub-hosted macOS runner, Xcode Cloud, or a remote Mac.

On macOS:

```bash
bun install
bun run test
bun run build
bunx cap sync ios
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Install and launch on simulator:

```bash
xcrun simctl boot "iPhone 16" || true
xcrun simctl install booted ios/App/build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.scoreeasy.app
```

If the app path differs, use Xcode's derived data output for the built `.app`.

## Smoke Matrix

Complete each row on Android and iOS.

| Area | Steps | Expected |
| --- | --- | --- |
| Cold launch | Kill the app, launch from icon, wait for Home. | Home renders without blank screen, remote website chrome, or web error. |
| Guest entry | Tap `Start Cricket`, then back to `Play`, then `Start Volleyball`. | Sport-specific start actions are visible and routes stay inside app. |
| Quick match setup | Open cricket quick match with Test and T20, then volleyball quick match. | Cricket presets do not leak into volleyball, and Test uses the Test Match scorer route. |
| Scoring | Start volleyball and cricket quick matches, tap score controls, undo, and end/discard. | Controls respond, no layout shift blocks thumb controls, and Wicket is not destructive red. |
| Leave protection | Start scoring, press hardware back on Android or navigation back on iOS. | In-app confirmation appears before leaving scoring progress. |
| Result/history | Complete a quick match, open History, reopen the result. | Result is saved locally and visible after app relaunch. |
| Offline startup | Enable airplane mode, force close, relaunch. | Local shell opens, guest scoring remains available, cloud-only UI degrades clearly. |
| Auth boundary | Open Login/Signup if cloud auth is configured; continue as guest if not. | No dead-end signup route in local/preview mode; guest exit remains visible. |
| Deep links | Open `/play`, `/history`, and `/cricket/quick` as app links. | App routes to the requested screen without browser interstitial when domain association is configured. |
| Keyboard safety | Edit team names and auth/search fields with keyboard open. | Primary actions remain reachable and text does not overlap controls. |
| Orientation/safe area | Rotate to landscape and back; test notch/home-indicator devices. | Content stays inside safe areas and bottom navigation remains tappable. |
| Accessibility | Enable VoiceOver or TalkBack and navigate Play plus one scoring route. | Main controls have meaningful names and focus order is usable. |

## Deep Link Commands

Android:

```powershell
adb shell am start -a android.intent.action.VIEW -d "https://scoreeasy.app/play" com.scoreeasy.app
adb shell am start -a android.intent.action.VIEW -d "https://scoreeasy.app/history" com.scoreeasy.app
adb shell am start -a android.intent.action.VIEW -d "https://scoreeasy.app/cricket/quick" com.scoreeasy.app
```

iOS:

```bash
xcrun simctl openurl booted "https://scoreeasy.app/play"
xcrun simctl openurl booted "https://scoreeasy.app/history"
xcrun simctl openurl booted "https://scoreeasy.app/cricket/quick"
```

Expected:

- Android uses Digital Asset Links for verified app links.
- iOS uses Associated Domains for universal links.
- If domain verification is not configured in the test environment, document the fallback and verify route handling after manual app launch.

## Screenshot Checklist

Capture these screenshots on both platforms:

- Home first viewport.
- Play with cricket, football, and volleyball priority actions visible.
- Cricket quick setup for T20 and Test Match.
- Volleyball active scoring with bottom controls visible.
- Cricket active scoring with Wicket button visible.
- Leave confirmation dialog.
- Match result and History detail.
- Login or guest-only fallback state.
- Offline relaunch state.

## Go Or No-Go

Go when:

- CI is green on the PR.
- Android and iOS build/install/launch checks pass.
- Smoke matrix has no P0/P1 findings.
- Any skipped device checks have named owners and follow-up issues.
- Evidence is attached to the PR or merge handoff.

No-go when:

- App cannot launch from installed native shell.
- Scoring progress can be lost without confirmation.
- Offline launch is blank or unusable.
- App links open the wrong screen in a configured environment.
- Bottom controls, primary actions, or auth/guest exits are blocked by safe-area or keyboard behavior.

## Evidence Template

```markdown
## Native Device Verification

- Branch/SHA:
- Tester:
- Date/time:
- Android device/emulator:
- iOS device/simulator:
- Build source:

### Android
- Build/install:
- Smoke matrix:
- Deep links:
- Offline launch:
- Screenshots:
- Notes:

### iOS
- Build/install:
- Smoke matrix:
- Deep links:
- Offline launch:
- Screenshots:
- Notes:

### Decision
- Go/no-go:
- Follow-ups:
```

