# Volleyball — real-world scoring & live-experience research

**Date:** 2026-07-26 · **Status:** RESEARCH (feeds the design brief in this folder)
**Method inherited from cricket:** ground every design decision in *how the sport is actually
scored and broadcast in the real world*, then decide detail-by-surface (scorer lean,
spectator/scorecard richer). This document is the "how it truly works + how the world shows it"
layer under `design-brief.md`. It does not re-decide governance or the blend.

**ICP anchor:** Indian college / university / school / open-ground volleyball. Casual scorers
(PE teachers, student volunteers, ground organisers) dominate; a minority run formal
VFI/SGFI-style matches. Everything below is filtered through "what does a two-thumb scorer on a
phone at a gully court actually need vs what a pro truck produces."

---

## 1. How the game truly works + the exact events an operator must capture

### 1.1 The rally is the atom
Modern volleyball is **rally-point scoring**: *every* rally ends in a point for one side,
regardless of who served ([PlayingVolley](https://www.playingvolley.com/how-does-scoring-work/),
[FIVB Official Rules 2025–2028](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf)).
This is the single most important fact for the scorer: **one rally = one tap to one of two
teams, always.** There is no "dot ball," no null outcome. Contrast the pre-2000 *side-out*
system (only the serving team could score) — that is dead in formal play but still shows up in
old PE-teacher mental models, which is a training/onboarding concern, not an engine one.

### 1.2 The one derived subtlety: serve & the side-out
The rally winner scores. **If the winner was the *receiving* team, they also win the serve — a
"side-out" — and rotate one position clockwise** ([Rotate123](https://www.rotate123.com/volleyball-positions-and-rotations.html),
[CoachingVB zones](https://coachingvb.com/volleyball-zones-1-6-court-positions-explained-with-diagrams/)).
If the serving team wins, they keep serving ("break point" in stat language) and do **not**
rotate. So from a single "who won the rally" tap the engine derives: new score, who serves next,
whether a side-out occurred, and whether the winning team rotates. **The operator never enters
serve possession — it is a pure derivation from the rally log + who served first.** This is the
volleyball analogue of cricket auto-deriving strike.

### 1.3 Why a point was won (the stat layer, NOT required to score)
Formal scouting classifies *how* the point ended — and this is exactly the enrichment layer that
costs taps, so it must stay optional:
- **Kill** — a successful attack/spike that lands in or can't be returned.
- **Ace** — serve lands untouched or unplayable; direct point off the serve.
- **Block** — a block that ends the rally in your favour.
- **Opponent error** — net touch, ball out, foot-fault, double, 4-hits, rotation fault, etc.
Sources: [SDHSAA stat definitions](https://sdhsaa.com/volleyball-stats/),
[VolleyballMag terms](https://volleyballmag.com/common-volleyball-terms-and-definitions/).
Roughly half of all points at amateur level are *opponent errors*, which is why "tag every point
with a reason" is high-friction and low-signal for casual play — the design brief is right to
defer per-rally outcome tagging.

### 1.4 Set, match & the exact structure the engine must own
- **Set to 25, win by 2**, uncapped by default (24–24 → play continues until a 2-point lead)
  ([PlayingVolley](https://www.playingvolley.com/how-does-scoring-work/)).
- **Deciding set to 15, win by 2**, and **teams switch ends when one team reaches 8** in that set
  ([VolleyRef rulesets](https://volleyref.app/volleyball-scoring-rules.html)).
- **Match = best-of-5** (first to 3 sets) or **best-of-3** (first to 2).
- **Ends switch after every set.** Serve alternates: the team that did NOT serve the previous set
  serves the next.
- **Timeouts:** 2 per team per set. In FIVB/World events sets 1–4 add two automatic **60s
  Technical Timeouts** when the leading team hits **8 and 16**; the deciding set has **none**
  ([WorldOfVolley Part 25](https://worldofvolley.com/Latest_news/71605/official-volleyball-rules-part-25-interruptions-in-volleyball.html),
  [Wikipedia: technical timeout](https://en.wikipedia.org/wiki/Technical_time-out_(volleyball))).
  Technical TOs are almost never run at Indian college/ground level → off by default.
- **Substitutions:** 6 per set (FIVB). **Libero** replacements are unlimited and do NOT count as
  subs, but must be tracked on the formal scoresheet so a set can be reconstructed
  ([FIVB rules](https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf),
  [NFHS paper-scoring handbook](https://volleywrite.com/wp-content/uploads/2020/08/NFHS-Paper-Scoring-Handbook.pdf)).

### 1.5 The exact event list an operator must be able to capture
Ranked by frequency — the design must weight the UI to this ladder:
1. **Point to Team L / Point to Team R** — the ~99% action (one tap per rally).
2. **Undo** — LIFO reversal of the last rally *and* everything it derived (score, serve, rotation,
   set-close). Highest-value safety action.
3. **Timeout (L / R)** — 2 per set; the engine must warn when a team is out of timeouts.
4. **[Auto] set close → end-switch handoff** — engine-driven at 25/target with a 2-lead; not an
   operator tap but a confirmed screen.
5. **[Auto] deciding-set switch at 8.**
6. **Correct/fix serve** — rare, for a mis-set first server.
7. **Formal-only:** substitution, libero in/out, rotation-fault, lineup entry.
8. **Deferred stats:** ace / kill / block / opponent-error tag per point (costs a second tap;
   keep out of the default lean path).

**Single source of truth (cricket-parallel):** `deriveSet(rallies, format)` /
`deriveMatch(sets, format)` compute score, server, side-out flag, deuce, set-point, match-point,
set winner, sets-won, margin, and every switch prompt. The persisted truth is the **rally log +
format**; everything the UI shows is a read-only derivation, and undo/edit-past is
replay-forward (identical discipline to cricket's `deriveInnings`).

---

## 2. How real scoreboards & broadcasts present it

### 2.1 The MAIN SCOREBOARD — what a viewer reads at a glance
A *score bug* is the persistent on-screen graphic showing score + state, in the lower-third or a
top strip ([Wikipedia: score bug](https://en.wikipedia.org/wiki/Score_bug)). Across FIVB VNL,
Prime Volleyball League (Sony Sports), NCAA and the AVP beach broadcasts, the volleyball main bug
has a **remarkably stable anatomy** — five things and no more:

1. **Two team identities** — flag/crest/colour + 2–3 letter code (IND, BRA; PVL: "AHV", "KBS").
2. **The two current-set point numbers** — the biggest, boldest figures; the whole rest of the
   bug orbits these.
3. **Sets-won tally** — small pips or a boxed count per team (e.g. `2` vs `1`), often as filled
   dots. This is the *actual match state* and is easy to miss if under-weighted.
4. **Serve indicator** — a dot / arrow / ball-glyph next to the team currently serving. Flips on
   every side-out; it is the only piece of "possession" a viewer tracks.
5. **Set number / context** — "SET 3", sometimes with the running per-set line.

Everything else (player names, timeout pips, city) is broadcast garnish. The at-a-glance read is
literally: *these two numbers, who's ahead on sets, who's serving.* This maps cleanly onto the
brief's score-hero (per-set points + sets-won + server indicator that never leaves screen).

**Stadium/gym scoreboards** (LED consoles, and app-driven boards like the Google-Play
"Volleyball Scoreboard" / "Volley Scoreboard" apps) add exactly two more fields a viewer in the
building needs: **timeouts remaining** (dots per team) and a **set/game clock or set-duration**,
plus the same serve indicator ([Volley Scoreboard](https://apps.apple.com/us/app/volley-scoreboard/id6472438166),
[Volleyball Scoreboard, Play](https://play.google.com/store/apps/details?id=it.censa.scoreboardvolleyball&hl=en_US)).

### 2.2 Richer broadcast overlays (the "lean-back" layer)
Beyond the persistent bug, volleyball broadcasts surface periodic full/half overlays. Concrete
real-world examples:
- **Per-set line / set-history strip** — completed sets as `25–23 · 23–25 · 25–19`, current set
  live. This is volleyball's version of cricket's over-strip: match-shape at a glance.
- **Momentum / point-run graphics** — the sport's signature broadcast stat. Timelines showing how
  a set swung and "point runs" (e.g. a 6-0 burst) are standard; VNL/analyst coverage explicitly
  highlights "who scores in transition, who serves for points, who survives long rallies"
  ([otlvolleyball infographic](https://otlvolleyball.com/otl-origins/volleyball-infographic-spike-your-knowledge/)).
- **Team stat panel** — aces, blocks, kills/attack %, **side-out % vs break-point %**, longest
  run, errors. Sourced live from scouting software (below).
- **Serve/attack tendency maps** — where a server places the ball, where a hitter attacks from and
  to. These come from the scouting layer, not the score bug.
- **PVL's TV-native rule graphics** — India's Prime Volleyball League invented broadcast-first
  scoring gimmicks that get their own overlays: **Super Point** (a team can call once per set,
  before it reaches 11, to *double* the points from that rally — or concede 2 if it loses) and
  **Super Serve** (an untouched ace scores **2**). PVL sets are **to 15, win-by-1 except 14–14**,
  best-of-5, and a **5–0 set sweep earns 3 league points** vs 2 for any other win
  ([KhelNow PVL rules](https://khelnow.com/volleyball/2023-02-explained-all-rules-of-prime-volleyball-league),
  [VolleyballWorld: PVL](https://en.volleyballworld.com/news/get-to-know-the-prime-volleyball-league)).
  Relevant to us as proof that *India's own flagship changes the format for pace/drama* — our
  custom-format engine must not hard-code FIVB numbers.

### 2.3 Where the rich stats come from — the scouting layer
Pro stats are produced by dedicated scouting software, NOT by the scoreboard operator:
**DataVolley / Click&Scout (Data Project)** and **VolleyStation** are the category standard
([DataVolley EU](https://www.datavolley.eu/en/software/volleyball/),
[Click&Scout](https://www.dataproject.com/products/eu/en/volleyball/clickandscout),
[VolleyStation](https://volleystation.com/)). They encode **every contact** as a 2-char code:
skill (serve/reception/set/attack/block/dig) + court **zone (1–6)** + tempo + evaluation
(=/-/+/#) + direction. Attack combination codes pair a set-type with an **origin zone** (e.g.
"V1" = high ball from zone 1) and tempo buckets (quick/tense/medium/high)
([The Volleyball Analyst: attack codes](https://thevolleyballanalyst.wordpress.com/2021/09/30/attack-combination-codes-2021-edition/)).
**Takeaway for us:** this is a two-tier world — a *scoreboard* tier (5 fields, one tap) and a
*scouting* tier (every contact coded, an operator-hour per set). Our product lives in the
scoreboard tier by default and can borrow *one* scouting idea (zone of the point-winning action)
as an optional enrichment — never the full DataVolley coding burden.

---

## 3. India school / college / ground variants & what casual scorers actually need

### 3.1 Governing reality
Formal Indian volleyball runs under the **Volleyball Federation of India (VFI)** and, at school
level, the **School Games Federation of India (SGFI)** (U-15/U-17/U-19 events)
([VFI Wikipedia](https://en.wikipedia.org/wiki/Volleyball_Federation_of_India),
[SGFI](https://en.wikipedia.org/wiki/School_Games_Federation_of_India)). These use FIVB rules and
the standard paper scoresheet with libero tracker. **But the vast majority of volleyball played
in India never touches a scoresheet** — it is PE periods, hostel/section leagues, college-fest
knockouts, and open municipal-ground evening games.

### 3.2 The everyday format truths (drive the setup presets)
- **Best-of-3 is the default**, not best-of-5. Bo5 is finals/formal only.
- **Short house targets are normal.** School / gully / PE games routinely play to **21, 15**, or a
  single **first-to-N / timed** set to fit a period or rotate many teams through one court.
- **Single-set knockouts** dominate college fests (one set to 25, or even 15, to run a bracket in
  a day). Best-of-1 must be a first-class, non-buggy format.
- **Deuce is often capped** ("win by 2 but next point wins at 30–30", or a hard 27 cap) to keep a
  packed day moving. Uncapped is the true rule; a cap toggle is the ground-reality need.
- **PVL-style variants leak down** — kids who watch Prime Volleyball ask for "to 15" and know
  "super serve." Worth recognising in copy/presets even if not defaulted.

### 3.3 What a casual scorer needs (vs a pro)
| Need | Casual (our default) | Pro / formal |
|---|---|---|
| Start a match | 2 labels ("A/B", "Red/Blue", section names), a preset chip, go — <15s, zero roster | Full lineup, positions, libero, coaches |
| Score a rally | one tap to a side | coded contact (skill+zone+tempo+eval) |
| Serve | auto-derived, shown | rotation & serve-order enforced from lineup |
| Rotation | invisible (not tracked) | 6-position wheel, overlap/rotation faults |
| Timeouts | 2/set, simple counter | + technical TOs at 8/16, challenge/review |
| Libero / subs | off | tracked & reconstruction-safe |
| Stats | derived free (runs, side-outs, set scores) | per-player kills/aces/blocks/digs, hitting % |
| Result | "Team A won 2–1", set line, share | full scoresheet, signed, archived |

The casual scorer's real anxieties are: **mis-tapping the wrong side**, **losing track of who
serves**, **forgetting to switch ends / which set it is**, and **deuce confusion at 24–24**. A
good product removes all four by derivation + an un-fumbleable two-target tap — not by adding
fields.

---

## 4. GAPS — what existing volleyball scoring apps do poorly (the opportunity)

Surveying the live market — **VolleyStation Score**, **VolleyRef**, **Volley Scoreboard**,
**Volleyball Scoreboard**, **V-Score Referee**, **Volleyball Score Simple**
([VolleyStation Score](https://apps.apple.com/us/app/volleystation-score/id1614399577),
[VolleyRef](https://mvc-referee.lovable.app/),
[V-Score Referee](https://apps.apple.com/us/app/id6744142937),
[Volleyball Score Simple](https://play.google.com/store/apps/details?id=com.wespiapps.volleyballscore&hl=en_US)) —
the field splits into two disappointing halves, and the middle is empty:

1. **"Dumb counters" have no game brain.** The free/simple apps (Volleyball Score Simple, generic
   scoreboards) are just two +/- buttons — exactly our current `MonoLiveGame` baseline. They do
   **not** derive serve/side-out, do **not** know win-by-2 or the deciding-set-15/switch-at-8,
   do **not** auto-close a set or prompt the end-switch, and treat best-of-N as an afterthought.
   The scorer carries all the rules in their head — the opposite of "un-mis-scoreable."

2. **"Pro tools" are hostile to casuals.** DataVolley / VolleyStation / Click&Scout demand a
   lineup, positions and coded contacts before you can start; they're desktop/tablet-heavy,
   paid, and built for a trained statistician. A PE teacher will never open one.

3. **Format rigidity.** Almost none cleanly support the *Indian* reality — to-21, to-15,
   single-set knockouts, deuce caps, PVL-style targets. They assume FIVB 25/15/Bo5 and break or
   fake it otherwise.

4. **No spectator / share layer.** These apps produce a *referee/scorer* view; there is little to
   no lean-back live view for parents/students, no shareable live link, no post-match result
   card. Volleyball is intensely momentum-driven and social at college level, and that emotional
   surface is essentially absent in the tooling.

5. **Momentum is under-shown even where stats exist.** Point-runs and set-swings are volleyball's
   defining feel and its best broadcast stat — yet consumer apps rarely visualise them; when they
   do it's a buried table, never a first-glance band.

6. **Weak Indian-context fit.** English-only, roster-required, cricket-scoreboard mental models;
   nothing designed for "two section names, a phone, a mud court, 15 seconds to start."

**The opportunity (ICP-grounded):** the missing middle — a **game-brain scorer** (derives serve,
side-out, deuce, set-close, switch, best-of-N; handles to-21/to-15/single-set/cap natively) that
is **as fast as a dumb counter** (one thumb, two targets) *and* ships a **shareable momentum-first
spectator + result experience** the pro tools never bother with. That is a genuinely open lane in
India's digitally-underserved court sports.

---

## 5. Moments that matter (drama beats) + the spatial/positional tracking layer

### 5.1 Drama beats worth a signature animation
Ranked by emotional payload; all reduced-motion-gated, all within the frozen blend budget:
- **Set point / match point** — the pressure peak *before* the point. Escalation-ladder tint on
  the target line ("SET POINT" / "MATCH POINT"), live pulse retained at match point. The single
  most-felt moment in a set.
- **Deuce (24–24 / target−1 each)** — "win by 2" tension; ladder escalation, not a new colour.
  Recurs and re-escalates each tied point.
- **Set won** — a soft card sliding into the end-switch handoff: human sentence in sans ("Team A
  takes set 2, 25–22") + mono figure line. The natural pause where the crowd reacts.
- **Point-run flare** — the volleyball-specific beat: a team rattling off a run (5+ straight, often
  on one player's serve). A subtle ladder-tint escalation on the run counter; this is *the* sport's
  feel and its best broadcast stat, so it earns a light signature.
- **Match won** — the one gold milestone card: plain-language result + margin ("Team A won 3–1"),
  set line in mono, share/rematch. The designed peak.
- **Comeback / set-point saved** — trailing team erases a set point or wins after trailing by ≥N.
  A quieter tint beat; high narrative value, low decoration.

### 5.2 The interactive tracking layer (volleyball's "wagon-wheel")
Cricket's signature spatial toy is the wagon-wheel (where runs were scored). Volleyball's
equivalents, ranked by value-per-tap-cost:

1. **Point-run / momentum worm (ZERO extra taps — ship-first).** The rally log alone yields the
   whole set as a swing timeline: a CSS-only band showing current run ("Team A · 6 straight"),
   lead changes, ties, and per-set swing. This is the *lowest-cost, highest-signal* interactive
   read and directly matches how broadcasts frame the sport. This is our wagon-wheel.
2. **Serve/side-out takeover strip (zero extra taps).** Because serve is derived, the log freely
   yields **service-point streaks** (points scored while serving) and **side-out % vs break-point
   %** per team — a genuinely volleyball stat with no extra input. A compact "on serve" streak +
   who-broke-serve read.
3. **Rotation wheel (formal mode only).** A six-position clockwise wheel showing current rotation
   and which player is serving (back-right / zone 1). Only meaningful when a lineup exists, so it
   lives behind the formal-mode toggle ([Rotate123 rotations](https://www.rotate123.com/volleyball-positions-and-rotations.html)).
4. **Attack & serve *zone* map (optional enrichment — the DataVolley idea, minimised).** A
   6-zone court (zones 1–6, standard numbering: 1 right-back/server … 4 left-front) where the
   scorer *optionally* taps where the point-winning attack/serve landed or came from. Borrows
   exactly ONE idea from DataVolley's coding system (origin/target zone) without its full
   contact-coding burden — a single optional tap that unlocks a heat read of "where points are
   won." Analogue to cricket's tap-to-place wagon layer: **deferred, opt-in, never blocks the
   core one-tap flow** ([DataVolley zones/codes](https://thevolleyballanalyst.wordpress.com/2021/09/30/attack-combination-codes-2021-edition/)).
5. **Set-point takeover / clutch read.** Which team converts set/match points, who saves them —
   derivable from the log, surfaced as a small spectator/scorecard stat.

**Sequencing recommendation:** ship (1) and (2) as the free, log-derived signature reads (they
require nothing beyond the rally tap and deliver the sport's core drama); gate (3) behind formal
mode; treat (4) as a future opt-in enrichment wave, exactly as cricket deferred tap-to-place
wagon capture.

---

## Sources
- FIVB Official Volleyball Rules 2025–2028 — https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf
- WorldOfVolley, Official Rules Part 25 (interruptions/timeouts) — https://worldofvolley.com/Latest_news/71605/official-volleyball-rules-part-25-interruptions-in-volleyball.html
- Wikipedia, Technical time-out (volleyball) — https://en.wikipedia.org/wiki/Technical_time-out_(volleyball)
- VolleyRef, Scoring rules by ruleset (FIVB/USAV/NFHS/NCAA) — https://volleyref.app/volleyball-scoring-rules.html
- PlayingVolley, How scoring works — https://www.playingvolley.com/how-does-scoring-work/
- SDHSAA volleyball stat definitions — https://sdhsaa.com/volleyball-stats/
- VolleyballMag, common terms — https://volleyballmag.com/common-volleyball-terms-and-definitions/
- Rotate123, positions & rotations — https://www.rotate123.com/volleyball-positions-and-rotations.html
- CoachingVB, zones 1–6 — https://coachingvb.com/volleyball-zones-1-6-court-positions-explained-with-diagrams/
- Wikipedia, Score bug — https://en.wikipedia.org/wiki/Score_bug
- KhelNow, Prime Volleyball League rules — https://khelnow.com/volleyball/2023-02-explained-all-rules-of-prime-volleyball-league
- VolleyballWorld, Get to know the PVL — https://en.volleyballworld.com/news/get-to-know-the-prime-volleyball-league
- DataVolley (Data Project) — https://www.datavolley.eu/en/software/volleyball/
- Data Project, Click&Scout — https://www.dataproject.com/products/eu/en/volleyball/clickandscout
- VolleyStation — https://volleystation.com/ ; VolleyStation Score — https://apps.apple.com/us/app/volleystation-score/id1614399577
- VolleyRef app — https://mvc-referee.lovable.app/ ; V-Score Referee — https://apps.apple.com/us/app/id6744142937
- Volley Scoreboard — https://apps.apple.com/us/app/volley-scoreboard/id6472438166 ; Volleyball Score Simple — https://play.google.com/store/apps/details?id=com.wespiapps.volleyballscore&hl=en_US
- The Volleyball Analyst, DataVolley attack combination codes — https://thevolleyballanalyst.wordpress.com/2021/09/30/attack-combination-codes-2021-edition/
- otlvolleyball infographic (momentum/stats framing) — https://otlvolleyball.com/otl-origins/volleyball-infographic-spike-your-knowledge/
- Volleyball Federation of India — https://en.wikipedia.org/wiki/Volleyball_Federation_of_India ; School Games Federation of India — https://en.wikipedia.org/wiki/School_Games_Federation_of_India
- NFHS paper-scoring handbook — https://volleywrite.com/wp-content/uploads/2020/08/NFHS-Paper-Scoring-Handbook.pdf
