# ScoreEasy — Basketball SCORER (the lean operator console)

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (no code) · **Screen:** the scoring console — a thumb-driven, un-fumbleable input tool.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Anchors:** `research.md` §1.2/§3, `main-scoreboard.md` §1–2 (compact board reused verbatim as the readout), cricket lean-scorer (`cricket-scorer-alt-big5.html` — thumb-zone order, most-tapped-at-bottom, big one-tap primaries, rare actions tucked into a strip / More sheet).

> **The one job:** move the right number up, instantly, without a mis-tap — while standing courtside with one thumb, no table, no clock crew. This screen is an INPUT device, not a dashboard. Detail (box score, line score, shot chart, run tracker) lives on the LIVE board and BOX tab. The scorer stays lean on purpose. Everything below defends that.

---

## 1. Primary vs secondary actions — what earns a big target

Basketball differs from cricket in one structural way that shapes the whole pad: **there are two teams to attribute every point to.** Cricket scores to the batting side (one pad); basketball must resolve *which team* on every tap. We solve this the un-fumbleable way — **two mirrored scoring columns, one per team, each self-contained** — so a made basket is always ONE tap (the team's value key), never a "who scored?" second prompt.

### 1.1 The 90% case — big one-tap targets (per team)

Frequency from `research.md` §1.2 (`+2` ≈ 55–60% of taps, `+3` next, `+1`/FT last):

| Target | Value | Size | Why it's primary |
|---|---|---|---|
| **`+2`** | 2 pt field goal | **Largest key** in each column | The dominant tap. Instant to team total, one thumb. |
| **`+3`** | 3 pt field goal | Large, green-inked (the marquee value) | Basketball's boundary-six — earns emphasis + the tiered score-pop. |
| **`+1`** | free throw | Medium | Common but low-drama; casual scorers log made FTs here without attribution. |

Three keys × two teams = the entire 90% surface. No value is ever hidden behind a menu; no tap needs a confirm. **3×3 reshape:** the column becomes **`+2` / `+1` only** (inside arc = 1, behind = 2, no 3) — the pad *physically drops* the third key, it does not grey-out a disabled slot.

### 1.2 The secondary strip — one row, always visible, per team

Sits just above each team's big keys (rare-but-inline, thumb-adjacent). One tap, no sheet:

- **`FOUL`** — increments that team's period foul count (+ the player's personal count in detailed mode). The engine auto-flips **BONUS** at the threshold and auto-computes foul-out. Guided mode asks *shooting?* (→ awards FTs); Quick mode just bumps the counter.
- **`T/O`** — timeout; decrements that team's remaining, drops a pip. One tap.

### 1.3 The rare tail — tucked into the More sheet

Genuinely infrequent or setup-shaped actions never occupy pad real estate. They live in a bottom **More** sheet (the cricket `.menu-panel` pattern):

- **Technical / Unsportsmanlike / Flagrant** foul (each carries its own FT + possession math).
- **Substitution** (detailed mode — in/out picker).
- **Edit / correct a specific basket** (beyond the LIFO undo).
- **Possession arrow** toggle (5×5, only if being tracked).
- **Clock / shot-clock** enable (off by default).
- **Edit setup · Share live · End quarter · End game.**

**Undo is NOT in the tail.** It is the single most-used correction (`research.md` §1.2.7) and lives permanently in the control row — one always-visible LIFO unit.

---

## 2. Thumb-zone layout — compact readout up top, taps down low

Same spatial contract as the cricket lean scorer: **rare/management on top, the most-tapped keys pinned to the bottom** where the thumb rests. The score readout is a *glance-only* mirror of the compact board (`main-scoreboard.md` State A) — the operator reads it, never taps it.

Vertical order, top → bottom:
1. **Top bar** — back · match title + phase subline · LIVE badge · ≡ (thin, out of thumb reach).
2. **Compact board readout** (read-only) — the two scores (leader green), centre phase pill, ONE context line. Verbatim the `main-scoreboard.md` compact hero. The operator's own truth-check.
3. **Foul / bonus micro-strip** — the only live state the *scorer* needs that the board under-surfaces: `A ●●●●● BONUS · B ●●●○○` team-foul pips per side, flipping to a hard **BONUS** stamp at threshold. Glance, not tap.
4. **Handoff banner slot** (appears only at breaks — §3). Empty most of the time.
5. **Scoring pads** — two mirrored columns, **pinned to the bottom third**, biggest keys lowest.
6. **Control row** (below the pads, safe-area padded) — **Undo · More**. Undo big and left-thumb reachable.

### 2.1 ASCII wireframe — 5×5, guided (default)

```
┌──────────────────────────────────────────────┐
│ ‹  Sunday Cup — Final · Q3          ● LIVE  ≡ │  ← top bar (thin, top-reach)
├──────────────────────────────────────────────┤
│   LIO           ┌────┐           BOS          │  ← READ-ONLY board mirror
│    88           │ Q3 │            84          │     88 GREEN (leader)
│                 └────┘                        │
│            Lions +4  ·  9–0 run               │  ← one context line
├──────────────────────────────────────────────┤
│  LIO fouls ●●●●● BONUS   BOS fouls ●●●○○      │  ← foul/bonus micro-strip (glance)
├──────────────────────────────────────────────┤
│  ▸ END OF Q3 — tap to advance                 │  ← handoff banner (only at breaks; else hidden)
├───────────────────────┬──────────────────────┤
│        LIONS          │        BOSTON         │  ← team labels head each column
│  ┌──────┐ ┌────────┐  │  ┌────────┐ ┌──────┐  │
│  │  +1  │ │   +3   │  │  │   +3   │ │  +1  │  │  ← +1 (med) · +3 (large, green)
│  │  FT  │ │ THREE  │  │  │ THREE  │ │  FT  │  │
│  └──────┘ └────────┘  │  └────────┘ └──────┘  │
│  ┌─────────────────┐  │  ┌─────────────────┐  │
│  │       +2        │  │  │       +2        │  │  ← +2 HUGE — the 90% tap, lowest = best reach
│  │    FIELD GOAL   │  │  │    FIELD GOAL   │  │
│  └─────────────────┘  │  └─────────────────┘  │
│  ┌──────┐   ┌──────┐  │  ┌──────┐   ┌──────┐  │
│  │ FOUL │   │ T/O  │  │  │ T/O  │   │ FOUL │  │  ← secondary inline strip (per team)
│  └──────┘   └──────┘  │  └──────┘   └──────┘  │
├───────────────────────┴──────────────────────┤
│  ┌──────┐            ┌──────────────────────┐ │
│  │  ↩   │            │        ⋯ More        │ │  ← control row: Undo (big) · More sheet
│  │ UNDO │            └──────────────────────┘ │     safe-area padded
│  └──────┘                                     │
└──────────────────────────────────────────────┘
```

The mirror is deliberate: LIONS keys grow rightward from the left thumb, BOSTON keys grow leftward from the right thumb — `+2` for each team sits in the outer-bottom corner each thumb naturally covers, and neither team's keys reach into the other's zone (can't fat-finger a point onto the wrong team).

### 2.2 ASCII wireframe — 3×3 reshape (pad drops +3, adds target)

```
├──────────────────────────────────────────────┤
│   SKN           ┌──────┐          SHR         │
│    18           │ →21  │           15         │  ← target pill, not quarter
│            Skins +3 · win by 2                │
├──────────────────────────────────────────────┤
│  SKN fouls ●●●●●●○  (7th = 2 FT)  SHR ●●●○○○○ │  ← 3×3 foul→FT thresholds
├───────────────────────┬──────────────────────┤
│         SKINS         │        SHIRTS         │
│  ┌──────┐             │             ┌──────┐  │
│  │  +1  │             │             │  +1  │  │  ← inside-arc = 1
│  │ INSIDE│            │             │INSIDE│  │
│  └──────┘             │             └──────┘  │
│  ┌─────────────────┐  │  ┌─────────────────┐  │
│  │       +2        │  │  │       +2        │  │  ← behind-arc = 2 (the "big" one here)
│  │     ARC (2)     │  │  │     ARC (2)     │  │
│  └─────────────────┘  │  └─────────────────┘  │
│  ┌──────┐   ┌──────┐  │  ┌──────┐   ┌──────┐  │
│  │ FOUL │   │ T/O  │  │  │ T/O  │   │ FOUL │  │
```

No `+3`, no quarter pill, no possession — the console reshapes with the engine (`research.md` §1.1). Target-reached / win-by-2 checks run after every tap and raise the **game-over handoff** automatically.

---

## 3. Mandatory handoffs — clean inline steps, minimal friction

Handoffs never open a separate screen. Each is a **single inline banner** in the slot from §2 (order 4), or a one-tap action from the secondary strip. The rule: **the handoff appears only when it's due, is dismissible in one tap, and never blocks the next basket** (whistle-driven grounds — `research.md` §3).

| Handoff | Trigger | Inline step | Engine effect |
|---|---|---|---|
| **Quarter end** | operator taps `▸ END OF Qn` banner (auto-surfaced when clock hits 0, or manually anytime) | one tap → advance; a 2-sec confirmable toast `Q3 → Q4` | **resets team fouls to 0**, keeps personal fouls, advances period |
| **Half break** | end of period 2 | same banner reads `▸ HALFTIME — swap baskets`; one tap advances + shows a quiet **swap-baskets** reminder | resets team fouls, flags basket-swap |
| **Overtime** | regulation ends tied | banner `▸ TIED — start OT`; one tap | new OT period, team fouls reset |
| **Timeout** | `T/O` key in the team strip | one tap, decrements + drops a pip; no banner, no clock gate | timeout count −1 |
| **Substitution** | More sheet (detailed mode only) | inline in/out picker (a "holding bay" row, not a modal); skippable | records sub, updates on-floor set |
| **Foul-out** | player's 5th (FIBA) / 6th (NBA) personal foul | soft auto-callout in the handoff slot: `#7 fouled out — sub in`; taps through to the sub picker | flags DQ; bench must change |
| **Game end** | quarter-end on final period, or 3×3 target/cap reached | banner `▸ FINAL — Lions win by 8`; one tap → result + Share | locks match, freezes derivations |

Casual default keeps handoffs *optional to log*: a scorer who never taps `END OF Qn` can keep scoring — the engine just doesn't reset team fouls until they do. Guided mode nudges (the banner pulses once at the natural moment); Quick mode leaves it silent.

---

## 4. Guided (default) vs Quick (opt-in power mode)

One engine, two input postures — the cricket Guided↔Power split (`research.md` §4.4). Toggle lives in setup and in the More sheet.

### Guided — DEFAULT, hard-to-mis-score
The safe posture for the ICP (school/fest/gully scorers who score loosely):
- **Foul flow is walked:** tapping `FOUL` asks one plain-language question — *"Shooting foul?"* → if yes, auto-awards the correct FTs (bonus-aware: `Next foul = 2 FT` when a team is over the limit). No FT math in the operator's head.
- **BONUS is explained, not jargon:** the strip flips to `BONUS · next foul = 2 FT`, never a cryptic `TF: 5`.
- **Handoff nudges:** the quarter/half/foul-out banners pulse once at the natural moment so nothing is forgotten.
- **Tiered feedback:** a `+3` fires a bigger score-pop than a `+2`; the buzzer-beater fires at `0:00` (reduced-motion gated).
- **Guardrails:** end-game and end-quarter want one confirm tap; undo is always one atomic step back.

### Quick — opt-in, for experienced table scorers
Strips the prompts for speed once the operator knows the game:
- `FOUL` is a **raw counter bump** — no shooting-foul question; the scorer logs any resulting FTs as plain `+1` taps.
- **No handoff nudges** — banners stay silent; the scorer advances quarters manually when they choose.
- **No confirms** — every key is immediate (undo remains the safety net).
- Same pad, same layout — Quick only removes *interruptions*, never moves or hides a key (muscle memory is preserved between modes).

Both modes write the identical `ScoreEvent` / `FoulEvent` stream — a match can be scored loosely in Guided and read richly on the board with zero data loss.

---

## 5. How it stays SIMPLE — what's deliberately kept OFF the scorer

The scorer is an input device. Anything that is *read*, *analysed*, or *rarely touched* is banished to the board or a tab. Kept off, on purpose:

- **The full live board** — quarter-by-quarter line score, timeouts-remaining detail, possession arrow, momentum/run line, biggest-lead callout. The scorer shows only a **compact read-only mirror** (score · phase · one context line) as a truth-check. The rich board is `main-scoreboard.md` State B, the LIVE tab, or a cast screen.
- **Per-player box score** (PTS/REB/AST/FG/FT/STL/BLK/TO rows) — the BOX tab. The scorer's only player mention is the foul-out callout.
- **The shot chart / court-zone map** — deferred spatial layer (`research.md` §5.2), a BOX-tab artefact. `shotZone` is captured (if ever) via an *optional* micro-sheet piggybacked on a scoring tap, exactly like cricket's skippable wagon-wheel — never a required step, never on the pad.
- **Percentages & rates** (FG%, FT%, pace, +/−) — analytics, STATS tab only.
- **The shot clock and game clock by default** — no table crew on our grounds (`research.md` §3). Clock never gates a `+2`; it's an opt-in chip, and the shot clock only appears if a game clock is already on.
- **Assist attribution, sub holding-bay, technical-foul nuance** — detailed-mode extras behind the More sheet, never cluttering the 90% loop.
- **A second colour / shadow / gradient / logo wall** — the brutalist shell holds: flat surfaces, one ink border, green spent only on the leader's score + the `+3` keys. The BONUS stamp rides `--se-danger-soft`, never green.
- **Any confirm dialog on a scoring tap** — points are instant and undoable; a modal between the thumb and the number is the cardinal sin. Correction ergonomics = one always-visible Undo, not a wall of "are you sure?".

**The test for anything proposed for the scorer:** *does the operator TAP it more than once a game, and does tapping it change the score/state?* If it's read-only, it belongs on the board. If it's touched once a game, it belongs in the More sheet. Only the point values, fouls, timeouts, undo, and the current handoff earn a place on the pad.
