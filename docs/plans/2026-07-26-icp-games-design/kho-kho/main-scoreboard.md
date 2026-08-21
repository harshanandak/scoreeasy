# ScoreEasy — Kho-Kho MAIN SCOREBOARD

**Date:** 2026-07-26 · **Status:** DESIGN (feeds the build; no code yet) · **Scope:** the single hero "board" — the glanceable live score every other Kho-Kho surface is built around.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · flat-black hero, one hard offset shadow, mono tabular numerals, **green = live / chasing / lead only** — NO new colours.
**Lineage:** ports the cricket dual-team hero (`cricket-spectator-clean.html` `.hero` + `cricket-scorer-alt-big5.html` `.ck-hero`) — flat `--se-color-ink` slab, `--shadow` 3px offset, `.wk`-style muted sub-figures, green mid-column context. Kho-Kho keeps the frame, swaps the semantics.

---

## 0. The one design decision this doc makes

**A generic two-number scoreboard cannot express Kho-Kho.** Research §2.1 proves the at-a-glance read is **four facts, not two**:

> **cumulative totals · turn clock · who's attacking · defenders left.**

So the board has **three tier-1 numerals** (Team A total · TURN CLOCK · Team B total) and **one live context datum** (defenders remaining). Everything else — chaser names, out-types, dream-run points math, reviews, per-turn deltas — is **off the board** (§4). The clock and the two totals are co-heroes because the totals *decide* the match and the clock *is the chase equation*; neither can be demoted.

---

## 1. Hero board anatomy — exactly what shows

### 1.1 The five elements (in strict visual-hierarchy order)

| # | Element | Weight / treatment | Why it earns board space |
|---|---------|--------------------|--------------------------|
| **1** | **Two team cumulative totals** — `GUJARAT 31 · 26 CHENNAI` | Tier-1: giant mono, `~2.4rem` board / `10vw` big-screen, tabular-nums, weight 500–800. The chasing side's number is **green** (`--se-color-action`); the defending side stays ink-inverse. | The number that decides the match; persists across all 4 turns. Cricket's dual-total hero, re-pointed. |
| **2** | **The turn countdown clock** — `03:12` | Tier-1: **co-hero**, centered between the totals, same numeral scale, mono tabular. `<60s` climbs the warning ladder (`--se-color-warning-soft` → `--se-color-warning`); LIVE pulse gated by reduced-motion. | The single most-watched element — the whole turn is a race against it. It is the record's spine (brief §5). |
| **3** | **ATTACK / DEFENCE role tag** | Tier-2: a small `ATTACK` status badge sits on the chasing team's name; the chasing side also carries the `--se-blend-green-wash`. Defender side gets a bare `DEF` muted micro-label or nothing. | Without it the score is unreadable — only the chaser scores (college), and roles flip every turn. This is the element every incumbent counter lacks. |
| **4** | **Turn indicator** — `TURN 3/4` | Tier-2: mono eyebrow in the persistent context subtitle, not a separate numeral. | Locates you in the 4-turn arc; tells the reader how much match is left. |
| **5** | **Defenders remaining** — `● ● ○` (2 left) | Tier-3: the **one live context datum**. Three record-chip dots (filled = on mat, hollow = out), with a hairline `RECYCLE ×1` note only when all-out has looped the order. | How close this batch is to falling = the live tension of the turn. Derived free from the OUT log. |

**The persistent mono context subtitle** (header, verbatim from brief §5) ties 3+4+clock into one line a broadcast lower-strip can read:
`TURN 3/4 · GUJARAT CHASING · 03:12 LEFT`

### 1.2 Hierarchy, stated plainly
1. **Read across a room:** two totals + the clock (three big numerals on a black slab).
2. **Read at a glance:** the green wash + `ATTACK` tag answers *who is scoring right now*.
3. **Read on a lean-in:** `TURN 3/4`, `● ● ○` defenders, and (fuller state only) the dream-run timer / chase equation.

Green appears **exactly once** — on the chasing side. On role-swap the wash slides to the new chaser (brief §7). That single moving accent *is* the identity of a turn-based sport.

---

## 2. Two states

### 2.1 Compact live board (DEFAULT) — the TV score bug / stadium strip
The everyday board: a phone spectator's pinned hero, a small LED strip, an embed. **Five elements only, one black slab, one shadow.** No dream-run band, no feed, no chase equation until the final turn. It must survive being 40px tall on a projector.

- Flat `--se-color-ink` slab, `--se-border-standard` frame, one `--shadow` (3px offset). Interiors are 16–22% hairlines.
- Height-frugal: totals + clock on one row; context subtitle above; defender dots on a thin base rule.
- The clock is the only thing that animates (per-second tick + `<60s` colour climb).

### 2.2 Fuller live-screen hero — the lean-back broadcast board
The big-screen / spectator-tab hero. Same skeleton, **two additions only**, both derived free from the OUT log + clock (research §5.2) — never new manual data:

- **Dream-run tension band** — a full-bleed base band under the totals carrying the current batch's live survival timer (`GUJARAT DEF · longest on mat 2:38`). Escalates neutral → `--se-color-warning-soft` → at the threshold it fires the **one gold milestone card** (`--se-blend-gold` 2px + 3px ink offset; human sentence in sans "Great run — 3:04 unbroken.", figures in mono "184s"). One gold per screen.
- **Final-turn chase equation** — in Turn 4 (or once a result is mathematically in reach) the hero-note flips to the Kho-Kho "need 23 off 16": `CHENNAI NEED 4 · 1:47 LEFT`, the `NEED` figure green, escalating to `--se-color-danger-soft` in the closing minute.

That's the whole delta. The fuller hero is the compact board **plus a survival timer and a chase line** — not a denser dashboard.

---

## 3. Wireframes + exact data bindings

### 3.1 Compact live board (default)

```
┌──────────────────────────────────────────────┐  ← flat --se-color-ink slab
│ TURN 3/4 · GUJARAT CHASING · 03:12 LEFT       │  ← mono context subtitle, ink-inverse 60%
│                                                │
│  GUJARAT   [ATTACK]        DEF     CHENNAI     │  ← names mono .1em; ATTACK = green badge
│                                                │
│   31            03:12            26            │  ← THREE tier-1 mono numerals
│  (green)      (clock)        (ink-inv)         │     chasing total green · clock center
│  ──────────────────────────────────────────   │  ← 18% hairline
│  DEFENDERS  ● ● ○   2 left                     │  ← record-chip dots (Tier-3)
└──────────────────────────────────────────────┘
        ▲ one --shadow hard offset (3px 3px 0)
```

### 3.2 Fuller live-screen hero (adds band + chase line)

```
┌──────────────────────────────────────────────┐
│ TURN 4/4 · CHENNAI CHASING · 01:47 LEFT   ●LIVE│
│                                                │
│  GUJARAT                    [ATTACK]  CHENNAI  │  ← wash + ATTACK now on CHENNAI (swapped)
│                                                │
│   31            01:47            27            │  ← Chennai total now green (chasing)
│  ────────────────────────────────────────────  │
│  DEFENDERS  ● ● ○   ·   longest on mat  2:38   │  ← dream-run tension band (warning climb)
│  ────────────────────────────────────────────  │
│  CHENNAI NEED 4 · 1:47 LEFT                     │  ← chase equation (green NEED, danger <60s)
└──────────────────────────────────────────────┘
   ↑ at threshold, ONE gold card overlays the band:
   ┌────────────────────────────────┐
   │ ★ Great run — 3:04 unbroken.    │  ← sans sentence
   │   184s · Sanket K.              │  ← mono figures
   └────────────────────────────────┘
```

### 3.3 Data bindings (exact)

| Slot | Binding | Notes |
|------|---------|-------|
| Team A / B name | `Match.teams[i].name` | Never uppercase a human roster; team *names* may render caps as a mono label only. |
| Team A / B **total** (tier-1) | `Σ Turn.points WHERE Turn.chaserTeam == teams[i]` | Cumulative across ALL turns; **persists** — the match-deciding number. |
| Green wash + `ATTACK` badge | `currentTurn.chaserTeam == teams[i]` | Exactly one side true; moves on role-swap. |
| `DEF` micro-label | `currentTurn.defenderTeam == teams[i]` | Muted or omitted; never green. |
| **Clock** (tier-1) | `currentTurn.clock` (countdown mm:ss) | `<60s` → warning ladder; `paused` → dim + `PAUSED` micro-label (play stops constantly at grounds). |
| Context subtitle | `` `TURN ${currentTurn.index}/${Match.turnsTotal} · ${chaser.name} CHASING · ${clock} LEFT` `` | The broadcast one-liner. |
| Turn indicator | `currentTurn.index` / `Match.turnsTotal` | 4 default (college), 2 (school) — preset-driven. |
| Defender dots `● ● ○` | `batch.slots` → filled = still on mat, hollow = out; always render all `playersPerBatch` (3) slots | Over-strip "render all slots" logic (brief §5). |
| `RECYCLE ×n` note | `currentTurn.allOutCount` > 0 | Dashed hairline; college = stat only, no points. |
| Dream-run timer (fuller) | `max(now − defender.enteredAt)` over on-mat defenders | Pure derivation; escalates by ladder; gold at `preset.dreamRunThreshold`. |
| Dream-run **points** | league preset ONLY: `+1 at threshold, +1 / 30s` | College: prestige only — the timer shows, the total does NOT move. |
| Chase equation (fuller, final turn) | derived: `leader.total − chaser.total + 1` needed, `currentTurn.clock` left | Shows only when `currentTurn.index == turnsTotal` (or result in reach). |
| LIVE pulse | `match.state == 'live'` | Reduced-motion gated. |

---

## 4. What NOT to put on the board (resist clutter)

The board is a **glance instrument**, not a dashboard. Everything below is real Kho-Kho data that belongs on the **scorecard, out-feed, or overlay layer** — never the resting hero:

- **Active-chaser name + per-chaser tag count** (`Sanket Kadam — 3 outs`). → broadcast lower-third / overlay, not the board.
- **Out-type breakdown** (Touch / Pole Dive / Sky Dive counts). → out-feed stamp + scorecard.
- **Per-defender survival table / the Gantt timeline.** → the tracking-layer viz (research §5.2), a separate module.
- **Dream-run POINTS in college mode.** Prestige-only — surfacing a bonus math the preset doesn't score is a lie. The *timer* is welcome; the points are not.
- **Kho count · active-chaser position · lane / pole diagram.** Refereeing, not scoring — out of scope entirely (brief anti-goal). Never on the board.
- **Reviews / cards status.** At most a tiny overlay chip; never a tier on the main slab.
- **Per-turn deltas / turn-by-turn history** (`Turn 1: 14–1`). → scorecard record, not the live hero.
- **Team crests/logos beyond a 1-glyph mark, sponsor rails, rosters.** Clutter that steals numeral size.
- **A raw two-number score with no role + clock.** The incumbent-counter trap — banned by §0.
- **A second accent colour or a red resting slab.** OUT is a transient danger *flash/stamp* in the feed, never a standing colour on the board. Green stays the only accent, and only on the chaser.

**Rule of thumb:** if it doesn't change *who's winning*, *how much time is left*, *who's scoring*, or *how close this batch is to falling* — it is not board-tier. Push it down a layer.

---

## 5. Hardness budget (rubric, verbatim)

Per screen: **1 hard shadow · 1 ink frame · ≤3 soft surfaces · ≤1 gold · ≤1 glow · ≤1 inversion · ≤1 live pulse.** The board spends its inversion on the black slab, its shadow on the slab's offset, its one gold on the dream-run threshold card (fuller state only), its one pulse on LIVE. Nothing left over for a second flourish — which is the point.
