# ScoreEasy — Kabaddi DESIGN-FINAL (locked, buildable)

**Date:** 2026-07-26 · **Status:** LOCKED SPEC (supersedes research/main-scoreboard/scorer/live-innovations on any conflict) · **ICP:** Indian college / university / school / ground scorers (casual dominates).
**Design system:** design1-mono (brutalist record × HiFi-soft) · tokens verbatim from `src/index.css` — **no new colours** (`--se-*` only; green = live/lead, gold = the single all-out beat, warning/danger = the escalation ladder).
**Thesis:** *Kabaddi reads off three numbers a viewer never computes — SCORE · 7 DOLLS/side · RAID CLOCK. The scorer answers one question — "how did this raid end?" — and the engine owns every rule.*

This file is the deciding-designer pass over the four research/design docs. Where it differs from them, **this wins**. Decisions taken from the critique are marked **[LOCKED]**, **[CUT]**, or **[FUTURE]**.

---

## 0. Decisions carried in from the critique (read first)

- **[LOCKED] Semantic Big-4, never team-picked.** Buttons say *what happened* (TOUCH/TACKLE/BONUS/EMPTY). The engine already knows whose raid it is. Removing the "which side?" decision is the core anti-fumble move.
- **[LOCKED] Engine owns 100% of derived math.** All-out +2 & full revive, super-tackle +2, do-or-die penalty, revive order (Sanjeevani), bonus eligibility, empty-counter, possession flip, milestone tags. The scorer taps an outcome and reads a plain-English sentence back. Zero rule knowledge required.
- **[LOCKED] Raid clock is display-only + auto-run.** It auto-starts on every possession flip, counts 30→0, flashes warning ≤5s, then freezes at 0. It **never** auto-scores and the scorer **never** operates it. Setup toggle `Show raid clock` (default ON) can hide it entirely for a clock-less casual game.
- **[CUT] Zone×outcome "free" heatmap.** The Tier-1 launch analytic is **outcome-mix only** (touch/bonus/empty/tackle-suffered per raider and per team) — derivable from the resolver with zero extra capture. **Defensive-zone rows require Tier-2 tap-to-place** and do not exist until it is captured. No zone grid ships at launch.
- **[LOCKED] Offline-first is launch core, not a nice-to-have.** The incumbent is a paper notebook precisely because phones die and signal drops. The scorer must run fully offline and resume an interrupted match, or a school will not trust it.
- **[LOCKED] One engine, one ruleset: standard mat (Sanjeevani, 7-a-side).** Circle/Punjab/Amar and pursuit are a different game — **[FUTURE]** ruleset, shown as a greyed unselectable chip, never half-built.

---

## SCREEN 1 — SETUP (get to scoring in under a minute)

One short form, safe defaults, every advanced field collapsed. A casual scorer taps through in ~4 fields; a college scorer opens `Advanced`.

**Fields (in order):**
1. **Team A / Team B name** → stored full; the board renders `shortName` (≤8 char, auto-uppercased; editable).
2. **Match title** (optional, e.g. "Sunday Cup · Semi-final").
3. **Half length preset** → `2×20 (college)` · `2×10 (school)` · `2×7 (quick)` · `Custom mins`. **[LOCKED] never hardcoded.** Default `2×10`.
4. **Advanced (collapsed by default):**
   - `Do-or-die trigger` → **3rd empty (official, default)** / 2nd empty.
   - `Bonus eligibility` → **≥6 defenders (official, default)** / 7 only.
   - `Super-tackle value` → **+2 (official, default)** / +1.
   - `Track fouls / out-of-bounds` → **OFF for quick, ON for college** (surfaces SELF-OUT in the rare strip). Default OFF.
   - `Show raid clock` → **ON** (toggle off for clock-less games).
   - `Mode` → **Guided (default)** / Power.
   - `Track raids (tap-to-place)` → **OFF** (Tier-2 spatial capture; **[FUTURE]**-leaning, opt-in).
   - `Mat type` → **Standard (rectangle), locked default**; `Circle (soon)` greyed.
5. **Start match** → opens the scorer.

**Not at setup:** rosters/player lists (optional, addable later from `⋯ More`; casual games never need them), subs, timeouts config. Nothing here can block Start.

---

## SCREEN 2 — LEAN SCORER (the hot path)

**The one law:** the scorer answers exactly one question per raid — *"how did this raid end?"* — everything derived is engine-owned and narrated. Portrait, one-handed, `max-width:390px`, most-tapped targets at the bottom thumb arc, record pinned at top and never scrolling.

### Verb set

**Big-4 (90% of raids · big one-tap targets, bottom grid):**

| Target | Meaning (on-button) | Engine does silently | Accent |
|---|---|---|---|
| **TOUCH** | Raider touched one defender, got home. `+1 · 1 OUT` | +1 raiders · 1 defender out · revive 1 raider (out-order) · all-out check | action/green |
| **TACKLE** | Defenders stopped the raider. `RAIDER OUT · +1` | +1 defenders · raider out · revive 1 defender · **auto super-tackle +2 if ≤3 on mat** | danger-tint (never green) |
| **BONUS** | Raider crossed the bonus line. `+1` | +1 raiders · no roster change · **auto-dims when <6 defenders** (or house 7-only) | action-soft/green |
| **EMPTY** | Nothing scored. `0` | empty-counter++ → **arms do-or-die** · flips possession · **on a do-or-die raid re-routes to `raider out · opp +1`** | neutral ink |

**Rare strip (one hairline row above the Big-4):**
- **MULTI** → inline count row `+2 · +3 · +4 · +5` plus a `+BONUS` chip to compose *bonus + touches on one raid* (auto-tags **Super Raid**). **[LOCKED] this is the ONLY place a raid total is ever hand-composed** — guard it: the chip states the running total (`bonus +1 & touch 2 = +3`) before commit.
- **SELF-OUT** → "Out of bounds" (`+1 opp · offender out`). Hidden entirely unless `Track fouls` is ON.

**⋯ More sheet (rarest / management):** Timeout · Substitution (optional) · Correct last raid (full edit of previous resolve) · Add/edit rosters · Edit setup · Share live ↗ · End half / End match.

**Never on the scorer [LOCKED]:** manual roster/revival UI, all-out/super-tackle/do-or-die/bonus buttons (all auto), point-type tallies, the feed, analytics, any team-picker on outcome buttons, the raid clock as an authority.

### Layout (CSS `order`, most-tapped last)

```
┌───────────────────────────────────────────────┐
│  ‹   Sunday Cup · Semi-final          ● LIVE ⋯ │  topbar
├───────────────────────────────────────────────┤
│  ██ COMPACT LIVE BOARD (State A, pinned) ██    │  never scrolls
│  RAIDERS ▸RAID     ╭ 30 ╮      SULTANS         │
│    38              ╰────╯         31           │  scores mono · raid clock centre
│  ● ● ● ● ● ○ ○              ● ● ● ● ● ● ●       │  7 dolls/side
│  5 ON MAT                       7 ON MAT       │
│ ──────────────────────────────────────────────│
│                 H1 · 08:12                     │  the ONE context line
├───────────────────────────────────────────────┤
│  ↺  Touch on 2 — Raiders +2, 2 back, Blue → 4  │  last-raid narration + fat UNDO
├───────────────────────────────────────────────┤
│  MULTI (2·3·4·5 +Bonus)          SELF-OUT      │  rare strip (hairline)
├───────────────────────────────────────────────┤
│   ┌────────────┐   ┌────────────┐              │
│   │   TOUCH    │   │   TACKLE   │  green/danger│  Big-4 — thumb zone
│   │  +1 · 1 OUT│   │RAIDER OUT+1│              │
│   ├────────────┤   ├────────────┤              │
│   │   BONUS    │   │   EMPTY    │              │
│   │    +1      │   │     0      │              │
│   └────────────┘   └────────────┘              │
│  Full scorecard ›              Share live ↗    │  footer
└───────────────────────────────────────────────┘
```

**Handoffs — all zero-tap except half-time [LOCKED]:**
- Possession flip: **zero taps**, automatic every resolve (kabaddi's biggest ergonomic win over cricket — no strike-swap).
- Do-or-die armed: **zero taps** — board context flips to `DO-OR-DIE`, raiding band → warning. Scorer scores normally; engine enforces the empty→penalty.
- All-out: **zero taps** — engine fires +2, re-lights 7 dolls, plays the gold beat, narrates it.
- Half-time: **one tap** — inline banner `HALF TIME · ▸ START 2ND HALF` (swaps sides, keeps scores, resets rosters to 7, resets empty counter).
- Timeout / sub / end: `⋯ More`.

**Guided (default) vs Power:** Guided shows the narration+Undo confirm line every resolve, collapses MULTI, suppresses jargon, makes illegal taps structurally impossible. Power suppresses the confirm ceremony, inlines the MULTI count row on TOUCH, surfaces fouls by default. **Same engine, same correctness** — Power removes hand-holding, never rules.

---

## SCREEN 3 — MAIN SCOREBOARD / LIVE (the board everyone reads)

**Five glance-facts, strict weight order. Nothing else on the hero.**

1. **The two scores** — biggest thing on screen, mono tabular, active side green.
2. **Mat-strength dolls** — 7 pips/side, filled = on mat, dashed hairline = out. `onMatCount = 7 − outQueue[side].length`. The at-a-glance answer to "how close is an all-out?".
3. **Raid clock** — 30s countdown centre, warning-flash ≤5s, display-only.
4. **Whose raid** — green wash + `RAID ▸` on the raiding panel; flips every resolve.
5. **One context line** — `half · matchClock` (`H1 · 08:12`); escalates to `DO-OR-DIE` / `ALL OUT` when armed/firing. **Exactly one fact — state word beats clock when they contend.**

**Two states, same bindings:**
- **State A — Compact bug (DEFAULT):** the pinned scorer hero + the shared WhatsApp thumbnail. ~390px black hero card, ~120–140px tall. **Source of truth.**
- **State B — Fuller hero (SPECTATOR/STADIUM):** scores ~3–4rem, big animated dolls (dim-on-out / re-light-on-revive heartbeat), countdown ring, two quiet star chips (`★R Narwal 9` Super-10 watch · `★D Maghsoudi 4` High-5 watch), may take the screen's single green-wash inversion.

**Escalation ladder (board's only state encoding):** neutral calm → do-or-die (warning band + word) → all-out-imminent at 1-on-mat (danger tokens on that side) → **ALL-OUT fires** (the one gold takeover, then returns to calm). Green is only ever lead/live/raiding; never behind an out or a tackle.

**Banned from the board [LOCKED]:** the feed/log, point-type splits, momentum/charts/heatmaps, per-player rows (max: the two State-B star chips), empty/super-tackle/bonus flags (do-or-die is the only surfaced flag, because it changes the *state of the game*), resolver buttons, timeouts/reviews, a second context datum, any new colour or decorative motion.

**Live spectator surface = State-B hero + four tabs:** `LIVE · RAID MAP · SCORECARD · INFO`.
- **LIVE (default):** (a) NOW ON THE MAT — two slim now-cards (current raider live tally + key defender + plain "on mat 5·7" a11y restatement); (b) MOMENTUM — collapsed `<details>`, net-points-swing per 2-min window, `--primary` for the leading side, danger tint on an all-out window; (c) RAID FEED — the *readable* key-moments list (only notable raids; empties collapse), event words token-coloured; (d) PRESENCE footer (`👁 watching · 🔥`).
- **RAID MAP / SCORECARD / INFO:** see below.

---

## SCREEN 4 — SCORECARD (the record kabaddi doesn't have today)

The readable post-match/live record — the research §4.5 gap. Everything here is derived from the raid ledger; no extra capture.

- **Result line, plain language:** "Raiders beat Sultans 45–38 · 2 all-outs to 1."
- **Points-by-type split per team:** raid (touch) pts · bonus pts · tackle pts · all-out pts · technical pts.
- **Per-player rows (only if rosters were added):** raid pts · bonus · tackles · super-raids, with **Super-10 / High-5 badges** (engine-tagged, free).
- **All-out timeline:** the ordered list of all-out swings with match-clock stamps.
- **Raid log (full):** every raid, one readable line, newest-first — the game log made human (not a raw CSV).
- **Share:** exports the 1080×1080 Match Card (see signature/adoption).

Rosterless casual games still get result + points-by-type + all-out timeline + full raid log — player rows simply don't render. **No screen requires roster entry.**

---

## SIGNATURE MOMENTS (engine-fired, one-at-a-time, reduced-motion gated)

All token-only, auto-fired on the spectator surface when the scorer taps an outcome, queued never stacked (≤2 beats/raid, **gold always last**), each degrading to a static token-swapped chip under `prefers-reduced-motion`.

| # | Moment | Trigger | Animation | Restraint |
|---|---|---|---|---|
| 1 | **ALL OUT** (peak) | `ALL_OUT{side,+2}` | Full-width **gold** banner + emptied side's 7 dolls re-light L→R sweep (~600ms) + score +2, then calm | **The one gold moment**, max one on screen ever |
| 2 | **SUPER RAID** (≥3/raid) | `SUPER_RAID{raider,pts}` | `--primary` chip pulses from raider star; downed dolls cascade-dim (~450ms) | Yields to all-out if same raid (plays first) |
| 3 | **DO-OR-DIE** | `DOD_ARMED` / `DOD_CONVERT` / `DOD_FAIL` | Pre = held warning-band state (no motion); resolve = green success pulse or danger `+1` pulse (~300ms) | Tension is a state hold, only resolve animates |
| 4 | **SUPER TACKLE** (≤3 def, +2) | `SUPER_TACKLE{side,+2}` | danger chip pulse + raider doll dim-shake (~350ms) | Never green |
| 5 | **SUPER 10 / HIGH 5** | `MILESTONE_*` | star chip fills + single ring-pulse + 2s stamp | Quietest beat, chip state change |

**Always-on connective tissue:** the doll **dim-on-out / re-light-on-revive** (~180ms), reduced-motion → snap. This carries the emotion between banners.

---

## INTERACTIVE TRACKING LAYER (optional / on-demand)

Kabaddi's wagon-wheel analog — the **Raid Map** tab. Two tiers, honestly separated by build cost.

**Tier 1 — Outcome-mix analytics · EASY-NOW · launch · FREE (zero extra capture) [LOCKED — corrected].**
Derived from the resolver alone. Per raider and per team: the **outcome mix** — touch / bonus / empty / tackle-suffered frequencies, raid success %, super-raid count. Rendered as a plain CSS bar/grid. **No defensive-zone rows** (those need Tier-2). This is the "kabaddi has analytics too" hook and it is genuinely free.

**Tier 2 — Raid-path / mat-position capture · FUTURE-LEANING · optional, on-demand, Power-mode tap-to-place.**
The true wagon-wheel. **Off by default**, toggled by `Track raids` at setup. After a *scoring* raid, a slim dismissible sheet (`Skip`/`Save`, never modal-blocking — the resolve is already committed) lets the operator tap **where the raid reached** on a stylised standard mat; the tap **snaps to a named defensive zone** (L-corner / L-cover / centre / R-cover / R-corner / lobby). Writes `{raidId, attackZone, tackleZone, outcome, path}`. Feeds per-raider **attack maps** ("78% right-side") and per-zone **tackle maps** ("L-corner leaks 60%"), plus the zone×outcome grid that Tier-1 deliberately omits. **Mat-type aware** (standard default; circle greyed **[FUTURE]**). Full mat-diagram *replay* animation is **[FUTURE]** (heavy); launch-if-enabled ships the static accumulated path map.

**Guarantee:** Tier-2 default OFF, resolve committed before the sheet, every raid skippable, turning it off mid-match keeps Tier-1 alive. **Zero risk to the un-fumble-able hot path.**

---

## SCORING MODEL (the engine contract — locked)

**State the engine owns (scorer never computes):** per-side `onMatCount` (7→0) · per-side `outQueue` (revival order) · `consecutiveEmpty[side]` → do-or-die arm · super-tackle arm (≤3 at tackle) · bonus arm (≥6, or 7 house) · all-out detect + full revive · do-or-die fail penalty · half + match clock + 30s raid clock · running score + point-type tally · milestone tags.

**Events (each resolves one raid):**

| Event | Points | Roster effect | Auto? |
|---|---|---|---|
| Touch (+N) | +N raiders | N defenders out; revive N raiders (out-order) | N entered (1 via TOUCH, 2+ via MULTI); revival auto |
| Bonus (+1) | +1 raiders | none | eligibility auto (≥6 def) |
| Tackle (+1) | +1 defenders | raider out; revive 1 defender | — |
| Super tackle (=+2) | +2 defenders | raider out; revive 1 | **auto** at ≤3 on mat |
| Empty | 0 | none | empty-counter++ |
| Do-or-die fail | +1 opp | raider out | **engine-enforced** on the do-or-die raid |
| All-out (+2) | +2 to emptying side | emptied side fully revived (7 back) | **auto** at outQueue → 0 |
| Technical / self-out (+1) | +1 opp | offender out | manual (SELF-OUT), fouls-toggle gated |
| Super raid (tag) | — | — | celebration/stat tag |

**Locked resolution order** (real multi-outcome edge cases): touch points → out-roster update → all-out check → +2 → full revive. A single raid may combine bonus + touches (Super Raid). Do-or-die is stateful — an "empty" is structurally impossible on a do-or-die raid (re-routes to raider-out + opp +1). Super-tackle uses on-mat count at the instant of the tackle. **The raid clock never resolves a raid.**

---

## ORDERED BUILD PLAN

**M1 — Engine + scorer core (the un-fumble-able hot path).**
1. Raid engine: state model + the 9 events + locked resolution order + do-or-die/all-out/super-tackle/bonus auto-derivation + plain-English narrator.
2. Setup screen (4 core fields + Advanced collapsed; half-length preset mandatory).
3. Lean scorer: Big-4 semantic grid + rare strip (MULTI/SELF-OUT) + always-visible Undo + Correct-last-raid + auto possession flip + half-time one-tap.
4. Compact live board (State A) pinned: score · 7 dolls · raid clock (auto-run, display-only) · RAID ▸ · one context line.
5. **Offline-first persistence + Resume-last-match** (launch core, not deferred).

**M2 — Read surfaces + signature beats.**
6. Scorecard: result line · points-by-type · all-out timeline · full readable raid log (rosterless-safe; player rows + Super-10/High-5 badges when rosters present).
7. State-B spectator hero + LIVE tab (now-cards, collapsed momentum, readable raid feed, presence).
8. Signature moments 1–5 + doll dim/re-light heartbeat, all reduced-motion gated, queued not stacked.
9. Share: live link (read-only auto-refresh State-B) + 1080×1080 Match Card.

**M3 — Analytics + adoption levers.**
10. **Tier-1 outcome-mix Raid Map** (free, launch-tier analytic).
11. Power mode polish (confirm-line suppression, inline MULTI counts, fouls-by-default).

**Future-flagged (post-launch, explicitly deferred):**
- Tier-2 tap-to-place raid-path capture + zone maps + zone×outcome grid.
- One-screen tournament / bracket builder (the institutional adoption *unit*, but heavy).
- Spectator reactions + raid-o-meter.
- Player milestone/badge cards (season-level, beyond in-match auto-tags).
- Circle/Punjab kabaddi ruleset + pursuit.
- Full mat-diagram replay animation.
