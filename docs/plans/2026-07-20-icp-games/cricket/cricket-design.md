# ScoreEasy — Bespoke Cricket Live Experience (Design)

**Date:** 2026-07-20 · **Status:** Design draft · **Design system:** design1-mono (brutalist shell × HiFi-blend)

Benchmarked to CricHeroes / Cricbuzz / ESPNcricinfo / Sofascore, expressed entirely in
our tokens. This doc specifies the **scorer live board**, the **spectator live screen**,
the **signature-moment micro-animations**, and the **data touchpoints** that make all of
it possible. Companion mockup: `cricket-live-mockup.html`.

---

## 0. Design-system contract (non-negotiable)

We build cricket-specific components **on top of** the existing system; we do not restyle
the system.

**Brutalist shell (unchanged backbone):** pure-black ink & 1px black borders, hard
`3px 3px 0` shadow on every shell/card, tight radius (`--se-radius-*` ≈ 4–8px), Inter for
copy, JetBrains Mono for all numerals + uppercase microlabels, `letter-spacing` on
`UPPERCASE MONO` labels.

**HiFi-blend warmth (selective overlay via `--se-blend-*`):**
- **Green = lead / live only** (`--se-blend-green-wash #e7f4ee`, `-strong #d6ecdf`, `--primary` action). Never resting decoration.
- **Gold = exactly ONE milestone accent per screen** (`--se-blend-gold #b8862e`, `-bright #e8b64c`).
- **Capsules/circles = interactive only** (`--se-blend-radius-capsule 999px`, `-circle 50%`). Never round a card body.
- **Hard shell / soft content:** softness (`--se-blend-radius-soft*`, `--se-blend-shadow-soft`, washes) lives *inside* the shell; the frame stays hard.
- **Live pulse = genuine live only + reduced-motion gated** (`.se-blend-pulse`, `--se-blend-pulse-duration 2.4s`).
- **Soft budget per screen:** ≤ ~3 soft surfaces + 1 gold moment + 1 live signal.

**Reused shared primitives (do NOT rebuild):** `MonoSheet` (the outer brutalist frame),
mono chips/capsules, and the match-end `Result` / `Scorecard` / `Share` trio. Cricket adds:
ball-by-ball engine + delivery timeline, batter/bowler cards, rate math, wicket-flow sheet,
signature-moment layer.

### 0.1 The engine gap this design closes (from baseline audit)
Today's two scorers (`MonoCricketLiveScore.jsx`, `MonoCricketTestLiveScore.jsx`) score a
**team aggregate only** — no delivery record, no batter/bowler entity, no this-over strip,
no dismissal type, no RRR, extras folded into the total. **Every feature below is downstream
of one decision: record a `Delivery`, not a run.** Unify both formats onto one
`innings[] → over[] → delivery[]` model; the flat `scores{}` shape is retired.

---

## 1. Data model — the ball-by-ball spine

One delivery is the atomic event. Everything (over strip, cards, rates, FoW, wagon-wheel,
milestones, undo) is derived from the delivery log.

```
Match
 ├─ format: { name, oversPerInnings, ballsPerOver(=6|configurable), playersPerSide,
 │            powerplays:[{fromOver,toOver,maxOutside}], freeHitOnNoBall,
 │            dlsEnabled, superOverOnTie, houseRules:{oneTipOneHand, noLBW,
 │            lastManStands, singleBatterRuns, boundaryRule, ... } }
 ├─ innings: [ Innings ]           // 1..2 (limited) or 1..4 (test); same shape
 └─ result: { type, marginRuns|marginWkts|inningsPlus, mvp, dlsTarget? }

Innings
 ├─ battingTeam, bowlingTeam, target?
 ├─ deliveries: [ Delivery ]       // append-only; the source of truth
 ├─ striker, nonStriker, bowler    // pointers, auto-updated
 └─ (derived) runs, wkts, legalBalls, overs, extrasBreakdown, fow[], partnerships[]

Delivery {
  overNo, ballInOver, legal:bool,           // legal drives the over counter
  batsmanRuns:int,                          // credited to striker only
  extra: null | { type:'wide'|'no-ball'|'bye'|'leg-bye'|'penalty', runs:int },
  wicket: null | { type:'bowled'|'caught'|'lbw'|'run-out'|'stumped'|'…more',
                   out:batterId, bowler?:id, fielders?:[id], onFreeHit:bool },
  freeHit:bool, striker, nonStriker, bowler, // snapshot for undo + strike math
  wagon?:{angle,dist}, ts
}
```

**Derived-rule invariants the engine owns (auto, with manual override):**
- **Legal-ball counter:** wide & no-ball do NOT advance the over and force a re-bowl; bye & leg-bye DO advance it.
- **Extras credited to TEAM, never batter.** Bye/leg-bye add to team total but 0 to the striker's `B` only for bye/leg-bye (they still face a legal ball). Wide adds +1 team, striker faces nothing.
- **Strike rotation** = f(runs completed, legality, over boundary): odd physical runs swap; even keep; end-of-legal-over swaps. Always overridable (gully reality).
- **Free hit** (limited-overs, on no-ball): persists across the illegal delivery, next legal ball only run-out dismisses; wicket button relabels **RUN OUT ONLY**.
- **Bowler credit:** none on run-out. Fielder(s) captured on caught / run-out / stumped.
- **Undo:** pop last `Delivery`, restore the snapshot (incl. free-hit + strike). Keep the existing 100-deep snapshot + localStorage autosave + non-blocking sync.

**Touchpoints (existing infra to keep):** localStorage autosave every delivery, Convex live
sync (spectator reads the same delivery stream), `cricketCalculations.js` extended to derive
CRR/RRR/projection/FoW/partnerships from `deliveries[]` instead of aggregates.

---

## 2. SCORER live board — *dense + editable, one-handed, fast*

Design constraint that beats all others: **the scorer must tap the next ball within seconds.**
Celebrations are non-blocking for the operator. Layout top→bottom, keypad thumb-low.

### 2.1 Layout (inside one MonoSheet)
```
┌ MONOSHEET (hard border, 3px 3px 0) ───────────────┐
│  ⦿ LIVE · MATCH TITLE            [UNDO]  [⋯ MORE]  │  header: live pulse + undo always reachable
│                                                     │
│  MUMBAI XI                     woven green-wash     │  HERO score block
│  187/4   (18.2)                strip = batting side │
│  CRR 10.2 · need 42 off 10 · RRR 11.4(red)          │  phase-aware status line
│                                                     │
│  THIS OVER  1 · 4 · W · wd · 2 · •                  │  ball-chip strip (mono pills)
│                                                     │
│  ┌ striker ⦿  R. SHARMA   74 (41)  8×4 3×6  SR180 ┐ │  batter cards (striker asterisk/dot)
│  └ non-str    S. YADAV    22 (18)  1×4 1×6  SR122 ┘ │
│  ┌ bowler     BUMRAH   3.2-0-28-2   Econ 8.4      ┐ │  bowler spell card
│  partnership 63 (39)                                │
│                                                     │
│ ╔ KEYPAD (line-divided, borderless, hairline) ════╗ │
│ ║   0        1        2      ║  size-by-frequency  │
│ ║   3        4        6      ║  big common cells    │
│ ║ ─5─ · WD · NB · B · LB ────║  rare row, demoted   │
│ ║ [   W  WICKET   ]  [ SWAP ]║  danger-red + strike │
│ ╚════════════════════════════╝                     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Hero score block
- `RUNS/WKTS` in large JetBrains Mono `tabular-nums` (`clamp(3.25rem, 15vw, 5rem)`); wickets as faint `/N` at ~0.5em `--se-color-ink-faint`; overs `(18.2)` inline at ~0.22em baseline-aligned.
- One green-wash vertical strip (`--se-blend-green-wash`, `--se-blend-radius-soft`) marks the *batting* side — the single lead/live surface, not a card round.
- **Phase-aware status line** (the "one hero datum" swaps by phase):
  - 1st innings → `CRR 10.2 · PROJ 214`
  - chase → `NEED 42 OFF 10 · RRR 11.4` (RRR color-shifts toward `--se-color-danger` as it climbs out of reach).
- Numerals animate on change (see §4.0 count/pop) + a brief color-pulse on the stat that changed (runs vs wickets tinted differently).

### 2.3 This-over strip (the "feels live" element — shared with spectator)
Horizontal row of mono ball-chips for the current over, left→right as it unfolds:
`dot` = hollow grey pill, `1/2/3` = ink pill, `4` and `6` = **green pill** (matched-pair
boundary language, per existing intent), `W` = danger-red pill, `wd/nb/b/lb` = warning-outline
pill. New chip animates in with a subtle pop.

### 2.4 Batter / bowler cards
- **Two batters**, striker marked with a filled dot/asterisk and a thin green left-border:
  `NAME · R (B) · 4s · 6s · SR`. Anticipation foreshadow: at 45+/95+ a tiny gold
  `4 TO 50` / `2 TO 100` microlabel appears on that batter's row (gold = the screen's one milestone accent-in-waiting).
- **Bowler spell:** `NAME · O-M-R-W · Econ`, current over-in-progress reflected live.
- Partnership `runs (balls)` under the pair; last FoW available one tap deeper.

### 2.5 Keypad — converge on the line-divided idiom
Retire the plain box-grid; use the refined **line-divided keypad** (borderless cells,
fading hairline-gradient dividers, size-by-frequency) for **all** formats so cricket feels
like one app:
- Primary 3-col grid, big tap targets (`clamp(72px,12vh,104px)`): `0 1 2 / 3 4 6`.
- Demoted secondary hairline row: `5 · WD · NB · B · LB`.
- **WICKET** = full-width distinct `--se-color-danger` action (relabels **RUN OUT ONLY** on free hit).
- **SWAP** (manual strike override) beside it.
- Keep 150ms click-debounce + tiered haptics + keyboard shortcuts (`0-6 / W / E / U`) on non-touch.

### 2.6 Extras & wicket flows (rules-correct, two-step)
- **Pending-extra flow (preserve the existing model):** tapping `WD`/`NB` adds +1 **without**
  consuming a legal ball, then opens an inline run-grid for runs off that same delivery
  (double-tap guarded). `B`/`LB` count as a legal ball, runs to team not batter.
- **Wicket sheet (MonoSheet modal):** the single most data-rich event. Five one-tap buttons
  for the 98% — **BOWLED · CAUGHT · LBW · RUN OUT · STUMPED** — with rare types
  (hit-wicket, obstruct, retired, timed-out, handled) behind **MORE**. Captures: dismissal
  type, bowler credited (auto-suppressed on run-out), fielder(s), **new batter** picker,
  and a free-hit guard (if `onFreeHit && type≠run-out` → revert, toast "illegal on free hit").
- **End-of-over prompt:** auto strike-swap + bowler-change picker (excludes the bowler who just bowled).

### 2.7 More (⋯) — buried by design
Declare / follow-on / draw (test), Super Over start, penalty runs, retire, DLS revise-target,
edit any past delivery. Never on the primary surface.

---

## 3. SPECTATOR live screen — *sparse + emotional, read-only*

Same delivery stream, opposite persona. Progressive disclosure: hero + last event on the
primary view; scorecard/viz one tap deeper. **Stale data is the cardinal sin** — a wicket
that lands 15s late destroys the whole premise.

### 3.1 Tabs (few, fully labeled, Live default/centered)
`LIVE · SCORECARD · COMMENTARY · INFO` — no half-peeking 5th tab.

### 3.2 LIVE tab, top→bottom
1. **Freshness heartbeat:** `⦿ LIVE · updated 3s ago` — `.se-blend-pulse` on the dot (reduced-motion gated). Never blank on flaky networks: optimistic + last-known-good.
2. **Hero score** — identical numerals to scorer but no controls; phase-aware big datum (chase shows `NEED X OFF Y` as the giant unit, RRR reddening).
3. **This-over strip** — the shared micro-narrative (§2.3).
4. **Momentum band (flagship, Sofascore-translated):** a continuous over-by-over pressure
   line driven by run-rate delta + dot-ball streaks + wickets + required-rate gap, rising/
   falling toward the leading side's color (green vs ink). **Incident markers (wicket/six/50)
   render ON the line**, not in a separate list. A visible cross from one side's color to
   the other = the "game just turned" cue.
5. **Batter/bowler mini-cards** (read-only §2.4) + partnership.
6. **Win-probability / target ribbon** in the 2nd innings.
7. **Expandable analytical modules (below the fold, tap to open):** Worm (cumulative runs,
   both innings), Manhattan (runs/over bars with wickets as dots on top), Wagon-wheel
   (tap a batter → their radial shot map), partnership breakdown. Mobile-native, tappable,
   filterable — never crammed onto the hero.

### 3.3 COMMENTARY tab
Reverse-chronological feed, fixed left gutter `over.ball` (`18.2`) + outcome token + text.
**WICKET** balls get a full-width danger-red band; **SIX**/milestone get a green/gold
highlighted band so key moments jump on thumb-scroll. Correct vocabulary
(`c Kohli b Bumrah`, `run out (Jadeja)`, `lbw`) = instant legitimacy. New ball auto-appends
with a subtle slide.

### 3.4 SCORECARD tab
International-grade: batter rows (`NAME · dismissal text · R B 4s 6s SR`), bowler rows
(`O M R W Econ · wd nb`), **Extras** itemized (`b lb wd nb pen`), **Fall of Wickets**
(`score-wicket (over)`). Reuses the shared match-end `Scorecard` primitive.

### 3.5 Share (reuse shared `Share` primitive)
Auto-generated branded card (brutalist frame + one green/gold accent) for: live score,
each 50/100, 5-wicket haul, MVP, and result — WhatsApp-ready. This is the India viral loop;
invest heavily. Every signature moment (§4) has a matching one-tap share card.

### 3.6 Notifications (low-fatigue, user-defined)
Per-event + per-player toggles (wicket, boundary, fifty, my-player-out, result). One
mistimed irrelevant alert = permanent opt-out; copy itself is a signature surface.

---

## 4. SIGNATURE MOMENTS — micro-animation specs

**Ladder principle:** feedback intensity ∝ event importance; motion ≤ 300–500ms; the
*rarest* events get the *biggest* motion so celebrations stay meaningful. All animations
**reduced-motion gated** (fall back to an instant color/state change). Scorer variants are
**non-modal** (operator taps on); spectator variants may briefly take over.

### 4.0 Baseline: score change (every delivery)
`mono-score-animate` numeral pop (scale 1→1.06→1, 220ms) + 400ms color-pulse on the changed
stat. Haptic: single tick. This is the floor everything escalates from.

### 4.1 FOUR vs SIX — tiered, not one animation (the heartbeat)
- **FOUR (medium):** the boundary chip flips to green + a quick horizontal **sweep/ripple**
  across the hero strip (240ms), numeral pop, haptic `[50,50,50]`. Non-blocking.
- **SIX (large):** bigger — green **screen-edge burst** (inset glow expands + fades, 380ms),
  numeral pop scaled higher, boundary-arc flourish plotted on the wagon-wheel, haptic
  `[80,60,80]`. If the six **raises a milestone or wins the match → escalate** into 4.3/4.5.
- Chips keep the matched-pair green language; the *motion* is what differentiates 4 from 6.

### 4.2 WICKET — the emotional inverse (one moment allowed to take over)
- **Scorer:** non-modal danger-red flash on the WICKET action + the wicket sheet slides up; a
  red inline **Fall-of-Wicket card** drops into the over strip. Haptic `[80,80,80]`.
- **Spectator:** full-width inline **WICKET takeover card** sweeps into the timeline —
  dismissal type + bowler figures + the falling batter's final line + "partnership broken (63)".
  The **momentum band snaps** toward the bowling side; color language flips by the user's
  followed team (celebration vs somber). 450ms sweep, heavy haptic. Then collapses to a
  commentary band. **This is where a bespoke app out-classes generic scoreboards.**

### 4.3 MILESTONE 50 / 100 (+ bowler 5-fer) — the gold moment
- **Anticipation:** at 45+/95+ the gold `4 TO 50` foreshadow appears (§2.4) so spectators lean in.
- **Trigger** on the delivery that crosses it: freeze the batter's card, **raised-bat**
  flourish, gold ring (`--se-blend-gold-bright → -gold` gradient, the screen's ONE gold
  accent), show `balls-faced · SR`, 500ms. Auto-generates the milestone **share card**.
- Extends to team milestones (100/200 up) and fastest-fifty.

### 4.4 HAT-TRICK / on-a-hat-trick — anticipation state (differentiator)
After 2 wickets in 2 balls, the next delivery enters a **HAT-TRICK BALL** held-breath state:
a pulsing danger-outline band + short countdown/"held" cue on both scorer and spectator, then
either **explodes** (achieved → escalated wicket 4.2 + gold) or **exhales** (dot/runs → band fades).
Most apps miss this; it is a signature-tension pattern.

### 4.5 LAST OVER / DEATH CHASE — auto "clutch mode"
When the equation crosses a threshold (e.g. `≤ 24 off ≤ 12`): the whole screen **auto-shifts**
into clutch mode — the `NEED X OFF Y` equation becomes the giant hero unit, a pulsing accent
frame, RRR climbing red, tighter live cadence, per-ball haptic, win-probability swinging each
delivery. Every dot and boundary in this window gets amplified feedback. Dedicated repeatable
high-tension screen.

### 4.6 SUPER OVER / TIE-BREAK — rare, maximal (build even though rare)
Dedicated 6-ball head-to-head layout, side-by-side team totals, re-super-over-on-tie state
(boundary countback deprecated). Reuse the existing Super Over state machine; give it a
distinct "this is the decider" visual mode instead of styling it like normal scoring.
Scarcity = screenshot-worthy.

### 4.7 MATCH COMPLETE — the payoff (existing bar to match)
Score block flips to full-screen **Result** state ("won by 6 wickets") + MVP reveal, confetti +
heavy haptic (already built), reusing shared `Result` + `Share`. This is the one signature
treatment already attempted — hold the others to its quality.

---

## 5. Data touchpoints (summary)

| Surface | Reads | Writes |
|---|---|---|
| Scorer keypad / wicket sheet | current innings pointers, format rules, free-hit | append `Delivery`, update striker/bowler, FoW |
| Undo | last snapshot | pop delivery, restore snapshot |
| Hero + rates | `deriveInnings(deliveries)` → runs/wkts/overs/CRR/RRR/proj/target | — |
| This-over strip | last over's deliveries | — |
| Batter/bowler cards | per-player fold over deliveries | — |
| Momentum / worm / manhattan / wagon | full delivery stream | — |
| Spectator (all) | Convex live subscription to the same delivery stream | — (read-only) |
| Share cards | milestone/result events | image export |
| Notifications | event predicates over the stream | push (user-toggled) |

**Reliability floor (keep):** 150ms debounce, 100-deep undo snapshots, localStorage autosave
per delivery, non-blocking Convex sync, storage-full warning banner, freshness "updated Ns ago".

---

## 6. Build order (design → implementation handoff)
1. **Delivery engine + unified `innings[]` model** (retire flat `scores{}`; extend `cricketCalculations.js` to derive from deliveries). *Everything is downstream of this.*
2. **Scorer board** on the delivery engine: hero + this-over strip + batter/bowler cards + line-divided keypad + wicket sheet + pending-extra flow.
3. **Spectator LIVE/SCORECARD/COMMENTARY** off the Convex delivery subscription.
4. **Signature-moment layer** (4.0→4.7), tokenized (no inline hex; move FREE HIT / Last-Man colors onto tokens first) + reduced-motion gates.
5. **Momentum band + viz modules + share cards**.

## 7. Anti-goals (from research)
Hardcoding 6-ball/LBW-on/11-a-side · blocking celebrations that stall entry · crediting
extras to batter or bowler on run-out · one generic boundary/wicket animation · stale/laggy
updates · dumping scorecard density on the spectator hero · merging scorer & spectator into
one layout · no undo/edit-last-ball · inline hardcoded signature colors that bypass tokens.
