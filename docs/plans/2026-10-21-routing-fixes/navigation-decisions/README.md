# Navigation decisions: phone demo

Decisions needed: none.

These five guest flows ran in Chrome at **390×844 CSS pixels** (PNG captures use a 2× device scale). They use local fixture data and the existing `scripts/route-sweep.mjs` Chrome transport. The T3 preview timed out, so the repository's browser workflow supplied the captures. This is browser evidence, not native Android/iOS verification.

Acceptance walk (rung 5, running app):

- [x] With one resumable volleyball draft, Home from the tournament list opens `/app` and shows Resume instead of entering the scorer. [Dashboard](navigation_Home_with_one_draft_Home_dashboard.png)
- [x] Untouched quick setup shows bottom navigation; Home leaves without a warning. [Setup](navigation_setup_leaves_freely_setup_with_bottom_nav.png)
- [x] A football tournament scorer starts unguarded. Recording the first point saves 1–0; browser Back opens the leave warning, and Stay retains the score. [Warning after the first point](navigation_first_point_arms_guard_leave_warning_after_scoring.png)
- [x] A completed tournament match hides Rematch. Done returns to its tournament. [Tournament result](navigation_tournament_result_hides_Rematch_tournament_result_without_Rematch.png)
- [x] Quick results retain Rematch. Rematch opens a fresh 0–0 scorer, with bottom navigation and no leave warning before another point. [Quick result](navigation_quick_result_keeps_Rematch_quick_result_with_Rematch.png), [fresh rematch](navigation_quick_result_keeps_Rematch_fresh_rematch_scorer.png)

Structured snapshots: [four decision flows](demo.json), [quick result and rematch](quick-demo.json). Chromium reported blocked vibration for programmatic scoring clicks; those diagnostics are retained in the JSON.

Executed contract evidence (rung 4):

- Against unchanged `origin/master` app code (`61c729d`), the initial contracts produced **14 failures / 35 passes / 4 expected failures**: Home resumed the single draft, all nine setup routes installed the guard, and tournament results rendered Rematch. RA-5 was deliberately a normal failing test in that run.
- A second unchanged-code counterfactual produced **14 failures / 53 skipped** for the seven ordinary sports' quick/tournament first-point contracts. Each failed because the guard was installed before scoring.
- Focused contracts cover all nine registered sports, quick and tournament scorer families, cricket dot balls (limited, Test and guided), Undo to zero, Rematch reset, Home/brand/recovery actions, and the existing completion lock and Finish→Back contracts. Run with `bun run test --maxWorkers=1 src/designs/design1-mono/routes.contract.test.jsx src/designs/design1-mono/AppOwnedExitGuard.test.jsx src/designs/design1-mono/scoring/CompletionLock.test.jsx src/designs/design1-mono/AppRouteRecovery.test.jsx src/designs/design1-mono/theme/palette.test.js`.
- The routing expected-failure inventory is now **4** (RA-4, RA-6, RA-7, RA-8), **8 repository-wide**. RA-5 is a normal contract. Palette **BASELINE remains exactly 668**.

The normal pre-push hook runs related tests. Hosted CI `verify` owns the full-suite result; local focused evidence does not substitute for that check.
