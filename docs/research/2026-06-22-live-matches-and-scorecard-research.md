<!--
Provenance: synthesized 2026-06-22 from an 8-dimension multi-agent research fan-out
(architecture/competitors, moderation/safety, set-sport scorecards, tennis, cricket,
goals/generic scorecards, Convex real-time, feed/commentary UX). Feeds the design doc
docs/plans/2026-06-22-live-matches-and-scorecard-design.md. The feed/commentary UX
section is expanded in docs/research/2026-06-22-feed-and-commentary-ux.md.
-->

# Live Match Streaming & Realistic Point-by-Point Scorecards — Research Report

## 1. Executive Summary

This research backs a two-part feature for Score Easy: (A) a **live match broadcast/spectate system** (one scorer, many signed-out viewers, share-by-link plus an opt-in global "Watch Live" feed) and (B) a **broadcast-grade point-by-point scorecard** layer across every sport family. The conclusions are convergent and actionable:

- **Score Easy is squarely an amateur self-scoring app** (the GameChanger / ScoreBeam / KeepTheScore / JudgeMate lane), not a pro aggregator (ESPN / Flashscore). Copy category-2 share/spectate UX; borrow category-1 *visual language* for the discovery feed only.
- **The MVP broadcast primitive is the ScoreBeam triple-path share** — QR code + 6-char match code + share link — resolving to a read-only spectator route `/live/:token`. No social/follow graph needed for v1.
- **Convex reactive queries eliminate the hardest part of the standard architecture.** Competitors hand-build WebSocket servers, SSE replay buffers, and Last-Event-ID reconnection for late-join. Convex's managed subscription makes a late joiner's `useQuery` return current state for free. We build a **good schema, not a streaming stack**. The canonical design is a **split-document**: one tiny denormalized snapshot doc per match + a separate append-only event log.
- **The global public feed is the risk multiplier, not the live link.** Apple Guideline 1.2 (filter + report + block + contact/EULA) is **release-blocking** for any public UGC surface, and youth-sports COPPA exposure (a minor's name on a browsable page is a "disclosure") forces a default-private, link-only-for-youth, name-redaction model. These are MVP gates, not backlog.
- **Volleyball is the scorecard superset.** Build it completely (rally serving flag, win-by-2 no-cap, technical timeouts, set-5 tie-break with side switch); the other four net sports plus tennis/cricket/goal-sports are then config + presentation variants over a shared event model. The **sport-agnostic generic scorecard** (manufactured line-score + broadcast meta-stats from the event stream) is the highest-leverage single component — it gives "official feel" to *any* +1/+N game, including silly custom ones.

**Canonical naming used throughout this report** (reconciling three findings that named things differently): the snapshot table is `matches`, its public capability is `token`, and the log is `matchEvents`. Where finding text said `liveMatches`/`shareCode`, read `matches`/`token`.

---

## 2. Real-Time Architecture & Competitor Patterns

### 2.1 Two market categories — pick the right one to copy
| Category | Examples | Data source | Who scores | What to copy |
|---|---|---|---|---|
| Pro aggregators | ESPN, Flashscore, SofaScore, FotMob, theScore | Official league feeds | Nobody (you) | Discovery-feed *visual language*, live-pulse flash |
| Amateur self-scoring | GameChanger, ScoreBeam, KeepTheScore, JudgeMate, SidelineHD, TeamSnap, VolleyStation | The user | One person | Share/spectate UX, read-only viewer link, kiosk view |

Score Easy is category 2. Free shareable live scoring is **table stakes** there (ScoreBeam, JudgeMate, KeepTheScore, SidelineHD all give it away; GameChanger keeps volleyball streaming free), not a premium feature.

### 2.2 Share mechanism — adopt ScoreBeam's triple path
Spectators, players, and display screens join **by QR code, link, or match code** — three parallel routes to one live match. KeepTheScore/JudgeMate add the key split: scorer holds a **secret edit link**, fans get a **read-only viewer link** that "stays in sync everywhere." GameChanger/Hudl/TeamSnap instead use an in-app *follow* graph — **skip that for v1** (it requires accounts and a social graph; link/code sharing has zero friction).

**MVP share sheet (`ShareLiveMatch.jsx`)** — Capacitor-friendly bottom sheet, three elements:
1. Big client-rendered **QR** (qrcode.react) encoding `https://scoreeasy.app/live/{token}`.
2. The **6-char match code** as monospace `ABC-123` (800-weight, 0.08em tracking) with copy button.
3. **Share link** button → Capacitor Share plugin (native sheet) / `navigator.share` fallback.

Mono treatment: 0px-radius QR card with `4px 4px 0 var(--primary)` hard-offset shadow (a *decision moment* → brutal hero). Copy sets the read-only expectation: *"Anyone with this can WATCH. They can't change the score."*

### 2.3 Spectator view = a live scoreboard, not video
Amateur spectator views are scoreboards (GameChanger's GameStream = animated play-by-play + scoreboard + box score; video is a separate paid add-on). The volleyball spectator kiosk consensus (JudgeMate/KeepTheScore/VolleyStation): big current-set score, set count, completed-set results row, and a **serve indicator** — the single most-wanted spectator element. Treat a **gym TV/projector as a first-class join target** (`?kiosk=1` chromeless variant, huge type).

### 2.4 Discovery "Live" feed pattern (universal across pro apps)
A top-level tab filtered to in-play matches only; a **sport selector** in the top bar; a **live pulse** that flashes a row the instant an event happens ("you know at the same time as the live audience"); a personalization layer floating followed teams to the top. We adopt the look but gate it behind opt-in (see §3).

### 2.5 Realtime tech — and why Convex sidesteps it
Pro apps use **WebSockets** (with SSE/polling fallback), throttle unwatched matches, and solve late-join with an **event log + replay buffer + snapshot** (keep ~60s of events in Redis keyed by sequence; on reconnect the client sends `Last-Event-ID` and the server replays the gap; periodic snapshots let fresh joiners load current state in one shot). This is textbook event-sourcing.

**Convex makes this free.** Reactive `useQuery` auto-subscribes over a managed WebSocket, tracks the exact documents read, and pushes a JSON-patch diff to every client on any mutation that touches them — handling reconnect/resync internally. A late joiner's `useQuery` simply returns current snapshot state. **We do not build event replay, SSE buffers, or Last-Event-ID reconnection.** We denormalize current scoreboard state onto the snapshot doc (one-doc catch-up) and keep `matchEvents` purely for play-by-play history. (Full implementation in §6.)

---

## 3. Global Public Feed — Moderation, Privacy & Safety

The public feed turns every team/player name and note into **publishable UGC**. A browsable directory is a *materially higher risk tier* than share-by-link (content reaches strangers with no relationship to the broadcaster). The control set below is split MVP (release-blocking) vs phase-2.

### 3.1 MVP control set — release-blocking
| Control | What | Why it's a gate |
|---|---|---|
| **Default-private, per-match opt-in** | 3-state `Private / Link-only / Public feed`, default Private. No account-wide public flag. | Mirrors GameChanger per-game audience model; prevents accidental global exposure of names. Effort: S. |
| **Server-side profanity/slur filter** | Run every public string (team/player names, title, public note) through an evasion-resistant filter (glin-profanity, "moderate": leetspeak + Unicode homoglyph + separator). NFKC-normalize, strip zero-width chars. Block or `held`. **In the Convex mutation, never client-only.** | Apple 1.2 "filter objectionable content." Client-side is bypassable by calling the mutation directly. Effort: M. |
| **Hide / Block / Report — three distinct flows** | HIDE (instant, personal, no review). BLOCK (mutual, durable, **enforced both directions in the feed query**). REPORT (reason taxonomy, **available to signed-out viewers**) → operator queue + audit log. | Apple 1.2 hard-requires report + block + rapid response. Block enforced client-side is a false safety. Effort: M. |
| **Youth safeguard** | A "youth/under-18 match" flag forces visibility max = `unlisted` (link-only, never browse) and **redacts player names to initials + jersey number** in any public view; youth notes never shown publicly. | COPPA: a minor's full name on a browsable page is a "disclosure" (16 CFR 312); full compliance April 22 2026. Must be server-enforced. Effort: S–M. |
| **Rate-limit publish + report** | Convex Rate Limiter component: publish ≈ 5/hr/user (token bucket); report ≈ 10/hr (anti report-bomb); public text edits ≈ 30/hr. | Caps feed flooding, report-bombing, and Convex cost blowups. Effort: S. |
| **Acceptable-Use acceptance + contact info** | One-tap AUP acceptance before first public publish (no objectionable content / harassment / impersonation / minors' PII; no-tolerance line). Store `acceptedTermsAt`. Reachable support/contact route. | Apple 1.2 requires content-banning EULA + published contact; common rejection cause. Effort: S. |
| **Auto-expire public visibility** | `publicExpiresAt` = match end (+~3h grace); scheduled function demotes expired public matches to `unlisted`. | Keeps feed live-only (Twitch/YouTube norm); bounds standing exposure of names + moderation load. Effort: S. |
| **Impersonation report reason** | Dedicated reason wired to takedown queue; **no name verification in MVP**. | DSA deceptive-practice harm; report+takedown is the realistic MVP response. Effort: S. |

### 3.2 Phase-2
- Hold-for-review (soft) queue for borderline strings; avatar/image moderation if avatars added.
- Reserved/claimed club names + verified-broadcaster badges (structural anti-impersonation).
- DSA transparency reporting (start *counting* removals in MVP — cheap) + formal appeals flow.
- ML/toxicity classifier + phonetic/Levenshtein near-miss matching layered over the wordlist.
- Verifiable parental consent flow — **only if** product ever moves to under-13 self-accounts (the MVP youth strategy deliberately avoids triggering this).

### 3.3 Schema & queries (canonical)
Add to `matches`: `visibility: 'private'|'unlisted'|'public'` (default `private`), `isYouthMatch: boolean`, `publishedAt?`, `publicExpiresAt?`, `moderationStatus: 'clean'|'held'|'removed'`, `ownerId`. New tables: `moderation_reports` (reason enum, signed-out reporter via session token, status), `blocks` (blocker/blocked), `hidden_matches` (userId/matchId), `moderation_audit` (append-only).

`listLiveFeed` returns matches WHERE `visibility==='public' AND moderationStatus==='clean' AND publicExpiresAt > now AND owner NOT IN viewer blocks (both directions) AND matchId NOT IN viewer hidden`. Signed-out viewers skip block/hide filters but keep visibility + moderation + freshness. **Server-side and non-negotiable.**

**Top risks:** App-store rejection if any of the four 1.2 controls is missing (treat as release-blocking); COPPA penalties are per-violation; client-only block/hide is defeatable; report-bombing without rate limits; the Scunthorpe false-positive problem (need allowlist/override + human review for held items); global discovery multiplies jurisdictional scope the instant there are non-US users.

---

## 4. Official Scorecard Specifications (per sport family)

All families share Mono styling: **tabular-nums** for every numeric cell; `var(--primary)` green for live/on-strike/leader/winner state only (no `#0066ff` — it's dead); 1px black object edges; 1px @14% (`t.divider`) interior rules; 2px black header rule; 700-weight mono column headers (0.08em tracking); radius 0px brutal scorecards / 4px hero card / hard-offset `4px 4px 0 var(--primary)` for decision-moment hero objects.

### 4.A Set sports — Volleyball (primary), Badminton, Table Tennis, Pickleball, Squash

**Two scoring families to model as DATA, not code:** (A) win-by-2 **no cap** (volleyball, table tennis, squash) vs (B) win-by-2 **with cap** (badminton). One close-unit function reads `{targetPoints, winBy, hardCap, tieBreakTarget, switchSidesAt}` off the match doc.

| Sport | Unit / format | Target | Win-by-2 trigger | Cap | Notes |
|---|---|---|---|---|---|
| Volleyball (FIVB) | Best-of-5 sets | 25 (set 5 = 15) | from start | **none** | Switch sides at 8 in set 5; score can exceed 25 (32-30) |
| Badminton current | Best-of-3 games | 21 | from start | **29→30** | Mid-game interval at 11 |
| Badminton 3x15 (eff. 4 Jan 2027) | Best-of-3 | 15 | from start | **20→21** | Interval at 8; store `rulesetVersion` |
| Table tennis (ITTF) | Bo5/Bo7 | 11 | from start | none | Serve every 2 pts; every 1 pt at 10-10 |
| Pickleball | Best-of-3 | 11 (rec 15/21) | from start | none | **3-number doubles score** `5-3-2`; opens `0-0-2` |
| Squash (WSF PAR) | Best-of-5 | 11 | **only at 10-10** (11-9 ends instantly) | none | Server picks R/L box, alternates while winning |

#### VOLLEYBALL LIVE SCOREBUG — element order (mirror around a center spine)
Horizontal strip ~56px. **LEFT cluster (left-aligned):** [1] serving glyph (filled green dot 8px, shown only if `servingTeam==='A'`, else 8px spacer) → [2] team name/abbr (3-letter cap, 700) → [3] sets-won pill (800, `var(--primary)` fill, white text) → [4] current-set points (largest numeral, 900, tabular-nums, ink). **CENTER spine:** [5] set label `SET 3` (eyebrow 700, 0.08em) over [6] timeouts as two dots/team (filled = used) + `TTO` flag when technical timeout live + `SET POINT`/`MATCH POINT` red chip. **RIGHT cluster (mirror, right-aligned):** points → sets-won pill → name → serving glyph. Render fields: `home/away {name,abbr,setsWon,points}, servingTeam, setNumber, isTieBreak, timeoutsUsed{home,away}, technicalTimeoutActive, pointState('normal'|'setPoint'|'matchPoint')`. **`servingTeam` is a stored boolean, never derived from last scorer** (rally scoring flips serve on side-outs with no score gap). Numeral slots must fit 2 digits (no-cap deuce → 32-30).

#### VOLLEYBALL FULL SCORECARD — set-by-set matrix
Columns: `TEAM` (winner bolded 800) · `SET 1` · `SET 2` · `SET 3` · `SET 4` · `SET 5` · `SETS` (decisive, 900) · `DUR` (optional per-set mm:ss). Exactly 2 data rows; the set winner's cell gets a `var(--primary)` left-border + bold; the live set shows current points with a pulsing underline. Footer: total duration, total points, aces/blocks/errors if tracked. Below the table (phase-2): a per-set **delta sparkline** (~24px) plotting `home−away` across rally index, zero-line centered, green above / ink below, dots at side-outs.

#### Secondary net-sport scorebugs — keep their distinct elements (do NOT collapse to volleyball)
- **Badminton:** LEFT: serving glyph (shuttle ▾; doubles shows partner 1/2 superscript) → name (700) → games-won pill → current-game points (900). CENTER: `GAME 2` + `INT` interval flag + game/match-point chip. Scorecard cols `PLAYER · GAME 1 · GAME 2 · GAME 3 · GAMES`. `rulesetVersion` drives target/cap/interval; **freeze a per-match rules snapshot** so a 2026 match still renders 21-point after the default flips to 3x15.
- **Table tennis:** serve cadence is engine state (`serverEveryNPoints=2`, `=1` when both ≥10) — bug renders current server from the flag. Cols `PLAYER · G1..G7 · GAMES` (render only as many game cols as `matchFormat` allows).
- **Pickleball (unique):** a dedicated **3-part score token** in the center — `[serverScore]–[receiverScore]–[serverNumber]` e.g. `5–3–2`, 900-weight, serverNumber in `var(--primary)`; singles uses 2-number `5–3`. `0-0-2 START` flag at game open; side-out indicator. A generic 2-number renderer **silently breaks** this — needs its own component.
- **Squash:** serving glyph + serve-box `R`/`L` indicator → name → games-won pill → points. CENTER `GAME 3` + **`GAME BALL`/`MATCH BALL`** chip (squash term, not "point"). PAR: win-by-2 only engages at 10-10 — **reusing volleyball's from-start win-by-2 keeps a squash game wrongly alive at 11-9**.

#### Commentary line templates (set sports)
Universal log line `pointLog`: `{matchId, setOrGameIndex, rallyIndex, tsMs, scoringTeam, homePoints, awayPoints, action, server, note?}` — each line also stores `serverAfter` so the UI re-derives the serve glyph at any scroll position.
- **Volleyball:** ace → `{team} ace. {srv} serving. {h}-{a}`; kill → `{team} kill by {player}. {h}-{a}`; block → `{team} stuff block. {h}-{a}`; opp error → `{team} point, {oppErrorType} error. {h}-{a}`; side-out → `Side-out — {team} to serve. {h}-{a}`; timeout → `Time-out {team} ({n} left).`; tech-TO → `Technical time-out at {lead} points.`
- **Racket sports:** winner → `{player} winner. {h}-{a}`; forced/unforced error → `{player} point, forced/unforced error. {h}-{a}`; service ace → `{player} service ace. {h}-{a}`; squash let/stroke → `Let played — replay.` / `Stroke to {player}. {h}-{a}`; game/match won → `GAME {player}, {gh}-{ga} ({pts}).` / `MATCH {player} {gh}-{ga}.`

**Shared schema shape (all 5 reuse one engine):** `matches: {sport, rulesetVersion, matchFormat, unitLabel('SET'|'GAME'), targetPoints, winBy, hardCap, tieBreakTarget, switchSidesAt, scoringSystem('rally'|'sideout'), isDoubles, home{...}, away{...}}`; `units` (one per set/game) `{index, homePoints, awayPoints, status, winnerTeam, durationSec, isDecider}`; `liveState {currentUnitIndex, servingTeam, serverNumber, serveBox, timeoutsUsed, technicalTimeoutActive, pointState, courtSwapped}`.

**Risks:** badminton mid-transition (store `rulesetVersion` + frozen snapshot); technical timeouts apply ONLY in FIVB World/Olympic events and ONLY sets 1-4 — gate behind a `competitionLevel` flag (open question, §8); squash PAR trap; pickleball 3-number score; serve as stored boolean.

---

### 4.B Tennis (ATP/WTA/Grand Slam)

Four nested levels rendered at once: point → game → set → match. **Always persist raw integer point counts (0,1,2,3…), never the display string** — the 15/30/40/AD ladder, deuce/advantage, and tiebreak switching all derive from integers.

#### LIVE SCOREBUG — two stacked rows (one per player), left→right per row
(1) optional flag/seed [16px] → (2) player name (mono uppercase, 700, ellipsis) → (3) optional sets-won pip cluster (usually omitted — sets are visible as columns) → (4) **completed-set game columns** (oldest left, ~28px tabular, winner-bolded, optional `<sup>` tiebreak mini-score) → (5) **current-set game column** (highlighted bg `var(--accent)`) → (6) **current-game point cell** ~36px (15/30/40/AD, or tiebreak integer) → (7) **serve dot** (`var(--primary)` 8px, rendered only on the serving row — exactly one row true). Pressure ribbon (`BREAK PT`/`SET PT`/`MATCH PT`, priority MATCH > SET > BREAK) spans the bug as a thin `var(--primary)` bar with white text when the flag is set. Grid sketch: `gridTemplateColumns: auto 1fr repeat(${completedSets},28px) 36px 36px 12px`.

#### FULL SCORECARD GRID — rows = players, cols = sets + current game
Header `['', 'S1','S2','S3','S4','S5','GM','PT']` (S4/S5 only if best-of-5; hide unplayed or show `-`). Each set cell = integer game count; tiebreak sets append `<sup className="text-[0.6em] align-super">{tbPoints}</sup>`. Winner of each completed set: 800 weight; loser 400. `GM` = current-set live game count; `PT` = current-game point. Current set column `bg-[var(--accent)]`; server row marked with a leading ball dot in the name cell. `tabular-nums text-right`.

#### Point mapping + pressure flags (pure selectors, never persisted)
```
pointLabel(myPts, oppPts, {inTiebreak, noAd}):
  if inTiebreak return String(myPts)
  L = ['0','15','30','40']
  if myPts<3 || oppPts<3 return L[myPts]
  if myPts===oppPts return '40'            // deuce
  if myPts===oppPts+1 return 'AD'
  return '40'
```
Center status token: `deuce` (myPts===oppPts≥3), `Ad-In` (server +1 past deuce), `Ad-Out` (receiver). No-Ad: at 3-3 render `40-40 • deciding point`, next point = GAME. `isBreakPoint` = receiver one point from winning on opponent's serve; `isSetPoint` = next game closes the set; `isMatchPoint` = setPoint AND `setsWon === setsToWin-1`. **Derive from the post-point snapshot only** (stale state flashes wrong ribbons).

#### Point-by-point game log
Per game store `points: [{winner:'p1'|'p2', kind?:'ace'|'df'|'winner'|'unforced'}]`. Render running score **server's tally first**: `['0-0','15-0','15-15','30-15','40-15','40-30','deuce','Ad-In','game']`. Tiebreak game log uses integers `0-0, 1-0, …, 7-5`. Per-match shorthand: `{winner} def. {loser}  6-4 3-6 7-6(4)` (tiebreak loser-points in parens; super-tiebreak in brackets `[10-7]`).

#### Format presets (config — drives everything)
| Preset | setsToWin | tiebreakTo | decidingTiebreakTo | noAd | finalSetTiebreak |
|---|---|---|---|---|---|
| ATP/WTA standard | 2 | 7 | 7 | false | true |
| Men's Grand Slam | 3 | 7 | **10** | false | true |
| Doubles (no-ad + match TB) | 2 | 7 | — | **true** | matchTiebreakTo 10 |

**Schema:** `matches {sport:'tennis', formatId, players[{id,name,seed?,flag?}], setsToWin, tiebreakTo, decidingTiebreakTo, noAd, finalSetTiebreak, server, status}`; `sets {index, gamesP0, gamesP1, tiebreakP0?, tiebreakP1?, wonBy?, durationMs?}`; `games {setIndex, index, pointsP0, pointsP1, isTiebreak, wonBy?, server}`; optional `points` fine log.

**Risks:** storing display strings breaks deuce/TB; hardcoding tiebreak-to-7 or best-of-3 breaks Grand Slam; **tiebreak serve rotation** (first server serves 1 point, then alternate every 2) — naive "alternate each game" is wrong inside a tiebreak; superscript baseline misalignment (use ~0.6em + tabular-nums); centralize win-condition checks in one selector module (no-ad/Fast4 drift).

---

### 4.C Cricket (additive over existing `MonoCricketTestLiveScore.jsx`)

The existing screen tracks ONLY team-level innings `{teamId, runs, balls, wickets, allOut, declared}`. **Everything here is purely additive — the official scorecard layer is built by capturing WHO faced/bowled each ball.** One new **deliveries log** per ball is the source of truth; scorebug, batting card, bowling card, FoW, partnership, and commentary are ALL pure projections. Reuse `ballsToOvers()` and `calculateRunRate()` from `cricketCalculations.js` — do not reinvent.

#### LIVE SCOREBUG (`CricketScorebug.jsx`)
- Line 1 (hero, 6xl mono tabular): `${runs}/${wickets}` + `(${ballsToOvers(balls)})` at 0.5em muted → `145/3 (18.2)`.
- Line 2 (sm, justify-between): `CRR 7.84` left; in a chase add `RRR 9.20` + `Need 56 off 38` right (green `var(--primary)` when RRR ≤ CRR).
- Line 3 `THIS OVER` eyebrow + token row mapping current-over deliveries → `['.','1','4','W','6','Wd','Nb']`; 4 and 6 in green, W in a black pill. Wides/no-balls appear as tokens but **do not advance the legal-ball count**.
- Line 4 two batter chips `<name> <runs>(<balls>)` with `*` + green dot on striker.
- Line 5 bowler chip `<name> <w>-<r> (<overs>)` e.g. `Bumrah 2-31 (4.0)`.

#### BATTING CARD
Header (700, muted): `NAME · R · B · 4s · 6s · SR` (numerics right, tabular, fixed widths). Each row: line1 = name (800 if not-out/on-strike, green dot on strike); line2 = dismissal text muted 0.75rem — full phrases `c Smith b Bumrah`, `lbw b Shami`, `run out (Jadeja)`, `not out`, `b Starc`, `st Pant b Chahal`. `SR=(R/B*100).toFixed(2)` or `-` when B=0. `Yet to bat: …` muted line below. Rows separated by `t.divider`.

#### BOWLING CARD
Header: `BOWLER · O · M · R · W · ECON`. `O=ballsToOvers(legalBallsBowled)`; `M`=maiden overs; `R`=runs conceded (**wides/no-balls count; byes/leg-byes do NOT**); `W`=wickets credited (bowled/caught/lbw/stumped/hit-wicket, **NOT run-out**); `ECON=(R/(legalBalls/6)).toFixed(2)`. Optional trailing `(2w 1nb)` micro-note.

#### Extras / FoW / Partnership / Result
`Extras  <total>  (b X, lb Y, w Z, nb W, p P)`. **Integrity invariant: `sum(batter runs) + extras === innings.runs` every ball** — make `innings.runs/balls/wickets` DERIVED from the log (or assert equality on every mutation). Fall of Wickets chips: `<score>-<wkt> (<batterOut>, <over>)` → `45-1 (Rohit, 8.3)`. Partnership: `<runs> (<balls>)` since last FoW. Chase: `Target 286 · Need 56 off 38 balls`.

#### Ball-by-ball commentary
Template: `${over}.${ballInOver} ${bowler} to ${striker}, ${OUTCOME}${freeText? ', '+freeText : ''}`. OUTCOME vocab: wicket→`OUT`; 4→`FOUR`; 6→`SIX`; 0&!extra→`no run`; >0→`N run(s)`; `wide`/`no ball`/`N bye`/`N leg bye`. Newest-first; FOUR/SIX green 800, OUT in a black pill. e.g. `18.2 Bumrah to Kohli, FOUR, driven through extra cover`.

#### Schema (source of truth)
`deliveries: {matchId, inningsIndex, over, ballInOver, legal, strikerId, nonStrikerId, bowlerId, runsBat, extraType?('wide'|'noball'|'bye'|'legbye'|'penalty'), extraRuns, wicket?{batterOutId,kind,fielderId?}, commentary?, seq}` indexed `by_match_innings [matchId, inningsIndex, seq]`. `seq` enables exact undo (delete max seq). Derivation fns to add to `cricketCalculations.js`: `buildBattingCard`, `buildBowlingCard`, `buildExtras`, `buildFallOfWickets`, `currentPartnership`, `requiredRunRate`, `thisOverTokens`.

**Risks (all corrupt multiple columns at once):** wides/no-balls add to team + bowler runs but consume no legal ball and no batter ball-faced; byes/leg-byes consume a legal ball but credit neither batter nor bowler-runs; strike rotation (swap on odd runs and at over-end) propagates into commentary, on-strike dot, and B/SR — needs dedicated unit tests; run-out runs still count, dismissed batter may be striker or non-striker, bowler not credited; **keep player/dismissal capture optional with defaults** so the fast 0-6/W/E loop stays one-tap.

---

### 4.D Goals / period sports (football, basketball, hockey, handball, futsal, rugby, kabaddi)

**Two tables that must NOT be conflated:** (1) **LINE SCORE** = per-period team totals; (2) **PLAYER BOX SCORE** = one row per player. Each sport's periods are just a `periods: [{label, durationSec}]` array (football 2×45, basketball 4×10 FIBA/4×12 NBA, field hockey 4×15 default + ice-hockey 3×20 toggle, handball 2×30, futsal 2×20, rugby 2×40, kabaddi 2×20).

#### LINE SCORE table (basketball / hockey / handball / futsal)
Header `TEAM | Q1 | Q2 | Q3 | Q4 | OT? | FINAL`. Two body rows. Each cell = points that team scored in that `periodIndex`. FINAL bold; winner's FINAL gets `var(--primary)` fill + white text. 2px black rule under header; `t.divider` row rules.

#### PLAYER BOX SCORE (basketball, NBA/FIBA columns — phase-2, behind "track players")
Frozen first column `PLAYER`, then `MIN · FG · 3PT · FT · OREB · DREB · REB · AST · STL · BLK · TO · PF · PTS · +/-` (FG/3PT/FT as `M-A` strings; `+/-` signed + tinted; optional FIBA `EFF`). TEAM TOTALS footer (2px top rule); starters then `BENCH` subheader. Horizontal scroll on mobile with sticky PLAYER column; numerics `text-right tabular-nums`.

#### FOOTBALL match-centre
Vertical center spine, home events left / away right, minute-ordered. Line templates — GOAL `34'  ⚽  Torres (assist Silva)  2-1`; PENALTY `52' (P) ⚽ Kane 3-1`; OWN GOAL `60' (OG) ⚽ Diaz`; YELLOW `41' 🟨 Ramos`; 2nd yellow `78' 🟨🟥 Ramos`; RED `66' 🟥 Pope`; SUB `61' 🔁 Adams ▲ Fox ▼`; stoppage `45+2'`, `90+4'`. Full-width half chips `HALF-TIME 1-0`, `FULL-TIME 2-1`. Below: `<StatBar>` comparison (Possession % split bar, Shots, Shots on target, Corners, Fouls, Offsides, cards) — each row `leftValue | label | rightValue` with a two-tone proportional bar `var(--primary)` vs muted. *(On ~380px mobile, consider collapsing the two-sided spine to a single minute-ordered column with a left/right color tick — open layout risk, §8.)*

#### RUGBY & KABADDI (the bridge to the generic +N engine)
Rugby line templates carry explicit values: `12' TRY J. Smith +5 → 5-0`; `14' CON Farrell +2 → 7-0`; `28' PEN +3`; `63' DG +3`; legend chip-row `TRY 5 · CON 2 · PEN 3 · DG 3`; per-team breakdown `TRIES | CONV | PEN | DG | PTS`. Kabaddi: per-team `RAID PTS | TACKLE PTS | ALL-OUT | EXTRAS | TOTAL`; templates `Raid 14 ● Pawan touch x2 +2 → 18-15`, `BONUS +1`, `Super Tackle +2`, `ALL OUT +2 (Team A)`; mat-status widget = players-on-mat dots (7 max). **This event-with-`value` structure IS the generic engine.**

#### Family scorebugs (phase-2 — need live-clock state)
Basketball `[HOME 58] Q3 07:24 [AWAY 61]` + `FOULS 4 · BONUS` (amber when teamFouls ≥ threshold) + shot-clock + possession arrow ◄/►. Football `[HOME 2] 72' [AWAY 1]` (stoppage in amber) + recent-card icons. Handball/futsal: + 2-min suspension chips / accumulated-foul 0-5 then "6th FOUL" flag. **Foul/bonus thresholds differ by league (NBA 5 vs FIBA) — make them sport-preset config**, not hardcoded.

---

### 4.E Sport-agnostic GENERIC scorecard (custom/silly games — ship FIRST)

Custom games have no native box score, so "official feel" is **manufactured from the event stream**. This component set works for *any* +1/+N game including all the goal sports, so it delivers universal official feel before any sport-specific box score exists.

#### STAT HEADER (`<GenericStatHeader>`) — single pass over events
Fields: LEADER + MARGIN ("Alice leads by 4", leader name `var(--primary)`); big tabular SCORE; **LEAD CHANGES** (count of events where `sign(runningHome-runningAway)` flips); **TIMES TIED**; **LARGEST LEAD** ("Alice +7 @ 12:30"); **BIGGEST RUN** ("🔥 Bob 6-0"); **SCORING RATE** (totalPoints/elapsedMin); LAST SCORE chip. Pure-type stat line (no boxes) under a 2px black rule, eyebrow labels 700 / 0.08em.

#### SEGMENT SUMMARY (`<SegmentSummary>`) — manufactured line score
Auto-bucket: timed games → split `[startTs,endTs]` into N equal time buckets; untimed → split the ordered event list into N equal-count buckets (default N=4, adjustable 2-6). Render exactly like a basketball line score: `PLAYER/TEAM | S1 | S2 | S3 | S4 | TOTAL`, winner TOTAL green-filled. **Always caption how it was segmented** ("Auto-segmented into 4 periods") so users aren't confused.

#### RUNNING TIMELINE (`<GenericTimeline>`)
Newest/oldest toggle. `[12:34] ● Alice +1 → 5-3 (Alice leads)`; custom-value `[14:02] ● Bob +3 'Trick shot' → 6-5 (Bob leads)`; tie `→ 6-6 (TIED)`; lead-change rows flagged with ► + bold `LEAD CHANGE`; run continuation appends `(run 3-0)`. Timestamp = game clock if timed, else wall-clock/relative. Each row maps 1:1 to a `scoringEvents` doc.

#### RUN / LEADER / DIFFERENTIAL
`<RunIndicator>`: currentRun = consecutive same-team events with no opponent score between; reset on opponent score or tie; pill `🔥 ALICE 4-0 RUN`. `<LeaderStrip>`: two proportional segments, leader segment `var(--primary)` + white name, centered margin. `<DifferentialHero>`: the brutal hero card (`4px 4px 0 var(--primary)`, radius 4px) showing live differential `+4` with leader name — the headline scorecard object.

#### SHARED event model (powers all 4.D timelines AND all 4.E derivations)
`scoringEvents: {matchId, seq, tsMs, periodIndex, clockSec, teamId, playerId?, type, value(+1 default, +N), label?, runningHome, runningAway, voided?}` indexed `[matchId, seq]`. **Storing `runningHome/runningAway` at write time makes every timeline row and every derived stat a single O(n) pass — no recompute.** `value` + user-definable `type`/`label` from day one means rugby (5/2/3), kabaddi (1/2), and custom (+N) all flow through one engine.

**Risks:** player box score needs per-event `playerId` (empty if UI only captures team taps — gate behind "track players" mode); auto-segmentation ambiguity (pick equal-time when a clock exists, else equal-count, and caption it); voided/edited events require a single recalc pass keyed on `seq`, not per-row patching; stoppage/OT breaks `floor(clock/periodLen)` bucketing — period index must come from explicit period boundaries.

---

## 5. Live Commentary Feed + Discovery Feed UX

*(Section 4 owns the per-sport line-template format strings; this section owns feed presentation. Cross-reference, no repetition.)*

### 5.1 Live commentary feed (on the spectator page)
- Map `matchEvents` / `pointLog` / `deliveries` newest-first; winner/scoring name bolded 800; mono timestamps.
- **Undo is a first-class event type, required day one** — a naive append-only log without an `undo`/`correction` type shows spectators the wrong play-by-play after a scorer fixes a mistake. Undo pops the event and recomputes denormalized score.
- Each line stores the post-event serve/striker state so the UI re-derives indicators at any scroll position.
- Sport-appropriate accents: FOUR/SIX/GOAL/ace highlighted green; OUT/RED in a black pill; lead-change rows flagged.

### 5.2 Spectator scoreboard live pulse (Flashscore feel)
On the spectator board and every discovery row, **flash the changed score**: a `useEffect` compares prev vs next `scoreA/scoreB` and triggers a one-shot 200ms `var(--accent)` pale-green background wash + tabular-num bump, then fade. Mono-restrained — a soft wash, NOT a bounce. **Stale state:** if `Date.now() - lastEventAt > 90s`, dim the LIVE badge to `PAUSED`.

### 5.3 Discovery feed (`/live` — "Watch Live" tab)
- Top: typographic `LIVE NOW` header + 2px black rule.
- **Sport filter:** horizontal scroll row of mono chips (700, 0.08em) from `sportRegistry` — `ALL / VOLLEYBALL / BASKETBALL / …`; selected chip = `var(--primary)` fill + white.
- Body: ledger-style rows (1px black edges, `t.divider` between): sport emoji, `TeamA vs TeamB`, live score (tabular, right), pulsing green LIVE dot, set/period sub-line, `viewerCount` ("12 watching").
- **Sort:** followed-teams-first (if/when a follow graph exists) → `viewerCount` desc (popularity) → `lastEventAt` desc (recency). **Note: the popularity sort depends on presence/viewerCount, which is phase-2 (§6.6) — MVP sorts by `lastEventAt` only.**
- Empty state: "No live games right now" + CTA "Start a match".
- Only `isPublic`/`public` matches appear; link-only matches never surface.
- **Cold-start mitigation:** below a threshold of concurrent public matches, hide the tab entirely or show a "be the first" state — an empty Live tab is embarrassing.

### 5.4 Kiosk variant
`?kiosk=1` hides all chrome, maxes type size, for casting to a gym TV / stream overlay.

---

## 6. Convex Real-Time Implementation Patterns

The single-operator deep-dive governs implementation here; §2/§5 give the product framing.

### 6.1 Split-document architecture (the spine)
Keep ONE tiny `matches` snapshot doc holding only hot scoreboard fields, plus a separate append-only `matchEvents` table. Spectators `useQuery` the snapshot by `token`; each point changes that one small doc → one cheap re-render. **NEVER recompute the scoreboard by reading the whole event log in the spectator query** — that pulls every event into the read set and re-invalidates the subscription on every append (the OpenClaw case: 17 MB/call → ~20 KB by narrowing read sets). `useQuery` creates a standing server-side subscription that re-executes whenever any touched doc changes, so minimize read set + result size: the snapshot doc holds only score/sets/server/status, **not arrays or history**.

```ts
matches: defineTable({
  token: v.string(),            // unguessable crypto-random, NOT _id
  ownerId: v.string(),          // never returned to spectators
  sport: v.string(),
  status: v.union(v.literal('live'), v.literal('paused'), v.literal('final')),
  teamA: v.string(), teamB: v.string(),
  pointsA: v.number(), pointsB: v.number(),
  setsA: v.number(), setsB: v.number(),
  setScores: v.array(v.object({ a: v.number(), b: v.number() })),
  servingTeam: v.union(v.literal('A'), v.literal('B')),
  currentSet: v.number(),
  lastSeq: v.number(), updatedAt: v.number(),
  // + visibility/moderation fields from §3.3
}).index('by_token', ['token']).index('by_owner', ['ownerId']),

matchEvents: defineTable({
  matchId: v.id('matches'), seq: v.number(), idemKey: v.string(),
  type: v.union(v.literal('point'), v.literal('set_end'), v.literal('undo'), v.literal('correction')),
  team: v.optional(v.union(v.literal('A'), v.literal('B'))),
  snapshotAfter: v.object({ pointsA: v.number(), pointsB: v.number(), setsA: v.number(), setsB: v.number() }),
  at: v.number(),
}).index('by_match_seq', ['matchId', 'seq']).index('by_match_idem', ['matchId', 'idemKey']),
```

### 6.2 One mutation per point — no batching
A **single operator per match = single serial writer = zero OCC write conflicts**, points arrive every few seconds → no batching/debounce needed. The high-throughput/conflict-avoidance literature is about *many* concurrent writers and **does not apply** here (it would be over-engineering). The per-point `scorePoint` mutation does **two writes in one transaction** — append the `matchEvents` row AND patch the denormalized snapshot — with its read set kept to just the match-by-token lookup, keyed by a client-supplied `idemKey` for cheap idempotent retries.

### 6.3 Public-function security
- The anti-enumeration control is an **unguessable random `token`** stored as its own indexed `v.string()` field — **NOT the Convex `_id`** (also unguessable, but the doc handle leaks into client payloads and couples internal identity to the public surface). Look up via `.withIndex('by_token', q => q.eq('token', token))`.
- **Every public function needs BOTH an args validator AND a return validator** that whitelists only safe fields and strips `ownerId`/`_id`/`token`. (Forgetting the *return* validator leaks operator identity even when args are validated.)
- **No list/enumerate query is ever exposed publicly** (the discovery feed query filters server-side, never returns secrets).

### 6.4 Late-join & pagination
For replay/history use `usePaginatedQuery(listEvents)` (cursor pagination stays fully reactive). For "only fetch new events," use an explicit monotonic `seq` + an `eventsSince(seq)` delta query — **order by `seq`, not `_creationTime`** (wall-clock can tie). The live scoreboard never reads the log.

### 6.5 Operator optimistic updates + offline outbox
- `useMutation(api.match.scorePoint).withOptimisticUpdate(...)` writes the expected score into the local cache immediately (sub-100ms tap feel), rolling back on failure.
- **Offline caveat (the most over-claimed point):** Convex's exactly-once retry queue is **in-memory in `ConvexReactClient` and is LOST on app kill/reload** — the common case on Capacitor mobile. So you cannot rely on Convex alone for offline.
- **Pattern:** keep localStorage (`se_` prefix) authoritative; maintain a persisted `se_outbox` of unsynced events, each carrying a client idempotency key (`uuid` or `${matchId}:${seq}`); on Capacitor `networkStatusChange → connected`, replay through an **upsert-by-`idemKey`** mutation (dedupe via `withIndex` on `idemKey`). The persisted outbox + idempotent upsert is the only thing that survives a cold start and reconciles without corrupting the local match.

### 6.6 Rate limiting & presence — phase-2 placement
- The **Rate Limiter component** (token-bucket) guards **mutations** (`scorePoint`, publish, report) and the token-lookup — it does **NOT** throttle an already-open reactive subscription. Spectator defense = unguessable token + return validator; abuse defense = rate limiter on the write path.
- **Presence / live viewer-count is phase-2.** Signed-out spectators have no identity to key presence on, and per-viewer heartbeats scale write/subscription cost *with the crowd* — exactly the wrong cost curve for a public broadcast. The discovery feed's popularity sort (§5.3) therefore also lands in phase-2.

**Risks:** recomputing the scoreboard from the log in the spectator query (the #1 anti-pattern); over-claiming Convex offline durability; using `_id`/guessable id as the token; missing return validator; **a second operator device breaks the single-writer guarantee** (reintroduces OCC races — enforce one active operator or serialize via `lastSeq`/`seq` checks); ever-growing `matchEvents` has no TTL (plan archival of finalized matches in phase-2).

---

## 7. Consolidated MVP vs Phase-2 Scope

Ordered by dependency. Apple 1.2 controls are **release-blocking** for the public feed and cannot be deferred if that feed ships.

### MVP
- **Foundation:** shared `scoringEvents`/snapshot+log schema with denormalized running totals; split-document Convex architecture (§6.1).
- **Generic scorecard FIRST** (StatHeader + SegmentSummary + RunningTimeline + RunIndicator + DifferentialHero) — works for any +1/+N game, ships official feel universally (§4.E).
- **Volleyball complete:** scorebug + set-by-set matrix + rally point-log + serving-as-stored-boolean + win-by-2-no-cap + set-5 tie-break/side-switch (§4.A). Other 4 net sports as config variants (preserve pickleball 3-number token + squash PAR + badminton `rulesetVersion`).
- **Tennis MVP:** 15/30/40/AD game, set-to-6 + 7-pt tiebreak, best-of-3, 2-row scorebug + 5-col grid, format config object with 2-3 presets (§4.B).
- **Cricket MVP:** deliveries log + live scorebug + full batting/bowling cards + minimal striker/dismissal capture (§4.C).
- **Goal sports MVP:** shared event model + `<LineScore>` + `<Timeline>`; field-hockey default (4×15) with ice-hockey toggle (§4.D).
- **Broadcast:** triple-path share (QR + code + link) → read-only `/live/:token` spectator route with serve indicator + completed-sets ledger + `?kiosk=1` (§2.2–2.3); live-pulse flash + 90s stale badge (§5.2); undo/correction event type (§5.1).
- **Convex:** one-mutation-per-point (idempotent), optimistic updates, persisted offline outbox + upsert reconcile, token-gated public query with args+return validators, `usePaginatedQuery` history (§6).
- **Safety (release-blocking for public feed):** default-private 3-state per-match opt-in; server-side evasion-resistant profanity filter; Hide/Block/Report (3 flows, block enforced both directions in feed query, report available signed-out) + operator queue + audit; youth flag (link-only + name redaction); rate-limit publish/report; AUP acceptance + contact info; auto-expire public visibility; impersonation report reason (§3.1).

### Phase-2
- Discovery "Watch Live" tab with sport-chip filter + live-pulse rows (gated behind `isPublic` opt-in AND a cold-start threshold; popularity sort needs presence) (§5.3).
- Presence-driven `viewerCount` ("N watching") via `@convex-dev/presence` (§6.6).
- Multi-scorer / co-scorers — **legitimate need (TeamSnap crowdsourcing, KeepTheScore libero+coach) but requires giving up the clean single-writer model** and adding explicit `seq`/`lastSeq` serialization (tradeoff, see §8).
- Per-unit delta sparklines (volleyball/badminton/TT/squash); tennis tiebreak superscripts + pressure ribbon + ace/DF-tagged game log + broadcast shorthand; cricket extras/FoW/partnership/RRR + ball-by-ball commentary feed + persisted per-innings cache; basketball player box score (behind "track players") + per-family live scorebugs with clock state; rugby/kabaddi already MVP-shaped via the +N engine.
- Badminton 3x15 default flip (4 Jan 2027) with frozen per-match rules snapshots.
- Convex Rate Limiter on full write path; `matchEvents` archival/compaction for finalized matches.
- Moderation: hold-for-review soft queue; reserved/claimed club names + verified badges; DSA transparency reporting + appeals; ML toxicity classifier + phonetic matching; verifiable parental consent (only if under-13 self-accounts ever appear).

---

## 8. Open Questions / Gaps

1. **Convex cost at viewer-scale.** No concrete numbers were found for reactive fan-out cost/$ when hundreds of signed-out spectators subscribe to one hot match with fast volleyball rallies. The snapshot-doc design *should* bound this, but it's unvalidated — needs a load test before promising "unlimited free spectators."
2. **Multi-scorer without OCC conflicts.** Co-scorers are a real demand but break the zero-conflict single-writer guarantee. The research did not resolve the concrete serialization mechanism (optimistic `lastSeq` compare-and-set? a single active-writer lease?) — needs a design spike.
3. **Capacitor deep-link config.** `/live/:token` must resolve as both a web URL and an app deep link (iOS associated domains / Android App Links). Exact `apple-app-site-association` / `assetlinks.json` setup and fallback behavior (app-not-installed → web, not App Store) were flagged as a risk but not specified.
4. **Discovery cold-start threshold.** What concurrent-public-match count should unlock the "Watch Live" tab? No empirical guidance found — needs a chosen number (and a "be the first" fallback design).
5. **Offline outbox vs Convex-authoritative reconciliation on multi-device.** The localStorage-authoritative outbox is clear for one device; reconciling an offline outbox against server state when a *second* device also scored is unresolved (ties to #2).
6. **Volleyball `competitionLevel` flag.** Technical timeouts (8 & 16) fire only in FIVB World/Olympic events and only sets 1-4 — never club/USAV/NFHS, never set 5. The exact UI for selecting competition level (and whether to default it off) isn't specified.
7. **Two-sided football timeline on mobile.** The home-left/away-right center spine is awkward at ~380px; whether to collapse to a single minute-ordered column with a left/right color tick is an open layout decision needing a design call.
8. **Moderation operator staffing & threshold tuning.** Apple's ~24h and the DSA's "without undue delay" are real operational commitments for a small team; the research flags this as a compliance/reputational risk but offers no staffing model or profanity-filter sensitivity/allowlist tuning baseline.