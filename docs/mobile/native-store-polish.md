# Native Store Polish Verification

Use this checklist when reviewing the Android and iOS app shells for store-readiness.

For release or PR merge evidence, use the full device evidence flow in `docs/mobile/native-device-verification-runbook.md`.

## Local Build Checks

```powershell
bun run test -- src/mobile/haptics.test.js src/mobile/deepLinks.test.js src/mobile/backButton.test.js
bun run type-check
bun run lint
bun run test
bun run build
bun run mobile:android
bun run mobile:ios
```

## Android Device Checks

After installing the debug build on a connected Android device or emulator:

```powershell
adb shell am start -a android.intent.action.VIEW -d "https://scoreeasy.app/play" com.scoreeasy.app
adb shell am start -a android.intent.action.VIEW -d "https://scoreeasy.app/history" com.scoreeasy.app
```

Expected result:

- The app opens without a browser interstitial when the domain is verified with Digital Asset Links.
- The app routes to the requested internal screen.
- Back navigation returns through the app stack instead of leaving scoring routes without confirmation.

## iOS Device Checks

After installing the iOS build on a simulator or device:

```powershell
xcrun simctl openurl booted "https://scoreeasy.app/play"
xcrun simctl openurl booted "https://scoreeasy.app/history"
```

Expected result:

- The app receives the universal link when associated domains are configured for the bundle.
- The app routes to the requested internal screen.
- Protected scoring screens still use the in-app leave confirmation.

## Native Interaction Checks

- Tap scoring controls in a quick match: native haptics should use light feedback.
- Undo a score, adjust a score, or swap sides: native haptics should use medium feedback.
- Try to end a no-draw sport while tied: native haptics should use warning feedback and keep the user on the scoring screen.
- Finish a match: native haptics should use success feedback and then show the result screen.
- Launch the installed app offline: the app should render the local shell instead of a blank page.
