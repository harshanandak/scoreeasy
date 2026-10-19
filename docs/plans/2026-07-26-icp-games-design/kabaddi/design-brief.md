# ScoreEasy — Kabaddi Bespoke Design Brief

**Date:** 2026-07-26 · **Status:** DESIGN BRIEF (no code, no mockups yet) · **ICP:** Indian college / university / school / ground scorers (casual dominates).
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `BLEND-GOVERNANCE.md` (FROZEN) + `docs/plans/2026-07-20-icp-games/cricket/blend-rubric.md`.
**Method inheritance:** follows the cricket exemplar — one shared engine, presentation surfaces over it; *the record is brutalist, the conversation is soft*; detail-by-surface (scorer lean, spectator/scorecard rich).

Grounding note — what the generic scorer is today: `GenericGoalsTournament.jsx` is a **tournament-standings tally** (goalsFor/goalsAgainst/points table) with a single two-number match score, and `MonoLiveGame.jsx` runs a plain count-up match clock with per-tap increment + LIFO undo. Neither has any concept of a *possession* (raid), a per-raid countdown, players being **out / revived**, or point *types* (touch / bonus / tackle / technical). Kabaddi is a possession-event game, not a running tally — it needs a bespoke raid engine. That gap is the whole reason this game is bespoke, not a config over goals.

---

## 1. Scoring model + India/college nuances

### The atomic unit is the RAID, not the point
A Kabaddi match is a sequence of **raids**. Teams alternate: one team sends a **raider** into the opponent half; the opponent are **defenders**. A raid resolves into points for exactly one side (or neither), players go **out** and get **revived**, and then possession flips. Every score in the app should be produced by *resolving one raid* — this is the mental model both the engine and the scorer UI must center on. (Contrast cricket's ball; here the ball-equivalent is the raid, and it carries far more state: a live 30s timer, a raider identity, an out/in roster on both sides, and multi-part outcomes.)

### Scoring events (each must be a first-class engine outcome)
- **Touch point(s)** — raider touches N defender(s) and returns across the midline safely → **+N to raiding team**; those N defenders go **OUT**; N of the raiding team's out players **REVIVE** (in the order they went out).
- **Bonus point** — raider crosses the **bonus line** cleanly → **+1**, *only eligible when the defending side has 6+ players on the mat* (a preset-configurable threshold; some house rules require all 7). Does not put anyone out. Can co-occur with touch points on the same raid.
- **Tackle point** — defenders stop the raider from returning → **+1 to defending team**; the **raider is OUT**; one defender out-player revives.
- **Super tackle** — a tackle made when the defending side has **≤3 players** on the mat → an **extra point** (total commonly 2; the exact bonus value is a config, see §9). Auto-detected from on-mat count — the scorer never computes it.
- **Empty raid** — raider returns with no points and causes none → no score, but it **increments that team's consecutive-empty counter** (feeds do-or-die).
- **Do-or-die raid** — a team's **3rd consecutive empty raid** (2nd in some local rules) *must* yield a point; if the raider fails, the **raider is declared OUT and the opponents get +1**. The engine, not the scorer, must know a raid is do-or-die and enforce the fail penalty.
- **All-out (+2)** — when an entire side (all on-mat players) is put out, the opponents get **+2** and the emptied team is **fully revived** (all players back on the mat). Auto-detected from the out roster; never a manual "+2" tap.
- **Technical / self-out points (+1)** — line-out (raider or defender steps out of bounds), raid without cant, illegal defender entry, etc. → +1 to the other side and the offender out where applicable. Casual scorers rarely name these — surface as a single plain-English "Out of bounds / foul" branch, not jargon.
- **Super raid** — raider scores **3+ points in a single raid** (a stat/celebration tag, not a separate score).

### Derived state the engine owns (scorer must never do this math)
On-mat count per side · out-order queue per side (for revival order) · consecutive-empty counter per side (→ do-or-die) · super-tackle eligibility (≤3) · bonus eligibility (≥6) · all-out detection + auto-revive · do-or-die fail penalty · half/period clock + raid 30s clock · running score.

### India / college / ICP nuances (these drive the presets)
- **Ruleset is Standard mat kabaddi (Sanjeevani).** College (KIUG / AIU inter-university), school (SGFI) and Pro-Kabaddi-influenced ground play all use the **standard mat game**: 7-a-side, Sanjeevani revival, all-out +2, do-or-die, bonus line, 30s raid. **Circle kabaddi** (Punjab/Amar/Gaminee styles) is a genuinely different game — **out of scope for v1**, flag as a future ruleset, do not half-model it.
- **Duration varies wildly by level.** Elite/college is 2×20 min; **school and casual ground matches routinely play 2×10, 2×7, or 2×15**, sometimes points-target or single-half. Half length must be a preset field, not hardcoded.
- **Do-or-die trigger is a live local variant** — official is 3rd empty raid; some school/ground circuits play **2 empty raids**. Configurable.
- **Bonus-line eligibility** — 6+ defenders (official) vs 7-only in some house rules. Configurable.
- **Super-tackle value** — 1 vs 2 total points varies by circuit. Configurable, default to official.
- **Technical points are often skipped by casual scorers.** Provide a preset toggle "Track fouls / technical points" (default ON for college, can be OFF for a quick school game) so the scorer isn't forced through jargon it doesn't use.
- **Substitutes:** 7 on mat + up to 5 subs; casual games often ignore subs entirely. Roster subs are optional, never a setup blocker.
- **Scorer persona:** a PT teacher, a student volunteer, or a coach, scoring one-handed on a phone in sun glare beside a dusty mat, in noise, watching the mat not the screen. This is the single strongest argument for the brutalist high-contrast mono record + a guided, un-fumbleable raid resolver.

---

## 2. Screens needed

### A. Setup
Configure the match so the engine is fully armed. Must do:
- **Teams + colours/initials** (crest squircle per §5, reuse cricket's crest decision).
- **Rosters:** 7 starters + jersey numbers per team; optional subs. Roster is *optional depth* — a quick game can start with just team names and "7 players" placeholders and name players later (never block the whistle on data entry).
- **Ruleset preset picker:** `College/Standard` · `School (short halves)` · `Pro-style` · `Custom`. Preset sets the defaults below; Custom exposes them:
  - Half length + number of halves (or points-target mode), half-time break.
  - Do-or-die trigger (2 / 3 empty raids).
  - Bonus-line eligibility (6+ / 7-only).
  - Super-tackle value (+1 / +2 total).
  - Track technical/foul points (on/off).
  - Raid clock length (30s default).
- **Toss:** who raids first + which side. One tap.
- Echo the resolved config back in plain English before "Start match" (confirmation-echo, per rubric class 5).

### B. Scorer (the operator console — the make-or-break screen)
Resolve raids fast and un-fumbleably. Must do:
- Show the **live record** at a glance: both scores (mono), whose raid, the **30s raid clock**, the **out/in roster state** for both sides (the emotional core of kabaddi — how close is an all-out), do-or-die state, half + match clock.
- **Resolve the current raid** via the primary action zone (see §3).
- Auto-apply all derived math (revival, all-out +2, super-tackle, do-or-die penalty) and **narrate what just happened** in plain English so a novice trusts it ("Touch on 2 — Raiders +2, 2 defenders out, 2 of your men back").
- Always-visible **Undo** (LIFO) and access to edit-last-raid.
- Half-time / all-out / do-or-die are **surfaced by the record**, not buried.

### C. Live / Spectator
Lean-back broadcast for the crowd, WhatsApp-shared link, bench, opposing coach. Must do:
- Live score + whose raid + raid clock + **both mat-strength dolls** (7 lights per side) as the hero.
- **Raid-by-raid feed** with typed tags (TOUCH ×2, SUPER TACKLE, BONUS, ALL OUT, DO-OR-DIE).
- Momentum / run indicator, star raider & star defender, presence + reactions.
- Tabs: LIVE · SCORECARD · INFO (mirror cricket's spectator structure).

### D. Scorecard
The trustworthy post/mid-match record. Must do:
- **Per-player line:** raid points, bonus points, tackle points, total; super raids, super tackles, do-or-die conversions; **Super-10** (10+ raid pts) and **High-5** (5+ tackle pts) badges.
- **Per-team:** total, all-outs inflicted, points by type (raid/bonus/tackle/technical/all-out), do-or-die record.
- Raid-by-raid ledger (drill-in), half splits, fall-of-strength timeline (when each all-out happened).

---

## 3. Scorer interaction design (operator-lean, thumb-zone, most-tapped-at-bottom)

**Mental model = "resolve this raid".** The screen is always in one of two possession states — **RAID: Team A** or **RAID: Team B** — and the bottom action zone always answers "how did *this* raid end?". Possession auto-flips after each resolution. The scorer watches the mat; the screen must be resolvable by thumb without looking.

### Layout (top → bottom, weight descending toward the thumb)
1. **Record hero (top, glanceable, brutalist):** big mono score `A — B`; centred **raid clock** (30s ring/countdown); **who is raiding** (team chip, active side highlighted with green wash); two **mat-strength dolls** — a 7-cell row per side, filled cell = on mat, dashed/emptied cell = out (this is the over-strip equivalent: the record chip system of kabaddi). Do-or-die = a `--se-color-warning` band on the raiding side; all-out imminent (opponent at 1 on-mat) escalates to `--se-color-danger-soft`.
2. **Raid context line:** consecutive-empty count, super-tackle-armed / bonus-eligible flags in the uppercase-mono label voice ("BONUS ON · SUPER TACKLE ARMED").
3. **Primary raid-resolver (bottom thumb zone) — the most-tapped surface.** Guided-default (structurally un-fumbleable), with the two most common outcomes as **1-tap**:

   - **Common 1-tap row (biggest targets, bottom-most):**
     - **TOUCH +1** (raider touched one, returned) — the single most frequent outcome; 1 tap resolves, revives 1, flips possession.
     - **EMPTY RAID** — no score; increments do-or-die.
   - **Qualified outcomes (open a lean inline sub-step, never a modal):**
     - **TOUCH ▸** → step to "how many defenders out?" (1–5 selection pills) + optional "+bonus" toggle when eligible → confirm. Engine revives that many, marks defenders out, auto-fires super-raid tag at 3+.
     - **BONUS +1** — shown *only when eligible* (6+ defenders); greyed/absent otherwise so it can't be mis-tapped.
     - **TACKLE** — defenders stopped the raider → +1 defenders, raider out; **super-tackle is auto-added** (never a separate tap) when on-mat ≤3, with an inline "Super tackle +1" echo.
     - **OUT / FOUL ▸** → plain-English branch: "Raider out of bounds", "Foul on defence", etc. (hidden behind one control when technical-points tracking is OFF).
   - **Do-or-die:** when the raid is do-or-die, the resolver **re-skins** — the header banner warns, and EMPTY is replaced by **"Failed → opponents +1"** so the scorer can't accidentally log a consequence-free empty. (Same pattern as cricket's armed-state full-screen mode change.)
4. **Persistent Undo** square beside the resolver (always visible, LIFO, per `MonoLiveGame` precedent) + a quiet "Edit last raid" affordance.

**Kabaddi-specific primary actions (the verb set):** `TOUCH (+N)` · `BONUS` · `TACKLE` (auto super-tackle) · `EMPTY` · `OUT/FOUL` · `UNDO`. All-out (+2) and do-or-die penalty are **never buttons** — the engine fires them from roster/counter state and the UI *announces* them.

**Guided default + Power toggle (inherit cricket's decision).** Guided is default for the casual ICP. A Power fast-lane (dense, all outcomes on one board, super-tackle/all-out auto) is a per-device toggle for experienced scorers — both write the same raid outcome through one engine. Do not ship gestures as an entry mode.

**Ergonomics:** non-scrolling `100dvh` column; resolver keys `flex:1`, min-height `clamp(58px,11vh,74px)`; press physics only (`:active` translate + collapse to card shadow over `--se-motion-standard`); everything reachable one-handed; the record hero is `flex:none`, pinned through every sub-step.

---

## 4. Live / spectator design (richer detail, signature moments)

- **Hero:** green-wash surface, both scores mono, **mat-strength dolls animated** (a defender going out dims a cell; a revival re-lights it), raid clock, whose raid. May take the screen's single inversion for drama.
- **Raid feed:** elevation-signalled cards (rubric class 7) — ordinary empties are bare rows; **notable raids are soft white cards with a typed outcome chip**: `SUPER RAID ×3`, `SUPER TACKLE`, `ALL OUT +2`, `DO-OR-DIE ✓/✗`, `BONUS`.
- **Signature moments (spectator-visible):** ALL-OUT is the peak — a designed banner ("ALL OUT · +2 · Raiders revived") with the gold milestone card treatment (one gold/screen). SUPER RAID and DO-OR-DIE conversions get a lighter tag pulse. Star raider (Super-10 watch) and star defender (High-5 watch) chips.
- **Momentum band:** CSS-only bars per raid (points swing), encoded action/danger/warning/surface — no library.
- **Presence & reactions** first-class (viewer count in chrome, capsule reaction pills), LIVE pulse on the dot only. Tabs = LIVE · SCORECARD · INFO.

---

## 5. Blend direction (brutalist identity + HiFi warmth for THIS game)

Use ONLY existing `--se-*` / `--se-blend-*` tokens — **no new colours**; keep the minimal-brutalist palette + green accent. Confirmed from `src/index.css`: green primary = `--se-color-action`, `--se-color-action-soft`; `--se-blend-green-wash`; `--se-blend-gold` (celebration only); `--se-color-danger/-soft`, `--se-color-warning/-soft`; ink tiers; `--se-shadow-hard`; soft radii `--se-blend-radius-soft*`; `--se-motion-standard`.

- **Record is brutalist:** the two scores, the raid clock digits, the mat-strength dolls, the score-type stamps (TOUCH/TACKLE/BONUS/ALL OUT badges) — all hard, mono tabular, precise. The **mat-strength doll row is kabaddi's signature record chip** (the over-strip analogue): 7 fixed cells per side, filled = on mat, **dashed hairline = out** (mirrors cricket's dashed unbowled slot), one green striker-rail-equivalent on the raiding side.
- **Conversation is soft:** the raid resolver keys (borderless, hairline dividers, soft touch surfaces), the post-raid plain-English narration banner, do-or-die guidance, all-out celebration, spectator interiors, help/empty/error.
- **Escalation ladder = the only state encoding:** neutral surface → do-or-die = `--se-color-warning-soft`+`--se-color-warning` → all-out-imminent / do-or-die-fail = `--se-color-danger-soft`+`--se-color-danger` → the single all-out celebration = gold card. Raiding-side highlight = `--se-blend-green-wash` (lead/live surface only — green is never behind a defensive/out event, mirroring "never green behind a dismissal").
- **Per-screen budget enforced:** 1 hard border + 1 hard shadow on the outer shell only; ≤3 soft surfaces; ≤1 gold (all-out); ≤1 glow (primary resolver CTA); ≤1 inversion; ≤1 live pulse. Detail-by-surface: scorer lean, spectator + scorecard richer.
- **Type law:** every quantity mono tabular (scores, clocks, counts); player names sans sentence-case ≥12px (never uppercase a human); TOUCH/TACKLE/BONUS/ALL OUT as ≤3-word uppercase-mono label voice only.

---

## 6. Data touchpoints + stats worth capturing

**Per raid (the ledger row):** raid index, raiding team, raider id, outcome type(s), defenders-out list, bonus (bool), tackle-by (defender id, optional), super-tackle (bool), super-raid (bool), do-or-die (bool) + result, points to each side, on-mat counts after, timestamp/clock.

**Per player:**
- Raider: raid points, bonus points, total raids, empty/successful/do-or-die splits, super raids, **Super-10** flag, unsuccessful-raid %, highest single-raid.
- Defender: tackle points, super tackles, **High-5** flag, tackle attempts/success %.
- Universal: total points, time on mat, times out / revived.

**Per team:** total; points-by-type (raid / bonus / tackle / technical / all-out); all-outs inflicted & conceded; do-or-die record; raid success rate; tackle success rate; longest scoring streak; half-by-half split.

**Match:** result + margin in plain language ("won by 8 — with 2 all-outs"), MVP heuristic (raid+tackle points weighted), lead-timeline / momentum series, all-out timeline.

---

## 7. Animations / signature moments (future-flagged if heavy)

- **Ship at launch (cheap, reduced-motion gated):** score-pop on point; mat-doll cell dim on out / re-light on revive (`--se-motion-standard`); resolver press physics; single live pulse on LIVE dot; raid-clock countdown ring with a `--se-color-warning` flash in the final ~5s.
- **Signature (moderate — ship if budget allows, else Wave-later):** **ALL-OUT takeover** — the biggest moment in kabaddi; gold milestone card + "+2" stamp + full-side re-light sweep (non-blocking, one gold/screen). **SUPER RAID** and **DO-OR-DIE conversion** tags with a brief tag pulse.
- **Future-flagged (heavy — defer):** mat heat-map / raid-direction visualisation; animated raid replay on the spectator feed; per-raider "raid map" of touch positions (kabaddi's wagon-wheel analogue — needs tap-to-place capture, defer exactly like cricket's shot-tracking).
- **Anti-goals:** no dark full-bleed takeovers, no giant pulsing letters, nothing decorative that moves; celebration voice is warm sans sentence + mono figures line, never an uppercase-mono headline.

---

## 8. Port-vs-redesign (reuse vs bespoke)

**Reuse / port:**
- **Shell, header triptych, tokens, blend governance** — verbatim from design1-mono.
- **Match clock + LIFO undo scaffolding** from `MonoLiveGame` / `useTimer` — extend, don't rebuild (add the second *raid* 30s clock alongside the half clock).
- **Tournament wrapper, standings, roster/team setup chrome, crest squircle** — from `GenericGoalsTournament` / cricket setup; only the *match-scoring* interior is bespoke.
- **Spectator tab shell (LIVE/SCORECARD/INFO), momentum-band CSS pattern, gold milestone card, scorecard table grammar, share/result trio** — port the cricket patterns.

**Build bespoke (no analogue exists — this is the real work):**
- **The raid engine** — possession model, out/revive queues, do-or-die counter + fail penalty, all-out +2 auto-detect + auto-revive, bonus/super-tackle eligibility, point-type taxonomy. The generic goals tally cannot represent any of this.
- **The raid-resolver scorer surface** (§3) and the **mat-strength doll record component** (§5) — both net-new.
- **Kabaddi ruleset presets** (do-or-die trigger, bonus eligibility, super-tackle value, half length, technical-points toggle).
- **Kabaddi scorecard** (raid/bonus/tackle splits, Super-10 / High-5, all-out timeline).

**Sequencing (mirror cricket waves):** Wave 1 = raid engine + tokens; Wave 2 = scorer resolver + doll + setup/presets; Wave 3 = spectator + scorecard; Wave 4 = signature (all-out) + momentum + match-end. Guided default first, Power toggle as a second presentation over the same engine.

---

## 9. Open questions / product decisions

1. **Super-tackle value:** +1 or +2 total, and does "≤3 defenders" use on-mat count at the moment of tackle? Set the official default, expose in Custom.
2. **Do-or-die trigger:** default 3 empty raids (official) vs offer 2 for school/ground presets — confirm per-preset defaults.
3. **Bonus-line eligibility:** 6+ vs 7 defenders — default + whether Custom exposes it.
4. **Technical/foul granularity:** one plain "Out of bounds / foul" branch vs itemised (line-out, cant, lobby, illegal entry) — how much does the casual ICP need, and is bowler-credit-equivalent (which defender gets a tackle point on a technical) tracked?
5. **Substitutes & injuries:** model sub-in/out and injury-revive, or ignore subs for v1 (casual games do)?
6. **Match structure beyond time:** support points-target and single-half school formats, or time-halves only at launch?
7. **Circle kabaddi:** confirm out-of-scope for v1 (recommended) and future-flag.
8. **Raid clock authority:** does the app's 30s clock *drive* anything (auto-empty on expiry?) or is it advisory only, with the scorer always resolving manually? (Recommend advisory — never auto-score.)
9. **All-out edge cases:** all-out on a do-or-die raid; simultaneous all-out + bonus; revival order when multiple points land in one raid — lock the exact ordering in the engine spec.
10. **Offline / multi-device** conflict policy (carry cricket's open decision — single authoritative scorer device vs op-log merge).
11. **MVP / star heuristic** weighting (raid vs tackle points) for the result screen.
