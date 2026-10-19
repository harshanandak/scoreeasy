# Volleyball — DECISIVE FINAL DESIGN (locked, buildable)

**Date:** 2026-07-26 · **Status:** LOCKED SPEC — supersedes the four working docs (`research.md`,
`main-scoreboard.md`, `scorer.md`, `live-innovations.md`) where they conflict.
**Design system:** design1-mono (brutalist shell × HiFi-blend), governance FROZEN. `--se-*` /
`--se-blend-*` tokens only, never raw hex. Pure-black ink, ONE hard offset shadow, mono tabular
numerals. **Green = live / lead / serve accent ONLY. No new colours.** The escalation ladder
(SET → DEUCE → SET POINT → MATCH POINT) IS the state encoding — never a new hue.
**Lineage:** ports the cricket flat-black dual-team hero, Big-5 thumb-zone scorer, spectator
skeleton, and optional on-demand tracking sheet verbatim. Same skeletons, volleyball brain.

---

## 0. Design thesis (one line)

**A game-brain scorer as fast as a dumb counter — one thumb, two targets — that derives everything
(serve, side-out, deuce, set-close, best-of-N) and ships a free, momentum-first, shareable watch
experience the pro tools never bother with.**

---

## 1. CRITIQUE — what survived, what was cut

The four docs are strong and internally disciplined. The scorer and board pass cleanly. The cut is
almost entirely in `live-innovations.md §4`, which over-claims that every "adoption" feature is
"cheap to build on the existing log." Several are not — they depend on realtime infra or a
persistent player/team identity that the casual flow **deliberately omits**. Honest sequencing:

| Item | Verdict | Reason |
|---|---|---|
| Lean scorer (two targets, strip, inline handoffs, guided/quick) | **KEEP as-is** | Genuinely lean + un-fumbleable. Two-way rally outcome collapses to Big-2. Nothing to trim. |
| Main scoreboard (5 fields State A / 7 State B) | **KEEP as-is** | Glanceable, holds the line, reads at 6m. |
| Momentum worm + point-run band | **KEEP — ship-first** | ZERO taps, log-derived, THE signature. Real value. |
| Serve / side-out takeover strip | **KEEP — ship-first** | ZERO taps, genuinely volleyball, free. |
| Key-moments feed (auto from log) | **KEEP** | Free, emotional transcript, no tagging. |
| Signature moments (7, tokenized, reduced-motion) | **KEEP** | Within frozen budget: one pulse, one inversion. |
| Share link + auto result card | **KEEP — easy win** | Read-only static render of the live screen. The growth loop. |
| 15-second setup + presets | **KEEP — easy win** | Table stakes; wins the trial. |
| Zone-capture tracking layer | **KEEP but OPTIONAL / on-demand / future-lean** | ONE opt-in tap. Never blocks core. Easy to add later, not day-one. |
| Rotation wheel | **KEEP, formal-mode-gated** | Needs a lineup; off casual path. |
| **Spectator reactions (4.3)** | **CUT from core → FUTURE (needs realtime)** | Live presence + reaction bursts require websockets/live-sync infra the read-only share link does NOT. Emoji glyphs (🔥🏐👏) also nibble the no-new-colour rule. Ships after a realtime layer exists. |
| **Player milestones + season card (4.4)** | **CUT from core → FUTURE (needs identity/accounts)** | Requires persistent player identity, accounts, season data model — none of which the zero-roster casual flow has. Formal-mode + login only. Heavy; post-adoption. |
| **Rivalry / head-to-head (4.5)** | **CUT from core → FUTURE (needs team identity resolution)** | Casual teams are ad-hoc labels ("Red/Blue"); H2H resolution is unreliable without stable team IDs. A nice history query later, not now. |
| **Bracket / league mode (inside 4.2)** | **DEFER → FUTURE (bigger than setup)** | Fixture generation + advancing bracket + standings is its own screen. Setup itself is the easy win; league mode is a wave-2 feature. |

**Governance note (build gate, not a claim):** the match-won "gold" card is asserted by the docs to
be the single inherited cricket inversion token. Before building, confirm it resolves to the
cricket match-won token and is NOT a new hue. It is used **exactly once** (match won). If it does
not already exist in the frozen blend, it does not ship.

---

## 2. THE SCORING MODEL (the single source of truth)

**Persisted truth = `rally log + format`. Everything the UI shows is a read-only derivation.**
Undo and edit-past are **replay-forward** — identical discipline to cricket's `deriveInnings`.

### 2.1 The rally is the atom
Rally-point scoring: every rally ends in a point for one side. **One rally = one tap to one of two
teams, always.** No null outcome. The operator taps *only who won the rally*.

### 2.2 What the engine derives from that single tap
`deriveSet(rallies, format)` and `deriveMatch(sets, format)` compute — the operator enters NONE of it:

- **Score** (pointsL, pointsR).
- **Server** — the rally winner serves next; if the winner was the *receiving* team it is a
  **side-out** (they win serve + rotate). Derived purely from the rally log + who served first.
- **Side-out flag**, rotation (formal only), **deuce**, **set-point**, **match-point**.
- **Set close** (target reached with a 2-lead), **ends-switch** prompt, **deciding-set switch at 8**.
- **Sets-won**, match winner, margin, set line.

### 2.3 The format object (drives every gate + preset)
```
Format {
  target: 25,            // points to win a normal set
  winBy: 2,              // lead required (win-by-2 default; win-by-1 for PVL preset)
  cap: null,             // null = uncapped; e.g. 27 = hard cap (Indian ground reality)
  decidingTarget: 15,    // deciding-set target
  decidingSwitchAt: 8,   // ends switch when a side reaches this in the deciding set
  setsToWin: 2,          // Bo3 = 2, Bo5 = 3, single-set (Bo1) = 1
  startServe: 'L'|'R',   // who served first (chosen once at setup)
}
```
- **Bo1 (single set) is first-class:** `setsToWin = 1`, so the first set close IS the match close —
  same handoff fires, no special-casing.
- **Ends switch after every set; serve alternates** — the team that did NOT serve the previous set
  serves next. Derived, never entered.

### 2.4 Exact derived-flag definitions (lock these)
- `isDeuce` = both scores ≥ (target − 1) AND scores tied. Recurs at 24-24, 26-26, … (re-tints, never brighter).
- `isSetPoint(T)` = for leader T: `(scoreT + 1 ≥ target) AND (scoreT + 1 − scoreOther ≥ winBy)`, respecting `cap`.
- `isMatchPoint(T)` = `isSetPoint(T)` in a set where a set win gives T `setsToWin`.
- `pointRun` = current streak of consecutive points by one side (feeds momentum + flare).

### 2.5 Setup presets (Indian ground reality, chosen once)
`Bo3 to 25` (default) · `Single set to 25` · `Single set to 15` · `to 21, cap 23` · `PVL-style to
15, win-by-1` · `Custom`. The engine never hard-codes FIVB numbers — presets are just Format values.

---

## 3. THE FOUR SCREENS

### 3.1 SCREEN 1 — SETUP (< 15s, zero-roster)

Two labels + a preset chip + who-serves-first → **Go**. No roster, ever, in casual mode.

```
┌──────────────────────────────────────────────┐
│  New match                                     │
│  ┌─────────────┐   vs   ┌─────────────┐        │  ← two labels: "A"/"B", "Red"/"Blue", section names
│  │  KBS         │        │  AHV        │        │     (3-char code auto-derived: name.slice(0,3))
│  └─────────────┘        └─────────────┘        │
│  Format:  [Bo3 to 25▾]  (preset chips)         │  ← §2.5 presets; Custom opens Format fields
│  First serve:  ( KBS )  ( AHV )                │  ← sets startServe
│  ▸ Formal mode (lineup, libero, rotation)  ○   │  ← OFF by default; opt-in toggle
│  ▸ Zone tracking (1 opt-in tap/point)      ○   │  ← OFF by default (§3.5 optional layer)
│                                                │
│         ┌──────────────────────────────┐       │
│         │        START MATCH  →         │       │
│         └──────────────────────────────┘       │
└──────────────────────────────────────────────┘
```
- **Formal mode** and **Zone tracking** are the only two toggles, both OFF. Casual never sees a roster.
- Formal mode ON adds an optional lineup step (names, libero) — the ONLY place a roster is entered.

### 3.2 SCREEN 2 — LEAN SCORER (the operator console)

Reuses `main-scoreboard.md` State A as a **pinned, inert, read-only hero** at top; adds one control
strip + two giant targets pinned in the thumb arc. **Tap frequency increases downward.**

```
┌──────────────────────────────────────────────┐
│  ‹  Sunday Cup · Final           ● LIVE   ⋯    │  ← topbar (rarest: back · ⋯ More)
├──────────────────────────────────────────────┤
│  ▸ KBS            SET 3            AHV         │  ← PINNED HERO (State A, read-only glass, NOT tappable)
│   22            SET POINT           24        │     glance-only. Codes · serve ▸ · two big numbers ·
│  ▓▓▓▓▓                            ▓▓▓▓▓        │     phase spine · green wash on leader · sets pips
│  ● ●              sets             ● ○         │
├──────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌────────┐            │  ← CONTROL STRIP (secondary, mid-reach, hairline gap
│  │ ↩ UNDO │  │ T.O ●● │  │ T.O ● ○ │           │     below hero, ABOVE targets): Undo · T.O-L · T.O-R
│  └────────┘  └────────┘  └────────┘            │     T.O dots = remaining; greys + warns at 0
│   POINT TO                        POINT TO     │  ← tiny captions
│  ┌─────────────────────┐ ┌───────────────────┐│
│  │      ▸ KBS          │ │        AHV        ││  ← TWO GIANT TARGETS (dominant 3×, pinned bottom,
│  │       22 →          │ │        24 →       ││     clamp(112px,20vh,148px) each, half-width).
│  │      POINT          │ │       POINT       ││     Serve ▸ on serving side · team colour pip ·
│  └─────────────────────┘ └───────────────────┘│     live count echoed inside.
│      Full scorecard ›          Share live ↗    │  ← quiet leave-console links
└──────────────────────────────────────────────┘
```
**Locked laws:** max-width 390px, single column, `100dvh` + `env(safe-area-inset-bottom)`. On tap:
120ms flat `--accent` flash (only motion), hero re-derives, serve glyph flips on side-out. No modal,
no confirm, no second tap. **No third primary button.** Pinned hero is inert (no accidental taps).

**Anti-fumble core:** geometry kills mis-tap (own half); serve `▸` printed on the winning-side
button kills "who serves?"; auto handoffs (§3.2.1) kill "switch ends / which set / deuce."

#### 3.2.1 Inline handoffs (engine-triggered, never operator-hunted)
The two giant targets are **replaced in place** by a single focused card when a boundary flag flips:
- **Set close → end-switch:** engine states the two derived facts (ends switch · who serves next).
  One tap `START SET n`. `↩ Not yet` = undo the closing rally. **Two taps total per set transition.**
- **Deciding-set switch at 8:** thin inline banner `⇄ SWITCH ENDS` + `Done`. Never blocks a rally;
  scoring through it dismisses it, switch still recorded (ends are cosmetic to score).
- **Timeout:** dots-remaining button; tap decrements + quiet toast + resume bar. Hard-warn at 0
  ("No timeouts left"), never decrements below zero. No countdown on lean path.
- **Match close:** targets replaced by the ONE gold result card (§4 moment 7) — result + set line +
  Share / Rematch.
- **Subs / libero:** formal mode only, in `⋯ More` sheet (6 subs/set counter; libero unlimited,
  doesn't decrement). Never on the two-target flow.

#### 3.2.2 Guided (default) vs Quick mode
Guided = everything above, confirmations on, formal actions hidden. **Quick mode** (one opt-in
toggle) strips *confirmations only, never the game brain*: set-close auto-advances (~2s flashed,
still undo-able), deciding-switch auto-dismisses, timeout toast skipped. Targets, derivation, ladder,
Undo identical. Nothing to densify — the core is already two buttons.

#### 3.2.3 Kept OFF the scorer (holds the line)
No per-rally reason tags · no rotation wheel/positions on primary surface · no momentum/side-out%
(those are reads → spectator) · no full scorecard · no manual serve entry / score-typing / ± steppers
· no technical-TO automation / challenge / clock · no second colour / decorative motion · no feature
menus (one `⋯ More` holds genuine rarities: fix first server, subs/libero, Quick toggle, direct
score-correction for genuine desync, end match).

### 3.3 SCREEN 3 — MAIN SCOREBOARD (LIVE) — the watch surface

The irreducible glass board is the **hero inside** this screen; below it sits the free, log-derived
momentum layer. This is the OBS lower-third / gym-wall board AND the top of the spectator watch.

**The board (5 fields State A / +2 State B) — locked hierarchy:**
1. **Two current-set points** — DOMINANT, 2.6–4rem mono, largest by 3×. `deriveSet().pointsL/.pointsR`.
2. **Team codes** — 3-char mono caps + optional colour pip. `team.code ?? name.slice(0,3)`.
3. **Sets-won pips** — the actual match state; small but NEVER omitted. `deriveMatch().setsWonL/R`.
4. **Serve glyph `▸`** — green, serving side only, flips on side-out. `deriveSet().servingSide`.
5. **Phase spine (ONE slot)** — `phaseLabel()`: MATCH POINT ▸ SET POINT ▸ DEUCE ▸ `SET n`.
   Never two at once. Ladder tint, no new hue.

Leading side's number carries `--se-blend-green-wash` (green = lead). ONE live dot. **State B**
(stadium/spectator top) adds exactly two: **timeouts-remaining dots** + **per-set line**
(`25–23 · 23–25 · 21▸`). Nothing in B shrinks the two numbers. The board **reads, never computes.**

**Below the board (Live watch, all ZERO extra taps, log-derived):**
```
├──────────────────────────────────────────────┤
│  ⟿ MOMENTUM                    KBS on serve 6▸ │  ← point-run "now" band (ALWAYS visible, 1 line).
│  ░░▓▓▓▓█████░░░▒▒▒▓▓▓▓▓▓ ← KBS ·6· run          │     THE signature. green=lead mass, danger=other,
│                                                │     cursor at live point. THIS is the wagon-wheel.
├──────────────────────────────────────────────┤
│  ▾ Set swing · this set        lead ±  KBS +4  │  ← collapsed <details> worm (one bar per run segment)
├──────────────────────────────────────────────┤
│  NOW   Serving ▸ KBS · 6 straight · side-out?  │  ← now-card. casual: streak + last-point shape.
│        Last point  KILL · line 4→1 (if tagged) │     formal adds On-court names.
├──────────────────────────────────────────────┤
│  KEY MOMENTS  (auto from log, reverse-chron)   │  ← runs≥5, set/match point, set close, comeback,
│  21▸  SET POINT · KBS lead 21–19, serving      │     ace/kill/block ONLY if zone-tagged. No taps.
│  18   RUN · KBS 5 straight on Nair's serve     │
├──────────────────────────────────────────────┤
│  👁 312 watching        [ Following ✓ ]         │  ← presence footer (watchers + Follow). Reactions
└──────────────────────────────────────────────┘     = FUTURE (needs realtime; see §5).
```
Balance rule: hero is the only heavyweight; band is one line; worm/now-card collapse; feed is the
only scroll region. Whole story in one screen height, depth on scroll.

### 3.4 SCREEN 4 — SCORECARD (Sets + Stats tabs, read between rallies)

The board stays pinned at top; tabs swap the body.
- **Sets tab:** per-set score table (points, side-out %, longest run, set duration; aces/blocks/errors
  *only if* zone-tagged), + rotation wheel (formal mode only, log-derived from lineup).
- **Stats tab:** team & player stat panel (all log-derived free) + the **zone heat read** (only
  populated if zone tracking was on) + **clutch/set-point conversion** (free, no zone needed:
  "KBS 3/4 set points won").

Everything here is a **read** on the rally log, or a bonus of the opt-in zone tap. A match scored
with zero zone taps still has a complete Sets tab, clutch read, side-out%, and momentum — the zone
layer only ever *adds* heat maps.

### 3.5 THE OPTIONAL ZONE-TRACKING LAYER (on-demand · easy-now-optional · future-lean)

**Status: optional, off by default, one opt-in tap per point, NEVER blocks the core flow.** Borrows
exactly ONE idea from DataVolley (origin/target zone) without its contact-coding burden. This is
volleyball's tap-to-place analogue and is **easy to add now as opt-in**, but is not required for the
trial and can trail the core build.

- **Entry:** only if "Zone tracking" was switched on at setup. After a point, a thin dismissable
  prompt slides into the **control-strip zone (never over the giant targets' airspace)**:
  `📍 Where was the point won? [tap court] [skip]`. Scoring the next rally auto-dismisses it. A fast
  scorer never looks at it. **Lock: the prompt must never overlay the two targets — mis-tap safety.**
- **Capture sheet:** point-TYPE chips (Kill/Ace/Block/Opp error, sticky — defaults to last used) +
  the 6-zone court (standard numbering, 1 = back-right/server). One zone tap = whole capture.
  Kill/Block → landing zone on opponent floor; Ace → serve landing; Opp error → zone optional/greyed.
  Court orientation follows *which team won* so "zone 4" always means the same to a reader regardless
  of the every-set ends-switch.
- **Writes** one enrichment record on the rally: `{rallyId, winTeam, type, zone:1–6|null, playerId?}`.
  Player attribution auto-fills from lineup in formal mode (long-press to override); casual = team+zone.
- **Downstream (all read-only derivations):** team attack heat, player zone signature (formal),
  serve map, live-feed line upgrade, set-point-by-zone clutch. All in the Scorecard Stats tab.

---

## 4. SIGNATURE MOMENTS (tokenized, reduced-motion-gated, capped budget)

Seven beats, each a named token (`--moment-*`) — you cannot add a beat without adding a token (the
governance choke point). Budget: **ONE live pulse, ONE inversion, no second hue, no decorative
motion.** The escalation ladder IS the encoding. Every animation wrapped in
`@media (prefers-reduced-motion: reduce)` → the **state/tint still applies instantly, only the
transition is removed.**

| # | Moment | Trigger | Beat | Restraint |
|---|---|---|---|---|
| 1 | SET POINT | `isSetPoint` | phase spine → `SET POINT` warning tint, 200ms tint-in; target pips fill | no pulse; re-fires on each re-reach |
| 2 | MATCH POINT | `isMatchPoint` | phase spine → `MATCH POINT` danger-soft tint + the ONE live pulse migrates here | the only place the pulse moves; no inversion |
| 3 | DEUCE | `isDeuce` | phase spine → `DEUCE` warning-soft tint + hairline tie-underline on the two numbers | same tint re-applied, never brighter; kills deuce confusion |
| 4 | POINT-RUN FLARE | run crosses 5, then +1 | band streak label steps one ladder tint brighter; 120ms width-grow on fill | caps at top tint; number differentiates, not brightness; no confetti |
| 5 | SET WON | `isClosed` | soft card slides 150ms into end-switch space: sans sentence + mono line | one slide, auto-dismiss next set; the ONE sans intrusion |
| 6 | COMEBACK / SET-POINT SAVED | trailing side erases a set point or wins from ≥N down | quiet feed row gets danger→green tint-flip on its label | quietest beat; feed only, never seizes hero |
| 7 | MATCH WON | `isComplete` | THE gold milestone card (single allowed inversion): result + mono set line + Share/Rematch; 200ms scale-in | the only inversion in the product; confirm it's the inherited cricket token (§1) |

---

## 5. ORDERED BUILD PLAN

**Wave 1 — the game brain + the two surfaces that win the trial (core, ships together):**
1. **Scoring engine** — `Format`, rally log, `deriveSet` / `deriveMatch`, all flags (§2.4),
   undo = replay-forward, presets (§2.5). Pure, headless, unit-tested against FIVB + every preset
   (Bo1/to-21/cap/PVL). Foundation for everything.
2. **Main scoreboard component** (State A / State B) — the shared inert hero. `phaseLabel` + ladder
   tints + green wash + serve glyph. Reused by scorer, board, spectator.
3. **Lean scorer console** — two giant targets, control strip (Undo · 2× T.O), inline handoffs
   (set-close, deciding-switch, timeout, match-close), guided + Quick mode. Reuses hero (2) inert.
4. **Setup screen** — two labels + preset chip + first-serve + two toggles. < 15s to START.

**Wave 2 — the free watch experience (the empty-middle differentiator):**
5. **Spectator/live watch surface** — hero (2) + momentum "now" band + collapsed set-swing worm +
   now-card + auto key-moments feed. All ZERO-tap log-derived. Tabs: Live / Sets / Stats.
6. **Signature moments** — the 7 tokenized beats, reduced-motion-gated. (Confirm gold inversion token.)
7. **Scorecard** — Sets tab (per-set table, side-out%, longest run) + Stats tab (log-derived team/
   player panel + clutch/set-point). No zone data required.
8. **Share link + auto result card** — public login-free read-only URL of the live screen; gold
   result card renders to a shareable image on match end. The growth loop / acquisition engine.

**Wave 3 — optional enrichment (easy, opt-in, not required for adoption):**
9. **Zone-tracking layer** — setup toggle, on-demand prompt (never over targets), capture sheet,
   enrichment record, Stats-tab heat/serve-map/player-signature. Purely additive.
10. **Rotation wheel** — formal-mode, log-derived from lineup, Sets tab.

**Wave 4 — FUTURE (need infra/identity the casual flow omits — flag, don't build day-one):**
11. **Spectator reactions** — requires realtime/websocket layer; also watch the emoji-colour nibble.
12. **Bracket / league mode** — fixture generation + advancing bracket + shareable standings.
13. **Player milestones + season card** — needs persistent player identity + accounts + season model.
14. **Rivalry / head-to-head** — needs stable team-identity resolution across matches.

**Discipline that gates every future item:** does it answer *who's winning / which way is it
swinging / what just happened*, or grow the share loop, for **zero cost on the two-target scoring
path**? If it taxes the core tap, or needs infra/identity we don't have, it waits.
