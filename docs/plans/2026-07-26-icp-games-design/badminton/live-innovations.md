# Badminton — the LIVE / SPECTATOR screen + signature moments + interactive tracking

**Date:** 2026-07-26 · **Status:** LIVE SPEC (decisive) · **ICP:** Indian college / school / local-ground scorers **and the phone-first room watching them** — the lean-back audience the category leader charges a 30-day trial to reach.
**Design system:** design1-mono (brutalist × HiFi blend). Inherits the cricket spectator pattern (`cricket-spectator-clean.html`) and the cricket shot-tracking sheet (`cricket-shot-tracking.html`) **verbatim** — flat black hero, mono tabular numerals, ONE hard offset shadow (`3px 3px 0`), green = lead/live accent ONLY, one live pulse, capsule segmented tabs, collapsible `<details>` richness. This spec does not re-decide the blend or the board (`main-scoreboard.md`) or the scorer (`scorer.md`); it builds the *watch* experience **around** the board and specifies the tracking layer the scorer deliberately keeps off itself.

**The thesis for THIS screen:** the board answers *"what's the score."* The live screen answers *"what's the story"* — who's serving, who's on a run, is it match point, where are points being won — for a person who did **not** score the match and joined mid-game. Cricket's spectator page had run-rate math to chew on; badminton has almost none, so the richness must come from **derived narrative** (momentum, serve/receive split, deuce tension) and the **one spatial layer** (winning-shot court zones) that no casual badminton app renders today. The board is the hero; everything below it is context, ranked, and collapsible. If a late-joiner reads the hero and one card, they know the match.

---

## 1. Live screen layout — the board + simple scores + ranked richer context

### 1.1 Shape: one screen, three tabs, the board always on top

Same capsule-segmented tab bar as cricket (`.tabs`), same fixed black hero, same portrait ~390px. Three tabs:

| Tab | Holds | Who it's for |
|-----|-------|--------------|
| **Live** (default) | Hero board · serve/court now-strip · momentum run · point-run/streak · key-moments feed · presence footer | The lean-back watcher — 90% of sessions |
| **Court** | The always-on **service-court view** (§3.3) blown up · winning-shot **zone heatmap** (§3.1) · rally-length distribution (§3.2) | The analyst / the doubles pair arguing about rotation |
| **Stats** | Points won on serve vs receive · longest streak · serve retention · deuce-game & decider record · per-game line scores | Post-match, the "who actually played better" read |

**Tab discipline (inherited):** the hero board renders **above** the tab bar and is identical on Live and Court — it never moves or redraws when you switch tabs, so the score is a fixed anchor. Only the region *below* the tabs swaps. (Cricket kept the hero constant across Live/Scorecard/Stats — same rule.)

### 1.2 The Live tab, top → bottom (glance-order = DOM order)

```
┌──────────────────────────────────────────────┐
│  ‹   Sunday Cup · SF · Court 2      ● LIVE  ↗ │  header chrome — {event}·{round}·{court}, liveDot, share
├──────────────────────────────────────────────┤
│  [ Live ]   Court    Stats                     │  capsule tabs
├──────────────────────────────────────────────┤ ◄─ flat BLACK hero (main-scoreboard.md State A, verbatim)
│  ■ □                              ■ ■          │  games pips
│  🏸 A. SHARMA            MEERA & RIYA          │  names + serve shuttle
│      18      GAME 3 · R        21             │  scores (green=lead) · phase · court box
│              DECIDER                          │
│              DEUCE · WIN BY 2  ← escalates in place
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│  SERVING  🏸 Sharma · from the RIGHT box       │  serve/court NOW-strip (the wedge, spelled out)
│  Receiving  Riya (diagonal)                    │  doubles: server-of-pair + diagonal receiver
└──────────────────────────────────────────────┘
  ▸ Momentum · this game            6 in a row ▲  ◄─ collapsed <details> (cricket .mom-d pattern)
     ▁▃▅█▂▄▇▅▆▃█▄  (point-run bars, CSS-only)
┌──────────────────────────────────────────────┐
│  KEY MOMENTS                                   │  feed (cricket .moment pattern)
│  21   GAME POINT · Sharma leads 20–18          │
│  18   6 IN A ROW · Meera & Riya claw back      │
│  11   CHANGE ENDS · decider, 11–7              │
│  —    GAME 2 → Meera & Riya · 21–18            │
└──────────────────────────────────────────────┘
   👁 128 watching · 🔥 34            Following ✓   presence footer
```

**What each block is and why it earns its rank:**

1. **Hero board** — the five facts, unchanged from `main-scoreboard.md`. Non-negotiable, always first, never redrawn on tab change.
2. **Serve/court NOW-strip** — badminton's identity fact written as a **plain-English sentence**, not just the board's `🏸`+`R` glyph. `SERVING · Sharma · from the RIGHT box` / in doubles adds `Receiving · Riya (diagonal)`. This is the spectator translation of the wedge: a watcher who doesn't know parity rules still learns *why* Sharma is on the right. Zero input — pure derived state. Green shuttle, one line, sits directly under the hero because "who serves" is the second thing a badminton watcher reads (board hierarchy law: score → serve → phase).
3. **Momentum run** — collapsed `<details>` exactly like cricket's `.mom-d`, labelled `Momentum · this game` with the current unanswered-run on the summary line (`6 in a row ▲`). Open it → a CSS-only point-run bar chart (one bar per point in the current game, height = who won it, green = leader's points, danger-soft = trailing side's). Derivable entirely from the rally log, no library. **Collapsed by default** so the lean-back view stays calm; the number the crowd cares about (the run) rides the summary line without opening.
4. **Key-moments feed** — the cricket `.moment` list, reused. Each row = a left rail (game-point score or `—`) + a sentence. Populated only by **drama beats** (§2): game/match point, streaks of ≥4, change-ends, deuce reached, comeback, game won. NOT every point — a badminton game is ~40 rallies; a per-point feed is noise. One line per *beat*, newest on top, ~6 visible.
5. **Presence footer** — cricket's `.pres`: `👁 watching · 🔥 reactions` + a Follow pill. The lean-back social layer (§4).

**Balance rule (the whole point of the layout):** the board + serve-strip are **always expanded** (the two facts a late-joiner needs). Momentum is **collapsed** (richness on demand). The feed is **short** (beats, not ball-by-ball). Court/zone/rally-length analysis lives on its **own tab** (opt-in depth). Nobody scrolls a wall; everybody gets score + serve free, and can dig exactly as deep as they want.

---

## 2. Signature moments — the drama beats worth a tokenized, reduced-motion-gated animation

**Restraint law (inherited verbatim from the blend + board specs):** **one** hard shadow, **one** green accent, **one** LIVE pulse on screen at a time. Every animation below is **token-driven** (duration/easing/travel are CSS custom properties, never hardcoded) and **gated behind `@media (prefers-reduced-motion: reduce)`** — when reduced motion is on, the *state still changes* (the chip appears, the shuttle is on the new side, the band turns danger-soft) but the *transition* is instant, no glide, no pulse. Animation is decoration on a state change that is already correct without it. Ranked by how much a real court crowd reacts:

| # | Moment | Trigger (derived, zero input) | The animation | Restraint |
|---|--------|-------------------------------|---------------|-----------|
| **1** | **Serve hand-over** | `servingSideId` flips (rally won by the non-serving side) | The **shuttle glyph glides across the center seam** (`--se-serve-travel`, ~220ms ease-out) to the new server; the court chip flips `R↔L`. This is the badminton identity animation. | The *only* animation that fires every rally, so it must be the lightest — a translate, no pulse, no color. Reduced-motion: shuttle just appears on the new side. |
| **2** | **Game point / match point** | a side is 1 point from taking the game (`≥20 and lead≥1`, or cap) / from the match (decider or 2nd game) | The **phase strip escalates in place**: `GAME POINT` (warning-soft chip) → `MATCH POINT` (danger-soft chip) + the single LIVE-dot **pulse** switches on. No new element slides in — the existing strip changes weight/tint. | The pulse is the *one* allowed pulse; it lives on the LIVE dot and only during game/match point. Ladder is warning→danger, **no new hue** (blend law). Reduced-motion: chip changes tint, dot solid, no pulse. |
| **3** | **Deuce / cap run** (20-all → 29–29 sudden point) | `min(pts) ≥ 20` and margin < 2 | A persistent **`DEUCE · WIN BY 2`** strip replaces the game label; as the run climbs it appends the target (`… · point 27` near cap) and at 29–29 reads `SUDDEN POINT`. | Persistent, not animated — it's a *state banner*, not a beat. It only ever changes text. Explains *why the game isn't over* to a confused watcher. |
| **4** | **Point streak / momentum swing** | unanswered run reaches a threshold (≥4, then every +2) | The momentum summary line bumps its counter (`6 in a row ▲`) and a **feed row** drops in with a soft slide (`--se-feed-in`, ~180ms). The green run-bars fill. | Feed slide is the shared, gentle entrance for all feed rows — not special-cased. No sound, no flash. Reduced-motion: row appears, no slide. |
| **5** | **Game won** | a game completes | The hero **freezes the final**, a **soft green sweep** crosses the winning column once (`--se-game-sweep`, ~400ms), and a human sentence lands in the feed (`GAME 2 → Meera & Riya · 21–18`). Pips update. | One sweep, once, on game complete only. Not confetti — confetti is reserved for the match (below). Reduced-motion: pips + sentence update instantly, no sweep. |
| **6** | **Comeback** | a game/match won after trailing by ≥6 at any point (`maxDeficit ≥ 6`) | The game-won sentence gains a **`COMEBACK`** tag (mono caps, green) and the share card (§4) auto-captions it (`Down 15–19 · won 22–20`). | A *label*, not a separate animation — piggybacks the game-won beat. Story beat, share-worthy, no extra motion budget. |
| **7** | **Match won** | match completes | The **gold milestone card** + existing confetti (the one gold treatment the whole product reserves for the peak) — plain-language margin (`in 3 games · 21–19 in the decider`), share/scorecard/new-match actions. | Exactly **one gold** in the entire product, exactly here. Confetti is the single exception to "one animation" and only at the terminal moment. Reduced-motion: gold card appears, no confetti fall. |

**Why these seven and not more:** each maps to a real broadcast graphic BWF actually cuts to (game-point/match-point supers, momentum runs, the winner sting) — see `research.md` §5.1 — and each is **free to derive** from the rally log. Shuttle-speed and Hawk-Eye landing-spot stings are broadcast-only (no casual input) and stay out. The discipline mirrors the board's: a moment earns an animation only if it changes how the crowd feels *and* costs zero extra taps.

---

## 3. INTERACTIVE TRACKING INNOVATION — badminton's wagon-wheel

Cricket's differentiator was **free spatial capture**: the run tap already had a screen position, so the wagon-wheel came almost for nothing. Badminton's winner tap carries **no natural placement** (you tap a side-button, not a court location — `scorer.md` §5 is explicit that forcing a placement onto the instant winner tap would wreck the one action that must stay fast). So the design splits, exactly as cricket did between "always-on derived" and "optional on-demand capture":

- **Always-on, zero input:** the **service-court view** (§3.3) — derived, solves the ICP's #1 argument, ships at launch on the Court tab and as a spectator explainer.
- **Optional, on-demand capture:** **winning-shot court-zone placement** (§3.1) — the wagon-wheel parallel, an *opt-in post-point sheet behind a toggle*, off by default, never on the fast path.
- **Optional, one-gesture capture:** **rally-length** (§3.2) — a lightweight shot counter, also opt-in.

### 3.1 Winning-shot court-zone placement (the wagon-wheel analogue) — OPTIONAL, ON-DEMAND

**What it is:** after a rally, if zone-capture is enabled, a HiFi bottom-sheet slides up (the cricket `.sheet` pattern, verbatim structure) asking *where the winning shuttle landed* on a **simplified half-court zone grid**. One tap places it. Aggregated across the match → a **court-zone heatmap of where each player wins and loses points** — the direct casual analogue of Hawk-Eye's landing-spot graphic.

**The capture interaction (how the operator taps it):**

1. **It only appears if turned on.** A setup toggle `Track winning-shot zones` (off by default). When off, the winner tap ends the rally instantly and this sheet never shows — the fast path is untouched.
2. **When on,** the sheet auto-opens *after* the point is already scored (the point is never blocked on it — the score is committed the instant the side-button is tapped; the sheet is pure enrichment layered after, and **Skip** dismisses with no data lost).
3. **One tap on a zone** = placed. The sheet's title states the fact the engine already knows (`Point to Meera · tap where it landed`), so the operator only supplies *location*, never *who won*.
4. **Court-type aware (the ground-type parallel).** Cricket's sheet let you pick the ground shape once at setup (round/oval/box/gully) and reused it. Badminton's court is standardized, so instead of *shape* the setup choice is **which zone model** to capture at, picked once and reused every point:
   - **Simple (default):** a **6-zone grid** — front / mid / rear × left / right — plus two off-court outcomes **`INTO NET`** and **`LONG / WIDE`** (the two ways a rally ends on an error, so you also capture *where points are lost*).
   - **Detailed (opt-in):** the same court split into the real service-court lines (front service line, back doubles line, center line, tramlines) for club scorers who want true landing precision — same geometry, more zones.

**Wireframe — the winning-shot zone sheet (cricket `.sheet` structure, badminton court):**

```
┌──────────────────────────────────────────────┐
│  Where did it land?              Optional      │  sheet-head + "Optional" eyebrow
│  Point to MEERA · tap the court                │  sheet-sub — {winnerName}, engine-supplied
├──────────────────────────────────────────────┤
│   Zone model:  [ Simple ]  Detailed            │  court-type-aware chips (set once, reused)
│                                                │
│   ┌──────────────┬──────────────┐   ← NET      │  the receiver's half-court, split into zones
│   │  REAR-L      │   REAR-R     │              │  (we place where the WINNER's shot landed,
│   ├──────────────┼──────────────┤              │   i.e. in the loser's court)
│   │  MID-L       │   MID-R      │   ●  ← tap    │  ● = just-placed winning shot (green dot)
│   ├──────────────┼──────────────┤              │
│   │  FRONT-L     │   FRONT-R    │              │
│   └──────────────┴──────────────┘              │
│      [ INTO NET ]     [ LONG / WIDE ]          │  error-outcome chips (where points are lost)
│                                                │
│   Serving from RIGHT · Sharma → Riya (diag)    │  derived context echo (helps orient the tap)
├──────────────────────────────────────────────┤
│   [ Skip ]                    [ Save ]         │  Skip = no data, point already counted
└──────────────────────────────────────────────┘
   Zone model is set once at match start. Placement feeds each
   player's win/loss zone map + "where they finish points". Rally
   animation on the live feed comes later.  ← cricket .note voice
```

**How it feeds stats + the live visualisation:**

- **Model field:** reserves `zone` on the rally record (`{winnerId, zone ∈ {frontL…rearR, net, long}}`), exactly as cricket reserved its shot coordinate. Muted/absent when capture is off — the schema is stable whether or not anyone taps.
- **Player/team stats (Stats tab):** *"Meera finishes 61% of her points in the REAR court"*, *"Sharma loses most points INTO NET"*, *"the pair wins the FRONT-R zone 8–2"*. Derived counts, zero cost beyond the optional tap.
- **Live visualisation (Court tab):** a **half-court heatmap** — each of the 6 zones tinted by win-density (green wash scaling with count, cricket's `--wash` treatment), the two error chips shown as red-tinted tallies. Per-player toggle. This is the badminton wagon-wheel: a spatial fingerprint of *where a player kills the rally*.

### 3.2 Rally-length tracking — OPTIONAL, one gesture

Broadcast surfaces "shots in the rally / longest rally" (`research.md` §2.2). Casual capture:

- **When on** (separate toggle, off by default): between the two side-buttons a small **shot-tick** control lets the operator tap once per shuttle contact during a long rally, or — lighter — the winner button reads a **long-press → "long rally"** flag (single bit, no counting) for scorers who won't tick every shot.
- **Model field:** `rallyLength` (int, or the long-rally bit). Absent when off.
- **Feeds:** rally-length **distribution** (Court tab, a thin histogram), **longest rally of the match** (a key-moment beat + share stat), and the genuinely badminton-specific split *"who wins the long rallies (≥15 shots) vs the short ones"* — a fitness/attrition read no casual app has. Never on the scorer's fast path.

### 3.3 Service-court view — ALWAYS ON, zero input (the launch signature)

The one tracking layer that is **derived, requires no capture, and solves the ICP's #1 argument** (who serves, from which box, doubles rotation). Ships at launch as the always-on Court-tab centerpiece and doubles as a spectator explainer:

**Wireframe — service-court view (Court tab):**

```
┌──────────────────────────────────────────────┐
│  ON COURT NOW                     Live         │
│                                                │
│   ┌─────────────────┬─────────────────┐        │  full court, net across the middle
│   │      RIYA       │                 │        │  receiving pair, faint
│   │            ┌────┼────┐            │        │  ▓ = diagonal receiver highlighted
│   │   MEERA▓   │ NET│    │   SHARMA   │        │
│   │            └────┼────┘            │        │
│   │                 │   🏸 A.SHARMA●  │◄RIGHT   │  server: shuttle + name, in the R box
│   └─────────────────┴─────────────────┘        │  (parity-derived: score even → RIGHT)
│                                                │
│   Sharma serves from the RIGHT (score 18, even)│  plain-English derivation, the teaching line
│   → to Riya, diagonally opposite               │
└──────────────────────────────────────────────┘
```

- **Everything is derived:** server = winner of last rally; box = server-score parity (even→R, odd→L); doubles server-of-pair + consecutive-point court-swap + diagonal receiver — the single hardest rule in the sport (`research.md` §1.1), rendered *for* the watcher, animated on serve hand-over (§2 moment 1).
- **Correctness-guaranteed:** the leading app ships a *static* court view; ours is the animated, always-correct version. This is both a scorer aid and the explainer that makes a confused spectator understand badminton's serve rules for free.

### 3.4 Momentum / game-point tension timeline — derived, CSS-only

A per-game **point-by-point timeline** (the momentum worm), score-by-score, with **deuce / game-point / match-point markers** on the exact points where the phase escalated. Entirely derivable from the rally log, CSS-only (no library), lives inside the Momentum `<details>` on Live and full-width on Court. This is where "game-point tension" becomes visible: the worm spikes and the danger markers cluster near 20-all so a watcher *sees* the pressure, not just reads it.

**Launch recommendation (matches `research.md` §5.2):** ship the **service-court view** (always-on signature, zero input) + the **momentum timeline** (CSS-only) at launch; ship **winning-shot zone placement** as the opt-in enrichment (the wagon-wheel parallel) the moment the enrichment toggle lands; **rally-length** deferred behind its own toggle.

---

## 4. Additional features to win schools & universities — ICP-realistic, invented

These are the adoption levers the underserved category lacks. Each is cheap to build on the rally log we already keep, and each targets a real Indian school/college behaviour.

1. **Shareable match-moment cards (the WhatsApp/Instagram wedge).** Every signature beat (§2) — match won, game won, comeback, longest rally, a `MATCH POINT` freeze — auto-generates a **branded square card** (black hero + green accent + mono figures, the exact board aesthetic) with a one-tap **Share ↗**. `Down 15–19 · won 22–20 · Meera & Riya — Sunday Cup SF`. The leading app charges for even a live feed and celebrates *nothing*; a college crowd posts a designed result card for free. This is the single biggest organic-growth lever — the scorecard *is* the ad.

2. **One-link live spectator + reactions (no app install).** The scorer taps **Share live ↗** → a **URL** anyone opens in a browser to watch this exact Live screen (board + serve-strip + momentum + feed), no download. Viewers tap **🔥 / 👏 / 😮** floating reactions and the presence footer shows `👁 128 watching`. Turns one scorer into a crowd; the classic broadcast/parasocial loop cricket's spectator model already proved, ported to a phone-first fest audience.

3. **Zero-setup league / bracket mode (`joincode`).** A PE teacher or fest organizer creates a **tournament** (round-robin or knockout) in three fields (name, format preset, entrants) and gets a **6-char join code**; each completed match auto-feeds the **bracket / standings** with no re-entry. Formats reuse the house-rule presets (flat-to-21, to-15, best-of-3). The gap is real — apps score *matches*, nobody makes running a *college tournament* a two-minute setup. This is the institutional wedge that gets us adopted department-wide, not per-student.

4. **Player milestone & season profiles.** Because every rally is logged, each player accrues a **lightweight profile** — matches, win %, best comeback, longest rally won, deuce-game record, favourite winning zone (from §3.1) — surfaced as a shareable **season card** at a fest's end and a **milestone beat** when it's hit (`50th career point in the rear court`, `first decider win`). Gamifies casual play and gives a college its end-of-season "MVP" data for free.

5. **Doubles rotation trainer (teaching mode).** A toggle that turns the always-on service-court view (§3.3) into a **micro-explainer**: each hand-over briefly annotates *why* (`Sharma serves RIGHT — their score is even`, `same side scored → server swaps courts, keeps serving`). The #1 thing casual doubles players get wrong, taught passively while they watch a real match. Uniquely ours because we already derive the rotation correctly — a feature the category leader can't ship because its engine gets the rule wrong.

**Why these and not gimmicks:** each rides data the scorer already produces at zero extra taps (share cards, profiles, brackets, rotation reasons are all *derived*, matching the whole product's "richness for free from the rally log" thesis), and each maps to a concrete Indian school/college behaviour — posting results, watching a friend's fest match, running an intramural, crowning an MVP, learning doubles. Inventive, but every one is buildable on the existing engine.

---

**Live screen = the board as fixed hero + a plain-English serve/court strip + collapsible momentum + a beats-only feed, across three tabs (Live/Court/Stats). Seven reduced-motion-gated drama beats, one green, one pulse, one gold. The wagon-wheel analogue is winning-shot court-zone placement — optional, on-demand, court-type-aware, off the fast path — backed by an always-on derived service-court view. Adoption comes from shareable moment cards, one-link live spectating, zero-setup brackets, player profiles, and a doubles rotation trainer — all free from the rally log.**
