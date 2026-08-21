# ScoreEasy — Kho-Kho SCORER

**Date:** 2026-07-26 · **Status:** DESIGN (feeds the build; no code yet) · **Scope:** the operator's live scoring surface — the one screen a PT teacher / student / bystander taps during a turn.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · flat-black hero, one hard offset shadow, mono tabular numerals, **green = live / chasing / lead only** — NO new colours.
**Lineage:** ports the cricket lean-scorer pattern verbatim (`cricket-scorer-alt-big5.html`) — thumb-zone ordering (`.big5 { order: 7 }`, most-tapped at the bottom), one giant frequent primary, rare outcomes in ONE compact hairline strip, management tucked into a `More` bottom-sheet. Kho-Kho keeps the frame; the "ball" becomes the **OUT**.

---

## 0. The one design decision this doc makes

Cricket's lean scorer has a **Big-5** (dot · 1 · 4 · 6 · W) because five outcomes cover ~90% of balls. **Kho-Kho's college default has a Big-1.** Research §1.2 + §3: at the grassroots ICP there is exactly **one dominant action — OUT (+1), chasing team only.** No out-type menu, no attribution, no defender naming gate. So the scorer is not a keypad; it is **one enormous OUT button in the thumb zone, plus UNDO, plus the clock.** Everything else (batch feed, dream-run timer, all-out recycle) is **derived by the app, not tapped by the operator.**

> The scorer's whole job: **tap OUT when a defender falls, run the clock, and be walked through the 3 handoffs.** Anything that isn't those four things is off this screen.

This is the sharpest possible expression of the cricket lesson: if cricket earns a lean 5-key surface, Kho-Kho earns a lean **1-key** surface — and that is the differentiator no incumbent (stadium hardware or two-number counter, research §4) offers.

---

## 1. Primary vs secondary actions

### 1.1 The primary — the 90%+ case (giant one-tap)

| Action | Tap target | What it does (app-derived, no extra taps) |
|---|---|---|
| **OUT +1** | The single dominant full-width primary at the bottom of the thumb zone. Danger-styled echo (transient red flash + stamp), reads `OUT +1`. | `+1` to the chasing team's turn points; advances the batch tracker (`● ● ○`); on the **3rd** out auto-feeds "NEXT 3 IN"; on a full clear fires the **LONA / recycle** stamp and keeps the clock running (never ends the turn early, research §1.2). Resets the survivor/dream-run derivation. |
| **UNDO** | Persistent, left of OUT, small but always reachable. | Reverts the last logged event (OUT, clock action, handoff) — the fumble-proof safety valve. Most-used control after OUT. |
| **CLOCK ⏯** | The turn countdown is a **tap-to-pause co-primary** in the readout (play stops constantly at grounds, research §3). | Start / pause the turn clock. Paused → dim + `PAUSED` micro-label. At `0:00` it auto-arms the turn-end handoff (§3). |

That is the entire everyday loop. In a hot turn the operator taps **OUT** every few seconds and nothing else.

### 1.2 The secondary — one compact hairline strip (rare, in-reach but not primary)

Directly above OUT, on open canvas with hairline splits (cricket's `.big5-rare` grammar). College default shows only what a grassroots scorer ever needs:

- **NEXT 3 IN** — manual batch-advance override (normally auto on the 3rd out; here for when a ref calls it differently).
- **NAME DEFENDER** *(optional refinement)* — attaches `defenderId` to the last OUT. Never a gate; the scorecard degrades gracefully when skipped (research §3).
- **DREAM RUN ✓** *(prestige stamp, college)* — mark the current survivor's run as notable. Timer is auto-derived; this just flags the shareable moment. No points in college mode.

### 1.3 The rare — tucked into the `More` bottom-sheet

Everything that happens a handful of times per match lives behind one `⋯ More` button (cricket's `.menu-panel` sheet), grouped:

- **Correct:** Edit last OUT · Correct clock · Undo handoff.
- **Match:** Timeout · Substitution · Edit teams/roster · Share live ↗.
- **End:** End turn now (declare) · End match.
- **Power mode toggle** (§4) — flips the surface to league scoring.

---

## 2. Thumb-zone layout

**Principle (from cricket):** compact readout on top (glance, not tap); the most-tapped primary pinned to the **bottom** of the shell where the thumb rests; management floats above it. CSS `order` puts the OUT block last in the DOM-visual stack exactly like `.big5 { order: 7 }`.

### 2.1 Vertical order (top → bottom)
1. **Top bar** — back · "Warriors vs Panthers · Turn 3/4" · LIVE badge · ⋯.
2. **Compact score readout (flat black hero)** — the four glance facts, mirrors `main-scoreboard.md §3.1`: two cumulative totals, the big **tappable clock**, ATTACK tag + green wash on the chaser, `● ● ○` defender dots. Read-only except the clock.
3. **Secondary hairline strip** — NEXT 3 IN · NAME DEFENDER · DREAM RUN ✓.
4. **UNDO + OUT primary row** — pinned low, thumb-reachable, OUT dominant.
5. **Footer** — quiet "Full scorecard ›" · "Share live ↗".

### 2.2 ASCII wireframe (college default)

```
┌──────────────────────────────────────────────┐
│ ‹  Warriors vs Panthers · Turn 3/4     ●LIVE ⋯ │  ← top bar
├──────────────────────────────────────────────┤
│ ███████████████ FLAT BLACK HERO ██████████████ │
│ TURN 3/4 · WARRIORS CHASING · 03:12 LEFT       │  ← mono context line
│                                                │
│  WARRIORS [ATTACK]           DEF   PANTHERS    │  ← green wash on chaser
│                                                │
│    31          ┌────────┐          26          │  ← two totals (chaser green)
│  (green)       │ 03:12  │       (ink-inv)      │  ← CLOCK = tap to pause (co-primary)
│                └───⏯────┘                      │
│  ───────────────────────────────────────────  │
│  DEFENDERS  ● ● ○   2 left                     │  ← batch dots (auto-derived)
│ ████████████████████████████████████████████  │
│                                                │
│  ┄┄ NEXT 3 IN ┆ NAME DEFENDER ┆ DREAM RUN ✓ ┄┄ │  ← rare strip (hairline splits)
│                                                │
│  ┌────────┐ ┌─────────────────────────────────┐│
│  │  ↩ UNDO │ │            OUT  +1               ││  ← THUMB ZONE: giant OUT primary
│  └────────┘ └─────────────────────────────────┘│     (danger echo · full-width)
│                                                │
│  Full scorecard ›                Share live ↗  │  ← quiet footer
└──────────────────────────────────────────────┘
          ▲ one --shadow hard offset (3px 3px 0)
```

The thumb never leaves the bottom third: **OUT** and **UNDO** live there; the **clock** is a large tap-target one row up. The top hero is pure glance.

---

## 3. Mandatory handoffs — clean inline steps

Handoffs are the moments a naive counter silently corrupts. Each is a **guided inline step, never a silent reset** (research §3). They surface as a single full-width action bar that replaces the OUT primary in the thumb zone, so the confirming tap lands exactly where the thumb already is.

### 3.1 Turn end → role swap (fires 4× per match, auto at 0:00)
Clock hits `0:00` → OUT button is replaced by a **one-tap guided card** in the thumb zone:

```
┌──────────────────────────────────────────────┐
│  TURN 3 ENDED · Warriors scored 10 this turn   │
│  Cumulative:  WARRIORS 31 — 26 PANTHERS        │
│  ──────────────────────────────────────────   │
│  Next: PANTHERS chase · WARRIORS defend        │  ← the swap, stated plainly
│  ┌──────────────────────────────────────────┐ │
│  │        START TURN 4  ▸  (7:00)            │ │  ← single primary; arms clock paused
│  └──────────────────────────────────────────┘ │
│        Edit turn points ›     Undo turn end ›  │  ← escape hatches
└──────────────────────────────────────────────┘
```

One tap finalizes the turn total, flips chaser⇄defender (green wash slides to Panthers), resets the batch tracker and clock, and lands paused ready for the first OUT. No manual score entry.

### 3.2 Innings / half break (between turn 2 and 3)
Same card, with the interval note baked in: `INNINGS BREAK · 3:00`. A small countdown runs; `START TURN 3` stays available to skip it. College preset = 2 turns → this collapses to the turn-end card only.

### 3.3 Timeout (from More sheet)
Tapping **Timeout** pauses the clock and shows a slim inline banner over the hero: `TIMEOUT · WARRIORS · 0:45 ▸ Resume`. One tap resumes; clock was already frozen so no state can drift.

### 3.4 Substitution (from More sheet)
Inline row, not a modal: `SUB · Panthers · [out ▾] → [in ▾] · Confirm`. Optional roster refinement; if names were never entered it's a no-op skip. Never blocks scoring.

**Rule:** every handoff = auto-detected or one-tap-invoked → a plain-language card in the thumb zone → one primary to confirm + one escape hatch. No free-text, no numeric entry, no ambiguity about who chases next.

---

## 4. Guided (default) vs Power mode

**Guided is the default and is hard to mis-score.** It is the Big-1 surface above: OUT=+1, chasing team only, dream run is prestige-only, batch feed and recycle are auto, handoffs are walked. A first-timer cannot enter a wrong point value because **there is only one value.**

**Power mode (optional toggle, More sheet → confirm)** is warranted because the league product is real and growing (research §2, §4) — but its density is hostile to a first-timer, so it is never the default. Turning it on changes **only the OUT interaction**, keeping the identical thumb-zone frame:

- OUT becomes a **Big-3 keypad** (cricket's Big-5 shape, three keys): **TOUCH +2 · POLE DIVE +3 · SKY DIVE +3** (values **flagged — confirm against current season's rulebook at build, never hardcode**, research §6/§1.3).
- **Dream Run** flips from prestige stamp to **scoring**: auto `+1` at the threshold, `+1 / 30s`, credited to the defending team — the app derives and adds it; the operator still only taps OUT.
- Adds to the More sheet: **Wazir / Powerplay** flag, **Review** (1/team/innings), **Cards** (yellow/red).
- Per-chaser attribution (`NAME CHASER`) is promoted from optional to prompted-but-skippable.

Toggle is one switch; it is remembered per match, defaults OFF, and is confirmed on flip so nobody lands in league scoring by accident.

There is **no separate "quick mode"** — Guided already IS the quick mode. Adding a third mode would violate the lean brief. The only axis is Guided ⇄ Power.

---

## 5. What stays OFF the scorer (deliberately)

The scorer is a **scoring instrument**, not the live board or scorecard. Kept off, by design:

- **Rich stats / detail** — cumulative-total breakdown, per-turn deltas (`Turn 1: 14–1`), per-chaser tag counts, survival Gantt, out-type tallies. → live board + scorecard (research §5.2, `main-scoreboard.md §4`). The scorer shows only the four glance facts.
- **The dream-run tension band + gold milestone card** — those are spectator drama for the **board**, not operator inputs. The scorer derives the timer silently; it doesn't render the escalating meter.
- **The chase equation** (`Panthers need 4, 1:47 left`) — a board/spectator element; not needed to log an OUT.
- **Refereeing adjudication** — kho count, active-chaser position, direction-lock, cross-at-poles, lane/pole diagram. **The app must not adjudicate any of this** (research §1.1). The ref calls it; the scorer only records the OUT that results.
- **Out-type menu in college mode** — no Touch/Pole/Sky tiers unless Power mode is explicitly on.
- **Mandatory defender/chaser naming** — always a refinement, never a gate.
- **A second accent colour / red resting slab** — OUT is a transient danger flash, never a standing colour. Green stays the only accent, only on the chaser (hardness budget, `main-scoreboard.md §5`).
- **Declare / follow-on / standings-table points** — edge toggles for the league; tucked in More, never on the primary surface.

**Rule of thumb (operator variant):** if a tap doesn't *log an out*, *move the clock*, or *complete a handoff*, it does not belong in the thumb zone — push it to the rare strip, the More sheet, or off the scorer entirely.

---

## 6. Hardness budget (rubric, verbatim)

Per screen: **1 hard shadow · 1 ink frame · ≤3 soft surfaces · ≤1 gold · ≤1 glow · ≤1 inversion · ≤1 live pulse.** The scorer spends its inversion on the black hero, its shadow on the hero offset, its one danger accent on the transient OUT flash (not a standing colour), its one pulse on LIVE. The giant OUT primary and the clock carry the weight; nothing else competes.
