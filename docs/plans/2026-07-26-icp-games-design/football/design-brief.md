# ScoreEasy — Football: BESPOKE Design Brief

**Date:** 2026-07-26 · **Status:** DESIGN BRIEF (no code, no mockups yet) · **Game:** Football (Association) — Indian college / university / turf-ground market.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN).
**Method:** Follows the cricket exemplar — one shared engine underneath, every surface a presentation over it; blend rubric *"the record is brutalist; the conversation is soft"*; detail-by-surface (scorer lean, spectator/scorecard richer).

**Where football starts today (the gap):** the generic goals path (`GenericGoalsTournament.jsx`) stores only team-level `score1`/`score2` + winner/draw and derives standings from `goalsFor`/`goalsAgainst`/`goalDiff`/`points`. `MonoLiveGame.jsx` is a plain +/- counter with a wall-clock timer, undo and complete. **Neither knows what football is:** no goal-scorer attribution, no assists, no cards, no substitutions, no halves/stoppage clock, no per-player stats. Football's whole record — *who scored, who assisted, who got booked, who came on* — is invisible. This brief specifies the bespoke experience that captures it.

---

## 1. Scoring model + India / college nuances

### Core events (what a football scorer actually records)
- **Goal** — the atomic scoring event. Must capture: `team`, `scorer` (player), optional `assist` (player), `minute` (match clock + stoppage), and `type` (open-play / penalty / free-kick / own-goal / header — type is optional enrichment, minute+scorer are the record). **Own-goal credits the opponent's team total but is attributed to the conceding player** — the single most-fumbled rule for casual scorers; the model must make it structurally distinct from a normal goal (never let an own-goal add to the scorer's personal tally).
- **Card** — `yellow` / `red`. Two yellows = one automatic red → player is off, team plays short. Straight red also = off + short. Model must track *cards per player* and derive *second-yellow → red* automatically (the casual-scorer trap: logging a 2nd yellow as "just another booking" instead of a send-off).
- **Substitution** — `playerOff` → `playerOn`, `minute`. Feeds minutes-played and "who's on the pitch" (which in turn gates who can score/be carded). College games frequently use **rolling / unlimited subs** — the model must not hard-cap sub count.
- **Match clock** — two halves + half-time; **stoppage/injury time added per half** (referee's discretion, typed by the scorer). Optional **extra time** (2× shorter halves) and **penalty shootout** for knockouts.

### India / college / turf nuances (the ICP variants that must be first-class, not edge cases)
- **5-a-side & 7-a-side turf formats dominate** casual play. Shorter halves (often 2×15, 2×20, or a single running clock), smaller squads, **rolling subs**, frequently **no offside**, sometimes **no cards / cards-as-social-only**, and often **size-2 goals with no goalkeeper rush rules**. Setup must let the scorer pick format and have sensible defaults ripple through (clock length, squad size, whether cards even appear).
- **Golden-goal / next-goal-wins** deciders on turf (time/slot-limited bookings) instead of full extra time.
- **Draws are normal and common** in league/group play (unlike cricket) — the model already supports draw; the *scorer and spectator* must treat a draw as a first-class result, not a missing winner.
- **Loosely-managed rosters:** college teams show up with a WhatsApp list, jersey numbers improvised, a "+1 guest" mid-tournament. Scoring must tolerate **quick-add player by number/name** mid-match and **"Unknown #7" scorer attribution** without blocking the goal.
- **One scorer, one phone, pitch-side, sun glare, no tripod** — the operator is a student volunteer or a friend, not a trained statistician. Every interaction is one-handed and glanceable.
- **Shootout scoring** for knockouts: alternating takes, scored/missed per kick, sudden-death after 5 — must be its own mini-surface, not shoe-horned into the goal keypad.

**Anti-goal:** treating a football match as "a number that goes up per team." The team score is a *derived total of attributed goal events*, never the primary input. If the scorer can raise the score without saying who scored, we've rebuilt the generic counter.

---

## 2. Screens needed

Four surfaces, mirroring cricket. Each is a presentation over one shared match engine.

### A. Setup
- Pick **format** (11 / 7 / 5-a-side) → drives defaults: **half length, number of halves, squad size, rolling-subs on/off, cards on/off, offside flag (display-only), extra-time/shootout availability**.
- Two teams: name, optional crest/initial, **roster entry** (name + optional jersey number; roster is *optional* — a match can start with empty rosters and quick-add players as goals/cards happen).
- Kickoff details: **who kicks off**, half length confirmation, venue/ground name (optional).
- House-rule toggles surfaced as **plain-language switches**, not jargon: "Rolling subs", "Show cards", "Track assists", "Stoppage time".
- Must be skippable-to-scoring in under ~30s for a casual pickup game (name teams → go), while supporting a fuller tournament setup.

### B. Scorer (operator console) — the primary build
- Persistent **hero**: `TEAM A  n – n  TEAM B` in mono, **live match clock + half indicator** (`H1 · 43:12`, `HT`, `H2 · 90+2`), stoppage badge.
- Primary actions ranked by frequency (see §3): **GOAL (per side)** → then scorer/assist attribution → CARD, SUB, clock controls.
- **Event timeline / "this half" strip** — the football analogue of the over-strip: goals ⚽, cards 🟨🟥, subs ⇄ laid on a minute axis, always visible, doubles as the record and as undo-context.
- **Undo** permanently visible. **Clock control** (start / pause / half-time / stoppage +).
- Lean by design: the scorer shows *only* what's needed to log the next event fast; rich stats live on spectator/scorecard.

### C. Live / Spectator (lean-back, shareable)
- Big score + live clock with breathing pulse; scorers & assists listed under each goal; cards and subs on a timeline; short-side indicator ("Team B ⑩ — down to 10 since 67'").
- Momentum / event feed, viewer presence + reactions (per rubric class 9). Read-only.

### D. Scorecard / match summary (the record, richer)
- Final score + result line in plain language ("Engineering FC won 3–1", "Draw 2–2", "Won 4–3 on penalties").
- **Goals list** (minute · scorer · assist · type), **cards list**, **subs list**, per-player **goals/assists/cards/minutes**, team totals. Man-of-the-match slot (optional). Shootout breakdown if applicable.
- Drill-in from spectator; the shareable artifact.

---

## 3. Scorer interaction design (operator-lean, thumb-zone)

**Principle:** most-tapped lives at the bottom, in the thumb arc; the hero and timeline sit up top where eyes read but thumbs don't reach. One-handed, sunlight-legible, deterministic (no gesture that can fabricate a goal — cricket's disqualifier applies here too).

### Frequency ladder (what descends toward the thumb)
1. **GOAL — Team A / GOAL — Team B** — the two largest, lowest, most-reachable keys. Tapping GOAL does **not** silently increment; it opens a fast **inline attribution step** (pinned hero stays): *who scored?* → roster chips (capsule, grammar-1) + a persistent **"Unknown / #__"** chip so attribution never blocks the log → optional *assist?* → optional *type* (open-play default). Confirm echoes: "**Goal — Ravi (unassisted), 43'** → Engineering 2". Common case = 2–3 taps; a rushed scorer can tap GOAL → Unknown → confirm in 2.
2. **Clock row** — start/pause, **Half-time**, **+ stoppage** — high frequency around the breaks, one tier up from goals.
3. **CARD** — yellow/red, then player chip. Engine auto-derives 2nd-yellow → red and flips the team to short-handed (banner echo: "**Ravi — 2nd yellow → sent off.** Engineering down to 10.").
4. **SUB** — playerOff (from on-pitch list) → playerOn (from bench / quick-add). Ghost-tier weight; qualifies the match, doesn't score it.
5. **Undo** — permanent square beside the primary, never buried (LIFO over the event log).
6. **MORE** quick-actions (lower frequency, tucked): own-goal, penalty-goal shortcut, injury/dead-time, edit-past-event, end-half / end-match, start shootout.

### Football-specific primary actions (the bespoke verbs the generic scorer lacks)
- **GOAL + attribution** (scorer / assist / minute / type) — the core net-new flow.
- **OWN-GOAL** — routed through MORE or a long-press on GOAL; **structurally separate** so it credits the opponent total but the conceding player's record, never the scorer tally. Confirm echo spells it out in plain English.
- **CARD → auto send-off derivation** — 2nd yellow and straight red both flip team to short; short-side state is shown on hero + spectator.
- **SUB with rolling-subs awareness** — on-pitch vs bench lists; minutes accrue.
- **Half / stoppage / extra-time / shootout** clock lifecycle — absent entirely today.

**Hard-skeleton / soft-skin (tie-breaker rule):** keys are borderless with hairline dividers, mono numerals, ergonomic ≥58px targets; the *grid and figures* are brutalist, the *touch surface and copy* are soft. GOAL keys get the one tinted promotion (`--se-color-action-soft` fill); RED card is outline-danger at rest, solid only when confirmed (never a resting red slab = "delete"). Press physics (`:active` translate + collapse to `--se-shadow-card`) is the only motion controls get.

---

## 4. Live / spectator design (richer detail, signature moments)

- **Hero:** `--se-blend-green-wash` behind the *leading* side only (green = lead/live, governance rule 1); level match = neutral surface. Big mono score, live clock, `.se-blend-pulse` on the LIVE dot only (reduced-motion gated). Short-handed team wears a small `⑩` + minute rider.
- **Event timeline as the spectator centrepiece:** vertical minute-ordered feed — goals (scorer • assist, ⚽), cards (🟨/🟥 + player), subs (⇄). Notable events are white soft-radius cards with a grammar-3 outcome chip; ordinary ticks are bare rows (signal by elevation, not zebra — rubric class 7).
- **Signature moments** (see §7): a goal is the emotional peak football is built around — it earns the biggest reaction; a red card and a late winner are secondary peaks.
- **Presence & reactions** first-class (viewer count in chrome, capsule reaction pills with mono counts, Following pill) — college crowds screenshot and share.
- **Tabs:** LIVE / SCORECARD / INFO (teams, venue, format, house-rules) — capsule segmented control, one language.
- Soft-budget enforced: ≈3 soft surfaces + ≤1 gold (final-whistle result) + 1 live pulse.

---

## 5. Blend direction (brutalist identity + HiFi warmth for THIS game)

**No new colours. Reuse the existing `--se-*` / `--se-blend-*` tokens only** — the minimal-brutalist palette + the single green accent (`--se-color-action` = primary; soft `--se-color-action-soft`). Football maps cleanly onto the frozen system:

- **The record is brutalist:** the score numerals (mono tabular), the match clock, the minute axis on the timeline, the goal/card/sub chips, per-player figures in the scorecard — hard, precise, non-jittering. The clock is football's over-count; it gets mono discipline.
- **The conversation is soft:** goal attribution flow, card/sub pickers, house-rule setup, confirmation echoes, empty/help copy, celebration — sentence-case sans, soft radius, tinted inline banners, canvas shift to `--se-color-surface-warm` on decision screens, no modals/scrims (the hero never leaves).
- **Green (`--se-color-action`) = lead / live / primary action only.** Behind the leading team's hero, on the live badge, on the GOAL primary. Never a resting fill, never "team colour."
- **Cards use the escalation ladder, not new hues:** yellow card → `--se-color-warning` / `--se-color-warning-soft`; red card / send-off → `--se-color-danger` / `--se-color-danger-soft`. This is exactly the neutral→attention→critical ladder the rubric already defines — football's cards *are* that ladder, which is a gift: no palette extension needed.
- **Gold = ONE moment:** the final-whistle result / player-of-the-match card (2px `--se-blend-gold` border + `3px 3px 0` ink shadow anchor, soft gold interior). One per screen.
- **Per-screen hardness budget** unchanged: one hard shell border + one offset shadow on the outermost frame; borderless soft keys inside; ≤3 soft surfaces; ≤1 glow (GOAL/primary CTA); ≤1 inversion; ≤1 live pulse.
- **Team crests:** initial squircles on the team accent (reuse cricket's crest treatment; crest-vs-initial is an open decision inherited from cricket Wave-0).

**Player names: sans, sentence case, ≥12px — never uppercase a human.** (Rubric law; football surfaces are name-dense, so this matters more here than in cricket.)

---

## 6. Data touchpoints + stats worth capturing

**Per goal event:** team, scorer, assist, minute (+stoppage), type (open/pen/FK/header/own-goal), on-pitch context.
**Per card:** player, team, colour, minute, derived send-off flag.
**Per sub:** playerOff, playerOn, minute.
**Per player (derived):** goals, assists, yellows, reds, minutes played (from subs + send-offs), appearances. Brace/hat-trick derivation for signature moments.
**Per team (derived):** goals for/against, goal difference, points, clean sheet (0 conceded), cards tally, result (W/D/L), shootout record.
**Match-level:** result + margin, penalty-shootout line, half-time score, man-of-the-match (optional), format/house-rules snapshot for the INFO tab.
**Tournament roll-ups (feeds existing `calculateGoalsStandings`):** GF/GA/GD/Pts already exist — bespoke adds a **top-scorers / most-assists / cards table** the generic standings can't produce. **Golden Boot** across a tournament is a high-value, low-cost derived leaderboard the ICP will love.

---

## 7. Animations / signature moments (future-flagged if heavy)

- **Goal pop** — the primary peak. Score numeral pop (reuse cricket's score-pop) + a brief scorer-name flourish on spectator. Reduced-motion gated. *(Ship basic; tiered "screamer" variants future-flagged.)*
- **Red card / send-off takeover** — a restrained danger-tinted banner + short-side hero update; the secondary peak. Never a full-bleed red slab.
- **Hat-trick / brace** — gold milestone card (one-gold-per-screen enforced), human sentence in sans ("Ravi with the hat-trick — 3 in 27 minutes."), figures line in mono.
- **Final whistle / result** — designed peak: eyebrow, sans headline, plain-language margin ("won 3–1", "drew 2–2", "won 4–3 on pens"), both teams mono with loser at reduced opacity, MOTM card, 3-up stat tiles, paired Share / Rematch CTAs.
- **Shootout** — per-kick reveal (scored/missed), sudden-death tension. *(Future-flag the animated reveal; ship a functional grid first.)*
- **Clock/stoppage** — subtle; the pulse stays reserved for genuine live only.

All motion `--se-motion-standard` + reduced-motion gated; nothing decorative moves (rubric law).

---

## 8. Port-vs-redesign

**Reuse / port (don't rebuild):**
- **Blend tokens + governance** (frozen) — verbatim.
- **Tournament shell** from `GenericGoalsTournament.jsx`: standings table, knockout bracket, match-progress segments, `calculateGoalsStandings` (GF/GA/GD/Pts), `KnockoutMatchCard`, knockout manager, score-clear flow — the *tournament orchestration* is sound; keep it and feed it richer match data.
- **Shared primitives from cricket:** `MonoSheet`, hero pattern, segmented tabs, event-strip grammar, match-result trio (`MonoMatchResult` / `Scorecard` / `Share`), Convex live-sync, crest treatment, setup-screen skeleton.
- **Clock/timer plumbing** from `useTimer` / `MonoLiveGame` as a *starting point* for the match clock (but football needs halves + stoppage + a match-minute model the generic wall-clock lacks).

**Build bespoke (the generic path cannot express these):**
- **Football match engine** — event-sourced: goals-with-attribution, cards-with-send-off-derivation, subs-with-minutes, halves + stoppage + ET + shootout clock lifecycle, own-goal semantics, per-player/per-team derivations. This is the football analogue of cricket's C1 engine and the core net-new work. The team score is a *derived total*, never a stored input.
- **Bespoke scorer console** — GOAL-attribution flow, card/sub pickers, clock controls, event timeline, quick-add player. Replaces the +/- counter entirely.
- **Bespoke spectator LIVE + scorecard** — event timeline, scorers/assists/cards/subs, short-side state, top-scorers leaderboard.
- **Format presets** (11/7/5-a-side) driving defaults.

**Rule of thumb:** reuse everything *around* the match (tournament, standings, shell, tokens, share); rebuild everything *inside* the match (the engine + the three match surfaces). Same split cricket made.

---

## 9. Open questions / product decisions

1. **Attribution friction floor** — is scorer attribution mandatory or skippable-by-default? (Leaning: always offer instant "Unknown" so a goal is never blocked, but nudge toward naming. Confirm the default.)
2. **Assists & cards ON by default, or opt-in per format?** (5-a-side turf often ignores both — should the preset hide them entirely, matching cricket's "default mode per preset" question?)
3. **Match-minute source of truth** — real running clock, or manual scorer-typed minute per event? (Turf games rarely run a precise clock; a hybrid "clock runs but scorer can override the minute" may be needed. Blocks the engine clock model.)
4. **Rolling-subs & squad-size caps** — enforce format limits or leave fully open for casual play? (Affects the sub picker + on-pitch validation.)
5. **Shootout scope for pilot** — ship penalty-shootout scoring at launch or defer? (Knockout tournaments need it; a golden-goal fallback may cover early pilots.)
6. **Offside / GK rules** — display-only flags or fully ignored? (Recommend display-only/out-of-scope, like cricket's fielder-restriction.)
7. **Own-goal UI placement** — long-press GOAL vs a MORE action? (Discoverability vs mis-tap risk — needs a mockup A/B.)
8. **Man-of-the-match** — manual scorer pick, derived heuristic, or omit for pilot?
9. **Offline multi-device conflict policy** — inherited from cricket Wave-0; a single football match rarely has two scorers, but tournament-level concurrent scoring does. Reuse cricket's resolution.
10. **Crests vs initials in header** — inherit cricket's Wave-0 decision.
