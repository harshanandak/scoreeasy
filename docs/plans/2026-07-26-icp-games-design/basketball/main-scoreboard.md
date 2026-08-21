# ScoreEasy — Basketball MAIN SCOREBOARD (the board people read at a glance)

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (no code) · **Screen:** the single most important surface — the live "board."
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Anchors:** `research.md` §2.1, `design-brief.md` §4–5, cricket dual-team hero (`cricket-spectator-clean.html` `.hero`, `cricket-scorer-alt-big5.html` `.ck-hero`).
**Rule:** pure-black ink · one hard offset shadow · mono tabular numerals · **green = live/lead ONLY** · no new colours.

> This is the score bug / stadium board — not the scorer console, not the box score. Its ONE job: a player mid-sprint or a spectator across the room reads **who's winning, by how much, and what phase the game is in** in under a second. Everything here is subordinate to that.

---

## 1. Hero board anatomy — exactly what shows, and the hierarchy

The real world fixes the read-order (`research.md` §2.1, Wikipedia score-bug definition). We honour it and **stop early** — the grassroots board carries the top of the list and drops the table-crew tail (shot clock, timeouts) to optional.

**The read-order contract (top priority first):**

1. **The two team scores** — THE screen. Biggest elements by far, mono tabular, one per side, each paired with a **3-letter team abbreviation** (`LIONS` → `LIO`). The **leading team's score is green** (`--se-color-action`); the trailing score stays inverse-white on the black shell. This single green digit-block is how "who's winning" reads from across a room without parsing numbers.
2. **The phase pill** — dead centre between the scores: `Q3` / `HALF` / `OT` / `FINAL` (5×5), or `1st to 21` / `13–11` target progress (3×3). Mono, boxed, small. This is the game-state datum.
3. **The one context datum** — a single line under the scores. Its content is **state-driven, never stacked** — the board shows exactly ONE of, in precedence:
   - **`FINAL`** result phrase when the game is over (`Lions win by 8`), else
   - **BONUS** state if either team is in the bonus (`● BOSTON IN BONUS` — the most game-relevant live signal after the score), else
   - **run/momentum** if a run is live (`Lions on a 9–0 run`), else
   - **margin** as the quiet default (`Lions +8`).
4. **Clock / shot-clock** — OPTIONAL, off by default (no table crew on our grounds). When on: a small mono chip. Shot-clock only ever appears if the game clock is already on.
5. **Timeouts / possession** — small pips + arrow, fuller-board only. Never on the compact bug.

**Hierarchy in one line:** `SCORES (huge, leader green)` ▸ `phase pill (small, centred)` ▸ `one context line` ▸ `[optional clock]` ▸ `[fuller: quarter strip · bonus stamps · timeouts · possession]`.

The shell itself is the brutalist record: **flat black card, one `1px` ink border, one hard `3px 3px 0` offset shadow** — identical to the cricket `.hero`. No gradient, no second shadow, no decoration.

---

## 2. Two states

### State A — Compact live board (DEFAULT)

The TV score-bug. A single black hero card ~64–80px tall that lives at the top of the scorer console, the top of the spectator LIVE tab, and inside any share preview. It is the cricket `.hero` pattern, re-labelled for basketball. Carries **only tiers 1–3** (scores · phase · one context line). Nothing else. This is what 90% of eyes see 90% of the time.

- Scores at ~1.9–2.2rem mono; leader digit green.
- Centre phase pill (`Q3`).
- One context line, precedence per §1.3.
- A live pulse on the `LIVE` dot only (single pulse budget).

### State B — Fuller live-screen hero (stadium board)

The lean-back broadcast board — full viewport width, taken when the spectator opens LIVE or casts to a big screen. Same black shell, scaled up, plus the record notation the room wants between plays:

- **Scores at display size** (~3–4rem mono), abbreviations above, leader green.
- **Quarter-by-quarter strip** under the scores — `18 · 22 · 20 · —` per team, current period boxed, unplayed periods as dashed slots (mirror the cricket over-strip: always render all slots).
- **BONUS / foul stamp** per team — a hard squarer status rectangle that flips on at the threshold (`BONUS`), plus a foul-trouble whisper (`#7 · 4 fouls`) only when a player is one from out.
- **Timeouts** — small pips per team (`◇◇◆`).
- **Possession arrow** — a single triangle pointing to the team with the next held-ball possession (5×5 only; hidden in 3×3).
- **Run/momentum line** — the plain-language sentence from §1.3, given its own row here.
- **Clock chip** if enabled.

State B never invents data — every extra element reads straight off the same engine derivations. If the match is roster-less or clock-off, those elements simply don't render (honest fallback, no empty scaffolding).

---

## 3. Wireframes + exact data bindings

### 3a. Compact live board (5×5, default)

```
┌──────────────────────────────────────────────┐  ← flat black, 1px ink border,
│  ● LIVE                                  Q3   │    3px3px0 hard shadow
│                                                │
│   LIO            ┌────┐            BOS         │  ← abbrevs, mono .625rem
│    88            │ Q3 │             84         │  ← scores 2rem mono; 88 GREEN (leader)
│                  └────┘                        │
│  ───────────────────────────────────────────  │
│           Lions +4  ·  9–0 run                 │  ← ONE context line (precedence §1.3)
└──────────────────────────────────────────────┘
```

### 3b. Compact live board (3×3 — pad/target reshape)

```
┌──────────────────────────────────────────────┐
│  ● LIVE                              1st to 21 │
│   SKN            ┌──────┐            SHR        │
│    18            │  →21 │             15        │  ← 18 GREEN (leader), target pill centre
│                  └──────┘                       │
│  ───────────────────────────────────────────  │
│              Skins +3  ·  win by 2             │  ← 3×3 context: gap to target / win-by-2
└──────────────────────────────────────────────┘
```
No quarter, no possession arrow, no 3-pt anywhere — the board reshapes with the engine, it does not grey-out a disabled slot.

### 3c. Fuller live-screen hero (stadium board, 5×5)

```
┌────────────────────────────────────────────────────────┐
│  ● LIVE · Sunday Cup — Final                    Q3 6:12 │  ← clock only if enabled
│                                                          │
│    LIONS                                    BOSTON       │
│     88                                        84         │  ← 3–4rem mono; 88 GREEN
│     ◆◆◇  TO                              TO  ◆◇◇         │  ← timeout pips
│                                                          │
│    Q  │  1  │  2  │  3  │  4  │              ►           │  ← possession arrow → team in poss.
│    LIO│ 24  │ 22  │[20] │  — │                           │  ← current period boxed, — = unplayed
│    BOS│ 20  │ 25  │[19] │  — │                           │
│                                                          │
│  ┌─────────┐                                             │
│  │ BONUS   │  BOS in bonus · next foul = 2 FT            │  ← hard stamp, danger-soft ground
│  └─────────┘                                             │
│                                                          │
│           Lions on a 9–0 run  ·  biggest lead +11        │  ← momentum line
└────────────────────────────────────────────────────────┘
```

### 3d. Data bindings (all read from the engine's single source of truth — `deriveGame`)

| Element | Binding | Notes |
|---|---|---|
| Team abbrev L/R | `team.abbrev` (3-char, derived from name) | never uppercase a full human name; abbrev is mono caps |
| Score L/R | `derived.score[team]` | sum of scoring events; mono tabular |
| **Leader-green** | `derived.leader === team` | the ONE green digit-block; tie → both stay white |
| Phase pill | 5×5 `Q{derived.period}` / `HALF` / `OT{n}` / `FINAL`; 3×3 `1st to {target}` | |
| Context line | precedence: `derived.isFinal` → result · else `derived.bonusTeam` → bonus · else `derived.activeRun` → run · else `+{derived.margin}` | render exactly ONE |
| Quarter strip (B) | `derived.lineScore[team][period]`, `—` for `period > derived.period` | always render all period slots |
| BONUS stamp (B) | `derived.bonusTeam` (team foul ≥ threshold this period) | `--se-danger-soft` ground — never green behind a foul |
| Foul-trouble whisper (B) | `derived.foulTrouble[]` (player at limit−1) | soft, sentence-case, only when present |
| Timeout pips (B) | `derived.timeouts[team]` (◆ used / ◇ left) | |
| Possession arrow (B) | `derived.possession` | 5×5 only; hidden in 3×3 |
| Run line (B) | `derived.activeRun` (`{team, "9–0"}`) + `derived.biggestLead` | plain language |
| Clock chip | `state.clock` — renders only if `settings.clockEnabled` | shot-clock only if clock on |
| LIVE dot | `state.status === 'live'` | single live pulse |

Score-pop on any score change is **tiered by value** (a `+3` beats a `+2`); the buzzer-beater fires when a basket lands at `0:00`. Reduced-motion gated.

---

## 4. What does NOT go on the board (resist clutter)

The board is a **glance**, not a dashboard. Everything below has a home elsewhere (scorer pad, BOX SCORE tab, INFO tab) and is banned from the hero:

- **Per-player box lines** (PTS/REB/AST/FG/FT rows) — that's the BOX SCORE tab. The board's only player mention is the foul-trouble whisper, and only when someone is one foul from out.
- **Every foul number.** Show the *bonus crossing* (the state that changes play), not a raw `TF: 5 / TF: 3` ledger. Team-foul counts live on the scorer console.
- **Shot clock by default.** No table crew on our grounds — it never gates a score and stays off unless explicitly enabled (and only alongside a running game clock).
- **Play-by-play feed / key-moments log** — that's a spectator scroll below the hero, not on the board.
- **The scoring keypad, undo, foul/timeout controls** — operator surfaces; the board is read-only presentation even on the scorer screen.
- **Percentages & rates** (FG%, FT%, pace, +/−) — analytics, BOX/STATS tab only.
- **A second colour, a second shadow, a gradient, a logo wall, sponsor strips** — the shell is one black card, one ink border, one hard shadow. Green is spent entirely on the leader's score (and the LIVE dot). The BONUS stamp rides danger-soft, never green.
- **Stacked context lines.** Precedence picks ONE datum under the score. Bonus AND run AND margin never appear together on the compact board — that's the fast road to an unreadable bug.
- **Shot chart / court map** — the deferred spatial layer; a BOX-tab artefact, never the live board.

**The test for anything proposed for the board:** *can a player read it while running, from across the court, in under a second?* If not, it belongs on a tab, not the board.
