# Design-Debt Reconciliation — ScoreEasy Upgrade (Fable revision #5)

Date: 2026-07-19
Kernel: Volleyball/ScoreEasy (cwd-scoped; run `forge` from repo root, not the forge dir)
Source scanned: `src/designs/design1-mono/` (excluding `*.test.*` and `landing-designs/` mockups)

## Method
1. `forge issue list` (and `--json` for bodies) against the ScoreEasy kernel — all 10 target issues carry `status=open`.
2. Grepped source for `I-0xx` fix-comments and for the behavioral pattern each issue asks for.
3. Classified each as ALREADY-FIXED / PARTIAL / OPEN against the code evidence.

> Kernel status is stale: every issue below still reads `open`, but the code already
> satisfies 9 of 10. These are annotate/close, **not** refile. The kernel `open` flag is
> the debt to reconcile, not new work to schedule.

## Verdict summary

| I-xxx | Kernel | Verdict | Evidence |
|-------|--------|---------|----------|
| I-013 | open | ALREADY-FIXED | `MonoStatistics.jsx:339,381` — empty Overview leads with `EmptyState` + CTA, skips zero-value grids. Explicit `(I-013)` comment. |
| I-044 | open | ALREADY-FIXED | Documented type floors throughout `mono.css` (698,1161,1357,1441,1538,1640) + `MonoSportHome.jsx:24,38`: 0.6875rem decorative floor / 0.75rem functional floor, all tagged `(I-044)`. |
| I-047 | open | ALREADY-FIXED | Press feedback on every primary CTA: `mono.css` `.mono-btn-primary:active` (643), `.mono-action-primary:active` (682), plus arena/scorer `:active` states; documented "brief accent-tint flash" model at line 1046. |
| I-049 | open | ALREADY-FIXED | `scoring/MonoGoalsLiveScore.jsx:510,573` — opponent line rebuilt as an informational score display (not a `disabled <button>` that "reads as a dead control"). Explicit `(I-049)` comment. |
| I-051 | open | ALREADY-FIXED | `mono.css:1072` — tap-cards reworked so the set "reads as a uniform, finished, pressable set (I-051, I-052)". |
| I-052 | open | ALREADY-FIXED | Same `mono.css:1072` block; rugby/football/basketball buttons unified to one uniform pressable spec. |
| I-053 | open | **PARTIAL** | Root causes shipped: contrast (I-048 History / I-070 Statistics, both `done`), cold-load blank (I-087 `done`), action-first empty state (I-013). No skeleton/`isLoading`/`animate-pulse` markup exists in `MonoHistory.jsx`/`MonoStatistics.jsx` — nothing renders a perpetual loader. Residual below. |
| I-066 | open | ALREADY-FIXED | Nav labels unified to `'Stats'` in both top nav (`index.jsx:568`) and bottom nav (`index.jsx:582`); `/stats` redirects to `/statistics`. Uppercase `STATS` survives only in `landing-designs/*` mockups, not the app shell. |
| I-068 | open | ALREADY-FIXED (KEEP) | `mono.css:1244-1256` — green reclassified from "arbitrary" to the single documented cricket boundary (4/6) semantic. See decision below. |
| I-086 | open | ALREADY-FIXED | `MonoHistory.jsx:299` `showFilters=useState(false)` — filters collapsed by default behind a toggle (`651-659`, `aria-expanded`), so saved matches sit near the top of the mobile viewport. |

## PARTIAL — residual work

- **I-053 (perpetually-loading look):** No dedicated I-053 change; it is resolved *indirectly* by
  the contrast fixes (I-048/I-070), the cold-load fix (I-087), and the action-first empty state
  (I-013). No loading skeletons remain in code. **Residual = a visual confirmation pass only**:
  screenshot populated *and* empty History + Statistics on Android to confirm neither reads as a
  skeleton, then annotate/close. No further code work anticipated.

## OPEN — needs full work

None. All 10 are satisfied in code (I-053 pending a visual sign-off).

## I-068 — keep vs. remove the green 4/6 run-button accent

**Decision: KEEP** (as the documented cricket boundary semantic; do not remove).

Rationale, from `mono.css:1244-1256`:
- The green is no longer arbitrary — it is the **single documented** cricket semantic: a boundary
  (4 or 6) pops in green **accent TEXT** (`var(--primary)`), never a filled green box.
- Applied uniformly across all three cricket scorers: keypad scorers (MonoQuickMatch,
  MonoCricketTestLiveScore) via `.mono-cricket-key-four/-six`; the run-grid scorer
  (MonoCricketLiveScore) via `.mono-scorer-run-button-accent`. 4 and 6 read as one matched pair
  everywhere.
- This is the exact concern I-068 raised ("does not align with a documented semantic state") —
  now inverted into a documented, palette-aligned state. Removing it would strip a meaningful,
  consistent signal from the highest-frequency cricket action. Keep it, close I-068 as resolved.

## Reconciliation action for the kernel
Annotate/close I-013, I-044, I-047, I-049, I-051, I-052, I-066, I-068, I-086 as already-satisfied
(cite the evidence above). Leave I-053 open pending the one-time visual verification, then close.
Do **not** refile any of these into the revision-#5 build scope.
