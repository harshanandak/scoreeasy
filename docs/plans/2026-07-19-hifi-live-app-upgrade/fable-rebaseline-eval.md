# Fable Evaluation — Re-baseline Validity + Corrected M1

**Date:** 2026-07-19 · **Evaluator:** Fable (advisory) · **Inputs:** `rebaseline-report.md`, `decomposition.v2.json`, independent evidence checks against `origin/master` @ `cd61636`.

---

## A. Validity — the re-baseline is trustworthy, with three sharpenings

I independently re-ran the report's evidence probes against `origin/master` (git grep / ls-tree, no checkout). Verdict: **the report is accurate and conservative.** Every spot-check confirmed:

| Claim | Independent check | Verdict |
|---|---|---|
| DONE: scorer exit safety | `AppOwnedExitGuard.test.jsx` exists (popstate-based; beforeunload appears only in the test, consistent with asserting its absence); `EndMatchButton` + `ThumbActionBar` present in `MonoQuickMatch.jsx`; `appConfirmUtils.js` exists | **Confirmed — close it** |
| PARTIAL: Sets/Tennis/Goals/CricketTest arena blend | `mono-arena` classes + `var(--se-` tokens present in all four | Confirmed |
| PARTIAL: Onboarding #0066ff debt | Hex present at exactly the 10 cited lines (153,166,524,536,542,571,573,673,683,687) | Confirmed — evidence quality is high |
| PARTIAL: nav inline, 5 cells, no BottomTabNav | 0 `BottomTabNav` files; tab branches inline in `index.jsx` (~L526+) | Confirmed |
| PARTIAL: dashboard band/empty-state/resume | `EmptyDashboard`, `LiveNowStrip`, `getActiveSessions`, `Resume` all present in `DashboardLanding.jsx` | Confirmed |
| TODOs by absence-grep | 0 files for `MonoQuickSetup`, `MonoSegment/MonoStepper/RuleSummaryChip`, `MonoScorerMenuButton/MonoMatchMenuSheet`, `teamOnly`, `UndoControl`, `MonoFallbackScreen`, quarter/bonus logic in Goals | **Confirmed — none are secretly partial** |
| Match-end entirely missing | 0 files referencing `MonoMatchResult`/`MonoScorecard` | Confirmed — the single biggest genuine gap |

("16 commits behind" is actually 17 behind / 18 ahead — immaterial.)

### Three sharpenings the report missed

1. **Cricket LO is a bigger residual than reported.** It has `--se-` tokens but **no `mono-arena-*` structural classes** (unlike the other four scorers) and retains raw hex colors. The report's "fully token-blended" overstates it. Its residual = arena-structure adoption + hex cleanup + the I-068 keep-green decision — the largest scorer residual, treat as real design work.
2. **Foundation was excluded from the re-baseline but is itself partially shipped.** `mono.css` on master defines ~265 `--se-` occurrences — the token layer substantially exists. Foundation issue "Blend design tokens + blend-governance contract" must be rescoped to: gap-fill vs the HiFi token spec + write the governance contract. The other six Foundation issues are genuinely TODO (0 files for `MonoSheet`, `CaptionChip`/`CoachChip`, `SegmentedToggle`, `AvatarCircle`/`SportMedallion`/`LiveDot`; 0 motion-kit markers; `EmptyState` still inline in `MonoStatistics.jsx` awaiting extraction).
3. **Tennis retains hex colors** alongside its token blend — its "Part A extras" residual should include a hex→token sweep, not just the coaching/attribution seam.

### Which MEDIUM-confidence "styling residuals" are real design work vs cosmetic

- **Real design work (needs a design eye + spec comparison):** Cricket LO arena adoption; Sets per-set strip + shared coaching chip; Goals seam prompt + football coaching chip; onboarding celebratory finish; EmptyDashboard medallion/HiFi delta. These are the residuals where "blend present" ≠ "HiFi spec met".
- **Cosmetic/mechanical (Sonnet-grade):** onboarding #0066ff→token swap (10 known lines); Tennis/Cricket hex sweep; `_TABBED` + orphan deletion; CricketTest parity spot-check.

Report's absence-greps were named-symbol probes — precise, and my re-run found **zero false TODOs**. The MEDIUM self-rating was appropriately humble; the data is better than MEDIUM.

---

## B. Corrected M1

### Accounting (46 original M1 issues)

| Disposition | Count | Issues |
|---|---|---|
| **CLOSE** | **1** | Scorer exit safety (#34 in M1 list) |
| **RESCOPE to residual** | **18** | The report's 17 PARTIALs **+ Foundation "Blend design tokens"** (token layer shipped; residual = spec gap-fill + governance contract) |
| **BUILD as planned** | **27** | 16 confirmed TODOs + 6 remaining Foundation issues (primitives, motion kit, EmptyState extraction) + 5 Match-end issues |

### Crisp residuals for the 18 rescopes

- **Scorer blends (6 → consolidate to 2 issues):** (a) *Cricket LO arena-structure adoption + hex sweep + I-068 decision* — the heavy one; (b) *cross-scorer residual pass*: Sets per-set strip + coaching chip, Tennis Part-A seam + hex, Goals seam prompt + football chip + live dot, CricketTest parity check. All share the coaching-chip primitive → sequence after "Shared coaching-status selectors".
- **Nav (2):** extract `BottomTabNav` from inline `index.jsx`; collapse 5 cells → 4-tab set + Guided-toggle decision. (Stats→History merge already shipped via #99; I-066 reduces to a label/route confirm.)
- **Onboarding (2):** #0066ff→token (mechanical) + celebratory finish (design); EmptyDashboard HiFi delta only.
- **Dashboard (2):** self-sessions band styling vs spec; tournament resume card restyle only.
- **In-match (2):** confirm-winner interstitial (side-swap primitive exists — build the screen around it); shared UndoControl + toast slot extraction (wiring exists per-scorer).
- **Utility (3):** delete `_TABBED` (verified unreferenced) + NewUserFlow shadow-harden; generic 404 `MonoFallbackScreen` atop shipped recovery actions; ShowcaseFrame hub over existing showcases.
- **Foundation (1):** token spec gap-fill + blend-governance contract (do NOT rebuild the token layer).

### Real size

**~44 tracked issues → ~37 after consolidation** (merging scorer residuals and cleanup items). Effort: residuals run ~30–50% of their original estimates, so remaining M1 effort ≈ **65–75% of the original 46-issue estimate**. The savings are real but the plan is not "mostly done" — what shipped is the *reskin* half of the scorers; the *missing-features* half (match-end, setup funnel, primitives) is untouched.

### Is M1 still the right first milestone? — Redefine its spine, keep its boundary

The original M1 goal ("core scoring transformation") is stale — master already did the scorer transformation. **Redefine M1 around the genuinely-missing user value, in this order:**

1. **Match-end terminal (Result → Scorecard → Share)** — 5 issues, 0 files on master, completes the core loop. This is now M1's headline.
2. **Foundation primitives the above consumes** — MonoSheet (share sheet), CaptionChip/CoachChip, SportMedallion, motion kit, EmptyState extraction — built just-in-time, trimmed to what M1 consumers need, not as a big up-front layer (the token layer, the usual reason foundation goes first, already exists).
3. **4-tab collapse + BottomTabNav extraction** — small, high-visibility, unblocks IA-dependent screens.
4. **Setup funnel chain** — MonoQuickSetup extraction → restyle + express lane → capsule controls → toss interstitial (strict sequence, extraction first at zero visual change).
5. **Scorer residual pass** (2 consolidated issues, after coaching-status selectors) + in-match additions (⋯ menu, team-only, interstitial, UndoControl).
6. **Auth/onboarding blends + utility cleanup** — genuine TODOs, lower urgency, parallelizable.

### Corrected build order (replaces original prOrder head)

Coaching selectors + trimmed Foundation primitives → MonoMatchResult + verdict helper → Result rollout → MonoScorecard → Share sheet ∥ BottomTabNav → 4-tab ∥ QuickSetup extraction chain → scorer residual pass → in-match additions → auth blends → cleanup. (Generic-live-game routing *decision* early — it gates the Result-rollout follow-up — but the conditional rebuild stays last.)

---

## C. Process — why this happened and the guardrail (ranked)

Root cause: decomposition was authored against a local branch 17 commits behind `origin/master`, and planning had no step that checked. Absence-of-evidence claims ("X doesn't exist, build it") were made against a stale tree.

1. **Baseline hard-gate in planning (do this first).** Before any decomposition/screen-eval step runs: `git fetch origin` + assert `git rev-list --count <plan-base>..origin/master` == 0, and stamp `baseline: <sha>` into the plan front-matter and every filed issue. If nonzero → stop, rebase the plan inputs. One-line check; would have caught this outright.
2. **Falsifiable absence-probes per issue.** Any issue premised on something *not existing* must carry the grep that proves it (`probe: git grep -c MonoScorecard <sha> -- src == 0`). Cheap to write during planning — the re-baseline report just demonstrated the exact form.
3. **Build-start probe re-run (stale-plan tripwire).** Builder agents re-run the issue's probe against current `origin/master` before writing code; probe hits → halt and flag "already built", never silently duplicate. Catches drift *between* planning and building, which gate #1 can't.
4. **Merged-PR sweep as a planning input.** Planning lists PRs merged since the plan-base commit and reconciles them (the re-baseline did this retroactively — it belongs up front).
5. **Worktree hygiene.** Plan and build from worktrees cut from freshly-fetched master (`forge worktree create`), never a long-lived local branch; FF local master first.

Rank 1+2 are the guardrail; 3 is the safety net; 4+5 prevent the precondition.

---

## D. Ranked next actions

1. **Execute the tracker correction:** close 1 (scorer exit safety), rescope 18 with the residual texts in §B (consolidate 6 scorer partials → 2 issues), leave 27 as-is; stamp every open issue with `baseline: cd61636` + its absence-probe.
2. **Rebase the working branch onto `origin/master`** (it is 17 behind / 18 ahead — reconcile before any new build lands) and re-point prOrder to the §B corrected order.
3. **Start the match-end terminal chain** (MonoMatchResult + verdict helper first), pulling in only the Foundation primitives it consumes.
4. **Run the two decisions now blocking sequencing:** generic-live-game retire-vs-dispatch (gates Result rollout follow-up) and I-068 cricket keep-green (gates the Cricket LO residual — note my finding that Cricket LO also lacks arena structure).
5. **Re-verify with a design eye (not grep):** screenshot-compare the 5 "real design work" residuals (§A list) against the HiFi spec before sizing them — grep confirmed presence, only eyes confirm spec-match. Add the planning baseline hard-gate (§C.1-2) to the workflow before the next planning run.

**Not verified by me:** exact HiFi-spec visual deltas (grep can't see them — action 5), and M2/M3 issues (out of scope; the same re-baseline discipline should be applied to M2 before it starts).
