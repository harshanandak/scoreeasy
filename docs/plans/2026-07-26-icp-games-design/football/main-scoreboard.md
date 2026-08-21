# ScoreEasy — Football: THE MAIN SCOREBOARD

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the single most important screen) · **Game:** Association Football — Indian college / university / turf ICP.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN).
**Grounds on:** `research.md` §2.1 (the leanest score bug of any major sport), `design-brief.md` §4, the cricket dual-team hero (`cricket-spectator-clean.html` `.hero`) and the black scorer hero (`cricket-scorer-alt-big5.html` `.ck-hero`).

**What this document is:** the definition of the *board* — the glanceable live surface a player mid-pitch, a friend on their phone, and a crowd across a turf all read in under one second. This is football's score bug. It is not the scorer console (that logs events) and not the scorecard (that lists them). It is the one number everyone looks up at. Everything here is in service of **readable across a room**.

**No new colours.** `--se-*` / `--se-blend-*` only. Green = lead/live/primary. The escalation ladder (yellow→warning, red→danger) covers cards. Gold is reserved for the final result and never appears on a live board.

---

## 1. Hero board anatomy — exactly what shows

Football's real-world board is the **leanest in sport** (research §2.1): team codes, the two-digit scoreline, the count-up clock. Nothing else earns permanent residence. Our board carries **exactly four things**, in a strict hierarchy. If a fifth thing wants on, it goes to the timeline or the scorecard — not here.

### The four glance-elements (in hierarchy order)

**① THE SCORELINE — the emotional payload (rank 1, largest).**
`2 – 1`. Two big mono tabular numerals with an en-dash between. This is the single largest object on the board — a player 40 metres away reads *this* first, then everything else. Numerals are `--se-font-mono`, weight 800, `font-variant-numeric: tabular-nums` so they never jitter as they tick 0→1→2. The dash is muted; the numbers are ink (compact) or inverse (hero-black).

**② THE TWO TEAM IDENTITIES — who (rank 2).**
Home team **left**, away **right** (broadcast convention, research §2.1). Shown as an **initial squircle** (crest treatment ported from cricket Wave-0) + a **3-letter uppercase code** in mono (`MUN`, `ENG`, `ARS`). Full team name is *not* on the compact board — it doesn't survive the room-distance test and it breaks the symmetric layout. Code + crest is the identity; the full name lives in the header title and the INFO tab.

**③ THE MATCH CLOCK + PHASE — where we are (rank 3).**
Football's spine. A **count-up clock** (`67:14` or `67'`) that a mid-match viewer reads to instantly know how far along the game is — the exact reason Sky introduced the persistent count-up (research §1.1). It sits **dead-centre between the two teams** (cricket puts the game-state in `.hero-mid`; football puts the clock there — same slot, football's spine instead of the over count). Directly paired with it, the **phase label**: `H1` / `HT` / `H2` / `ET` / `PENS` / `FT`. In stoppage the clock reads `45+2` / `90+3` — the phase and the clock together are one unit. The clock is brutalist: mono, tabular, non-jittering.

**④ STATE RIDERS — small, only when true (rank 4, conditional).**
These appear *only* when their condition is live, never as empty scaffolding (research §2.1: "small, only when true"):
- **●LIVE** dot — the single pulsing element on the whole board (`.se-blend-pulse`, reduced-motion gated), in `--se-color-danger` per the cricket `.live` convention. Present whenever the clock is running; replaced by a static `FT` / `HT` stamp when it is not.
- **Short-handed `⑩`** — a small circled-10 rider beside a team's code the moment a send-off drops them to ten men, with the minute it happened available on the fuller board. This is the one live tactical fact that changes how the whole match is read, so it earns board space; nothing else card-related does.
- **Stoppage badge `+3`** — the fourth-official number, shown next to the clock only during added time.

### The ONE context datum

Cricket's hero carries one derived context line ("Royals need 23 off 16"). Football's honest equivalent is **not** a win-probability or an xG figure — the casual ledger can't feed those (research §5.2, the win-prob discipline). Football's one context datum is **the phase read in plain language when it carries tension**, and otherwise nothing:
- **Level game, first half:** no context line. The scoreline + clock *is* the whole story. Resist filling the space.
- **A team leads:** the green lead-wash behind the leading side *is* the context — it says "who's winning" without a word.
- **Late + close (`80'+`, margin ≤1):** an optional single mono rider — `13 MIN LEFT` or, in a slot-limited turf decider, `NEXT GOAL WINS`. This is the only computed context datum, it is honest (pure clock arithmetic + house-rule), and it only appears when the match is actually tense.

**Everything else a viewer might want — scorers, assists, cards list, possession, momentum — is NOT on the board.** It lives one layer down (timeline / scorecard). See §4.

### Visual hierarchy (the room test)

```
        SCORELINE  (biggest — read at 40m)
           ↓
   TEAM CODES + CREST   ·   CLOCK + PHASE   (read at 10m)
           ↓
   LIVE dot · ⑩ · +stoppage · context rider  (read at arm's length only)
```

Size ratio on the compact board: scoreline numerals ≈ 2.6rem, team code ≈ 0.625rem, clock ≈ 0.9rem. The scoreline dwarfs everything — that asymmetry *is* the design. A board where the clock competes with the score has failed the room test.

---

## 2. Two states

Both states are the *same board* at two densities. The compact board is the default persistent surface (it sits atop the scorer console and the spectator LIVE tab); the hero is what a dedicated "live screen" / cast-to-a-TV / full-bleed spectator view renders.

### State A — COMPACT LIVE BOARD (default)

The persistent bug. One black card, `.ck-hero` treatment (flat ink background, `--shadow` hard offset, `--se-radius-card`). Green lead-wash sits behind the leading team's half of the card only; a level match or draw is neutral ink throughout. Height ≈ one cricket hero. This is what rides above every operator and spectator screen — it must be dense, symmetric, and instantly parseable.

- Teams: crest + 3-letter code, one line each, left/right.
- Score: 2.6rem mono numerals, centre-weighted.
- Clock+phase: centred between teams, 0.9rem mono.
- Riders: LIVE dot top-corner; `⑩` inline with the short team's code; `+3` beside clock in stoppage.
- Context rider: only the late-close line, only when it fires.

### State B — LIVE-SCREEN HERO (fuller)

The lean-back / cast surface — a friend props the phone against a bottle on the sideline, or it goes on a laptop for the crowd. Same four elements, **bigger and calmer**, plus *exactly two* concessions to the extra real estate — no more, or it stops being a board:

1. **Scoreline goes huge** (≈5–6rem) and the team codes promote to **full team names** in sentence-case sans below the crest (room allows it; the name-density rule from the brief §5 means names are sans, never uppercased).
2. **One line of last-goal context** under the divider: the most recent goal as a plain caption — `⚽ RASHFORD 67'` — echoing the broadcast goal-caption (research §2.2) but *static and singular* (the latest goal only, not a feed). This is the fuller board's single richness; it turns the bug into a story without becoming a timeline.

The LIVE-screen hero still refuses the scorers list, the card list, possession, and momentum. Those are a scroll away on the spectator surface — never on the board itself. The hero's job is to be beautiful and legible from the far touchline, not complete.

**The takeover moment (both states):** when a goal is confirmed, the board briefly becomes the goal caption — scorer • assist • minute • new scoreline — score numeral pops (reuse cricket's score-pop), then it settles back. This is the board's one animated beat (drama beat #1, research §5.1); reduced-motion gated; the pulse otherwise stays reserved for the live dot only.

---

## 3. Wireframe + data bindings

### State A — Compact live board (leading team = home)

```
┌──────────────────────────────────────────────────┐  ← .ck-hero (flat ink, --shadow)
│                                          ● LIVE   │  liveDot: clock.running
│                                                   │
│  ◆ MUN              2  –  1              ARS ◆    │
│  (crest)                                 (crest)  │
│  ‹green lead-wash L half›     ‹neutral R half›    │
│                                                   │
│                  H2 · 67:14                        │  ← clock centred, phase paired
│                                                   │
│  ────────────────────────────────────────────    │
│                  13 MIN LEFT                       │  ← context rider (only if late+close)
└──────────────────────────────────────────────────┘

Short-handed variant (away sent off):   ARS ⑩  ◆
Stoppage variant (clock):               H2 · 90+3   +3
Half-time variant:                      HT   (static, no live dot, no wash change)
Full-time variant:                      FT   (static; loser code at reduced opacity)
Draw variant:                           2 – 2   both halves neutral, no wash, "FT · DRAW"
```

### State B — Live-screen hero (fuller)

```
┌──────────────────────────────────────────────────┐
│  SUNDAY CUP · FINAL                       ● LIVE  │
│                                                   │
│    ◆                                         ◆    │
│  Man Utd                                  Arsenal │  ← full names, sans
│                                                   │
│        2         –         1                      │  ← ~5.5rem numerals
│                                                   │
│                 H2 · 67:14                         │
│  ────────────────────────────────────────────    │
│            ⚽ RASHFORD  67'                         │  ← latest-goal caption (static)
└──────────────────────────────────────────────────┘
```

### Exact data bindings

All values are **derived from the event-sourced match engine** (brief §8) — the board stores nothing of its own. The score is a projection of goal events, never a stored counter (the anti-goal law).

| Board slot | Binding (engine → view) | Notes |
|---|---|---|
| Home code / name | `match.teams.home.code` / `.name` | code = 3-letter upper mono; name = sans sentence-case (hero only) |
| Away code / name | `match.teams.away.code` / `.name` | right-aligned |
| Crest | `team.crestInitial` on `team.accent` squircle | ported from cricket; falls back to first letter of name |
| Home score | `goals.filter(g => g.creditedTo === 'home').length` | **derived** — includes opponent own-goals credited home; excludes own-goals from personal tallies |
| Away score | `goals.filter(g => g.creditedTo === 'away').length` | same derivation |
| Clock | `clock.displayMinute` → `MM:SS` or `MM+S'` | count-up; stoppage renders `45+2` / `90+3` |
| Phase label | `clock.phase` ∈ `{H1,HT,H2,ET1,HT2,ET2,PENS,FT}` | `HT`/`FT` static; running phases pair with clock |
| Stoppage badge | `clock.stoppageAdded` (int) → `+N` | render only when `> 0` and phase running |
| LIVE dot | `clock.running === true` | `.se-blend-pulse`, `--se-color-danger`; hidden when paused/HT/FT |
| Lead-wash side | `homeScore <=> awayScore` → wash behind higher; none if equal | `--se-blend-green-wash`; governance rule 1 (green = lead) |
| Short-handed `⑩` | `team.onPitchCount < team.formationSize` (derived from send-offs) | rider beside that team's code + `since NN'` on hero |
| Context rider | `phase running && minutesLeft <= 15 && abs(margin) <= 1` → `"{N} MIN LEFT"`; turf golden-goal house-rule → `"NEXT GOAL WINS"` | the ONLY computed context line; else absent |
| Latest-goal caption (hero) | last `goals[]` → `⚽ {scorer.name|"Unknown #"+num} {minute}'` | static; own-goal renders `⚽ OG · {minute}'` |
| FT loser opacity | `phase === 'FT'` → losing side code at `opacity: 0.55` | winner full ink; draw = both full |

---

## 4. What NOT to put on the board (resist clutter)

The board's whole value is that it is the *leanest* surface. Every item below is real, useful, and belongs somewhere — **just never on the board.** This list is the design's spine; treat additions as regressions.

- **NO scorers / assists list.** The most-requested addition and the most corrosive. One goal caption on the *hero* is the ceiling; the full list is the timeline and scorecard. A board that lists three scorers per side is a scorecard wearing a board's costume.
- **NO card list, no bookings tally, no fouls.** The board shows a red card *only* as its consequence — the `⑩` short-handed rider. The yellow/red events themselves live on the timeline. A resting red slab is a governance violation ("delete") anyway.
- **NO possession %, shots, shots-on-target, corners.** These are the half-time stat panel (research §2.2), a summoned overlay — not persistent. The casual ledger can't even feed most of them honestly.
- **NO momentum bar / xG / win-probability on the board.** Momentum is a candidate for the *spectator surface below* (brief §4), derived and labelled as such. It is never on the bug. Win-prob/xG we don't have honest inputs for — faking them breaks the cricket win-prob discipline.
- **NO full team names on the compact board.** Codes only. Names break symmetry and fail the room test; they return only on the roomy live-screen hero.
- **NO substitutions, formations, or lineups.** Match-qualifying detail, not score. Timeline and INFO tab.
- **NO decorative motion.** One pulse (live dot) + one score-pop (on a goal). Nothing else moves — rubric law. No ticking-second animation, no gradient sheen, no crest shimmer.
- **NO more than one gold element — and not even one, live.** Gold is the final-whistle result card, a *different* surface. A live board never wears gold.
- **NO second accent colour for "team colour."** Green is lead/live only; team identity is the crest squircle + code, never a hero fill. (Governance rule 1.)
- **NO stat that requires reading — the board is for glancing.** If an element needs a second look to parse, it is the wrong altitude for this surface. Push it down a layer.

**The test for any proposed board element:** *can a player read it in one second from across the pitch, and is it true right now?* If either answer is no, it is not a board element. The scoreline, the two codes, the clock, and (only when true) the four riders pass. Nothing else does.

---

## Summary

The football main board is **`TEAM ⇢ n – n ⇠ TEAM` + a centred count-up clock with its phase label**, on a flat-ink `.ck-hero` card with a hard offset shadow, a green wash behind the leading side, one pulsing live dot, and — only when true — a short-handed `⑩`, a stoppage `+N`, and a single late-and-close context rider. Two densities: the compact persistent bug (default) and a fuller live-screen hero that promotes to full names + one latest-goal caption. The score is always a derived projection of attributed goal events, never a stored counter. Everything richer than these four things lives one layer down. The board's discipline is its product: it is the number the whole ground looks up at, and it stays readable because it refuses to be anything more.
