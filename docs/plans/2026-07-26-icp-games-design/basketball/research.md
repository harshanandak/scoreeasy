# ScoreEasy — Basketball Research (real-world scoring + live experience)

**Date:** 2026-07-26 · **Status:** RESEARCH (feeds the design brief) · **Market:** Indian school / college / university / ground scorers.
**Method:** mirrors the cricket exemplar — study how the game is *actually scored and broadcast in the real world* (federation scoring software, TV score bugs, stadium boards, popular apps), then extract the exact event stream an operator must capture, the scoreboard anatomy a viewer reads at a glance, the India-variant reality, the gaps in existing apps, and the drama beats + spatial layer worth a signature. Companion to `design-brief.md`; grounded on the same ICP.

---

## 0. Scope note — why basketball is a genuine engine, not a re-skin

Cricket forced a bespoke engine because a "delivery" carries compound state (runs ⊕ extras ⊕ wicket ⊕ strike). Basketball forces one for a different reason: **a scoring event has a *value* (1/2/3) and the game has *nested time and foul state* (quarter × team-fouls × player-fouls × bonus × clock) that all reset on different cadences.** The generic goals scorer (`+1` per team, flat integer) cannot represent a made three, a bonus free-throw, or a player fouling out. Everything below is written to specify that engine and its surfaces precisely.

---

## 1. How the game truly works + the exact event stream an operator must capture

### 1.1 The two structural variants (the biggest branch)

**5×5 full-court** (FIBA / school / most organised play):
- **Point values: 1 / 2 / 3.** Free throw = 1; field goal inside the three-point arc = 2; field goal behind the arc = 3.
- **Time:** FIBA = 4 quarters × 10 min (NBA = 4 × 12; NCAA men = 2 halves × 20). Indian schools frequently run **2 halves** or shorter **8-min quarters**. Halftime after period 2; teams **swap baskets** at half.
- **Shot clock:** 24 sec, reset to **14** on an offensive rebound of a live ball or after certain fouls.
- **Team fouls → bonus:** the **5th team foul in a period** puts the opponent "in the bonus" — every subsequent defensive foul the rest of that period yields **2 free throws** (no more 1-and-1 in FIBA; NCAA/high-school still use the 1-and-1 on the 7th, double bonus on the 10th — a real ruleset fork). Team-foul count **resets to 0 each period**.
- **Player fouls → foul-out:** a player is disqualified on their **5th personal foul** (FIBA/college) or **6th** (NBA). Bench-critical: fouling out changes who is on the floor.
- **Special fouls:** technical foul (1 FT + possession), unsportsmanlike/flagrant (2 FT + possession) — these also count toward team and personal totals and can eject.
- **Timeouts, substitutions, possession arrow** (alternating possession on held balls).

**3×3 half-court (the dominant Indian college-fest variant — treat as a peer):**
- **Values are 1 and 2 ONLY.** Inside the arc = **1**, behind the arc = **2**. **There is no 3.** Free throw = 1. This is the single fact that reshapes the keypad.
- **No quarters. One period.** First to **21 points** *or* **10-minute cap**, whichever comes first. Overtime = first to **2 points**.
- **Shot clock: 12 sec.**
- **Team fouls:** fouls 1–6 = ball checked back / normal; **7th, 8th, 9th team foul = 2 free throws**; **10th and beyond = 2 free throws + possession.** A shooting foul on a made basket = **1 FT** (the and-1). No fouling-out by personal count in standard 3×3 (a player with 2 unsportsmanlike is disqualified).
- After every made basket the ball is **"checked" back behind the arc** before play resumes (the "clear" / take-back rule) — relevant only if we ever track possessions.

*(3×3 rules verified against the [FIBA Official 3x3 Basketball Rules](https://fiba3x3.com/docs/fiba-3x3-basketball-rules-full-version.pdf) and [olympics.com's 3x3 explainer](https://www.olympics.com/en/news/what-how-play-3x3-basketball-rules-scoring-tokyo-olympics-court-size).)*

### 1.2 The canonical event an operator captures

Every scoring action reduces to a typed event. The **minimum viable** capture (roster-less, casual) and the **full** capture (rostered, detailed) share one shape:

```
ScoreEvent {
  team: 'A' | 'B',
  value: 1 | 2 | 3,                 // 3 illegal in 3×3
  kind: 'ft' | 'fg2' | 'three',     // free-throw / 2pt field goal / 3pt
  playerId?: string,                // optional attribution layer
  quarter: number,                  // or period=1 in 3×3
  gameClock?: string,               // optional, off by default on our grounds
  assistPlayerId?: string,          // detailed mode only
  shotZone?: CourtZone,             // deferred spatial layer (§5)
}
```

Non-scoring events the engine must also record (they drive bonus/foul-out/bench, not the score):

```
FoulEvent   { team, playerId?, type: 'personal'|'shooting'|'technical'|'unsportsmanlike'|'offensive', quarter, resultingFTs?: 0|1|2|3 }
Timeout     { team, quarter, gameClock? }
Substitution{ team, inPlayerId, outPlayerId, quarter }   // detailed mode
PeriodEnd   { quarter }            // resets team fouls, may swap baskets
```

**The operator's real-world flow, precisely:**

1. **A basket is made** → operator taps the value on the scoring team's side. `+2` is ~55–60% of taps, `+3` next, `+1` (FT) last. This is the 90% loop — must be **one tap**, instant to the team total.
2. **Shooting foul / and-1** → made basket **+** a foul that yields free throws. Real scorers log the make, then the FT(s) as they go in. Casual scorers routinely just tap `+1` per made FT and ignore attribution.
3. **Non-shooting foul** → increment **team fouls** (period counter) **and** the **player's personal fouls** (game counter). When the team counter crosses the threshold (5 in FIBA period; 7/10 in 3×3), the engine flips **bonus on** and future defensive fouls award FTs automatically.
4. **Foul-out** → when a player's personal count hits the limit (5 FIBA / 6 NBA), flag disqualified; UI must surface it because the bench changes.
5. **Timeout** → decrement the team's remaining timeouts; usually pairs with a clock stop.
6. **End of period** → **reset team fouls to 0**, keep personal fouls, (optionally) swap baskets, advance quarter. In 3×3 there is no period handoff — instead a **target-reached (21) or time-cap** end check runs after *every* scoring event.
7. **Undo** — every event above is one atomic, LIFO-undoable unit (mis-tap a `+3` that was a `+2` → undo, re-enter). This is the single most-used correction action; it must never be buried.

**Derivations the engine owns (single source of truth, analogous to cricket's `deriveInnings`):** running score, per-quarter line score, margin, biggest lead, lead changes, current scoring run ("9–0"), field-goals-made by value, FT count, team-foul→bonus crossing per period, player foul-out eligibility, and for 3×3 **points-to-target** + win-by-2 state. Nothing rate/stat is stored ad-hoc.

---

## 2. How real scoreboards / broadcasts present it

### 2.1 The MAIN SCOREBOARD — what a viewer reads at a glance

A [score bug](https://en.wikipedia.org/wiki/Score_bug) (the on-screen TV graphic) and a stadium board carry the **same irreducible core**. Per Wikipedia's own definition, an NBA scorebug shows *"time, score, timeouts remaining, foul situation, shot clock, and quarter."* The at-a-glance anatomy, in priority order:

1. **The two team scores** — the biggest elements, mono/tabular, each next to a **team abbreviation + colour/logo** (e.g. `LAL 88 — 84 BOS`).
2. **Game clock** — minutes:seconds remaining in the current period. On our grounds this is often absent/optional.
3. **Quarter / period indicator** — `Q3`, `HALF`, `OT`.
4. **Shot clock** — a smaller countdown, usually near the score, that **changes colour under 10/5 seconds** (e.g. on Amazon Prime Video's NBA bug the shot clock turns **blue** under 10s where other networks go red/yellow — per [ColorWay Sports' 2026 NBA scorebug ranking](https://www.colorwaysports.com/stories/nba-national-broadcast-scorebugs-2026-ranked)). Optional on our grounds.
5. **Team-foul / BONUS state** — a small indicator (dots, a count, or a lit "BONUS"/"PENALTY" flag) telling the viewer the team is over the foul limit so the next foul shoots free throws. This is the **most game-relevant signal after the score** and is universally present on organised boards.
6. **Timeouts remaining** — small pips or a number per team.
7. **Possession arrow** — a triangle indicating who gets the next held-ball possession.

That ordering is the design contract for our hero: **score → margin/quarter → foul/bonus state → clock/shot-clock (optional) → timeouts.**

### 2.2 Richer broadcast overlays (the "conversation" layer)

Beyond the persistent bug, broadcasts and pro scoring software surface deeper graphics between plays:

- **Quarter-by-quarter line score** — the classic box top: `Q1 Q2 Q3 Q4 · Total`, e.g. `24 · 18 · 22 · — | 20 · 25 · 19 · —`. Unplayed quarters render as empty/dashed slots (mirrors cricket's over-strip "always render all slots"). Concrete: this is the standard "linescore" strip on ESPN/NBA gamecasts and every FIBA scoresheet.
- **Player box score** — PTS, and in detail: FG made/attempted, 3PT, FT, REB, AST, STL, BLK, TO, PF (personal fouls), +/−.
- **Shot chart** — a court diagram with makes/misses plotted by location, split into 2-pt vs 3-pt zones. This is a **first-class output of the federation scoring app**: [FIBA LiveStats](https://about.fiba.basketball/en/services/data-and-video-solutions/fiba-live-stats) produces *"box score, play-by-play, and shot chart reporting"* natively, and v8 even expanded shot **types** (reverse layup, Euro step, alley-oop dunk vs layup, tip-in). This is the pro anchor for our deferred spatial layer (§5).
- **Play-by-play feed** — a timestamped event log ("8:42 Q3 · #7 Rohit — 3PT made · assist #4").
- **Momentum / run graphics** — "TEAM ON A 12–2 RUN", lead-tracker line charts, "biggest lead" callouts. These are lower-third graphics triggered by the derivation, not persistent.
- **Foul-trouble callouts** — "STARTER · 4 FOULS" flags when a key player nears disqualification.

### 2.3 Concrete real-world reference points

- **FIBA LiveStats / FIBA Organizer** — the official federation desktop/tablet scoring tool: point-and-click event entry, full official statistics, a substitution "holding bay", team colours/logos, actions-under-review flagging, an **official printable scoresheet**, and **free webcasting live within a minute or two** ([GameDay FIBA LiveStats](https://mygameday.app/fiba-livestats/), [FIBA data & video services](https://about.fiba.basketball/en/services/data-and-video-solutions)). This is the "CricHeroes bar" equivalent — the dense, complete, official ledger.
- **NBA national broadcast bugs (2026: ESPN/ABC, Amazon Prime Video, NBC Peacock)** — same core, different treatments of bonus, timeouts and shot-clock colour thresholds ([ColorWay Sports 2026 ranking](https://www.colorwaysports.com/stories/nba-national-broadcast-scorebugs-2026-ranked)); useful as the "score-bug anatomy" reference.
- **Consumer scoring apps** — [iScore Basketball](https://apps.apple.com/us/app/iscore-basketball-scorekeeper/id319581197) (deep youth→pro tracking), [Scorebook+ Basketball](https://scorebookplus.com/basketball/) (preset rule types for youth/middle/high/college; possession arrow, fouls, timeouts on a familiar board), and [TurboStats](http://turbostats.com/basket.htm) which ships a telling feature — an **optional `[No Sub]` / points-only mode** for fast scoring vs full stats. That mode split is exactly our casual-vs-detailed axis, validated by a shipping product.

---

## 3. India school / college / ground variants — what casual scorers actually need

The organised-basketball picture above is the *ceiling*. Our ICP mostly plays below it, and the reality reshapes requirements:

- **3×3 is the casual default, not a sub-mode.** Inter-college fests, hostel leagues and society/apartment single-basket courts overwhelmingly play half-court 3×3 to **21 / 11**, or "winner-stays". The `1 / 2` value set (no 3) is the common case, and the keypad must **reshape** to it, not hide a disabled `+3`.
- **No table crew, no clock operator.** School and fest games rarely have a dedicated shot-clock/scoreboard official. The game clock is a **phone timer or the ref's whistle**; the shot clock is usually **not enforced at all**. → Both the running clock and the shot clock must be **optional and off by default** — never a required field to advance a score. (This is the single biggest divergence from FIBA LiveStats, which assumes a table crew.)
- **Periods vary by institution.** Schools run **2 halves** or **4 short (8-min) quarters** as often as FIBA's 4×10. Setup must let the scorer pick **period count (2/4) and length**, not assume 10-min quarters.
- **Free-throw rigour is low.** Many casual scorers just add "2" when someone scores and shrug at and-1s and FT attribution. The fast path must be **forgiving** — logging a made FT as `+1` must be as cheap as a field goal; strict bonus/FT/attribution tracking is an **opt-in "detailed mode."**
- **Rosters are often absent.** Gully/hostel games are "Skins vs Shirts / A vs B" — no jersey numbers. The scorer **must run roster-less** (team-total only) and *upgrade in place* to per-player stats when a lineup exists.
- **House rules dominate single-basket courts.** Winner-stays, first-to-N, **win-by-2** — these are toggles, not edge cases.

**What the casual Indian scorer actually needs (the 20% that is 80% of value):** two team scores, a `+2` that is one thumb-tap, a `+3` (5×5) or `+1` (3×3) beside it, a foul counter that quietly warns when bonus/foul-out is near, always-visible undo, and a shareable final with the top scorer. Everything else (shot clock, box splits, assists, shot chart) is a *bonus they can opt into*, never a gate.

---

## 4. GAPS — what existing basketball scoring apps don't do well (the opportunity)

Basketball scoring in India is digitally **underserved**; the tools that exist were built for a US/organised context and fail the ICP in patterned ways:

1. **3×3 is a second-class citizen or absent.** Nearly every consumer app (iScore, Scorebook+) models 5×5 with a full clock, shot clock, and quarters. The **half-court 3×3 to-21 game that dominates Indian fests** is not a first-class preset with a reshaped `1/2` keypad. **Opportunity:** ship 3×3 as a peer setup preset with its own scoring math (points-to-21, win-by-2, 7th/10th-foul FT rules) and pad shape.
2. **They assume a table crew and a clock.** Pro tools (FIBA LiveStats) and even prosumer apps are built around an enforced game/shot clock and formal substitutions. On our grounds there is no clock operator, so these apps feel heavy and demand fields the scorer can't fill. **Opportunity:** clock-optional, whistle-driven scoring that never blocks a `+2`.
3. **Setup friction is high.** Rosters, jersey numbers, rule presets and clock config are typically **mandatory before the first point**. A gully match needs to start in ~15 seconds ("name two teams → Start"). **Opportunity:** roster-less instant start with in-place upgrade — the cricket-proven "add later" pattern.
4. **All-or-nothing stat depth.** Most apps are either a dumb `+1/+2` counter *or* a full-stat behemoth with FG/AST/REB/STL/BLK/TO on every tap. TurboStats' `[No Sub]` mode hints at the fix but it's the exception. **Opportunity:** a clean **casual ↔ detailed toggle** over one engine (exactly the cricket Guided↔Power split), so the same match can be scored loosely or richly.
5. **The live/spectator experience is an afterthought.** Consumer scorekeepers are operator tools; the *watching* experience (a shareable live link with score, run context, bonus state, buzzer moments, reactions) barely exists for grassroots Indian basketball. FIBA's webcast is pro-only and bland. **Opportunity:** a lean-back, WhatsApp-shareable live page — the thing that makes a hostel final feel like a broadcast. This is ScoreEasy's structural edge and it is wide open here.
6. **Foul/bonus state is under-surfaced or jargon-heavy.** Where it exists it's a cryptic "TF: 5" or an unexplained "BONUS" with no plain-English cue about *what changes*. **Opportunity:** a first-class, explained BONUS badge + foul-trouble callouts ("Next foul on Rohit College = 2 free throws").
7. **Weak correction ergonomics.** Fast counters make mis-taps easy and undo hard/hidden. **Opportunity:** every event a single, always-visible LIFO undo unit.

---

## 5. Moments that matter (signature animations) + the spatial/positional layer

### 5.1 Drama beats worth a signature animation

Reduced-motion gated; press-physics + one live pulse are the baseline. Candidates, ranked by how much they define the sport:

1. **The made three (and the buzzer-beater).** A `+3` is basketball's boundary-six — it must get a **bigger score-pop beat than a `+2`** (tiered by value, echoing cricket's four/six). A basket made as the period clock hits `0:00` is the **buzzer-beater** — the single most iconic basketball moment; a designed signature (not a full takeover) at period/game end.
2. **The scoring run / momentum swing.** "9–0 run", "14–2 since the timeout" — runs are how basketball *feels* like it's turning. Worth a subtle emphasis on a plain-language **momentum line** and a run-tracker viz (§5.2). This is basketball's answer to a cricket collapse.
3. **BONUS crossing.** The moment a team enters the bonus visibly changes how the game is played (every foul now shoots). A hard status-stamp flip to a **BONUS badge** — glanceable, explained.
4. **Foul trouble / foul-out.** A key player reaching 4 fouls (one from out) is a bench-altering tension beat; the foul-out itself is a moment. Surfaced as a soft callout, escalating on the danger ladder.
5. **Lead change / new biggest lead.** The scoreboard flipping who's ahead, or a team stretching to its largest margin — a light emphasis on the margin pill.
6. **Player scoring milestone.** 20 pts, a double-digit-run, etc. — one **gold milestone card** (one gold per screen), reused for the final result peak.

### 5.2 The interactive spatial/positional layer (cricket has the wagon-wheel — basketball's is the shot chart)

Basketball is a **spatial** game, and the pros already capture it: FIBA LiveStats' native **shot chart** plots every make/miss by court location. That is the direct analogue to cricket's wagon-wheel and the strongest candidate for an interactive tracking layer. Ranked candidates:

1. **Shot chart / court-zone map (primary, defer like the wagon-wheel).** A half-court diagram where each made basket can optionally be tap-placed by location, aggregated into **2-pt vs 3-pt zones** (paint, mid-range, corners, above-the-break three). Capture piggybacks on the existing scoring tap ("where from?" micro-layer), the `shotZone` field already reserved in the event model. Pro-validated, uniquely basketball, and the marquee interactive artefact for the box/spectator tab. **Ship-later, like cricket's tap-to-place wagon.**
2. **Scoring-run tracker (ship-early, cheap).** A CSS-only run/lead line — a horizontal momentum bar or a lead-over-time sparkline derived purely from the event stream (no new capture). Encodes runs, lead changes and biggest lead. This is the highest-value spatial-ish viz that needs **zero extra operator work** — build it first.
3. **Quarter/buzzer takeover strip.** The quarter-by-quarter line score as an interactive strip (tap a quarter → that quarter's mini box), with the buzzer-beater moment anchored to a period slot.
4. **Foul-trouble state board.** A per-player foul-load panel (0–5 pips per player) that colours up toward foul-out — a positional-in-the-bench sense of who can still play. Reads straight off `FoulEvent` accumulation.

**Recommendation:** ship the **scoring-run tracker + foul-trouble board** at launch (free from the event stream, high drama payoff), and **defer the tap-to-place shot chart** exactly as cricket deferred the wagon-wheel — reserve the `shotZone` field now so the capture layer can be added without an engine migration.

---

## 6. Summary of design-load-bearing findings

- **Two engines-in-one:** the `1/2/3` (5×5) vs `1/2` (3×3) value fork + differing period/foul/target rules is *the* engine branch; the keypad physically reshapes between them.
- **Clock-optional is non-negotiable for the ICP** — the biggest divergence from every pro tool.
- **The scoreboard read-order is fixed by the real world:** score → quarter/margin → **bonus/foul state** → optional clock/shot-clock → timeouts.
- **The market gap is real and specific:** 3×3-first, roster-less instant start, casual↔detailed toggle over one engine, and a shareable live experience nobody serves at the grassroots.
- **Signatures:** made-three / buzzer-beater (tiered pop), scoring-run momentum, BONUS crossing, foul-out. **Spatial layer:** run-tracker + foul-trouble now, tap-to-place **shot chart** deferred as the wagon-wheel analogue.

---

## Sources

- [FIBA Official 3x3 Basketball Rules (full)](https://fiba3x3.com/docs/fiba-3x3-basketball-rules-full-version.pdf)
- [Olympics.com — What is 3x3 basketball: rules, scoring](https://www.olympics.com/en/news/what-how-play-3x3-basketball-rules-scoring-tokyo-olympics-court-size)
- [FIBA LiveStats — data & video solutions](https://about.fiba.basketball/en/services/data-and-video-solutions/fiba-live-stats)
- [GameDay — FIBA LiveStats features (box score, play-by-play, shot chart)](https://mygameday.app/fiba-livestats/)
- [Wikipedia — Score bug](https://en.wikipedia.org/wiki/Score_bug)
- [ColorWay Sports — Every NBA National Broadcast Score Bug for 2026, Ranked](https://www.colorwaysports.com/stories/nba-national-broadcast-scorebugs-2026-ranked)
- [Wikipedia — Bonus (basketball)](https://en.wikipedia.org/wiki/Bonus_(basketball))
- [iScore Basketball Scorekeeper](https://apps.apple.com/us/app/iscore-basketball-scorekeeper/id319581197)
- [Scorebook+ Basketball](https://scorebookplus.com/basketball/)
- [TurboStats Basketball (No-Sub / points-only mode)](http://turbostats.com/basket.htm)
