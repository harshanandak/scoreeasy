> Status (lead, 2026-11-13): first pass only, written in 4 minutes. It has 14 links, no source list and one rule number; four links are overview pages (FIVB basic rules, ITF Play and Stay, the Lord's laws landing page, a Pro Kabaddi feature). Test and guided cricket share one section. It drops numbers the July research had (volleyball end change at 8 in the deciding set, timeouts, kabaddi bonus at 6 defenders, super tackle at 3 or fewer, all out worth 2). Each game family gets a deeper pass with rule numbers and a source list before it is drawn. Do not quote this file as rulebook-checked.

# Score Easy: scorer and live-screen research

Research for drawing, 13 November 2026. Decisions needed: confirm scoring formats at setup, including the actual badminton law in force for each competition, cricket format and powerplay, and the desired detail level for football, hockey and basketball. No rule change is recommended by this report.

## How to use this

The existing [deep synthesis](E:/Personal-Projects/scoreeasy/docs/plans/2026-07-26-icp-games-design/README-deep-synthesis.md) already proposes a pinned score, last action plus undo, a low thumb zone and sport-specific controls. The [adaptive addendum](E:/Personal-Projects/scoreeasy/docs/plans/2026-07-26-icp-games-design/README-adaptive-system.md) adds different rhythms. Keep those ideas, but do not mistake a shared shell for one scoring interaction. The older seven-game drafts include throwball and kho-kho; table tennis, tennis, hockey and cricket need the additional treatment below. The cricket plan already explores guided, keypad and spectator layouts; preserve its work on ball capture, not just its styling.

**Rates below are rough design-planning estimates**, not measured app telemetry or official averages. They describe scorer-recorded events per minute of elapsed match time, including breaks in play, and vary greatly with level, format and which statistics are recorded. The phrase “90% of taps” is a design target or likely dominant action, not a verified percentage. Validate by observing real local matches. Spectator scorebug layouts below are design conventions inferred from the linked federation scoreboards and score services, not claims that one mandatory layout exists. Do not display missing observations as zero or a live clock as authoritative when not synced with the official clock.

**Code evidence:** references are to the tracked `origin/master` available locally, not the older working tree, and are source inspection only (evidence rung 2). No tests, running app, live system or fresh remote fetch were used. Findings are specific observed screen limitations or design questions, not a claim that no other code supports a feature. Paths use repository-relative notation with line numbers.

## Volleyball

**Flow.** Roughly 2–4 point events/minute. Almost every basic-mode action awards a rally to one side; timeouts, substitutions, sanctions and corrections are infrequent. FIVB rally scoring awards every rally; standard sets go to 25, deciding set to 15, win by two ([FIVB](https://www.fivb.com/volleyball/the-game/basic-rules/)).

**Scorer.** Keep team names, current points, sets won, server and last action with undo visible. Two large named point targets; rare controls in More. Derive serve from the rally winner and rotate receiving side when it wins serve, using a known initial lineup if player rotation is offered. At set/match point and deciding-set end switch, show a short context notice. Wrong side after court change is the big risk: make side mapping explicit and offer a deliberate swap; undo must reverse serve and set transitions too.

**Live.** First: names, points, serve marker and set count. Second: completed set scores and set/match point. Deep: set-by-set history and event log, only if recorded. Familiar bug: two stacked teams with current points and set boxes.

**Current.** The sets scorer routes all sets sports to the volleyball-style live scorecard at `src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx:564`; useful for shared scores, but verify each sport's own serve and end-change cues remain visible. This is a design review, not a demonstrated failure.

**Draw.** (1) Two court halves with fixed team names and a prominent “ends changed” cue. (2) Compact scorebug with set cells and a server dot, plus a last-point undo strip.

## Badminton

**Flow.** Roughly 2–4 rallies/minute; the two point buttons dominate. Lets, correction and interval acknowledgement are rare. Under the linked BWF 21-point rules, games require two clear points, capped at 30, and deciding-game players change ends at 11 ([BWF laws](https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/Section%204.1-%20Laws%20of%20Badminton%20-%2019052018A.pdf)). A 15-point alternative also exists ([BWF alternative laws](https://system.bwfbadminton.com/documents/folder_1_81/Statutes/CHAPTER-4---RULES-OF-THE-GAME/Section%204.1.4%20-%20Alternative%20Laws%20of%20Badminton.pdf)). Check current competition adoption before choosing defaults: 2026 reports announce a 2027 change but I did not verify the effective date from BWF itself.

**Scorer.** Current points, game count, serving side and, when known, server and right/left service court; large point targets and undo. Auto-handle service change, court position, interval, end change, deuce/cap from selected format. Doubles needs initial server, partner and positions; side parity alone does not identify the correct person. Offer correction without rewriting earlier results.

**Live.** First: teams, game points, game count, server. Second: completed games, game point and court side if actually known. Deep: point sequence and doubles pair details. Familiar bug: two rows, current score at the right, finished game scores alongside and a serve marker.

**Current.** The common sets watch kind is labelled volleyball (`MonoSetsLiveScore.jsx:564–570`); assess whether this shared visual carries badminton's more specific service-court information. The line alone does not establish whether another component supplies it.

**Draw.** (1) A compact serving card reading “A serves · right court” above the two large score keys. (2) An end-change handoff that previews the new physical left/right mapping before accepting more points.

## Table tennis

**Flow.** Roughly 3–6 rallies/minute, typically short bursts. Point to one side is almost all basic recording; lets, timeout and change of ends are rare. ITTF's laws specify 11 points, win by two; serve alternates every two points and every point after 10–10 ([ITTF handbook](https://db.ittf.com/sites/default/files/public/2022-02/ITTF_HB_2022_clean_v1_0.pdf); [USA Table Tennis](https://www.usatt.org/officials/basic-rules-of-table-tennis)).

**Scorer.** Show points, games won, server, next serve and undo. Two oversized named point targets; keep let and corrections secondary. Auto-advance serve count, extended deuce, between-game server, and deciding-game end change at five. Doubles service/receive order needs setup, not guessed identities. A let repeats a rally and must not increment the score or serve count. Keep labels stable when ends change until confirmed.

**Live.** First: current points, game count, server. Second: completed game scores, deciding-game status. Deep: point runs and game history. Familiar stacked rows show points and game boxes, with a serve dot.

**Current.** `MonoSetsLiveScore.jsx:564–570` uses the shared volleyball scorecard kind. The designer should check whether the screen explains two-serve blocks and the deuce change; the routing statement itself does not prove those mechanics are absent.

**Draw.** (1) Same two-target rally skeleton, but a server marker with “1 of 2” that becomes “serve changes each point” at deuce. (2) Game strip with current 11-point game large and prior games compressed.

## Tennis

**Flow.** Roughly 1–2 points/minute, with longer gaps at games and changeovers; point winner dominates basic taps. Lets, score corrections, tie-break and retirements are infrequent. Point score, games and sets are distinct layers; format variants include short sets and match tie-breaks ([ITF](https://www.itftennis.com/en/growing-the-game/itf-tennis-play-and-stay/)).

**Scorer.** Show team, point score 0/15/30/40/AD, game and set record, server, undo. Two point-winner keys. Auto deuce/advantage, game and set wins, tie-break serve sequence and end changes from selected format. Ask first server at setup and, in doubles, service order if player-level accuracy is promised. Warn on physical end switch while keeping team identity clear. A first-serve fault is not a lost point; do not make it a point key.

**Live.** First: two rows, completed set games, current game score, server. Second: tie-break, break or set point when derivable. Deep: set history and point feed only when captured. Familiar tennis bug uses columns for sets, then the current point.

**Current.** `MonoTennisLiveScore.jsx:133–155` derives server with an explicit assumption that team 1 serves first. That is a real design risk if the actual first server differs; confirm setup or a correction path before promising a reliable serve marker. Point targets and Undo exist at `:786–795`.

**Draw.** (1) Two point buttons with a narrow set/game/point score grid pinned above. (2) Change-ends banner that names the players and keeps an undo path; show tie-break points as numbers, not 15/30/40.

## Cricket: quick, Test and guided

**Flow.** About 0.5–1.2 deliveries/minute on average, varying with format and delays. Every delivered ball needs one recorded outcome, including dot balls; 0, 1, 2, 4 and 6 are likely dominant but no fixed 90% mix is established. Wides, no-balls, byes, leg-byes, wickets, penalties and unusual combinations need more detail. Quick is aggregate-first; guided records batter, bowler and dismissal; Test adds innings, sessions and declarations. Six valid balls normally complete an over; wides and no-balls do not ([MCC laws and current editions](https://www.lords.org/mcc/about-the-laws-of-cricket)). A no-ball can carry bat runs or byes and a run-out; do not model an extra as a standalone ball followed by a separate scoring ball.

**Scorer.** Always show batting side, runs/wickets, overs, current over's deliveries, striker and bowler when captured, target/balls left or innings context, and last ball/undo. Big keys 0, 1, 2, 4, 6; visible Wide, No-ball, Wicket and More for 3, byes, leg-byes and unusual outcomes. Guided path records combinations as one reviewable delivery, then prompts for incoming batter or next bowler. Auto legal-ball count, over transition, strike and chase calculations from actual completed runs and confirmed ends, not simply total extras. Make the no-ball penalty visually distinct from runs completed; show edit/undo impact. Powerplay and free hit are competition settings, not universal laws. Test must expose declaration, innings order, follow-on when applicable, session/stumps and lead/trail; draw is not a tied score.

**Live.** First: batting side runs/wickets, overs, innings and target or lead/trail. Second: batter pair and striker, bowler figures, current over and chase equation; in Test show each innings plus day/session. Deep: full batting and bowling cards, fall of wickets, extras and ball feed. Familiar bug is `TEAM 145/3 (18.2)` with target and batter/bowler alongside. [CricHeroes](https://cricheroes.com/live-matches) uses ball-by-ball scores and full scorecards; this confirms the information model, not a specific pixel layout.

**Current.** Quick scorer has run keys and separate wide/no-ball flows at `MonoCricketLiveScore.jsx:996–1050`, and a powerplay label at `:953`. Guided scorer applies delivery objects at `MonoCricketGuidedScorer.jsx:185–200`, prompts on completed overs at `:173–178` and handles wicket details at `:246–266`. Test exposes declare and draw at `MonoCricketTestLiveScore.jsx:804–805`. Thus redesign should preserve these distinctions; the quick screen's extra-run wording at `:996–1005` leaves bat/byes classification ambiguous in the presented prompt, so test it with scorers before using it as guided detail. No claim is made here about the underlying scoring engine's correctness.

**Draw.** (1) One-ball composer: dominant numeric keypad, extras/wicket row and a compact preview of all parts before completing an exceptional ball. (2) Test header with innings tiles and lead/trail instead of a limited-overs chase banner. (3) Guided over-end inline next-bowler selection, retaining last-ball undo.

## Football

**Flow.** Roughly 0.03–0.2 recorded events/minute in a goals-only game, perhaps 0.2–0.6 when cards and substitutions are tracked; goals themselves are sparse. There is no defensible 90% tap claim because the mix depends on tracking depth. Referee controls actual time and added time; standard halves are 45 minutes ([IFAB Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/)).

**Scorer.** Keep team names, goals, half, elapsed/added time and undo visible. Two clear Goal keys. Optional card, substitution and goal attribution in a sheet or deferrable inline row. Show clock start/pause/correction and half transitions; added time is announced by officials, not inferred by the app, and do not auto-end before the whistle. Own goal asks who receives the goal separately from the player responsible. Shoot-out score is separate from match goals.

**Live.** First: score, teams and match minute/half. Second: goal scorers and minute, red cards and added time if known. Deep: timeline, lineups and substitutions when recorded. Familiar broadcast bug is horizontal `HOME 1–0 AWAY 67:14`, sometimes compact stacked rows on a phone.

**Current.** `MonoGoalsLiveScore.jsx:491–514` delegates to a team-score board with period controls; `:539–540` uses a football clock state with remaining seconds in the legacy branch. These offer scoring and timing but are not the proposed familiar count-up/announced-stoppage presentation. The score action at `:281–283` carries team/value/time; it does not itself include goal-scorer attribution. Other data paths were not exhaustively audited.

**Draw.** (1) Count-up match clock with an explicit `45+` state and a human-called Half time action. (2) Two goal keys with optional “Who scored?” follow-up, dismissible without losing the goal. (3) Spectator timeline in two team columns with own-goal attribution explicit.

## Basketball

**Flow.** Around 1–3 made baskets/free throws per minute of game time, plus fouls, timeouts and clock operations; elapsed-time rates are lower. +2 and +1 may dominate, but frequency varies by match, league and tracking choice. FIBA rules differ from other leagues ([FIBA rules](https://refereeing.fiba.basketball/en/rules)); FIBA's scoreboard guidance shows score, period, game clock, fouls and timeouts ([FIBA equipment](https://refereeing.fiba.basketball/images/docs/doc/5ebfbbb5a9f17da0f62ab2174cebaa85/FIBABasketballEquipment2018.pdf)).

**Scorer.** Show score, period, clock, team fouls and last event. Mirrored team pads with +1, +2, +3, making +2 comfortably largest without making +1 hard to reach. Prominent clock stop/start when the phone is the timekeeper; if another clock is official, label it estimated and allow sync. Team/player foul controls and timeouts are secondary but reachable during stoppage. A foul does not automatically equal a point; free throws must be recorded individually, and bonus depends on league/period configuration. Do not invent possession or a shot clock without reliable input.

**Live.** First: score, period and time. Second: team fouls/bonus and timeouts if recorded. Deep: period scores, player box and event log. Familiar bug is horizontal teams and score with Q and countdown; stats behind it. [FIBA LiveStats](https://about.fiba.basketball/en/services/data-and-video-solutions/fiba-live-stats) illustrates the fuller statistician workflow, which should not be imposed on a lone casual scorer.

**Current.** The shared goals scorer records team/value in `MonoGoalsLiveScore.jsx:281–283`, and its comment at `:570` explicitly anticipates basketball +1/+2/+3. This makes score entry possible but the cited event does not include player or foul data; draw the optional richer path separately rather than asserting a full box score.

**Draw.** (1) Mirrored, color-independent +1/+2/+3 pads with a single centrally placed clock and period. (2) Foul sheet with team-first entry and optional player, previewing the next team-foul count. (3) Spectator strip with score, Q, time and known foul counts.

## Hockey (field hockey)

**Flow.** Roughly 0.05–0.25 recorded events/minute in a goal-only mode; higher with cards and penalty corners. Goal, cards and penalty-corner capture have different frequencies, so no 90% action can be asserted. FIH specifies four 15-minute quarters, with competition variants and clock rules ([FIH 2026 rules](https://www.fih.hockey/static-assets/pdf/fih-Rules-of-hockey-2026-final.pdf)).

**Scorer.** Team goals, quarter, clock, undo; two Goal keys. Reachable penalty corner, card and penalty stroke when tracking those events. Allow stopped-clock corrections, end-of-quarter handoff and an official continuation decision when an incident or corner crosses the horn. A penalty corner is not a goal; don't add one until scored. Cards can have temporary suspensions; show timer only if its start and rule duration are known. Separate shoot-out from regular goals.

**Live.** First: teams, score, Q and time. Second: goal scorer/time and current penalty corner or card if actually captured. Deep: quarter breakdown, cards, penalty-corner outcomes and shoot-out. Common broadcast form is `TEAM 1–0 TEAM | Q3 08:21`, with transient corner/card tags.

**Current.** `MonoGoalsLiveScore.jsx:491–514` supplies a shared period score surface and `:281–283` records a score event. These cited interfaces do not themselves specify a penalty-corner outcome or card duration. This is a gap in the observed scoring flow, not a verified system-wide absence.

**Draw.** (1) Goals layout with a conspicuous quarter clock and a separate `Penalty corner` event, never an automatic goal. (2) Live card with small “PC” or card timer only while confirmed active.

## Kabaddi

**Flow.** About 1–2 raids/minute, sometimes a burst of several marks inside one raid. Every raid ends in a result; empty raids are still events. Touches, bonus, tackle and multi-player outs can coexist in a result, with technical points and all-outs less frequent. PKL's published competition explanation covers the 30-second raid, two-empty-raid do-or-die, bonus/revival distinctions and super tackle ([Pro Kabaddi](https://www.prokabaddi.com/features/understanding-the-game-of-kabaddi)); these are competition-specific, not universal defaults.

**Scorer.** Show team scores, current raiding side, match and raid time when clocked, players on mat, last raid and undo. Make “start raid”, defender marks, bonus and end result fast and legible. Preview a multi-touch before landing the whole raid; distinguish a defender stepping out from a touch. Derive revival order, bonus eligibility, do-or-die, super tackle and all-out only from chosen rules and known on-mat counts. Bonus does not revive a player in PKL. Don't assume a raider returned safe merely because time expired; let the official result be recorded.

**Live.** First: score, half, time, raiding side and raid clock when actually available. Second: on-mat counts, do-or-die/super tackle eligibility and last raid outcome. Deep: raid-by-raid log, player names and points. Familiar PKL scorebug gives both scores around a central raid/clock cue, supplemented by player availability.

**Current.** `KabaddiLiveBoard.jsx:15–23` describes the existing dedicated start/mark/land workflow and `:165–170` distinguishes safe, tackled, raider out and do-or-die result. Undo can reopen a raid at `:104–121`. The older design's four one-tap outcomes would remove meaningful multi-mark information if applied wholesale. Evaluate the number of taps and target size in a real raid rather than asserting the current board is broken.

**Draw.** (1) Two-stage raid card: mark large defender tokens, then commit one clearly named outcome; show running preview without presenting it as final. (2) Spectator bug with mat counts and a central raid marker, with “clock unavailable” if no trustworthy anchor exists. (3) Undo readback showing whether it removes a mark or reopens an entire raid.

## Shared patterns and limits

- **Rally skeleton:** volleyball, badminton, table tennis and tennis can share two named point targets, score header, last action and undo. Tennis needs a distinct points/games/sets hierarchy. The others require their own service, end-change and format rules. Share components, not a single scoring rule.
- **Timed event skeleton:** football and field hockey share score, clock, periods and an event sheet, but football's count-up/added time and hockey's stopped quarter clock differ. Basketball shares the header and clock controls, but needs its own value keypad, fouls and free throws.
- **Cricket** needs a delivery composer with multiple components in one event. Quick, guided and Test can share a cricket keypad and core state but need different innings and detail surfaces. **Kabaddi** needs its own raid draft and commit flow, with staged multi-player events and reversals.
- **Shared live pattern:** pinned sport-specific scorebug; one plain-language current-state line; chronological recent events; tabs for the sport's record and optional stats. Show data freshness and explicit unknowns. Do not fabricate player names, possession, time, momentum or statistics from scores alone. Keep detailed cards optional so a scorer can still operate with one hand.
- **Shared resilience:** every committed action needs a visible saved/pending/failed state, safe retry and undo that restores all derived state. This is a design requirement; no offline or persistence verification was performed in this research.

## Source and evidence boundaries

Primary rules and examples are linked in each section. Volleyball/FIBA/MCC/IFAB/FIH/ITF/ITTF/BWF sources describe formal formats; local organizers may use different ones. Pro Kabaddi is the competition's own description, not a federation rulebook. The badminton BWF documents linked are older than the announced 2027 change and should not be treated as proof of post-change rules. The `origin/master` file references identify code on a locally stored remote-tracking ref, not a fresh or deployed build. No tests or visual inspection of the running app were performed; proposed gaps are design observations, not confirmed live defects.