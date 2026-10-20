# Badminton — real-world scoring & broadcast research

**Date:** 2026-07-26 · **Status:** RESEARCH (feeds the badminton design brief, does not re-decide it) · **ICP:** Indian school / college / university / local-ground scorers — casual self-scorers dominate; a minority of club/umpire scorers exist.

**Purpose:** ground the badminton design in how the sport is *actually* scored and broadcast — TV score bugs, stadium scoreboards, federation umpire tools, and popular apps — so the scorer/live/scorecard surfaces mirror real conventions rather than invented ones. Companion to `design-brief.md`; inherits the cricket `blend-rubric.md` verbatim.

**Method note (from the cricket exemplar):** the cricket work reasoned from the *real record* (the scorebook, the TV bug, CricHeroes' ledger) to the operator's minimum capture set, then split "record vs conversation" per element. Badminton's record is far thinner than cricket's — one point per rally — so the entire research payoff is in the **derived state** (serve, court, rotation, deuce, cap, change-ends) and in the **spatial/tension layers** that no casual app renders today.

---

## 1. How the game truly works + exact capture set

### 1.1 The rally-point core (BWF, since 2006)
Badminton switched from service-only ("old" 15/11 side-out) scoring to the **3×21 rally-point** system endorsed by BWF in 2006 to make matches shorter and TV-friendlier (Wikipedia, *Scoring system development of badminton*; BWF *Simplified Rules of Badminton*). The consequence for a scorer is the simplest input of any racquet sport:

> **Every rally ends in exactly one point for exactly one side. There is no "side-out" / no serve-only scoring. One tap per rally.**

Everything else the operator sees is **derived from the score**, not entered:

- **Game to 21, win by 2, hard cap 30.** First to 21 wins *unless* the trailing side is within 1; then play continues to a 2-point lead or to **30** (at 29–29 the next point wins 30–29). The old "setting" (choose to play to 3) is gone. Casual Indian players still *say* "deuce" at 20–20 and treat 29–29 as sudden point — mirror the language, keep the modern rule.
- **Best of 3 games**, first to 2 games wins. Winner of a game serves first in the next.
- **Serving side = whoever won the previous rally.** Win the rally → you serve next; lose it → serve passes. (Pure function of the last event.)
- **Service court = server-score parity.** Serve from the **right** when the serving side's score is **even** (0, 2, 4 …), from the **left** when **odd**. This is confirmed everywhere from JudgeMate's *How badminton scoring works* to every umpire app: "left if their score is odd, right if it is even." **A pure function of state — the app renders it, never asks.**
- **Singles:** server + receiver stand in the court the server's score dictates; nothing else to track.
- **Doubles:** one serve per side (the "second server" was abolished in 2006). The serving pair keep their left/right positions and only the **server** swaps courts with their partner when the serving side wins *consecutive* points; when serve is lost, players stay put and the new serving side serves from the court its parity dictates. Receiver = the player diagonally opposite. This player-and-court bookkeeping is the exact thing casual doubles players get wrong every third rally.
- **Change ends:** end of each game; **and mid-way through the deciding (3rd) game when either side first reaches 11.** Also a **60-second interval** at 11 in every game and a **120-second interval** between games (BWF Law 16) — real umpire apps enforce both timers.

### 1.2 The exact events an operator must capture
Because the record is one point per rally, the *minimum* capture is a single winner tap. The engine derives the rest. Full capture set (nothing here is a manual entry beyond the first item):

| Event | Operator action | Engine derives |
|---|---|---|
| **Rally won** | 1 tap on the winning side | +1 that side; new server = winner; new service court = parity; doubles court swap eligibility; deuce/cap/game/match completion |
| **Serve / court** | none (auto) | server side, R/L box, doubles server-of-pair + diagonal receiver |
| **Deuce (20–20+)** | none | "win by 2" state, running to cap |
| **Game point / match point** | none | escalation state (a side one point from game/match) |
| **Game complete** | none (or confirm) | line score, who serves next game, ends swap |
| **Change ends** | 1 confirm tap when rule fires | 11-in-decider + between-games swap |
| **Match complete** | none | result, margin, games line |
| **Undo** | 1 tap | LIFO revert of last rally, re-derive all state |
| **Manual serve/court override** | rare | corrects an untracked let/service-judge call |
| **Let / replay** (optional) | 1 tap | no point, re-serve same server/court |

**What real umpires additionally track but casual scorers don't need as first-class input:** service faults, faults by type, misconduct cards (yellow/red/black), shuttle-change count, and the two interval timers. Keep these as reserved model fields with no casual scorer surface (parallels cricket's deferred shot-tracking).

**The single hardest derived rule to get right** (and the #1 correctness bug in home-grown scorers): in doubles, distinguishing "same side won again → server swaps courts, same server" from "serve changed hands → players stay, new side serves per its parity." Getting parity + who-serves-of-the-pair + receiver-diagonal simultaneously correct on every rally is the app's core value.

---

## 2. How real scoreboards & broadcasts present it

### 2.1 The MAIN scoreboard — what a viewer reads at a glance
The on-court electronic scoreboard (umpire's chair display) and the TV lower-third "score bug" both settle on the same **five-fact anatomy**. A viewer glancing for <1 second must read:

1. **Two names/pairs**, stacked — the serving side marked with a **shuttle/serve dot** (a small ● or shuttle glyph next to the name that is serving). This is the single most important non-numeric cue and every board has it.
2. **Two current-game scores**, large — the dominant element, mono/tabular, leading side implicitly read by size or a highlight.
3. **Games won**, small — a pair of game-boxes or pips (e.g. `1  0`) showing games already taken, usually to the outside of the names.
4. **(TV/broadcast) previous-game line scores** — `21–18` from game 1 carried in small boxes so a late-joining viewer knows the match story.
5. **A LIVE / match-context strip** — event, round, "Game 2", sometimes a serving-court hint.

Concrete references:
- **BWF World Tour broadcasts** (Yonex All England, India Open, Indonesia Open) render a lower-left score bug: two flag+name rows, a serve dot on the serving row, per-game boxes across, and current points in the largest cells. The look is codified in the **BWF World Tour TV Production Guidelines** (media.ffbad.org, 2023), which specify centralised *Graphics Generation*, Hawk-Eye IRS, and connection to *Tournament Information and Statistics services* — i.e. the bug is data-driven off the same scoring feed the umpire runs.
- **On-court scoreboard (umpire chair):** shows names, current points big, games-won boxes, and a serve indicator; the umpire drives it from the electronic Umpire Scoring device (BWF Tournament Software / "Court" apps).
- **overlays.uno "Badminton Scorebug — Standard"** and **KeepTheScore's badminton streaming scoreboard** (OBS/vMix overlay for amateur streams) both reproduce exactly this anatomy: two names, serve indicator, per-game boxes, big current score — evidence the five-fact layout is the universal convergent form, not a pro-only luxury.

**Design implication (ICP):** the badminton hero is *simpler* than cricket's — no run-rate/RRR/chase math. The five facts (names · serve+court · current scores · games-won pips · match context) ARE the hero. Do not over-fill it. The scorer's seam carries serve+court; the header subtitle carries context ("GAME 3 · 11–8 · DECIDER").

### 2.2 Richer broadcast overlays (the layer above the main bug)
BWF top-tier events (Super 500/750/1000, World Champs, Olympics) add graphics that casual apps never touch — these are the "aspirational richer layer" candidates:

- **Hawk-Eye Instant Review** — pinpoints the exact shuttle landing spot on an in/out challenge; BWF has run it since the 2014 Superseries Finals and mandates it at Super 500+ / World Champs / Olympics (BWF Corporate, *Approved Instant Review Systems*). The **shuttle-landing-spot graphic** is badminton's signature spatial visual — the direct analogue of cricket's ball-tracking.
- **Shuttle speed** — BWF's speed tracker shows smash speeds; men's smashes sit **340–360 kph**, the record around **~400+ kph** (BWF, *Speed Tracker Ready for Smashing Success*, 2015). Broadcast flashes "SMASH — 372 kph" as a moment graphic.
- **Rally length / longest rally** — broadcasts surface "shots in the rally" and "longest rally" (e.g. the famous 100+ shot rallies). Purely derivable from rally count if the operator taps each shuttle contact — out of casual scope as input, but *rally-length* is the natural badminton drama stat (see §5).
- **Momentum / point-run graphics** — "6 points in a row", point-by-point momentum worms, and a per-game points timeline.
- **Statistics panels between games** — points won on serve vs receive, longest streak, net/smash/error breakdowns, court-zone winners.

**Design implication:** the spectator surface should offer a *lite* version of the broadcast's richer layer — momentum run, game-point/match-point escalation, per-game line scores — all CSS-only and derivable from the rally log, with the spatial winning-shot-placement layer as the signature enrichment (§5).

---

## 3. India school / college / ground variants — what casual scorers actually need

Casual Indian badminton (PE classes, college fests, apartment/club courts, gully play, corporate tournaments, Premier Badminton League watch-alongs) deviates from BWF constantly for **time and court-rotation** reasons. The format picker must cover these or the scorer is wrong on day one:

- **Single game to 21** — the most common casual format after best-of-3; quick knockouts, intramurals, "next pair on" club rotation.
- **Single game to 15 / to 11** — time-boxed college fixtures, PE periods, crowded club courts.
- **"First to 21 flat" (no deuce, no cap)** — very common gully/college rule to guarantee the court frees up on time. Win-by-2 and cap must both be switchable off.
- **Best-of-3 to 15** — older/rural convention, still alive.
- **Singles / doubles / mixed doubles** — mixed-doubles events are big at college fests; chosen at setup, drives the serve engine.
- **Change-ends at 11 in the decider** — on by default, but a "don't prompt ends" toggle for ultra-casual play that ignores it.
- **Serve-layer mute** — some casual scorers "just want the number" and don't care who serves; allow muting the serve/court engine while keeping the count.

**What the casual scorer actually needs (vs the pro umpire):**

| Casual scorer needs | Pro umpire additionally needs (defer) |
|---|---|
| One-tap "who won the rally" | Service-fault typing, faults ledger |
| Never lose track of server + court + rotation | Misconduct cards (yellow/red/black) |
| Deuce / game-point / match-point called out loud (visually) | Shuttle-change tracking, warm-up timer |
| Change-ends prompt they don't have to remember | 60s/120s interval timers enforced |
| Undo the last rally | PDF official score sheet / referee sign-off |
| Plain-English format presets + house-rule toggles | Tournament-software sync, court assignment |
| Doubles rotation handled *for* them | Player-position audit / line-judge integration |

The Indian casual scorer's emotional job-to-be-done is **"be the referee nobody argues with"** — the app settles the three things every casual match fights over: *who serves, from which box, and did we change ends.* That is the entire wedge.

---

## 4. GAPS — what existing badminton apps do poorly (the opportunity)

These games are digitally underserved in India; the apps that exist are functional but thin. Surveyed: **Badminton Umpire Score Keeper** (Lahiru Chandima / SpicePOS, 100K+ installs, 4.4★, the category leader), **Badminton Scorer**, **ScoreMine**, **Score Buddy**, **BadmintonTrack** (free web), **KeepTheScore** (streaming), **overlays.uno** (OBS bug), **ScoreVision** (hardware boards).

Concrete gaps observed:

1. **Utilitarian, cold UI — zero moment design.** The leading umpire app is a functional court-view + count; nothing celebrates a game won, a match won, a comeback, or a deuce run. No emotional peak, no shareable result card. (This is exactly the void the cricket rubric's gold-milestone/celebration treatment fills.) **Opportunity:** a designed match-result moment + share card that college crowds actually post.

2. **Edge-case handling is missing or buried.** Real user reviews of the leading app complain there is **no retire/injury flow in the free tier** ("Injury suspend the match currently … no feature to report the player as retired") and that **doubles player-name selection is broken by the keyboard covering the pre-listed names.** Home-grown and casual scorers routinely mis-handle the doubles rotation entirely. **Opportunity:** rock-solid doubles serve/rotation engine + a clean retire/walkover/interruption path.

3. **No spectator / live-share surface built for a phone-first crowd.** Live feed is a paid 30-day trial add-on in the leader; there is no lean-back, reactable, presence-aware spectator view. **Opportunity:** a first-class live/spectator broadcast (viewer count, reactions, momentum) — the cricket brief's spectator model ported.

4. **Stats are shallow or absent.** Apps show a running count and, at best, a "line graph of scoring pattern." None surface badminton's genuinely meaningful splits — **points won on own serve vs on receive** (the rally-point era's key skill split), **longest point streak**, **serve retention**, **deuce-game record**, **decider record** — even though every one is *free to derive* from a point-by-point log the scorer already produces at zero extra taps. **Opportunity:** rich derived stats for zero input cost.

5. **No spatial / positional layer at all.** Casual apps render only numbers. Broadcast has Hawk-Eye landing spots and rally-length; nothing in the casual tier offers even a lightweight court-zone or rally-length view. **Opportunity:** the signature interactive tracking layer (§5) — badminton's answer to cricket's wagon-wheel.

6. **Format rigidity.** Most apps hard-code BWF 3×21 and don't cleanly support the Indian "flat to 21 / to 15 / to 11, no deuce" house rules, so the scorer fights the app. **Opportunity:** a house-rule format picker that matches how Indian courts actually play.

7. **Not offline-first / not phone-native for a noisy court.** Web scoreboards assume a laptop + OBS; hardware boards (ScoreVision) assume a venue budget. **Opportunity:** one-handed, offline, thumb-first phone scorer that works at a PE class or apartment court with no setup.

**Net:** the category is a race-to-parity of *counting*; nobody has built the *trustworthy derived-state engine + designed moments + spatial layer + real stats* combination. That is the differentiated product.

---

## 5. Moments that matter (drama beats) + the spatial/tracking layer

### 5.1 Signature drama beats worth an animation (reduced-motion gated, one live pulse max)
Ranked by how much a court crowd actually reacts:

1. **Serve hand-over** — the single most-frequent state change and the thing people watch for. When serve switches sides, the **shuttle glyph glides across the seam** to the new server and the court chip flips R↔L. Signature, light, ships at launch. This *is* the badminton identity animation (the serve indicator is the brief's signature scorer element).
2. **Match point / game point** — a side one point from winning: escalation-ladder chip (warning-soft at game point → danger-soft at match point) + the one LIVE-dot pulse. The tensest recurring beat.
3. **Deuce / cap run (20-all → 29–29 sudden point)** — a persistent "DEUCE · win by 2" strip so viewers understand why it isn't over; escalates as the run climbs toward the cap.
4. **Game won** — soft celebration beat + human sentence / mono figures ("Game 2 to Meera — 21–18").
5. **Point streak / momentum** — an unanswered-run counter ("6 in a row"), the badminton equivalent of a bowling spell; CSS-only pip run or thin bar.
6. **Comeback** — flag a game/match won after trailing by ≥N (e.g. down 15–19, won 22–20) — a share-worthy story beat.
7. **Match won** — the gold milestone card + existing confetti; exactly one gold, plain-language margin ("in 3 games · 21–19 in the decider").

Broadcast analogues that justify these: BWF surfaces game-point/match-point graphics, momentum runs, longest-rally, and a designed winner sting — the casual tier should offer the derivable subset.

### 5.2 The interactive tracking layer (badminton's wagon-wheel)
Cricket's differentiator was free spatial capture (wagon-wheel from tap position). Badminton's equivalent, in ascending input cost:

- **Winning-shot placement — court zones (primary candidate).** Optional tap-to-place: after a rally, the operator can tap *where* the winning shuttle landed on a simplified court (e.g. a 6-zone grid: front/mid/rear × left/right, plus "into net" / "long"). Aggregated → a **court-zone heatmap of where each player wins/loses points** — the direct casual analogue of Hawk-Eye's landing-spot graphic and of the wagon-wheel. Layered onto the winner tap, never required (defer to an enrichment mode, `zone` field reserved), exactly as cricket salvaged the gesture-mode wagon capture.
- **Rally-length tracking.** Broadcast shows "shots in the rally / longest rally." A single **optional** long-press or a lightweight shot-counter per rally yields rally-length distribution, longest rally of the match, and "who wins the long rallies vs the short ones" — a genuinely badminton-specific insight no casual app has. Reserve `rallyLength`; do not burden the default one-tap path.
- **Service-court view.** A persistent mini court-diagram showing the current server, receiver (diagonal), R/L box, and — in doubles — the pair's positions. This is *derived, zero-input*, and directly solves the ICP's #1 argument. It is both a scorer aid and a spectator explainer. The leading umpire app already ships a static "court view with player positions and serving side"; ours should be the cleaner, animated, correctness-guaranteed version.
- **Game-point tension / momentum timeline.** A per-game points timeline (score-by-score) with deuce/game-point markers — a lightweight momentum worm derivable entirely from the rally log, CSS-only, no library.

**Recommended launch spatial layer:** the **derived service-court view** (zero input, solves the core argument) as the always-on signature; **winning-shot court-zone placement** as the optional tap-to-place enrichment (the wagon-wheel parallel); **rally-length** and the **momentum timeline** as deferred spectator-side richness.

---

## Sources
- BWF, *Simplified Rules of Badminton* — https://system.bwfbadminton.com/documents/folder_1_81/Regulations/Simplified-Rules/Simplified%20Rules%20of%20Badminton%20-%20Dec%202015.pdf
- Wikipedia, *Scoring system development of badminton* — https://en.wikipedia.org/wiki/Scoring_system_development_of_badminton
- JudgeMate, *How badminton scoring works (rally system & rules)* — https://www.judgemate.com/en/guides/how-badminton-scoring-works
- BWF World Tour TV Production Guidelines 2023 — https://media.ffbad.org/Nyi48/annexe1_-_bwf_world_tour_tv_production_guidelines_v2.pdf
- BWF Corporate, *Approved Instant Review Systems (Hawk-Eye)* — https://corporate.bwfbadminton.com/events/approved-instant-review-system/
- BWF, *Speed Tracker Ready for Smashing Success* — https://bwfbadminton.com/news-single/2015/03/26/speed-tracker-ready-for-smashing-success
- BWF, *'Hawk-Eye' to Determine 'In or Out'* — https://bwfbadminton.com/news-single/2014/04/04/hawk-eye-to-determine-in-or-out
- Badminton Umpire Score Keeper (Lahiru Chandima / SpicePOS), 100K+ installs, 4.4★ — https://play.google.com/store/apps/details?id=com.lahiruchandima.badmintonumpire
- overlays.uno, *Badminton Scorebug — Standard* — https://overlays.uno/library/159-Badminton-Scorebug---Standard
- KeepTheScore, *Badminton scoreboard for streaming* — https://keepthescore.com/badminton-scoreboard/
- BadmintonTrack, *Free online badminton score counter* — https://badmintontrack.com/
- ScoreMine — Badminton Scoring — https://apps.apple.com/in/app/scoremine-badminton-scoring/id6444081915
- ScoreVision, *Badminton scoreboard software (hardware boards)* — https://scorevision.com/scoreboard-control-software/scorekeeper/badminton/
