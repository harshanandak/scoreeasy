# Score Easy Mobile App PR Execution Plan

Date: 2026-05-15
Base branch: `master`
Verified base SHA: `f87f1de625cf28e7d93a9163aa8f2d6ba39f7bf4`

This plan converts `2026-05-15-mobile-app-issue-inventory.md` into sequential PRs. Each implementation PR is based on the previous PR branch after it is pushed, not merged, so branches remain stacked but isolated. Do not mix work from later PRs into earlier PRs.

## Operating Rules

- Work one PR at a time in a separate worktree.
- Start each PR from the correct dependency branch.
- Keep each PR limited to its listed issue IDs and files needed for those fixes.
- Validate before push.
- Open draft PRs; do not merge.
- After every push, run review/CI checks and address unresolved comments on that PR before moving to the next PR.
- Use evaluator agents at each PR boundary: one evaluator checks issue coverage, one checks regression risk/mobile UX.

## PR 0: Planning Baseline

Branch: `codex/mobile-app-pr-plan`
Base: `origin/master`
Type: docs only

Scope:
- Add the merged issue inventory.
- Add this PR execution plan.
- No app code.

Validation:
- `git diff --check`
- Confirm issue IDs are unique and every P0/P1 has a target PR.

Evaluator checkpoint:
- Check that no implementation work is bundled.
- Check that PR slices are sized by user flow, not broad priority buckets.

## PR 1: Quick Match Scoring Trust

Branch: `codex/quick-match-scoring-trust`
Base: `codex/mobile-app-pr-plan`

Issues:
- `P0-001` volleyball single tap increments by 2.
- Regression coverage for the scoring path only.

Primary files:
- `src/designs/design1-mono/MonoQuickMatch.jsx`
- focused quick-match scoring tests or extracted scoring helper tests.

Acceptance:
- One volleyball score tap adds exactly one point.
- The fix does not change tournament scorer behavior.
- StrictMode/dev rendering no longer creates duplicate point commits.

Validation:
- `bun run test`
- `bun run type-check`
- Focused Playwright mobile flow for `/volleyball/quick`.

## PR 2: Runtime And Route Safety

Branch: `codex/mobile-runtime-route-safety`
Base: `codex/quick-match-scoring-trust`

Issues:
- `P0-002` React Grab debug toolbar.
- `P0-004` Android/native back safety.
- `P0-005` unknown route / 404 fallback.
- `P0-006` profile crash.
- `P1-034` loading transition measurement and shell-level fix if confirmed.
- `P1-043` native cold-launch/offline verification path.
- `P2-007`, `P2-008`, `P2-009` where directly needed for platform shell readiness.

Primary files:
- `src/main.jsx`
- `src/mobile/backButton.js`
- `src/mobile/backButton.test.js`
- `src/designs/design1-mono/index.jsx`
- `src/designs/design1-mono/MonoProfile.jsx`
- `src/components/OfflineFallback.jsx`
- `index.html`
- `vite.config.js`
- `capacitor.config.ts`

Acceptance:
- Debug toolbar is absent unless explicitly enabled.
- Unknown app routes show a useful fallback or redirect.
- Bad public profile routes show loading/not-found/friendly error, not backend internals.
- Android back on scoring routes triggers the scoring exit guard before browser history navigation.
- Loading/transition timing is measured; confirmed slow shell transitions are reduced or replaced with meaningful progress.
- Offline/native launch behavior is documented with a repeatable verification command or test path.

Validation:
- `bun run test`
- `bun run type-check`
- `bun run lint`
- `bun run build`
- Playwright/mobile route smoke for `/`, `/volleyball/quick`, `/dashboard`, `/quick-match`, `/tournament`, `/profile`, `/profile/notarealuseraudit`.

## PR 3: Quick Match Scoring Correctness

Branch: `codex/quick-match-scoring-correctness`
Base: `codex/mobile-runtime-route-safety`

Issues:
- `P0-013` tennis quick scoring displays raw points.
- `P0-014` result/home navigation state verification and fix if still present.
- `P0-017` best-of result data renders broken or missing scores.
- `P0-018` manual End Match can finalize best-of as `0 - 0` / Tie.
- `P0-019` quick-match persistence/resume clarity.
- `P1-037` cricket scoring lacks a 5-runs input.
- `P2-038`, `P2-039`, `P2-040`, `P2-041` where they are quick scorer correctness, not broad UX.

Primary files:
- `src/designs/design1-mono/MonoQuickMatch.jsx`
- scoring utility/test files if present or newly added near existing tests.

Acceptance:
- Best-of completion produces renderable final score data.
- Manual End Match uses current set/current match state.
- Leaving/reopening during an active quick match restores state or presents a clear recovery choice.
- Tennis scoring terms render correctly.
- Cricket quick scoring supports the missing 5-run path or exposes it as an advanced scoring action.
- Basketball and badminton quick-match terminal rules are not obviously wrong.

Validation:
- `bun run test`
- `bun run type-check`
- Focused Playwright mobile flows for volleyball, badminton, tennis, basketball quick match.

## PR 4: Live Scoring Mobile Court UX

Branch: `codex/live-scoring-mobile-ux`
Base: `codex/quick-match-scoring-correctness`

Issues:
- `P0-007` serve/server indicator.
- `P0-009` direct score correction.
- `P0-011` visually differentiated team score panels.
- `P0-016` safe End Match confirmation.
- `P1-012`, `P1-014`, `P1-015`, `P1-016`, `P1-036`.
- `DS-001`, `DS-015` where they apply to the scorer.

Primary files:
- `src/designs/design1-mono/MonoQuickMatch.jsx`
- shared UI/style files if the scorer already uses them.

Acceptance:
- Scorer has clear left/right team identity, server indicator, set/rule status, last-action feedback, and reachable thumb-zone actions.
- End Match cannot be mistaken for Back and requires app-styled confirmation.
- Score correction can adjust either side without destroying all later point history.
- Main score controls are accessible buttons or equivalent keyboard/screen-reader-safe controls.

Validation:
- `bun run test`
- `bun run type-check`
- Playwright mobile scoring path with screenshots before score, after score, correction, swap, end confirmation.

## PR 5: Mobile Home And Sport Discovery

Branch: `codex/mobile-home-discovery`
Base: `codex/live-scoring-mobile-ux`

Issues:
- `P0-003` cold open to scoring in 2 taps.
- `P0-012` disabled primary buttons lack feedback where touched by home/play/setup entry.
- `P1-001` mobile home feels like a marketing page.
- `P1-002` primary CTA is not specific enough.
- `P1-003` signup competes with guest scoring.
- `P1-004` Volleyball is not visible by default on `/play`.
- `P1-005` category chips clip horizontally.
- `P1-006` Quick versus Tournament actions need clearer outcomes.
- `P1-035`.
- `DS-002`, `DS-003`, `DS-004`, `DS-005`.

Primary files:
- `src/designs/design1-mono/landing/GuestLanding.jsx`
- sport selection/home files under `src/designs/design1-mono/`
- shared CSS/style files used by navigation and sport cards.

Acceptance:
- Mobile first viewport behaves like an app entry screen.
- Primary action starts a Volleyball match path directly.
- `/play` exposes Volleyball in the first visible mobile state.
- Category controls do not clip without affordance.
- Sport cards explain Quick Match versus Tournament outcomes.
- Missing sport icons in this surface are filled.

Validation:
- `bun run type-check`
- `bun run lint`
- `bun run build`
- Playwright mobile screenshots for `/`, `/play`, search/filter, and direct Volleyball start.

## PR 6: Mobile Navigation Shell

Branch: `codex/mobile-navigation-shell`
Base: `codex/mobile-home-discovery`

Issues:
- `P1-022`, `P1-023`, `P1-024`.
- `DS-012`, `DS-018`.

Primary files:
- `src/designs/design1-mono/index.jsx`
- shared nav/menu styles.

Acceptance:
- Bottom navigation exists for core app routes.
- Mobile menu uses a proper sheet/backdrop and route state.
- Route state is visible and accessible in app navigation.
- Bottom navigation does not collide with safe areas or scoring controls.

Validation:
- `bun run type-check`
- `bun run lint`
- `bun run build`
- Playwright mobile screenshots for bottom nav routes and menu open/close.

## PR 7: Quick Match Setup Mobile Flow

Branch: `codex/quick-match-setup-mobile-flow`
Base: `codex/mobile-navigation-shell`

Issues:
- `P1-007` first step asks rules before teams.
- `P1-008` Start button is silently disabled when team names are blank.
- `P1-009` Add players controls are too small.
- `P1-010` Add players expands inline and pushes Team 2 down.
- `P1-011` Custom format controls are cramped.
- `P1-028`.
- `DS-006`, `DS-007`, `DS-008`, `DS-009`, `DS-010`, `DS-016`, `DS-020`, `DS-021`.

Primary files:
- `src/designs/design1-mono/MonoQuickMatch.jsx`
- shared form/button styles if already used.

Acceptance:
- Quick Match opens to one mobile setup surface with teams first and rules summary visible.
- Team A/Team B defaults allow immediate start.
- Rules details are explicit and editable without making the first step a black box.
- Add players is optional, stable, and reachable with 44px+ touch targets.
- Sticky primary action remains in the thumb zone.

Validation:
- `bun run test`
- `bun run type-check`
- Playwright mobile setup flow for standard/custom rules and roster expansion.

## PR 8: Result, History, And Retention Loop

Branch: `codex/result-history-retention`
Base: `codex/quick-match-setup-mobile-flow`

Issues:
- `P0-008` clickable history detail.
- `P0-010` history clear confirmation/undo.
- `P1-029`, `P1-030`.
- `P2-002`, `P2-003`, `P2-004`.

Primary files:
- `src/designs/design1-mono/MonoQuickMatch.jsx`
- `src/designs/design1-mono/MonoHistory.jsx`
- `src/mobile/share.js`
- shared modal/toast UI if present.

Acceptance:
- Result screen confirms saved state and offers Rematch, Share, View History, See Stats, New Match.
- Share uses native share helper with copy fallback and visible feedback.
- History cards open match detail with score/set summary.
- Clear history uses confirmation and recovery/undo where feasible.
- Empty history gives Start Quick Match and Create Tournament CTAs.

Validation:
- `bun run test`
- `bun run type-check`
- Playwright mobile result and history flows, including share fallback where browser allows.

## PR 9: Tournament Setup And Resume Flow

Branch: `codex/tournament-setup-resume-flow`
Base: `codex/result-history-retention`

Issues:
- `P1-017` review step is not review-first.
- `P1-018` tournament CTAs are not sticky.
- `P1-019` tournament Back controls are too small.
- `P1-020` tournament empty state is passive.
- `P1-021` existing tournaments lack explicit Continue action.
- `DS-013` where it applies to tournament setup.

Primary files:
- `src/designs/design1-mono/MonoTournamentSetup.jsx`
- `src/designs/design1-mono/MonoTournamentList.jsx`
- `src/designs/design1-mono/GenericSetsTournament.jsx`
- `src/designs/design1-mono/GenericGoalsTournament.jsx`

Acceptance:
- Review step is summary-first with generated schedule/bracket preview.
- Tournament setup has sticky CTAs and reachable Back controls.
- Empty list explains tournament value and offers clear actions.
- Existing tournaments show explicit Continue.

Validation:
- `bun run test`
- `bun run type-check`
- Playwright mobile tournament create, review, start, and continue.

## PR 10: Tournament Formats And Destructive Safety

Branch: `codex/tournament-format-safety`
Base: `codex/tournament-setup-resume-flow`

Issues:
- `P1-031`, `P1-032`.
- `P1-044`, `P1-045`, `P1-046`.

Primary files:
- `src/designs/design1-mono/MonoTournamentSetup.jsx`
- `src/designs/design1-mono/MonoTournamentList.jsx`
- `src/designs/design1-mono/GenericSetsTournament.jsx`
- `src/designs/design1-mono/GenericGoalsTournament.jsx`

Acceptance:
- Knockout/elimination is added or explicitly staged behind a visible coming-next affordance if data model risk is too high.
- Review step shows generated schedule/bracket preview.
- Clear scores/delete tournament use app-styled confirmation and recovery where feasible.
- Missing tournament detail route has useful recovery actions.

Validation:
- `bun run test`
- `bun run type-check`
- Playwright mobile tournament schedule/bracket preview, clear score, delete, and not-found.

## PR 11: Auth, Profile, And Onboarding Flow

Branch: `codex/auth-profile-onboarding-flow`
Base: `codex/tournament-format-safety`

Issues:
- `P1-025`, `P1-026`, `P1-027`, `P1-039`, `P1-040`, `P1-041`, `P1-042`.
- `P2-013`, `P2-035`.
- `DS-017`, `DS-019`.

Primary files:
- `src/designs/design1-mono/MonoProfile.jsx`
- `src/designs/design1-mono/MonoAuthPageFrame.jsx`
- `src/designs/design1-mono/MonoOnboarding.jsx`
- `src/designs/design1-mono/SSOCallback.jsx`
- `src/auth/CloudAuthRoot.jsx`
- `src/designs/design1-mono/MonoUserSearch.jsx`
- `src/designs/design1-mono/index.jsx`

Acceptance:
- Guest path from auth can continue intended flow or default Volleyball match.
- Profile is discoverable from the app shell.
- Onboarding does not block fast scoring unless account setup is truly required.
- Auth redirect intent is preserved.

Validation:
- `bun run test`
- `bun run type-check`
- `bun run build`
- Playwright mobile login/signup/profile/guest/back flows.

## PR 12: Statistics And Performance Insight

Branch: `codex/statistics-insights`
Base: `codex/auth-profile-onboarding-flow`

Issues:
- `P1-033`.
- `P2-005`, `P2-006`.
- Any untouched stats-specific part of `P2-004`.

Primary files:
- `src/designs/design1-mono/MonoStatistics.jsx`
- shared match-history/stat helpers if present.

Acceptance:
- Statistics shows useful insights beyond counts: top team, form, streak, closest match, biggest win, most played sport.
- Team stats include for/against and margin where data supports it.
- Empty stats state explains how to generate stats and offers Start Match.

Validation:
- `bun run test`
- `bun run type-check`
- Playwright mobile statistics overview and empty/non-empty states.

## PR 13: Native Store Polish And Device Verification

Branch: `codex/native-store-polish`
Base: `codex/statistics-insights`

Issues:
- `P2-009`, `P2-010`, `P2-011`, `P2-012`, `P2-036`, `P2-037`.
- Remaining platform verification from `P1-043`.

Primary files:
- `index.html`
- `manifest.webmanifest` or equivalent if present.
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/main/res/**`
- `src/mobile/haptics.js`
- `src/main.jsx`
- Capacitor config files.

Acceptance:
- Safe areas work for app shell, bottom nav, sticky controls, and scoring.
- Android app assets are PNG/maskable/splash-ready where required.
- Haptics are wired into scoring/undo/end where supported.
- Deep-link behavior is defined or intentionally deferred with documented reason.
- Device/emulator smoke is documented with evidence.

Validation:
- `bun run build`
- `bun run mobile:android`
- Android emulator or device smoke where available.
- Playwright mobile safe-area screenshots if emulator is not available.

## Later Backlog After Core Launch

Keep these out of the launch-critical stacked branch unless they are cheap while touching the same files:
- `P2-015` multi-sport scoring layout contract.
- `P2-016` homepage social proof/demo media.
- Any remaining low-risk DS color/typography polish not needed by the above flows.

## Execution Loop Per PR

1. Create worktree from dependency branch.
2. Run a focused pre-change smoke if the behavior is uncertain.
3. Implement with `/dev` using worker agents only for disjoint files.
4. Run focused tests.
5. Run full validation listed for the PR.
6. Run evaluator agents:
   - Coverage evaluator: confirms listed issue IDs are actually addressed.
   - UX evaluator: checks mobile screenshots and user flow.
7. Patch evaluator findings.
8. Push branch and open draft PR.
9. Run `/review` loop:
   - Inspect checks and review comments.
   - Patch unresolved issues on that branch only.
   - Re-run validation.
   - Re-push until no unresolved review comments remain.
10. Move to the next PR only after the previous PR is pushed and review-clean.
