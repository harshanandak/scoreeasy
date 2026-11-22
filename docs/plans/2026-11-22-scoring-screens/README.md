# Scoring screens concept

Decisions needed: 2 design picks are listed at the end. Default A for each. This packet authorizes no app implementation or merge.

One header, flat score keys and equal utility keys cover all 9 registered sports. Only this docs folder changes. The pages are local and self-contained. Nothing was published.

## Read first and decisions carried forward

Source snapshot: `origin/master` (`064a4ad9c44d308c6c9345984ac781cc267ce88f`). Sources were read with `git show` from that ref. The 9 sports come from `src/models/sportRegistry.js`.

The board decision record is `docs/plans/2026-10-20-direction-e-app-design.md`. It records the owner's move from Mono hard shell to Refined Soft with Mono-strength controls. The retained decisions are team colour as identity, sentence case, the thumb bar, names once and serve once, and an options sheet for rare actions. Court drawings on scorer keys were turned down. This concept keeps those choices. The owner's new request changes the control treatment: ?lifted buttons also don't look good? and ?could look good like for finishing matches or a few other things?. My reading is flat controls during play, lift at a match transition.

The setup reference was SportPicker, SetupSteps, SetsSetup, KitSetupParts, TeamCards, setup.css and setupSteps.css. The concept uses their spacing, flat summary rows and team-card treatment. It does not use mono.css, MonoWatchMatch or a pre-Kit page as a visual source.

## Files and opening

- `scoring-system.html`: header anatomy, style mapping, control grids, all 9 rendered sport examples and slot tables.
- `prototype.html`: sport switch and three states per sport. For sets sports it also exposes deuce, deciding end change and a new match.
- `compare.html`: two local phone frames, reference on the left and concept on the right.
- `png/index.md`: all 44 comparison links and individual phone panes.
- `png/overview-new.png`: the 9 mid-match concepts in registry order.
- `png/grid-slots-overlay-360x780.png`: measured slot and key boundaries.
- `measurements.json`: initial packet element boxes for 36 mid-match/full-time boards.
- `final-geometry.json`: initial packet geometry for 54 views. `round1-geometry.json` repeats those 54 views after the review fixes.
- `sets-engine.js`: the reused event-log rules engine and legal scripted states from the prior prototype.
- `concept.js`, `layout.css`, `fonts.js`, `shipped-css.txt`, `build-pages.py`: editable sources. `python build-pages.py` rebuilds the three HTML files from this directory. It needs no package install.

Open `prototype.html` directly. For iframe comparisons and browser inspection, use a short-lived local server from this folder: `python -m http.server 8787 --bind 127.0.0.1`. Stop it after use. Query example: `prototype.html?bare=1&sport=cricket&state=over`. Sport keys are `vb`, `bd`, `tt`, `tennis`, `football`, `basketball`, `hockey`, `kabaddi`, `cricket`. The first three are file/query keys, not decision labels.

## Header contract

The fixed anatomy is `side-left` and `side-right`, each containing `name`, `main-score` and `secondary`, followed by one shared `status` slot. `detail` is a separate quiet row for completed scores or innings context. A live score, clock or serve cue never moves into that row. Completed-score pairs always follow the header's current left/right order, including after end changes and manual flips.

Each side is 200px high in the supplied states: 12px padding + 48px name track + 80px main-score track + 48px secondary track + 12px padding. The actual numeral glyph box is 64px, or 48px for cricket. Long names can grow the first track; both cards stretch to the same height and the remaining fixed tracks align. The shared status track is at least 64px and may wrap. Break/result text replaces the serving/clock status, rather than adding another line elsewhere.

An unused secondary slot removes its content and keeps its 48px track. An unused status removes its content and keeps the 64px track. This is a collapse of text, not of geometry, so the buttons do not move under the thumb. At full time, sets sports and tennis explicitly relabel their main score as sets/games won. Goal, kabaddi and cricket totals remain final totals. There is no server, live clock or pending raid at full time.

## Per-sport slot maps

### Volleyball

| Slot | Data |
| --- | --- |
| Sides | Team names and engine team colours |
| Main score | Current rally points. At full time, sets won. |
| Secondary | Sets won and current set number. Completed scores in detail. Completed-score pairs follow current header left/right order. |
| Status | Serving team; set or match point; end change replaces serve. |
| Control grid | 2 point keys + 2 utilities, 2 columns |

### Badminton

| Slot | Data |
| --- | --- |
| Sides | Singles players and engine team colours |
| Main score | Current rally points. At full time, games won. |
| Secondary | Games won and current game number. Completed-score pairs follow current header left/right order. |
| Status | Server and right/left court; 60 second interval or end change takes priority. |
| Control grid | 2 point keys + 2 utilities, 2 columns |

### Table tennis

| Slot | Data |
| --- | --- |
| Sides | Singles players and engine team colours |
| Main score | Current rally points. At full time, games won. |
| Secondary | Games won and current game number. Completed-score pairs follow current header left/right order. |
| Status | Server and 1 of 2 / 2 of 2. Each point at deuce. End change takes priority. |
| Control grid | 2 point keys + 2 utilities, 2 columns |

### Tennis

| Slot | Data |
| --- | --- |
| Sides | Singles players and engine team colours |
| Main score | Game points: 0 / 15 / 30 / 40 / Ad; tiebreak points. At full time, sets won. |
| Secondary | Games in this set and sets won, in that order. |
| Status | Serving player; deuce, tiebreak or end change. No serving cue at full time. |
| Control grid | 2 point keys + 2 utilities, 2 columns |

### Football

| Slot | Data |
| --- | --- |
| Sides | Teams and engine team colours |
| Main score | Goals for each team |
| Secondary | Current half and total halves, repeated on both sides. |
| Status | One match clock with remaining-time label; running, pause or result. |
| Control grid | 2 goal keys + 2 utilities, 2 columns |

### Basketball

| Slot | Data |
| --- | --- |
| Sides | Teams and engine team colours |
| Main score | Points for each team |
| Secondary | Current quarter and total quarters, repeated on both sides. |
| Status | Quarter clock remaining; running, pause or result. |
| Control grid | 6 score keys + 3 utilities, 3 columns |

### Hockey

| Slot | Data |
| --- | --- |
| Sides | Teams and engine team colours |
| Main score | Goals for each team |
| Secondary | Current quarter and total quarters, repeated on both sides. |
| Status | Quarter clock remaining; running, break or result. |
| Control grid | 2 goal keys + 2 utilities, 2 columns |

### Kabaddi

| Slot | Data |
| --- | --- |
| Sides | Teams and engine team colours |
| Main score | Committed team totals. Pending raid gain never added early. |
| Secondary | Players on mat and half number. Pending mat changes in raid sheet. |
| Status | Half clock + raid clock + raiding side; pause or full time replaces raid. |
| Control grid | 4 raid actions + 2 utilities, 2 columns. Defender sheet: 4 by 2. |

### Cricket

| Slot | Data |
| --- | --- |
| Sides | Batting and bowling teams, each with engine colour |
| Main score | Runs/wickets for both innings. Unstarted innings says Yet to bat. |
| Secondary | Overs for each side; innings ordinal. Test mode adds two innings entries in detail. |
| Status | Chase runs and balls left; innings break; result at full time. |
| Control grid | 8 ball keys + 4 utilities, 4 columns |

## Flat versus lift

| Control | Exact shipped class or token | Treatment |
| --- | --- | --- |
| Point/goal keys, cricket ball keys, kabaddi raid actions | `.kit-rrow`, `.kit-rrow-summary`, `.kit-rrow-label` in setupSteps.css | Flat surface and `--se-color-line-soft` inset hairline. No offset shadow. |
| Undo, More, clock, strike, scorecard, extras | Same `.kit-rrow` family | Same key size as scoring keys within each sport. |
| Side/server choices and resume | `.kit-rrow`; selected choices add the shipped flat `.kit-chip` with the word Selected and `aria-pressed`. | Team names identify server choices. Resume is an immediate action. No offset shadow. |
| Options-sheet rows | `.sb-row` in boardShell.css | Flat rows separated by the shipped hairline. |
| Done, top Finish entry | `.kit-linkbtn` in setupSteps.css | Flat text actions. Sheet Done has a measured 48x48px target. Top Finish has a 64x48px target and opens confirmation. |
| Team score cards | `.kit-tchip.is-team[data-team]` from teamSheet.css; `.k5-score` from kabaddiScoreStrip.css | Shipped team gradient, no new paint or lift. |
| Noninteractive status | `.kit-sub` | No button shell or decorative chip. |
| Finish match confirmation | `.se-ctl` | Retained lift, unchanged. |
| Start next set/game | `.se-go` | Retained lift, enabled only after required choices. |
| Start next half/quarter/innings | `.se-go` in the component contract | Retained lift for the next phase. Fixture boards do not implement these actions. |
| End innings confirmation | `.se-ctl` in the component contract | Retained lift. This confirmation is not simulated in the prototype. |

Those are the complete retained-lift list. New match, ordinary Done, Replay, Let, point keys, player tokens, Bonus, Safe/Empty/Tackled and utility actions are flat. A lifted Finish match confirmation is rendered in the prototype. Start next set/game is rendered in the sets break state. The other two retained transitions are specified, not implemented as fake sport engines.

## Removed or merged elements

| Element in the previous board | Where its job goes |
| --- | --- |
| Matchup title containing both names | Sport title. Names appear once in the side slots. |
| Second sport pill and sport subtitle | One sport title. |
| Serving pill on a point key | Shared status slot, including court or serve number. |
| Serving mark repeated with the pill | Removed; the written serve status carries the meaning. |
| Point score repeated on the scoring key | Header main score only. The key says +1 and its unit. |
| Set/game counters in a separate metadata line | Secondary row aligned under each score. |
| Separate deuce/set-point/match-point text | Status slot with the serve, or break/result taking priority. |
| Free-floating last-point line | Undo is always visible. Completed-score context stays in detail; full action history belongs in scorecard. |
| Wide Undo plus narrow icon-only More | Equal buttons with written labels. |
| Tap +1 instruction beneath a repeated score | The scoring key itself says +1 / Point or Goal. |
| Clock, period and sport spread across separate chips | Period in secondary; one labelled clock in status. |
| Goals correction buttons on the main screen | Existing More sheet. |
| Fouls, cards, period edits and screen swap | More sheet. Basketball keeps a visible Pause/Resume utility. |
| Cricket individual extras row | One Extras key opening the four existing extra choices. |
| Cricket separate Other runs row | 0, 1, 2, 3, 4 and 6 share the even ball grid. Unusual run values remain in the scoring flow/sheet. |
| Cricket batter/bowler/partnership/over-detail cards | Scorecard drill-down. This needs the owner's second design pick. |
| Cricket separate small swap-strike control | Equal Strike utility beside Undo, Card and More. |
| Kabaddi centre timer disc and separate raid cues | Status slot. Mat counts go in secondary. |
| Kabaddi seven defender tokens + Bonus always on screen | Raid result sheet with a 4 x 2 grid. The engine still owns pending score, revivals and all-out. |
| Kabaddi Touched / Stepped out and extra count bars | Player-marking flow inside the raid sheet. |
| Kabaddi independent result and last-raid cards | Four raid actions; details stay in the sheet and Undo. |
| Lift on every pressable control | Flat shipped rows; lift only on the listed transitions. |

## State truth and how it was checked

| Sport | Rendered states and reasoning |
| --- | --- |
| Volleyball | Reused event log. Mid-set is 18-16 in set 2 after 25-21. Full time is 3-1 in sets after 25-20 in the fourth. Deciding end change fires at 8. The browser walk scored the left team, undid it, changed ends, started the next set and undid match over. |
| Badminton | Reused event log. Mid-game is 17-15 in game 2 after 21-17. A's 17 is odd, so the serve is from the left court. Full time is 2-0 after 21-18. Deciding change is at 11. The browser walk covered point/undo, end change, next game and undo from full time. |
| Table tennis | Reused event log. Game 2 starts with B serving. At 7-5 there are 12 total points, so B serves the first of its next pair. Full time is 3-1 after 11-9. Deciding change is at 5; deuce uses one serve each. The same browser transitions were walked. |
| Tennis | Hand fixture: 6-4 in set 1; set 2 is 4-3, current points 40-30, Sharma serving. Break is after the seventh game, an odd count, with the next game at 0-0. Verma won that seventh game and Sharma serves next. Full time is 6-4, 6-3, so 2-0 in sets. This is arithmetic and sequence reasoning, not an executed tennis engine. |
| Football | Hand fixture: 2-1 in half 2, 12:34 remaining in a 45-minute half. Break is 1-0 at half time. Full time is 2-1 after two halves. No added time in this example. |
| Basketball | Hand fixture: FIBA 4 x 10 minutes. 54-49 at 04:32 in Q3; pause keeps score and clock; full time 78-74 after Q4. No tied final, so no overtime is needed. |
| Hockey | Hand fixture: field hockey 4 x 15 minutes. 2-1 at 08:12 in Q3; quarter break preserves score; full time 3-2. The example explicitly has no extended penalty corner pending. |
| Kabaddi | Hand fixture: standard 7-player timed match. Mid-match is 18-16 in half 2, with 08:42 left and 22 of 30 raid seconds left. Both sides have 7 on mat and no pending marks, which is a legal new-raid state after revivals/resets. Break is 14-12 at half time. Full time is 32-29, no active raid. These snapshots do not claim to be one simulated raid sequence. |
| Cricket | Hand fixture: T20 first innings 145/6 after 120 balls, target 146. Chase 120/3 after 96 balls needs 26 from 24. Break shows Yet to bat, not 0 overs falsely marked complete. Finish at 146/4 after 116 balls means 6 wickets and 4 balls left. Overs 19.2 means 19 x 6 + 2, not a decimal. |

The source checks used `src/models/setsRules.js`, `src/utils/tennisScoring.js`, `src/utils/goalsPeriods.js`, `src/utils/kabaddiRules.js` and `src/utils/cricketCalculations.js` on the named remote ref. The fixture arithmetic above is rung 3 evidence. The sets interactions and rendered concepts are rung 5 evidence for this local concept, not for production persistence.

## Measurements

All 54 final views were measured with getBoundingClientRect in the T3 integrated preview. They are 9 sports x mid-match, break, match over x 360x780 and 390x844. Each had body width equal to the viewport and board height within the viewport. Initial element boxes for the 36 comparison states are in measurements.json; the initial three-state pass is in final-geometry.json; the round 1 pass is in round1-geometry.json. The current horizontal-centre pass, including those 54 fixture views and name stress cases, is in round2-centres.json.

| Box | 360x780 | 390x844 |
| --- | --- | --- |
| Board gutter | 16px each side | 16px each side |
| Content width | 328px | 358px |
| Gap between keys/cards | 16px | 16px |
| Top Finish target | 64x48px | 64x48px |
| Each team card | 156x200px | 171x200px |
| Header including status | 328x264px | 358x264px |
| Status track | 328x64px | 358x64px |
| Two-column scoring and utility key | 156x96px | 171x96px |
| Basketball three-column key | 98.7x64px | 108.7x64px |
| Cricket four-column key | 70x64px | 77.5x64px |
| Match-over pair | 156x96px | 171x96px |

The 50-character name was measured again at both 360px and 390px in round 2, on either or both sides. In the supplied football long-name image, both cards are 232.6px high and the score boxes share y=180.6px. The width values in the table above are rounded; the exact horizontal centres are recorded in round2-centres.json.

The PNGs are exact phone-size crops. Each comparison contains two phone panes plus a 16px seam, so the comparison file itself is 736x780 or 796x844. The individual new/reference files are exactly 360x780 or 390x844. The preview captures at 1.25 device scale; export resamples uniformly to CSS pixels. Tall preview captures were clipped, so only their first complete row was used. Remaining rows were captured separately. No stretched crop remains in the final PNG set.

## Verification and limits

- Rung 5: all 9 concepts rendered at both sizes; all 27 states inspected at each size. The three sets engines were walked through point, undo, end change, next set/game and undo from full time.
- Rung 4: the required concept-style check passed for all 3 HTML pages. Each shipped marker is a verbatim CSS copy; the custom block has layout rules only.
- Rung 3: the six other sports use the hand-checked snapshots above. Their scoring, clocks, player and innings actions are drawings, not working engines.
- Rung 2: reference boards were rebuilt from the named origin/master component markup and shipped CSS. They are labelled **Origin/master reference reconstruction** in the images. They are not captures of the running app, and they are not pixel-accurate substitutes for a real-component acceptance pass. Tennis, cricket and kabaddi omit some source detail in these reconstructions.
- The browser reports 404s for build-time imports retained verbatim in index.css (`tailwindcss`, the relative font stylesheet and relative safe-area import). Fonts are embedded from the prior prototype; safe-area CSS is also inlined. These failed requests do not supply the page style.
- Web-font-loaded captures were made. A font-blocked pass and a real-app component capture remain owed before app implementation is approved.
- Test cricket, doubles and custom-format states are mapped by the contract but not rendered as separate format examples in this packet. The sport-level T20 and singles examples do not prove those formats.
- No test suite, app build, backend command or deployment ran on this laptop. The normal commit hook ran config sync, lint and type checking. All passed; lint reported 27 warnings and 0 errors.
- The lead must arrange the independent rules/design review required by AGENTS.md before showing these as an approved design. This sub-agent did not run another agent.

## Review round 1 corrections

All 7 findings are addressed in this packet. The reference panes remain source reconstructions, as stated above.

| Finding | Change | Browser evidence |
| --- | --- | --- |
| Cricket reference break | Current striker, non-striker and bowler figures are omitted at innings break. The hero says Innings break and Yet to bat. | At both phone sizes, the break reference contains 0 `.ck-players` blocks. |
| Kabaddi reference break | Centre clock and half come from `clock` and `half` on the same fixture as the team totals and status. | Half-time reference shows 00:00 and Half 1, agreeing with both team cards and the stopped-clock status. |
| Sets completed scores | Every historical pair is formatted in the current header left/right order. | 36 rendered checkpoints across fixture end changes, next-game starts and manual flips had 0 mismatches. The event log itself is unchanged. |
| Break choices | Flat `.kit-rrow` choices show the shipped `.kit-chip` Selected marker and `aria-pressed`. Server choices use team names. | Both side choices and both server choices were selected and deselected at both sizes. Selected and unselected buttons keep only the inset hairline. Boxes are 156x96px at 360px and about 171x96px at 390px, with no content overflow. |
| Sheet Done | Added layout-only min-width 48px to the existing `.kit-linkbtn`. | Done measures 48x48px with box-shadow none at both sizes. |
| Badminton interval | Deliberate 2x2 grid: Resume, Scorecard, Undo, More. Scorecard opens match detail; More appears once. | Both sizes show exactly those 4 keys, each with the sport's regular 96px key height. Direct example: `prototype.html?bare=1&sport=bd&state=interval`. |
| Tennis serve cue | Sharma serves next is in status with Change ends. Detail now contains only the game count and last game winner. | Both sizes show the serve cue in status and no serve cue in detail. |

`round1-history-and-choices.json` contains the 36 history checkpoints. `round1-browser-checks.json` records both reference panes, all interval keys, choice toggles and Done measurements. `round1-geometry.json` is the refreshed 54-view pass, with 0 measured overflow views. These are browser observations, rung 5 for the local concepts. The fixture arithmetic remains the hand reasoning described above.

The round re-rendered the 12 affected sets mid-match/full-time comparisons, refreshed their individual panes, the 9-sport overview and the grid overlay. It also added 8 comparisons for cricket/kabaddi/tennis breaks and the badminton interval, plus 4 standalone selected-choice and Done images. At the round 1 head (bfb0302), the PNG set had 44 comparisons, 88 individual panes, 4 review images, 1 overview and 1 overlay, for 138 PNGs. Every new comparison uses exact 360x780 or 390x844 iframe viewports; the pair includes a 16px seam.

The normal style check is repeated for all 3 pages. No test suite ran. The normal commit hooks still run config sync, lint and type checking without bypasses.

## Review round 2 final geometry

The header cards now have one explicit `minmax(0,1fr)` column and stretched grid items. Name, main score and secondary score each fill that column and share the card's horizontal centre. This removes the content-sized column left by the shipped team chip's inherited space-between alignment. No paint or sport rules changed.

The system tables now use `table-layout: fixed`. Their cells use `overflow-wrap: anywhere`, so long class names and transition labels wrap inside the available column instead of extending the page.

| Measured value | 360x780 | 390x844 |
| --- | --- | --- |
| Football card centres, left / right | 94.0 / 266.0px | 101.6 / 288.8px |
| Name, score and secondary centres, left / right | 94.0 / 266.0px | 101.6 / 288.8px |
| Largest slot-to-card centre error, all cases | 0.000003815px | 0px |
| System document scrollWidth | 345px | 375px |
| Flat-controls table left / right edge | 38.0 / 306.8px | 38.0 / 337.2px |

The centre pass covers all 9 sports, mid-match/break/match-over states, both viewport sizes and 5 name cases: the fixture names, short A/B names, the 50-character name on the left, on the right and on both sides. That is 270 board scenarios and 1,620 individual name/score/secondary centre checks. Every error is below 0.000004px, within the requested 1px tolerance. `round2-centres.json` contains every measured centre and card height. The 54 fixture views fit their viewport heights. Long-name stress cases can grow vertically, as allowed by the header contract; horizontal centring is checked in those cases too.

At 360px, document scrollWidth is 345px, which is less than or equal to 360. The vertical scrollbar reserves the remaining width. At 390px the same measurement is 375px. `round2-system.json` records the document widths and table/cell bounds. No overflow-hiding rule was added.

All 44 comparison PNGs and their individual panes were re-rendered after the header change. The 4 round 1 review images, overview and overlay were refreshed too. Two system-table images and two 50-character-name images were added. The current PNG set has 142 files: 44 comparisons, 88 individual panes, 6 review images, 2 system images, 1 overview and 1 overlay. The image index links the new evidence. `capture-round2.json` lists the fresh board captures; `round2-capture-checks.json` records their viewport and header checks.

These are measured browser observations, rung 5 for the local concept pages. The previous reference-reconstruction and sport-engine limits still apply. The required style check is repeated on all 3 HTML pages. No test suite ran; the normal commit hooks run without bypasses.

## Owner choices

1. Header and flat keys. **A** keep the two score cards above flat scoring keys. **B** revise toward scores inside the scoring keys. **Default A**, for the next concept review only.
2. Cricket detail. **A** keep batter/bowler detail behind Scorecard, as drawn. **B** keep one compact batter/bowler strip on the board. **Default A**. This is a design choice, not permission to implement or merge.
