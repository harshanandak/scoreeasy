# ScoreEasy — Kho-Kho Real-World Research

**Date:** 2026-07-26 · **Status:** RESEARCH (feeds `design-brief.md`) · **Market:** Indian school / college / university / open-ground scorers
**Method:** cricket exemplar — research *how the sport is actually scored and broadcast in the real world* before designing the surface. This document is the evidence base; the brief is the design decision.

> **Reading note:** every numeric rule below is cited. Where live-league sources disagree on a point value (they do — the Ultimate Kho Kho rulebook changes season to season), the conflict is flagged. **Verify point values against the current season's rulebook at build time; never hardcode from memory.** (Brief §9.8.)

---

## 1. How the game truly works + the exact events an operator must capture

### 1.1 The shape of the game (the mental model)
Kho-Kho is a **turn-based, time-bounded, chase-and-tag** sport. Two teams of 12, **9 on the field** at a time ([The Bridge](https://thebridge.in/kho-kho/kho-kho-rules-scoring-format-51531)). In each **turn**, one team **attacks (chases)** and the other **defends (runs)**. **Traditionally only the chasing team scores** — one point per defender put OUT. Roles swap; **match winner = higher total points summed across all your attacking turns.** This is cricket's "two innings, compare totals" shape, but the *scoring* side is the *fielding* side.

- **On the field:** 8 chasers seated alternately in the central-lane boxes, all facing alternate directions; **1 "active chaser"** starts the pursuit from a pole/free zone. Defenders enter as **batches of 3** ([The Bridge](https://thebridge.in/kho-kho/kho-kho-rules-scoring-format-51531)).
- **Field:** rectangular, **27 m × 16 m** (traditional; league/World Cup uses an indoor mat of similar dimensions), a central lane with 8 cross-lanes and a **pole at each end** ([The Bridge](https://thebridge.in/kho-kho/kho-kho-rules-scoring-format-51531)).
- **The chase mechanics are refereeing, not scoring.** The active chaser may **not reverse direction** (direction lock), may **cross only at the poles**, and to change direction/hand off must give a **"Kho"** (tag-in) to a seated teammate. An attacker who tags the last defender of a batch **cannot continue** — he must Kho a teammate to chase the new batch ([Olympics.com via search](https://www.olympics.com/en/news/kho-kho-history-rules-how-to-play)). **The app must not adjudicate any of this.** Kho-count / active-chaser is *optional stats* at most.

### 1.2 The exact events an operator must capture
| Event | What it is | Data to log | Frequency |
|---|---|---|---|
| **OUT** (the atom) | Active chaser tags a defender (by hand, no violation) **or** defender leaves the limits/loses ground contact | `defenderId?`, `atClock`, `outType` (league), `chaserId?` | Every few seconds in a hot turn |
| **Batch feed** | 3rd defender of a batch is out → next 3 enter automatically | new batch entering; decrement/reset the 3-dot tracker | Every ~3 outs |
| **All-out / "Lona"** | Whole defending side out **before the clock ends** → order **recycles from the top** and keeps feeding; the turn does **not** end early | `lona=true` flag (prestige stat, **no points**) | Rare, high-drama |
| **Turn clock** | Continuous countdown; **the clock is the chase equation.** Play stops for injuries/reviews | start / pause; turn length | Per turn |
| **Turn end → role swap** | Clock hits 0 → finalize turn points → chaser⇄defender swap → next turn | finalize + swap + arm | 4× per match |
| **Dream Run** (survival) | A defender/batch surviving a long unbroken spell | per-defender survival time; threshold crossings | Continuous derive |

**Traditional match structure:** 2 innings; **each innings = 2 turns** (each team attacks once, defends once) → **4 turns total.** Turn length **9 min** traditional; **7 min** at the Kho Kho World Cup ([The Bridge](https://thebridge.in/kho-kho/kho-kho-rules-scoring-format-51531), [The Bridge / Wazir](https://thebridge.in/kho-kho/kho-kho-world-cup-2025-wazir-other-rules-51551)). **2-min interval between turns, 3-min break between innings** ([Olympics.com via search](https://www.olympics.com/en/news/kho-kho-history-rules-how-to-play)).

**Cricket-like tactical rules (traditional):** a team may **declare** a turn early with a big lead; and a **follow-on** exists — lead by **6+ after the first innings** and you can make the opponent chase again ([The Bridge](https://thebridge.in/kho-kho/kho-kho-rules-scoring-format-51531)). These are *edge toggles*, not core to a college scorer, but the model should not preclude them.

### 1.3 Ultimate Kho Kho (league) scoring — the "Power" preset
The league re-engineered scoring for TV. Current (Season 2 onward) values, **flagged because sources disagree**:
- **Touch (ordinary tag) = 2 points.** Every successful out is 2, not 1 ([News9 via search](https://www.news9live.com/sports/others-sports/kho-kho-world-cup-rules-know-everything-about-wazir-dream-run-turns-point-system-2796507)).
- **Pole Dive = 3, Sky Dive = 3** — chaser tags while a defender is at the pole (Pole Dive) or the chaser lands the touch mid-air (Sky Dive). *Sportskeeda S2 rule-change explicitly says "three points each for the pole dive and the sky dive"* ([Sportskeeda S2](https://www.sportskeeda.com/kho-kho/ultimate-kho-kho-season-2-list-rules-changed-previous-season-ukk-2023)). **Conflict:** [myKhel](https://www.mykhel.com/more-sports/ultimate-kho-kho-know-all-about-the-rules-and-points-system-key-terms-253507.html) states "2 points each" for tag/pole/sky. Treat **Touch 2 / Pole Dive 3 / Sky Dive 3** as the working league default, **confirm at build.**
- **Dream Run (defender-team points, league only):** a batch/lone defender surviving **3 minutes** → defending team **+1**, then **+1 for every additional 30 s** until out or turn ends ([The Bridge / Wazir](https://thebridge.in/kho-kho/kho-kho-world-cup-2025-wazir-other-rules-51551), [Sportskeeda S2](https://www.sportskeeda.com/kho-kho/ultimate-kho-kho-season-2-list-rules-changed-previous-season-ukk-2023)). **Season-1 threshold was 2.5 min → changed to 3 min.** A lone survivor after two batchmates are out **can still** trigger it.
- **Wazir:** an attacker in a **different jersey** who **can change direction** (others can't); cannot cross the central lane; same point value on a tag. **Powerplay:** two Wazirs active at once until the batch's 3 defenders are out ([Sportskeeda S2](https://www.sportskeeda.com/kho-kho/ultimate-kho-kho-season-2-list-rules-changed-previous-season-ukk-2023)).
- **Reviews:** 1 per team per innings (2 per match). **Cards:** yellow (warning) / red (suspension).
- **League standings points** (a table concern, not a match concern): **win 3, tie 2 each, losing by <3-point margin earns 1** ([Sportskeeda S2](https://www.sportskeeda.com/kho-kho/ultimate-kho-kho-season-2-list-rules-changed-previous-season-ukk-2023)).

---

## 2. How real scoreboards / broadcasts present it

### 2.1 The MAIN SCOREBOARD — what a viewer reads at a glance (in priority order)
The stadium LED and TV score bug on Star Sports / DD / Disney+ Hotstar (Kho Kho World Cup 2025; Ultimate Kho Kho) reduce to a small, fixed set of glanceable facts — this is the anatomy the app's hero must mirror:

1. **Two team names/crests + running CUMULATIVE totals** — big, side by side (e.g. **"GUJARAT 31 — 26 CHENNAI"**). This is the number that decides the match; it persists across all four turns.
2. **The big turn countdown clock** — the single most-watched element; the whole turn is a race against it.
3. **ATTACK / DEFENCE state** — *who is chasing right now.* On broadcast the attacking team's row is highlighted / carries an "ATTACK" tag. Without this, the score is unreadable, because only the chaser is scoring (traditional) and the roles flip every turn.
4. **Turn indicator** — "Turn 3 of 4" / innings marker.
5. **Defenders-on-mat / batch state** — how many of the current 3 remain.
6. **The dream-run timer** — a live elapsed clock on the surviving defender(s), climbing toward the 3-min threshold.

**The at-a-glance read is therefore four facts, not two:** *cumulative totals · turn clock · who's attacking · defenders left.* A generic two-number scoreboard cannot express #3–#6.

### 2.2 Richer broadcast overlays (the layer above the bug)
- **Active-chaser lower-third** with live **tag count** ("Sanket Kadam — 3 outs this turn"). The 2023-24 UKK final broadcast tracked exactly this ([Wikipedia, 2023-24 UKK final](https://en.wikipedia.org/wiki/2023%E2%80%9324_Ultimate_Kho_Kho_final)).
- **Wazir highlight** — the differently-jerseyed attacker flagged when active; powerplay banner when two Wazirs are on.
- **Dream-run tension meter** — escalating graphic as a defender passes 3:00, 3:30, 4:00 … each 30 s = a point (league).
- **Out-feed / mini turn-scoreboard** — per-turn deltas (see §2.3).
- **Review / card status.**
- **Final-turn chase equation** — "Chennai need X, 1:47 left" — the Kho-Kho analogue of cricket's "need 23 off 16."

### 2.3 Concrete real-world example — the 2023-24 Ultimate Kho Kho Final
Gujarat Giants beat Chennai Quick Guns **31–26**, JN Indoor Stadium, Cuttack, 13 Jan 2024. The official turn-by-turn record ([Wikipedia](https://en.wikipedia.org/wiki/2023%E2%80%9324_Ultimate_Kho_Kho_final)) shows exactly how the sport is scored and presented — **per-turn deltas rolled into a cumulative total:**

| Turn | Points this turn (GG–CQG) | Cumulative | Notable |
|---|---|---|---|
| 1 | 14–1 | 14–1 | Chennai's Sumon Barman scored **1 Dream Run** point |
| 3 | 10–3 | 29–10 | Sanket Kadam **tagged 3** defenders; GG dismissed 5; CQG's Ramji Kashyap took 2 Dream Run pts |
| 4 | 2–16 | **31–26 (final)** | Chennai surged to within **3 points with 1:47 left**; then **Gujarat's Sanket Kadam scored 2 Dream Run points (over 3:30 of defense) to seal it** |

This one match validates the whole surface: **cumulative-total hero, per-turn breakdown, a live chase-equation in the final turn, and the dream run as the decisive, most-shareable moment.** Broader scale: the **Kho Kho World Cup 2025** (India beat Nepal **54–36** men, **78–40** women, IG Indoor Stadium Delhi, 19 Jan 2025) drew **460.2M cumulative views** on Star Sports + DD + Disney+ Hotstar ([Olympics.com](https://www.olympics.com/en/news/kho-kho-world-cup-2025-results-scores-standings-points-table)) — this is a real, rapidly-growing broadcast product, not a niche.

---

## 3. India school / college / ground variants + what casual scorers actually need

**What grassroots actually plays** (KKFI-traditional, the DEFAULT):
- **1 point per out, chasing team only.** No touch/pole/sky-dive point tiers. Dream run is **prestige only** (survival time, denies points) — not converted to points outside the league.
- 9-a-side (schools often **7-a-side, shorter 5–7 min turns, 2 turns**). Poles + central lane, but on a bare mud/cement ground, not an indoor mat.
- The scorer is a **student, PT teacher, or bystander** — one-handed phone, sun glare, no rulebook, no scoring hardware.

**What the casual scorer needs (vs pro):**
- **One dominant action: OUT (+1).** No out-type menu, no attribution required. Defender naming is a *refinement*, never a gate — the scorecard must degrade gracefully when it's skipped.
- **The clock owns the turn** — a big countdown + start/pause (play stops constantly at grounds).
- **Automatic batch feed** (3 dots; "next 3 in" on the 3rd out; "all out — order recycles" without ending the turn).
- **A designed turn-end handoff** — finalize points → "Chasing → Defending" swap → arm next turn. Never a silent reset.
- **A plain-language result** — "Warriors won by 6 points."

**What the pro needs (league preset, a toggle):** out-type tiers (Touch 2 / Pole Dive 3 / Sky Dive 3), dream-run-to-points, Wazir/powerplay, reviews, cards, per-chaser attribution, standings points. **Its density is hostile to a first-timer** — offer it, never default to it (mirrors cricket's Guided-default / Power-toggle decision, `cricket-spec-v2.md` §A).

---

## 4. GAPS — what existing scoring tools DON'T do (the opportunity)

Kho-Kho is **digitally underserved** for the grassroots ICP. The landscape splits into two ends with nothing in the middle:

1. **Federation-grade, hardware-tied systems.** **Kazo Vision** sells a dedicated "Kho Kho Scoring System" bundling Tournament Management, Match Scoring (UltraScore), Live Video, **Video Arbitration**, Stats, and a **Digital Scoreboard** ([Kazo Vision](https://www.kazovision.com/sports/kho-kho/?lang=eng)). This is the KKFI/UKK production tier — LED boards, operator PCs, referee review — **priced and provisioned for a stadium, not a PT teacher with a phone.** No casual on-ramp.
2. **Generic score counters.** KeepTheScore, ScoreLeader, Live Score App, Score Count, etc. are **two-number tap counters** ([KeepTheScore](https://keepthescore.com/), [ScoreLeader](https://scoreleader.com/)). They have **zero** concept of turns, chaser/defender roles, batches of three, the recycle rule, cross-turn summation, or survival time — the exact things that *are* Kho-Kho. Using one is like scoring cricket with a golf clicker.

**Federation "live scores"** (khelnow, olympics.com, kkwc2025.com) publish **final results and points tables after the fact** — read-only outputs, not a scoring tool grassroots can operate.

**The specific holes to beat:**
- **No lightweight phone scorer models the turn/role/batch/dream-run structure.** Everyone either over-builds (stadium hardware) or under-builds (two counters).
- **The dream-run survival timer — the single most-watchable element of the sport — exists in no casual tool.** It's derivable purely from the OUT log + clock; it's free drama nobody surfaces.
- **No graceful "college-default, league-toggle" spectrum.** Existing tools force one rigidity level.
- **No spectator/share artifact** for a college match — the turn-by-turn story (§2.3) is compelling and completely absent at grassroots.
- **Offline-first, single-device, sun-readable** operation on a cheap Android phone is unmet — the stadium systems assume a wired setup.

**The opportunity:** the *missing middle* — a phone-native scorer that understands Kho-Kho's real structure, defaults to the college 1-point-per-out model, and unlocks the league layer as a toggle. Being **structurally hard to mis-score** and surfacing the **free dream-run drama** is the differentiator no incumbent offers.

---

## 5. The moments that matter + the tracking layer

### 5.1 Drama beats worth a signature animation
1. **Dream-run threshold crossing — the marquee moment.** A defender/batch passing 3:00 unbroken (and every +30 s). It decided the 2023-24 final (Kadam's 3:30 seal). This is Kho-Kho's "fifty card": the **gold milestone** (brief §7) — human sentence in sans ("Great run — 3:30 unbroken."), figures in mono ("210s · +2 pts").
2. **Lona / all-out.** The whole defending side cleared before the clock — a bragging-rights peak even with no points. Deserves a distinct stamp.
3. **Turn takeover / role swap.** The green "chasing" wash slides from old chaser to new at turn-break — the identity beat of a turn-based sport.
4. **Final-turn chase equation.** "Chennai need 4, 1:47 left" escalating to danger-soft in the closing minute — the shareable tension band.
5. **Sky Dive / Pole Dive (league).** A spectacular airborne/pole tag worth its own out-type echo and +3 pop.
6. **Wazir activation / powerplay (league).** Two Wazirs on — a momentum-shift banner.

### 5.2 Spatial / positional data worth an interactive tracking layer
Cricket has the wagon-wheel. Kho-Kho's equivalents, ranked by value ÷ capture-cost:

1. **Defender-survival timeline (Gantt) — the signature viz.** One horizontal bar per defender across the turn's clock, length = time survived, marked with the out-event and any dream-run threshold. Reads instantly as "who lasted, who fell early." **Derivable free** from the OUT log + clock — no manual positional capture. This is the recommended primary layer.
2. **Dream-run tracker.** A live escalating meter per on-mat defender/batch (neutral → warning → gold at threshold); the spectator's most-watched widget. Same free derivation.
3. **Batch-of-3 turn tension.** The three current defenders as live survival chips — the at-a-glance "how close is this batch to falling."
4. **Turn-takeover comparison.** Because the winner is a cross-turn sum, a side-by-side "Team A scored 14 in their chase turn — Team B managed 10 in theirs," culminating in the chase equation. The Kho-Kho cross-innings compare.
5. **Kho-transfer / active-chaser lane diagram (FUTURE-FLAG, heavy).** A mini court animating kho hand-offs and active-chaser position — needs real positional capture a casual scorer won't provide. Defer, exactly as cricket defers the tap-to-place wagon layer (`cricket-spec-v2.md` §A).

**Design consequence:** the highest-value tracking layers (1–4) need **no data the OUT log + clock don't already give** — they are pure derivations of the events in §1.2. That is the cheap, high-drama win; the expensive positional layer (5) stays a future flag.

---

## Sources
- The Bridge — [Kho Kho rules, scoring, format](https://thebridge.in/kho-kho/kho-kho-rules-scoring-format-51531)
- The Bridge — [Kho Kho World Cup 2025: Wazir, dream run, turns, point system](https://thebridge.in/kho-kho/kho-kho-world-cup-2025-wazir-other-rules-51551)
- Sportskeeda — [Ultimate Kho Kho Season 2: rules changed](https://www.sportskeeda.com/kho-kho/ultimate-kho-kho-season-2-list-rules-changed-previous-season-ukk-2023)
- myKhel — [Ultimate Kho Kho rules and points system, key terms](https://www.mykhel.com/more-sports/ultimate-kho-kho-know-all-about-the-rules-and-points-system-key-terms-253507.html)
- News9 — [Kho Kho World Cup rules: Wazir, dream run, turns, point system](https://www.news9live.com/sports/others-sports/kho-kho-world-cup-rules-know-everything-about-wazir-dream-run-turns-point-system-2796507)
- Wikipedia — [2023-24 Ultimate Kho Kho final (turn-by-turn scoreline)](https://en.wikipedia.org/wiki/2023%E2%80%9324_Ultimate_Kho_Kho_final)
- Olympics.com — [Kho Kho World Cup 2025 results, standings](https://www.olympics.com/en/news/kho-kho-world-cup-2025-results-scores-standings-points-table) · [Kho Kho history, rules, how to play](https://www.olympics.com/en/news/kho-kho-history-rules-how-to-play)
- Kazo Vision — [Kho Kho Scoring System (federation-grade competitor)](https://www.kazovision.com/sports/kho-kho/?lang=eng)
- Generic counters — [KeepTheScore](https://keepthescore.com/), [ScoreLeader](https://scoreleader.com/)
