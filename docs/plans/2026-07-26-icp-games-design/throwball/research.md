# Throwball — Real-World Scoring & Live-Experience Research

**Status:** Research input for the bespoke Throwball design (feeds `design-brief.md`).
**Method inherited from:** cricket exemplar (`../../2026-07-20-icp-games/cricket/cricket-spec-v2.md` + `blend-rubric.md`) — research the sport as it is *actually* scored and broadcast, then design our surfaces over the real event model, not a generic +/- counter.
**ICP:** Indian college / university / school / grounds. Women's staple. Dominant operator = a student volunteer or PT teacher on a phone at courtside.
**One-line orientation:** Throwball is *side-out/rally-point volleyball with a catch-and-throw instead of a volley.* Its broadcast and scoreboard grammar is the **volleyball score bug**; its digital tooling in India is near-absent. That gap is the opportunity.

---

## 0. Sources consulted (real references)

- **International Throwball Federation (ITF) / TFI rulebook** — quoted via search of the ITF rules PDF: *"each set of a match shall constitute of 25 points (Rally Score). In case of 24 points each, the play is continued until two points lead is reached, i.e. 24-26 or 25-27. When the score is 26 points each, any team scoring 27th point first shall be declared as winner."* (ITF Throwball Rules book; TFI is the governing body, formed 1985, HQ Bangalore — https://throwballindia.org/ , rulebook mirror https://www.throwballindia.in/Rule%20Book%20TFI.pdf).
- **RulesOfSport — Throwball** (https://www.rulesofsport.com/sports/throwball.html): court 12.2 m × 18.3 m, **1.5 m neutral box** either side of centre, net height 2.2 m, 12-player squad / **7 active** + 5 subs, "best of three, first to 15," catch-and-throw, release on/above shoulder line, no passing, two players can't catch simultaneously.
- **SGFI school throwball rules** (https://www.sgfi.org.in/Content/FileUpload/PDF/Rules_Throw_New.pdf — School Games Federation of India, the schools body) and **Sportsmatik** (https://sportsmatik.com/sports-corner/sports-know-how/throwball/rules): serve within 5 s of whistle, catch-and-throw within **3 s**, fault vocabulary.
- **Isha Gramotsavam Throwball (Women's) Rules** (https://consciousplanet.org/en/gramotsavam/throwball/rules): grassroots/village women's variant — 7+1 to 7+3 squads, may continue with 6, **"Standing Player Method"** (no rotation), Aadhaar-gated eligibility. Shows exactly what a casual tournament actually enforces vs ignores.
- **College/university reality:** State-Level Inter-Collegiate **Women's** Throwball (Pondicherry University https://www.pondiuni.edu.in/ ; Tumkur University https://www.sscasc.in/ ; Don Bosco Institute of Technology Bengaluru https://dbit.edu.in/ ; Star of Mysore tournament coverage https://starofmysore.com/tag/throwball-tournament/ ). Confirms women's-college dominance concentrated in Karnataka / Tamil Nadu / Puducherry.
- **Broadcast:** Khelo India University/Youth Games stream on **DD Sports** + **Prasar Bharati Sports YouTube** + **Waves OTT** (https://www.jiotv.com/live-channel/dd-sports/ ; https://www.olympics.com/en/news/khelo-india-university-games-2025-kiug-schedule-live-streaming-telecast-tv). No throwball-specific broadcast graphics package exists publicly; the reference is the **volleyball score bug**.
- **Score bug grammar:** Wikipedia *Score bug* (https://en.wikipedia.org/wiki/Score_bug) + KeepTheScore volleyball scorebug guides (https://keepthescore.com/blog/posts/score-bugs-in-live-sports-broadcasts/ , https://keepthescore.com/volleyball-scoreboard/ , https://keepthescore.com/blog/posts/volleyball-scoring/) — set score + current-set points + serve indicator + team colour + set-point/match-point cue.
- **Existing throwball app:** *Ultimate Throwball Scoreboard* by Aarya Studios, Google Play (https://play.google.com/store/apps/details?id=com.aaryastudios.ultimatethrowballscoreboard) — essentially the only dedicated throwball scorer in the store, and it is a bare scoreboard.

---

## 1. How the game truly works + the exact events an operator must capture

### The rally, precisely
Two teams of **7** face each other across a 2.2 m net on a 12.2 × 18.3 m court. One team **serves** — an overhand *throw* from behind the back line, released **on or above the shoulder line**, within **5 seconds** of the referee's whistle, without the ball touching the net. The receiving side must **catch cleanly with both hands** and **throw it back within 3 seconds**, over the net, released above the shoulder. There is **no volleying, no passing between teammates, and two players may not catch simultaneously** (RulesOfSport; SGFI). The rally is therefore a fast catch-throw-catch-throw exchange that ends the instant one side commits a fault or fails to return.

**The single fact that collapses all of this for a scorer: a rally has exactly one outcome — point A or point B.** Everything technical (which fault, who caught) is *enrichment*, never required to advance the score.

### Scoring system — the one real-world ambiguity that MUST be handled deliberately
There are **two scoring systems in the wild**, and casual sources contradict each other:

1. **Rally-point (current ITF/TFI standard):** the winner of *every* rally scores, regardless of who served — sets to **25**, win by 2, hard cap at **27** (26-all → next point wins); deciding set to **15**, win by 2. This is the modern federation rule, verbatim from the ITF book (§0). This mirrors FIVB volleyball post-1999.
2. **Side-out (older / still parroted in casual descriptions):** *"only the serving team can score a point"* (RulesOfSport, Sportsmatik still describe it this way). A rally won on the opponent's serve gives you serve but **no point**. This is the historical throwball rule and is still what many PT teachers and older score sheets assume.

**Operator implication (critical):** the modern default is rally-point (matches the brief's locked model), but the app should be *aware* that a chunk of the ICP still mentally runs side-out. Two safeguards: (a) the setup preset copy should state plainly *"every rally = a point (rally scoring)"* so an old-school scorer isn't surprised; (b) leave a latent config seam for a side-out mode rather than hard-coding rally-point as a law of physics. Getting this wrong means the scoreboard silently disagrees with the referee — the worst possible failure for a record app.

### Set / match structure (real ranges)
- **Set target:** 15 (schools, most colleges), 21 (some circuits), **25** (senior/ITF). Win by 2.
- **Cap:** ITF caps a 25-set at 27; local tournaments cap a 15-set (commonly at 17) to keep the schedule moving. Casual grounds *want* a cap; federation play uses the ITF cap.
- **Match:** best-of-3 (first to 2 sets) is the overwhelming default; best-of-5 in senior play.
- **Deciding set:** frequently a **shorter target** — ITF deciding set is 15; local rulebooks drop the 3rd set to **11**. Must be per-set configurable, not global.

### The exact event stream an operator must capture
**Atomic (always, one tap):**
- `point → {teamA | teamB}` — the ONE event. On each point the engine must, automatically:
  - increment that team's current-set score;
  - flip the **serve/possession** indicator on a **side-out** (serve won by the non-serving team);
  - re-evaluate **set point / match point** (target − 1, win-by-2 aware, cap aware);
  - detect **set completion** (≥ target AND lead ≥ 2, OR cap reached) and **match completion** (sets-to-win reached);
  - stamp a **timestamp** (for set duration + rally-run derivation).
- `undo` — LIFO, must reverse across set boundaries (100-deep), because the whole score derives from the point sequence.

**Set/match lifecycle (engine-derived, operator-confirmed):**
- set-won transition → carry set scores into the set-box strip, reset current-set points, **swap the deciding-set target if configured**, re-arm serve for the new set.
- match-won → final result + margin.

**Optional enrichment (Guided / rosters only — never a scorer tax):**
- `fault reason` on the just-scored point — from the real fault vocabulary (below). Tags *why* the point was won for stats.
- `serve manual override` — for the rare mis-detected side-out.
- `timeout` — light counter (typically **2 per team per set**, ~30 s) — casual scorers ignore it.
- `substitution` — squad-of-12, up to 5 subs; roster-mode only.
- `rotation` — clockwise on winning service (volleyball-style). **Casual play does not rotate at all** — Isha's grassroots women's rules explicitly use the *"Standing Player Method"* (fixed positions, no rotation). Rotation is opt-in, display-only at most, never a blocker.

### Real fault vocabulary (for enrichment, plain-English)
From SGFI / Sportsmatik / RulesOfSport: **juggling** (ball bobbles on the catch), **double touch / double contact** (caught and bounced twice), **holding > 3 s** (delay), **service fault** (served > 5 s after whistle, served into the net, foot over the back line, release below shoulder), **catch fault** (dropped / one-handed / off the body), **two players catch simultaneously**, **net touch**, **ball into net**, **out of bounds / dead ball** (lands in the free/neutral box or outside), **passing** (any inter-teammate transfer — illegal). Each collapses to "point to the other side"; the type is only stat colour.

---

## 2. How real scoreboards & broadcasts present it

There is no bespoke throwball broadcast graphics package in the wild — throwball at Khelo India University Games / state meets is streamed on **DD Sports / Prasar Bharati YouTube / Waves OTT** with a generic feed, and venue scoreboards are shared with volleyball. So the honest reference is the **volleyball score bug**, which throwball inherits 1:1 because the state to convey is identical (two teams, sets, current-set points, whose serve, set/match point).

### THE MAIN SCOREBOARD — what a courtside viewer reads at a glance (must-have, in priority order)
Per Wikipedia *Score bug* + KeepTheScore volleyball scorebug spec, a viewer needs, in one glance:
1. **Two team identities** — name/abbreviation + team **colour** (and crest where available). Home left, away right — the fixed spatial convention.
2. **Current-set points** — the two big live numbers, the thing the eye lands on first.
3. **Sets won** — a small per-side sets tally (e.g. `1`–`0`), usually distinguished by size/colour or a set-boxes row. This is *the match state*; the point score alone is meaningless without it.
4. **Serve indicator** — an **arrow / dot / triangle** beside the team currently serving. In volleyball this is universal; in throwball it is the possession cue.
5. **Set-point / match-point cue** — a small flag/glow when a team is one point from taking the set or match. KeepTheScore explicitly calls out "match point indicators" as core production value.

That five-element read = the brief's scorer/spectator hero + set-box strip + serve marker + escalation ladder. It is the correct anatomy; our job is to render it in the design1-mono record grammar rather than reinvent the layout.

### The set-boxes row (the scorebook's own row)
Volleyball scoreboards render a **per-set score grid** — one column per set showing each set's final (e.g. `25–22 · 23–25 · 15–11`) with the live set highlighted. This is the direct analogue of cricket's over-strip record chips and doubles as **match progress** at a glance. It is the highest-value "read a fact off it → hard/brutalist" element in the whole surface.

### Richer broadcast overlays (spectator-tier, not scorer-tier)
Where volleyball broadcasts (and the better OBS scorebug tools — KeepTheScore, ScoreboardMax, TrackScore) go beyond the bug:
- **Set-win / match-point celebration animations** — a scored-set flourish, an escalating match-point banner.
- **Timeout & substitution states** on the bug (timeout counter, TO clock).
- **Momentum / run indicators** — "on a 5-0 run," point-streak call-outs. Rally-point scoring produces visible runs; this is throwball's signature live beat (§5).
- **Team-colour theming + logos + lower-third integration** — the bug sits in the lower third / top corner, transparent, updating live as the scorer taps.
- **Per-set duration, longest rally** — derived from point timestamps.

**Design consequence:** the scorer surface should present the *five-element main bug* only (lean); the spectator/scorecard surfaces layer the richer overlays (runs, per-set breakdown, celebrations) — exactly the brief's detail-by-surface split.

---

## 3. India school / college / ground variants — what casual scorers actually need vs pro

The real ICP evidence (Isha Gramotsavam grassroots rules; Pondicherry/Tumkur/Don Bosco inter-collegiate women's tournaments; SGFI schools) shows a wide, messy variant space:

| Dimension | Pro / Federation (ITF, senior) | College / University | School / Ground / Village |
|---|---|---|---|
| Set target | 25, win-by-2, cap 27 | 15 (often), sometimes 21 | 15, local cap ~17 |
| Match | best-of-5 possible | best-of-3 | best-of-3, often best-of-1 for early rounds |
| Deciding set | 15 | 15 or **11** (short decider) | 11 |
| Squad | 7 + 5 subs (12) | 7 + up to 5 | **7 + 1 to 7 + 3**, may play with **6** (Isha) |
| Rotation | tracked (clockwise) | rarely tracked | **none — "Standing Player Method"** (Isha) |
| Scoring model | rally-point (ITF) | mixed — many still say side-out | often side-out in operators' heads |
| Timeouts | 2/set enforced | loosely | ignored |
| Officiating | certified referees, paper score sheet | one teacher + volunteers | one PT teacher on a phone |

**What the casual scorer actually needs (and nothing more):**
- **A preset that sets everything in one tap** (College 15/bo3/short-decider/cap17 · School 15/bo3 · Federation 25/bo5) so they never touch a rulebook.
- **Two big point buttons and an always-visible undo.** That's the workhorse. Isha's own rules literally reduce the game to "standing players, catch-throw, first to target" — the casual mental model is that simple.
- **Automatic set/match detection** with win-by-2 + cap awareness — the exact math casual scorers get wrong and the thing every generic +/- counter fails to do.
- **Plain-English confirmation of what just happened** ("Blue House take Set 2, 15–12 — match level 1–1") — because the scorer is often the same person reporting the result up a WhatsApp chain.
- **Serve indicator: probably spectator-only for casual.** Under rally-point, serve doesn't change the score, so for a village/school scorer it is arguably clutter; keep it prominent for federation, demote for casual. (Open question #3 in the brief — evidence here leans "demote for casual.")

**What the casual scorer does NOT need (pro-only):** rotation tracking, per-player stat entry, timeout enforcement, substitution logging, fault-type tagging. All of these appear in the *Ultimate Throwball Scoreboard* app and are exactly the features a PT teacher never touches.

---

## 4. GAPS — what existing throwball scoring apps don't do (the opportunity)

Throwball is **digitally underserved**: unlike cricket (CricHeroes, 1.1 M+ installs, wagon-wheel/Manhattan/worm analytics) throwball has essentially **one dedicated app** — *Ultimate Throwball Scoreboard* (Aarya Studios) — plus generic multi-sport counters (Virtual Scoreboard, ScoreCount). What the incumbent does and fails to do:

**What Ultimate Throwball Scoreboard does:** customisable sets + points, a rotation board, timeout timer + counter, share set scores via WhatsApp/email, reset rotation per set. It is a competent *digital score sheet*.

**Where it (and every generic counter) falls short — our opening:**
1. **No rule intelligence.** It's a manual counter — the operator must know win-by-2, the cap, the short-decider, when the set is actually over. Nothing detects set/match point or completion. **We auto-detect all of it.** This is the single biggest gap.
2. **No preset for Indian variants.** The user hand-configures sets/points every match. No "College / School / Federation" one-tap. **We ship presets grounded in the real ICP ranges.**
3. **No live spectator experience.** Sharing is a static text of set scores over WhatsApp — there is no live, watchable link, no viewer presence, no reactions. Cricket has ball-by-ball live pages; throwball has nothing. **A shareable live page is a category-defining feature here.**
4. **No momentum / drama layer.** Rally-point scoring produces runs and set-point tension; no throwball tool surfaces "on a 6-0 run" or a match-point moment. **This is our signature (§5).**
5. **No result artefact.** No designed result card ("Blue House win 2–1 · 15–12, 9–15, 11–8"), no shareable scorecard, no player-of-the-match. Cricket-grade result peaks don't exist for throwball. **We port the cricket result/share trio.**
6. **Serve/possession is either ignored or over-engineered** (a full rotation board no casual scorer uses). **We render a single clean serve marker, auto-flipped on side-out, and gate rotation behind opt-in.**
7. **Foregrounds a rotation board casual women's/school play doesn't even use** (Isha = Standing Player Method). The incumbent optimises for the pro minority; we optimise for the student-volunteer majority — *mis-scoring nearly impossible* — while keeping a federation path.
8. **The scoring-model ambiguity is unaddressed.** No existing tool tells the operator whether it's counting rally-point or side-out; ours states it plainly and leaves the seam.

**Net:** the bar is low and the whitelisted feature space (rule-aware engine + presets + live spectator + drama + result artefact) is wide open. This is a "first genuinely good throwball app" opportunity, not an incremental improvement.

---

## 5. Moments that matter (drama beats) + spatial data worth a tracking layer

### Signature drama beats (worth bespoke animation, reduced-motion gated, budget-respecting)
1. **Set point → the escalation.** One point from taking a set: the record escalates neutral → `--se-color-warning-soft` (set point) → `--se-color-danger-soft` (match point). The *conversion* (winning that point) fires the set-won transition. This is throwball's most reliable per-set tension beat and maps exactly to volleyball's "match point indicator."
2. **Match point / match won → the result peak.** Gold milestone card, plain-English margin ("Blue House win 2–1"), set line in mono, optional Player-of-the-Match. The one designed peak.
3. **Point run / rally momentum → THE signature live beat.** Rally-point scoring means one side often reels off 4-5-6 straight points; this swing is the emotional core of a throwball set and is *invisible in every existing tool*. A **run badge** ("Blue on a 6-point run") animating in on the spectator view when a run threshold is crossed — CSS-only, pulse reserved for live — is the highest-leverage signature moment. It is throwball's answer to a cricket "hat-trick" call-out and it is completely unclaimed digitally.
4. **Side-out swing (federation/serve-shown mode):** breaking the opponent's serve run — a smaller cue, spectator-tier.
5. **Deciding set / short decider start:** the "Set 3 → to 11" moment carries its own tension; surface the target change explicitly.

### Spatial / positional data worth an interactive tracking layer
Cricket's wagon-wheel is the template: a free, glanceable spatial story derived from cheap capture. Throwball's honest analogues (in descending realism for the ICP):

- **Serve / throw target-zone tracking (closest cousin to volleyball, most viable).** Divide the receiving half into zones (e.g. a 3×3 grid, or simple deep/short × left/centre/right). On a point, an optional tap-to-place records *where the winning throw or serve landed* (or where the receiving fault occurred). Aggregated → a **serve/throw heat grid** per team/player: "72% of Blue's winning serves landed deep-right." This is the direct transplant of the salvaged cricket *tap-to-place* enrichment (Power/Guided-only, deferred, opt-in) and is the single most defensible spatial layer — the court is small, zones are few, and it needs one extra tap.
- **Rally-momentum worm / run bar.** A CSS-only momentum strip across the set (who scored each point), encoding runs — the "worm" of throwball. Derivable *for free* from the point sequence already captured (no extra tap). Ship-able early; the run badge (§5.3) reads off the same data.
- **Set-point-pressure map.** Which team converts set points / saves them — a small clutch stat derived purely from timestamps + score state, no extra capture.
- **Serve-run / side-out map (federation).** From whose-serve history: longest serve run, side-out conversion rate.

**Sequencing recommendation:** momentum worm + run badge first (free from atomic events, universal appeal, unclaimed by any competitor); serve/throw target-zone tap-to-place second (opt-in enrichment, the wagon-wheel analogue) once rosters/Guided mode exist; per-player heat and rotation-position data last (federation-only, opt-in). This keeps the casual scorer at one tap while giving the spectator/scorecard surfaces a genuinely novel spatial story no existing throwball tool offers.

---

## 6. One-paragraph handoff to design

Model the game as a **rally-point set engine** over a single atomic `point → {A|B}` event, with automatic side-out serve-flip, win-by-2 + cap + per-set-target (short-decider) awareness, and set/match completion detection — the exact intelligence every existing throwball tool lacks. Render the **volleyball-score-bug anatomy** (two colours + big current-set points + sets-won + serve marker + set/match-point escalation + set-boxes row) in the design1-mono record grammar. Lead the casual path with **one-tap presets** (College/School/Federation) and an always-visible undo; gate rotation, timeouts, per-player stats, and fault tagging behind opt-in. Make the **live spectator page + point-run momentum badge** the category-defining differentiators, and reserve the **serve/throw target-zone tap-to-place** as the deferred wagon-wheel-analogue enrichment. Handle the **rally-point vs side-out real-world ambiguity** explicitly in setup copy, and never uppercase a woman's name.
