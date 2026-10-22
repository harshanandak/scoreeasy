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
- The original focused contracts covered all nine registered sports, quick and tournament scorer families, cricket dot balls (limited, Test and guided), Undo to zero within one mounted scorer, Rematch reset, Home/brand/recovery actions, and the existing completion lock and Finish→Back contracts. They did not cover refresh after Undo to zero. Rematch does not queue background history navigation; an unscored Back consumes the prior match's guard through the existing unwind path.
- The routing expected-failure inventory is now **4** (RA-4, RA-6, RA-7, RA-8), **7 repository-wide**. RA-5 and SA-07 are normal contracts. After integrating Kit F0 (`ba5935b`), the measured palette count and **BASELINE are exactly 662**; the original navigation demo ran at 668 before that integration.

Kit F0 integration used a normal merge with no conflicts. Git automatically combined `index.jsx`, `MonoQuickMatch.jsx`, `MonoCricketGuidedScorer.jsx` and `MonoCricketGuidedScorerRoute.jsx`. The progress-based leave guard and tournament Rematch restriction remain; `NewUserFlow.jsx` keeps master's focus-outline fix, and the tokens, `mono.css`, shared dialog components and board shell match master. The screenshots above document the original navigation acceptance walk before the Kit F0 skin.

After that integration, `bun run test --maxWorkers=1` passed all 10 selected navigation, route-contract, completion-lock, recovery, result, palette, modal-skin and board-shell files: **333 ordinary passes / 4 expected failures = 337 cases**, zero failures. The exact palette equality check passes at 662.

The normal pre-push hook runs related tests. Hosted CI `verify` owns the full-suite result; local focused evidence does not substitute for that check.

Round-two persistence and legal-page contracts (rung 4):

- Substituting the quick scorer and shared legal page from `da3fcc6` produces **4 intended failures / 86 skipped**: football loses its guard after score → Undo to zero → remount, and the Privacy, Terms and Contact brands enter the resumable draft instead of `/app`. Both substituted files were restored before implementation. A separate dashboard Resume regression also failed at the missing leave dialog before the fix.
- The new 29 route cases cover all nine sports' quick scorer families and their tournament counterparts, zero-score/empty-history persistence, direct remount, football dashboard Resume, Rematch and New Match reset, legal brands on all three pages, and the guided match's stored latch during the innings break and a fresh second innings.
- Generic quick drafts save `scoringStarted` alongside their match data; tournament, tennis and Test-cricket drafts save it in `draftState`. The latch is outside Undo history, survives innings/set transitions, and clears for a new match or Rematch. Autosave continues after the final Undo once a match has started; SA-07 therefore passes normally. Guided persistence reads the current match latch when saving, including through setup/break callbacks.
- `bun run test --maxWorkers=1` over route contracts, sets stability and palette passes **3 files, 235 ordinary passes / 6 expected failures = 241 cases**. These are test results; the original phone screenshots above do not establish refresh-after-Undo browser coverage.
- A separate one-worker scorer/entry/guard/completion run passes **19 files and 262 tests**. Combined focused evidence is **22 files, 497 ordinary passes / 6 expected failures = 503 cases**. No live backend or native-device run is claimed by these tests.
