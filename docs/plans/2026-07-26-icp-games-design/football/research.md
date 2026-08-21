# ScoreEasy — Football: Real-World Research

**Date:** 2026-07-26 · **Status:** RESEARCH (feeds the bespoke design brief) · **Game:** Association Football — Indian college / university / turf-ground ICP.
**Method:** Follows the cricket exemplar — study how the game is *actually* scored and broadcast in the real world (TV score bugs, stadium boards, official federation apps, popular consumer apps), then extract the exact operator capture model, the scoreboard anatomy, the ICP variants, the gaps, and the drama beats worth a signature layer. Grounds the `design-brief.md` decisions in real references, not invention.

---

## 1. How the game truly works + the exact events an operator must capture

### 1.1 The shape of a match (the clock is football's "over count")
Football's record is organised around a **single running match clock that counts UP**, not down — this is the defining broadcast fact (Sky's David Hill introduced the persistent count-up clock precisely so a viewer tuning in mid-match instantly knows where they are; [Wikipedia — Score bug](https://en.wikipedia.org/wiki/Score_bug)). The clock is the spine every event hangs off, exactly as the ball/over count is cricket's spine.

Standard 11-a-side structure:
- **Two halves** of 45 min + **half-time** interval.
- **Stoppage/added time** appended per half at the referee's discretion (the "90+3'" the fourth official's board shows). The clock never stops on TV — it keeps counting into 45+ and 90+.
- Optional **extra time** (2 × 15 min) then a **penalty shootout** for knockouts that must produce a winner.
- **Draws are a first-class, common result** in league/group play — unlike cricket, "no winner" is a normal outcome, not a failure state.

The atomic truth: **the team score is a derived total of attributed goal events.** A scoreline of "2–1" is shorthand for three goal rows, each with a scorer, a minute, and a side. This is the cricket lesson restated — *the number is a projection of the ledger, never the primary input.*

### 1.2 The exact events an operator must capture (precise)
This mirrors what the FA's official grassroots stack asks a volunteer to enter. The FA **Matchday app → Full-Time match return** flow captures, per match: final score, **goalscorers, assists, yellow cards, red cards, starters and substitutes** ([FA Grassroots — Submitting a Match Report](https://grassrootstechnology.thefa.com/support/solutions/articles/48001073161-submitting-a-match-report-match-returns-in-matchday-app); [FA — Entering player statistics on Full-Time](https://grassrootstechnology.thefa.com/support/solutions/articles/48001026721-entering-player-statistics-on-full-time)). That is the real-world minimum operator record. Precisely:

**A. GOAL** — the atomic scoring event. Capture:
- `team` (which side's total increments),
- `scorer` (player),
- `assist` (player, optional),
- `minute` (match clock + stoppage, e.g. `90+2`),
- `type` (open-play / penalty / free-kick / header / own-goal — optional enrichment; minute + scorer are the load-bearing record).
- **Own-goal is the single most-fumbled rule for casual scorers:** it credits the *opponent's* team total but is attributed to the *conceding* player, and must **never** add to anyone's personal goal tally. It has to be structurally distinct from a normal goal in the model, not a "type" flag a rushed operator can forget — otherwise the top-scorer table is corrupted the moment an own-goal happens.
- **Penalty vs open-play** matters for stats but not for the scoreline; a penalty in a shootout is a *different event class* (see E) from a penalty scored in normal play (which is just a Goal with `type=penalty`).

**B. CARD** — `yellow` or `red`. Capture `player`, `team`, `colour`, `minute`. The engine must **derive send-offs**: two yellows to the same player = automatic red = player off + team plays a man short for the rest of the match; a straight red = same. The casual-scorer trap is logging a second yellow as "just another booking" instead of a send-off — the model has to auto-flip the team to short-handed and surface it, not rely on the operator to remember.

**C. SUBSTITUTION** — `playerOff` (from the on-pitch list) → `playerOn` (from bench / quick-add), `minute`. Feeds minutes-played and "who is currently on the pitch," which in turn gates *who can score or be carded*. College football frequently uses **rolling / unlimited subs**, so the model must not hard-cap sub count.

**D. CLOCK LIFECYCLE** — start / pause, **end of half → half-time → start second half**, **+stoppage** typed by the operator, optional **start extra time**, **start shootout**. This is entirely absent from the generic counter today and is the football-specific state machine.

**E. PENALTY SHOOTOUT** (knockouts) — its *own* mini-surface, not the goal keypad: alternating takes, each kick `scored` / `missed`, best-of-5 then **sudden death**. Produces a separate "won 4–3 on penalties" result line; shootout goals do **not** count toward the match scoreline or a player's goal tally.

**Derived-only, never entered:** team goals-for/against, goal difference, points, clean sheet (0 conceded), a player's goals/assists/cards, minutes played (from subs + send-offs + kickoff), brace/hat-trick, short-handed state, result W/D/L. The operator enters *events*; the app derives *everything else*. **Anti-goal (the cricket lesson):** if the operator can raise the score without saying who scored, we have rebuilt the generic +/- counter.

---

## 2. How real scoreboards and broadcasts present it

### 2.1 The MAIN SCOREBOARD — what a viewer reads at a glance
Football carries the **leanest** score bug of any major sport — deliberately. Where an NFL bug crams down-and-distance, possession arrow, timeouts, play clock and red-zone flag, the soccer bug is stripped to the essentials: **team abbreviations/crests, the two-digit scoreline, and the count-up clock** ([keepthescore — Broadcast Scorebugs by Network](https://keepthescore.com/blog/posts/score-bugs-in-live-sports-broadcasts/); [scoreleader — What is a score bug](https://scoreleader.com/what-is-score-bug/)). It lives in the **top-left or top corner**, over the empty stand area, alongside the broadcaster logo — the top ~15% of frame that is always crowd, never action ([Medium — The Football Score Bug case study](https://medium.com/whoisjuan-journal/the-football-score-bug-a-case-study-on-creating-innovative-digital-on-screen-interfaces-9da29101c92a)).

**Glance-anatomy (the four things a viewer reads in <1 second), Premier League / Sky / ESPN convention:**
1. **Two team identities** — 3-letter code or crest (`MUN 2 – 1 ARS`), home listed first.
2. **The scoreline** — the two big numerals, the emotional payload.
3. **The count-up clock** — `67:14` or just `67'`, ticking up; goes `45+2`, `90+3` in stoppage.
4. **State riders** (small, only when true) — a red **●LIVE** dot, `HT` / `FT` stamps, a small **🟥** next to a team that's gone down to ten, and increasingly the **fourth-official stoppage number** (`+4`).

That is the whole main board. The design lesson for ScoreEasy: the hero must be **`TEAM A  n – n  TEAM B` + a big count-up clock + half indicator**, and almost nothing else — resisting the temptation to hang stats on it. Richness belongs to the overlay/spectator layer, not the persistent bug.

### 2.2 The richer broadcast overlays (what gets summoned, not persistent)
On top of the minimal bug, broadcasters pull **transient full-width overlays** at moments and at breaks. Concrete real-world examples:
- **Lineup / formation graphic** pre-match (starting XI on a pitch shape).
- **Goal caption** — full-width lower-third naming **scorer + minute + new scoreline** the instant a goal is confirmed ("⚽ RASHFORD 67' — Man Utd 2–1"). This is the single most important transient graphic and the direct analogue of cricket's boundary/wicket flash.
- **Stat-comparison panel at half-time / full-time** — the FIFA World Cup / UEFA convention: **possession %, shots, shots on target, corners, fouls, yellow/red cards**, shown as paired bars ([keepthescore](https://keepthescore.com/blog/posts/score-bugs-in-live-sports-broadcasts/) notes majors add "possession percentage, shots on goal, or yellow and red cards").
- **Substitution graphic** — ⬆️ player on / ⬇️ player off with minute.
- **xG and momentum graphics** — modern broadcasts (and the leading apps below) show **cumulative expected-goals as a timeline** and a **momentum/pressure wave** — advanced-analytics overlays that a decade ago were studio-only.

**The consumer-app second screen** is where football's data presentation is now richest, and it sets the bar our spectator surface is measured against:
- **Sofascore** — deepest live data: **player heatmaps, a shot map with xG per attempt, live-updating player ratings after every event, and a ball-movement match animation** ([tikitaka — Best Football Stats Apps 2026](https://www.tikitaka.gg/best-football-stats-apps); [footyapps — FotMob vs Sofascore](https://footyapps.com/guide/fotmob-vs-sofascore)).
- **FotMob** — the cleanest presentation: **a cumulative-xG timeline graph, a match-momentum wave, a shot map, heatmaps, and a 300-stat player-rating engine**, all in a readable design ([FotMob official](https://fotmob.us/football-live-scores/); [tikitaka](https://www.tikitaka.gg/best-football-stats-apps)). FotMob's **"attack momentum" wave** — a horizontal bar swinging toward whichever side is pressing — is the signature at-a-glance "who's on top right now" graphic and is directly portable to our momentum-bar candidate.

**Takeaway for the blend:** the *main board is brutalist and minimal* (scoreline + clock, the record); the *overlays and spectator app are the soft, rich conversation* (scorer captions, momentum, shot map, ratings). This maps one-to-one onto the ScoreEasy rubric — "the record is brutalist, the conversation is soft."

---

## 3. India school/college/ground variants + what casual scorers actually need

### 3.1 The formats that actually dominate the ICP
The 11-a-side full match is the *minority* of matches actually played by this ICP. The reality on Indian college grounds and commercial turfs:
- **5-a-side and 7-a-side turf football dominate casual play.** Seven-a-side is a recognised mini-football variant on a 50–65 yd × 25–50 yd pitch ([Wikipedia — Seven-a-side football](https://en.wikipedia.org/wiki/Seven-a-side_football)); commercial "5-a-side / mini football turf" venues are a standard product across Indian cities ([IndiaMart — football ground turf](https://www.indiamart.com/speedsafetynets/football-ground-turf.html)). These games run **shorter halves** (2×15, 2×20, or a single running clock), **smaller squads**, **rolling/unlimited subs**, frequently **no offside**, often **no cards** (or cards as social-only banter), and **size-2 goals with no goalkeeper-rush rules**.
- **Slot-limited bookings** (a turf is booked for a 60- or 90-minute slot) drive **golden-goal / next-goal-wins** deciders instead of full extra time — you cannot run 30 extra minutes when the next team is waiting.
- **College / university tournaments** run closer to 11-a-side with real halves and cards, feeding a **standings table + knockout bracket** — the structure the existing `GenericGoalsTournament` shell already models (GF/GA/GD/Pts). AIFF's refereeing sits on an 8-level ladder ([AIFF — Referee courses](https://www.the-aiff.com/referee-courses)), but the *scorer* at a college fixture is almost never a certified official — it's a student volunteer with a phone.

### 3.2 What the casual scorer actually needs (vs the pro)
The operator is a **student volunteer or a friend, pitch-side, one phone, sun glare, no tripod** — not a trained statistician. What that means concretely:
- **Loose rosters.** Teams arrive as a WhatsApp list; jersey numbers are improvised; a "+1 guest" appears mid-tournament. The scorer must be able to **quick-add a player by name/number mid-match** and attribute a goal to **"Unknown #7"** without the goal being blocked. (This is the football twin of cricket's "attribution never blocks the log" rule.)
- **A goal is never blocked on data.** Tap GOAL → confirm → attribute *later or never*. The scoreline must always be capturable in the two seconds after the ball crosses the line; scorer/assist enrichment is a fast follow, not a gate.
- **Format-preset defaults that ripple.** Pick "5-a-side turf" once and the app should hide cards, shorten the clock, enable rolling subs, drop offside — the operator should not tune ten toggles. Pick "college 11-a-side" and cards/halves/stoppage come back on.
- **Draw is a real result.** The scorer/spectator must present "Draw 2–2" as a finished, first-class outcome — not a match still waiting for a winner.
- **The share artifact is the point.** College crowds screenshot and share; the deliverable a casual scorer wants at full-time is a clean result card (scoreline, scorers, MOTM) they can drop into a WhatsApp group — the same job FA Full-Time's match return does officially, but instant and beautiful.

The pro tools (Sofascore/FotMob-grade heatmaps, xG, 300-stat ratings) are **read-side luxuries computed from rich event streams the pro leagues have** — the casual scorer will never *enter* the data those need. Our job is to capture the *thin, honest event ledger a volunteer can actually maintain* (goals+attribution, cards, subs, clock) and then present it as richly as the ledger allows — never demanding pro-grade input for casual-grade play.

---

## 4. GAPS — what existing scoring apps DON'T do well (the opportunity)

Football is far better served than volleyball/kabaddi digitally, but the existing tools split into two camps that **both miss the Indian casual/college ICP**:

**Camp A — the pro/fan second-screen apps (Sofascore, FotMob).** World-class *consumption*, but **read-only and top-down**: they show you Premier League and ISL matches sourced from official data feeds. **You cannot score your own college or turf match in them.** They are a TV companion, not an operator tool. Gap: **zero self-serve scoring for an unlisted grassroots fixture.**

**Camp B — the grassroots scorer/team apps (FA Grassroots Football Scorer, TeamStats, Footy Genius, FA Matchday/Full-Time).** These *do* let a volunteer capture goalscorers, assists, cards, subs and generate a match report ([AppBrain — Grassroots Football Scorer](https://www.appbrain.com/app/grassroots-football-scorer/com.thistleapps.gfscorer); [TeamStats](https://apps.apple.com/gb/app/teamstats-football-team-app/id1275644100); [Footy Genius](https://footygenius.co.uk/)). But:
- They are **UK/FA-affiliation-shaped** — built around FA league admin, county affiliations and Full-Time match returns — **not the Indian college/turf reality** (no 5/7-a-side turf presets, no golden-goal, no rolling-subs default, no "Unknown #7" tolerance).
- Their scoring UI is **form-first, not thumb-first** — data-entry screens, not a one-handed pitch-side console under sun glare.
- The **share/celebration artifact is weak** — a match report is an admin document, not a screenshot-ready result card the college crowd wants.
- **No live spectator layer for the specific match** — a friend can't watch the score of *this* turf game update live with reactions; that experience only exists for pro fixtures.

**The concrete opportunity (do-better list):**
1. **Self-serve scoring for any grassroots match** with the *rich* live/spectator layer that today only exists for pro games — close the Camp A / Camp B split.
2. **India-native format presets** (5/7/11-a-side, turf golden-goal, rolling subs, cards-off) as first-class, not edge cases.
3. **A goal is never blocked** — instant scoreline + deferred/"Unknown" attribution; loose-roster and quick-add tolerance no FA-shaped app has.
4. **Own-goal + second-yellow→red handled structurally** so casual scorers can't corrupt the top-scorer table or forget a send-off (the two rules every casual scorer fumbles).
5. **A beautiful, instant, shareable result card + live link** — the thing the ICP actually wants and no grassroots tool delivers well.
6. **A tournament that stitches matches into standings + Golden Boot / assists / cards leaderboards** — the existing standings shell already does GF/GA/GD/Pts; a **top-scorers leaderboard across a tournament is a high-value, near-free derived asset** the generic path can't produce and the ICP will love.

---

## 5. The moments that matter (drama beats) + the interactive tracking layer

### 5.1 Drama beats worth a signature animation
Football is the most emotionally spiked of these games — it is built around a small number of huge, discrete moments. Ranked by weight:
1. **THE GOAL** — the primary peak, and football's whole reason for existing. Real broadcasts fire a full-width scorer caption the instant it's confirmed. Ours: **score-numeral pop (reuse cricket's score-pop) + a brief scorer-name flourish** on the spectator surface. Reduced-motion gated. Basic ships; tiered "screamer / late winner" variants future-flagged.
2. **THE LATE WINNER / stoppage-time goal** — a goal in `90+` is categorically more dramatic than a goal in the 20th minute; the same goal event, escalated by *when* it lands. Worth a distinct, hotter treatment.
3. **RED CARD / send-off** — the secondary peak and a genuine swing: a team going to ten men reshapes the match. A **restrained danger-tinted banner + short-side hero update** ("Engineering down to 10 — 67'"). Never a full-bleed red slab (rubric law — resting red = "delete").
4. **HAT-TRICK / BRACE** — a personal milestone. **One gold milestone card** (one-gold-per-screen enforced), human sentence in sans ("Ravi with the hat-trick — 3 in 27 minutes"), figures line in mono.
5. **FINAL WHISTLE / RESULT** — the designed end peak: plain-language margin ("won 3–1", "drew 2–2", "won 4–3 on penalties"), both teams in mono with the loser at reduced opacity, MOTM card, 3-up stat tiles, Share / Rematch CTAs.
6. **THE SHOOTOUT** — sudden-death tension, per-kick reveal (scored/missed). Ship a functional grid first; future-flag the animated reveal.
The pulse stays reserved for *genuinely live* only; nothing decorative moves (rubric law).

### 5.2 The interactive tracking layer — football's "wagon-wheel"
Cricket's signature spatial layer is the wagon-wheel (shot placement from the batter). Football's equivalents, ranked by input-cost against what a casual scorer can actually feed:

- **Minute-by-minute timeline (SHIP — the centrepiece).** The vertical, minute-ordered event feed — goals ⚽ (scorer • assist), cards 🟨🟥, subs ⇄ — is football's spine and doubles as the record, the spectator centrepiece, and undo-context. It is the football analogue of cricket's over-strip and needs **zero extra input** beyond the events already captured. **This is the primary interactive layer.**
- **Momentum bar (SHIP-candidate, low input-cost).** FotMob's "attack momentum" wave and Sofascore's pressure graphics are the at-a-glance "who's on top" ([tikitaka](https://www.tikitaka.gg/best-football-stats-apps)). A **CSS-only momentum bar** derived purely from the existing event stream (goals, cards, recent event density weighted by recency) — no new operator input — is a high-value, honest approximation. It must be *derived and labelled as such*, never faked from data we don't have (the cricket win-prob discipline).
- **Goal takeover.** The full-surface moment when a goal lands — the spectator's screen briefly becomes the goal caption (scorer, assist, minute, new scoreline) before settling back to the timeline. The interactive/animated expression of drama beat #1.
- **Pitch event map / shot map (FUTURE-FLAG — the true wagon-wheel analogue, higher input-cost).** Sofascore/FotMob's shot map plots **goal and shot locations with xG** ([footyapps](https://footyapps.com/guide/fotmob-vs-sofascore)). The honest read for the ICP: **a full shot map needs shot-by-shot tap-to-place input a one-handed pitch-side volunteer will not sustain** — the same reason cricket kept wagon-tap-to-place as an *optional, deferred* enrichment layered onto boundary entry, not a required mode. Recommendation: **ship the timeline + momentum bar first; offer an optional tap-to-place "where did the goal go in / where was it scored from" enrichment on the goal-attribution flow** (a single optional tap per goal, not per shot), which feeds a **goal-location map** without demanding a stats analyst. The full shot map is a pro-data luxury; the goal-location map is the casual-honest version.

**Design conclusion:** the timeline is the guaranteed spatial/temporal record; the momentum bar is the low-cost "feel"; the goal-location map is the optional wagon-wheel-style enrichment (one tap per goal, deferred); the full xG shot map stays out of scope for casual input, exactly as cricket ruled the full gesture-mode wagon out as a required path.

---

## Sources
- [Wikipedia — Score bug](https://en.wikipedia.org/wiki/Score_bug)
- [Medium — The Football Score Bug: a case study](https://medium.com/whoisjuan-journal/the-football-score-bug-a-case-study-on-creating-innovative-digital-on-screen-interfaces-9da29101c92a)
- [keepthescore — Broadcast Scorebugs by Network (2026)](https://keepthescore.com/blog/posts/score-bugs-in-live-sports-broadcasts/)
- [scoreleader — What is a score bug](https://scoreleader.com/what-is-score-bug/)
- [FA Grassroots — Submitting a Match Report (Matchday app)](https://grassrootstechnology.thefa.com/support/solutions/articles/48001073161-submitting-a-match-report-match-returns-in-matchday-app)
- [FA Grassroots — Entering player statistics on Full-Time](https://grassrootstechnology.thefa.com/support/solutions/articles/48001026721-entering-player-statistics-on-full-time)
- [AppBrain — Grassroots Football Scorer (Android)](https://www.appbrain.com/app/grassroots-football-scorer/com.thistleapps.gfscorer)
- [TeamStats — Football Team App](https://apps.apple.com/gb/app/teamstats-football-team-app/id1275644100)
- [Footy Genius — grassroots stats web app](https://footygenius.co.uk/)
- [tikitaka — Best Football Stats Apps 2026 (xG, heatmaps, ratings)](https://www.tikitaka.gg/best-football-stats-apps)
- [FotMob — Live Scores & Match Stats](https://fotmob.us/football-live-scores/)
- [footyapps — FotMob vs Sofascore (2026)](https://footyapps.com/guide/fotmob-vs-sofascore)
- [Wikipedia — Seven-a-side football](https://en.wikipedia.org/wiki/Seven-a-side_football)
- [AIFF — Referee courses (8-level ladder)](https://www.the-aiff.com/referee-courses)
- [IndiaMart — football ground turf (5-a-side / mini)](https://www.indiamart.com/speedsafetynets/football-ground-turf.html)
