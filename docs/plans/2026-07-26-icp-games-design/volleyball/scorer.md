# Volleyball — THE LEAN SCORER

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the operator console)
**Feeds:** `research.md` §1.5 (event ladder) + §3.3 (casual-vs-pro needs) · `main-scoreboard.md` (the pinned hero it reuses)
**Design system:** design1-mono (brutalist shell × HiFi-blend), governance FROZEN. `--se-*` / `--se-blend-*`
tokens only, never raw hex. Pure-black ink, ONE hard offset shadow, mono tabular numerals, **green = live/lead
accent ONLY**.
**Lineage:** ports the cricket **Big-5 lean scorer** thumb-zone discipline verbatim
(`cricket-scorer-alt-big5.html`): rare/management on top, most-tapped primaries pinned at the BOTTOM, big
one-tap targets, rare actions tucked into a compact strip + a `⋯ More` sheet.

This is the **operator's** surface — the one thing a two-thumb scorer at a gully court holds. Its ONLY job is
to **score fast and un-fumbleably**. It is NOT the scorecard, NOT the momentum band, NOT a stat console. Every
byte of detail that a spectator or coach wants lives on richer surfaces. Volleyball is even leaner than
cricket here: cricket has a 5-way outcome per ball; **volleyball has a 2-way outcome per rally.** One rally =
one tap to one of two sides. The entire console orbits that fact.

---

## 1. The action ladder — what the scorer must capture, weighted by frequency

Straight from `research.md` §1.5, and it is brutally top-heavy:

| Rank | Action | Frequency | Placement |
|---|---|---|---|
| 1 | **Point → Team L / Point → Team R** | ~99% (every rally) | **The two giant thumb targets, pinned bottom** |
| 2 | **Undo** (LIFO — reverts the rally *and* everything it derived) | the safety net | Compact strip, just above the big targets |
| 3 | **Timeout L / R** (2 per set; warn at 0) | a few per match | Compact strip |
| 4 | **[Auto] Set close → end-switch** | engine-driven, 1×/set | Inline handoff card (not a tap) |
| 5 | **[Auto] Deciding-set switch at 8** | engine-driven, rare | Inline handoff card |
| 6 | **Correct/fix first server** | rare | `⋯ More` sheet |
| 7 | **Formal-only:** substitution, libero in/out, lineup | formal mode only | `⋯ More` sheet (hidden in casual) |
| 8 | **Deferred stats:** ace/kill/block/error tag | NEVER on the lean path | Not on the scorer at all (see §6) |

**The single derivation rule (the whole reason this can be one tap):** the operator taps *only* who won the
rally. `deriveSet(rallies, format)` computes score, **who serves next, side-out yes/no, rotation, deuce,
set-point, match-point, set close, and the switch prompt.** The operator never enters serve, never enters
rotation, never enters "why." This is volleyball's version of cricket auto-deriving strike — and it is even
purer, because there is no second dimension (no runs, no extras) on the core path.

---

## 2. Primary actions — two giant one-tap targets (the 90%+ case)

**The 90% case is literally 100% of rallies: award the point to one side.** So the scorer's dominant
interaction is *two enormous side-buttons*, one per team, each spanning half the width and the full height of
the thumb zone. They are the biggest interactive things on the screen by 3× — the volleyball analogue of the
cricket Big-5 keypad, collapsed to Big-2.

Each button is **un-mis-tappable** by construction:

- **Full-half-width, tall** (`clamp(112px, 20vh, 148px)`) — a thumb cannot miss its own half.
- **Labelled with the team CODE + the word POINT** (`▸ KBS · POINT`), colour-pipped to the team, and the
  **serving side carries the green `▸` serve glyph** so the operator always sees who's serving *on the button
  they're about to press*.
- **Live point count echoed small inside each button** so tapping and reading happen in one glance — the
  button restates "you are giving KBS their 22nd point."
- On tap: a 120ms flat `--accent` flash (the only motion), the pinned hero re-derives, the serve glyph flips
  if it was a side-out. No modal, no confirm, no second tap. **One rally, one tap, done.**

There is **no third primary button.** Everything that is not "who won the rally" is secondary by definition
and lives in the strip or the sheet.

### 2.1 Guided placement of the serve cue (the anti-fumble core)
The casual scorer's four documented anxieties (`research.md` §3.3) are: mis-tapping the wrong side, losing
track of who serves, forgetting to switch ends/set, and deuce confusion. The two-target layout kills #1 by
geometry. The **serve `▸` printed on the winning-side button** and the **auto handoffs** (§4) kill #2–#4. The
scorer never has to *hold a rule in their head* — the surface holds it.

---

## 3. Thumb-zone layout + ASCII wireframe

Reading order top→bottom, but **tap frequency increases as you go DOWN** (identical to the cricket Big-5 CSS
`order`: rare/management on top, most-tapped at the bottom in the thumb arc). The compact **read** is at the
top (glance up); the frequent **taps** are at the bottom (thumb rest).

```
┌──────────────────────────────────────────────┐
│  ‹  Sunday Cup · Final           ● LIVE   ⋯    │  ← topbar: back · title · live · More  (rare)
├──────────────────────────────────────────────┤
│  ▸ KBS            SET 3            AHV         │  ← PINNED HERO (reuses main-scoreboard State A,
│   22            SET POINT           24        │     read-only). Codes · serve glyph · the two big
│  ▓▓▓▓▓                            ▓▓▓▓▓        │     numbers · phase spine · green wash on leader.
│  ● ●              sets             ● ○         │     The operator GLANCES here, never taps here.
├──────────────────────────────────────────────┤
│  ┌────────┐  ┌────────┐  ┌──────────────────┐ │  ← CONTROL STRIP (secondary, mid-reach):
│  │  ↩ UNDO │  │ T.O ●● │  │      T.O ● ○     │ │     Undo · Timeout-L (dots=remaining) · Timeout-R
│  └────────┘  └────────┘  └──────────────────┘ │
│                                                │
│   POINT TO                        POINT TO     │  ← tiny captions above the giant targets
│  ┌─────────────────────┐ ┌───────────────────┐│
│  │                     │ │                   ││
│  │       ▸ KBS         │ │        AHV        ││  ← THE TWO GIANT TARGETS (dominant, pinned bottom,
│  │        22 →         │ │        24 →       ││     in the thumb arc). Half-width each, tall.
│  │       POINT         │ │       POINT       ││     Serve ▸ on the serving side. Team colour pip.
│  │                     │ │                   ││
│  └─────────────────────┘ └───────────────────┘│
│         Full scorecard ›        Share live ↗   │  ← quiet footer links (leave the console)
└──────────────────────────────────────────────┘
              (safe-area inset padding)
```

**Layout laws (ported from the cricket lean scorer):**
- **Max width 390px, single column, `100dvh`** with `env(safe-area-inset-bottom)` padding — a phone held one-handed.
- **The two giant targets sit lowest**, inside the natural thumb sweep. Nothing frequent lives above the fold-line except the read.
- **The control strip (Undo · T.O · T.O)** sits directly above the targets — reachable but never in the accidental-tap path of the primaries (a hairline gap + smaller height separates them).
- **The pinned hero is pure glass** — it is the *same component* as `main-scoreboard.md` State A, read-only, zero controls. The board and the scorer's top are one component; the scorer just adds the strip + targets beneath it.
- **`⋯ More` and `‹ back` live in the top bar** — the two rarest things, farthest from the thumb, exactly where a mis-tap costs nothing.

---

## 4. Mandatory handoffs — clean inline steps, minimal friction

Handoffs are **engine-triggered, not operator-hunted.** When `deriveSet`/`deriveMatch` flips a boundary flag,
the scorer *replaces the two giant targets in place* with a single focused card. The operator confirms one
thing and is dropped straight back into scoring. No menu-diving, no separate screen, no lost rally.

### 4.1 Set close → end-switch (rank 4, every set)
Fires the instant a side reaches target with a 2-lead (25/2, or the format's target). The targets are replaced by:

```
┌──────────────────────────────────────────────┐
│   SET 3 TO  ▸ KBS                              │
│   25 – 22                                      │
│                                                │
│   Teams switch ends · AHV serves next set      │  ← engine states the two derived facts
│                                                │
│  ┌──────────────┐        ┌──────────────────┐  │
│  │  ↩ Not yet   │        │  START SET 4  →   │  │  ← one confirm; "Not yet" = undo-safe escape
│  └──────────────┘        └──────────────────┘  │
└──────────────────────────────────────────────┘
```

- **The engine derives everything** — set winner, the score line, that ends switch, and who serves next (the
  team that did NOT serve this set). The operator just taps **START SET 4**.
- **`↩ Not yet`** is the undo hatch (mis-scored the set point) — reverts the closing rally and returns to scoring.
- On confirm: sets-won pip fills, sides swap in the hero, serve glyph moves, scoring resumes. **Two taps total for a whole set transition** (the point that closed it + START).

### 4.2 Deciding-set switch at 8 (rank 5)
In the deciding set only, when either side reaches 8, a **thin inline banner** slides above the targets:

```
│   ⇄  SWITCH ENDS  ·  deciding set, first to 8   │   [ Done ]
```

One `Done` tap, ends swap in the hero, scoring continues. It never blocks a rally — if the operator scores
through it, the next tap dismisses it and the switch is still recorded (ends are cosmetic to the score).

### 4.3 Timeout (rank 3) — inline, from the strip
Timeout-L / Timeout-R are **dots-remaining buttons in the control strip** (`T.O ● ●` = 2 left). Tap → the
dot decrements, a quiet "AHV timeout · 0 left" toast shows, and a compact resume bar appears; tap the side
again or tap `Resume` to clear. **The engine hard-warns at 0** — a spent-timeout button greys and, if tapped,
shows "No timeouts left" instead of decrementing below zero. No countdown clock on the lean path (a timer is
`⋯ More` → optional).

### 4.4 Substitution / libero (rank 7) — formal mode only
**Hidden entirely in casual mode.** In formal mode a `Subs` action appears in the `⋯ More` sheet, opening a
compact in/out picker (6 subs/set counter; libero swaps unlimited and don't decrement). This is the ONE place
the scorer touches a roster, and it is opt-in, off the primary path, and reconstruction-safe for the formal
scoresheet. It never intrudes on the two-target flow.

### 4.5 Best-of-N / single-set (setup-derived, no handoff)
Match close (`deriveMatch` hits `setsToWin`) replaces the targets with the **one gold result card** — "KBS
won 3–1", set line in mono, Share / Rematch. Single-set (best-of-1) formats simply have `setsToWin = 1`, so
the first set close *is* the match close — no special-casing, the same handoff fires. The format is chosen
once at setup; the scorer never re-picks it.

---

## 5. Guided (default) vs Power/Quick mode

**Guided is the default and is hard-to-mis-score by construction** — it is what everything above describes:

- Two giant targets, serve glyph on the button, every handoff surfaced inline and confirmed.
- Auto set-close/switch cards that *interrupt* to confirm — the operator cannot skip a switch or forget a set.
- Formal actions (subs/libero/lineup) hidden.
- This is right for the ICP: a PE teacher or student volunteer who wants zero rules in their head.

**Power/Quick mode is a single opt-in toggle** (setup, or `⋯ More → Quick mode`) for an experienced scorer
running a fast bracket. It **removes confirmation friction, never removes the game brain:**

- **Set-close handoff auto-advances** — no START tap; the card flashes the set result for ~2s (still
  undo-able) and drops straight into the next set. Saves one tap per set across a 20-team knockout day.
- **Deciding-switch banner auto-dismisses** after the recorded switch.
- **Timeout confirm toast is skipped** (dot just decrements).
- The two giant targets, the derivation, the deuce/set-point/match-point ladder, and Undo are **identical** —
  Quick mode only strips *confirmations*, so it is still un-mis-scoreable on the core tap. It never exposes
  per-rally stat tagging or a smaller/denser keypad — there is nothing to densify, the core is already two buttons.

A power mode is **warranted here but stays minimal**: the lean core is already near-frictionless, so Quick
mode's only job is shaving confirm-taps for high-throughput days, not adding capability.

---

## 6. How it stays SIMPLE — what is deliberately kept OFF the scorer

The scorer's whole value is that it does one thing perfectly. Everything below was considered and **exiled to
a richer surface** (spectator screen, scorecard, momentum band), never the console:

- **NO per-rally reason tags** (ace / kill / block / opponent-error). ~half of amateur points are opponent
  errors — tagging every point is a second tap for near-zero at-a-glance value (`research.md` §1.3). The lean
  path never asks "why." (Optional zone-of-point capture is a *future* opt-in enrichment, exactly as cricket
  deferred tap-to-place wagon — it is not in the default scorer.)
- **NO rotation wheel / serve-order / positions on the primary surface.** Serve is derived and shown as one
  glyph; rotation is invisible in casual mode. The 6-position wheel is formal-mode, and even then it lives on
  a stat surface, not between the two targets (`research.md` §5.2).
- **NO momentum worm / point-run band / side-out %.** These are the signature *spectator* reads, all
  free-derived from the rally log — they belong BELOW the hero on the spectator screen, never on the operator
  console where they'd fight the targets (`main-scoreboard.md` §4).
- **NO full scorecard, no per-set stat table, no player figures.** A quiet `Full scorecard ›` footer link
  *leaves* the console for that.
- **NO manual serve entry, NO manual score-typing, NO +/− steppers.** The dumb-counter apps live on ±
  buttons and force the scorer to carry every rule; we refuse that. The only way to change the score is to
  award a rally, and the only way to fix one is Undo. (Direct score-correction lives in `⋯ More`, gated,
  for genuine desync — never as a casual affordance.)
- **NO technical-timeout automation, NO challenge/review, NO clock.** Technical TOs at 8/16 are almost never
  run at Indian college/ground level (`research.md` §1.4) — off by default, a formal-mode toggle at most.
- **NO second colour, no decorative motion.** Green = lead/live/serve only. State drama is the escalation
  ladder in the *hero's* phase spine (DEUCE ▸ SET POINT ▸ MATCH POINT) — the scorer body stays quiet so the
  operator's eye is only ever pulled by the two things that matter: the serve glyph and the two targets.
- **NO menus of features.** One `⋯ More` sheet holds the genuine rarities (fix first server, subs/libero in
  formal, Quick-mode toggle, direct-correction, share, end match) — everything a scorer touches < once a
  match, tucked one tap away from the top bar, far from the thumb.

**The test for anything proposed for the scorer:** *does the operator need it to award or unwind a rally?* If
no → it is a read (→ spectator/scorecard) or a rarity (→ `⋯ More`). The console holds the line at: **two giant
targets, one control strip (Undo · 2× Timeout), inline auto-handoffs, and a pinned read-only hero.** Nothing else.
