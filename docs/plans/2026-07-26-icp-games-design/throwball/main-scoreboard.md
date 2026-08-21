# Throwball — The Main Scoreboard (the hero board)

**Status:** Design spec for the single most important surface. Feeds the scorer, spectator, and OBS/stadium renders.
**Inherits:** `research.md` (§2 volleyball score-bug anatomy) + `design-brief.md` (§3–5 blend law) + the cricket flat-black hero (`../../2026-07-20-icp-games/cricket/cricket-scorer-alt-big5.html` `.ck-hero`) and the dual-team spectator hero (`../../2026-07-20-icp-games/cricket/cricket-spectator-clean.html` `.hero`).
**One line:** This is the score bug. Two teams, two big numbers, sets won, whose serve, one escalation flag. Readable across a gym. Nothing else earns a place on it.

**The board is not the scorer.** The scorer screen wraps this board with buttons and chrome. The board itself is the pure record object — the thing you'd film, cast to a projector, or embed as a lower-third. Everything below designs that object, then its two live states.

---

## 1. Hero board anatomy — exactly what shows

The volleyball score bug carries **five facts and no more** (research §2). Throwball inherits them 1:1 because the state to convey is identical. In strict priority order, these are the only things allowed on the board:

| # | Fact | What it is | Why it's on the board |
|---|------|-----------|----------------------|
| 1 | **Two team identities** | Name (sentence case) + colour side. Home LEFT, away RIGHT — fixed, never swaps. | You cannot read a score without knowing whose. |
| 2 | **Current-set points** | The two giant mono tabular numerals. THE thing the eye lands on. | This is what "the score" means to everyone in the room. |
| 3 | **Sets won** | Small per-side sets tally between the scores (e.g. `1 · 0`). | Points alone are meaningless — `13` in set 1 ≠ `13` in a 2–0 match. This is the match state. |
| 4 | **Serve marker** | One hard dot/triangle beside the serving team's score. | The possession cue. Prominent in Federation, demoted for casual (see §2). |
| 5 | **Set/match-point flag** | A single mono stamp + escalation tint when a side is one point from the set or match. | The one drama cue broadcast production considers non-negotiable. |

### The one context datum

Below the two-number row sits **one line of plain context** — the board's single sentence. It is state-dependent and shows exactly ONE of these at a time (never stacked):

- **Normal play:** the set-box strip stands in as context (per-set finals) — no sentence needed.
- **Set point:** `SET POINT · MADRAS` (mono, warning tint).
- **Match point:** `MATCH POINT · MADRAS SERVE FOR IT` (mono, danger tint).
- **Deuce / cap:** `DEUCE · WIN BY 2` or `CAP 17 · NEXT POINT WINS`.
- **Between sets:** `MADRAS TAKE SET 2 · 15–12 · MATCH LEVEL 1–1` (spectator hero only).

This is the direct analogue of cricket's `.hero-note` ("Royals need **23** off **16**") — one derived sentence that tells you what *matters right now*.

### Visual hierarchy (largest → smallest)

```
   GIANT       current-set points        ~2.4–2.8rem mono, ink-strong / green on leader
   medium      team names                ~0.625rem mono eyebrow (sans on spectator)
   small       sets-won tally            ~0.8rem mono, centred between scores
   small       serve marker              6–8px hard dot beside serving score
   caption     context line / flag       ~0.75rem mono, tinted by escalation ladder
   record      set-box strip             mono chips, one per set
```

The numerals dominate. Everything else is a satellite. If a satellite competes with the numerals for attention, it's too big — shrink it.

### Blend law on the board (no new colours)

- **The record is brutalist:** numerals, sets tally, serve marker, set-box chips, the flag stamp → `--se-font-mono` tabular, one `--se-border-standard` + one `--se-shadow-hard` on the **outer shell only**.
- **Green = live/lead only:** the leading team's score and the score container's green-wash. A trailing side is never green. A lost set is never green.
- **Escalation is the ONLY state colour:** neutral → set-point `--se-color-warning-soft` → match-point `--se-color-danger-soft`. Never a new hue, never a glow-for-state.
- **The flat-black hero** (cricket `.ck-hero` / `.hero`) is the spectator board's frame: `background: --se-color-ink`, inverse text, one hard shadow, leader score in `--primary` (green).
- Per-board budget: **1 hard shadow, 1 hard frame, ≤1 inversion, ≤1 live pulse, 0 gold** (gold belongs to the result card, not the live board).

---

## 2. Two states

### State A — Compact live board (DEFAULT)

The default everywhere: the top of the scorer screen, the cast-to-projector view, the embeddable lower-third. Green-wash container, NOT the black hero — it lives inside the scorer shell which already owns the hard frame. Single horizontal row, room-readable.

- Two team columns, home left / away right.
- Giant current-set numerals; **leader's numeral in green** (`--se-color-ink-strong` for the trailing side).
- Sets-won tally centred between them (`1 · 0`).
- Serve marker beside the serving score — **shown for Federation preset, hidden for College/School casual** (research §3: under rally-point serve doesn't move the score, so it's clutter for a PT teacher; keep it for federation). One config flag, not a per-render decision.
- Set-box strip sits directly above, brutalist chips.
- Flag/escalation tint applied inline to the numeral row + one context word.
- **No** black inversion here — the compact board stays light so it composes inside the scorer without fighting the buttons.

### State B — Live-screen hero (FULLER)

The spectator / stadium / broadcast state. Takes the screen's **single inversion**: flat-black hero (cricket `.hero` pattern), inverse numerals, leader in green. Lean-back, dramatic, filmable.

Adds over the compact board — and nothing beyond this list:
- **Full team names** (sentence case, sans) not just abbreviations.
- **The context sentence** rendered explicitly in the `hero-note` slot (below the numerals, hairline top-border): set point, match point, deuce, or the last-set result line.
- **Set-box strip with inline per-set finals** (`25–22 · 23–25 · 15–11`), live set highlighted.
- **Match-point banner** in plain language when live: `Match point — Madras serve for it`.
- Serve marker always shown here (broadcast expects it).
- Live dot + `LIVE` in chrome; live pulse is the ONE allowed pulse.

Everything richer than this — momentum run bar, per-set breakdown table, reactions, viewer count — lives on the **spectator page around the hero**, not on the board itself. The board stays the five-fact bug.

---

## 3. Wireframe + exact data bindings

Home = Team A, always left. `cur` = current-set points. Serve marker `▸`/`◂` points at the serving team.

### State A — Compact live board (default, in-scorer)

```
┌─────────────────────────────────────────────┐  ← scorer shell (owns hard frame)
│  SET 3 · TO 11                    ● LIVE     │  chrome / context subtitle
│                                              │
│  ┌───┐┌───┐┌───┐                             │  set-box strip (brutalist chips)
│  │25 ││23 ││ 8 │  ← live set outlined green  │
│  │22 ││25 ││ 6 │                             │
│  └───┘└───┘└───┘                             │
│                                              │
│  ╭─────────────────────────────────────────╮│  green-wash container, soft radius
│  │ MADRAS            1 · 0          CHENNAI ││  names (mono eyebrow) + sets tally
│  │                                          ││
│  │   8 ▸               ·               6    ││  GIANT numerals; leader=green, ▸=serve
│  ╰─────────────────────────────────────────╯│
│                                              │
│         SET POINT · MADRAS                   │  context line (warning tint when armed)
└─────────────────────────────────────────────┘
```

### State B — Live-screen hero (spectator, single inversion)

```
┌─────────────────────────────────────────────┐
│  ‹     Inter-College Cup · Final    ↗        │
│                 ● LIVE                        │
│  [ LIVE ]  [ Scorecard ]  [ Info ]           │  segmented tabs (outside hero)
│                                              │
│  ┌─────────────────────────────────────────┐│  ██ FLAT-BLACK HERO ██ (inversion)
│  │ MADRAS          SETS  1 · 0      CHENNAI ││  full names (sans), sets tally
│  │                                          ││
│  │   8  ▸                             6     ││  GIANT inverse mono; leader=green ▸serve
│  │                                          ││
│  │  25–22  ·  23–25  ·  8–6◦                 ││  set-box strip, inline finals, live=◦
│  │ ─────────────────────────────────────── ││  hairline
│  │   Match point — Madras serve for it      ││  hero-note context sentence (danger tint)
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### Data bindings (from the set engine's atomic `point → {A|B}` stream)

| Slot | Binding | Notes |
|------|---------|-------|
| Home name / Away name | `teamA.name` / `teamB.name` | Sentence case. **Never uppercase a human/team name** (women's rosters). Abbreviation only when width-constrained. |
| Home cur / Away cur | `set.pointsA` / `set.pointsB` | Giant mono tabular. The atomic score. |
| Leader tint | `pointsA > pointsB ? A : pointsB > pointsA ? B : none` | Green on leader; tie = neither green. |
| Sets tally | `match.setsWonA` · `match.setsWonB` | Centred `N · N`. |
| Serve marker | `set.serving === 'A' ? '▸' : '◂'` | Auto-flips on side-out. Rendered only if `config.showServe` (Federation on; College/School off). |
| Set-box chips | `match.sets[]` → `{finalA, finalB, status}` | `status`: `done` filled · `live` outlined-green · `upcoming` dashed. Inline finals on spectator only. |
| Context subtitle | derived: `SET {n} · TO {set.target}` | Deciding-set short target surfaced here (`TO 11`). |
| Flag / escalation | engine: `setPoint({team})` / `matchPoint({team})` / `deuce` / `cap` | Drives the ONE context line + the numeral-row tint via the ladder. |
| Context sentence (hero) | `matchPoint → "Match point — {team} serve for it"` etc. | Plain language, spectator hero only. |
| LIVE dot / pulse | `subscription.isLive` | The one allowed pulse. |

**Escalation ladder (only state encoding):**
`neutral` → `setPoint` = `--se-color-warning-soft` → `matchPoint` = `--se-color-danger-soft`. On the black hero, emphasis is already the inversion; tint the note + flag word only.

**Set-completion is engine-derived, never on the board mid-transition:** when a set closes (≥ target AND lead ≥ 2, OR cap), the board freezes the final into a chip and the *scorer* screen (not the board) shows the soft between-set confirmation. The board only ever shows live or final state — no half-states.

---

## 4. What NOT to put on the board (resist clutter)

The board fails the instant a second person can't read it across the room. Everything below is deliberately **excluded** from both states — it lives on surrounding surfaces, never on the bug:

- **NO rotation board / player positions.** Casual women's/school play uses the Standing Player Method — no rotation at all (research §3). Federation-only, and even then it's a separate panel, never the board.
- **NO per-player stats, catches, aces, faults-by-type.** Scorecard territory. Zero place on a glanceable board.
- **NO fault-reason / "how was it won" pills.** Guided-mode enrichment on the scorer, never displayed on the board.
- **NO timeout counters / clocks on the board.** Optional light counter in scorer chrome if enabled — off by default, and off the board.
- **NO momentum run-bar / worm on the board.** The signature run beat lives on the spectator page *around* the hero, not inside it — it would swamp the five facts.
- **NO serve marker for casual presets.** Under rally-point serve doesn't change the score; showing it to a PT teacher is noise. Config-gated to Federation.
- **NO win/loss colour on the trailing team.** Green is live/lead only. A trailing or set-losing side stays ink — never red-for-losing, never a second hue.
- **NO gold, no glow, no confetti on the live board.** Gold + the one glow belong exclusively to the result/POTM card after match end. The live board carries zero celebration chrome.
- **NO two flags at once.** Set point OR match point OR deuce — one context line, one tint. Never stack them.
- **NO CRR/RRR-style projections, no predicted-winner %, no ad slot, no crest wall.** One crest initial max, only if it doesn't crowd the name.
- **NO decorative motion on the numerals.** Score-pop on change + press physics only. No pulsing giant letters (off-system), no dark takeover on a point.

**The discipline in one rule:** if a fact isn't one of the five (identities · points · sets · serve · escalation) plus the single context line, it does not go on the board. Push it to the scorer chrome, the spectator page, or the scorecard. The board's power is that it says exactly enough and stops.
