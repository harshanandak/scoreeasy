# ScoreEasy — Cricket Scorer UX (LOCKED v2, post-comparison + edge-audit)

**Date:** 2026-07-20 · **Status:** LOCKED for build · **Supersedes** `cricket-spec.md` on UX-mode choice + edge rules (v1 stays authoritative on tokens, demo state, signature moments, and the C1–C13 build sequence except where amended in §D below).
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN).

This document folds the three-way scorer-UX comparison and the two-part edge-case audit into one locked decision. The canonical demo state (Mumbai 147/4 · 17.2 · need 23 off 16 · RRR 8.6) and all §0/§4/§6 rules of `cricket-spec.md` carry forward unchanged.

---

## A. Decision — the UX we ship

**GUIDED is the default surface. KEYPAD-POWER is a one-toggle fast lane. GESTURES do not ship as an entry mode.**

Both shipping modes write the **same `Delivery`** through the **same C1 engine** — mode is a presentation choice over one source of truth, never a data fork. A "MODE" toggle in the scorer header flips Guided ⇄ Power; the choice is remembered per device and per match.

### Why (grounded in the ICP)
Casual school/gully scorers **dominate** the ICP; a minority of experienced club/league scorers exist. The user's explicit ask is *the easiest user path*.

- **Guided wins the default** because it is *structurally* hard to mis-score (runs / extras / wickets live on separate screens — you cannot fat-finger a wide into a wicket), it *teaches the rules while scoring* (post-ball narration), and it *auto-handles every piece of cricket math* (strike, legal-ball count, extras-to-team, free-hit, balls-faced). Common balls stay **1 tap**; the speed penalty only lands on genuinely complex events that deserve care. That is the easiest path for the dominant persona — and, per the audit, it is the **only** option whose run-out sub-flow already captures *completed runs*, which the engine needs to derive strike-after and new-batter end.
- **Keypad-power is the toggle, not the default** because the power-scorer is real but the minority. A dense CricHeroes-style board is the fastest deterministic ledger for a 40-over-at-pace expert and directly meets the market bar — but its density and armed-modifier semantics are hostile to a first-timer. Offer it, do not default to it.
- **Gestures are dropped as an entry mode.** Double-tap=4 / swipe=6 is the fastest 80%-case *and* the worst on the two axes that matter most for a ledger: discoverability (invisible until taught) and error-recovery (a stray double-tap logs a phantom four, a misfired swipe a phantom six). A scoring ledger must be deterministic; an entry model that silently fabricates boundaries is disqualifying as a primary path. Its one genuinely unique asset — **free wagon-wheel/placement capture from tap position** — is preserved as an *optional* tap-to-place enrichment layered onto boundary entry in Power mode (deferred, `wagon` field already in the model), not as a third mode to maintain and teach.

### Score table (1–5)

| Option | Speed(exp) | Learn(casual) | Err-recov | Market-bar | Fidelity | Edge-robust | 1-handed | Why (one line) |
|---|---|---|---|---|---|---|---|---|
| **Guided (default)** | 2 | 5 | 5 | 3 | 4 | 5 | 4 | Structurally un-fumbleable, teaches as it scores, auto-math; only option that captures run-out completed-runs; slow on non-run events |
| **Keypad-power (toggle)** | 5 | 2 | 3 | 5 | 4 | 4 | 3 | Fastest deterministic ledger + full data density = the CricHeroes bar, but dense/armed semantics punish novices and single-tap auto-commit leans on Undo |
| **Gestures (not shipped)** | 4 | 2 | 2 | 3 | 5 | 3 | 5 | Fastest 80%-case + free wagon data + cleanest shell, but invisible controls and phantom-boundary risk disqualify it as a deterministic ledger |

---

## B. Canonical mockup to render

- **Default / primary:** `cricket-ux-guided.html` — the canonical scorer surface for build.
- **Power toggle:** `cricket-ux-keypad.html` — the canonical Power-mode surface.
- **Retired as an entry mode:** `cricket-ux-zones.html` — kept only as the reference for the optional tap-to-place wagon layer; not built as a scoring path.

Both shipped mockups already render the single canonical state (147/4 · 17.2), design1-mono tokens, one gold, one live pulse, reduced-motion gating.

---

## C. Edge-case fixes that MUST land (C1 engine + scorer UI)

Grouped by where they live. **Bold = criticalGap from the audit — a build blocker.**

### C1 engine (data model + invariants)
1. **Overthrow entry.** Replace the single run key on boundary-with-overthrow: capture `{batRuns, overthrowRuns, reachedBoundary, offBatOrExtra}`. Corrects the batter's 4s/6s tally, team-vs-batter credit, and which signature fires. *(Today tapping "6" fabricates a clean SIX.)*
2. **Multi-component extra.** Retire single `extra:{type,runs}`. Model a **penalty component** (wide/no-ball) that can coexist with a **bye/leg-bye component** on one delivery (`no-ball + 2 leg-byes`, `byes off a wide`, `wide + leg-bye`). Keep per-component striker-`B` rules.
3. **Illegal-dismissal guard keyed to the delivery, not free-hit.** RUN-OUT-ONLY (auto-revert on any other type) must arm on **any no-ball**, regardless of `freeHitOnNoBall` (test/gully configs have no free hit but still forbid bowled/caught/stumped off a no-ball).
4. **Capture `completedRuns` on every run-out** (all modes, not just Guided). Derive survivor's end + new-batter's end + last-ball-of-over compounding from it.
5. **New-batter end on caught.** Capture *"did the batsmen cross?"* on a catch; engine derives whether the incoming batter is on strike or at the non-striker's end (plus last-ball-of-over flip).
6. **Last-man-stands mechanics.** When `wkts == playersPerSide-1` under `lastManStands`: **suppress** auto strike-rotation and end-of-over swap (no non-striker exists); define `singleBatterRuns` run-legality (are singles legal / on-side only).
7. **Wicket off a wide/no-ball.** Allow `extra + wicket` to coexist in the UI — armed WD/NB must branch to a wicket path restricted to **stumped / run-out**, not only a run-grid.
8. **Dead ball · Mankad · short run as first-class actions** (MORE quick-actions, not buried edits): dead-ball (no run, ball not counted); Mankad (run-out at non-striker, `legal=false`, over does not advance); short-run (`−1`).
9. **Retire, three ways.** `hurt` (not out, resumable, no wicket) vs `out` (dismissal, wkt++) vs gully forced-rotate (leaves, re-enters at end of order). Add a *resume-retired-batter* path in the new-batter picker.
10. **Penalty runs.** Add team-target selector (batting vs fielding side), no-ball-consumed = false, no strike change.
11. **Innings-break + target handoff** — a *mandatory every-match step*, absent today. Finalize innings 1 → `target = runs+1` → swap batting/bowling → pick opening pair + opening bowler → arm innings 2. `Innings.target` currently has no producer.
12. **Edit-past-delivery = replay-forward.** Editing ball N re-derives strike / pointers / free-hit from index N to head (per-delivery snapshots go stale otherwise) + a diff/confirm UI. Distinct from LIFO Undo.
13. **Mid-over bowler change** (injury/light): continue the same `overNo`, split over credit across both bowlers; neither charged a full over.
14. **Strike-composition tests.** Assert the last-ball-odd-run double-swap composes **once** (odd-swap ∘ over-swap → same batter keeps strike); wide strike uses `physical = wide.runs − penalty` and never triggers the over-boundary swap; end-of-over swap is idempotent.

### Scorer UI (both modes)
15. Wicket sheet asks **completed-runs + out-batter + end** on run-out, and **"crossed?"** on caught — port Guided's run-out capture into Power mode (Power currently prompts batter/end only).
16. Armed-extra (WD/NB) path branches to the stumping/run-out wicket flow (fix #7 surfaced).
17. Surface MORE quick-actions: dead-ball, Mankad, short-run, penalty (team target), retire (hurt/out/rotate), resume-retired.
18. **Powerplay chip** on scorer hero + spectator context row (data exists in `format.powerplays[]`, no surface renders it). `maxOutside` fielder restriction = explicitly display-only / out-of-scope.

---

## D. Delta vs `cricket-spec.md` (v1)

| Area | v1 | v2 (this doc) |
|---|---|---|
| Scorer UX | One dense line-divided keypad (§2) | **Guided default + Keypad-power toggle**, one shared C1 engine; gestures dropped as entry mode |
| Canonical mockup | `cricket-live-mockup.html` (illustrative) | `cricket-ux-guided.html` (default) + `cricket-ux-keypad.html` (power) |
| `Delivery.extra` | single `{type,runs}` | **multi-component** (penalty ⊕ bye/leg-bye) — C1 model change |
| Free-hit guard | keyed to `freeHit` (§1.2) | keyed to **any no-ball delivery** regardless of free-hit config |
| Run-out capture | `out`+`end` (FIX 10) | + **`completedRuns`** in all modes; caught adds **`crossed?`** |
| Overthrows | not modeled | dedicated `{batRuns, overthrowRuns, reachedBoundary, offBatOrExtra}` capture |
| Last-man-stands | "keeps innings live" (§1.2) | + **suppress rotation/over-swap**; define `singleBatterRuns` legality |
| Innings break | absent | **mandatory innings-break + target handoff flow** added to C1 |
| Edit-past | "edit any past delivery" (MORE) | **replay-forward** semantics + diff/confirm |
| Mid-over bowler change | end-of-over picker only | mid-over substitution with split over credit |
| Dead-ball / Mankad / short-run | buried edits | **first-class MORE quick-actions** |
| Retire | generic "retire" | **hurt / out / rotate** with resumable + re-entry |
| Powerplay | in model, no surface | **PP chip** on hero + spectator |

**Build-sequence impact:** the above land inside **C1** (engine breadth grows — keep effort L, but the multi-component extra, overthrow, completed-runs, and innings-break are net-new invariants for the §1.2 test spec). The scorer UI split (Guided default + Power toggle) means **C4 becomes two presentation layers over one keypad/flow contract**, not one board; add a small **C4b — mode toggle + Guided sub-flow shell**. Everything else in v1 §7 (C2–C3, C5–C13) is unchanged, still gated on C1+C2.

---

## E. Open decisions (carried + new)

Carried from v1 §8 and still open: **#2** win-prob formula/basis · **#3** momentum weighting · **#4** clutch threshold per-format · **#5 DLS** (par line + revised target are hand-typed; no `deriveDLS()` compute exists — display-only today).

New from this pass:
1. **Offline multi-device conflict policy** — declare a single authoritative scorer device, or an op-log merge rule for concurrent offline undos/edits. Reconcile-on-reconnect behavior undefined.
2. **`singleBatterRuns` exact legality** — on-side only? must the lone batter run alone touching both creases? Blocks fix #6.
3. **Consecutive-over prohibition** — enforce (formal cricket) vs ignore (gully). Affects the bowler picker.
4. **Default mode per house-rule preset** — do tennis-ball / box presets force Guided default, or is the toggle always free?
5. **Optional wagon tap-to-place** — ship the Power-mode tap-to-place placement layer (the salvaged gesture asset) at launch, or defer? Default = defer.
6. **Rare-dismissal bowler credit** — confirm which MORE dismissals credit the bowler (obstructing/hit-twice/timed-out/handled do not; caught/bowled/lbw/stumped do).

---

## F. Anti-goals (additive to v1 §9)
Shipping gestures as a deterministic scoring path · defaulting to the dense keypad for the casual ICP · a single-typed `extra` that can't represent compound deliveries · a free-hit-only illegal-dismissal guard · deriving strike after a run-out without completed-runs · treating innings-break as an edge case · edit-past that leaves downstream snapshots stale.
