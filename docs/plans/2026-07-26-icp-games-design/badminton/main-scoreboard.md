# Badminton — the MAIN SCOREBOARD (the one screen that matters)

**Date:** 2026-07-26 · **Status:** BOARD SPEC (decisive) · **ICP:** Indian college / school / local-ground scorers + the room watching them.
**Design system:** design1-mono (brutalist × HiFi blend). Inherits the cricket `blend-rubric.md` and the cricket black-hero pattern (`cricket-scorer-alt-big5.html` `.ck-hero`, `cricket-spectator-clean.html` `.hero`) **verbatim** — flat black ink card, mono tabular numerals, ONE hard offset shadow, green = lead/live accent ONLY, one live pulse. This spec does not re-decide the blend; it applies it to badminton.

**The thesis for THIS screen:** badminton's board is the *simplest* of any racquet sport — no run-rate, no chase math, no overs. A viewer glancing for under one second must read **five facts and nothing else**. The entire design job is to make those five facts enormous and everything else disappear. If you can read it across a gym, it's right. If you're squinting at a sixth number, it's wrong.

---

## 1. Hero board anatomy — the FIVE facts, in hierarchy order

Real on-court boards and every TV score bug (BWF World Tour bug, overlays.uno "Badminton Scorebug", KeepTheScore streaming board) converge on the **same five-fact anatomy**. We render exactly these, weighted by glance-order:

| # | Fact | Weight | Visual treatment | Why it's on the board |
|---|------|--------|------------------|----------------------|
| **1** | **The two current-game scores** | **DOMINANT** (biggest thing on the screen by 3–4×) | Mono tabular, 800 weight, `.ck-hero-score` scale (≈2.6rem compact → ~14vw hero). Leading side takes the **green** numeral; trailing side is inverse-white. | This is the answer to "what's the score" — the reason anyone looks. |
| **2** | **The two names / pairs** + **serve indicator** | HIGH (but small type) | Mono eyebrow caps, ≈0.625rem, 60%-opacity white. The **serving side carries a filled shuttle glyph** `🏸`/`●` immediately left of its name. This is the single most important *non-numeric* cue — every real board has it. | Tells you who's who **and** who serves — badminton's identity fact. |
| **3** | **The game-state / phase strip** (the ONE context datum) | MEDIUM — center seam | Mono, one line: `GAME 3 · DECIDER` normally; **escalates in place** to `GAME POINT` / `MATCH POINT` / `DEUCE · WIN BY 2`. Never more than one phrase. | Answers "where are we in the match" — the only context that changes how you read the score. |
| **4** | **Games-won pips** | LOW | Two small record chips per side (`■ □`), outside the names, mono. `1–0`. | Tells a late-joining viewer the match story at set level. |
| **5** | **LIVE + match context** (event · round · court) | LOWEST — chrome only | Header line, sans, muted. `Sunday Cup · SF · Court 2` + a `● LIVE` dot (the one pulse). | Orientation, not scoreboard. Lives in the frame, never competes with the score. |

**Hierarchy law:** the two scores must out-mass everything else combined. Names are labels, not headlines. The phase strip is one short phrase. Pips are dots. Context is chrome. **A viewer who can only read one thing reads the score; who reads two reads score + serve; who reads three reads score + serve + phase.** That ordering is the design.

**Serve + court (fact 2, expanded):** the serving side shows `🏸` + a hard **`R`/`L` court stamp** (grammar-2 status chip, squarer than a pill) — derived from server-score parity (even→R, odd→L), never asked. In **doubles** the serving *player's* name is bolded and the diagonal receiver is faintly marked. On serve hand-over the shuttle **glides across the seam** to the new server and the court chip flips R↔L (the signature animation, reduced-motion gated). This is the app's whole wedge — "who serves, from which box" settled, non-jittering, trustworthy across a noisy court.

---

## 2. Two states

### State A — COMPACT LIVE BOARD (default; the "score bug")
The everyday board: top of the spectator screen, top of the scorer screen, and the shareable widget. **Portrait, phone-first, ~390px.** Flat **black** hero card, hard `3px 3px 0` shadow, one green accent.

- Both scores side-by-side, large (`.ck-hero-score` ≈2.6rem), leading side green.
- Names as mono eyebrows with the serve shuttle on the serving side.
- Games-won pips above each name.
- Center seam = the phase strip (`GAME 3` / `DEUCE` / `MATCH POINT`) + the tiny court chip `R`/`L`.
- Header chrome: event · round · court, `● LIVE`.
- **One line, no scrolling, no second card.** Everything else (momentum, per-game rail, stats) lives *below* this card on the spectator page — it is NOT part of the board.

### State B — LIVE-SCREEN HERO (the "stadium board" / cast view)
When the board IS the whole screen — projected in a hall, cast to a TV, or full-screen on a tablet on the umpire's chair. **Landscape, must read across a room.** Same five facts, re-massed for distance:

- **Two big columns**, one per side, split by a thin center rule. Score numerals scale to viewport (`clamp(4rem, 22vw, 15rem)`) — the dominant object in the room.
- Name band **above** each score in larger caps (readable at 10m), serve shuttle enlarged to a real glyph on the serving column, court stamp `R`/`L` beside it.
- Games-won pips become **filled/empty squares** big enough to count from across the hall.
- Phase strip runs as a **full-width band under the center rule** — `GAME 3 · DECIDER` / escalating to a `MATCH POINT` band (warning-soft → danger-soft ladder; still no new hue).
- Previous-game line scores (`21–18 · 18–21`) appear as small boxes flanking the phase band — the only extra fact the big board earns over the compact one, because a hall audience joins mid-match.
- Header shrinks to a quiet top strip: event · round · `● LIVE`.

Both states are the *same five facts* — B just trades portrait stacking for landscape columns and grows the type. No new data, no new widgets between them.

---

## 3. Wireframes + exact data bindings

### State A — compact live board (portrait score bug)

```
┌──────────────────────────────────────────────┐
│  Sunday Cup · SF · Court 2          ● LIVE    │   header (chrome) — {event}·{round}·{court}, {liveDot}
├──────────────────────────────────────────────┤ ◄─ flat BLACK hero card, shadow 3px 3px 0
│                                                │
│  ■ □                              ■ ■          │   games pips — {A.gamesWon}/{setsToWin}, {B.gamesWon}
│  🏸 A. SHARMA            MEERA & RIYA          │   names (mono caps) — 🏸=server {servingSideId}
│                                                │
│    18        GAME 3          21                │   ◄─ SCORES (dominant) {A.pts} · {B.pts}
│              DECIDER    R                       │   phase strip {phaseLabel} + court {serveCourt}
│   (white)   (leading = green ─┘)  (green)      │   leading numeral = green {leaderId}
│                                                │
└──────────────────────────────────────────────┘
   ▲ below this card on the spectator page:
     momentum run · per-game rail · stats — NOT the board
```

Escalated phase (20–20 onward): center reads `DEUCE · WIN BY 2`; at 20–19 up it reads `GAME POINT`; in game 3 one point from the match, `MATCH POINT` (danger-soft chip + the single LIVE pulse).

### State B — live-screen hero (landscape stadium board)

```
┌───────────────────────────────────────────────────────────────────┐
│ SUNDAY CUP · SEMI-FINAL · COURT 2                          ● LIVE   │
├─────────────────────────────────┬─────────────────────────────────┤
│           ■ □                    │                    ■ ■          │   games pips per side
│                                  │                                  │
│      🏸 A. SHARMA   R            │            MEERA & RIYA          │   name band (large caps) + serve glyph + court
│                                  │                                  │
│                                  │                                  │
│          18                      │             21                   │   ◄── HUGE score numerals (clamp→15rem)
│        (white)                   │           (green = leading)      │
│                                  │                                  │
├──────── 21–18 ──┤  GAME 3 · DECIDER  ├── 18–21 ────────────────────┤   prev-game boxes + phase band (full width)
└─────────────────┴──────────────────┴─────────────────────────────┘
```

### Data bindings (the board reads ONLY these — derived engine fields, zero extra taps)

| Slot | Binding | Source |
|------|---------|--------|
| Score, side A / B | `game.pointsA` / `game.pointsB` | live rally count |
| Leading (green) | `leaderId = pointsA===pointsB ? null : (pointsA>pointsB?A:B)` | derived; tie = neither green |
| Name / pair | `side.displayName` (doubles: `p1 & p2`) | setup |
| Serve shuttle | `servingSideId = winner(lastRally)` | derived (rally-point) |
| Doubles server bold | `servingPlayerId` | derived (consecutive-point court swap rule) |
| Court stamp R/L | `serveCourt = (servingSide.pts % 2 === 0) ? 'R' : 'L'` | derived (parity) |
| Games-won pips | `side.gamesWon` of `setsToWin = ceil(gamesToWin_total/2)` | derived |
| Phase strip | `phaseLabel` ∈ {`GAME n`, `DECIDER`, `DEUCE · WIN BY 2`, `GAME POINT`, `MATCH POINT`, `CHANGE ENDS`} | derived (deuce/cap/game-point/match-point detector) |
| Prev-game line scores (B only) | `games[].line` e.g. `21–18` | completed games |
| Context chrome | `event`, `round`, `court`, `isLive` | setup / session |

**Derivation, not entry.** Every board field except the names and the event context is a **pure function of the rally log**. The operator never types a serve, a court, or a phase — the board computes them. That is the correctness guarantee the category lacks.

---

## 4. What NOT to put on the board (resist clutter — this is half the design)

The board fails the instant it earns a sixth number. Explicitly banned from the hero:

- ❌ **Rally count / total points played** — nobody reads it at a glance; it's a stat, put it on the Stats tab.
- ❌ **Point-win %, serve/receive split, streak counters, momentum bars** — genuinely valuable, genuinely *below the fold*. The momentum run and per-game breakdown live on the spectator page **beneath** the board card, never inside it.
- ❌ **Timers** (60s/120s interval, match clock) — umpire-tier; a casual board showing a ticking clock reads as clutter. Reserve the field; surface only in a dedicated umpire mode.
- ❌ **Shuttle speed / rally length / Hawk-Eye landing spot** — broadcast aspiration, not the main board. Enrichment layer only.
- ❌ **Faults, service-error type, misconduct cards** — pro-umpire ledger; off the casual board entirely.
- ❌ **A second accent colour, a gradient, or a "vs" divider graphic** — the blend law is one green (lead/live), one hard shadow, one frame. A "VS" badge, flags, or team-colour fills all violate it. Names + a center seam already separate the sides.
- ❌ **Both scores in green** — green means *leading*. Only the leader's numeral is green; a tie makes **neither** green. Two green scores destroys the one cue the colour carries.
- ❌ **Action buttons (undo, correct-serve, point taps)** — those belong to the *scorer* surface. The board is read-only broadcast; keep controls off it so the audience view and the cast view are identical and clean.
- ❌ **Instructional/help text on the board** ("tap to score", "swap ends now") — guidance is HiFi-soft and lives *outside* the black card as an inline banner, never printed on the record itself.

**The discipline:** the black hero card holds five facts. Anything that wants in must evict one of the five — and nothing beats score, serve, phase, games, or context. So nothing else gets in. Everything else in the product renders *around* the board, not *on* it.

---

**Board = five facts, ruthlessly ranked, one green, one shadow, read across a room. Everything else lives elsewhere.**
