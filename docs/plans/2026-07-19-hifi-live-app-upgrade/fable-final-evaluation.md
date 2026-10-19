# Fable Final Evaluation — End-of-Phase Retrospective
## HiFi × Brutalist Live-App Upgrade planning cycle · 2026-07-19

_Scope: strategic evaluation of the WORK (master-plan.md, decomposition.v2.json — 17 epics / 99 issues / 169 edges, filed: 10 ready / 89 blocked), the PROCESS (3 workflows + layered evals + kernel filing), and the long arc. This is not a re-vet of plan mechanics; that returned READY-TO-FILE._

---

## A. WORK — is this the right thing, in the right order?

**Verdict: yes, with one real mis-prioritization and one missing bet.**

**M1 as the first bet is correct.** The plan's single best strategic decision is what M1 *is*: the activation loop (the entirely-missing Result → Scorecard → Share terminal) plus the safety fixes (inverted destruction guard, unified End, back-press guard) on the flow that already works, with zero new backend surface. That is where user-visible value per unit of risk is highest, and it converts the app from a dead-end scoring tool into something with a completion moment worth sharing. The gating principle running through M2/M3 — *no tab or CTA ships pointing at an empty shell* — is the right discipline and is applied consistently (5th tab deferred, add-friend gated, honest empty states).

**The M1/M2/M3 cut is smart.** M2 correctly sequences records + competition depth + the first real backends after the shell exists; M3 correctly parks everything that gates on those backends. Milestone boundaries as re-planning checkpoints is the right posture for a 99-PR program.

**Mis-prioritization #1 — the data-loss trap waits behind ~34 reskin PRs.** The inverted destruction guard (one-tap unrecoverable Discard beside a *confirmed* Finish) is ranked Critical #2 by the flow/IA eval and is live harm *today*. In prOrder it lands at position 35, after the entire foundation + onboarding + setup + scorer-blend train. A minimal confirm-on-discard hotfix is a ~50-line PR that needs none of the new design system. Ship it first, standalone; let PR #35 remain the full unified-End UX. Safety fixes should never queue behind aesthetics.

**Mis-prioritization #2 (minor) — M1 is 46 issues deep before the first checkpoint.** Nearly half the program runs before any re-planning gate. Consider an informal mid-M1 checkpoint after the scorer blends (~PR 30): if the blend thesis is wrong anywhere, it will be visible there, before the match-end epic builds on it.

**Missing bet — measurement.** 99 PRs of UX conviction and not one instrumentation issue. The plan's core claims (two taps to start, match-end drives activation/share, 4-tab IA reduces lostness) are all testable, and nothing will test them. Add one small M1 issue: activation-funnel events (start → first score → match-end → share/sign-in). Without it, the M2/M3 checkpoints re-plan on opinion.

**Over-build candidates (acceptable, but flag at the M1 checkpoint):** Dev showcases hub + explainer (2 internal-DX PRs), the basketball quarter+bonus engine (scope creep beyond "visual blend"), and the Generic-live rebuild (already correctly gated on a retire-by-default decision). All are cut-safe if velocity lags.

**The brutalist × HiFi thesis is right.** "Hard shell / soft content" is a genuine product position, not a compromise: the blend-governance contract (green = lead only, one gold per screen, capsules only on interactives, pulse = live-signal only, soft-element budget, all tokens derived from oklch `--primary`) converts taste into enforceable rules. That is rare and valuable — the risk is enforcement decay, not the thesis (see C).

---

## B. PROCESS — how good was the orchestration?

**Verdict: the layered structure worked and paid for itself; the waste was in uniform depth and mechanically-detectable defects reaching the expensive layer.**

**The eval layering was worth its cost — because every layer changed the artifact.** The chain (Opus inventories → 122-agent hifi-plan → Fable vet → 24-agent flow-ia lens → 8-agent revise → Fable re-vet → filing) moved the plan from v1 (14 epics / 82 issues, 4 silent degenerates, a dropped ⋯-menu screen, no milestones) to v2 (17 / 99, dependency-valid, IA-restructured). The flow-ia pass alone — an *orthogonal lens*, journeys instead of screens — found 6/10 core journeys broken and produced the 4-tab model that restructured the plan. That is the signature of a good eval layer: it isn't confirming, it's changing. ~13M tokens for a defensible 99-PR program over a 697KB / 90-frame reference is a fair price; a wrong plan would cost more than that in the first ten misdirected PRs.

**The silent-failure incident is the process lesson of the cycle.** The workflow reported success while 4 of 60 screen outputs were degenerate (`"placeholder"` verdicts, a `"See above."` design). Two conclusions:
1. **Never trust workflow output on completion metrics.** "122 agents ran" is not evidence; only schema-validated content is. Adversarial review caught it, but review is probabilistic — a validator is deterministic and free.
2. **The guardrail belongs *inside* the workflow:** an output-schema gate on every generative stage — reject placeholder/self-reference values, enforce minimum content length, require file:line citations in verdicts — fail the stage loudly, auto-retry once, surface residuals in the run summary. The senior-eval layer should be catching judgment errors, not blanks. Every mechanically-detectable defect that reaches Fable is waste.

**What was wasteful:**
- **Uniform verify depth.** All 60 screens got an equal-depth adversarial verify. Legal pages and empty states do not need what the cricket scorer needs. A triage stage (deep-verify the ~20 high-stakes screens; batch-verify simple ones 5-per-agent) keeps the catch-rate and cuts the largest token block ~40%.
- **Filing friction.** 6s CLI spawns on a cloud-synced FS × 99 issues × 3 passes. Move the kernel workspace off synced storage or batch operations per pass; probe-first (which the filing agent did) stays.
- The transient verify timeout was handled correctly (resume + backfill) — keep that pattern.

**What to keep:** independent inventory agents before any generation; the design+adversarial-verify pair per unit; an orthogonal-lens second workflow (screens × journeys); a revise workflow that merges *all* eval outputs in one pass; Fable vets at the two decision gates only (not per-stage); probe-first kernel filing.

**Build-phase orchestration (directive):**
1. **Foundation PRs 1–7 go serial, with the hardest review of the program.** The token contract blocks 27 issues, CaptionChip 23, AvatarCircle 20. A defect there propagates to every consumer; a rushed foundation is the most expensive possible mistake. Freeze the token/component API afterward — additive-only, with contract tests.
2. Then fan out: **worktree per agent** (never the shared checkout), **WIP cap ~4**, **merge-train** (update only the next-at-bat PR, never rebase the whole queue), **one central shepherd/poller** (no per-agent monitors), preflight deterministic gates before requesting review, head-SHA settle before merge.
3. **Every visual-blend PR verifies via screenshots** against the HiFi frames *and* brutalist parity — tests cannot see identity erosion.
4. "Ready to merge" = CI green on the matrix, never local green.

---

## C. LONG-TERM RISKS (M1 → M3 arc)

1. **The two divergent live-broadcast worktrees are a merge time bomb.** Open Q1 (canonical worktree) is labeled an M2 blocker, but the cost is incurred *during M1*: 46 PRs will churn the codebase underneath both candidates. Decide now, and rebase the chosen stack onto main every ~10 merged PRs, or "Land live stack" (PR #74) becomes archaeology.
2. **Greenfield backends arrive last, gating ~30 issues.** Friends schema, teams membership, event log, public snapshots — the highest-uncertainty engineering lands when momentum is lowest and the UI above it is already designed. Mitigate: at the M1 checkpoint, spike the two riskiest schemas (friends, event log) as design-docs-only so M3 UI assumptions get validated two milestones early.
3. **Seven open product questions (master-plan §8), several gating early PRs.** Q6 (does `--primary` actually resolve green?) gates the *semantics of PR #1*; Q3 (4-tab sign-off) gates PR #10; Q2/Q4 gate M1 scope. These must be answered before the PRs they block, and they are currently prose, not tracked blockers — file each as a kernel issue with a dependency edge to the first prOrder position it blocks, so `forge ready` surfaces them instead of an agent discovering them mid-PR.
4. **Dependency-chain fragility.** With fan-ins of 27/23/20, any breaking change to token names or chip props mid-stream forces mass rebases across in-flight worktrees. The freeze + contract tests from B.1 is the mitigation; treat any post-freeze breaking change as a program-level event, not a PR detail.
5. **Brutalist identity erosion across 99 PRs.** The governance contract is docs, and docs decay under 99 authors-worth of drift. Make it mechanical: a CI lint gate — hardcoded-hex ban (share-card raster subtree excepted), border-radius allowlist (4px / 999px / 50%), zero-blur shadow check, `prefers-reduced-motion` presence — plus the soft-element-budget checklist in the PR template, plus a screenshot identity audit against reference frames every ~15 merged PRs.
6. **A11y/perf drift.** `a11yContracts.test` + reduced-motion is stated as a per-PR gate — wire it into CI so it cannot be skipped, and add one perf smoke (input latency on a scorer tap on a throttled profile); `clamp()` mega-numerals + pulses + the motion kit will meet low-end devices eventually.
7. **Thesis staleness.** By M3 the app will have real users of the M1 loop. The milestone checkpoints should consume the instrumentation from A (missing bet) — re-plan M3's social/teams ordering on observed behavior, not the July plan.

---

## D. RANKED IMPROVEMENTS (highest leverage first)

1. **Hoist a minimal confirm-on-discard hotfix to position 0** — a standalone ~50-line PR before the foundation train; the live data-loss trap must not wait behind 34 reskins. PR #35 remains the full unified-End UX.
2. **Add output-schema validation gates to every generative workflow stage** (reject placeholder/"See above.", min-length, file:line-citation checks; fail loudly, auto-retry once). Evals should catch judgment errors, never mechanically-detectable blanks.
3. **Resolve Q1 (canonical live worktree) and Q6 (green hue) now; file all 7 open questions as kernel blocking issues** with edges to the first prOrder position each gates. Start rebasing the chosen live stack every ~10 merged PRs.
4. **Make blend governance mechanical:** CI lint gate (hex ban, radius allowlist, zero-blur shadows, reduced-motion) + a11yContracts in CI + soft-element-budget PR checklist + screenshot identity audit every ~15 PRs.
5. **Add an M1 activation-instrumentation issue** (start → score → match-end → share funnel) so M2/M3 checkpoints re-plan on data.
6. **Run foundation PRs 1–7 serial with maximum review, then freeze the token/component API** (additive-only + contract tests) before fanning out — protects the 27/23/20-issue fan-outs.
7. **Build-phase orchestration:** worktree-per-agent, WIP ≤ 4, merge-train next-at-bat only, one shepherd poller, screenshot verification on every visual PR, CI-green (not local) as "ready".
8. **Next screen-scale workflow: triage before verify** — deep adversarial verify for the ~20 high-stakes screens, batched verify for simple ones (~40% token cut at equal catch-rate).
9. **Move kernel filing off the cloud-synced FS** (or batch CLI operations) — 6s spawns × 3 passes is pure friction at 99-issue scale.
10. **At the M1 checkpoint, review the cut-candidates** (dev showcases ×2, basketball engine, Generic-live rebuild) and spike the friends + event-log schemas as design docs to de-risk M3 early.

---

**Bottom line:** the plan is strategically sound — M1 targets the activation loop and safety on zero new backend, the empty-shell discipline holds, and the blend thesis is enforceable, not aspirational. The process produced a materially better plan at each layer and its one failure (silent degenerates) has a cheap deterministic fix. Execute improvements 1–3 before the first foundation PR merges.
