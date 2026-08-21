# ScoreEasy — Kho-Kho BESPOKE Design Brief

**Date:** 2026-07-26 · **Status:** DESIGN BRIEF (no code, no mockups yet) · **Market:** Indian college / university / school / open-ground scorers
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `BLEND-GOVERNANCE.md` (FROZEN) + `blend-rubric.md`
**Method:** cricket exemplar — *the record is brutalist, the conversation is soft; detail-by-surface (scorer lean, spectator/scorecard richer)*.

Kho-Kho is India-native and has **no engine in the app today**. The generic scorer (`MonoLiveGame` timer + `mono-arena` two-half tap-to-increment) can count two numbers and run a clock — it has **zero** concept of turns, chasing-vs-running roles, batches of three, defenders-on-field, out-types, cross-turn point summation, or survival time. Kho-Kho needs a bespoke engine and surface, exactly as cricket did.

---

## 1. Scoring model + India/college nuances

### The core structure (what makes Kho-Kho unlike every sport we score)
Kho-Kho is a **turn-based, time-bounded, chase-and-tag** game. Two teams; in each **turn** one team **attacks (chases)** and the other **defends (runs)**. Only the **attacking/chasing team scores** in the traditional model — one point per **defender put OUT**. Roles then swap for the next turn. **Match winner = higher total points summed across all your turns as chaser.** This is the cricket "two innings, compare totals" shape, but the scoring side is the *fielding* side — a genuinely new mental model.

- **On the field:** 9-a-side standard (8 chasers seated alternately in the central-lane boxes + 1 active chaser at a pole; defenders enter as **batches of 3**).
- **The chase mechanics** (kho-transfer touch, the pole rule, no-reversing / direction lock, crossing only at poles) are **refereeing concerns, not scoring events.** The app must NOT try to adjudicate them. It may *optionally* log kho-count / active-chaser for stats, but the scorer's job is: **watch the clock, tap OUT when a defender is tagged, feed the next batch.**
- **Turn = a fixed clock** (traditionally ~7 or 9 min; often **2 innings × 2 turns = 4 turns** of 9 min = 36 min). The clock runs continuously; **the clock is the chase equation**, the way overs-remaining is cricket's.
- **Batch recycling (the "all-out re-entry" rule):** defenders come in threes. When the 3rd of a batch is out, the next three enter. If the **entire defending side is out before the clock expires**, the order **recycles from the top** and keeps feeding — the turn does not end early, only the timer ends it. (A "lona"/all-out is a bragging stat, not a follow-on.)
- **Turn end → role swap → next turn.** Half-time / innings break between innings.

### The Dream Run
A **defender who survives a long unbroken spell** is the signature moment. In **traditional/college scoring** the dream run is *prestige only* (survival time, denies the chasers points). In **Ultimate Kho Kho league scoring** it becomes **points for the defending side** (bonus every N seconds beyond a threshold). Model dream-run as **derived survival time per active defender/batch**, surfaced as escalating tension; only the *league preset* converts it to points.

### Presets (India-native variants the ICP actually plays) — pick at setup
- **College / KKFI-traditional (DEFAULT):** 1 point per out, attackers-only scoring, 9-a-side, 9-min turns, 4 turns, batch-of-3 + recycle, dream-run = prestige stat. This is what school/college/ground games run.
- **School / gully-short:** 7-a-side, shorter turns (5–7 min), 2 turns — same rules, smaller numbers.
- **Ultimate Kho Kho (league):** **Touch = 1**, **Pole Dive = 2**, **Sky Dive = 2**, **Dream-Run bonus** to the defender's team, wazir/attack-bonus windows. Advanced; a preset, never the default — its density is hostile to a first-timer (mirrors cricket's "Guided default, Power is a toggle" decision).
- **House-rule toggles:** turn length, turns/innings, players-per-side, dream-run threshold, whether special-skill points are on. Winner tie-break = fewest defenders lost / least time conceded (configurable).

**Anti-goal:** adjudicating kho/pole/direction fouls, or forcing league scoring on a college crowd.

---

## 2. Screens needed

| Screen | Must do |
|---|---|
| **Setup** | Two teams + rosters (numbers optional, names preferred — never uppercase a human); pick **preset** (college / school / league) which sets players-per-side, turn length, turns, scoring rules; **house-rule toggles** (turn min, dream-run threshold, special-skill points on/off); who chases first (toss). Reuse `mono-setup-option` / preset-card pattern. Produces a fully-configured match so the scorer never guesses mid-game. |
| **Scorer** | The operator console. Pinned hero: **big mono turn-clock (counting down)** + chasing-team score + role labels + **batch tracker (3 dots / defenders-remaining)**. One dominant primary action: **OUT**. Timer start/pause. Undo always visible. Out-flow (which defender / out-type in league mode) as a soft in-flow surface, never a modal. |
| **Turn-break / handoff** | *Mandatory step, absent from any generic scorer.* Finalize the turn → show the turn's points + role swap ("Chasing → Defending") → confirm rosters / who starts as active chaser → arm next turn. Same pattern as cricket's innings-break. Reused at half-time. |
| **Live / spectator** | Lean-back broadcast: current turn clock, both teams' running totals, **who's chasing now**, batch survival, the **dream-run tension band**, out-feed, and a **cross-turn comparison** (Team A's chase turn vs Team B's). Read-only, soft. |
| **Scorecard** | The record: per-turn breakdown (points, outs, all-out?, time), per-defender survival times, per-chaser outs-made (if captured), dream-run leaderboard, final result with margin in plain language. |

---

## 3. Scorer interaction design (operator-lean, thumb-zone)

**Persona:** a student, PT teacher, or bystander at a college ground, one-handed, sun glare, no rulebook. The surface must be *structurally hard to mis-score* and teach as it goes.

- **Weight descends with frequency; most-tapped sits at the bottom** (thumb zone). The single dominant control is a **full-width OUT bar** at the bottom of a non-scrolling `100dvh` column — the Kho-Kho analogue of cricket's keypad. Everything above it is glanceable record.
- **Primary action = OUT (a defender tagged).** Default (college) mode: **one tap logs the out** → +1 to the chasing team → batch tracker decrements a dot → if 3rd, the next-batch prompt slides in. Optional defender attribution: a soft row of **3 capsule pills** (the on-field defenders by name/number) appears; picking one is a *refinement*, not a blocker — tap-through works for casual scorers.
- **League mode swaps the single OUT for a small out-type choice:** **Touch (+1) · Pole Dive (+2) · Sky Dive (+2)**, plus **Self-out** (defender left the lane, no tag). Rendered as the hybrid keypad: hard grid, soft borderless keys, `--se-color-action-soft` tint on the higher-value skills (the way 4/6 are promoted in cricket). Confirmation-echo before commit ("**Pole Dive** — R. Kadam out · +2 to Warriors").
- **The clock is a first-class control, not decoration.** Big **Start / Pause** for the turn timer, because play stops for injuries/disputes. Clock low (<60s) escalates via the ladder to `--se-color-warning-soft`.
- **Batch feed is semi-automatic:** on the 3rd out, a soft banner "**Next 3 in**" with the incoming defenders; auto-advances but is undo-safe. All-out-before-time shows "**All out — order recycles**" (dashed-hairline help voice), and keeps the clock running.
- **Undo** is a permanently-visible square beside OUT (`--se-color-surface-warm`, no drama) — LIFO, never buried. Kho-Kho outs happen fast; misfires must be one tap to reverse.
- **Turn-end is a designed handoff, not a silent reset** (see §2). Never let a turn just "run out" into an ambiguous state.

**Primary actions, ranked (this is `keyInteractions`):** OUT/TOUCH (giant bottom bar, one-tap) → out-type + defender pick (league refinement) → Start/Pause turn clock → next-batch advance → Undo → End turn / swap roles.

---

## 4. Live / spectator design (richer detail, signature moments)

Spectator = the broadcast (HiFi-soft, hard shell only). Detail is *higher* here than the scorer.

- **Hero:** `--se-blend-green-wash` stage; **the chasing team's live score** big in mono tabular; the turn clock counting down beside it; a `.se-blend-pulse` LIVE dot (reduced-motion gated). Role line in sentence-case sans ("**Warriors chasing** · Strikers defending").
- **Batch survival strip:** the 3 on-field defenders as capsule chips with a **live survival timer** each — this is the drama Kho-Kho fans watch. As a defender's time climbs it escalates neutral → `--se-color-warning-soft` → at the dream-run threshold it becomes the **gold milestone moment**.
- **Dream-run tension band:** a full-bleed band (surface-warm) that intensifies as survival grows; when a defender crosses the dream-run threshold it fires the gold card (§7). The single most shareable Kho-Kho moment.
- **Cross-turn comparison:** because the winner is a sum across turns, spectator must show **"Team A scored 14 in their chase turn — Team B needs 15 to win"** — the chase-equation band, escalating to `--se-color-danger-soft` in the final turn's closing minute. This is the Kho-Kho "need 23 off 16".
- **Out-feed:** recent outs as elevation-signalled cards (notable = soft card + hard out-type stamp; ordinary = bare row). Reactions + viewer count first-class per the class-9 spec.

---

## 5. Blend direction (tokens only — no new colours)

Keep the minimal-brutalist palette + single green accent. Map Kho-Kho's semantics onto existing tokens:

- **Green = the CHASING team + LIVE only** (`--se-color-action`, `--se-blend-green-wash`). Green never sits behind a defender or a "survived" state — green belongs to whoever is *actively scoring*, exactly as cricket reserves it for lead/live. On role-swap, the wash moves to the new chaser.
- **OUT = the danger ladder** (`--se-color-danger` / `-soft`): the OUT stamp is a hard squarer **status badge** (grammar-2), never a full-bleed red slab at rest — the OUT *bar* is outline-danger at rest, solid only on confirmed out.
- **Dream-run / survival tension = the warning ladder** (`--se-color-warning-soft` → `--se-color-warning`) climbing with time, capped by **one gold milestone card** at the threshold (`--se-blend-gold` 2px border + `3px 3px 0` ink shadow — the celebration still wears the app's frame). One gold per screen.
- **The turn-clock** is the hero numeral: mono tabular-nums, display size, weight ~500 (big numbers light). It is the record's spine — pure brutalist.
- **Shell:** one `--se-border-standard` ink frame + one `--se-shadow-hard` on the outermost container per screen; interiors are 16–22% hairlines. Header carries a **persistent mono context subtitle** ("TURN 2/4 · WARRIORS CHASING · 03:12 LEFT").
- **Conversation soft:** setup, out-type picker, next-batch banner, turn-break, help, all guidance → sentence-case sans ≥11.5px in soft/tinted containers; canvas shifts to `--se-color-surface-warm` for decisions (no modals, no scrims). Primary CTA = the one glow (`--se-blend-shadow-cta`), labelled by outcome ("Confirm out → next batch").
- **Batch tracker + on-field defenders** use the three fixed grammars: **selection pills** (tappable defender picks), **status badges** (OUT / DREAM RUN read-only stamps), **record chips** (the 3-dot batch state, dashed for slots not yet in — reusing the over-strip logic of "always render all slots").

Per-screen hardness budget from the rubric applies verbatim: 1 hard shadow, 1 ink frame, ≤3 soft surfaces, ≤1 gold, ≤1 glow, ≤1 inversion, ≤1 live pulse.

---

## 6. Data touchpoints + stats worth capturing

**Per turn:** chasing team, defending team, points scored, outs (count + type breakdown in league), all-out achieved?, time taken to all-out, clock length, dream-runs conceded.
**Per team (aggregate across turns):** total points (attack) = the score that decides the match; total dream-run time (defense); best/worst turn.
**Per defender:** survival time (each spell + longest = personal dream run), how out (touch/pole-dive/sky-dive/self-out), times entered (recycle count).
**Per chaser (optional, league):** outs made, pole/sky dives — attribution is a *refinement*, degrade gracefully when the casual scorer skips it.
**Match:** result + margin in plain language ("Warriors won by 6 points"), tie-break basis if applied, MVP-style "Player of the match" (top chaser or longest dream-runner).

**Model shape (schema-complete up front, cricket lesson):** `Match{ preset, playersPerSide, turnSeconds, turnsTotal, teams[] }` → `Turn{ chaserTeam, defenderTeam, clock, points, outs[], batches[], dreamRuns[] }` → `Out{ defenderId, type, atClock, chaserId? }`. Fold all breadth now (out-types, dream-run, recycle count, special-skill points) so the model never churns even though college mode uses a fraction of it.

---

## 7. Animations / signature moments (future-flagged if heavy)

- **Score pop** on OUT (reuse existing `score-pop`) — light, ships with v1.
- **OUT stamp** — hard danger badge snaps in; reduced-motion gated.
- **Dream-run gold card** — the marquee moment: when a defender crosses the threshold, the gold milestone card (2px gold border + ink offset shadow, soft gold radial interior) with a **human sentence in sans** ("Great run — 3:04 unbroken.") + **figures line in mono** ("184s · 0 outs"). One gold per screen. This is Kho-Kho's "fifty card."
- **Turn-clock final-minute** escalation (warning→danger ladder), pulse on LIVE only.
- **Role-swap transition** at turn-break — the green wash slides from old chaser to new (tasteful, `--se-motion-standard`).
- **Future-flag (heavy):** a lane/pole mini-diagram animating kho-transfers or a live batch-position viz — deferred; needs real positional capture the casual scorer won't provide. Momentum/dream-run **worm** (CSS-only bars, no library) is Wave-later like cricket's viz modules.

---

## 8. Port-vs-redesign

**Port / reuse (don't rebuild):**
- Mono shell, header triptych, `mono-card`, badges, tabs, `mono-btn*`, focus/reduced-motion a11y — all frozen design-system primitives.
- The **timer** primitive from `MonoLiveGame` (`useTimer`) — Kho-Kho is time-bound; reuse the clock, re-skin as the hero countdown.
- The **arena single-giant-tap** ergonomics for the OUT bar (borderless, press-tint, thumb-zone) — but repurposed from "increment a side" to "log an out event."
- **Undo** LIFO, over-strip "render all slots" logic (→ batch dots), setup preset-cards, blend tokens (frozen), match-result/share trio.

**Build bespoke (the generic scorer has none of this):**
- The **turn engine**: roles (chaser/defender), continuous clock, **batch-of-3 + recycle**, all-out detection, **role-swap between turns**, and **cross-turn point summation → winner** (the two-numbers arena can't express any of it).
- **OUT flow** with defender attribution + out-type (league) + confirmation echo.
- **Dream-run derivation** (per-defender survival timers) + the gold moment.
- **Turn-break / half-time handoff** screen.
- **Spectator** chase-equation + dream-run band + cross-turn comparison.
- **Scorecard** with per-turn / per-defender / dream-run breakdowns.

**Rule of thumb:** reuse everything that is *chrome, tokens, and single-tap ergonomics*; build everything that is *Kho-Kho's turn/role/batch/survival logic*, because that logic is the identity and nothing generic approximates it.

---

## 9. Open questions / product decisions

1. **Default scoring model** — confirm **college/KKFI-traditional (attackers-only, 1/out)** is the ship default and Ultimate-Kho-Kho league is a toggle (mirrors cricket's Guided-default decision). *Leaning: yes.*
2. **Dream-run in default mode** — prestige-only stat, or a soft optional bonus? (Default: prestige stat; points only in league preset.)
3. **Defender attribution required or optional?** For the casual ICP, one-tap OUT without naming the defender must work; naming is a refinement. Confirm graceful-degrade is acceptable for the scorecard's per-defender stats.
4. **Turn structure defaults** — 4 turns × 9 min (full) vs 2 turns (school). Which is the out-of-box default, and is players-per-side (9 vs 7) preset-driven?
5. **All-out recycle exactness** — does the same order re-enter, and does an all-out grant any bonus/tie-break weight, or is it purely a stat?
6. **Tie-break rule** — fewest defenders lost? least time conceded? Needs a canonical default for the winner derivation.
7. **Clock authority / stoppages** — does the scorer's Start/Pause fully own game time, or do we allow injury-time entry? Offline single-authoritative-device policy (same open question cricket has).
8. **Special-skill point values** — lock Touch 1 / Pole Dive 2 / Sky Dive 2 against current Ultimate Kho Kho season rules before building the league preset (verify at build, don't hardcode from memory).
9. **Kho / pole / direction fouls** — confirmed OUT of scope for scoring (referee-only); is even *optional* kho-count logging wanted, or drop entirely for v1?
