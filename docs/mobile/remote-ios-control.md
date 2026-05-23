# Remote Mobile Control

Use this with `docs/mobile/native-device-verification-runbook.md` when a PR needs iOS simulator/device evidence from a Mac.

## First Step: GitHub-Hosted Runners

This repo includes build workflows that can be triggered from Windows through the GitHub CLI:

```powershell
$branch = git branch --show-current
gh workflow run "iOS Build Check" --ref $branch
gh workflow run "Android Build Check" --ref $branch
gh run list --workflow "iOS Build Check" --limit 5
gh run watch
```

- `iOS Build Check` runs on `macos-15`, installs dependencies with Bun, builds the Vite bundle, syncs Capacitor iOS, and runs an unsigned iOS Simulator build with `xcodebuild`.
- `Android Build Check` runs on `ubuntu-latest`, installs Java 21 and Android SDK packages, builds the Vite bundle, syncs Capacitor Android, then produces debug APK and AAB artifacts.

## Controlled Long-Term Setup: Remote Mac

For full iOS control from Codex on Windows, use a remote Mac mini or MacStadium host with:

- SSH access from this Windows machine.
- Xcode installed and selected with `xcode-select`.
- Bun installed.
- GitHub CLI installed.
- Optional GitHub self-hosted runner registered to this repo.
- Optional Fastlane for signing, archive, and TestFlight upload.

Control flow:

```text
Windows/Codex
  -> ssh remote-mac
  -> git fetch / checkout branch
  -> bun install
  -> bun run build
  -> bunx cap sync ios
  -> xcodebuild build/test/archive
  -> xcrun simctl boot/install/launch/screenshot
  -> fastlane upload_to_testflight
```

Use GitHub-hosted macOS runners for quick build checks. Use a remote Mac when we need simulator screenshots, device testing, signing debugging, or interactive Xcode diagnostics.

## Android Control From Windows

Android can be built locally on Windows or through GitHub Actions. Local Windows builds require:

- Java 21. Android Studio's bundled JBR works.
- Android SDK at `%LOCALAPPDATA%\Android\Sdk`.
- `platforms;android-36`, `build-tools;36.0.0`, and `platform-tools`.

The verified local commands are documented in `docs/mobile/native-build.md`.
