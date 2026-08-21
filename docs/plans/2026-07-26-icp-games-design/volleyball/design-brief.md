# ScoreEasy — Volleyball bespoke design brief

**Date:** 2026-07-26 · **Status:** DESIGN BRIEF (no code, no mockups yet)
**Market:** Indian college / university / school / open-ground volleyball.
**Design system:** design1-mono (brutalist shell × HiFi-blend). Governance FROZEN:
`src/designs/design1-mono/BLEND-GOVERNANCE.md`. Palette = `--se-*` / `--se-blend-*` tokens only,
never raw hex.
**Method inherited from cricket:** "THE RECORD IS BRUTALIST. THE CONVERSATION IS SOFT" +
detail-by-surface (scorer lean, spectator/scorecard richer). This brief applies that method to
volleyball; it does not re-decide governance.
**Port baseline:** `GenericSetsTournament.jsx` (tournament/match shell) + `MonoLiveGame.jsx`
(the generic +/- point counter that volleyball is scored on TODAY). Baseline audit is in §8.

---

## 0. What "scoring volleyball today" actually is (baseline reality)

`MonoLiveGame.jsx` is a two-participant counter: giant number per side, `+`/`-` by
`pointIncrement`, plus Undo / Pause / Complete. `GenericSetsTournament.jsx` renders match cards
with set-score chips and routes to that counter. **Nothing in the generic path understands
volleyball.** It has no concept of:

- rally-point sets to **25**, win **by 2** (deuce/advantage with no cap, or capped at a house
  ceiling), deciding set to **15**;
- best-of-**5** / best-of-**3** match structure and "sets won" as the real result;
- **serve / side-out** — who is serving, and the fact that in rally scoring the receiving team
  that wins a rally both scores AND gains serve;
- **rotation** (six positions, clockwise shift on side-out);
- **timeouts** (per team per set) and the **side-switch** handoff between sets (and at 8 in the
  deciding set);
- **libero**, substitutions, or any per-player attribution.

So volleyball is a bespoke build, not a skin. But the *scoring primitive* is far simpler than
cricket: **one tap per rally, to exactly one of two teams.** The design job is to make that one
tap un-fumbleable, auto-derive everything else (serve, set-win, deuce, switch), and stay honest
to the mono identity.

---

## 1. Scoring model + India / college nuances

### 1.1 Canonical rally-point model (the default engine)
- **Every rally scores a point** (rally-point / "rally scoring"). Winner of the rally gets +1;
  if they were the **receiving** team, they also **win serve** (a *side-out*) and **rotate**.
- **Set to 25**, must **win by 2**. On 24–24 the set continues until a 2-point lead
  (uncapped by default; see house-rule cap below).
- **Deciding set to 15**, win by 2. Teams **switch ends when one team reaches 8** in the
  deciding set.
- **Match = best-of-5** (first to 3 sets) or **best-of-3** (first to 2). Best-of-3 is the
  common Indian college/tournament default on time-boxed days.
- **Ends switch after every set.** Serve for set 1 is chosen at setup (toss); the team that did
  NOT serve the previous set serves the next.
- **Timeouts:** 2 per team per set (default). Formal FIVB adds two 60s *technical* timeouts at
  8 and 16 — **off by default** for our ICP (see 1.2); expose as a toggle.
- **Rotation & serve order:** six players rotate clockwise on side-out; the person rotating into
  the back-right position serves.

### 1.2 India / college / ground nuances that MUST be first-class (not edge cases)
These are the dominant reality of the ICP and drive the setup presets:

- **Best-of-3 is the everyday default**, not best-of-5. Best-of-5 is finals/formal only.
- **Short house targets.** School / gully / PE-period games routinely play sets to **21**, **15**,
  or even a single **timed** or **first-to-N** set. Setup must let the target be **21 / 25 / 15
  / custom**, per-set and per-deciding-set independently.
- **Deuce cap ("win by 2, but cap at N").** Casual grounds often cap at, e.g., 27 or "next point
  wins after 30–30" to keep the day moving. Provide a **cap toggle** (uncapped default; optional
  hard ceiling).
- **Single-set knockouts.** College fests run one-set-to-25 knockouts to fit many teams in a day.
  Best-of-1 must be a valid, non-buggy format (the generic engine already had a single-set bug —
  see `GenericSetsTournament` repair code lines 28–48; the bespoke engine must handle bo1 cleanly).
- **Libero, rotation faults, substitutions are usually NOT tracked** by casual scorers. Default
  to **off**; a formal-mode toggle turns on serve-order/rotation and libero. Never force a PE
  teacher to assign six positions to start a game.
- **Technical timeouts off by default** — most college/ground matches skip them.
- **Throwball is a different sport** (common in Indian schools, underhand catch-throw). Do NOT
  conflate; if in scope it is a separate preset, out of scope for this brief.
- **Mixed / reduced-side games** (e.g., 4v4, 6v6 on a half-court in PE) — the *scoring* is
  identical; only rotation/positions differ. Formal features stay optional so these Just Work.
- **Names are informal.** Team names are often "A / B", "Red / Blue", hostel/section names, or
  shirt colours — setup must accept two quick labels with zero required roster.

### 1.3 What the engine must derive (single source of truth, cricket-style)
`deriveMatch(sets[], format)` and `deriveSet(rallies, format)` are the sole source for:
serve possession, side-out flag, current server side, set point / match point flags, deuce
state, set winner, sets-won tally, match winner & margin, end-switch prompts. UI never
recomputes; it reads. (Direct parallel to cricket's `deriveInnings`/`deriveChase`.)

---

## 2. Screens needed

### A. Setup / new match — *soft (HiFi conversation)*
Must let a casual scorer start in **under 15 seconds** with sane defaults:
- Two team labels (accept blank → "Team A / Team B"; colour/section names fine).
- **Format preset chips** (grammar-1 selection pills): **Bo3 to 25** (default) · **Bo5 to 25** ·
  **Single set to 25** · **Bo3 to 21** · **Custom**. Custom reveals: sets-to-win, set target,
  deciding-set target, win-by-2 on/off, deuce cap, timeouts-per-set.
- **Formal mode toggle** (default OFF): turns on serve-rotation tracking, libero, and lineup
  entry. OFF = pure two-button scoring.
- **First serve** picker (toss): which side serves set 1.
- Optional venue/court label for the scorecard/share.
- Confirmation-echo card before "Start match →" restating the format in plain English
  ("Best of 3, sets to 25, win by 2. Team A serves first.").

### B. Scorer — *hybrid: hard record, soft controls* (the primary surface; keep LEAN)
The operating console. Detail budget is deliberately thin (see §3). Must:
- Pin a **score hero** (per-set points + sets-won + server indicator) that never leaves screen.
- Present the **two dominant point buttons** (point-to-left / point-to-right) as the biggest,
  lowest, most-thumb-reachable targets.
- Auto-advance set / prompt end-switch / prompt deciding-set-8 switch **inline** (full-screen
  handoff, no modal), and auto-flag set point / match point / deuce.
- Keep **Undo** permanently visible; **Timeout** one tap; secondary actions (edit, sub,
  end-set-early) one tier down.
- In **formal mode** only: show rotation/serve-order strip and libero swap affordance.

### C. Live / spectator — *soft (the broadcast)* (richer detail)
Lean-back, shareable, operates nothing. Must show: live set score + sets-won, server side with
live pulse, set-point/match-point banner, per-set breakdown strip (25–23, 22–25 …), momentum /
point-run indicator, "on serve" streak, viewer/reactions (reuse cricket's presence pattern).

### D. Scorecard / match summary — *hybrid: brutalist grid, soft container* (richer detail)
The record you trust and share. Must show: final result + margin in plain language
("Team A won 3–1"), **set-by-set grid** (mono, columnised), longest point-run per set, timeouts
used, and — in formal mode — per-player service points / rotation. Ends with share + rematch.

### E. Handoff screens (between-set / deciding-set) — *soft*
Mandatory every match (the volleyball analogue of cricket's innings break): **end-switch**
("Sets 1–1 · switch ends · Team B serves next set →") and **deciding-set-8 switch**. Absent in
the generic engine; must be a designed step, not an afterthought.

---

## 3. Scorer interaction design (operator-lean, thumb-zone)

**Governing idea:** volleyball scoring is *one tap per rally to one of two teams*. Optimise the
whole surface around making that tap the fastest, safest, lowest thing on screen — the cricket
keypad lesson ("most-tapped at the bottom, borderless, thumb-reachable") applied to a 2-target
game.

- **Two full-width (or split 50/50) point buttons pinned to the bottom third**, each min-height
  `clamp(64px, 13vh, 84px)` — the thumb zone. Left button scores the left team, right the right
  team, spatially matching the hero above. Mono team initial + big `+` affordance; on tap the
  matching hero number runs the existing **score-pop** animation.
- **Weight ladder descending with frequency:** point buttons (primary) → Undo + Timeout row
  (always visible, one tier down: Undo = `--se-color-surface-warm` square, no drama; Timeout =
  ghost chip) → MORE (edit last rally, substitution, end set early, correct server) buried behind
  one affordance. Extras/rare actions must LOOK one tier down (cricket rubric class 3).
- **Serve is derived, not entered.** A serve indicator (▸ on the serving side of the hero) flips
  automatically on side-out. The scorer never taps "who served" — the engine knows. A one-tap
  **"fix serve"** correction lives in MORE for the rare mis-set.
- **Set completion is automatic and interruptive-inline:** at 25 (or target) with a 2-point
  lead the engine closes the set and pushes the **end-switch handoff** full-screen (canvas →
  `--se-color-surface-warm`), restating score + who serves next, single primary CTA. No modal,
  hero stays pinned.
- **Deuce is a state on the escalation ladder, not a new colour:** at 24–24 (or target−1 each)
  the target/lead line escalates to `--se-color-warning-soft` + `--se-color-warning`
  ("Deuce · win by 2"). **Set point / match point** escalate the same way (warning → the point
  that wins) so the scorer feels the pressure without decoration.
- **Undo is LIFO and cheap** (mirror cricket): one tap reverses the last rally *and* the serve/
  rotation/set-close it caused. Permanently visible, never buried.
- **`:active` press physics** (translate 1–2px, collapse shadow, `--se-motion-standard`) is the
  only motion the controls get.
- **Formal mode adds, never blocks:** a thin rotation/serve-order rail and libero swap appear
  only when formal mode is on; default casual mode is pure two-button.

**Volleyball-specific primary actions (ranked):** ① Point → Team L / Point → Team R · ② Undo ·
③ Timeout (L / R) · ④ [auto] confirm end-switch / deciding-8 switch · ⑤ MORE: sub · fix serve ·
edit last rally · end set early. Everything below ③ is a minority action and must read as such.

---

## 4. Live / spectator design (richer, signature moments)

Soft broadcast (rubric class 9 — keep only the outer hard shell; interiors are hairlines + soft
cards). Volleyball's spectator drama lives in **runs and set swings**, so surface:

- **Hero:** big current-set score + sets-won capsule, server side with the **one live pulse**,
  `--se-blend-green-wash` on the leading side. Set-point/match-point takes the drama via the
  escalation ladder (may claim the screen's single inversion at match point).
- **Set-by-set strip:** read-only mono chips (grammar-3), one per completed set (`25–23`,
  `23–25`), current set live. Doubles as match-shape at a glance — the volleyball analogue of
  cricket's over strip.
- **Momentum / point-run band:** CSS-only bars (no library, no axes) showing the current
  point-run ("Team A · 6 straight") and per-set swing. This is the signature spectator read for
  volleyball — momentum is the sport's whole feel.
- **Signature moments (see §7):** set-won card, match-won result peak, long point-run flare.
- **Presence & reactions** first-class (reuse cricket): viewer count in chrome, capsule reaction
  pills, Following pill.

## 5. Blend direction (brutalist identity × HiFi warmth, THIS game)

No new colours. Keep the minimal-brutalist palette + green accent; use only `--se-*` /
`--se-blend-*`. Per-screen hardness budget from the rubric is law (1 hard shell shadow, 1 ink
frame, ≤3 soft surfaces, ≤1 gold, ≤1 glow, ≤1 inversion, ≤1 live pulse).

- **Hard (the record):** outer shell (`--se-border-standard` + `--se-shadow-hard`); **mono
  tabular numerals** for every quantity (points, set scores, sets-won, point-runs); the
  **set-by-set strip chips** (grammar-3, semantic fill, this is volleyball's over-strip); hard
  status stamps ("SET" / "MATCH POINT" as squarer read-only badges, grammar-2); uppercase-mono
  label voice ≤3 words (SERVE, SET 3, DEUCE, LIVE); the server-side indicator.
- **Soft (the conversation):** setup, end-switch handoffs, timeout confirmation, all help/empty/
  error copy (sentence-case sans ≥11.5px in dashed warm containers); the two point buttons
  (borderless, thumb-ergonomic, hard skeleton mono initial under soft skin); the primary CTA
  (one glow, `--se-blend-shadow-cta`, names the outcome — "Start set 2 →", not "Next").
- **Hero = hybrid:** mono numerals (big, light weight ~500) inside a `--se-blend-green-wash`
  soft-radius container with NO hard border of its own (the shell already carries the one hard
  frame — repeating it is the named "triple-frame" violation).
- **Escalation ladder is the ONLY state encoding:** neutral → deuce/set-point
  (`--se-color-warning-soft`/`warning`) → match point (danger-soft/danger or the single
  inversion). Never a new hue, glow, or text-shadow for state.
- **Green = lead/live only** (governance rule 1): the leading team's hero wash and the live dot.
  Never green behind a neutral or losing side.
- **Gold = one per screen**, reserved for the match-won milestone card (§7).

## 6. Data touchpoints + stats worth capturing

**Casual mode (default, zero roster) — derive from rallies, no player input:**
- Per set: final score, point-runs (longest streak each team), lead changes, ties, timeouts used,
  duration; set point / match point reached.
- Per match: sets won, set scores, margin, total points, longest run of match, comeback flag
  (won a set after trailing by ≥N), "went to deciding set".
- Serve-derived (free, since serve is tracked): **side-outs won**, service-point streaks per
  team (points scored while serving) — a genuinely volleyball stat with no extra taps.

**Formal mode (opt-in roster):**
- Per player: service points (aces if an "ace" quick-tag is added), rotation position, subs
  in/out, libero in/out. Aces/blocks/kills attribution = **future** (needs per-rally outcome
  tagging → costs taps; keep out of the default lean scorer).

All stats are **read-only derivations** from the rally log; the rally log + format is the only
persisted truth (undo/edit-past replay-forward like cricket).

## 7. Animations / signature moments

Reduced-motion gated; one live pulse; press physics on controls. Ranked, heavy ones future-flagged:

- **Score-pop** on every point — reuse the existing `mono-score` pop. (Ship.)
- **Set-won card** — soft card, human sentence in sans ("Team A takes set 2, 25–22") + mono
  figures line; slots into the end-switch handoff. (Ship.)
- **Point-run flare** — subtle escalation when a team hits a run threshold (e.g., 5 straight);
  ladder tint, no new colour. (Ship, light.)
- **Deuce / set-point / match-point** — ladder escalation on the target line, live pulse retained
  for match point. (Ship.)
- **Match-won result peak** — the **one gold milestone card** (2px `--se-blend-gold` + `3px 3px 0`
  ink shadow, soft gold interior), eyebrow + sans headline + mono set line + margin in plain
  language + share/rematch CTAs. (Ship — reuse `MonoMatchResult`.)
- **Momentum band animation / swing worm** — richer motion viz. (**FUTURE-FLAG** — heavier,
  gate behind spectator polish wave, like cricket's C11.)

## 8. Port-vs-redesign (reuse vs bespoke)

**Reuse (port from generic / cricket primitives):**
- `GenericSetsTournament.jsx` shell — tournament list, match cards, standings, knockout wiring,
  routing to the scorer. Keep; the set-score card chips already exist (just feed the bespoke
  engine). Fix the single-set format handling cleanly in the new engine (baseline had a repair
  hack at lines 28–48).
- `MonoLiveGame.jsx` scaffolding — hero + button + undo/pause/complete layout, `mono-score`
  animation, back/complete flow. **Reuse the skeleton, replace the brain.**
- Shared primitives: `MonoSheet`, `MonoMatchResult`, blend tokens (frozen), Convex live-sync,
  `ShareLiveMatch`, scorecard grid components.

**Build bespoke (the generic scorer lacks all of this):**
- **Volleyball engine** — `deriveSet` / `deriveMatch`: rally-point, win-by-2 + deuce cap,
  set/deciding-set targets, best-of-N, serve/side-out derivation, end-switch + deciding-8 switch,
  rotation (formal), timeouts, LIFO undo + edit-past replay-forward, single-set format.
- **Two-button thumb-zone scorer** with derived serve indicator + inline handoff screens
  (replaces the raw `+/-` counter).
- **Setup with format presets + formal-mode toggle** (the generic path has no format concept
  beyond `format.sets`).
- **Volleyball spectator** (set strip + momentum band) and **volleyball scorecard** (set-by-set
  grid + service-run stats).
- **Blend tokens for volleyball** — verify the frozen `--se-blend-*` set covers this game;
  reuse cricket's, do not invent (cricket's C2 already froze them).

## 9. Open questions / product decisions

1. **Default match format** — confirm **Bo3-to-25** as the ship default for the Indian college ICP
   (vs Bo5). Leaning Bo3.
2. **Deuce cap default** — uncapped (true FIVB) vs a house ceiling on by default for time-boxed
   grounds? Leaning uncapped default + optional cap toggle.
3. **Formal-mode scope for pilot** — do we ship rotation/serve-order + libero at launch, or
   casual-only first with formal behind a flag? (Rotation faults, positions, libero add setup
   friction the ICP mostly won't use.)
4. **Serve tracking depth** — auto-derive serve possession only (free), or also enforce
   **rotation/serve-order** (needs a lineup)? Casual default = possession only.
5. **Per-player attribution / aces / blocks / kills** — out of the default lean scorer (costs
   taps). Confirm deferred to a formal/stats wave.
6. **Timeout model** — 2 per set default; expose technical timeouts (8/16) as a toggle, off by
   default? Confirm.
7. **Single-set & non-standard targets** — confirm bo1-to-25 knockouts and to-21 / to-15 house
   targets are first-class setup presets (not "custom-only").
8. **Side-switch UX** — always force the end-switch handoff screen, or make it skippable/auto for
   fast casual games (a PE teacher may not physically switch ends)?
9. **Offline multi-device conflict policy** — same open question cricket carries; single
   authoritative scorer device vs op-log merge for concurrent edits.
10. **Throwball** — in or out of scope as a separate preset? (Common in Indian schools; distinct
    sport — recommend out of scope here.)
