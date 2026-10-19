# Throwball — Bespoke Design Brief

**Status:** Design brief only. No code, no mockups yet.
**Author:** Senior product design (ScoreEasy per-game bespoke track).
**Inherits:** `docs/plans/2026-07-20-icp-games/cricket/blend-rubric.md` (FROZEN blend law) + `src/designs/design1-mono/BLEND-GOVERNANCE.md`. Cricket is the exemplar; Throwball inherits every rubric rule and only diverges where the game demands it.
**ICP:** Indian college / university / school / grounds market. **Women's staple.** The dominant scorer is a **casual student volunteer or a PT teacher on a phone at courtside** — not a certified official. Every decision below optimises for *that* person mis-scoring being nearly impossible, not for a referee's completeness.

**Governing principle (inherited):** *The record is brutalist. The conversation is soft.* Numerals, set boxes, serve marker, status stamps stay hard mono. Decisions, guidance, celebration go soft. Detail-by-surface: **scorer lean, spectator + scorecard richer.**

---

## 1. Scoring model + India / college nuances

**Core game shape (what the engine must model — NOT in today's generic scorer):**

- **Set-based, rally-point.** A point is scored on *every* rally (whoever wins the rally gets the point, serve or not) — identical rally-point logic to volleyball. This is the single most important model fact.
- **Set target:** **15 points** is the Indian college/school default; **25** is used in some senior/federation play. **Win by 2**, with an optional **cap** (e.g. hard cap at 17 for a 15-set, 27 for a 25-set) that many local tournaments impose to keep matches moving. Deuce continues until a 2-point lead or the cap.
- **Match format:** **Best of 3 sets** is the overwhelming default (first to 2 sets). Best of 5 exists in senior play. A **deciding set** (3rd set) is frequently played to a **shorter target (11)** in local rulebooks — this MUST be a configurable per-set target, not a global one.
- **Serve:** overhand *throw* serve from behind the baseline. Rally-point means serve passes to the rally winner (side-out gives serve **and** a point). The scorer cares about serve only as a **possession/whose-serve indicator**, not as a separate scoring event.
- **Catch-and-throw, no volley:** one player catches the ball cleanly (two hands) and throws it back over the net. The ball is never volleyed/juggled. This changes *what a fault is* but for scoring it collapses to **"which side won the rally."** The app does not need to adjudicate technique — it needs to record the point and, optionally, *why* (fault type) for richer stats.
- **Rotation:** the receiving side rotates clockwise when it wins service (volleyball-style). Casual scorers **do not track rotation**; federation scorers might. Rotation is an **opt-in**, never a blocker.
- **Players:** **7-a-side** is the TFI standard; **9-a-side** appears in some school circuits. Squad up to 12 with substitutions. Player count must be configurable.
- **Timeouts:** typically 2 per team per set (30s); plus a technical/interval break. Casual scorers ignore these; make them a light optional counter.

**Common local variants the setup MUST accommodate (as presets/toggles):**

| Variant | Range seen in ICP | Default |
|---|---|---|
| Set target | 15 / 21 / 25 | **15** |
| Deciding-set target | same / 11 | **11** (toggle: "short decider") |
| Sets to win match | best-of-3 / best-of-5 | **best-of-3** |
| Win-by-2 + cap | on / off, cap value | **on, cap 17** |
| Players per side | 7 / 9 | **7** |
| Rotation tracking | on / off | **off** |
| Timeout tracking | on / off | **off** |

**Fault vocabulary (for optional "how was the point won" enrichment, plain-English, NOT required to score):** catch fault (dropped / one-handed / body), holding too long, foot / line fault, throw into net, out of bounds, over-the-net reach, double touch. In Guided mode these are *reasons*; in the fast lane they never appear — a point is one tap.

---

## 2. Screens needed

Four surfaces, mirroring the cricket set (setup / scorer / live-spectator / scorecard). Volleyball-adjacent layout: two teams, a net between, set boxes across the top.

**A. Setup / Match Config**
- Team A / Team B names (+ optional crest initial, per Wave-0 crest decision inherited from cricket).
- Preset picker first: **College (15, bo3, short decider, cap 17)** · **School (15, bo3)** · **Federation (25, bo5)** · **Custom**. Presets set every value below in one tap — this is the casual-scorer fast path.
- House-rule toggles (progressive-disclosure "More options"): set target, deciding-set target, sets-to-win, win-by-2 + cap, players/side, rotation on/off, timeout tracking on/off.
- Optional rosters per team (names). Skippable — casual games score by team only.
- Who serves first (coin-toss result) — a single A/B tap, defaultable.
- CTA names the outcome: "Start match → Set 1 to 15".

**B. Scorer (operator-lean — the workhorse)**
- Must own: current set score (big), set-box strip (sets won + prior set scores), whose serve, point to each side, undo, set/match completion detection, deciding-set handling.
- Two large point targets (one per team) as the primary action; everything else demoted.
- Auto-detects set point / match point and set completion (win-by-2 + cap aware) — the generic scorer does none of this.
- Serve indicator toggles automatically on side-out; manual override available.

**C. Live / Spectator (lean-back, richer)**
- Read-only hero, set-box strip, whose serve, set-point / match-point flag, momentum (point run), per-set breakdown, optional reactions + viewer presence. No controls.

**D. Scorecard / Result**
- Set-by-set table (A vs B per set), match result line in plain language ("Blue House win 2–1 · 15–12, 9–15, 11–8"), optional per-player stat table if rosters + enrichment were captured, share card.

---

## 3. Scorer interaction design (operator-lean)

**North star:** a student can score a whole match one-thumbed, standing at the sideline, without a rulebook, and cannot accidentally break the score. Detail stays LEAN here (rubric §detail-by-surface).

**Layout, top → bottom (heaviest-used lowest, in the thumb zone):**
1. **Header (chrome, brutalist):** back · centred two-line title · persistent mono context subtitle ("SET 3 · 11–8 · MATCH POINT B"). Live dot + LIVE when subscribed.
2. **Set-box strip (brutalist record):** one box per set, mono, showing completed set scores and the live set highlighted — the volleyball "set boxes across the top" convention. Reuses cricket over-strip chip grammar (grammar-3 record chips): completed sets filled semantic, current set outlined, unplayed sets dashed empty slots. This is the scorebook row and doubles as match progress.
3. **Score hero (hybrid):** two team columns, giant mono tabular numerals (`--se-color-ink-strong`), team name sentence-case sans above. Green-wash container (`--se-blend-green-wash`), soft radius, NO hard border of its own (shell already hard). Serve marker = a small hard dot/triangle beside the serving team's score. Set-point / match-point escalates via the ladder (warning-soft → danger-soft), never a new colour.
4. **PRIMARY ACTIONS (thumb zone, bottom):** **two big "＋ Point" targets**, one per team, full-width split, min-height `clamp(58px, 11vh, 74px)`, borderless (hairline divider between), mono. **A point to a team is the one tap that does everything** — increments, flips serve on side-out, checks set/match win. This is the Throwball-specific primary action (contrast cricket's runs keypad; Throwball's atomic event is simply *point to A* or *point to B*).
5. **Secondary row (demoted, ghost chips):** **Undo** (permanently visible, `--se-color-surface-warm`, never buried — inherited rule), **Serve** manual-toggle, **Timeout** (only if enabled), **Fault reason** (Guided only — long-press or a small "why?" that opens the fault pills to tag the just-scored point; skippable). These LOOK one tier down from the point buttons.
6. **Press physics only:** `:active` translate 1–2px + collapse shadow over `--se-motion-standard`. No decorative motion on controls.

**Guided vs Power (inherit cricket's mode toggle idea, lighter):**
- **Default = one-tap Power-ish:** tap the team that won the rally → point. Fastest; what 90% of ICP scorers want.
- **Guided (optional):** after a point, a soft inline "How was it won?" fault-reason pill row appears for stat enrichment; dismissible, never gating. Same underlying event either way.

**Set/match transitions = full-screen soft decision (no modals):** on set win, canvas shifts to `--se-color-surface-warm`, hero pins, a confirmation-echo card restates ("**Blue House take Set 2**, 15–12 — match level 1–1"), CTA "Start Set 3 → to 11". Deciding-set target change is surfaced here explicitly. Match win → result peak.

---

## 4. Live / spectator design (richer detail)

Lean-back, emotional, shareable — softer than the scorer (rubric §9). Keep only the outer hard shell; interior hard rules become 16–22% hairlines.

- **Hero:** green-wash, soft shadow, may take the screen's single inversion for drama. Whose-serve marker retained. Set-point / match-point banner in plain language ("Match point — Blue House serve for it").
- **Set-box strip:** same record chips as scorer, read-only, richer (shows each set's final score inline).
- **Momentum / signature detail:** **point-run indicator** ("Blue on a 5-point run") — Throwball's rally-point game produces streaks; this is the signature live moment. CSS-only run bar, encoded action/surface-warm, eyebrow + mono caption. No library, no axes.
- **Presence + reactions first-class:** viewer count in chrome, capsule reaction pills (emoji + mono count), Following pill, live pulse on the LIVE dot only.
- **Tabs:** LIVE · SCORECARD · INFO (teams, venue, format/house-rules) — capsule segmented, one language.

---

## 5. Blend direction (tokens only — no new colours)

Keep the minimal-brutalist palette + single green accent. Every value below is an existing `--se-*` / `--se-blend-*` token; **no raw hex, no new hue.**

- **Record = brutalist:** set-box strip, score numerals, serve marker, set-point/match-point stamps, scorecard grid → mono tabular (`--se-font-mono`), hard grammar. One `--se-border-standard` + one `--se-shadow-hard` on the outer shell only.
- **Conversation = soft:** setup form, set-transition screens, fault-reason pills, guidance/empty/error copy, celebration → sentence-case sans, `--se-blend-radius-soft*`, tinted inline banners, canvas shift to `--se-color-surface-warm`.
- **Green (`--se-color-action` / `--se-blend-green-wash`) = live/lead only** (governance rule 1). The score hero and the serving/leading cue use green; a lost set / trailing side never does.
- **Point buttons:** borderless soft keys over a hard grid (hybrid) — the "single best blend decision" pattern from cricket's keypad, applied to two big targets. The **primary CTA on decision screens** carries the one glow (`--se-blend-shadow-cta`).
- **Escalation ladder is the only state encoding:** neutral → set-point `--se-color-warning-soft` → match-point `--se-color-danger-soft` → emphasis = single inversion. Never a new colour, never a glow for state.
- **One gold per screen** reserved for the match-result / Player-of-the-Match milestone card (2px `--se-blend-gold` border + `3px 3px 0` ink shadow anchor, soft gold interior).
- **Player names: sans, sentence case, ≥12px — never uppercase a human.** (Women's-team rosters; respect the rule.)

**Per-screen hardness budget enforced** exactly as the rubric: 1 hard shadow, 1 hard frame, ≤3 soft surfaces, ≤1 gold, ≤1 glow, ≤1 inversion, ≤1 live pulse.

---

## 6. Data touchpoints + stats worth capturing

**Always captured (from the atomic point event):**
- Per-set score progression (A/B point-by-point) → enables set-by-set scorecard + momentum.
- Sets won, final per-set scores, match result + margin.
- Whose-serve history (side-outs) → serve-run / point-run stats.
- Timestamps per point → set duration, longest rally-run.

**Optional, only if rosters + Guided enrichment used (per-player / per-team):**
- **Per team:** points won on serve vs side-out, longest point run, faults conceded by type, timeouts used, set-point conversion rate.
- **Per player (federation-minded scorers, opt-in):** points scored (throws that won the rally), catches, service points/aces (serve unreturned), errors/faults by type, substitutions in/out. These populate the richer scorecard + POTM.

**Design rule:** casual scorers see NONE of this input burden — it all derives from team-level taps unless they opt into rosters + Guided. Stats are a spectator/scorecard reward, never a scorer tax.

---

## 7. Animations / signature moments

- **Score pop** on every point (reuse existing score-pop) — the base feedback.
- **Set won:** soft full-screen confirmation-echo transition (canvas shift + restate), not a takeover.
- **Point-run flare (signature, live):** when a side hits a run threshold (e.g. 4+), a subtle run badge animates in on spectator — reduced-motion gated, pulse reserved for live only.
- **Match won:** designed result peak — gold milestone card, plain-English margin ("Blue House win 2–1"), set line in mono, optional POTM, paired Share/Rematch CTAs (one CTA glow), muted "Done" escape.
- **Future-flagged (heavy / deferred):** per-player heat of scoring, animated momentum worm, serve-run visualisation, celebration confetti — all after basics land, all reduced-motion gated. No dark takeovers, no pulsing giant letters (off-system).

---

## 8. Port-vs-redesign

**Reuse from the generic scorer / mono system (port):**
- `mono.css` tokens, `.mono-card`, badges, transitions, press physics — verbatim.
- `GenericSetsTournament.jsx` **tournament wrapper** (standings, knockout, tabs) — Throwball plugs into the existing sets-engine tournament; standings/knockout are already sets-aware. Keep.
- The sets standings calculator + `format: {type, sets}` storage shape — extend, don't replace.
- Result/share trio pattern from cricket (`MonoMatchResult` / `Scorecard` / `Share`) once available — shared primitive.
- Blend tokens (frozen) + line-divided-keypad primitive (cricket) — the two-target point bar is a thin variant.

**Build bespoke (redesign — the generic scorer cannot do these):**
- **The live match scorer.** `MonoLiveGame.jsx` is a *goals-style* two-total scorer with +/- buttons and a single "Complete" — it has **no concept of a set target, win-by-2, caps, deciding-set target, set completion, serve, or set-box strip.** Throwball needs a purpose-built set-aware scorer (the §3 layout) sitting on a proper set engine.
- **Set engine:** rally-point set logic, win-by-2 + cap, per-set configurable targets (deciding set to 11), set/match completion detection, serve/side-out tracking, 100-deep undo across set boundaries. This is the foundation, analogous to cricket's C1a — build it first; every surface presents over it.
- **Set-box strip component** (record chips) — new, shared with spectator/scorecard.
- **Serve/possession marker** — new primitive.
- **Setup preset + house-rule UI** for Throwball variants — bespoke config over the existing sets tournament creator.
- **Spectator + scorecard** for set-based rally play with momentum/point-run — bespoke.

---

## 9. Open questions / product decisions

1. **Deciding-set default:** short decider to 11 ON by default for College preset, or keep full 15? (Leaning: ON for College, OFF for Federation.)
2. **Cap default:** hard-cap at target+2 by default, or pure win-by-2 unbounded? Casual grounds want a cap to end games — but which value per preset.
3. **Serve tracking necessity:** is whose-serve worth showing to casual scorers at all, or is it clutter until federation mode? (Rally-point means serve doesn't affect scoring — possibly demote to spectator-only.)
4. **Rotation:** ship as pure display toggle (no enforcement) or omit entirely for v1? (Leaning: omit v1, file as future.)
5. **Player-level stats input:** is ANY per-player capture realistic for the ICP, or should v1 be strictly team-level with player stats deferred? (Leaning: team-level v1; player stats future + opt-in.)
6. **Fault-reason enrichment:** worth building the Guided "why?" pills for v1, or defer until stats demand exists? (Leaning: defer; scorer stays one-tap.)
7. **Players/side (7 vs 9):** does it affect anything in v1 beyond roster length? (Only if rotation/positions are tracked — tie to Q4.)
8. **Timeouts:** track (counter) or ignore for v1 casual scope?
9. **Migration:** how do existing generic sets-tournament Throwball matches (if any exist under a sets storage key) migrate onto the new set engine — new-matches-only with a read-only shim (cricket's leaning) vs backfill?
10. **Preset naming/values:** confirm the three named presets (College / School / Federation) and their exact numbers with a domain check before build.
