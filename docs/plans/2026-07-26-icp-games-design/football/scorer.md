# ScoreEasy — Football: THE SCORER (lean operator console)

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the operator tool) · **Game:** Association Football — Indian college / university / turf ICP.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN).
**Grounds on:** `research.md` §1.2 (the exact events an operator must capture), §3.2 (what the casual scorer actually needs), `main-scoreboard.md` (the board this console feeds), and the cricket lean-scorer pattern `cricket/cricket-scorer-alt-big5.html` (thumb-zone via CSS `order`, most-tapped keys at the bottom, big one-tap primaries, rare actions tucked into a compact strip + a More sheet).

**What this document is:** the definition of the *console the operator holds* — a student volunteer, one phone, sun glare, no tripod, pitch-side. Its job is exactly one thing: **capture the honest event ledger — goals (attributed), cards, subs, clock — fast and un-fumbleably.** It is deliberately lean. It does **not** display the match; the glance-surface is the board (`main-scoreboard.md`) and the detail is the scorecard/timeline. If a thing can be *read* rather than *entered*, it does not belong here.

**The one law (from cricket, restated):** *attribution never blocks the log.* A goal is capturable in the two seconds after the ball crosses the line; scorer/assist/type is a fast-follow the operator can defer or skip forever. If the operator can raise the score without a two-second window being respected, we built the wrong tool.

---

## 1. The actions — primaries (the 90%) vs. the tucked-away rest

Football is not cricket-per-ball: long stretches of nothing, then a huge discrete event. So the console has **exactly two primary targets**, and everything else is rarer and smaller.

### 1.1 PRIMARY — two giant one-tap GOAL targets (the whole reason the tool exists)

The 90% case is *"a goal just happened — which side."* Two full-thumb targets, split left/right, **home left · away right** (board convention), each labelled with its own **3-letter code** so a mis-hit for the wrong team is structurally hard even under glare:

```
╔══════════════╗ ╔══════════════╗
║      ⚽      ║ ║      ⚽      ║
║    GOAL      ║ ║    GOAL      ║
║    MUN       ║ ║    ARS       ║
╚══════════════╝ ╚══════════════╝
```

- They live at the **bottom of the screen** (thumb zone, CSS `order` highest — the football analogue of the Big-5's `.big5 { order: 7 }`).
- A tap **increments the scoreline instantly** — the two-second window is served *before* any attribution. Big score-pop on the board (drama beat #1), then the console offers attribution inline (§1.2). Tap away = attribute later or never.
- Team identity is the **crest + code**, never a colour fill (green is lead/live only — governance rule 1). The two keys are visually symmetric; the only differentiator is the code, exactly as intended.

That is the entire primary surface. Cards, subs, and the clock are all secondary — they happen, but they are not *the* action.

### 1.2 The guided attribution flow (opens after a GOAL tap; fully deferrable)

Modeled on the cricket wicket key's inline `<details>` "How out?" row — **not a modal**, an inline connected panel that slides under the goal keys and can be dismissed with one tap:

```
╔═ GOAL · MUN → 2   (67')          tap away = attribute later ═╗
║  Scorer   [10 Rashford] [8 Bruno] [7 Antony] [+ add] [?Unknown]║
║  Assist   [skip]  [8 Bruno]  [11 Garnacho]  …                  ║
║  ·        ⚑ Penalty        ⤾ Own goal                         ║
╚════════════════════════════════════════════════════════════════╝
```

- **`+ add`** quick-adds a player by name/number mid-match (loose-roster tolerance, research §3.2). **`?Unknown`** attributes to "Unknown #—" so the goal is *never* blocked on a missing roster.
- **`⤾ Own goal`** is a structurally distinct choice, not an afterthought (research §1.2 — the single most-fumbled rule). Because the operator always taps *the side whose score went up*, own-goal here means "credit stays with MUN, but it was put in by an **ARS** player" — so it flips the scorer picker to the **opposing** roster and flags `noPersonalTally`. The top-scorer table can never be corrupted by an own-goal, by construction.
- **`⚑ Penalty`** tags `type=penalty` (a normal in-play goal for stats); it does **not** touch the scoreline logic. A shootout penalty is a different surface entirely (§3.4).

### 1.3 SECONDARY — one compact strip (rare, but one tap to reach)

Directly above the goal keys, a single hairline strip (the cricket `.big5-rare` / extras-strip grammar):

`🟨 Card    ⇄ Sub    ⋯ More`

- **🟨 Card** → pick side → **Yellow / Red** → pick player. The engine **derives the send-off**: a second yellow to the same player auto-flips to red and the console shows a confirm — `2nd yellow · Ravi → RED · ENG down to 10` — before committing. A straight red does the same. The operator cannot log a second yellow as "just another booking" (research §1.2 trap). The board's `⑩` rider updates automatically.
- **⇄ Sub** → pick side → **off** (from the on-pitch list) → **on** (bench or `+ add`). Minute auto-stamped. No sub cap (college rolling/unlimited subs, research §3.1).
- **⋯ More** → the bottom-sheet for everything rare (§2.3).

### 1.4 RARE — tucked into the More sheet (§2.3)

Own-goal-only entry, disallow/VAR-style goal removal, edit-last-event, extra time, **penalty shootout**, timeout, format & rules, edit teams, share-live, end-half, end-match. None of these earns a permanent pixel.

---

## 2. Thumb-zone layout

Same discipline as the cricket console: **management/glance on top, the most-tapped primary at the very bottom.** A right- or left-thumb reaches the two GOAL keys and the secondary strip without a hand-shuffle; the score readout and clock sit higher where they're *read, not pressed*.

### 2.1 ASCII wireframe (compact live state)

```
┌───────────────────────────────────────────────┐
│  ‹   MUN v ARS · College Cup            ≡      │  topbar (back · title · menu)   order:0
├───────────────────────────────────────────────┤
│  ◆MUN   2  –  1   ARS◆        H2 · 67:14   ●   │  COMPACT READOUT — glance only  order:1
│                                  +2   ⑩ARS     │   (riders show only when true; tap→full board)
├───────────────────────────────────────────────┤
│  last  ⚽ 67' Rashford (Bruno)          ↩ Undo │  last-event line + persistent Undo   order:2
├───────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐ │
│  │  ▮▮ PAUSE        67:14         +  Stoppage │ │  CLOCK BAR (start/pause · +stoppage)  order:3
│  └───────────────────────────────────────────┘ │
├───────────────────────────────────────────────┤
│     🟨 Card        ⇄ Sub          ⋯ More       │  SECONDARY strip (rare, 1 tap)    order:4
├───────────────────────────────────────────────┤
│  ╔═════════════════╗  ╔═════════════════╗      │
│  ║        ⚽       ║  ║        ⚽       ║      │  THUMB ZONE — two giant one-tap  order:5
│  ║      GOAL       ║  ║      GOAL       ║      │  GOAL targets (home left · away right)
│  ║      MUN        ║  ║      ARS        ║      │
│  ╚═════════════════╝  ╚═════════════════╝      │
└───────────────────────────────────────────────┘
```

### 2.2 Element sizing & rules

- **Compact readout (order 1):** a shrunk mirror of the board — `CODE n – n CODE`, centred `phase · clock`, and riders (`●LIVE`, `+N` stoppage, `⑩` short-handed) *only when true*. It is **not editable here** — tapping it opens the full board. The console never re-implements the board; it borrows the same derived projection (score = attributed goal events, never a stored counter).
- **Last-event + Undo (order 2):** one line of the most recent captured event so the operator can sanity-check what they just logged, plus a **persistent Undo** (un-fumbleable requires a one-tap take-back that's always visible, exactly like the cricket console's `↩`). Undo is event-sourced: it pops the last ledger entry (goal, card, sub, clock transition) and the board/readout recompute.
- **Clock bar (order 3):** the football spine. One wide control: **Kick off ▶ / ▮▮ Pause** toggle, the live `MM:SS`, and **+ Stoppage** (types the fourth-official number). It sits *above* the goal keys because it's touched at defined moments, not continuously.
- **Secondary strip (order 4):** Card · Sub · More — hairline-split, ~44px, muted ink.
- **Goal keys (order 5):** `clamp`-tall, ≥ two rows of a normal key, the largest interactive objects on the screen. `:active` gives the tactile press (`translateY(1px)` + accent flash) the cricket keys use.

### 2.3 The More sheet (bottom-sheet, grouped — cricket `.menu-panel` grammar)

```
── Match options ─────────────────────────
Correct   [ Undo last ]  [ Edit last event ]  [ Move minute ]
Score     [ Own goal ]   [ Penalty goal ]     [ Disallow goal ]
Clock     [ End half ]   [ Extra time ]       [ Timeout ]
Match     [ Format & rules ] [ Penalty shootout ] [ Edit teams ] [ Share live ↗ ]
          [        End match        ]   ← danger
```

---

## 3. Mandatory handoffs — clean inline steps, minimal friction

The clock lifecycle (research §1.2-D) is football-specific state the generic counter never had. Every handoff is an **inline step surfaced at the moment it's due** — never a menu dive, never a form. The clock bar (order 3) *becomes* the handoff prompt when a transition is pending, then reverts.

### 3.1 Kickoff → half → half-time → second half

```
State 0 (pre-match)     [        ▶  KICK OFF        ]      clock 00:00, phase H1
   ↓ tap
Running                 [ ▮▮ Pause   23:07   + Stoppage ]  ●LIVE on board
   ↓ clock passes 45:00 — bar auto-offers the transition
45' reached             [ +2 added ]  ►  [ End 1st half ]  operator confirms end
   ↓ tap End 1st half
Half-time card          HT · 2–1     [   ▶  Start 2nd half   ]   (static board, no live dot)
   ↓ tap
Running (H2)            [ ▮▮ Pause   45:00→   + Stoppage ]   clock resumes counting up
```

- **Stoppage** is operator-typed via `+ Stoppage` and shows on the board as `45+2` / `90+3` and a `+N` rider — the console never guesses it.
- The end-of-half prompt **appears** at 45'/90' but never force-ends: the referee, not the clock, ends a half. One confirm tap.

### 3.2 Full-time, draw, and knockout continuations

At 90'+ end, `End 2nd half` → **result resolves by format**:
- **League/group:** `FT · 2–1` (or `FT · DRAW 2–2` — a draw is a first-class finished result, research §3.2, not a pending state). Straight to the result card.
- **Knockout, level:** the bar offers, inline, `[ Extra time ]  ·  [ Penalties ]` — the operator picks per competition rules. No forced 30 minutes.
- **Turf golden-goal house-rule:** if the format preset is *next-goal-wins*, the board already shows `NEXT GOAL WINS`; the **next GOAL tap auto-ends the match** and jumps to the result card (research §3.1 — slot-limited turf).

### 3.3 Extra time & timeouts

- **Extra time:** `Start ET1 ▶` → `HT2` → `Start ET2 ▶`, same two-tap rhythm as normal halves; phase labels `ET1/ET2` flow to the board.
- **Timeouts** (some turf/5-a-side formats): **Pause is the mechanism** — the operator hits `▮▮ Pause`; an explicit `Timeout` chip lives in More for formats that track them. Not a primary because most ICP formats don't have formal timeouts.

### 3.4 Penalty shootout — its own mini-surface (never the goal keys)

Knockout shootouts are a *different event class* (research §1.2-E, §5.1): shootout kicks do **not** touch the match scoreline or any player's goal tally. `More → Penalty shootout` opens a dedicated alternating grid:

```
PENALTIES        MUN  ●●○●        4
                 ARS  ●○●·        (to take)
Kick 4 · ARS      [ ✓ Scored ]    [ ✗ Missed ]
best-of-5 → sudden death · resolves "MUN won 4–3 on penalties"
```

Two giant `Scored / Missed` targets, one kick at a time, alternating sides auto-managed; best-of-5 then sudden death; produces the separate `won 4–3 on penalties` result line. Functional grid ships first; the animated per-kick reveal is future-flagged (research §5.1).

---

## 4. Guided (default) vs. Quick mode

**Guided is the default and the point** — it is what makes the console *un-fumbleable*:
- Every GOAL tap opens the deferrable attribution row (§1.2).
- Own-goal pulls the opposing roster and blocks personal tally.
- Second-yellow auto-derives the red + short-handed and asks a one-tap confirm.
- Subs move a player off the on-pitch list, so only on-pitch players are offered for the next goal/card.

**Quick mode** — *warranted, and mostly preset-driven, not a manual chore.* The reality (research §3.1): 5-a-side/7-a-side turf runs with **no rosters, no cards, rolling subs, a single running clock**. For those, full attribution is friction with nothing to attribute *to*. So:

| Preset (chosen once at setup) | Mode | Behaviour |
|---|---|---|
| **5/7-a-side turf** | **Quick** (default for this preset) | GOAL tap = scoreline only, no attribution prompt; cards hidden; rolling subs; single clock or 2×short halves; golden-goal available |
| **College / university 11-a-side** | **Guided** (default) | Full attribution, yellow/red with send-off derivation, halves + stoppage, extra-time/penalties on knockouts |

- The mode is a **consequence of the format preset** (research §3.2 — "pick the preset once and it ripples," don't tune ten toggles), with a single manual override in `Format & rules` for the edge case.
- **Quick mode still never loses the ledger:** goals are still individual events on the timeline; the operator (or anyone) can back-fill scorers later from the timeline. Quick removes the *prompt*, not the *record* — attribution stays a fast-follow, exactly per the one law.
- There is **no "expert keypad" beyond this.** Two GOAL keys are already the fastest possible primary; a denser mode would only add mis-hit risk. Speed here comes from *fewer taps*, not smaller targets.

---

## 5. How it stays SIMPLE — what is deliberately kept OFF the scorer

The console's value is the same as the board's: it is the *leanest* surface that does its job. Everything below is real and useful and lives **one layer away** — never on the operator console.

- **NO match display.** The console shows a *compact readout*, not the board. Crest wash, latest-goal caption, full names, the fuller hero — all on the board (`main-scoreboard.md`), one tap away. The scorer enters; the board shows.
- **NO timeline / scorecard on-screen.** The minute-by-minute feed is the spectator centrepiece and the record (research §5.2) — reached by a link, never rendered in the console. The console keeps only the **last event line** for sanity-check.
- **NO stats entry or display.** Possession, shots, shots-on-target, corners, fouls, xG, momentum — the casual ledger can't honestly feed them (research §5.2, win-prob discipline) and they are read-side luxuries. Zero of them are captured or shown here.
- **NO standings / Golden Boot / assists leaderboards.** Derived tournament assets (research §4) — the tournament layer, not the match console.
- **NO formation / lineup editor, no offside, no possession clock.** Not in the honest event ledger; not the volunteer's job pitch-side.
- **NO roster management screen.** Only inline `+ add` quick-add and `?Unknown` — loose-roster tolerance in-flow, never a setup detour mid-match.
- **NO shootout logic on the goal keys.** Shootout is a separate surface (§3.4) precisely so it can't leak into the scoreline or personal tallies.
- **NO decorative motion.** One score-pop on a goal, one live-dot pulse on the readout (reduced-motion gated). Nothing else moves — rubric law.
- **NO gold, no second accent.** Gold is the final result card (a different surface); green is lead/live only. A live console never wears gold.
- **NO forced clock.** The clock proposes end-of-half at 45'/90' but the referee ends the half; the operator confirms. The tool assists, it doesn't overrule the pitch.

**The test for any proposed console element:** *does the operator have to enter it in the two-second window, and can they enter it one-handed under glare?* Goals, cards, subs, and the clock pass. Everything a viewer merely *reads* fails — and belongs on the board, the timeline, or the tournament layer, never here.

---

## Summary

The football scorer is **two giant one-tap GOAL targets at the thumb-zone bottom** (home left · away right, code-labelled, mis-hit-proof), feeding an **instant scoreline** with a **deferrable inline attribution row** (scorer · assist · `+add` · `?Unknown` · own-goal-to-the-other-roster · penalty tag) that upholds the one law — *attribution never blocks the log.* Above it: a compact glance readout (a shrunk board mirror), a last-event line with a persistent **Undo**, a **clock bar** that becomes the inline handoff prompt (kickoff → +stoppage → end-half → HT → 2nd half → FT/ET/penalties), and a one-tap secondary strip (**Card** with auto-derived send-offs, **Sub** with rolling subs, **More** for everything rare including the separate **penalty-shootout** surface). **Guided** is the default that makes it un-fumbleable; **Quick** mode falls out of the turf preset for roster-less casual play without ever losing the ledger. It shows the match *nowhere* — the board glances, the timeline records, the tournament ranks. The console does exactly one thing, fast: capture the honest event ledger a pitch-side volunteer can actually maintain.
