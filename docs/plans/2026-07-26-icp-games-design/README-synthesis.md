# ScoreEasy — Cross-Game Design System & Shared Blend Rubric

**Date:** 2026-07-26 · **Status:** SYNTHESIS (distilled from the 7 non-cricket bespoke briefs) · **Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `BLEND-GOVERNANCE.md` (FROZEN) + cricket `blend-rubric.md`.

**Purpose.** The 7 briefs (kabaddi, volleyball, badminton, football, basketball, throwball, kho-kho) each re-derive the same shell, tokens, rubric, and surface anatomy from cricket. This document factors out what is genuinely shared so the 7 games do **not** each reinvent it — one screen skeleton set, one component + token contract, one build sequence, one list of decisions to make once. Cricket is the frozen exemplar underneath all of it: *the record is brutalist, the conversation is soft; detail-by-surface (scorer lean, spectator/scorecard richer).*

**The one structural truth every brief agrees on:** every game = a pure single-source-of-truth engine `derive(log, format)` (cricket's `deriveInnings`/`deriveChase` pattern), with 4 presentation surfaces reading off it and never recomputing. The log + format is the only persisted truth; LIFO undo and edit-past-replay-forward fall out of that. **All divergence between games is (1) the scoring MODEL inside the engine and (2) the primary-action verb set on the scorer.** Everything else is shared.

---

## (a) Reusable screen skeletons — the 4 surfaces, and where each game diverges

Every game ships the same four surfaces. The skeleton is identical; only the marked divergence slot changes.

### Skeleton 1 — SETUP (soft / HiFi conversation)
**Shared spine:** team labels (blank-tolerant → "Team A/B", colour/section names fine) → optional roster that **never blocks the whistle** (quick-add mid-match) → **named preset cards** that set every default in one tap → progressive-disclosure "Custom / More options" exposing house-rule toggles → toss / first-possession one tap → **plain-English confirmation-echo card** → primary CTA that **names the outcome** ("Start match → Set 1 to 15", not "Next").

| Game | Diverges only in *what the presets configure* |
|---|---|
| Volleyball / Throwball / Badminton | set target, win-by-2, deuce cap, best-of-N, **per-set + deciding-set target**, timeouts; badminton adds singles/doubles (drives serve engine) |
| Basketball | **5×5 vs 3×3 variant fork** → squad, periods (2/4)+length or target-score, shot-clock on/off, detailed-fouls on/off, bonus/foul-out thresholds |
| Football | **11/7/5-a-side format** → half length, squad, rolling-subs, cards on/off, assists on/off, stoppage, ET/shootout availability |
| Kabaddi | half length + count (or points-target), do-or-die trigger (2/3), bonus eligibility (6+/7), super-tackle value, raid-clock, technical-points toggle |
| Kho-Kho | preset (college/school/league) → players/side, turn length, turns/innings, dream-run threshold, special-skill points on/off |

### Skeleton 2 — SCORER (hybrid: hard record hero, soft controls; the make-or-break surface, kept LEAN)
**Shared spine (top→bottom, weight descending toward the thumb):** pinned brutalist **record hero** (`flex:none`, mono tabular scores + context subtitle) → a **record-strip** (the "over-strip" analogue, always renders all slots, dashed for future) → **primary action zone in the bottom thumb zone** (most-tapped lowest, ≥58px `clamp(58px,11vh,74px)`, borderless soft keys over a hard grid) → **permanently-visible LIFO Undo** square (`--se-color-surface-warm`, never buried) → rare/secondary actions **visibly one tier down** (ghost chips) → non-scrolling `100dvh` column, press physics only (`:active` translate + shadow collapse over `--se-motion-standard`), **Guided default + Power toggle** (per-device, both write the same engine event).

**This is the only surface where games are genuinely different — two divergence slots:**

| Game | Record-strip (over-strip analogue) | PRIMARY ACTION verb set |
|---|---|---|
| Volleyball / Throwball | set-box strip | two big **Point→Team** targets; serve derived, end-switch handoff |
| Badminton | set-box strip + games pips | two full-height **arena tap-zones** + **serve/court (R/L) indicator** (the signature element) |
| Basketball | quarter-by-quarter strip + BONUS stamp | two mirrored **point-value columns** (`+2` hero, `+3`/`+1`; pad **reshapes** 5×5↔3×3) + FOUL tier |
| Football | **event timeline on a minute axis** (⚽🟨🟥⇄) | **GOAL×2 → attribution micro-flow** (scorer/assist/type) + card/sub/clock tiers |
| Kabaddi | **mat-strength dolls** (7 cells/side, filled=on-mat, dashed=out) | **raid resolver**: TOUCH(+N)·BONUS·TACKLE·EMPTY·OUT/FOUL |
| Kho-Kho | **batch tracker (3 dots) + turn clock** | single full-width **OUT bar** + turn Start/Pause |

### Skeleton 3 — LIVE / SPECTATOR (soft broadcast; richer than scorer; read-only)
**Shared spine:** `--se-blend-green-wash` hero (green = lead/live only) → record-strip **read-only + richer** → **momentum / point-run band** (CSS-only bars, semantic-encoded, **no library, no axes**) → **typed-outcome event feed** (elevation-signalled: notable = soft white card + hard status stamp; ordinary = bare row) → **one signature moment** (single gold/screen) → **presence + reactions first-class** (viewer count in chrome, capsule reaction pills, Following) → **LIVE pulse on the dot only** → tabs **LIVE · SCORECARD/BOX · INFO** (capsule segmented, one language).
**Diverges only in:** momentum semantics (point-run for sets; run/lead-change for basketball; **dream-run tension band + cross-turn chase-equation** for kho-kho; mat-strength animation for kabaddi) and the peak moment (§ below).

### Skeleton 4 — SCORECARD / RESULT (hybrid: brutalist grid, soft container; richer)
**Shared spine:** plain-English result + margin ("won by 8", "3–1", "won 4–3 on pens") → **per-unit grid** (mono, columnised) → per-player table (opt-in, only when roster+enrichment captured) → **one gold milestone card** (result / Player-of-the-Match) → **Share + Rematch** CTA pair.
**Diverges only in:** the grid unit (set-by-set / quarter / per-turn / per-raid) and the stat taxonomy.

### Mandatory 5th surface for the turn/set/period games — HANDOFF
Set-switch (volleyball end-switch + deciding-set-8), period-advance (basketball), half-time/stoppage (football), turn-break/role-swap (kho-kho), half-time/all-out (kabaddi). **Same pattern every time:** full-screen **soft** step, canvas → `--se-color-surface-warm`, hero pinned, confirmation-echo restating state, single outcome-naming CTA, **no modal**. Absent from the generic scorer in every brief — must be a designed, shared step. Only sports with no break (single-set-to-N knockouts) skip it.

---

## (b) Shared component + token contract — build ONCE, theme per game

### Token contract (universal, non-negotiable, verbatim from cricket/mono)
**No new colours in any game.** Strictly `--se-*` / `--se-blend-*`, no raw hex. The frozen laws that hold across all 7:
- **Green** (`--se-color-action`, `--se-blend-green-wash`) = **lead / live / primary-action only**. Never behind a losing/defensive/out/foul state.
- **Gold** (`--se-blend-gold`) = **exactly one milestone per screen** (result / POTM / signature peak).
- **State = the escalation ladder ONLY:** neutral → `--se-color-warning-soft/warning` → `--se-color-danger-soft/danger` → single inversion. Never a new hue, glow, or text-shadow for state. (Deuce, set/match point, do-or-die, foul-trouble, final-minute, red card all ride this one ladder.)
- **Per-screen hardness budget:** 1 hard border + 1 hard shadow (outer shell only), ≤3 soft surfaces, ≤1 gold, ≤1 glow (primary CTA), ≤1 inversion, ≤1 live pulse.
- **Type law:** every quantity mono tabular; player names **sans, sentence-case, ≥12px — never uppercase a human**; status stamps ≤3-word uppercase-mono.
- **Motion:** `--se-motion-standard`, reduced-motion gated, nothing decorative moves; press physics is the only control motion; pulse reserved for genuine live.

### Component contract (the shared library — 12 primitives, parametrized, not re-authored)
1. **`RecordStrip`** — the over-strip generalisation. Slot-chip grammar: completed = filled semantic, current = outlined, future = **dashed hairline slot** ("always render all slots"). Parametrized by slot type: set-box / quarter / turn / batch-dot / mat-cell / games-pip. *This is the single highest-reuse component — every game needs it and every brief re-specs it.*
2. **`ScoreHero`** — mono tabular numerals (big, weight ~500) inside a `--se-blend-green-wash` soft-radius container **with NO hard border of its own** (shell carries the one frame — repeating it is the named "triple-frame" violation). Optional serve/possession marker slot.
3. **`ThumbKeypad`** — borderless soft keys over a hard grid, ≥58px, press physics. Parametrized by the game's verb set (2 point targets / value columns / raid resolver / OUT bar / GOAL+attribution).
4. **`Undo`** — surface-warm LIFO square, permanent, one tap reverses the last event *and* everything it derived (serve/set-close/send-off/revive).
5. **`PresetSetup`** — named preset cards + progressive-disclosure custom toggles + **confirmation-echo card** + outcome-naming CTA.
6. **`HandoffScreen`** — full-screen soft canvas-warm decision, hero pinned, restate + one CTA, no modal.
7. **`MomentumBand`** — CSS-only semantic bars, no library, no axes.
8. **`EventFeed`** — elevation-signalled rows (bare tick vs soft card + hard typed stamp).
9. **`GoldMilestoneCard`** — 2px `--se-blend-gold` + `3px 3px 0` ink shadow, soft interior, **sans headline + mono figures line** (never an uppercase-mono headline).
10. **`SpectatorShell`** — LIVE/SCORECARD/INFO capsule tabs, presence + reaction primitives, single live pulse.
11. **`MatchResult` trio** — `MonoMatchResult` / `Scorecard` / `Share` (reuse cricket's).
12. **`ModeToggle`** — Guided/Casual default ↔ Power/Detailed, per-device, one engine underneath.

### Engine contract (shared shape, per-game brain)
`derive(log, format)` pure fn · UI reads only · LIFO undo + edit-past replay-forward · log+format = only persisted truth · schema-complete up front (fold all breadth now so the model never churns even when the default preset uses a fraction). **Two generic tournament wrappers stay unchanged** — `GenericSetsTournament` (sets games) and `GenericGoalsTournament`/points-standings (football, basketball, kabaddi, kho-kho feed a final integer per match). Only the *match interior* is bespoke in every game.

---

## (c) Recommended build sequence — most-shared-with-cricket + highest ICP first, ascending build cost

The ordering principle: **build the shared SET engine once and harvest three games, then the config-heavy counters, then the fully-bespoke possession/turn engines.** This front-loads reuse, ships the highest-ICP rally sports first, and is risk-ascending (net-new logic grows down the list).

| # | Game | Why here | New engine work |
|---|---|---|---|
| 0 | **Shared SET engine** | prerequisite; one engine → 3 games | rally-point, win-by-2 + cap, per-set/deciding target, best-of-N, serve/side-out derive, single-set (bo1) |
| 1 | **Volleyball** | highest-value rally sport; validates the SET engine; end-switch/deciding-8 | + rotation (formal), timeouts, end-switch handoff |
| 2 | **Throwball** | near-free on the SET engine (volleyball minus rotation); women's staple, high ICP | almost none — themed volleyball; simpler serve |
| 3 | **Badminton** | SET engine + the one genuinely new derived layer | **serve + service-court (R/L) parity**, doubles rotation, change-ends-at-11 |
| 4 | **Basketball** | themed counter, not a new possession model; 3×3 is the college default | typed 1/2/3 events, 5×5↔3×3 fork, periods, team-foul→bonus, player-foul-out |
| 5 | **Football** | event-attribution engine; deep but very high ICP | goals-with-attribution, cards→send-off ladder, subs+minutes, halves/stoppage/ET/shootout, own-goal semantics |
| 6 | **Kabaddi** | fully bespoke possession engine; most net-new after cricket | raid engine: out/revive queues, do-or-die, all-out +2, super-tackle, point taxonomy |
| 7 | **Kho-Kho** | fully bespoke turn engine; India-native, narrowest but culturally strong | turn/role model, batch-of-3 recycle, cross-turn summation, dream-run survival timers |

**Rationale in one line:** items 1–3 share a single engine (biggest leverage in the whole program); 4–5 are attribution/counter models that reuse the shell but need their own brains; 6–7 are the two genuinely new mental models and belong last.

---

## (d) Cross-game inconsistencies & gaps to resolve ONCE (before per-game build)

Every brief carries these as its own open question — they must be decided globally, not 7 times:

1. **The SET engine must be ONE engine, not three.** Volleyball, throwball, and badminton each spec their own `deriveSet` with identical win-by-2 / cap / deciding-target logic. **Highest drift risk in the program** — mandate a single shared engine (item 0 above) or the three will diverge.
2. **Offline / multi-device conflict policy** — *every* brief defers this to "cricket's open decision." Decide once (single authoritative scorer device vs op-log merge) and apply to all.
3. **Crest vs initial in the header** — inherited unresolved from cricket Wave-0 by football/kabaddi/throwball. Decide once.
4. **Mode vocabulary is inconsistent** — cricket "Guided/Power", throwball "one-tap Power-ish default", basketball "casual/detailed", kho-kho/kabaddi "college default / league", volleyball/football "casual / formal". **Unify to one pair** (e.g. *Casual default ↔ Detailed*) so it reads as one concept across games.
5. **Handoff skippability** — volleyball asks "force end-switch or auto-skip for a PE teacher who won't switch ends?"; others assume mandatory. Standardise: **mandatory-but-fast, skippable-per-preset** for casual formats.
6. **Serve/possession marker prominence** — badminton makes it central, throwball asks whether to demote it to spectator-only, volleyball derives it silently. One shared `possession marker` component with a per-game prominence prop.
7. **Clock authority** — raid-clock (kabaddi), shot-clock (basketball), turn-clock (kho-kho) all ask "advisory or enforcing?". **One policy: clocks are advisory, never auto-score.**
8. **Roster-optional + quick-add-mid-match** — all agree roster is optional; football ("Unknown #7"), basketball (back-fill), kabaddi (placeholder players) each spec it separately. One shared quick-add / graceful-degrade pattern.
9. **Per-player stat depth for v1** — all defer attribution to "formal/detailed/future." Fix one line: **v1 ships team-level derivations; per-player is opt-in behind a roster + Detailed mode**, everywhere.
10. **Points-standing + tie-break for the non-goal bespoke games** — kabaddi and kho-kho feed a points standing with a single integer per match; confirm the generic wrapper accepts it and lock a tie-break default (kho-kho especially: fewest defenders lost / least time conceded).

---

## (e) Bespoke scoring MODEL vs themed generic scorer

The real classification the program hinges on — how much of the *scoring brain* is genuinely new versus a themed skin over a shared primitive:

| Tier | Games | Verdict |
|---|---|---|
| **Themed generic scorer** (one shared **rally-point SET** engine, themed per game) | **Volleyball, Throwball, Badminton** | The atomic event is "point to one of two teams." One SET engine serves all three; the theming is targets/serve/rotation. Badminton adds the only non-trivial derived layer (service-court parity + doubles) but it's still the same primitive. **Do NOT build three engines.** |
| **Config-heavy themed counter** (typed events over a running total; reuses shell, needs its own brain) | **Basketball** | Not a new possession model — a counter with **1/2/3 values + periods + two foul counters + bonus + a 5×5/3×3 pad reshape**. Bespoke engine, but conceptually a themed points counter, not a new mental model. |
| **Event-attribution model** (score is a derived total of attributed events) | **Football** | Bespoke, but the novelty is *attribution* (scorer/assist/minute/type), the **card→send-off ladder**, subs+minutes, and the clock lifecycle — not a new possession structure. The team score must never be a raw input. |
| **Genuinely bespoke possession / turn model** (no generic analogue exists) | **Kabaddi, Kho-Kho** | Kabaddi's **raid** (possession event with out/revive rosters, do-or-die, all-out, super-tackle, point taxonomy) and Kho-Kho's **turn** (chaser/defender roles, batch-of-3 recycle, cross-turn summation, dream-run survival timers) are new mental models the generic tally/counter cannot represent at all. **This is where the real engine work lives** — and why both are built last. |

**Bottom line for (e):** genuinely bespoke MODEL = **kabaddi + kho-kho** (new possession/turn logic), with **football + basketball** a middle tier (bespoke engines but not new mental models); **volleyball + throwball + badminton** are a themed generic **sets** scorer over one shared rally-point engine.
