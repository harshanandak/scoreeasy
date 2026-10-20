# Badminton — DECISIVE FINAL DESIGN (locked, buildable)

**Date:** 2026-07-26 · **Status:** FINAL — LOCKED · **ICP:** Indian school / college / university / local-ground scorers + the phone-first room watching them.
**Design system:** design1-mono (brutalist × HiFi blend). Inherits the cricket blend-rubric and cricket exemplars (`cricket-scorer-alt-big5.html`, `cricket-spectator-clean.html`, `cricket-shot-tracking.html`) **verbatim** — flat black ink hero, mono tabular numerals, ONE hard offset shadow (`3px 3px 0`), **green = lead/live/serve accent ONLY**, one live pulse, one gold (match won only), capsule segmented tabs, collapsible `<details>` richness. This spec does not re-decide the blend; it locks badminton onto it.

**Design thesis (one line):** Badminton is the leanest scorer of any racquet sport — two enormous side-buttons, one tap per rally — and the entire product value is the *derived truth* (who serves, from which box, whose rotation, did we change ends) rendered so trustworthily that the app becomes the referee nobody argues with.

---

## 0. CRITIQUE OUTCOME — what survived, what was cut

The four source docs (`research`, `main-scoreboard`, `scorer`, `live-innovations`) are strong and coherent. Verdicts against the five lenses, with cuts applied into this spec:

**(a) Scorer lean + un-fumbleable — PASS.** The Big-2 (two side-buttons, one tap per rally) is the leanest possible input and the spatial map (left button = left court, buttons swap on change-ends) is the right anti-fumble device. Kept whole.
- **Cut/trim:** `Let / replay` does NOT earn a permanent key beside Undo — casual lets are rare. **Undo is the only fixed secondary; Let moves into the control strip's compact row but at lower visual weight, and is muted entirely in Count-only mode.** Undo stays the single big fixed key.

**(b) Main scoreboard glanceable — PASS.** Five facts, scores dominant by 3–4×, one green = leader. State B (stadium/cast) earns prev-game line scores because hall audiences join mid-match. Kept whole. No cuts.

**(c) Innovations — real value vs gimmick — MOSTLY PASS, two cuts:**
- Service-court view (always-on, derived): **REAL — this is the wedge. Ship at launch.**
- Winning-shot zone placement (opt-in, off fast path): **REAL — the wagon-wheel parallel. Ship as optional enrichment, Simple 6-zone only.**
- Doubles rotation trainer (toggle on the service-court view): **REAL + cheap + uniquely ours. Easy win.**
- Momentum timeline (CSS-only, derived): **REAL, cheap. Ship at launch.**
- Share moment cards: **REAL growth lever. Easy win.**
- **CUT from launch — rally-length per-shot tapping.** Tapping once per shuttle contact is many taps on the one action that must stay instant; a casual scorer will not do it. **Deferred to a single-bit optional `long rally` long-press only, future.** No per-shot counter ships.
- **CUT for launch — Detailed (real service-line) zone model.** Ship the Simple 6-zone + 2 error chips only; the club-precision model is future.

**(d) Minimal-brutalist blend, no new colours — PASS with one pin.** All specs reuse one green / one shadow / one pulse / one gold and the warning-soft→danger-soft ladder (no new hue).
- **Pin:** the zone-heatmap "red-tinted" error tallies MUST bind to the existing **`danger-soft` token**, never a fresh red. Win-density wash = the existing green `--wash`. No new colour enters anywhere.

**(e) School/university adoption — PASS.** Offline phone-first scorer + share cards + one-link no-install spectator are the real levers; bracket mode is the department-wide wedge.
- **Sequencing correction:** one-link live spectator, brackets, and season profiles need persistence/realtime backend — they are **NOT "easy now."** Launch is the offline single-match scorer + board + scorecard + share-card export. Networked features are Phase 2+ (flagged below).

---

## 1. THE FOUR SCREENS

### SCREEN 1 — SETUP (pre-match, <60s)

Single scroll, HiFi-soft cards on white, one primary button. Captures only what the engine cannot derive.

**Fields (in order):**
1. **Format preset** (segmented chips, house-rule aware — the category gap):
   - `Best of 3 · to 21` (BWF default, win-by-2, cap 30) — **default**
   - `Single game · to 21`
   - `Single game · to 15`
   - `Single game · to 11`
   - `Flat to 21 (no deuce)` — win-by-2 OFF, cap OFF (gully/college time rule)
   - `Best of 3 · to 15`
   - Advanced (collapsed `<details>`): independent toggles `win by 2`, `hard cap` (default 30), `points-to-win`, `games-to-win`.
2. **Discipline:** `Singles` · `Doubles` · `Mixed` (segmented) — drives the serve engine.
3. **Sides:** two name fields. Singles → one name each. Doubles/Mixed → `Player 1` + `Player 2` per side. **Names list stays visible above the keyboard** (fixes the category leader's #1 doubles bug where the keyboard hides the pre-listed names).
4. **Left/right court assignment:** a single `Which side is on the umpire's left?` toggle — seeds the spatial button map.
5. **Context (optional, collapsed):** event · round · court label (feeds board chrome; blank = hidden).
6. **Scoring mode:** `Guided` (default, full engine) · `Count-only` (mutes serve/court/rotation/change-ends). One line, explained inline.
7. **Enrichment (optional, collapsed, all OFF by default):** `Track winning-shot zones`, `Doubles rotation trainer`.

**Primary:** `Start match →`. First game's first server: prompt one tap `Who serves first?` (coin-toss result) — the only serve entry in the whole product; everything after is derived.

---

### SCREEN 2 — LEAN SCORER (the operator tool)

**Locked layout, top → bottom** (glanceable state on top, thumb primaries on bottom — cricket law verbatim):

```
┌──────────────────────────────────────────────┐
│ ‹  Sunday Cup · SF · Court 2      ● LIVE   ≡  │  top bar (chrome)
├──────────────────────────────────────────────┤ ◄ compact READ-ONLY readout (mini-board, 5 facts)
│  ■ □                              ■ ■         │  games pips
│  🏸 A. SHARMA            MEERA & RIYA         │  names + serve shuttle (green)
│      18       GAME 3  R        21             │  scores (green=lead) · phase · court box R/L
│               DECIDER                         │
├──────────────────────────────────────────────┤
│  ↶ Undo                         Let   ⋯ More │  control strip — Undo = big fixed key; Let/More small
├──────────────────────────────────────────────┤
│                                                │
│   ┌────────────────┐  ┌────────────────┐      │
│   │  🏸 A. SHARMA  │  │  MEERA & RIYA  │      │  ◄── THE TWO PRIMARIES
│   │       18       │  │       21       │      │      full-width 50/50, tallest targets,
│   │    + POINT     │  │    + POINT     │      │      thumb zone. tap = this side won the rally.
│   └────────────────┘  └────────────────┘      │      left button = umpire's-left court.
└──────────────────────────────────────────────┘
```

**Rules:**
- **One tap per rally.** Tapping a side-button = "this side won." No modal, no serve entry, no court entry.
- Each button live-shows: side **name**, side **score**, **🏸** on whichever side currently serves.
- **Buttons swap left/right on change-ends** so left-button = left-court stays true all match.
- **Undo** = single big fixed key, LIFO revert + full re-derive. `Let` = one tap, no point, re-serve same server/court (muted in Count-only). `⋯ More` = bottom-sheet.
- **`More` sheet (rare):** Correct → *Fix serve/court*, *Correct last point*. Match → *Timeout/interval*, *Retire / injury / walkover* (the sport's only interruption path — no substitutions exist), *Edit setup*, *Share ↗*. End → *End game* / *End match*.
- **Guided (default):** full derived-state engine — serve side, court R/L, doubles rotation (server-of-pair + consecutive-point court swap + diagonal receiver), deuce/cap/game-point/match-point, auto change-ends + game/match handoffs.
- **Count-only:** mutes serve/court/rotation/change-ends prompts; keeps two buttons, two scores, win-logic (deuce/cap so the game still ends right), Undo. A reduction of Guided, not a new screen.
- **Banned from the scorer** (lives on board/scorecard): momentum, stats, per-game rail, zone heatmap, rally-length, faults/cards, ticking timers, second colour, VS divider, manual serve as a normal step, mid-flow player edit.

**Inline one-tap handoffs** (banners in the flow, never modals, HiFi-soft outside the black readout):
- **Change ends** (each game end; and at 11 in the decider): `⇄ CHANGE ENDS · Sides swapped [Done]` → swaps button positions. Muted by setup toggle "don't prompt ends."
- **Game complete:** `GAME 2 → MEERA & RIYA · 21–18 · serves next: Meera · ends swapped [Start Game 3] [120s interval]`. Interval chip optional, never blocks.
- **Match complete:** the gold moment (§2).
- **Intervals** (60s@11, 120s between games): optional chip inside the banner; umpire mode shows the countdown, casual ignores.

---

### SCREEN 3 — MAIN SCOREBOARD / LIVE (glanceable, read-only)

**The FIVE facts, ranked** (scores out-mass everything else combined):

| # | Fact | Weight | Treatment |
|---|------|--------|-----------|
| 1 | **Two current-game scores** | DOMINANT (3–4× everything) | Mono tabular 800, `.ck-hero-score`; **leader = green**, trailer = inverse-white; tie = neither green |
| 2 | **Names/pairs + serve indicator** | HIGH, small type | Mono caps eyebrow; serving side carries **🏸** + **`R`/`L` court stamp** (grammar-2 chip); doubles: server bolded, receiver faint |
| 3 | **Phase strip** (center seam) | MEDIUM | One phrase: `GAME 3 · DECIDER` → escalates in place to `DEUCE · WIN BY 2` / `GAME POINT` / `MATCH POINT` / `CHANGE ENDS` |
| 4 | **Games-won pips** | LOW | `■ □` per side, outside names |
| 5 | **LIVE + context** | LOWEST (chrome) | Header: event · round · court + `● LIVE` (the one pulse) |

**Two states, same five facts:**
- **State A — compact live board (portrait, ~390px):** the default score bug. One black card, no scroll, everything else renders *below* it on the live page (not on the card).
- **State B — live-screen hero (landscape, stadium/cast):** two big columns split by a center rule, score numerals `clamp(4rem, 22vw, 15rem)`, pips become countable filled/empty squares, phase runs as a full-width band under the rule, **prev-game line scores** flank the band (the only extra fact the big board earns). Header shrinks to a quiet strip.

**Live page (below the board, Live tab), glance-order = DOM order:**
1. Hero board (fixed, never redraws on tab switch).
2. **Serve/court NOW-strip** — the wedge in plain English: `SERVING · Sharma · from the RIGHT box` (doubles adds `Receiving · Riya (diagonal)`). Green, one line, zero input.
3. **Momentum** — collapsed `<details>`, summary line carries the run (`6 in a row ▲`); open → CSS-only point-run bars.
4. **Key-moments feed** — beats only (§2), newest on top, ~6 visible. NOT per-point.
5. **Presence footer** — `👁 watching · 🔥 reactions` + Follow (Phase 2, networked).

**Three tabs:** `Live` (default) · `Court` (service-court view + zone heatmap + rally-length) · `Stats` (serve/receive split, streaks, serve retention, deuce/decider record, per-game lines).

**Banned from the board:** rally count, point-win %, streak counters/momentum bars *on the card*, timers, shuttle speed/Hawk-Eye, faults/cards, a second colour/gradient/VS badge, both scores green, action buttons, instructional text on the record.

---

### SCREEN 4 — SCORECARD (post-match record + the share surface)

The permanent record and the growth engine. Black-hero aesthetic, mono figures.

- **Result header:** winner + margin in plain language (`Meera & Riya · 2–1 · 21–18 · 18–21 · 21–19 (decider)`), `COMEBACK` tag if earned.
- **Per-game line scores** with change-ends and deuce/cap markers.
- **Derived stats (zero extra input, from the rally log):** points won on own serve vs on receive, longest point streak, serve retention, deuce-game record, decider record, per-game duration if timed.
- **Enrichment stats (only if captured):** winning-shot zone map per player (`Meera finishes 61% of points in the REAR court`), rally-length split if the long-rally bit was used.
- **Share:** one-tap `Share ↗` → branded square card (black hero + green accent + mono figures) auto-captioned from the peak beat.

---

## 2. SIGNATURE MOMENTS (locked — 7 beats, all reduced-motion-gated, one green/one pulse/one gold)

Every animation is token-driven (CSS custom properties) and gated behind `prefers-reduced-motion: reduce` — when reduced, the **state still changes correctly**, only the transition is instant. Ranked by real court reaction:

1. **Serve hand-over** — `servingSideId` flips → **shuttle glides across the seam** (`--se-serve-travel` ~220ms) to the new server, court chip flips `R↔L`. The badminton identity animation; the only one that fires every rally, so it is the lightest (a translate, no pulse, no colour).
2. **Game point / match point** — phase strip **escalates in place**: `GAME POINT` (warning-soft) → `MATCH POINT` (danger-soft) + the single LIVE-dot **pulse** (the one allowed pulse). No new hue.
3. **Deuce / cap run** — persistent `DEUCE · WIN BY 2` state banner (not animated); appends target near cap, reads `SUDDEN POINT` at 29–29. Explains why it isn't over.
4. **Point streak / momentum swing** — run counter bumps (`6 in a row ▲`), feed row drops in (`--se-feed-in` ~180ms), green run-bars fill.
5. **Game won** — hero freezes the final, one **soft green sweep** across the winning column (`--se-game-sweep` ~400ms), human sentence to the feed, pips update. Not confetti.
6. **Comeback** — game/match won after trailing by ≥6 → `COMEBACK` tag (mono caps, green) on the sentence + auto-caption on the share card. A label, not a new animation.
7. **Match won** — the **gold milestone card + confetti** — the one gold treatment in the entire product, only here; plain-language margin, share/scorecard/new-match actions.

---

## 3. INTERACTIVE TRACKING LAYER (marked: optional / on-demand; easy-now vs future)

| Layer | Input cost | Status | Launch? |
|-------|-----------|--------|---------|
| **Service-court view** (§3.3 source) — server, box, doubles rotation, diagonal receiver, all derived | **Zero** | **Always-on signature** | **EASY-NOW — ship at launch** (Court tab + spectator explainer) |
| **Momentum timeline** — per-game worm, deuce/game-point markers, CSS-only | Zero (derived) | Always-on richness | **EASY-NOW — ship at launch** |
| **Doubles rotation trainer** — toggle that annotates *why* each hand-over happened on the service-court view | Zero (toggle) | Optional, on-demand | **EASY-NOW — ship at launch** (differentiated, cheap) |
| **Winning-shot zone placement** — post-point HiFi sheet, **Simple 6-zone** (front/mid/rear × L/R) + `INTO NET` / `LONG-WIDE`, one tap, **Skip** loses nothing, point already committed | One optional tap AFTER the score commits | **Optional, on-demand, OFF by default** — never on the fast path | **EASY-NOW as opt-in enrichment** (Simple model only). Heatmap wash = green `--wash`; error tallies = `danger-soft` token (no new hue) |
| **Detailed zone model** (real service-line precision) | Same gesture, more zones | Optional | **FUTURE-FLAGGED** |
| **Rally-length** — single-bit `long rally` long-press only (NO per-shot counter) | One optional long-press | Optional, OFF | **FUTURE-FLAGGED** (per-shot tapping cut entirely) |

**Model fields reserved now (stable schema whether or not captured):** `zone ∈ {frontL…rearR, net, long}`, `rallyLength` (int or long-bit). Muted/absent when off.

---

## 4. SCORING MODEL (the engine — pure functions of the rally log)

**Rally record:** one entry per rally — `{ rallyId, winnerSideId, ts, zone?, rallyLength? }`. Everything below is derived, never entered:

- **Point:** `+1` to `winnerSideId`.
- **Serving side:** `= winner(lastRally)` (win → serve; lose → serve passes).
- **Service court:** `serveCourt = (servingSide.pts % 2 === 0) ? 'R' : 'L'` (even→right, odd→left).
- **Singles:** server + receiver positions dictated by server-score parity.
- **Doubles:** one serve per side (no second server). Serving pair hold left/right; only the **server** swaps courts with partner on **consecutive** points by the serving side; on serve loss players stay, new side serves per parity. Receiver = diagonal. **This is the single hardest rule and the app's core correctness value — the engine owns it, the operator never bookkeeps it.**
- **Game:** to `pointsToWin` (default 21); **win by 2** if enabled, else flat; **hard cap** (default 30) if enabled — at 29–29 next point wins. Toggles independent (Flat-to-21 = both off).
- **Match:** best-of-`gamesToWin` (default 2 of 3); winner of a game serves first next game.
- **Change ends:** end of each game; and mid deciding game when either side first reaches 11. Muteable.
- **Phase detector (derived):** `GAME n` / `DECIDER` / `DEUCE · WIN BY 2` / `GAME POINT` (a side ≥ win-1 with lead ≥1) / `MATCH POINT` (game point in the deciding/final game) / `CHANGE ENDS` / `SUDDEN POINT` (29–29).
- **Undo:** LIFO pop of last rally → full re-derivation of every state field.
- **Interruption:** Retire / injury / walkover awards the match per rule and jumps to the match moment. No substitutions exist in badminton.
- **Reserved-but-unsurfaced (umpire-tier):** service-fault typing, faults ledger, misconduct cards (yellow/red/black), shuttle-change count, 60s/120s interval timers. Model fields only, zero casual surface.

**Correctness guarantee:** every board/scorecard field except names and event context is a pure function of the rally log. The operator answers exactly one question per rally — *which side won?* — and the derived truth is what the category currently gets wrong.

---

## 5. ORDERED BUILD PLAN

**Phase 1 — Core engine + scorer (the wedge; offline, single-match):**
1. Rally-log data model + reserved fields (`zone`, `rallyLength`, umpire-tier stubs).
2. Derivation engine: serve/court parity, **doubles rotation** (the hard rule — test-first, exhaustive), deuce/cap/win-by-2 toggles, phase detector, change-ends, undo re-derive.
3. Setup screen (format presets incl. Flat-to-21, discipline, names-above-keyboard, left/right seed, first-server tap).
4. Lean scorer: two primaries + spatial swap, compact readout, Undo fixed key, Let/More strip, inline handoffs, Guided + Count-only.
5. Engine unit tests: parity, doubles swap, deuce→cap→sudden-point, best-of-3 change-ends-at-11, undo LIFO.

**Phase 2 — Board + scorecard + moments (offline still):**
6. Main scoreboard State A (compact bug) + State B (stadium/cast).
7. Signature moments 1–7 (token-driven, reduced-motion gated).
8. Scorecard with derived stats (serve/receive split, streaks, retention, deuce/decider record, per-game lines).
9. Share moment-card export (branded square, auto-caption). **Growth lever, offline.**

**Phase 3 — Tracking layer (opt-in, still offline):**
10. Always-on **service-court view** (Court tab) + doubles rotation trainer toggle.
11. **Momentum timeline** (CSS-only worm).
12. **Winning-shot zone placement** (Simple 6-zone sheet, opt-in) → Court-tab heatmap (green `--wash` + `danger-soft` errors) + zone stats.

**Phase 4 — Networked / institutional (FUTURE, needs backend/persistence):**
13. One-link live spectator (no-install URL) + reactions + presence.
14. Zero-setup league / bracket mode (`joincode`).
15. Player milestone & season profiles.
16. Detailed zone model + rally-length single-bit long-press.

---

**Final law:** the black hero holds five facts, the scorer holds two buttons, the engine holds all the truth, and every richer thing — moments, stats, zones, share cards, brackets — renders *around* the rally log, never *on* the tap surface. One green, one shadow, one pulse, one gold. Read it across a gym; score it with one thumb.
