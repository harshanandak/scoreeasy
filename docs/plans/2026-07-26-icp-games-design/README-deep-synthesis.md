# ScoreEasy — Cross-Game SYSTEM (Deep Synthesis)

**Date:** 2026-07-26 · **Status:** DEEP SYNTHESIS — the buildable cross-game system distilled from the 7 locked `design-final.md` specs (kabaddi, volleyball, badminton, football, basketball, throwball, kho-kho) and `README-synthesis.md`. · **Design system:** design1-mono (brutalist shell × HiFi-blend), `BLEND-GOVERNANCE.md` FROZEN, cricket `blend-rubric.md` exemplar. **No new colours in any game.**

**What this document adds over `README-synthesis.md`.** The first synthesis proved the 7 games share one shell/engine shape and listed the divergences. This document makes it **buildable**: the exact DOM/`order` anatomy of the three make-or-break skeletons with each game's divergence slot named; the component + token contract as a checklist you build once; the two shared *mechanisms* — a moment-dispatcher and a tracking-capture engine — that every game re-skins rather than re-authors; the decide-once decisions with build-blocking flags; and a program-level build sequence that interleaves the shared substrate with a reuse-first, ICP-ordered game order.

**The one structural truth (restated, load-bearing).** Every game = `derive(log, format)` — a pure single-source-of-truth engine, 4–5 presentation surfaces reading off it and never recomputing. The log + format is the only persisted truth; LIFO undo and edit-past-replay-forward fall out of that. **All divergence between games is exactly two slots: (1) the scoring MODEL inside the engine, and (2) the primary-action verb set on the scorer.** Everything else — skeletons, tokens, components, the moment engine, the tracking engine, the share loop — is shared and built once.

---

## (a) The three shared skeletons — anatomy + per-game divergence slot

Every game ships the same surfaces. Three are make-or-break and specified here to DOM/`order` precision; the setup and handoff surfaces are covered in (b)/(d). The skeleton is **identical**; only the marked slot changes per game.

### Skeleton A — MAIN SCOREBOARD (Screen 3, the glance record)

Two densities off one component, same bindings: **State A** = compact bug (DEFAULT — the pinned scorer hero *and* the WhatsApp thumbnail, ~64–140px flat-black card, source of truth); **State B** = fuller stadium/cast hero (scores 3–4rem, honest-fallback extras only, may take the screen's single inversion).

**Read-order contract (fixed by the real world, top of hierarchy first):**
1. **The dominant quantity** — mono tabular, largest by 3–4×, leader carries `--se-blend-green-wash`. *Divergence slot 1: how many tier-1 numerals.*
2. **Team identity** — 3-char mono caps code (`team.code ?? name.slice(0,3)`) + optional colour pip. Never a colour fill (green is reserved).
3. **The match-state record strip** — small but NEVER omitted; the *actual* series/period state. *Divergence slot 2: the strip's slot type.*
4. **Possession / serve / role marker** — green glyph on the active side, flips on the derived event. *Divergence slot 3: prominence (silent → central).*
5. **ONE context/phase line** — precedence-ordered, **never stacked**, escalation-ladder tint. *Divergence slot 4: the phase vocabulary.*

**Banned on the board (identical across all 7):** the feed/log, momentum/charts *on the card*, per-player rows (max: two State-B star chips), a second colour/gradient/VS badge, both sides green, action buttons, stacked context lines, decorative motion. *Test: readable across the court in under a second, and true right now?*

| Game | 1 · tier-1 numeral(s) | 3 · record strip | 4 · marker prominence | 5 · phase vocabulary |
|---|---|---|---|---|
| Volleyball / Throwball | 2 set scores | set-box strip + sets pips | derived, silent (Fed: serve `▸`) | `MATCH PT ▸ SET PT ▸ DEUCE ▸ SET n` |
| Badminton | 2 game scores | games pips `■ □` | **central** — serve 🏸 + court `R`/`L` | `+ GAME PT ▸ MATCH PT ▸ CHANGE ENDS ▸ SUDDEN PT` |
| Basketball | 2 scores + BONUS stamp | quarter line-score + timeout pips | (possession arrow CUT for launch) | `Q3 / HALF / OT / FINAL` or `→21` |
| Football | 2 scores + count-up clock | (timeline lives on spectator) | `⑩` short-handed on send-off | `H2 67:14 / HT / FT / +N` + `13 MIN LEFT` |
| Kabaddi | 2 scores **+ raid clock (co-hero)** | **7 mat-strength dolls/side** | green wash + `RAID ▸` (flips every raid) | `H1 08:12 → DO-OR-DIE → ALL OUT` |
| Kho-Kho | **2 cumulative totals + turn clock (co-hero)** | batch dots `● ● ○` + `RECYCLE ×n` | `ATTACK/DEF` role tag + green wash | `TURN 3/4 · GUJARAT CHASING · 03:12` |

### Skeleton B — LEAN SCORER (Screen 2, the make-or-break input console)

One column, `max-width:390px`, `100dvh + env(safe-area-inset-bottom)`, **CSS `order` top→bottom, most-tapped pinned lowest in the thumb arc.** Press physics only (≈120ms flat `--accent` flash, `:active` translate + shadow-collapse); **no modal, no confirm, no second tap on the primary**; Undo permanent.

**Shared vertical spine:**
1. `order:0` **top bar** — chrome (back · title+phase · `● LIVE` · `⋯ More`); rarest reach.
2. `order:1` **pinned read-only hero** — State-A mirror, **inert, never tapped**, the operator's truth-check.
3. `order:2` *(optional micro-strip)* — glance state the *scorer* needs that the board under-surfaces. *Game slot.*
4. `order:3` **last-event narration + permanent `↩ Undo`** — plain-English "what just happened", one-tap LIFO reverse of the event *and everything it derived*.
5. `order:4` *(optional clock bar / handoff-banner slot)* — empty except at breaks; **becomes the inline handoff prompt in place**, never a screen. *Game slot.*
6. `order:5` **rare/secondary strip** — one hairline tier *visibly below* the primary (ghost weight).
7. `order:6` **PRIMARY ACTION ZONE** — the thumb arc, biggest key lowest, keys ≥58px `clamp(58px,11vh,74px)`, borderless soft keys over one hard grid. *Divergence slot — the verb set.*
8. `order:7` **quiet footer** — `Full scorecard ›` · `Share live ↗` (leave-console links).

Every scorer is **Guided (default) + a second mode toggle** (per-device); both write the identical engine event stream — the toggle changes *ceremony/density, never rules* (see decide-once #4).

| Game | Anti-fumble device | PRIMARY verb set (`order:6`) | Rare strip (`order:5`) | micro/clock slot |
|---|---|---|---|---|
| Volleyball / Throwball | own-half geometry | two giant **Point→Team** targets (½-width) | (Fed/Quick only: serve/fault/timeout) | — |
| Badminton | left button = umpire's-left court, **swaps on change-ends** | two arena tap-zones + serve/court readout | `Let` (muted in Count-only) | change-ends banner |
| Basketball | mirrored self-contained columns | **value keypad** — `+2` huge (5×5) / **`+1 INSIDE` huge (3×3)**; `+3`/`+2` secondary; **pad reshapes by fork** | `FOUL · T/O` per team | foul/BONUS micro-strip |
| Football | home-left / away-right | two **GOAL** keys → **deferrable inline attribution row** | `🟨 Card · ⇄ Sub · ⋯` | **clock bar** (pause/stoppage/handoff) |
| Kabaddi | **semantic, never team-picked** | **Big-4** `TOUCH · TACKLE · BONUS · EMPTY` | `MULTI (2·3·4·5 +Bonus) · SELF-OUT` | raid clock (auto, display-only) |
| Kho-Kho | single event, no team choice | **Big-1** — one giant `OUT +1` | `NEXT 3 IN · NAME DEFENDER` | tap-to-pause **turn clock co-primary** |

*The verb set spans Big-1 → Big-2 → Big-4 semantic → value-keypad → Big-2 + fast-follow attribution. That range is the entire scorer-divergence surface of the program.*

### Skeleton C — LIVE / SPECTATOR (Screen 3B→4, the free watch)

Hero pinned (State B, never redraws on tab switch) + capsule segmented tabs (`LIVE` default · a record tab · `STATS`/`INFO`). **LIVE-tab DOM stack (glance-order = DOM order):**
1. **hero board** (fixed).
2. **NOW-strip** — the game's plain-English "right now". *Game slot.*
3. **MOMENTUM** — collapsed `<details>`, **CSS-only semantic bars, no library, no axes**, summary line carries the live run.
4. **KEY-MOMENTS feed** — auto from log, newest-first, **elevation/token-typed** (notable = soft card + hard stamp; ordinary = bare row), ~3–6 visible; the only scroll region.
5. **presence footer** — `👁 watching` + Follow (count at launch; reactions/bursts = realtime FUTURE).

**Divergence:** the NOW-strip content, the momentum *semantics*, the record-tab identity (the tracking-layer home), and the one peak moment.

| Game | NOW-strip | Momentum semantics | Record tab |
|---|---|---|---|
| Volleyball / Throwball | serve · streak · last-point shape | point-run worm | Sets |
| Badminton | `SERVING · Sharma · from the RIGHT box` | per-game run bars | **Court** (service-court view) |
| Basketball | top 2–3 scorers + on-floor count | run / lead-change / biggest-lead strip | **Box** |
| Football | scorers · on-pitch `⑩` · last subs | *(momentum CUT — sparse ledger)* | **Timeline** |
| Kabaddi | live raider tally + key defender | net-points-swing per 2-min window | **Raid Map** |
| Kho-Kho | active chaser tag-count + batch survival timers | outs/minute bars + **chase equation** | **Chase Map** |

**Mandatory 5th surface — HANDOFF** (turn/set/period games): set end-switch, deciding-set-8, period advance, half-time/stoppage, turn-break/role-swap, all-out. **Same pattern every time:** full-screen **soft** step (canvas → `--se-color-surface-warm`), hero pinned, confirmation-echo restating state, single outcome-naming CTA, **no modal**. Zero-tap where the engine can (kabaddi possession flip, do-or-die arm, all-out); one-tap only at genuine breaks. Only single-set-to-N knockouts skip it.

---

## (b) Shared component + token contract — build ONCE, theme per game

### Token laws (universal, non-negotiable, verbatim from cricket/mono — no raw hex)
- **Green** (`--se-color-action`, `--se-blend-green-wash`) = **lead / live / possession / primary-action ONLY**. Never behind a losing / defensive / out / foul / tackle state.
- **Gold** (`--se-blend-gold`) = **exactly one milestone per screen** (result / POTM / all-out / dream-run / player milestone). Verify it resolves to the inherited cricket inversion token *before* any game builds its peak — if it isn't in the frozen blend, it doesn't ship.
- **The escalation ladder is the ONLY state encoding:** `neutral → --se-color-warning-soft/warning → --se-color-danger-soft/danger → single inversion`. Every state across all 7 games rides this one ladder — deuce, set/game/match point, do-or-die, bonus crossing, foul-trouble→foul-out, red card, late-winner, final-minute chase. **Never a new hue, glow, or text-shadow for state.**
- **Per-screen hardness budget:** 1 hard border + 1 hard shadow (outer shell only — repeating a frame on an inner card is the "triple-frame" violation), ≤3 soft surfaces, ≤1 gold, ≤1 glow (primary CTA / result only), ≤1 inversion, ≤1 live pulse.
- **Type law:** every quantity is mono tabular; **player/team names are sans, sentence-case, ≥12px — never uppercase a human**; status stamps are ≤3-word uppercase-mono.
- **Motion law:** `--se-motion-standard`, `prefers-reduced-motion` gated (state/tint still applies instantly, only the transition is removed); press physics is the only *control* motion; the one pulse is reserved for genuine live.

### Component library (12 primitives — parametrized, not re-authored)
1. **`RecordStrip`** — the over-strip generalisation; **highest-reuse component, every game needs it and every brief re-specs it → build it first.** Slot grammar: completed = filled semantic, current = outlined, future = **dashed hairline slot** ("always render all slots"). Parametrized by slot type: set-box / games-pip / quarter-line-score / minute-timeline / mat-doll / batch-dot.
2. **`ScoreHero`** — mono tabular numerals in a `--se-blend-green-wash` soft-radius container **with no hard border of its own** (shell carries the one frame). Optional possession-marker slot (per-game prominence prop, decide-once #6). Supports co-hero clock (kabaddi/kho-kho).
3. **`ThumbKeypad`** — borderless soft keys over a hard grid, ≥58px, press physics. Parametrized by the verb set (Big-1 / Big-2 / Big-4 semantic / value-keypad / GOAL+attribution). Handles fork-reshape (basketball 5×5↔3×3).
4. **`Undo`** — surface-warm LIFO square, permanent, reverses the last event *and everything it derived* (serve/set-close/send-off/revive/all-out).
5. **`PresetSetup`** — named preset cards + progressive-disclosure custom toggles + **plain-English confirmation-echo** + outcome-naming CTA. Roster always optional; two-team-names-→-Start is the minimum path everywhere.
6. **`HandoffScreen`** — full-screen soft canvas-warm decision, hero pinned, restate + one outcome-naming CTA, no modal.
7. **`MomentumBand`** — CSS-only semantic bars, no library, no axes; per-game semantic prop.
8. **`EventFeed`** — elevation/token-typed rows (bare tick vs soft card + hard stamp); auto from log, no tagging.
9. **`GoldMilestoneCard`** — 2px `--se-blend-gold` + `3px 3px 0` ink shadow, soft interior, **sans headline + mono figures line** (never an uppercase-mono headline).
10. **`SpectatorShell`** — capsule tabs, presence + reaction primitives, single live pulse, honest-fallback rows (roster-less / clock-off simply don't render — no empty scaffolding).
11. **`MatchResult` trio** — `MonoMatchResult` / `Scorecard` / `Share` (reuse cricket's; plain-English margin, draw first-class where valid, 1080×1080 branded card).
12. **`ModeToggle`** — Guided default ↔ second mode, per-device, one engine underneath.

### Engine contract (shared shape, per-game brain)
`derive(log, format)` pure fn · UI reads only · LIFO undo + edit-past replay-forward · **log + format = the only persisted truth** · schema-complete up front (fold all breadth now — reserve enrichment fields even when the default preset uses a fraction — so the model never churns). **Two generic tournament wrappers stay unchanged:** `GenericSetsTournament` (sets games) and `GenericGoalsTournament` / points-standings (football, basketball, kabaddi, kho-kho each feed a single integer per match). Only the *match interior* is bespoke.

---

## (c) The two shared mechanisms — one engine, many game-skins

The deep read shows the "innovation" surfaces are not per-game inventions — they are **two shared engines**, each parametrized by a game-skin.

### Mechanism 1 — the MOMENT DISPATCHER (signature moments)
Every game ships 5–7 signature beats; across all 7 they are the *same machine*:
- **Named-token gated** — each beat is a `--moment-*` / `--se-*` token; you cannot add a beat without adding a token (the governance choke point).
- **Engine-fired on a derived trigger** — never operator-tagged. The dispatcher reads derived flags (`isSetPoint`, `isMatchPoint`, `activeRun`, `ALL_OUT`, dream-run-threshold, send-off) and emits.
- **Reduced-motion-gated** — the state/tint applies instantly; only the transition is removed.
- **Queued, never stacked** — ≤2 beats/event, **gold always last**; the feed absorbs the overflow as static stamps.
- **Budget-bound** — one live pulse, one gold/inversion, no second hue; the escalation ladder *is* the encoding.

The 5–7 beats every game defines map to **one shared taxonomy** (the skin picks the trigger + label + glyph):

| Beat archetype | Motion signature | Volleyball | Badminton | Basketball | Football | Kabaddi | Kho-Kho |
|---|---|---|---|---|---|---|---|
| **Escalation-state** (rides ladder, mostly a state-hold, no motion) | tint-in | SET/MATCH PT, DEUCE | GAME/MATCH PT, DEUCE·cap | BONUS crossing, foul-trouble→foul-out | Red / send-off, late-winner | DO-OR-DIE, super-tackle | final-turn chase eqn |
| **Run / momentum flare** (subtle, feed + bar step) | width-grow | point-run ≥5 | streak `6 in a row ▲` | scoring-run / lead-change | *(cut — sparse)* | super-raid | outs/min swing |
| **Possession / turn takeover** (lightest, most frequent) | translate/slide | side-out | **serve hand-over (shuttle glide)** | — | — | possession flip | role swap / turn takeover |
| **Record beat** (one soft slide + feed prepend) | 150–220ms slide | SET WON | GAME WON (green sweep) | made three / buzzer | **the Goal** takeover | — | LONA / all-out |
| **The GOLD peak** (one per screen, once) | scale-in | MATCH WON | MATCH WON | player milestone / final | Final whistle / hat-trick | **ALL-OUT** | **dream-run threshold** |

**Build implication:** one dispatcher + one token registry + one reduced-motion wrapper; each game supplies a trigger→beat map. Do not hand-author 40 animations.

### Mechanism 2 — the TRACKING-CAPTURE engine (interactive tracking)
Every game's "wagon-wheel analogue" is the same two-tier machine:

- **Tier 1 — EASY-NOW, zero-capture (ships at launch).** Pure derivation from the event log; no operator taps. This is the *free drama* layer and the highest-value-per-cost viz — build it first, always. Skins: momentum worm / point-run (sets), run+lead tracker + foul-trouble board (basketball), the Timeline (football), outcome-mix analytics (kabaddi), Survival-Timeline Gantt (kho-kho). One engine reading the log; the skin is *which dimension it renders*.
- **Tier 2 — FUTURE / on-demand tap-to-place (deferred, opt-in).** The spatial capture. **Identical gesture grammar in all 7:** OFF by default → one setup toggle → after a *committed, already-scored* event a slim dismissible sheet slides up (**never over the primary keys' airspace, never blocking**) → tap the court schematic once, **snap to a named zone** (operator never types a zone) → writes one enrichment record on a **schema field reserved now** (`zone`/`shotZone`/`attackZone`/tag-spot) so it bolts on with **no engine migration** → feeds heat maps in the record tab. `Skip` is always one tap and loses nothing. Skins: 6-zone court (volleyball/throwball), winning-shot zone (badminton), shot-chart (basketball), goal-location pitch map (football), raid-path/mat-zone (kabaddi), chase-map tag-spot (kho-kho). Court schematic + zone vocabulary are the only per-game parameters.

**Build implication:** one capture-sheet shell + one snap-to-zone classifier + one enrichment-write path + one heat-render; each game supplies a schematic and a zone list. The reserved schema field is a **decide-once, do-now** item even though Tier-2 ships late.

---

## (d) Decide-ONCE decisions to lock before build (build-blocking flagged 🔒)

Every brief carries these as its own open question — decide globally, not 7 times.

1. 🔒 **ONE shared SET engine, not three.** Volleyball, throwball, badminton each spec their own `deriveSet` with identical win-by-2 / cap / deciding-target logic. **Highest drift risk in the program** — mandate one shared engine (Layer-0 below) or the three diverge.
2. 🔒 **Offline / persistence boundary.** Every sets/football brief defers to "cricket's open decision"; **kabaddi and kho-kho make offline-first + resume-interrupted-match LAUNCH CORE.** Lock: **v1 = offline single authoritative-scorer device + static share; op-log multi-device merge = FUTURE.** This also fixes the launch-vs-Phase-2 line for spectator realtime.
3. 🔒 **Rule numbers are preset config, never memory literals.** Every brief flags "never hardcode FIVB/BWF numbers"; kho-kho explicitly flags dream-run threshold + dive values as *disputed across sources — confirm against the current rulebook at build*. Lock: all targets/caps/thresholds/values live in the `Format`/preset object, confirmed against the current season's rulebook, never as code literals.
4. 🔒 **Mode vocabulary — resolve the two-axis confusion.** Two *different* second modes hide under inconsistent names: (a) a **ceremony axis** — Guided (confirm-carded) ↔ a lean mode that strips *confirmations only, never the brain* (called "Quick" in volleyball/basketball/football/throwball, "Power" in kabaddi/kho-kho); and (b) badminton's **Count-only**, which strips the *derived-engine display* (mutes serve/court/rotation) — a genuine reduction, not the same thing. Lock: **one name for the ceremony axis everywhere** (recommend *Guided default ↔ Detailed/Power*), and treat Count-only as a badminton-specific engine-mute, documented as such — not the general toggle.
5. **Handoff skippability.** Volleyball asks "force end-switch or auto-skip?"; others assume mandatory. Lock: **mandatory-but-fast, skippable-per-preset** for casual formats (kho-kho/kabaddi turn/half breaks stay one-tap; clocks never force-end).
6. **Serve/possession marker prominence.** Badminton makes it central (serve + court R/L), throwball demotes it to spectator-only under rally scoring, volleyball derives it silently, kabaddi/kho-kho make it a role tag. Lock: **one `possessionMarker` component with a per-game prominence prop** (silent → glyph → central-with-court).
7. **Clock authority — advisory, never enforcing.** Raid-clock, shot-clock, turn-clock, football match-clock all ask "advisory or enforcing?". Lock (already converging): **clocks are display/advisory, auto-run where natural, never auto-score, never force-end; the operator confirms transitions.**
8. **Roster-optional + quick-add-mid-match.** All agree roster is optional; football (`?Unknown #—`), basketball (back-fill), kabaddi (placeholder), kho-kho (name-never-gates) each spec it separately. Lock: **one quick-add / graceful-degrade pattern; every screen is roster-less-safe** (result + team derivations always render; player rows simply don't).
9. **Per-player stat depth for v1.** All defer attribution to formal/detailed. Lock one line: **v1 ships team-level derivations; per-player is opt-in behind a roster + Detailed mode**, everywhere.
10. **Points-standing + tie-break for the bespoke games.** Kabaddi and kho-kho feed a points standing with a single integer per match. Lock: **confirm `GenericGoalsTournament`/points-standings accepts it, and lock tie-break defaults** (kho-kho especially: fewest defenders lost / least time conceded).
11. **Crest vs initial in the header.** Inherited-unresolved from cricket Wave-0; football uses an initial squircle, kabaddi/throwball defer. Lock once for the shared `ScoreHero`.
12. **Growth-loop boundary = static-render + 1080×1080 card, on-device.** Every game's share loop is a read-only static render of the live screen + a branded card, no server. Networked spectator (reactions, presence bursts, QR-to-watch, follow/notify) is uniformly FUTURE (needs realtime/identity infra). Lock this as the launch/Phase-2 seam so no game half-builds realtime.

---

## (e) Build sequence — reuse-first, ICP-value-ordered

**Principle:** build the shared substrate once, then harvest the games in **reuse-ascending / ICP-value-descending** order — the sets cluster (one engine → 3 games) first, then the typed-counter games, then the two bespoke-model engines last. Net-new logic grows monotonically down the list; the highest-ICP, highest-reuse rally sports ship first.

### LAYER 0 — Shared substrate (before any game ships; this is the whole program's leverage)
- Lock the 12 decide-once decisions (esp. 🔒 1–4).
- **Token contract** wired to the frozen blend (verify the gold/inversion token exists — decision #1-gold).
- **12-primitive component library** — build `RecordStrip` first (highest reuse), then `ScoreHero` / `ThumbKeypad` / `Undo` / `PresetSetup` / `HandoffScreen` / `MomentumBand` / `EventFeed` / `GoldMilestoneCard` / `SpectatorShell` / `MatchResult` trio / `ModeToggle`.
- **Moment dispatcher** + token registry + reduced-motion wrapper (Mechanism 1, empty of game maps).
- **Tracking-capture scaffold** — reserved enrichment schema field + capture-sheet shell + snap-to-zone classifier + heat-render (Mechanism 2, Tier-1 derivation path live, Tier-2 gesture deferred).
- **`GenericSetsTournament` + `GenericGoalsTournament`/points-standings** wrappers confirmed (decision #10).

### CLUSTER 1 — the SETS cluster (ONE rally-point SET engine → 3 games; biggest leverage, highest ICP)
- **1. Shared SET engine** — `Format`, rally/point log, `deriveSet`/`deriveMatch`, all flags, win-by-2 + cap + per-set/deciding target + best-of-N + single-set(bo1) + serve/side-out derive. Unit-tested against FIVB/BWF + every preset. *Do NOT build three engines (🔒 #1).*
- **2. Volleyball** — highest-value rally sport; validates the engine; adds rotation (formal), timeouts, **end-switch + deciding-set-8 handoff**. Full vertical: engine → board State A → lean scorer → setup → State B spectator + moments → scorecard → share.
- **3. Throwball** — near-free on the SET engine (volleyball minus rotation, simpler serve); women's staple, high ICP. Themed skin only.
- **4. Badminton** — SET engine + the one genuinely new derived layer: **serve + service-court (R/L) parity + doubles rotation** (the hardest rule, test-first exhaustive) + change-ends-at-11. Court tab = the always-on signature.

### CLUSTER 2 — the typed-counter games (themed counter / attribution; reuse shell, own brain)
- **5. Basketball** — typed `1/2/3` events + **5×5↔3×3 fork** (keypad reshape; the fixed `+1 INSIDE`-huge 3×3 layout) + periods + team-foul→bonus + player-foul-out. A themed points counter, not a new possession model. 3×3 is the college-fest default.
- **6. Football** — **event-attribution engine** (the team score is *never* a raw input): goals-with-attribution (deferrable, `?Unknown` never blocks), own-goal + 2nd-yellow→send-off structural semantics, subs+minutes, clock lifecycle (halves/stoppage/ET/shootout). Deep but very high ICP. The Timeline is its only Tier-1 tracking layer (momentum cut — sparse ledger).

### CLUSTER 3 — the bespoke-model games (genuinely new possession/turn engine; built last)
- **7. Kabaddi** — the **raid engine**: out/revive queues, do-or-die, all-out +2 + full revive, super-tackle, point taxonomy, locked resolution order; semantic Big-4 (never team-picked); **offline-first + resume launch-core**; Tier-1 outcome-mix analytics free.
- **8. Kho-Kho** — the **turn engine**: chaser/defender roles, batch-of-3 recycle, cross-turn cumulative summation, dream-run survival timers, chase equation; Big-1 OUT + tap-to-pause clock; Survival-Timeline Gantt free. India-native, narrowest reach but culturally strong, most net-new after cricket.

**One-line rationale:** items 1–4 share a single engine (the program's largest reuse win and its highest-ICP rally sports); 5–6 reuse the whole shell but need bespoke counter/attribution brains; 7–8 are the two genuinely new mental models the generic tally cannot represent, so they carry the most net-new engine work and belong last. Every game within a cluster is independently demoable; nothing after each game's setup step gates a working scored match.
