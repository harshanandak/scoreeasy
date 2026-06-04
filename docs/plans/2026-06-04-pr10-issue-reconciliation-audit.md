# PR10: Issue Reconciliation and Native App Experience Audit

Date: 2026-06-04
Branch: codex/pr10-issue-reconciliation-audit
Base verified: origin/master at PR #82 merge

## Scope

Reconcile the planned PR1-PR9 mobile-audit backlog against merged GitHub PR evidence, source/test coverage, and live Android app behavior. The goal is to identify which issues are actually fixed, which tracker records are stale, and what should become the next implementation PR.

## Source Labels

- GitHub PRs #71-#82 on `harshanandak/scoreeasy`
- Beads issue list from `bd list --limit 0 --json`
- `docs/plans/2026-05-31-mobile-app-issue-pr-plan.md`
- Source/tests under `src/`
- Android emulator `Pixel_10`, package `com.scoreeasy.app`
- Fresh APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Planned Issue Reconciliation

| Group | Parent | Planned issues | Evidence fixed | Live/source verified in this audit | Still needs proof |
| --- | --- | ---: | ---: | ---: | --- |
| PR1 | `scoreeasy-x7s` | 5 | 4 | 4 | `scoreeasy-x7s.2` native emulator QA environment is now partially proven but should be tracked until repeatable |
| PR2 | `scoreeasy-viq` | 10 | 10 | 10 | None found |
| PR3 | `scoreeasy-9g4` | 9 | 9 | 9 | None found |
| PR4 | `scoreeasy-nm8` | 5 | 5 | 5 | Beads anomaly: `scoreeasy-nm8.5` appears in the plan/PR #75 body but not in current `bd list` |
| PR5 | `scoreeasy-9ve` | 11 | 11 | 11 | None found |
| PR6 | `scoreeasy-4ay` | 5 | 5 | 5 | None found |
| PR7 | `scoreeasy-oee` | 15 | 7 by PR-body evidence | App shell/native visual flow verified for core screens | Per-issue source closure should be checked before closing the remaining visual records |
| PR8 | `scoreeasy-woa` | 5 | 5 | 5 | None found |
| PR9 | `scoreeasy-ngb` | 7 | 5 | 5 | `scoreeasy-ngb.4`, `scoreeasy-ngb.5` need real Clerk/Convex backend-session verification |

## Tracker State

Beads is stale relative to GitHub. Planned PR1-PR9 issues still show as open in Beads even where merged PR bodies, tests, and Android runtime proof show the behavior is fixed.

Do not use the current open Beads count as the product backlog without reconciling it first.

## Confirmed Fixed By Source And Tests

- PR2 data persistence is covered at storage/history/statistics level. Evidence includes `src/utils/storage.js`, `src/utils/storage.test.js`, `src/designs/design1-mono/MonoHistory.jsx`, `src/designs/design1-mono/MonoStatistics.jsx`, and related tests.
- PR4 app entry/dashboard recovery is covered by app-entry, dashboard, and quick-match setup tests.
- PR5 scoring/tournament logic is covered by cricket, tennis, goals, tournament display, knockout, round-robin, and destructive-safety tests.
- PR8 content/share/legal issues are covered by merged PR #82 plus tests for share fallback, legal copy, no-results UI, T10 copy, and sport registry cards.

## Android Native App Proof

The APK used for validation was freshly built from this PR10 worktree:

- `bun run mobile:android` passed and ran `cap sync android`.
- `android/gradlew.bat --no-daemon :app:assembleDebug --console=plain` passed after using `scripts/mobile-android-env.ps1`.
- Installed package was `com.scoreeasy.app`.
- `firstInstallTime` and `lastUpdateTime` were both `2026-06-04 14:48:33` after reinstall.
- Package path changed on reinstall, proving the emulator was not using the previous APK path.

Native screenshots were captured from the emulator:

- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-after-wait.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-after-start-cricket.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-cricket-format.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-quick-setup.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-scorer.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-scorer-after-runs.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-end-match-dialog.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-post-game.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-history-after-game.png`
- `C:\Users\harsha_befach\AppData\Local\Temp\scoreeasy-android-stats-after-game.png`

## Native UX Findings

Passed:

- Fresh native APK launches into current ScoreEasy UI, not an old installed version.
- Landing has clear guest-start path.
- `Start Cricket` reaches the app Play screen with bottom navigation.
- Cricket format picker shows T20/T10 with Quick Match and Tournament actions.
- Quick Match setup supports team names and shows `Start Cricket` above the safe area after keyboard dismissal.
- Active scorer hides bottom nav and uses a focused app scoring surface.
- Score taps update state: `0/0` became `10/0`, overs became `0.2`, and Undo became active.
- End-match confirmation is app-owned and explains that the result will be saved.
- Post-game result shows `Match saved to History on this device`.
- History after completion shows `1` all match, `1` quick match, and the saved `Team A vs Team B` cricket result.
- Statistics after completion shows `0` tournaments, `1` match, `2` teams, top team, head-to-head, biggest win, most played sport, and average margin.

Risks:

- Emulator showed a temporary `System UI isn't responding` dialog before it stabilized. That was Android System UI, not ScoreEasy, but it means emulator health should stay part of native QA.
- Android UIAutomator only exposes the Capacitor WebView container, so visual proof requires screenshots and coordinate-driven flows rather than semantic UI tree inspection.
- PR9 backend-session items were not proven because this audit stayed on local/native guest scoring and did not run real Clerk/Convex token/WebSocket flows.

## Remaining Work To Turn Into Next PR

1. Tracker reconciliation:
   - Close or update Beads records already proven fixed by PRs #71-#82.
   - Preserve `scoreeasy-ngb.4` and `scoreeasy-ngb.5` until backend auth/session proof exists.
   - Decide whether `scoreeasy-x7s.2` can close after one more repeatable Android emulator run.

2. Backend auth/session verification:
   - Verify Clerk to Convex token exchange in native Android.
   - Verify Convex WebSocket stability through login, app background, resume, and route navigation.

3. PR7 visual closure pass:
   - Map the remaining PR7 visual issue IDs to source/tests one by one.
   - Close only those with explicit source or screenshot proof.

4. Native QA hardening:
   - Keep `scripts/mobile-android-env.ps1` in the documented Android build path.
   - Add a repeatable runbook step for `mobile:android`, `assembleDebug`, uninstall, install, launch, screenshot, play-through, History, and Stats.
