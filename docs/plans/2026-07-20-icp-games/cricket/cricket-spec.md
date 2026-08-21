# ScoreEasy — Cricket Bespoke Live Experience (LOCKED SPEC, post-critic)

**Date:** 2026-07-20 · **Status:** LOCKED for build (critic fixes folded) · **Design system:** design1-mono (brutalist shell × HiFi-blend)
**Supersedes** `cricket-design.md` and the prior pre-critic spec draft where they conflict.
**Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN). Mockup `cricket-live-mockup.html` is illustrative only — **this spec is authoritative** on every number, token, and rule.

All ten critic ranked fixes are folded in and marked inline as **[FIX n]**. The mockup's arithmetic, demo-state, tokenization, gold-count, capsule, and coverage defects are resolved below before build.

---

## 0. Canonical demo state — ONE match at time T (kills the contradictions) **[FIX 1, FIX 2]**

Every surface (scorer hero, over strip, cards, spectator, commentary, signature cards) renders **this single state**. Nothing may contradict it.

```
Series/Match:  Match 42 · TNPL 2026
Venue/Toss:    MA Chidambaram Stadium, Chepauk · Chennai Kings won toss, chose to bowl
Format/Rules:  T20 · 6-ball over · LBW ON · maxOversPerBowler 4      ← active-ruleset chip
Innings 1:     Chennai Kings 169/7 (20.0)
Innings 2:     Mumbai XI — target 170
State @ T:     147/4  (17.2)      ← 17 overs + 2 legal balls = 104 legal balls bowled
```

**Derived by ONE `deriveChase()` — no hand-typed rate anywhere:**
```
runsNeeded = 170 - 147 = 23
ballsLeft  = 120 - 104 = 16
RRR        = 23 / (16/6)  = 8.63  → display "RRR 8.6"
CRR        = 147 / (104/6) = 8.48 → display "CRR 8.5"
WIN(Mumbai)= 52%   basis: RRR-vs-CRR gap · 6 wkts in hand · venue chase avg   ← always stated
```
RRR (8.6) sits just above CRR (8.5) → a believable clutch → WIN ~52%. **Arithmetically closed.** (The mockup's "42 off 10 · RRR 11.4 · WIN 58%" was impossible — 42/(10/6)=25.2/over — and is retired.) **[FIX 1]**

**This-over strip @ T (over 18):** `1 · 4 · 3wd` → ball1=1, ball2=4 (2 legal), then a wide-plus-2 (illegal, no legal ball consumed). Reads `17.2`, matches the hero exactly. **[FIX 2, FIX 10 wide-label]**

**Last wicket — single source, identical on commentary AND signature card:** `I. Kishan c Kohli b Bumrah 31 (19)`. Never "b Bumrah (bowled)" on one surface and "c Kohli" on another. **[FIX 2]**

**Batters @ T:** striker `R. Sharma 68 (44) 7×4 2×6 SR 155`; non-striker `S. Yadav 19 (14)`. **Bowler:** `Bumrah 3.2-0-24-2 Econ 7.2 · 1 ov left`. **Partnership:** `41 (27)`.

**Milestone showcase (historical, separated):** the milestone share card is generated at the delivery Sharma reached fifty → it reads `50 (32)` and is explicitly timestamped to that ball. The live hero shows his current `68 (44)`. No contradiction because the card is not a live surface. **[FIX 2]**

**Foreshadow @ T:** Yadav on 19 → no `X TO 50` shown; demo keeps foreshadow OFF so the gold budget stays clean.

---

## 1. Cricket engine + state (the locked spine)

**One decision underpins everything: record a `Delivery`, not a run.** Both formats unify onto one `innings[] → over[] → delivery[]` model; the flat `scores{}` shape is retired (migration in §8).

### 1.1 Model
```
Match
 ├─ format: { name, oversPerInnings, ballsPerOver(=6|8 tennis|configurable), playersPerSide,
 │            maxOversPerBowler,                       // T20=4, ODI=10, custom=null(no cap)  [FIX 10]
 │            powerplays:[{fromOver,toOver,maxOutside}], freeHitOnNoBall,
 │            dlsEnabled, superOverOnTie,
 │            houseRules:{ tennisBall, boxCricket, oneTipOneHand, noLBW,
 │                        lastManStands, singleBatterRuns, boundaryRule } }
 ├─ innings: [ Innings ]        // 1..2 limited or 1..4 test; identical shape
 └─ result:  { type, marginRuns|marginWkts|inningsPlus, mvp, dlsTarget? }

Innings
 ├─ battingTeam, bowlingTeam, target?
 ├─ deliveries: [ Delivery ]    // append-only; SOURCE OF TRUTH
 ├─ striker, nonStriker, bowler // pointers, auto-updated
 └─ (derived) runs, wkts, legalBalls, overs, extrasBreakdown, fow[], partnerships[]

Delivery {
  overNo, ballInOver, legal:bool,
  batsmanRuns:int,                              // striker only
  extra: null | { type:'wide'|'no-ball'|'bye'|'leg-bye'|'penalty', runs:int },
  wicket: null | { type:'bowled'|'caught'|'lbw'|'run-out'|'stumped'|'…',
                   out:batterId, end:'striker'|'non-striker',   // run-out end  [FIX 10]
                   bowler?:id, fielders?:[id], onFreeHit:bool },
  freeHit:bool, striker, nonStriker, bowler,    // snapshot for undo + strike math
  wagon?:{angle,dist}, ts
}
```

### 1.2 Engine invariants (auto, each manually overridable — this is the test spec)
- **Legal-ball counter:** wide & no-ball do **not** advance the over (force re-bowl); bye & leg-bye **do**. `ballsPerOver` from format config (never hardcoded 6).
- **Extras credited to TEAM, never batter/bowler.** **[FIX 5 — corrected]:**
  - **bye / leg-bye:** +runs to TEAM extras, `batsmanRuns = 0`, **but the striker's balls-faced `B` INCREMENTS** — the batsman *is* credited the legal ball faced. (The prior text "0 to the striker's B … they still face a legal ball" was self-contradictory and is fixed.)
  - **wide:** +runs to TEAM, striker faces nothing (`B` unchanged), no legal ball consumed.
  - **no-ball:** + configured penalty to TEAM; bat runs credit the striker; the no-ball itself is illegal so `B` is unchanged on that event.
- **Wide-with-runs label:** renders the value — `3wd`, `5wd` — never a bare `wd`. **[FIX 10]**
- **Strike rotation** = f(physical runs completed, legality, over boundary): odd swaps, even keeps, end-of-legal-over swaps. Always overridable via SWAP.
- **Free hit** (limited-overs, on no-ball): persists across the illegal ball; next legal ball only run-out dismisses; WICKET relabels **RUN OUT ONLY**; a non-run-out attempt reverts with a toast.
- **Bowler credit:** none on run-out. Fielder(s) captured on caught / run-out / stumped. **Run-out captures `out:batterId` AND `end`** (which batter, which end). **[FIX 10]**
- **Bowler over-quota guard:** the bowler-change picker excludes any bowler at `maxOversPerBowler`; assigning one is blocked with a toast. `null` cap (gully/custom) disables the guard. **[FIX 10]**
- **House rules honored from day one** (config-driven): `noLBW` removes LBW from the sheet; `lastManStands` keeps the innings live at the final wicket with a lone batter; `singleBatterRuns`/`boundaryRule`/`oneTipOneHand`/`tennisBall`/`boxCricket` behave per config. Default preset = 6-ball / 11-a-side / LBW-on.
- **Undo:** pop last `Delivery`, restore snapshot (free-hit + strike + pointers). Keep 100-deep stack + localStorage autosave + non-blocking Convex sync.

### 1.3 Derivations — ONE chase function **[FIX 1, FIX 8]**
Extend `cricketCalculations.js`; everything folds over `deliveries[]`, never aggregates:
`runs, wkts, legalBalls, overs, extrasBreakdown{b,lb,wd,nb,pen}, fow[], partnerships[], per-batter{R,B,4s,6s,SR}, per-bowler{O,M,R,W,Econ,wd,nb}`.
`deriveChase(innings, format)` is the **sole** producer of `runsNeeded, ballsLeft, RRR, CRR, projection, winProb{value,basis}`. No surface computes or hardcodes a rate; WP always carries its basis string.

---

## 2. Scorer live board (LOCKED — dense, editable, one-handed, non-blocking)

Overriding constraint: **the scorer taps the next ball within seconds; celebrations never block the operator.** Layout top→bottom, keypad thumb-low, inside one `MonoSheet`.

```
┌ MONOSHEET (hard border, 3px 3px 0) ─────────────────────────┐
│ ⦿ LIVE · MATCH 42 · TNPL 2026        [UNDO]  [⋯ MORE]        │
│ Chepauk · Kings won toss, bowled                             │  match-context row   [FIX 7]
│ [ T20 · 6-BALL · LBW ON ]                                    │  active-ruleset chip  [FIX 7]
│ MUMBAI XI          (green-wash strip = batting side)          │  HERO
│ 147/4   (17.2)                                               │
│ CRR 8.5 · NEED 23 OFF 16 · RRR 8.6 (reddening)               │  deriveChase() datum  [FIX 1]
│ DLS PAR 142 · +5   (only when dlsEnabled & rain)             │  DLS par line         [FIX 10]
│ THIS OVER  1 · 4 · 3wd            Last 5 ov 47/2 · Recent 4 1 W 6 1 │  strip + recent  [FIX 7,10]
│ ┌ striker ⦿ R. SHARMA 68 (44) 7×4 2×6 SR155 ┐                │
│ └ non-str   S. YADAV  19 (14) 1×4 0×6 SR136 ┘                │
│ ┌ bowler    BUMRAH 3.2-0-24-2 Econ7.2 · 1 ov left ┐          │  overs-remaining     [FIX 7]
│ partnership 41 (27)                                          │
│ ╔ KEYPAD (line-divided, hairline)  0 1 2 / 3 4 6 ═══════════╗│
│ ║ 5·WD·NB·B·LB      [ W WICKET ] [ SWAP ]                   ║│
│ ╚═══════════════════════════════════════════════════════════╝│
└──────────────────────────────────────────────────────────────┘
```

- **Header + context + ruleset chip + DLS par line** are new trust signals; the ruleset chip text is driven by `format.houseRules` (e.g. `TENNIS-BALL · 8-BALL · NO LBW`). **[FIX 7, FIX 10]**
- **Hero:** `RUNS/WKTS` large JetBrains Mono `tabular-nums` (`clamp(3.25rem,15vw,5rem)`), wickets faint `/N`, overs `(17.2)` inline. ONE green-wash batting strip (`--se-blend-green-wash`, `--se-blend-radius-soft`). Phase-aware status line from `deriveChase()`; RRR shifts toward `--se-blend-danger-solid` as it climbs. **The hero green, boundary chips, and momentum band all reference ONE green family (§6).** **[FIX 8]**
- **This-over strip (shared):** mono ball-chips — dot=hollow grey, 1/2/3=ink, 4&6=green (boundary family), W=`--se-blend-danger-solid`, wd/nb/b/lb=warning-outline; **wide-with-runs shows `3wd`.** Chips use `--se-blend-radius-soft-sm`, **NOT capsule.** **[FIX 6, FIX 10]** Plus `Last 5 ov / Recent` datum. **[FIX 7]**
- **Batter/bowler cards:** striker marked with filled dot + thin green left-border; `NAME · R(B) · 4s · 6s · SR`. Foreshadow `X TO 50` uses `--se-blend-radius-soft-sm` + gold text — **not capsule** — and is the screen's single gold when shown. **[FIX 4, FIX 6]** Bowler shows `O-M-R-W · Econ · N ov left`. **Last-man-stands:** when `lastManStands` and `wkts == playersPerSide-1`, the non-striker slot becomes a single **LAST MAN** card. **[FIX 10]**
- **Keypad — line-divided idiom for ALL formats.** Primary 3-col `0 1 2 / 3 4 6` (`clamp(72px,12vh,104px)`); demoted hairline row `5 · WD · NB · B · LB`; **WICKET** full-width `--se-blend-danger-solid` (relabels **RUN OUT ONLY** on free hit); **SWAP** beside. **Keypad buttons, SWAP, tabs, toggles are the ONLY capsule-radius elements.** **[FIX 6]** Keep 150ms debounce + tiered haptics + shortcuts (`0-6 / W / E / U`).
- **Extras flow (pending-extra):** `WD`/`NB` add +1 without consuming a legal ball, then open an inline run-grid (double-tap guarded); result labels `3wd`. `B`/`LB` = a legal ball, runs to team, **striker `B` increments.** **[FIX 5]**
- **Wicket sheet (MonoSheet modal, soft inner panel):** **BOWLED · CAUGHT · LBW · RUN OUT · STUMPED** (LBW hidden when `noLBW`); rare types behind **MORE**. Captures type, bowler (suppressed on run-out), fielder(s), new-batter picker, free-hit guard. **RUN OUT also prompts which batter is out (striker/non-striker) and which end → writes `out`+`end`.** **[FIX 10]**
- **End-of-over prompt:** auto strike-swap + bowler-change picker excluding the just-bowled bowler **and any bowler at over-quota.** **[FIX 10]**
- **⋯ MORE (buried):** declare / follow-on / draw (test), Super Over, penalty runs, retire, DLS revise-target, edit any past delivery.

---

## 3. Spectator live screen (LOCKED — sparse, emotional, read-only)

Same delivery stream, opposite persona. Progressive disclosure. **Stale data is the cardinal sin.**

- **Tabs:** `LIVE · SCORECARD · COMMENTARY · INFO` — Live default/centered.
- **LIVE tab — soft budget = exactly 3 soft + 1 gold + 1 live** **[FIX 9]:**
  1. **Freshness heartbeat** (the live signal): `⦿ LIVE · updated 3s ago`, **shared `.se-blend-pulse` helper** (not an inline `@keyframes`), reduced-motion gated; optimistic + last-known-good. **[systemDrift fix]**
  2. **Match-context header** (venue · toss · match# · ruleset chip) — non-soft trust signal. **[FIX 7]**
  3. **Hero + `deriveChase()` datum** (soft #1: green-wash lead strip) — chase shows `NEED 23 OFF 16` giant, RRR reddening.
  4. **This-over strip** + `Last 5 ov / Recent` (non-soft chips, soft-sm radius). **[FIX 7]**
  5. **Momentum band** (soft #2, flagship): continuous over-by-over pressure line toward the leading side's color. **Incident markers render ON the line; the 50/milestone marker is a NEUTRAL ink dot — NOT gold.** **[FIX 4]** All strokes/fills reference momentum tokens, one green family (§6). **[FIX 3, FIX 8]**
  6. **Win-probability bar** (within hero group): two-segment bar `Mumbai 52% / Chennai 48%` with a per-ball trend tick and a stated basis line. **Not a bare number.** **[FIX 8]**
  7. **Batter/bowler mini-cards + partnership** (soft #3: one grouped surface).
  8. **Expandable modules (below fold, one open at a time):** Worm, Manhattan, Wagon-wheel, partnership breakdown.
  Commentary bands live on the **COMMENTARY tab**, not LIVE — that keeps LIVE at 3 soft. **[FIX 9]**
- **COMMENTARY tab:** reverse-chron, fixed gutter `over.ball` + outcome + text. WICKET = full-width `--se-blend-danger-solid` band; SIX/milestone = green/gold band. **Over-summary lines** at each over end: `End of over 17 · Mumbai 147/4 · need 23 off 18 · Sharma 68* Yadav 19*`. **[market gap]** Dismissal text comes from a **single `dismissalText(wicket)` helper**, so commentary always equals the signature card. **[FIX 2]**
- **SCORECARD tab:** reuse shared `Scorecard` primitive — batter/bowler rows, itemized Extras (`b lb wd nb pen`), Fall of Wickets (`score-wkt (over)`).
- **Share:** reuse shared `ShareLiveMatch`/`Share` — branded card (brutalist frame + one green/gold accent) for live/50/100/5-fer/MVP/result. Every signature moment has a one-tap card.
- **Notifications:** per-event + per-player toggles (transport → §8).

---

## 4. Signature moments (LOCKED — micro-animation specs)

**Ladder:** intensity ∝ importance; motion ≤ 300–500ms; rarest event = biggest motion. **All reduced-motion gated.** Scorer variants non-modal; spectator variants may briefly take over. **Zero inline hex — all colors via tokens (§6).** **[FIX 3]**

- **4.0 Score change (floor):** numeral pop (1→1.06→1, 220ms) + 400ms color-pulse on the changed stat + single haptic tick.
- **4.1 FOUR vs SIX (tiered):** FOUR = chip→green + 240ms hero sweep, pop, haptic `[50,50,50]`. SIX = 380ms green screen-edge burst, higher pop, wagon arc, haptic `[80,60,80]`. Six raising a milestone/win → escalate to 4.3/4.5.
- **4.2 WICKET (one moment allowed to take over):** Scorer = non-modal danger flash + wicket sheet + inline FoW card, haptic `[80,80,80]`. Spectator = full-width takeover (dismissal + bowler figures + falling batter's line + "partnership broken (41)"), momentum snaps to bowling side, 450ms, heavy haptic → collapses to a commentary band.
- **4.3 MILESTONE 50/100 (+5-fer) — the ONE gold:** anticipation foreshadow at 45+/95+; on the crossing delivery freeze the card, raised-bat flourish, **gold ring (`--se-blend-gold-bright → --se-blend-gold`)**, show `balls · SR`, auto-generate share card. **Only gold on the screen at any time; never co-occurs with 4.7.** **[FIX 4]**
- **4.4 HAT-TRICK / on-a-hat-trick:** after 2-in-2, next delivery = HAT-TRICK BALL held-breath (pulsing danger-outline band, both surfaces) → explodes (gold + escalated 4.2) or exhales.
- **4.5 LAST OVER / DEATH CHASE (clutch mode):** when `deriveChase()` crosses threshold (default `≤24 off ≤12` — **§8 confirm**): equation becomes giant hero unit, pulsing accent frame, RRR red, tighter cadence, per-ball haptic, WP swinging per ball.
- **4.6 SUPER OVER:** dedicated 6-ball head-to-head, side-by-side totals, re-super-over-on-tie. Reuse the existing Super Over state machine; distinct "decider" mode.
- **4.7 MATCH COMPLETE:** score flips to shared `MonoMatchResult` state ("won by 6 wickets") + MVP + confetti + heavy haptic (already built) + `Share`. This is the quality bar for all others.

---

## 5. Data touchpoints (locked)

| Surface | Reads | Writes |
|---|---|---|
| Scorer keypad / wicket sheet | innings pointers, format+houseRules, free-hit, over-quota | append `Delivery`, update striker/bowler, FoW |
| Undo | last snapshot | pop delivery, restore snapshot |
| Hero + rates + WP | `deriveInnings` + `deriveChase` → runs/wkts/overs/CRR/RRR/proj/target/winProb{value,basis} | — |
| This-over + Last-5 | recent deliveries fold | — |
| Batter/bowler cards | per-player fold; bowler overs-remaining | — |
| Momentum / worm / manhattan / wagon | full delivery stream | — |
| Commentary | stream + `dismissalText()` + over-summary fold | — |
| Spectator (all) | Convex live subscription to the same stream | — (read-only) |
| Share cards | milestone/result events | image export |
| Notifications | event predicates over the stream | push (user-toggled) |

**Reliability floor (keep):** 150ms debounce, 100-deep undo, localStorage autosave/delivery, non-blocking Convex sync, storage-full banner, "updated Ns ago".

---

## 6. Token contract — cricket additions (NO inline hex) **[FIX 3, FIX 8]**

Colors are added additively to `src/index.css` and documented in `BLEND-GOVERNANCE.md` **in the same PR**. Components reference names only. **One green family:** `--primary` is canonical; boundary and momentum greens are declared as tints of it, retiring the three ad-hoc greens (`#2f8f5c`, `#14502f`, `--primary`).

| New token | Replaces inline | Purpose |
|---|---|---|
| `--se-blend-boundary-green` / `--se-blend-boundary-ink` | `#2f8f5c` / `#14502f` | 4 & 6 chip fill + text, tint of `--primary` |
| `--se-blend-danger-solid` | `#b3261e` | WICKET action, wicket band, momentum-down stroke |
| `--se-blend-gold-ink` | `#3a2a06` | gold-text on light (milestone/foreshadow) |
| `--se-blend-momentum-up` / `--se-blend-momentum-down` | momentum strokes | momentum band, from green family + danger |
| `--se-blend-momentum-gradient` | `#eef7f1 / #f4f0ea / #fbf3e0` | the single sanctioned momentum wash-stop set |
| `--se-blend-radius-soft-sm` (exists) | capsule misuse | read-only data pills: ball-chips, foreshadow, HAPTIC label **[FIX 6]** |

**Capsule radius is reserved for interactive elements only** (keypad, SWAP, tabs, toggles, avatars); read-only display pills use `--se-blend-radius-soft-sm`. **[FIX 6]** Live pulse uses the shared `.se-blend-pulse` helper, never an inline `@keyframes`. **Tokenize FREE HIT / Last-Man colors FIRST**, before any signature-moment PR ships.

---

## 7. Sequenced build issues (each = one PR on top of shared primitives + match-end infra)

Shared primitives (built/owned outside cricket; gate each PR on their availability): `MonoSheet`, `blend-tokens` (frozen `src/index.css`), `line-divided-keypad` idiom, `cricketCalculations` util, `Convex-live-sync`, and the match-end trio `MonoMatchResult` / `Scorecard` / `ShareLiveMatch` (from the `match-result` stream). **C1 is the cricket foundation every later cricket PR depends on** (implied, not repeated). **Land C1 + C2 before any UI PR** so no surface ships an un-derived rate or an inline hex.

1. **C1 — Delivery engine + unified `innings[]` model + format/houseRules schema.** Retire flat `scores{}`; `deriveInnings`/`deriveChase` (sole rate+WP source); corrected bye/leg-bye `B` increment; wide-with-runs; `maxOversPerBowler`; run-out `out`+`end`; free-hit; strike; 100-deep undo; house rules incl. tennis-ball/box/last-man/no-LBW. Migrate existing scorers via an adapter. Tests = §1.2. *dependsOnShared: [cricketCalculations]* · effort L
2. **C2 — Cricket blend tokens + governance.** Add §6 tokens, unify the green family, reserve capsule radius, wire shared pulse; update `BLEND-GOVERNANCE.md`. *dependsOnShared: [blend-tokens]* · effort S
3. **C3 — Scorer hero + context header + ruleset chip + rate line + this-over strip.** deriveChase datum, DLS par slot, wide-with-runs chips, Last-5/Recent datum, count/pop numerals. *dependsOnShared: [MonoSheet, blend-tokens, C1, C2]* · effort M
4. **C4 — Line-divided keypad + pending-extra flow + strike/SWAP.** Converge all formats; extras run-grid; strike rotation + override. *dependsOnShared: [line-divided-keypad, C1, C3]* · effort M
5. **C5 — Batter/bowler cards + partnership + foreshadow + last-man layout.** Overs-remaining, over-quota guard surfaced, single-batter card. *dependsOnShared: [C1, C2, C3]* · effort M
6. **C6 — Wicket sheet + FoW + free-hit guard + run-out end selection + new-batter + end-of-over.** Quota-aware bowler picker. *dependsOnShared: [MonoSheet, C1, C4]* · effort M
7. **C7 — Spectator LIVE tab.** Freshness heartbeat (shared pulse), hero, this-over, WP bar+basis, mini-cards, soft-budget 3+1+1. Convex subscription. *dependsOnShared: [Convex-live-sync, MonoSheet, C1, C2, C3, C5]* · effort L
8. **C8 — Spectator SCORECARD + COMMENTARY.** Reuse `Scorecard`; itemized extras + FoW; commentary with over-summary lines + single `dismissalText()` shared with signature cards. *dependsOnShared: [Scorecard, C1, C7]* · effort M
9. **C9 — Signature layer 4.0–4.2.** Score pop, tiered four/six, wicket takeover; tokenized + reduced-motion gated. *dependsOnShared: [blend-tokens, C1, C3, C7]* · effort M
10. **C10 — Signature layer 4.3–4.5.** Milestone gold + share card (one-gold enforced), hat-trick held-breath, clutch-mode off `deriveChase()`. *dependsOnShared: [ShareLiveMatch, C9]* · effort M
11. **C11 — Momentum band + viz modules.** Flagship pressure line (neutral 50 dot, tokenized greens) + worm/manhattan/wagon/partnership, one open at a time. *dependsOnShared: [C1, C7]* · effort L
12. **C12 — Super Over + Match Complete + notifications.** Super Over decider layout (reuse state machine), Result/MVP payoff (reuse `MonoMatchResult`+`Share`), per-event/per-player notification toggles. *dependsOnShared: [MonoMatchResult, ShareLiveMatch, C1, C9]* · effort M
13. **C13 — Format/config UI: tennis-ball & box presets + house-rule toggles at setup.** Surfaces the C1 schema. *dependsOnShared: [C1]* · effort M

**Parallelization:** after C1+C2 land, C3→(C4,C5,C6) fan out; C7 gates on scorer components + Convex; C8/C11 gate on C7; C9→C10→C12 sequence the signature layer; C13 any time after C1.

---

## 8. Open decisions (need a product/design call)

1. **Saved-match migration.** Ball-by-ball can't be reconstructed from a flat `scores{}` aggregate. Cutover new matches only (legacy read-only via a shim) vs backfill-as-aggregate. Blocks C1.
2. **Win-probability model.** Heuristic (RRR gap × wickets-in-hand × venue chase-avg) with a stated basis vs a fitted table. Confirm formula + basis copy. Affects C7/C10.
3. **Momentum-band algorithm weighting.** Exact weights (run-rate delta vs dot-streak vs wicket vs required-rate gap) + smoothing. Needs a testable spec before C11.
4. **Clutch-mode threshold.** Is `≤24 off ≤12` right, or per-format (T20 vs ODI)? Affects C10.
5. **DLS depth.** Full Duckworth-Lewis-Stern tables vs the simplified par line under rain shown here. Licensing/complexity call.
6. **House-rule presets to ship first.** tennis-ball / box / last-man are modeled — which get first-class preset UI vs config-only at launch? Affects C13.
7. **Team logos/crests.** Deliberately omitted for brutalist purity (reduces at-a-glance legitimacy). Confirm the tradeoff or add a minimal crest slot.
8. **Test-format scope for the pilot.** Ship limited-overs first and defer 4-innings/follow-on/declaration/draw, or include now? Affects C1 breadth.
9. **Wagon-wheel capture cost.** Does the scorer tap shot `angle/dist` per boundary (extra taps vs richer viz)? Default = optional/deferred; confirm.

---

## 9. Anti-goals
Hardcoding 6-ball/LBW-on/11-a-side · un-derived rates on any surface · inline hex bypassing tokens · >1 gold per screen · capsule radius on read-only pills · a self-contradictory match state across surfaces · blocking celebrations that stall entry · crediting extras to batter/bowler on run-out · one generic boundary/wicket animation · stale updates · scorecard density on the spectator hero · merging scorer & spectator layouts · no undo/edit-last-ball.
