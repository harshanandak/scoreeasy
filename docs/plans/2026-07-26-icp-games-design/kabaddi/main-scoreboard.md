# ScoreEasy — Kabaddi MAIN SCOREBOARD (the board everyone reads)

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the single most important screen) · **ICP:** Indian college / university / school / ground.
**Design system:** design1-mono (brutalist record × HiFi-soft) · tokens verbatim from `src/index.css` — **no new colours**.
**Method inheritance:** cricket hero pattern (`cricket-scorer-alt-big5.html` hero + `cricket-spectator-clean.html` dual-team black hero). *The record is brutalist; the conversation is soft.*

> **The one law of this screen.** Kabaddi is legible from **three facts a viewer never has to compute: the two team scores, how many players each side has left on the mat (7 → 0), and the 30-second raid clock.** Cricket's glance-unit is `runs/wkts · overs`; kabaddi's is **`SCORE · DOLLS · RAID CLOCK`**. Every real broadcast (PKL score bug, kabaddi.eu, Super Tackle) leads with exactly this trio. The board's job is to make those three unmistakable across a dusty ground at arm's length — and then stop. Everything else is a different surface.

---

## 1. Hero board anatomy — exactly what shows, and the hierarchy

Five glance-facts, in a strict weight order. If a fact is not in this list, it does not belong on the board (see §4).

### Visual hierarchy (largest / loudest → quietest)

| Rank | Element | What it is | Why it earns the weight |
|---|---|---|---|
| **1** | **The two scores** | Two big mono tabular numerals, one per team, `A — B`. | The primary reading. Biggest thing on the screen, full stop. |
| **2** | **Mat-strength dolls** | A row of **7 pips per side**: filled = on mat, dashed hairline = out. | The single most kabaddi-specific element and the at-a-glance answer to *"how close is an all-out?"* This is what makes the board kabaddi and not a goals tally. |
| **3** | **Raid clock** | A **30s countdown** (ring/number), centre. Turns `--se-color-warning` and flashes in the final ~5s. | The live pulse — tells the room a raid is *in progress right now* and time is running out. |
| **4** | **Whose raid** | A **green wash + `RAID ▸` marker** on the raiding team's panel. | Possession. Which side is attacking is always visible; it flips every raid. |
| **5** | **Match context datum (ONE)** | A single mono line: **half + match clock** (e.g. `H1 · 08:12`). Escalates to **`DO-OR-DIE`** / **`ALL-OUT`** state word when armed. | The one context fact. Normally the clock; when the game turns, it becomes the *state of the game*. Never two facts here — one. |

**The escalation rule (the board's only state-encoding):**
- Neutral → the board is calm mono ink on canvas, green only on the raiding side.
- **Do-or-die armed** → raiding panel band goes `--se-color-warning-soft` + `--se-color-warning`; context line reads `DO-OR-DIE`.
- **All-out imminent** (a side at **1 on the mat**) → that side's doll row + panel escalate to `--se-color-danger-soft` / `--se-color-danger`.
- **ALL-OUT fires** → the single gold moment (`--se-blend-gold`, one per screen): `ALL OUT · +2` banner + full-side doll re-light sweep. This is a takeover beat, not a persistent board element — it plays, then the board returns to calm.
- Green is **only ever** the lead/live/raiding accent. Green never sits behind an out, a tackle, or a defensive event (mirrors cricket's "never green behind a dismissal").

**Type law (non-negotiable):** every quantity is mono tabular — scores, clock, doll counts. Team names are short uppercase-mono labels (`RAIDERS` / `SULTANS`), never a human's name uppercased. `TOUCH / TACKLE / BONUS / ALL OUT` are ≤3-word uppercase-mono stamps only.

---

## 2. Two states

The same record, two dressings. The **compact live board is the default** (it is the scorer's pinned hero and the WhatsApp thumbnail); the **fuller live-screen hero** is the lean-back spectator/stadium version.

### State A — Compact live board (DEFAULT)
The always-on record. It is what sits pinned at the top of the **scorer** console (`flex:none`, never scrolls) and what a shared card renders. One horizontal bug, ~`390px` wide, black hero card (`--se-color-ink` bg, `--shadow`), styled like the cricket dual-team hero.

- Both scores + team labels, dolls under each score, raid clock dead-centre, `RAID ▸` on the active side, one context line under a hairline rule.
- Dolls are compact (7 small cells). Height budget ≈ 120–140px. Reads across a room but fits above a keypad.
- **This is the source of truth** — everything else is a bigger or richer render of these exact bindings.

### State B — Fuller live-screen hero (SPECTATOR / STADIUM)
The lean-back board for the crowd, the bench, the projector, the shared live link. Same five facts, more air and motion.

- **Scores go huge** (`~3–4rem` mono), dolls become large lit pips with the **dim-on-out / re-light-on-revive** micro-animation as the always-on emotional beat.
- Raid clock becomes a visible **countdown ring** with the final-5s warning flash.
- **Star chips** appear under the hero: **star raider** (Super-10 watch) + **star defender** (High-5 watch) — one line, mono, quiet.
- May take the screen's **single inversion** for drama (the green-wash surface).
- Sits above `LIVE · SCORECARD · INFO` tabs and the raid feed — but the **hero itself carries only the five facts**. The feed, momentum band, and reactions live *below* the hero, not on the board.

Both states bind to the **same engine fields** — B is not "more data", it is the same data with more room and the launch micro-animations.

---

## 3. Wireframe + exact data bindings

### 3.1 Compact live board (State A) — the default bug

```
┌─────────────────────────────────────────────────────────┐   ← black hero card
│                                                         │     bg --se-color-ink
│  RAIDERS  ▸ RAID           30            SULTANS         │     shadow --shadow
│                          ╭────╮                         │
│   38                     │ 22 │                    31    │   ← scores: mono
│                          ╰────╯                          │     tabular, ~1.9rem
│                        raid clock                        │     active side .sc = green
│                                                         │
│  ● ● ● ● ● ○ ○            (30s countdown)   ● ● ● ● ● ● ●│   ← 7 dolls / side
│  5 on mat                                    7 on mat    │     ● filled ○ out(dashed)
│ ───────────────────────────────────────────────────────│   ← hairline rule
│                    H1 · 08:12                            │   ← the ONE context line
└─────────────────────────────────────────────────────────┘
        ▲ green wash on RAIDERS panel = they are raiding
```

Do-or-die variant (raiding side, band swaps to warning; context line becomes the state):
```
│  RAIDERS  ▸ DO-OR-DIE      30            SULTANS         │   ← panel band
│   38  (warning-soft band)                          31   │     --se-color-warning-soft
│ ───────────────────────────────────────────────────────│
│                    DO-OR-DIE · 3RD EMPTY                 │   ← context line = state word
```

### 3.2 Fuller live-screen hero (State B) — spectator/stadium

```
┌─────────────────────────────────────────────────────────┐
│   ● LIVE            Sunday Cup · Semi-final              │
│                                                         │
│   RAIDERS  ▸RAID                              SULTANS    │
│                                                         │
│     38            ╭──────────╮              31          │   ← huge mono scores
│                   │    30    │                          │     active = green
│                   │  ◜────◝  │                          │
│                   │ raid ring│                          │   ← countdown ring,
│                   ╰──────────╯                          │     warning flash <5s
│                                                         │
│   ● ● ● ● ● ○ ○                    ● ● ● ● ● ● ●         │   ← BIG dolls, animated
│   5 ON MAT                            7 ON MAT           │
│ ───────────────────────────────────────────────────────│
│   ★ RAIDER  P. Narwal 9        ★ DEFENDER  F. Maghsoudi 4│   ← star chips (quiet)
│                    H1 · 08:12                            │
└─────────────────────────────────────────────────────────┘
      (below the hero: LIVE feed · momentum band · reactions — NOT on the board)
```

### 3.3 Exact data bindings

Every field the board renders comes from the raid engine's derived state (research §1.3 / brief §1). The board **reads**; it never computes.

| Slot | Binding | Notes |
|---|---|---|
| Team A / B label | `team.shortName` (≤8 char, uppercased) | never a person's name |
| Score A / B | `score.teamA` / `score.teamB` (int) | mono tabular; active side rendered `--se-color-action` |
| Dolls A / B | `roster.onMat[side]` → 7 cells: `filled` for `i < onMatCount`, `dashed` for out | `onMatCount = 7 − outQueue[side].length` |
| "N on mat" | `onMatCount[side]` | doubles as the a11y label for the doll row |
| Raid clock | `raidClock.remaining` (0–30s) | `--se-color-warning` + flash when `≤ 5`; advisory only, never auto-scores |
| Whose raid / `RAID ▸` | `possession.raidingSide` | drives the green-wash panel + arrow; flips on each resolve |
| Do-or-die band | `possession.isDoOrDie` (bool) | swaps raiding-panel band to warning + context word |
| All-out-imminent | `min(onMatCount) === 1` | escalates that side to danger tokens |
| Context line | `match.half` + `matchClock` → `"H1 · 08:12"` | replaced by `DO-OR-DIE …` / `ALL OUT …` when a state is armed/firing |
| ★ Raider (State B) | `stats.topRaider` `{name, raidPoints}` | Super-10 highlight at ≥10 |
| ★ Defender (State B) | `stats.topDefender` `{name, tacklePoints}` | High-5 highlight at ≥5 |
| ALL-OUT beat | event `ALL_OUT {side, +2}` | fires gold banner + doll re-light sweep, then clears |

---

## 4. What NOT to put on the board (resist clutter)

The board is a **record, not a dashboard.** Kill anything that makes a viewer *read* instead of *glance*. Explicitly banned from the hero:

- **The raid-by-raid feed / game log.** It lives *below* the hero (spectator) or in the ledger — never on the board. The board shows the *current* state, not history.
- **Point-type breakdowns** (raid/bonus/tackle/technical splits, points-by-type). That is the **scorecard**, not the board.
- **The momentum band, run charts, heatmaps.** Analytics surfaces sit under the tabs, never in the hero.
- **Per-player stat rows / full rosters.** At most the two **star chips** on State B — and only as one quiet line, never a table.
- **Consecutive-empty counters, super-tackle-armed / bonus-eligible flags.** These are the *scorer's* raid-context line (brief §3.2), not the public board. The board only surfaces do-or-die because it changes the *state of the game*, not because the scorer needs the flag.
- **The resolver buttons / verb set.** `TOUCH / TACKLE / BONUS / EMPTY / OUT / UNDO` belong to the scorer console below the hero, never on the board itself.
- **Timeouts, reviews, substitution UI.** Broadcast-grammar noise for our casual ICP; out of the glance-unit.
- **A second context datum.** The context line holds **exactly one** fact (clock, or the state word) — never "clock + empties + timeouts". If two things fight for that slot, the game-state word always wins over the clock.
- **New colours, gradients, decorative motion.** Only `--se-*` tokens; green = live/lead only; gold = the one all-out moment; danger/warning = the escalation ladder. Nothing decorative moves — the only motion is the doll dim/re-light, the clock ring, and the single all-out sweep.

**The discipline test:** if a PT teacher glancing up from the mat for half a second can't read *who's winning, who's about to be all-out, and how much raid time is left* — something non-essential is stealing the weight. Cut it.
