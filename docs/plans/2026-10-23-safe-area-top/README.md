# Safe-area top repair

Decisions needed: none. Native-device acceptance remains a human follow-up; screenshot status and validation results are recorded below.

## Platform cause and ownership

The app opts into `viewport-fit=cover` and targets Android API 36. StatusBar background/overlay settings cannot prevent Android 16 edge-to-edge. The app previously padded only selected board/dialog headers, leaving the rest of the route tree without a top inset.

Sources checked:

- [Capacitor 8 SystemBars](https://capacitorjs.com/docs/apis/system-bars): `insetsHandling: 'css'`, injected `--safe-area-inset-*`, and the older-WebView workaround.
- [Capacitor 8 upgrade notes](https://capacitorjs.com/docs/updating/8-0): margin handling was replaced by SystemBars inset handling.
- [StatusBar Android 16 limitations and icon styles](https://capacitorjs.com/docs/apis/status-bar).
- [Installed version's Android SystemBars source](https://github.com/ionic-team/capacitor/blob/8.3.4/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java): the old-WebView path consumes native insets and injects zero remaining CSS insets; the newer-WebView path passes them through. This matters because current documentation can evolve independently of the pinned 8.3.4 package.

The chosen strategy is Capacitor CSS inset handling plus one padded application shell. `src/mobile/safeArea.css` defines `--se-safe-{top,right,bottom,left}` from the Capacitor variable, falling back to `env(safe-area-inset-*, 0px)` for iOS and standalone web. Native padding and CSS padding are not added together: the plugin's consumed/remaining values decide what CSS receives. There is no hard-coded production status-bar height or platform sniffing.

`.se-app-shell` surrounds navigation, notices, and every route. It owns the top and side padding once. Board headers keep their original 14px/compact 10px internal spacing; their enclosing viewport budgets consume the shared top property instead of independently adding a second inset. Existing bottom consumers (dock, board thumb zone, setup actions, toasts, sheets, spectator content) use the shared bottom property. Fixed sheets/dialogs have independent safe bounds because they escape normal-flow shell padding. Sticky navigation/spectator headers and internal showcase controls keep their top offset when scrolling. Native startup chooses status icons from the root's dark class and reads the canvas colour for platforms where status-bar background colour is still supported.

At zero insets the original numeric spacing is retained. Rendered zero-inset parity still requires the screenshot comparison below; source inspection alone is not pixel evidence.

## Complete route map

Every row is inside `.se-app-shell`; `#main-content` is the common route top container. The inner surface identifies the screen inheriting that protection. Redirects inherit the destination's protection.

| Route | Top container / inner surface | Inset ownership |
| --- | --- | --- |
| `/` | `#main-content` → AppEntryRoute | Shell while resolving; destination after redirect |
| `/marketing` | `#main-content` → GuestLanding | Shared shell |
| `/app` | `#main-content` → DashboardLanding `.kit-top` | Shared shell |
| `/privacy` | `#main-content` → LegalPage | Shared shell |
| `/terms` | `#main-content` → LegalPage | Shared shell |
| `/contact` | `#main-content` → LegalPage | Shared shell |
| `/login/*` | `#main-content` → MonoAuthPageFrame | Shared shell |
| `/signin/*` | SignInAliasRedirect → login | Destination shell |
| `/sign-in/*` | SignInAliasRedirect → login | Destination shell |
| `/signup/*` | `#main-content` → MonoAuthPageFrame | Shared shell |
| `/sso-callback` | `#main-content` → SSOCallback | Shared shell |
| `/onboarding` | `#main-content` → MonoOnboarding | Shared shell |
| `/profile` | `#main-content` → MonoProfile `.kit-top` | Shared shell |
| `/profile/:username` | `#main-content` → MonoProfile `.kit-top` | Shared shell, including loading/recovery |
| `/users/search` | `#main-content` → MonoUserSearch | Shared shell |
| `/play` | `#main-content` → MonoPlayHub `.kit-top` | Shared shell |
| `/history` | `#main-content` → MonoHistory `.kit-top` | Shared shell |
| `/dashboard` | Redirect → `/app` | Destination shell |
| `/quick-match` | LegacyQuickMatchRoute → sport quick setup | Destination shell |
| `/tournament` | LegacyTournamentRoute → sport list or Play | Destination shell |
| `/stats` | Redirect → History | Destination shell |
| `/game/:id` | `#main-content` → GameResumeRecoveryRoute | Shared shell or resumed scorer |
| `/live` | `#main-content` → MonoLiveNow `.kit-top` | Shared shell |
| `/live/:token` | `#main-content` → MonoWatchMatch | Shared shell; sticky header uses shared top offset |
| `/:sport/tournament` | `#main-content` → MonoTournamentList | Shared shell |
| `/:sport/tournament/new` | `#main-content` → MonoTournamentSetup | Shared shell; action rail uses shared bottom |
| `/:sport/tournament/:id` | `#main-content` → cricket / sets / goals tournament | Shared shell, including guard/recovery |
| `/:sport/tournament/:id/match/:matchId/score` | `#main-content` → MonoTournamentLiveScore | Shared shell; board height subtracts shared top |
| `/:sport/tournament/:id/match/:matchId/result` | `#main-content` → MonoMatchResult | Shared shell |
| `/:sport/quick` | `#main-content` → MonoQuickMatch setup / scorer / result | Shared shell; board height subtracts shared top |
| `/:sport/quick/test/:matchId` | LegacyCricketQuickTestRoute → canonical Test scorer | Destination shell |
| `/:sport/quick/test-match/:matchId` | `#main-content` → MonoCricketTestLiveScore | Shared shell |
| `/:sport/quick/live/:matchId` | `#main-content` → MonoTennisLiveScore | Shared shell; shared board height |
| `/:sport/live/:matchId` | LegacyTennisLiveRoute → canonical tennis scorer | Destination shell |
| `/statistics` | Redirect → History | Destination shell |
| `/showcase/match-card` | `#main-content` → MonoMatchCardShowcase | Shared shell; internal routes only |
| `/showcase/set-display` | `#main-content` → MonoSetDisplayShowcase | Shared shell; internal routes only |
| `/showcase/brutalist-colors` | `#main-content` → BrutalistColorShowcase | Shared shell plus fixed showcase control offset |
| `/showcase/dashboard-variants` | `#main-content` → DashboardShowcase | Shared shell plus sticky showcase header offset |
| `*` | `#main-content` → NotFoundRoute / RouteRecoveryActions | Shared shell |

`src/App.jsx` has a single `/*` route to this design. Its initial loading fallback is centered rather than an interactive screen top. Lazy-route fallbacks, auth guards, offline notices, and route errors are inside the protected shell.

Full-height surfaces: `.app-confirm-backdrop` and `.app-confirm-dialog` use top/side/bottom bounds in both desktop and mobile rules; portal `.mono-sheet` and `.kit-share-sheet` cap their height below the top inset and retain bottom padding; `.sb-sheet-layer` and its sheet use the same bounds; report sheets inherit the shared backdrop bounds and have a scrollable safe-height card; the global navigation dialog and its scrollable content account for the top and side insets.

## Validation and screenshot evidence

- TDD red: all four new shared-safe-area contracts and the new dark-chrome case failed before implementation.
- Initial focused check: 38 tests passed in four files.
- Full suite: 161 files passed; three tests in three files timed out at the unchanged 15-second limit (2,117 passed and seven expected failures).
- Single-worker retry: all affected files and all three timeout files passed; 325 passed and eight expected failures across 12 files. This run also included five untracked master-reference copies. Copied tests were subsequently preserved with a non-test suffix to prevent future discovery.
- Type check: passed. Lint: zero errors (existing warnings retained).
- Both inlined fixture bundles built successfully; Vite started on port 5206 and returned HTTP 200. These are build/startup checks, not rendered proof.
- Evidence compression/size check applies to storage only; there are no captured images.

Required render matrix: Home, Play, cricket quick setup, tournament setup, History, Profile, Live now, login and one scoring board; 360×640 and 390×844; master and branch with the same simulated 44px inset; zero-inset parity; one dark set. Harnesses use real components and fixture auth/Convex, with a clearly labelled Clerk form fixture. Harnesses, copied sources and bundles stay untracked.

**Blocked; no PNGs or rendered measurements were produced.** T3 html_preview failed on two minimal static pages and the real 460,045-character inlined Home fixture with: "Headless Chrome could not render the page: the page did not finish loading within 20 seconds." An earlier oversized fixture hit the 512,000-character input limit; excluding unused route imports corrected that limit before the real fixture hit the renderer timeout. No Chrome or preview_open fallback was used. All before/after, zero-inset and dark captures remain pending. Keep the PR draft until capture and layout acceptance are complete. Follow-up Forge task: **Capture safe-area before/after screenshots when T3 html_preview recovers** (5286820d-ad55-4993-b9c6-2635504d6c72).

Evidence levels: source/config contracts and tests are rung 4 when executed. A T3 fixture render would establish simulated layout only. Native inset delivery and OS icon appearance require a rebuilt app on a physical device; they are not established by jsdom or injected CSS.

## Phone acceptance after merge

Tracked by Forge task **Verify safe-area release on physical Android, iOS and installed web** (`6f76a927-51b6-41b2-b73f-a6713dd598ce`).

Install a rebuilt native package containing the updated Capacitor config and web assets. On Android 15/16, test the current WebView and, if available, an older WebView below 140. Test iOS Capacitor and an installed/standalone web app too.

1. Walk Home, Play, `/cricket/quick`, a tournament setup, History, Profile, Live now, login, and a local scorer. Back and Finish must be entirely below the camera/status bar, with a single gap.
2. Score a disposable local point, Undo it, refresh/background/restore, and check the score and controls. Undo and the dock must remain above gesture navigation and three-button navigation.
3. Open More, Share, Report and Finish/leave confirmations; scroll long sheets to both ends. No header, close control or action should be hidden by the cutout or home indicator.
4. Open and dismiss the keyboard on setup/login; verify the dock and bottom spacing recover. Rotate to landscape and back, checking side cutouts as well as the top.
5. Check status icons over the Kit wash in light appearance and the dark theme where enabled. Compare an ordinary mobile browser at zero insets for unchanged spacing.

No physical device was available in this task. Do not treat this list as executed acceptance.
