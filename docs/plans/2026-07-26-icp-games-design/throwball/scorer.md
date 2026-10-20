# Throwball — The Scorer (the lean operator tool)

**Status:** Design spec for the operator's scoring screen. Sibling of `main-scoreboard.md` (the board it wraps) and `research.md` (the event model it drives).
**Inherits:** the cricket lean-scorer pattern (`../../2026-07-20-icp-games/cricket/cricket-scorer-alt-big5.html`) — thumb-zone layout, most-tapped target at the bottom, big one-tap primaries, rare actions tucked into a compact strip / More sheet, design1-mono tokens.
**One line:** Throwball collapses to **one decision per rally — point A or point B.** The scorer is two giant buttons, an always-there undo, and a compact board on top. Everything else is enrichment tucked away. If a PT teacher can mis-score it, it is wrong.

**The scorer is not the board.** The board (`main-scoreboard.md` State A) sits at the top as a read-only readout. This doc designs the *chrome around it* — the taps, the handoffs, the tucked-away rare actions. Detail (per-set breakdown, momentum, faults-by-type, rosters) lives on the live board / scorecard / spectator page, never here.

---

## 1. Actions — the 90% case vs the rare tail

### The atomic truth
A rally has **exactly one outcome: point to A, or point to B** (research §1). Everything technical — which fault, who caught, whose serve — is *enrichment the engine derives or the operator skips*. So the primary surface is **two buttons and nothing else competing with them**.

### Primary — the two giant point buttons (the whole workhorse)
Two large one-tap targets, one per team, home-left / away-right (spatial match to the board directly above). Each tap fires the single atomic `point → {team}` event; the engine does **all** the intelligence automatically (research §1):
- increments that team's current-set score;
- flips serve/possession on a side-out;
- re-evaluates set point / match point (target−1, win-by-2, cap aware);
- detects set completion (≥target AND lead≥2, OR cap) and match completion;
- stamps a timestamp (for set duration + run derivation).

The button is labelled with the **team name + its live points** so the operator's eye never leaves the target to confirm — tap `MADRAS` and it reads `MADRAS 8`. Colour: the button of the **leading** team carries the green lead-tint (mirrors the board); tie = neither. On tap: score-pop + press physics, and if the tap *armed or won* a set/match point the context line escalates (see §3). One tap, unambiguous, reversible.

### Always-visible — Undo
`Undo` is a permanent control, never in a menu (research §1: the whole score derives from the point sequence, so undo is LIFO 100-deep and must reverse **across set boundaries**). It sits in the low control row beside the point buttons — one tap reverses the last point, including un-completing a set or match if that was the last action.

### Secondary — compact strip (one row, above the primaries)
Rare-but-inline actions, hairline-split strip in the cricket `.big5-rare` grammar. Present but visually quiet:
- **Serve override** `▸◂` — flip the serve marker for the rare mis-detected side-out (Federation preset only; hidden for casual where serve isn't shown).
- **Fault tag** — tag *why* the just-scored point was won (Guided/roster mode only; see §4). Opens a quick pill row: Juggle · Double touch · Held >3s · Service fault · Catch drop · Net · Out · More. Pure stat colour — the point already scored; tagging is optional and skippable.
- **Timeout** — light counter, ~2/team/set (off by default; on only if enabled at setup).

### Rare — the More sheet (bottom sheet, cricket `.menu-panel` grammar)
Everything that happens a handful of times per match or once. Never on the main surface:
- **Correct:** Edit last point · Fix serve · Correct score.
- **Roster (opt-in):** Substitution · Rotation view · Lineup.
- **Match:** Edit setup (targets/cap/decider) · Share live ↗ · End set · End match.

**The discipline:** if an action happens on *most* rallies → it is one of the two giant buttons. If it happens *occasionally* → compact strip. If it happens *rarely/once* → More sheet. Nothing in the tail is ever allowed to shrink the two primaries.

---

## 2. Thumb-zone layout + wireframe

Read at the **top** (eyes), tap at the **bottom** (thumb). The compact board is a glance-only readout; the two point buttons are the largest targets and sit lowest, in the natural thumb arc. Rare actions climb *upward* out of the thumb zone (harder to hit = harder to mis-fire), exactly as the cricket Big-5 orders management high and the most-tapped keys low.

Vertical order, top → bottom:
1. **Top bar** — back · `Teams · Set N · to Target` · Live badge · ≡ (opens More).
2. **Compact board** (read-only, `main-scoreboard.md` State A) — set-box strip + two giant scores + sets tally + serve marker + one context/escalation line.
3. **Secondary strip** — serve override · fault tag · timeout (quiet).
4. **The two giant point buttons** — home-left / away-right, the lowest and largest targets.
5. **Control row** — `Undo` · `More ⋯` · quiet `Scorecard ›` / `Share ↗` footer.

### ASCII wireframe (guided default, casual preset — serve marker hidden)

```
┌─────────────────────────────────────────────┐
│ ‹   Madras vs Chennai · Set 3 · to 11    ≡  │  top bar (≡ = More)
│                                    ● LIVE     │
│                                              │
│  ┌───┐┌───┐┌───┐                             │  set-box strip (brutalist chips)
│  │15 ││ 9 ││ 8 │  ← live set outlined green  │
│  │12 ││15 ││ 6 │                             │
│  └───┘└───┘└───┘                             │
│  ╭─────────────────────────────────────────╮│  green-wash board readout
│  │ MADRAS          SETS 1 · 1       CHENNAI ││
│  │    8                              6       ││  GIANT scores; leader = green
│  ╰─────────────────────────────────────────╯│
│         SET POINT · MADRAS                    │  one context line (warning tint)
│                                              │
│  · · · · · · · · · · · · · · · · · · · · · · │  hairline
│   ▸◂ Serve    ⚑ Tag point    ⏱ Timeout       │  secondary strip (quiet, rare)
│                                              │
│  ┌──────────────────┐ ┌──────────────────┐  │  ◄ THE PRIMARIES ►
│  │                  │ │                  │  │
│  │   + MADRAS       │ │   + CHENNAI      │  │  giant one-tap point buttons
│  │       8          │ │       6          │  │  live score on the button face
│  │                  │ │                  │  │  leader (Madras) = green
│  └──────────────────┘ └──────────────────┘  │
│                                              │
│  ┌──────┐  ┌──────────────────────────────┐ │  control row
│  │ ↩ Undo│  │            ⋯ More            │ │  undo always visible
│  └──────┘  └──────────────────────────────┘ │
│  Scorecard ›                     Share live ↗│  quiet footer
└─────────────────────────────────────────────┘
    (safe-area padding at the very bottom)
```

Single-column, `max-width: 390px`, `min-height: 100dvh`, bottom padding respects `env(safe-area-inset-bottom)` — the two point buttons must clear the home indicator. The primaries fill the width in two equal columns so the operator never aims; the whole bottom half of the screen is a point tap.

---

## 3. Mandatory handoffs — clean inline steps

Handoffs are the moments the score can't just advance — a set closes, sides swap, a decider starts. The engine **detects** them; the operator only **confirms**. Each is a single inline card that replaces the primaries momentarily — never a modal maze, never lost taps. Minimal friction: the common path is one tap `Continue`.

### Set break (engine-detected, operator-confirmed)
When a point completes a set (≥target AND lead≥2, OR cap), the primaries are replaced by one confirm card:

```
┌─────────────────────────────────────────────┐
│   MADRAS TAKE SET 2 · 15–12                   │  plain-English result (research §3)
│   Match level 1 · 1                           │
│   ─────────────────────────────────────────  │
│   Next: Set 3 · to 11 · Chennai to serve      │  decider short-target surfaced
│                                              │
│   ┌────────────┐        ┌──────────────────┐ │
│   │  ↩ Undo    │        │   Continue  ›     │ │  one-tap advance
│   └────────────┘        └──────────────────┘ │
└─────────────────────────────────────────────┘
```
`Continue` carries finals into the set-box strip, resets current-set points, **swaps in the decider target if configured** (surfaced explicitly — the "to 11" moment, research §5.5), and re-arms serve. `Undo` un-completes the set. That's the whole break. The plain-English line matters because the operator is often the same person reporting the result up a WhatsApp chain (research §3).

### Match break (final)
Same card shape, terminal: `MADRAS WIN 2–1 · 15–12, 9–15, 11–8`. Actions: `Undo` · `View result ›` (hands off to the result/scorecard surface — the designed peak lives there, not on the scorer). No confetti/gold on the scorer itself.

### Side / turn swap
Purely a display concern under rally scoring — no score change. Folded into the set-break `Continue` (the "sides change" note rides on the same card). Never a separate interruption.

### Timeout · Substitution (opt-in, never blocking)
- **Timeout:** tap `⏱` in the secondary strip → increments the light counter (~2/team/set), optional ~30s countdown chip in chrome. Casual scorers ignore it entirely; off by default. Never interrupts scoring.
- **Substitution (roster mode only):** More → `Substitution` → pick out/in from the lineup. A logging step, not a gate; the score never waits on it. Absent entirely without rosters.

**Rule:** the only *mandatory* inline step is the **set/match break confirm** (one tap). Timeouts and subs are optional and non-blocking. Rotation is opt-in display-only (casual women's/school play uses the Standing Player Method — no rotation, research §3).

---

## 4. Guided (default) vs Quick mode

### Guided — DEFAULT, hard-to-mis-score
This is what a student volunteer / PT teacher gets out of the box. Design goal: **mis-scoring nearly impossible.**
- **One-tap preset at setup** sets everything: `College 15/bo3/decider-11/cap-17` · `School 15/bo3` · `Federation 25/bo5/decider-15/cap-27`. The operator never touches a rulebook.
- Setup states the scoring model plainly — *"Every rally = a point (rally scoring)"* — so an old-school side-out scorer isn't silently surprised (research §1, the real-world ambiguity).
- Two giant point buttons + always-visible undo. Serve auto-flips; serve marker **hidden** for casual presets (under rally scoring serve doesn't move the score — clutter for a PT teacher, research §3), **shown** for Federation.
- Engine owns win-by-2, cap, decider, set/match detection — the exact math casual scorers get wrong.
- Set/match breaks are explicit confirm cards with plain-English lines.
- Fault tagging is **available but never demanded** — a quiet `⚑ Tag point` that's pure optional stat colour.

### Quick / Power mode — OPTIONAL, opt-in
A denser variant for a confident operator or a federation scorekeeper. Same engine, less confirmation:
- **Serve marker always on**, serve override exposed in the strip.
- **Fault tag prompt** can auto-open after each point (roster/stat matches) instead of staying quiet.
- **Set breaks auto-advance** with a 3s undo-window toast instead of a confirm card (fewer taps for someone who won't fumble).
- Substitution / rotation / timeout controls surfaced, not tucked.

**Justification for the split (research §3):** the ICP is bimodal — a student-volunteer majority who need maximum guard-rails, and a federation minority who want speed + stats. Guided is the floor everyone lands on; Quick is a deliberate opt-in, never the default, because the cost of a fumble on the default path is a wrong permanent record. Every existing throwball app (the *Ultimate Throwball Scoreboard*) optimises for the pro minority; we invert that.

---

## 5. How it stays simple — what is deliberately OFF the scorer

The scorer's power is that it says exactly enough and stops. Everything below is intentionally **excluded** — it lives on the board, the scorecard, or the spectator page (research §4, main-scoreboard §4):

- **NO momentum run-bar / worm.** The signature "on a 6-point run" beat is derived free from the point sequence but rendered on the **spectator page**, not the scorer — it would compete with the two buttons.
- **NO per-set breakdown table, no per-player stat rows.** Scorecard territory. The scorer shows the live board readout only.
- **NO fault-type analytics on the surface.** Tagging is a quiet optional strip; the *analysis* (faults-by-type, heat grid) is scorecard-only.
- **NO serve/throw target-zone tap-to-place on the scorer.** The wagon-wheel-analogue enrichment (research §5) is deferred and opt-in on roster/Guided-plus, never a per-point tax on the default path — one tap per rally stays one tap.
- **NO rotation board / player positions by default.** Casual play doesn't rotate (Standing Player Method). Federation opt-in only, and then it's a More-sheet view, never on the main surface.
- **NO timeout clock front-and-centre.** Light counter in chrome if enabled; off by default.
- **NO celebration chrome — gold, glow, confetti.** Those belong to the result/POTM card after match end, on a different surface.
- **NO manual score math anywhere.** The operator never types a number, never computes win-by-2 or the cap — the engine does all of it. The operator only ever answers "who won that rally?"
- **NO CRR/RRR-style projections, predicted-winner %, ad slots.** None of it.

**The one-rule test:** on any given rally the operator makes exactly one decision — *point A or point B* — and taps once. If a proposed feature adds a second required decision to the common rally, it does not belong on the scorer. Push it to setup, the More sheet, or another surface.
