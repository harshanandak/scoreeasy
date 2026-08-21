# Volleyball — THE MAIN SCOREBOARD

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the single most important screen)
**Feeds:** `design-brief.md` §4 (spectator hero) + §5 (blend) · `research.md` §2.1 (the score bug anatomy)
**Design system:** design1-mono (brutalist shell × HiFi-blend), governance FROZEN. `--se-*` / `--se-blend-*`
tokens only, never raw hex. Pure-black ink, ONE hard offset shadow, mono tabular numerals, **green =
live/lead accent ONLY** — no new colours.
**Lineage:** ports the cricket **flat-black dual-team hero** verbatim
(`cricket-scorer-alt-big5.html` `.ck-hero`, `cricket-spectator-clean.html` `.hero`). Same skeleton,
volleyball brain.

This doc is ONLY the glanceable live board — the thing read across a gym, the TV score bug, the stadium
LED. Not the scorer console, not the scorecard, not the momentum band. Those are richer surfaces; this is
the irreducible core that must survive being read at 6 metres.

---

## 1. Hero board anatomy — EXACTLY what shows

Real volleyball score bugs (FIVB VNL, Prime Volleyball League, NCAA, AVP) converge on **five fields and
no more** (`research.md` §2.1). We ship exactly those five. The whole board orbits the two big point
numbers; everything else is a small satellite.

### The five fields (in strict hierarchy)

| # | Field | What it is | Weight | Binding |
|---|---|---|---|---|
| **1** | **Two current-set points** | The two big numbers, one per side. THE score. | **DOMINANT** — 2.6–4rem mono, the largest thing by 3× | `deriveSet().pointsL / .pointsR` |
| **2** | **Team identities** | 3-letter mono code per side (IND, KBS) + optional colour pip | Secondary — small caps mono label above each number | `team.code ?? team.name.slice(0,3)` |
| **3** | **Sets-won tally** | The *actual match state*. Filled pips or a boxed count per side (`2` vs `1`). | Tertiary — small, but NEVER omitted (research warns it is easy to under-weight and it IS the result) | `deriveMatch().setsWonL / .setsWonR` |
| **4** | **Serve indicator** | One glyph (`▸`) on the serving side. The only "possession" a viewer tracks; flips on every side-out. | Micro — a single mark, green, adjacent to the serving team's code | `deriveSet().servingSide` (`'L'` \| `'R'`) |
| **5** | **Phase / context** | ONE datum: set number + the one state that matters right now. | Small centre spine | see §1.2 |

### 1.1 The visual hierarchy (the glance order)

A viewer's eye must land in this exact sequence, enforced by size:

```
1st glance  →  the two big numbers            "who's ahead THIS set"      (2.6–4rem)
2nd glance  →  the serve glyph + set pips      "who serves, match state"  (~0.7rem)
3rd glance  →  the centre phase line           "what set / what's at stake"(~0.8rem)
```

If a field competes with the two numbers for the first glance, it is too big. The numbers win, always.

### 1.2 Field 5 is a SINGLE slot — the one context datum

The centre spine shows **exactly one** thing, chosen by priority ladder (highest wins):

1. **MATCH POINT** — someone can win the match this rally. (danger-soft ladder tint, retains the one live pulse)
2. **SET POINT** — someone can win the set this rally. (warning ladder tint)
3. **DEUCE** — tied at target−1, win-by-2 live. (warning-soft ladder tint)
4. **SET n** — the plain default. (neutral)

Never show two of these at once. The escalation ladder (`research.md` §5.1, `design-brief.md` §5) IS the
state encoding — no new hue, no glow, no text-shadow. `SET n` degrades to just the set number when nothing
is at stake. This is the one line that carries all the drama, so it stays a single, honest slot.

---

## 2. Two states

### State A — COMPACT LIVE BOARD (default: the score bug)

The persistent bug. Fits a phone strip, an OBS lower-third, or a gym wall. This is what runs 99% of the
time. **Five fields, one black bar, nothing else.** Flat black, one hard shadow, mono everything.

- Height ~ a single hero card (`clamp(88px, 22vh, 132px)`).
- Two big numbers dominate; codes + pips + serve glyph are small satellites; one centre phase word.
- Leading side's number gets `--se-blend-green-wash` behind it (green = lead, governance rule 1).
- Serve glyph green, on the serving side only.
- ONE live dot (top-right `LIVE`), the screen's single pulse.
- **No** per-set history, **no** timeouts, **no** momentum, **no** names longer than 3 chars.

### State B — FULLER LIVE-SCREEN HERO (the stadium board / spectator top)

The same five fields, same black hero, **plus exactly two additions a viewer in the building needs**
(`research.md` §2.1 stadium tier): **timeouts-remaining dots** per side, and the **per-set line**
(`25–23 · 23–25 · 18▸`). This is the top of the spectator screen and the LED-console layout. Everything
below the hero (momentum band, reactions, key moments) belongs to the spectator screen spec, NOT here —
the board itself stops at: five fields + timeouts + set line.

The two states share ONE component. State B is State A with the timeout dots row and the set-line strip
revealed. Nothing in State B may shrink the two big numbers relative to State A — the numbers are sacred
in both.

---

## 3. Wireframes + exact data bindings

### 3.1 State A — Compact live board (score bug)

```
┌──────────────────────────────────────────────┐  ← flat black, 1 hard 3px offset shadow
│                                    ● LIVE      │  ← the one live pulse (danger dot)
│                                                │
│  ▸ KBS              SET 3            AHV        │  ← codes; serve ▸ on server (green); phase word
│                                                │
│   21                DEUCE             23        │  ← THE two numbers (dominant, mono). green wash
│  ▓▓▓▓▓             ·····            ▓▓▓▓▓       │     behind the LEADING side only
│  ● ●               sets              ● ○        │  ← sets-won pips  (KBS 2 · AHV 1)
└──────────────────────────────────────────────┘
```

Bindings:

| Slot | Binding | Notes |
|---|---|---|
| `● LIVE` | `match.status === 'live'` | the single pulse; hidden if not live |
| `KBS` / `AHV` | `teamL.code` / `teamR.code` | 3-char mono uppercase; fallback `name.slice(0,3)` |
| `▸` | `deriveSet().servingSide === 'L' ? left : right` | green glyph, serving side only; flips on side-out |
| `21` / `23` | `deriveSet().pointsL` / `.pointsR` | mono tabular, the dominant figures |
| green wash | `pointsL > pointsR ? left : pointsR > pointsL ? right : none` | leading side ONLY; none when tied |
| centre phase | `phaseLabel(deriveSet(), deriveMatch())` | ladder: MATCH POINT ▸ SET POINT ▸ DEUCE ▸ `SET n` |
| `● ●` / `● ○` | `deriveMatch().setsWonL` / `.setsWonR` out of `setsToWin` | filled = won, hollow = remaining-to-win |

### 3.2 State B — Fuller live-screen hero (stadium board)

```
┌──────────────────────────────────────────────┐  ← same flat black + 1 hard shadow
│  Sunday Cup · Final                  ● LIVE    │  ← optional context title (sans) + live pulse
│                                                │
│  ▸ KBS                                 AHV     │  ← codes + serve glyph
│   21          · SET POINT ·            23       │  ← the two big numbers + phase spine
│  ▓▓▓▓▓                               ▓▓▓▓▓      │  ← green wash behind leader
│                                                │
│  SETS ● ● ○        ─────────        ○ ● ● SETS  │  ← sets-won pips, both sides
│  T.O. ● ●                              ● ○ T.O. │  ← timeouts remaining (State B ONLY)
├──────────────────────────────────────────────┤
│  25–23  ·  23–25  ·  21▸                        │  ← per-set line (State B ONLY); ▸ = live set
└──────────────────────────────────────────────┘
```

Additional bindings (State B only):

| Slot | Binding | Notes |
|---|---|---|
| context title | `match.title` | sans, small, optional; the ONE sans element on the board |
| `T.O. ● ●` | `2 - deriveSet().timeoutsUsedL` (and R) | filled = remaining; engine warns at 0 (scorer surface, not here) |
| set line | `deriveMatch().completedSets.map(s ⇒ ` `${s.L}–${s.R}`)` + live `` `${pointsL}▸`/`▸${pointsR}` `` | mono chips (grammar-3); ▸ marks the in-progress set |

### 3.3 Phase-label function (the single source of the context slot)

```
phaseLabel(set, match):
  if set.isMatchPoint  → "MATCH POINT"   (tint: danger-soft, keep live pulse)
  if set.isSetPoint    → "SET POINT"     (tint: warning)
  if set.isDeuce       → "DEUCE"         (tint: warning-soft)   // tied at target−1, win-by-2
  else                 → "SET " + set.number   (neutral)
```

All flags come from `deriveSet` / `deriveMatch` — the board **reads, never computes** (`design-brief.md`
§1.3). Undo replays forward and the label just re-derives; the board needs zero state of its own.

---

## 4. What NOT to put on the board (resist clutter)

The board's whole value is that it is readable across a room. Every field below was considered and
**deliberately rejected** from the board — each has a home on a richer surface (scorer console, spectator
screen, scorecard), never here.

- **NO player names / rosters.** Casual ICP starts with two labels, no roster (`research.md` §3.3). Even in
  formal mode, names live on the scorecard, not the board.
- **NO momentum band / point-run worm.** It is the signature *spectator* read (`design-brief.md` §4) — it
  sits BELOW the hero on the spectator screen. On the board it would fight the two numbers. Out.
- **NO rotation wheel / serve-order / positions.** Formal-mode toggle, scorer surface only. A viewer tracks
  serve via the single `▸` glyph — that is the entire possession story a board owes them (`research.md` §2.1).
- **NO ace/kill/block/error tags, no per-rally reason.** Deferred stat layer, costs taps, near-useless at a
  glance (`research.md` §1.3). Never on the board.
- **NO set/rally clock or duration on State A.** Volleyball has no game clock; a duration is stadium garnish.
  If ever wanted, it is a State-B afterthought at the smallest weight — never competing with the score.
- **NO second colour, no gradients, no glow-for-decoration.** Green is lead/live ONLY. State is the
  escalation ladder (`SET/DEUCE/SET POINT/MATCH POINT`), never a new hue (`design-brief.md` §5).
- **NO more than ONE live pulse and ONE inversion.** Governance budget. Match point may claim the single
  inversion; that is the ceiling.
- **NO timeouts on State A**, no side-out %, no service-streak counters, no lead-change count. All are
  derived reads that belong on the spectator/scorecard surfaces — the board stays at five (State A) / seven
  (State B) fields.
- **NO team names longer than the code.** 3 chars max on the board. Full names appear in the setup echo, the
  scorecard, and the spectator context title — never inside the hero numbers' airspace.
- **NO menus, buttons, or controls.** The board operates nothing. Scoring taps live on the scorer console;
  the board is pure read-only glass. (The scorer's own pinned hero reuses this exact component — it just
  sits above the two point buttons there.)

**The test for anything proposed for the board:** *can a spectator 6 metres away read it in under one
second without it stealing a glance from the two numbers?* If no → it goes on a richer surface. The board
holds the line at five fields.
