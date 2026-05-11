# Native Build Notes

## Android

Verified on Windows from your local worktree.

Required local tools:

- Android Studio installed at `C:\Program Files\Android\Android Studio`
- Android Studio bundled JBR used as `JAVA_HOME`: `C:\Program Files\Android\Android Studio\jbr`
- Android SDK installed at `%LOCALAPPDATA%\Android\Sdk`
- SDK packages: `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`

Build commands:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

bun run build
bunx cap sync android
Set-Location android
.\gradlew.bat assembleDebug
.\gradlew.bat bundleDebug
```

Verified outputs:

- `android/app/build/outputs/apk/debug/app-debug.apk`
- `android/app/build/outputs/bundle/debug/app-debug.aab`

## iOS

The iOS Capacitor project is generated and synced in `ios/`, but archive/build validation requires macOS with Xcode.

Expected macOS commands:

```bash
bun run build
bunx cap sync ios
bunx cap open ios
```

Then build/archive from Xcode with the Apple Developer team, bundle identifier, signing profile, and App Store Connect metadata configured.
