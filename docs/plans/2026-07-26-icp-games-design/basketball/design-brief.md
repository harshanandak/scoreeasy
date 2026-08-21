# ScoreEasy — Basketball Design Brief (BESPOKE)

**Date:** 2026-07-26 · **Status:** DESIGN BRIEF (no code, no mockups) · **Market:** Indian college / university / school / ground scorers.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `BLEND-GOVERNANCE.md` (FROZEN) · **Rubric:** `../cricket/blend-rubric.md`.
**Method:** follows the cricket exemplar — one engine underneath, presentation-only surfaces on top, *detail-by-surface* (scorer lean, spectator/scorecard richer), and **THE RECORD IS BRUTALIST, THE CONVERSATION IS SOFT**.

Grounding on what exists today (`src/designs/design1-mono/`): basketball currently falls through to the **generic "goals" scorer** — `MonoLiveGame.jsx` gives one `+/-` button per team over a single `pointIncrement` (default 1) with LIFO undo; `GenericGoalsTournament.jsx` stores a single integer `score1`/`score2` per match with goals-for/against standings. It has **no concept of 1/2/3-point values, quarters/halves, team or player fouls, bonus/free-throws, shot clock, timeouts, or player box scores.** Basketball needs a bespoke engine + surfaces, not a re-skin.

---

## 1. Scoring model + India / college nuances

### Core model (must be first-class in the engine)
- **Point values are the fork that breaks the generic scorer.** A basket is worth **1** (free throw), **2** (field goal inside the arc), or **3** (behind the arc). The generic single-increment model cannot represent this — the engine must record each **scoring event** as `{team, playerId?, value: 1|2|3, kind: 'ft'|'fg'|'three', quarter, gameClock?}`.
- **Two structural variants, chosen at setup — this is the biggest engine branch:**
  - **5×5 full-court:** values **1 / 2 / 3**; **4 quarters** (FIBA 10 min; Indian schools often run 2 halves or shorter 8-min quarters); **team fouls per period → bonus** (5th team foul in a period = 2 free throws); **player fouls out at 5** (FIBA) — bench-critical; 24-sec shot clock; timeouts.
  - **3×3 half-court (the dominant college-fest variant):** values are **1 and 2 ONLY** (inside arc = 1, behind arc = 2 — *there is no 3*); **single period**, first to **21** OR **10-minute cap**; **12-sec shot clock**; team fouls → free throws from the **7th** (7/8/9 = 1 FT + ball back rules vary), **10th = 2 FT + possession**; no quarters, no fouling-out by the same count. The scorer's **+2 button is the +3 slot's absence** — the keypad literally changes shape between variants.
- **Free throws** produce 1 point each and are their own event kind (drives bonus math and FT% stats). Casual scorers frequently under-record these — the flow must make logging an FT as cheap as a field goal, or let them log the *net* points if they skip attribution.
- **Fouls are two independent counters:** **team fouls** (reset each period, drive the bonus) and **player fouls** (accumulate all game, drive foul-out). Both matter to the ICP: bonus changes how the game is played; foul-out changes the bench.

### India / college / ground nuances (what actually happens on our grounds)
- **No clock/table crew.** College fest and school games rarely have a dedicated shot-clock operator or a table official. **The shot clock is usually not enforced** and the game clock is often a phone timer or the ref's whistle. → shot clock and even the running game clock must be **optional / off by default**, never a required field to advance scoring.
- **3×3 is the college default.** Inter-college fests, hostel leagues and society courts overwhelmingly play half-court 3×3 to 21/11 or winner-stays. Treat 3×3 as a **peer setup preset, not an afterthought** — arguably the more common casual match.
- **Halves vs quarters vary by institution.** Schools often play 2 halves (or 4 short quarters); the setup must let the scorer pick **periods (2 or 4) and length**, not assume FIBA 10-min quarters.
- **Free-throw rigor is low.** Many casual scorers just add "2" when someone scores and shrug at and-1s. The default fast path must be forgiving; strict bonus/FT tracking is an opt-in "detailed mode."
- **Player attribution is optional.** At a gully or hostel game there may be no roster — teams are "Skins vs Shirts / A vs B." The scorer must run **without a roster** (team-total only) and *upgrade* to per-player stats when a lineup exists.
- **Winner-stays / first-to-N house rules** are common on single-basket courts → target-score and win-by-2 are house-rule toggles.

---

## 2. Screens needed

| Screen | Must do |
|---|---|
| **Setup** | Pick variant (**5×5 / 3×3**) → this drives everything; team names/colours (+ optional rosters, "add later" allowed); periods (2/4) + length OR target-score (3×3: first-to-21/11, win-by-2 toggle); toggles for **shot clock on/off**, **detailed fouls/FT tracking on/off**, house rules (bonus threshold, foul-out count). Presets: *College 3×3*, *School 5×5 (halves)*, *FIBA 5×5*, *Gully / winner-stays*. Should be finishable in ~15 s for the casual case (name two teams → Start). |
| **Scorer** | Operator console. Big score hero (team A — team B) with quarter/period + optional clock; **thumb-zone scoring pad** whose primary keys are the point values; foul logging; timeout; undo always visible; optional shot-clock control; period-advance handoff. Runs one-handed. |
| **Live / Spectator** | Lean-back broadcast. Score hero with lead/run context, quarter-by-quarter line, team-foul/bonus state, player-in-foul-trouble callouts, signature moments (buzzer-beater, big run), reactions + viewer count. Read-only. |
| **Box score / Scorecard** | The record. Per-team totals by quarter; **per-player box** (PTS / fouls / 1-2-3 splits / FT); team fouls per period; lead-changes / biggest-lead; final result + share. Reused (richer) inside spectator as a tab. |
| **Match complete** | Result peak — final, margin in plain language, top scorer(s), one gold milestone card, share + rematch. |

---

## 3. Scorer interaction design (operator-lean)

**Principle (rubric class 3):** a machine operated under pressure — hard grid, mono digits, weight ladder brutalist; touch surfaces ergonomic and calm. Most-tapped sits at the **bottom in the thumb zone**; the record (hero) stays pinned at the top.

- **The pad is two mirrored team columns** (left team / right team), because the single most-frequent action is "*this* team just scored *this* many." Each column's **primary keys are the point values**, largest and lowest in the column:
  - **5×5:** `+2` (biggest key, most common) · `+3` · `+1 (FT)`.
  - **3×3:** `+1` and `+2` only — the pad **reshapes** (no +3), and +1 is promoted because inside buckets dominate 3×3.
- **`+2` is the hero key** (analogous to cricket promoting 4/6): larger target, `--se-color-action-soft` fill + action digit. `+3` gets a subtle tint; `+1 / FT` is a tier down (ghost). Each key: mono numeral + tiny tracked caption (`2 PTS` / `THREE` / `FT`).
- **Weight descends with frequency (top→bottom of each column):** score values → **FOUL** (on this team) → **timeout** → (detailed mode) rebound/turnover behind a MORE. Fouls and non-scoring events must **look one tier down** from scoring, same as cricket extras.
- **Player attribution is a fast optional layer, never a gate.** Default: tap `+2` → point lands on the team total instantly. If a roster exists, tap-and-the-key **momentarily reveals a jersey-number chip row** (capsule pills) to attribute the bucket; ignore it and it auto-commits to the team after a beat. Same "hard skeleton, soft skin" split — instant team record, optional soft attribution conversation.
- **And-1 / foul-then-FT** handled as a short guided micro-flow in detailed mode (log the make → "shooting foul? → 1 FT"), echoing the choice before commit. In casual mode, just tap `+1` for the made FT.
- **Undo** is a permanently visible square beside the pad (LIFO, reuses the generic `undoLastScore` history idea) — never buried. Every scoring event is one undoable unit.
- **Period advance is a handoff, not a silent tick:** at end of quarter/half the scorer confirms on a soft full-screen step (reset team fouls, swap ends if tracked, "Start Q3 →"). 3×3 has no period handoff — instead a **target-reached / time-cap** end step.
- **Shot clock (optional, off by default):** if on, a compact mono countdown chip near the hero with tap-to-reset (24/14 in 5×5, 12 in 3×3); it never blocks scoring. Bench for launch if it adds table-crew burden — future-flag the enforced version.
- **Press physics only:** `:active` translate 1–2px + collapse to `--se-shadow-card`. No decorative motion on controls.

**Primary actions, ranked:** `+2` (each team) › `+3` (5×5) / `+1` (3×3) › `+1 FT` › `FOUL` › `UNDO` › `TIMEOUT` › period-advance.

---

## 4. Live / spectator design (richer)

**Principle (rubric class 9):** keep only the hard outer shell; interiors soften to hairlines and soft cards.

- **Hero:** `--se-blend-green-wash`, big mono scoreline `A — B`, lead pill ("+8"), and a **run/momentum line** in plain language ("Rohit College on a 9–0 run"). May take the screen's single inversion for the drama variant.
- **Quarter-by-quarter strip** (record notation, class 4): a fixed row of per-period mini-scores `18 · 12 · 20 · —` for each team; current period highlighted, unplayed periods as dashed slots (mirrors the cricket over-strip's "always render all slots").
- **Foul / bonus state, first-class:** a compact team-fouls indicator that flips to a **BONUS** badge (hard status stamp) when a team crosses the threshold — this is the most game-relevant live signal after the score. Players in foul trouble (4 fouls) surfaced as a soft callout.
- **Signature moments:** buzzer-beater at period end, a big scoring run, a player reaching a scoring milestone (e.g. 20 pts), and the final. Reactions (capsule emoji + mono count), viewer count in the chrome, live pulse on the LIVE dot only.
- **Tabs (capsule segmented, one language):** LIVE · BOX SCORE · INFO — same anatomy as cricket spectator.

---

## 5. Blend direction for basketball (tokens, not new colours)

Keep the minimal-brutalist palette + green accent. **No new hues** — encode everything via the existing `--se-*` / `--se-blend-*` tokens and the escalation ladder (neutral → `warning-soft` → `danger-soft` → inversion).

- **Record is brutalist:** the outer shell (one `--se-border-standard` + one `--se-shadow-hard`), all **mono tabular numerals** (scores, point values, fouls, clock, quarter splits), the quarter strip chips, the BONUS / foul status stamps (hard squarer rectangles), player names in **sans sentence-case ≥12px — never uppercase a human**.
- **Conversation is soft:** setup, period-handoff, and-1/foul flows, empty/help/roster-missing states → sentence-case sans, soft radius, tinted inline banners, canvas shift to `--se-color-surface-warm`, confirmation-echo, outcome-naming CTAs.
- **Green (`--se-color-action` / `--se-blend-green-wash`) = live/lead only** (governance rule 1). The score hero container is the green-wash lead surface; the `+2` hero key uses `action-soft`. Never green behind a foul/foul-out — those ride `--se-danger-soft` / `--se-warning-soft`.
- **Per-screen budget holds:** 1 hard shadow + 1 ink frame (shell only), ≤3 soft surfaces, ≤1 gold (milestone/result card only), ≤1 glow (primary CTA), ≤1 inversion, ≤1 live pulse.
- **The `+2` hero key + BONUS stamp + quarter strip** are basketball's identity anchors, the way the over-strip and striker-rail are cricket's.

---

## 6. Data touchpoints + stats worth capturing

**Team (always, even roster-less):** points (running + per-quarter), field goals made by value (1/2/3 counts), free throws made, **team fouls per period**, bonus state, timeouts remaining, lead / biggest lead / lead changes, run tracking.

**Per player (when a roster exists):** points (with 1-/2-/3-pt splits + FT), **personal fouls** (+ foul-out flag at the configured limit), and — in detailed mode, future-flagged — rebounds / assists / steals / blocks / turnovers. Minimum viable box = **PTS + fouls + point-type split**; the rest is opt-in.

**Derived (engine, single source of truth — analogous to cricket `deriveInnings`):** score margin, per-quarter deltas, biggest run, team-foul→bonus threshold crossing, player foul-out eligibility, FT/FG counts, and for 3×3 the **points-to-target** and win-by-2 state. Every rate/stat reads from the derivation, never stored ad-hoc.

---

## 7. Animations / signature moments

Reduced-motion gated; press physics + one live pulse are the baseline (rubric class 6/8).

- **Score pop** on the hero for every basket (reuse the existing score-pop), **tiered by value** — a `+3` gets a slightly bigger beat than a `+2` (echoes cricket's tiered four/six).
- **Buzzer-beater** signature at period/game end (score at 0:00) — a designed moment, not a takeover.
- **Big-run / lead-change** subtle emphasis on the momentum line.
- **Milestone gold card** (one gold/screen) for player scoring milestones and the final result; 2px gold border + `3px 3px 0` ink shadow anchor, soft interior.
- **Future-flagged (heavy / deferred):** shot-location / court heat-map capture (a "where from" tap layer, mirroring cricket's deferred wagon-wheel), animated run-graph, shot-clock buzzer visuals.

---

## 8. Port-vs-redesign

**Reuse (port) from the generic scorer / mono system:**
- LIFO **undo history** mechanism (`undoLastScore` / per-participant history) — extend each entry to a typed scoring event.
- The **two-participant live shell**, back-nav, and leader-highlight scaffolding in `MonoLiveGame.jsx`.
- Tournament wrapper `GenericGoalsTournament.jsx` for standings/brackets — basketball is a "points" sport at the tournament layer (final integer per match feeds standings unchanged); **only the per-match scorer is bespoke.**
- All `--se-*` / `--se-blend-*` tokens, mono/sans type law, blend rubric, shared primitives (MonoSheet, match-result trio, Convex live-sync).

**Build bespoke (redesign):**
- The **scoring engine**: typed 1/2/3 events, 5×5-vs-3×3 variant fork, quarters/periods + reset logic, team-foul→bonus, player-foul→foul-out, FT handling, target-score (3×3), derivations, adapter migration from the flat `scores{}`.
- The **variant-reshaping scoring pad** (the `+2` hero, +3 present only in 5×5), optional player-attribution overlay, foul/timeout tier, period-handoff step, optional shot clock.
- The **quarter-by-quarter strip**, **BONUS / foul-trouble** surfacing, and the **player box score**.
- Basketball spectator LIVE/BOX/INFO tabs and the match-complete result peak.

---

## 9. Open questions / product decisions

1. **3×3 as a top-level setup peer vs a 5×5 sub-toggle?** (Recommend peer — it's the dominant college variant and reshapes the pad.)
2. **Shot clock at launch:** ship as optional-off display-only, or defer entirely? (ICP grounds rarely have a clock operator — lean defer/optional.)
3. **Detailed stats depth for v1:** PTS + fouls + point-split only, or include rebounds/assists/turnovers? (Recommend minimal first; rest future-flagged.)
4. **Roster-less default:** confirm the scorer must run with zero roster (team-total only) and upgrade in place — how are stats back-filled if a roster is added mid-game?
5. **Bonus / foul-out rule set:** hard-code FIBA (5 team fouls → bonus, 5 personal → out) or expose as house-rule toggles for school variants? (Recommend toggles with FIBA defaults.)
6. **And-1 flow:** full guided FT sub-flow vs plain `+1` tap in casual mode — where's the mode line?
7. **3×3 scoring math:** confirm 1/2 (not 2/3) internally, target 21 with win-by-2, and the 7th/10th team-foul FT rules — which are enforced vs display-only.
8. **Period model:** support arbitrary periods×length at setup (2 halves / 4 quarters / custom) — does the tournament layer need per-match variant, or is variant fixed per tournament?
9. **Shot-location capture** (court heat-map) at launch or deferred like cricket's wagon-wheel? (Recommend defer.)
