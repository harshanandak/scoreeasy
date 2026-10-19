# Throwball — Final Locked Design

**Status:** DECISIVE, buildable spec. Supersedes `research.md`, `main-scoreboard.md`, `scorer.md`, `live-innovations.md` where they conflict. Those remain the rationale record; this file is what gets built.
**Thesis:** *Throwball is the volleyball score-bug over a single atomic `point → {A|B}` event — every rule the casual scorer gets wrong (win-by-2, cap, short-decider, set/match completion) is owned by the engine, so the operator's only job, every rally, is "who won that point?" — and that same free point stream becomes the first watchable throwball spectator page (momentum runs) no competitor has.*

**Blend law (unchanged, no new colours):** design1-mono record grammar · green = live/lead ONLY · escalation is the only state colour (`neutral → --se-color-warning-soft → --se-color-danger-soft`) · gold + the single glow live ONLY on the result card · per-screen budget: 1 hard frame, 1 hard shadow, ≤1 inversion, ≤1 live pulse, ≤1 transient beat. **Never uppercase a person/team name.**

---

## 0. Decisions locked (what changed from the four inputs)

1. **Casual-Guided default has NO secondary strip.** Board + two point buttons + Undo + More. Serve override (Federation), fault-tag and substitution (roster/Quick only) never appear on the casual path. This removes the one place a PT teacher could be handed a second per-rally decision.
2. **Rally-point is the built model.** Side-out is a *latent config seam* (an enum on the engine), **not built now**. Setup copy states the model in plain English.
3. **Serve marker is config-gated to Federation** on every surface. Casual College/School never show it (under rally scoring it doesn't move the score → clutter).
4. **Two operator modes only:** Guided (default, confirm-carded) and Quick (opt-in, toast-advance). No third mode.
5. **Signature = momentum run badge + worm**, both derived free from the point sequence — ship first. **Zone tap-to-place is optional/on-demand/deferred** (ship second, roster/Quick only).
6. **League & Bracket is the adoption phase**, sequenced after the usable single-match core — named explicitly, not treated as a peer of cheer emojis.
7. Emoji are never load-bearing; the run badge reads correctly in pure mono.

---

## 1. Scoring model (the engine — build this first)

Single source of truth. Everything else renders off it.

**Atomic event:** `point → { team: 'A' | 'B', ts }`. The ONLY event the scorer emits on a rally.

**On each point the engine automatically:**
- increments that team's current-set points;
- flips `serving` on a side-out (won by the non-serving team);
- re-evaluates `setPoint({team})` / `matchPoint({team})` (target−1, win-by-2 aware, cap aware);
- detects **set completion** (`points ≥ target AND lead ≥ 2`, OR `points === cap`);
- detects **match completion** (`setsWon === setsToWin`);
- stamps `ts` (for set duration, run derivation, set-point pressure).

**Undo:** LIFO, 100-deep, **reverses across set and match boundaries** (the whole state derives from the point array, so un-completing a set/match is just popping the point that closed it).

**Config (the preset object):**
```
{ setTarget, winBy: 2, cap, setsToWin, decidingSetTarget|null, decidingSetCap|null,
  showServe: bool, scoringModel: 'rally' /* seam: | 'sideout' */ }
```

**Presets (one tap at setup):**
| Preset | setTarget | cap | setsToWin (bo) | decider | showServe |
|---|---|---|---|---|---|
| **College** | 15 | 17 | 2 (bo3) | 11 | off |
| **School** | 15 | 17 | 2 (bo3) | — | off |
| **Federation** | 25 | 27 | 3 (bo5) | 15 (cap 17→hmm: 25/27) | on |

*(Federation decider = 15, cap 17; sets 1–4 = 25, cap 27. Deciding-set target/cap are their own fields — never global.)*

**Derived, zero extra capture:** run length (current + longest per team per set), momentum array (`['A','A','B',...]`), set-point converted/saved, per-set duration, longest rally-run, margin.

---

## 2. Screen 1 — Setup (one-tap, un-intimidating)

Goal: a student volunteer starts a valid match in **≤4 taps** without opening a rulebook.

```
┌─────────────────────────────────────────────┐
│  New match                                   │
│                                              │
│  Format                                      │
│  [ College ] [ School ] [ Federation ] [ ⚙ ]│  preset chips; ⚙ = custom
│  15 points · best of 3 · decider to 11        │  plain-English echo of the picked preset
│  Every rally = a point (rally scoring)        │  the ambiguity, stated (research §1)
│                                              │
│  Teams                                       │
│  ┌───────────────┐   ┌───────────────┐       │
│  │ Home  ● colour│   │ Away  ● colour│       │  name (sentence case) + colour swatch
│  └───────────────┘   └───────────────┘       │
│                                              │
│  ▸ More options (optional)                    │  <details>: rosters, Track serves, Quick mode,
│                                              │             timeouts on, tournament link
│  ┌─────────────────────────────────────────┐│
│  │            Start scoring  ›               ││  primary
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```
- Preset chip sets the whole config; the echo line reads it back in words. `⚙` custom exposes target/cap/bo/decider steppers (rarely needed).
- Team names sentence-case; colour swatch feeds the board's per-side colour. Rosters, "Track serves," Quick mode, timeouts, tournament link all live under **More options** — invisible to the default flow.
- **Nothing here is required except preset + two names.**

---

## 3. Screen 2 — Lean scorer (casual-Guided DEFAULT)

Read at top, tap at bottom. One decision per rally. **No secondary strip on this default.**

```
┌─────────────────────────────────────────────┐
│ ‹  Madras vs Chennai · Set 3 · to 11    ≡    │  top bar (≡ = More)
│                                    ● LIVE     │
│  ┌───┐┌───┐┌───┐                             │  set-box strip (brutalist chips)
│  │15 ││ 9 ││ 8 │  ← live set outlined green   │
│  │12 ││15 ││ 6 │                             │
│  └───┘└───┘└───┘                             │
│  ╭─────────────────────────────────────────╮│  green-wash board readout (State A)
│  │ MADRAS          SETS 1 · 1       CHENNAI ││
│  │    8                              6       ││  GIANT mono; leader = green
│  ╰─────────────────────────────────────────╯│
│         SET POINT · MADRAS                    │  ONE context line (warning tint)
│                                              │
│  ┌──────────────────┐ ┌──────────────────┐  │  ◄ THE PRIMARIES ►
│  │    + MADRAS      │ │    + CHENNAI     │  │  giant one-tap point buttons
│  │        8         │ │        6         │  │  live score on the face; leader = green
│  └──────────────────┘ └──────────────────┘  │
│                                              │
│  ┌──────┐  ┌──────────────────────────────┐ │  control row
│  │ ↩ Undo│  │            ⋯ More            │ │  undo ALWAYS visible
│  └──────┘  └──────────────────────────────┘ │
│  Scorecard ›                     Share live ↗│  quiet footer
└─────────────────────────────────────────────┘
      (safe-area padding at bottom)
```
Layout: single column, `max-width:390px`, `min-height:100dvh`, bottom padding `env(safe-area-inset-bottom)`. Primaries fill two equal columns — the bottom half of the screen is a point tap; the operator never aims.

**Mandatory handoff — set/match break (the ONLY blocking inline step):** on completion the primaries are replaced by one confirm card:
```
   MADRAS TAKE SET 2 · 15–12
   Match level 1 · 1
   ───────────────────────────
   Next: Set 3 · to 11 · Chennai to serve
   [ ↩ Undo ]            [ Continue › ]
```
`Continue` carries finals into the strip, resets points, swaps in the decider target (the explicit "to 11" moment), re-arms serve, folds the side-swap note in. Match break is the same shape, terminal: `MADRAS WIN 2–1 · 15–12, 9–15, 11–8` → `[Undo] [View result ›]` (gold peak lives on the result card, never here). Plain-English lines because the scorer is usually the same person reporting up a WhatsApp chain.

**Federation / Quick additions (opt-in only):** a quiet secondary strip appears — serve override `▸◂` (Federation), `⚑ Tag point` fault pill-row (roster/Quick, pure optional stat colour, point already scored), timeout counter (if enabled). Quick mode replaces the set-break confirm card with a 3s undo-toast auto-advance. **None of this touches the default path.**

**Off the scorer, always:** momentum worm, per-player rows, faults-by-type analysis, zone tap-to-place, rotation board, manual score math, gold/glow/confetti. The operator never types a number.

---

## 4. Screen 3 — Main scoreboard, live (the hero bug)

The pure record object — filmable, castable, embeddable. Five facts, no sixth. Two states.

**Five facts (priority order):** ① two team identities (colour + name, home LEFT / away RIGHT, never swaps) · ② current-set points (the two giant mono numerals — the thing the eye lands on) · ③ sets-won tally (`1 · 0`, centred) · ④ serve marker (`▸/◂`, Federation only) · ⑤ set/match-point flag (one mono stamp + escalation tint). Plus **one** context line (never stacked): normal→set-strip stands in; else `SET POINT · MADRAS` / `MATCH POINT · MADRAS SERVE FOR IT` / `DEUCE · WIN BY 2` / `CAP 17 · NEXT POINT WINS` / `MADRAS TAKE SET 2 · 15–12 · MATCH LEVEL 1–1`.

- **State A — Compact (default):** lives inside the scorer shell (which owns the hard frame). Green-wash container, **no black inversion**, leader numeral green / trailing ink. Serve marker Federation-only. Set-box strip above.
- **State B — Live hero (spectator/stadium/cast):** takes the screen's single inversion — flat-black hero (cricket `.hero`), inverse mono numerals, leader in green. Adds full sentence-case names, the `hero-note` context sentence, set-box strip with inline finals (`25–22 · 23–25 · 8–6◦`, live = `◦`), the match-point banner in plain language, serve marker always, the one live pulse.

```
State B (hero):
┌─────────────────────────────────────────────┐
│  ██ FLAT-BLACK HERO ██                        │
│  Madras          SETS 1 · 0      Chennai      │
│    8  ▸                            6          │
│  25–22  ·  23–25  ·  8–6◦                      │
│  ─────────────────────────────────────────    │
│  Match point — Madras serve for it            │  hero-note (danger tint)
└─────────────────────────────────────────────┘
```
Escalation ladder is the only state encoding; set completion freezes the final into a chip — the board shows only live or final, never a half-state. **Never on the board:** rotation, per-player stats, fault pills, timeout clocks, the momentum worm, win/loss colour on the trailing team, gold/glow/confetti, projections/predicted-%, ad slots.

---

## 5. Screen 4 — Scorecard + result (the record & the one peak)

Reached from the scorer footer, the spectator tab, or match end. Read-a-fact-off-a-row → brutalist table grammar.

- **Per-set breakdown table:** one row per set — final score, duration, longest run, set-point saves. Mono chips.
- **Result line:** `Madras win 2–1 · 25–22, 23–25, 11–8` — plain margin, mono set line.
- **Result / POTM card = the single designed peak:** gold milestone + the ONE glow of the whole product, reduced-motion → static gold, no glow. Auto-nominated Player-of-the-Match (from point stream / optional zone tags) the operator one-tap confirms; POTM is skippable and absent-safe without rosters.
- **Share:** the result card renders to a branded image (mono record grammar, house colours, exact score line) — replaces the incumbent's plain text-dump.

---

## 6. Spectator live page (built around State B — the watchable story)

Single scrolling column, opens on **Live**. Three capsule tabs keep density one tap away.

| Tab | Owns |
|---|---|
| **Live** | State-B hero + run badge + momentum worm (`<details>`, collapsed) + now-card (`SERVE / THIS SET need N / LAST 5`) + moments feed (≤8, reverse-chron) + reactions footer. |
| **Scorecard** | Per-set breakdown, result line, POTM (Screen 4). |
| **Stats** | Serve/throw heat grid (when tracked) + set-point pressure + team run summary + per-player points (roster). Absent-safe: shows momentum + pressure + `Serve zones not tracked this match`. |

The two big numbers + whose-serve are always the loudest thing; everything below is progressive (run badge appears only while a run stands; worm collapsed; feed capped). One inversion (hero), one pulse (LIVE dot), zero gold on any live tab.

---

## 7. Signature moments (locked, reduced-motion-gated, ≤1 beat at a time)

| # | Moment | Trigger | Motion (reduce → state only, no motion) |
|---|---|---|---|
| 1 | Set-point escalation | `setPoint({team})` | hero-note fades in, row tint → warning-soft (~200ms). Disarms silently on loss; "saved" goes to the feed. |
| 2 | Match-point banner | `matchPoint({team})` | note → `Match point — {team} serve for it`, tint → danger-soft, 120ms scale on note only. Supersedes set-point (one flag). |
| 3 | **Run badge — THE signature** | run ≥4 to one team (re-fires 5,6,…) | `▸ {team} on a {n}-point run 🔥` slides in above the worm; crossed worm bar fills green. Auto-dismisses the instant the other team scores → feed line `broke an N-point run`. Mono-first; 🔥 optional accent. |
| 4 | Set won | set completion | 220ms chip fill + `{team} take Set 2 · 25–23 · match level 1–1`; feed prepend. No celebration chrome. |
| 5 | Decider start | new set, different target | `SET 3 · TO 11` one-shot underline sweep; now-card `need N` recomputes. |
| 6 | Side-out swing (Fed only) | serve broken after run ≥3 | single 120ms marker flip + feed line `Chennai break serve`. |
| 7 | Match won → result peak | match completion | Hands to result/POTM card: the ONE gold + ONE glow. Never on the live board. |

A beat earns animation only if it changes what matters right now; point-to-point changes get score-pop + press physics only.

---

## 8. Interactive tracking layer (OPTIONAL · on-demand · gated)

**Serve / Throw Zone Tracking** — the wagon-wheel analogue. **Never on the casual default path.** Appears only in roster mode or when "Track serves" is flipped on at setup.

- **On-demand, post-point:** a scored point slides up a `Where did it land?` sheet over the primaries; tap the receiving half once → zone lights → auto-saves → back to scoring. **Skip is always one tap;** a skipped point carries no zone (score already recorded — tracking NEVER blocks).
- **Granularity preset (set once):** **Simple** = 6 zones (Deep/Short × L/C/R, default) · **Grid** = 3×3 · **Free** = raw (x,y), buckets to grid, keeps dot for a future shot-line render.
- Won rally → tap where the winning throw/serve landed (green); long-press = fault-at-receipt (muted); neutral-box edge tap = `out/dead`.
- **Feeds** the Stats-tab heat grid (per team / per player) + a `hot zone` line on the now-card when a clear pattern emerges. Absent-safe.

**Easy-now vs future within this layer:** the *free-from-stream* companions (momentum worm, run badge, set-point pressure) are **easy-now**. Zone tap-to-place → heat grid is **future (ship second)**; per-player heat, Free-mode dots + shot-line animation, rotation overlays are **later (federation)**.

---

## 9. Ordered build plan

**Phase A — Usable single-match core (must ship together to be usable at all):**
1. **Set engine** — atomic `point→{A|B}`, win-by-2 + cap + per-set-target + set/match completion, serve auto-flip, undo 100-deep across boundaries, preset config object. *(All rule intelligence. The moat.)*
2. **Setup screen** — preset chips + plain-English echo + rally-scoring line + team name/colour. More-options `<details>` for the rest.
3. **Lean scorer (Guided default)** — two point buttons, always-on undo, State-A board readout, set/match break confirm cards.
4. **Main scoreboard component** — State A (compact) + State B (hero), shared by scorer/spectator/cast.
5. **Scorecard + result/POTM card** — per-set table, result line, the one gold peak; result-card image share.

**Phase B — The watchable story (free from the stream, category-defining):**
6. **Spectator live page** — State-B hero + run badge + momentum worm + now-card + moments feed.
7. **Signature moments 1–7** wired to engine events, reduced-motion-gated.
8. **Cast / PA mode** — render State B fullscreen to projector/second phone.

**Phase C — Adoption layer (wins the department, not just the match):**
9. **League & Bracket** — create-tournament (round-robin / knockout / groups→knockout), team = name+colour, each finished match auto-updates standings + bracket. *The single biggest season-adoption lever.*
10. **Shareable moment cards** (in-match: run / set / match-point) + **spectator reactions + presence count** (realtime).

**Phase D — Federation / power (opt-in depth):**
11. Quick mode strip (serve override, fault-tag pill-row, toast-advance), rosters + substitution.
12. **Zone tap-to-place → heat grid** + set-point pressure stats + auto-POTM from tags.
13. Per-player heat, Free-mode shot-lines, rotation overlays, timeouts, **side-out scoring mode** (the latent seam), PA auto text call-outs.
