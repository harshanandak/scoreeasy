# ScoreEasy — Kabaddi Research (real-world scoring + live experience)

**Date:** 2026-07-26 · **Status:** RESEARCH (feeds the design brief; no code) · **ICP:** Indian college / university / school / ground scorers (casual dominates).
**Method inheritance:** follows the cricket exemplar — establish how the game is *truly* scored and *truly* broadcast in the wild, extract the operator's exact capture flow, name the main-scoreboard anatomy a viewer reads at a glance vs the richer broadcast layer, find where existing apps fail, and pin the drama beats + spatial layer worth building. *The record is brutalist, the conversation is soft.*

**Grounding sources used** (all fetched/searched 2026-07-26):
- overlays.uno — "How do you read a kabaddi scoreboard?" (broadcast/streaming overlay anatomy + rules). https://resources.overlays.uno/post/how-do-you-read-a-kabaddi-scoreboard
- kabaddi.eu — live web kabaddi scoreboard (a working operator tool: raider select, revival queue, game log, CSV/JSON export, circle-vs-rectangle rulesets, changelog). https://scoreboard.kabaddi.eu/
- Super Tackle — Kabaddi Scoring (iOS scorekeeper app; do-or-die + raid timer). https://apps.apple.com/app/id6759177481
- Pro Kabaddi official app (Star Sports) — Google Play reviews (stats/standings bugs). https://play.google.com/store/apps/details?id=com.starsports.prokabaddi
- prokabaddi.com — official stat/term definitions: Super Raid, Super 10. https://www.prokabaddi.com/features/what-is-a-super-raid
- AKFI (Amateur Kabaddi Federation of India). https://www.indiankabaddi.org/
- Other operator tools sighted: kabaddiscoreboard.com, "Kabaddi Scoreboard" by naoyaono (iOS/Android), KBDStars.

> **Headline finding:** the whole game is legible from *two numbers a viewer never has to compute*: **the two team scores** and **how many players each side has left on the mat** (7 → 0). Every real broadcast leads with those two facts and a 30s clock. Cricket's glance-unit is "runs/wickets · overs"; kabaddi's glance-unit is "**score · mat-strength (dolls) · raid clock**". That is the whole design north star and it confirms the brief's mat-strength doll as the signature record chip.

---

## 1. How the game truly works + the exact events an operator must capture

### 1.1 The truth of the game (standard mat / "rectangle" / Sanjeevani — the PKL/college/school game)
Two teams of **7 on the mat** (up to 5 subs, 12 squad). Play alternates in **raids**: one team sends **one raider** across the **midline** into the opponent half; the other 7 are **defenders (antis)**. The raider must (a) cross the **baulk line** before a touch counts, (b) touch defender(s) and/or cross the **bonus line**, and (c) get back across the midline without being tackled — historically in one breath (the continuous "kabaddi… kabaddi…" **cant**), now bounded by a **30-second raid clock**. A raid resolves into points for **exactly one side (or neither)**, players go **out** and are **revived** in the order they went out, and possession flips. (uno; standard AKFI/PKL rules.)

The emotional engine — and the thing no goals-tally can represent — is the **out/revive ledger**: every point you score **revives one of your own out players back onto the mat**, and reducing the opponent to **0 on the mat = ALL OUT** = the biggest swing in the game. Watching a side bleed from 7 dolls down to 1 is the drama; cricket has no analogue (it is closest to "wickets", but wickets don't come back).

### 1.2 Every scoring event the engine must model as a first-class outcome
Each resolves *one raid*. The scorer picks the outcome; **the engine does all the derived math** (revival, all-out, super-tackle, do-or-die penalty). Confirmed against uno + kabaddi.eu + PKL rules:

| Event | Points | Roster effect | Auto-detected? |
|---|---|---|---|
| **Touch (+N)** | +N to raiders | N defenders OUT; N raider out-players REVIVE (out-order) | N is entered; revival auto |
| **Bonus (+1)** | +1 to raiders | none | **eligibility auto** (only when defenders ≥ 6 on mat — some house rules 7-only) |
| **Tackle (+1)** | +1 to defenders | raider OUT; 1 defender out-player revives | — |
| **Super tackle (+1 extra, =2)** | +2 to defenders | raider OUT; revive 1 | **auto** from on-mat ≤ 3 at tackle |
| **Empty raid** | 0 | none | increments that side's consecutive-empty counter |
| **Do-or-die fail** | +1 to opponents | raider OUT | **engine-enforced** on the do-or-die raid |
| **All-out (+2)** | +2 to the side that emptied them | emptied side FULLY REVIVED (all 7 back) | **auto** from out-roster hitting 0 |
| **Technical / self-out (+1)** | +1 to other side | offender out where applicable | line-out, no-cant, illegal entry, lobby |
| **Super raid** (tag) | — (3+ pts in one raid) | — | celebration/stat tag, not a score |

**Ordering that must be locked in the engine** (real edge cases from live play):
- A single raid can be **multi-outcome**: e.g. a raider gets a **bonus + touches 2** = +3 and a Super Raid tag; the bonus and the touches are separate ledger components on one raid.
- **All-out can co-occur** with the touch that caused it: the touch points *and* the +2 all-out both land; then full revive. Lock: touch points → out-roster update → all-out check → +2 → full revive.
- **Do-or-die is stateful**: the engine (never the scorer) knows the raid is do-or-die and, on failure, applies raider-out + opponent +1 — an "empty" tap must be structurally impossible on a do-or-die raid.
- **Super-tackle uses on-mat count at the moment of the tackle** (≤3 defenders). Auto; never a separate tap.

### 1.3 Derived state the engine owns (the scorer must NEVER compute)
On-mat count per side · out-order queue per side (revival order) · consecutive-empty counter → do-or-die arm · super-tackle arm (≤3) · bonus arm (≥6) · all-out detect + full-revive · do-or-die fail penalty · half clock + **30s raid clock** · running score + point-type tally.

### 1.4 What is genuinely OUT OF SCOPE (confirmed by the wild)
- **Circle / Punjab / Amar / Gaminee kabaddi** is a *different game*: kabaddi.eu implements it separately as "1 point per raid, no player elimination, 4 stoppers vs 1 raider." Half-modelling it corrupts the standard engine. Flag as a future ruleset (the brief already does).
- **Pursuit** (a defender chasing a retreating raider across the midline to score — uno lists it) is a traditional/circle-flavoured element not used in the standard mat game; do not build it into the standard resolver.

---

## 2. How real scoreboards & broadcasts present it

### 2.1 THE MAIN SCOREBOARD — what a viewer reads in one glance
The PKL score bug (Star Sports, since 2014) and every serious operator tool converge on the **same five glance-facts**, bottom-of-screen, one horizontal bug:

1. **Two team panels** — team colour block + logo/abbreviation + **big score number** each. (The two scores are the primary reading.)
2. **Mat-strength indicator per team** — a **row of 7 player pips/dots** that **dim/empty as players go out** and re-light on revival. This is the single most kabaddi-specific bug element and the at-a-glance answer to "how close is an all-out?". *(This is exactly the brief's mat-strength doll; the real broadcast validates it as the record chip.)*
3. **Raid clock** — a **30s countdown** (ring or bar), centre of the bug, that turns red/flashes in the final seconds. kabaddi.eu shows it as a discrete "30" that **freezes at 0 for manual submission** rather than auto-scoring — a deliberate operator choice (advisory, not authority).
4. **Whose raid** — an arrow / highlight / "RAID" marker on the raiding team's panel. Possession is always visible.
5. **Match clock + half** — the running game time (e.g. 40:00 / halves), plus **timeouts remaining** and (in PKL) **review** indicators.

Everything a spectator needs to follow the match is in those five. Note kabaddi.eu's operator layout literally is: `Game Time 40:00` · raid `30` · `Select a Raider` · **Team A Players / Revival Queue** · **Team B Players / Revival Queue** · **Game Log** — i.e. score, clocks, on-mat roster, out-queue, and a running ledger. That is the minimum viable operator surface, in the wild, today.

### 2.2 THE RICHER BROADCAST LAYER (overlays over the bug)
Beyond the persistent bug, PKL/Star Sports fires **event overlays** — these are the drama beats and are the reference set for our spectator surface and signature moments:
- **Raider lower-third** — when a raid starts, a name card for the raider (and often his season raid-point tally) slides in.
- **Full-width event banners** — **SUPER RAID**, **SUPER TACKLE**, **ALL OUT**, **DO OR DIE**, and milestone stamps **SUPER 10** (raider hits 10 raid points in the match) and **HIGH 5** (defender hits 5 tackle points). These are the celebratory takeovers.
- **Do-or-die pre-raid banner** — the bug re-skins / a banner warns *before* the raid ("DO OR DIE RAID") so the viewer feels the stakes.
- **Empty-raid counter surfacing** — commentary/graphics track "2 empty raids" building toward do-or-die.
- **Post-match/half stat cards** — top raider, top defender, raid & tackle success %, points-by-type split.
- **Review graphics** — TV-umpire decision overlays (out-of-scope for our casual ICP, but part of the broadcast grammar).

**Design read:** the persistent bug is *the record* (hard, mono, glanceable — our brutalist layer). The event banners are *the conversation/celebration* (warm, animated, one-at-a-time — our soft layer + signature moments). This maps 1:1 onto the blend rubric.

---

## 3. India school / college / ground variants + what casual scorers actually need

### 3.1 The variants that are real (and drive presets)
- **Ruleset is uniformly standard mat kabaddi** across the ICP: KIUG/AIU inter-university, SGFI school, and Pro-style ground play all use 7-a-side, Sanjeevani revival, all-out +2, do-or-die, bonus line, 30s raid. One engine covers all three.
- **Duration is the biggest real variable.** Elite/college = 2×20. School & casual ground = routinely **2×10, 2×7, 2×15**, sometimes a **points-target** or **single half**. Half-length MUST be a preset field, never hardcoded. (uno confirms "duration can vary".)
- **Do-or-die trigger** — official = 3rd consecutive empty; **some school/ground circuits play 2 empties.** Configurable. (Note: uno phrases the official rule itself loosely as "two consecutive rounds → third" — evidence that even reference material blurs this, so the preset must make it explicit.)
- **Bonus-line eligibility** — official ≥6 defenders; some house rules require all 7 (kabaddi.eu literally implements "6 or 7"). Configurable.
- **Super-tackle value** — official +2 total; some local circuits give +1. Configurable, official default.
- **Technical/foul points** are frequently *ignored* by casual scorers. A "track fouls" toggle (default ON college, OFF for a quick school game) keeps jargon out of the hot path.
- **Subs** — casual games often ignore substitutions entirely; kabaddi.eu treats subs as an optional side action. Never a setup blocker.

### 3.2 What the casual scorer actually needs (vs pro)
The persona is a **PT teacher / student volunteer / coach**, scoring **one-handed on a phone in sun-glare beside a dusty mat, in noise, watching the mat not the screen.** Concretely they need:
- **Big scores + the two 7-doll rows + the raid clock**, glanceable at arm's length — nothing else must compete.
- A resolver that answers **only** "how did *this* raid end?" and is **structurally un-fumbleable** — the two commonest outcomes (a single touch; an empty raid) as **1-tap**, everything else one lean sub-step.
- **The engine to do every derived thing** (revive count, all-out +2, super-tackle, do-or-die penalty) and **narrate it in plain English** so a novice trusts it ("Touch on 2 — Raiders +2, 2 men back, Blue down to 4").
- **Always-visible Undo** and edit-last-raid — the reality of scoring in noise is mistakes.
- **No jargon they don't use**: "out of bounds / foul" not "lobby / cant / technical".

The pro/experienced scorer (a minority) wants the dense one-board fast lane — same engine, Power toggle (inherit cricket's Guided-default + Power-toggle decision exactly).

Today, the *actual fallback in the field is paper* — the AKFI score sheet or a notebook (search surfaced scorers "tired of manually noting scores on paper"). The opportunity is to be the thing that finally beats the notebook without the pro-tool learning curve.

---

## 4. GAPS — where existing kabaddi scoring apps fall short (the opportunity)

Kabaddi is **digitally underserved** — the tooling is a thin layer of hobbyist scoreboards plus one buggy official app. Concrete, sourced gaps:

1. **Operator-hostile web tools.** kabaddi.eu is the best free operator tool sighted and it is a **desktop-shaped web scoreboard** — landscape panels, click-a-player-card interaction, changelog dominated by "critical initialization bug prevented player cards rendering", "improved mobile landscape". It is *not* a one-thumb, sun-glare, phone-portrait resolver. **Nobody has built the thumb-first field console.**
2. **The math is often left to the human.** Many scoreboards let you click players out and increment scores but **don't auto-derive all-out +2, do-or-die enforcement, super-tackle, or revival order** — the operator still has to know the rules. Our engine-owns-the-math + plain-English narration is the differentiator (cf. the cricket exemplar's auto-math thesis).
3. **The official Pro Kabaddi app is consumption-only and buggy.** It is a fan/stats app, not a scorer, and its reviews flag broken stats, dead standings arrows, and non-working filters — i.e. even the flagship product under-delivers on *reading* the game, let alone scoring it. There is no credible official *grassroots scoring* product.
4. **No trustworthy shareable live link for a local match.** Cricket has CricHeroes; kabaddi has **no dominant "score your gully match, share a live link, get a real scorecard" product.** Local tournaments live on WhatsApp photos of paper sheets.
5. **Weak/absent post-match record.** Hobby scoreboards export a raw CSV/JSON game log (kabaddi.eu) but produce **no readable scorecard** — no per-player raid/bonus/tackle split, no Super-10/High-5 badges, no all-out timeline, no plain-language result. The record that a coach or league actually wants doesn't exist.
6. **No spatial/analytical layer at all.** Nothing at the grassroots level offers raid-path, tackle-position, or raid-outcome analysis — the "wagon-wheel moment" is completely open (see §5).
7. **Rule-variant rigidity.** Tools hardcode one duration/one do-or-die rule; they don't flex to 2×7 school halves or a 2-empty do-or-die circuit. Our preset system is a direct answer.

**Net:** the bar to beat is low on polish and thumb-ergonomics, and *wide open* on (a) engine-owns-the-rules trust, (b) a real shareable scorecard, and (c) any spatial analytics.

---

## 5. Moments that matter (signature animations) + the spatial tracking layer

### 5.1 Drama beats worth a signature animation (ranked by peak)
1. **ALL OUT — the peak of kabaddi.** A side hits 0 on the mat: opponents +2 and the emptied side re-lights all 7 dolls at once. This is the single biggest swing and deserves the gold-milestone-card treatment (one gold/screen): warm "ALL OUT · +2" banner + a **full-side re-light sweep** across the 7 dolls. Broadcast fires a full-width ALL OUT overlay — validated.
2. **SUPER RAID (3+ in one raid).** A raider single-handedly guts the defence — often the moment that *causes* an impending all-out. Lighter tag pulse + "SUPER RAID ×N" chip. (PKL treats it as a named stat.)
3. **DO-OR-DIE conversion (✓/✗).** Maximum-tension raid; the resolve either way is a beat. Pre-raid warning re-skin (warning band) → convert = light success pulse, fail = danger pulse + "opponents +1". Broadcast pre-warns with a DO OR DIE banner.
4. **SUPER TACKLE.** Defence wins against the odds (≤3 defenders) for +2 — the defenders' equivalent celebration; brief tag pulse.
5. **Milestone stamps — SUPER 10 / HIGH 5.** Raider hits 10 raid points / defender hits 5 tackle points in the match (PKL's on-air milestone graphics). Star-raider / star-defender chips on the spectator hero.

All ship reduced-motion gated; the mat-doll dim-on-out / re-light-on-revive micro-animation is the cheap always-on beat that carries the emotion between the big moments.

### 5.2 The spatial / positional layer — kabaddi's wagon-wheel candidate
Cricket's signature interactive data is the **wagon-wheel** (shot direction from tap-to-place). Kabaddi's analogue is **raid-path / mat-position tracking**, and it is completely unbuilt at the grassroots level — a genuine differentiator. Three candidate layers, in build-cost order:

1. **Raid-outcome heatmap (cheapest, no extra capture).** No tap-to-place needed — derive from data already captured: plot each raid as a cell on a raider×outcome or zone×outcome grid (touch / bonus / empty / out), coloured by frequency. Answers "where/how does this raider score, where does this defence stop raids?" Pure CSS grid, no library, ships like the cricket momentum band.
2. **Raid-path / mat-position tracking (the true wagon-wheel; tap-to-place, defer).** On a stylised mat diagram (midline, baulk lines, bonus line, lobbies), the scorer taps **where the raider went** and **which defender/zone was tagged** (left corner / cover / centre / right corner — the real defensive positions). Produces a per-raider "raid map" (attack direction tendency) and a per-defender/zone tackle map. This needs an extra tap-to-place capture step, so — exactly like cricket's shot-tracking — **defer behind an optional Power-mode enrichment**, with the field already in the raid model.
3. **All-out / super-raid takeover animation (spatial celebration).** The 7-doll row is itself a spatial object; the all-out sweep and the super-raid multi-out cascade are the animated payoff of the mat-position data. Ship the doll-row animation at launch; the full mat-diagram replay is future-flagged (heavy).

**Recommendation:** ship #1 (raid-outcome heatmap, free from existing data) at/near launch as the "kabaddi has analytics too" hook; model the raid-path fields now but **defer the tap-to-place capture (#2)** to a later wave, mirroring the cricket wagon decision precisely.

---

## 6. One-paragraph synthesis for the designer
Kabaddi reads off **score + mat-strength (7 dolls per side) + a 30s raid clock** — that trio is the entire glance-unit and every real broadcast leads with it, so the brutalist record is those three, hard and mono. The atomic capture unit is **resolving one raid** into one of ~8 outcomes while the engine silently owns all the roster math (revive order, all-out +2 + full revive, super-tackle, do-or-die enforcement, bonus/super eligibility) and narrates it in plain English. The field reality is a one-thumb phone in sun-glare and a paper notebook as the incumbent; existing digital tools are desktop-shaped, make the human do the rules, produce no readable scorecard, and offer zero spatial analytics — so the wins are (1) a thumb-first un-fumbleable resolver, (2) an engine that owns the rules + a trustworthy shareable scorecard, and (3) the first grassroots raid-analytics layer. The signature moment is **ALL OUT** (gold card + full-side doll re-light), with SUPER RAID, DO-OR-DIE, SUPER TACKLE, SUPER 10 / HIGH 5 as the supporting beats — every one of them a real PKL broadcast overlay.
