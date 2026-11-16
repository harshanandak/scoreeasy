# Sets board: two layouts in the shipped Kit style

Volleyball, badminton and table tennis. Two layouts, B Court and A Board over pads, drawn with the Kit that is already shipped. Owner call, 13 Nov: layout may change, style may not. The earlier pass used a different look. That look is gone from this folder.

## How the style is kept

`prototype.html` and `top-and-bar.html` both inline the shipped CSS word for word, taken from origin/master: Tailwind preflight, the `src/index.css` tokens with `.se-ctl` and `.se-go`, `safeArea.css`, `boardShell.css`, `teamBoard.css`, `kit.css`, `live.css`, `setup.css`. Each shipped file sits between `/* shipped:<repo path> */` and `/* /shipped */` marker lines, and `src/index.css` is pasted whole, including its `@import`, `@custom-variant` and `@theme inline` lines, which browsers ignore inline. `scripts/check-concept-style.sh` prints ok for both pages. The script is in origin/master, not in this branch; it was run from a copy of that file, from this worktree, against this worktree's shipped files. The markup uses their classes: `.sb`, `.sb-top`, `.sb-bar`, `.sb-undo`, `.sb-more`, `.sb-sheet`, `.tsb-key`, `.tsb-mark`, `.tsb-srv`, `.tsb-point-cue`, `.tsb-set`, `.se-ctl`, `.se-go`, `.kit-seg`, `.kit-chip`, `.kit-step-num`, `.kit-live-*`. Team colour on swatches and dots comes from the shipped `.tsb-key-a` and `.tsb-key-b` classes, not from inline paint.

The prototype's own style block is layout only: sizes, grids, spacing, overflow. It has no colour values, no font-family, no border-radius, no box-shadow and no border. The only inline `style` attributes set custom properties (the engine's `--team-*` palette and `--sport-mark`, and `--kit-seg-cols`) or grid and size layout; none sets a colour, background, border, radius or shadow. Fonts are the shipped Figtree and Barlow Condensed. The rules engine is the earlier pass's with one added event: `flip`, for the Swap ends button. It turns left and right over during play; score, serve and phase do not change, and Undo reverses it. Nothing else in the engine changed.

## What B and A are

**B Court.** The two team keys are the board. Each key is a whole half of the screen, in the order the teams stand on court. Name, sets won, score, serve, set point and last point sit on the key. This is today's board with a tidier head, one status strip and a new action bar.

**A Board over pads.** A scoreboard card sits on top: both team names once, big scores, sets won. Two tall pads sit under it, one per team, in team colour, with a big +1. The serve cue is the chip on the board column; the serving pad carries only the sport mark. The board is for reading, the pads are for tapping. `Last point` and "+1 wins the set" sit on the pads.

Both layouts (top section, redesigned 16 Nov, see `top-and-bar.html`): two rows above the board. Row one is the header: the sport, then `Set 2 · best of 5 · to 25, win by 2`, and Finish. Row two is one status strip: the finished sets as chips (swatch plus score), or one short prompt before the first set ends. Sets won (`1 set won`), serve, set point, match point, deuce and `Last point` sit on the team they belong to. `Last point` comes from the team that scored last in the current game, so Swap ends does not remove it and Undo of a later point restores it. The bottom bar is the action bar: Undo (first, says the score it goes back to), the game's own actions, then More. When play pauses (end change, between sets, match over, new match) the shipped sheet look docks above the bar, so the board stays on screen.

**The action bar.** The three sets sports (volleyball, badminton, table tennis) have a bar of equal buttons, and how many is the owner's choice, not mine. The prototype's control strip has "Bar: 3 or 4" (`?bar=3|4`), default 3. **Bar 3:** volleyball and badminton get Undo, Swap ends, More, and Replay (volleyball) and Let (badminton) are rows in More, because both are real but rare. Table tennis keeps Undo, Let, Swap ends, More, because a let is frequent there. **Bar 4:** Undo, Replay or Let, Swap ends, More in all three. Replay and Let are the same action: the rally is played again and no point is scored. The prototype shows a note for it and records nothing. Undo says what it undoes in one centred line above the row, so no button grows for it. The bar keeps the old bar's footprint (84 px with its 16 px bottom padding), so nothing above it moves. `top-and-bar.html` draws the grids and says plainly that the choice is the owner's, draws the bar for all eleven game modes with a line of reasoning each (the eight rows that are not sets sports are unchanged from round 3). Swap ends, Let and Replay are disabled while play is paused, because the docked sheet handles the end change then.

## What changed in the repaint round (13 Nov)

1. The Mono look is gone: black scoreboard, uppercase JetBrains Mono labels, 2px ink frames and hard shadows on the keys, court and net lines, the white SERVING pill, capital gold flags, hard-framed prompt cards. Every element now uses a shipped class (list below).
2. The four rule and wording fixes stay (the top section and bar redesign above came after them):
   - Volleyball: the next set's first server is locked to the team that did not serve first last set. Only the deciding set has a toss, and there you tap a key (B) or a board column (A).
   - End change: title "Teams change ends", buttons "Flip the screen" (the green default) and "Keep the screen as is", note "Choose Keep if you moved round the court with them." The same wording is used between sets.
   - Each team name once per screen. Between sets: swatch plus "won 25–22". "Serves first" sits on that team's key (B) or board column (A). Live view: serve marker on the serving row, "swatch + 4 in a row", winner marked on its row.
   - B match over shows both teams once with final counts, winner marked.
3. C (Bands, two full-width bands stacked like a TV scorebug) was dropped. Its weak point, from the first review: the top band is a long reach for a thumb, and top and bottom do not match left and right on the court, so a scorer translates it in their head. It also depended on the scoreboard look that the owner has now ruled out. Two layouts are enough to choose from. Its live table idea lives on in the live view here, rebuilt from Kit parts.

## Measured

Measured with `getBoundingClientRect`:

- Sets bar, measured with `getBoundingClientRect` in `prototype.html` itself (the frame is the viewport: 360 x 780 and 390 x 844; B and A are the same). Every button is 48 px tall at y = 716 (360) and y = 780 (390), under a 16 px Undo line at y = 696 (360) and y = 760 (390).
  - Bar 3, three buttons: 104 x 48 at 360 (x = 16, 128, 240), 114 x 48 at 390 (x = 16, 138, 260). The seam between the keys runs through the middle of Swap ends (centre x = 180 and 195).
  - Bar 4, four buttons: 76 x 48 at 360 (x = 16, 100, 184, 268), 83.5 x 48 at 390 (x = 16, 107.5, 199, 290.5). The gap between buttons two and three (x = 176 to 184 at 360, 191 to 199 at 390) is the seam between the keys.
  - Table tennis is the 4-button bar in both modes. Every label ("Swap ends" included) is on one line at 0.78rem, the Kit's smallest label size.
- Above the bar, ordinary play (mid-game, set point and deuce states of all three sports, B and A, 360 x 780 and 390 x 844, bar 3 and bar 4): every rectangle matches `722f4d7`. 0 of 29 to 52 rectangles per state differ, in 56 comparisons. Text is also compared by the rendered position of every text run above the bar (DOM ranges): identical to `722f4d7` for volleyball mid-game, B and A, bar 3 and bar 4, at 360 x 780. The 4 px text padding rule keeps the frozen line-height of 1.2, so it moves no text. Volleyball, B, 360 x 780, mid-game, `722f4d7` / bar 3 / bar 4: header 0,0,360x60 in all three; strip y 68, h 32 in all three; keys y 108, h 580 in all three; first key x 16, w 160 in all three; name y 170.95; score y 234.95, 129.6 x 119.22; bar y 696, h 84 in all three. A: board y 108, h 245.63; pads y 361.63, h 326.38; bar y 696, h 84 in all three. At 390 x 844: B keys y 108, h 644; A board y 108, h 245.63, pads y 361.63, h 390.38; bar y 760, h 84, in all three.
- The bar's own box (top, height) is identical to `722f4d7` in 160 of 160 sport, state, layout and size combinations.
- Not in ordinary play: the docked states (first server, end change, between sets, match over) differ from `722f4d7` above the bar. The cause is the fixes made after `722f4d7` to those states (serve row 40 high, on-scale margins in the docked sheet), not the bar. Checked by removing those fixes from a copy: in B at 360 x 780 the 11 docked states then differ from `722f4d7` by 2 rectangles each, both zero-size hidden lines, and the keys and text are identical.
- The other eight games' bars, unchanged from round 3, drawn on `top-and-bar.html` and measured there with the page 1960 px wide, where each mock is a 360 px bar: every button 68 px tall. Two buttons: Undo 216, More 104. Three buttons: Undo 160, the others 76. Four buttons: Undo 126.4, the others 59.2. With the page 360 px wide (layout width 360, no scrollbar) the same rows are 310.4 px bars: Undo 204.26 and More 98.13; Undo 151.2 and 71.6 (three); Undo 119.35 and 55.67 to 55.69 (four). The three sets rows there are 48 high: bar 3 is 98.13 each, bar 4 is 71.6 each.
- The three option mocks on `top-and-bar.html`: with the page 1960 px wide, each is a 360 px bar and the buttons are 104, 76 and 160 px wide, 48 high. With the page 360 px wide each mock is a 328 px bar and the buttons are 93.33, 68 and 144 px wide. The page prints the width it is rendering, and what the buttons measure there.
- Top section at 360 x 780 (the page prints these two numbers, read from the rendered frames): the B keys start 108 px from the top (168 px before) and are 580 px tall (520 px before). The bar change does not alter either.
- Tap targets: every tappable control in both pages is at least 48 px tall, including the prototype's own gear, Live view and Restart controls and the "Tap it in the prototype" buttons.
- The contrast figures below were measured in the repaint round, at 390 x 844, and the redesign did not change the colours they use.
- Numeral contrast, white numerals on the team key, worst point of the gradient with the 7% sheen: red 4.69:1, blue 4.69:1. Yellow v white kit: 10.95:1 and 12.50:1 (ink numerals). The A board numerals are ink on white, about 19.7:1.
- A docked B key has a 150 px minimum height. Rendered at 360 x 780 the keys are 275 to 414 px tall across the three sports (between games 275, end change 297 to 342, first server 335, match over 379 to 414).

## Geometry (round 3, 17 Nov)

The owner said the direction was right but spacing and alignment were bad. These are the rules now, in `prototype.html` under `/* layout only */`, and `geometry-overlay-b-vb.png` draws them on the B board.

- Spacing scale, px: 4, 8, 12, 16, 24, 32, 40, 48. The v2 board layout (everything under `.kd-v2`, and the sets bar) uses no other value for padding, margin, gap or row height. Heights of tap targets and minimums (48, 64, 96, 150) are sizes, not spacing. 24 to 40 are only used for reserved text rows inside a key. Named exceptions, kept off the scale on purpose so that no rectangle above the bar moves from `722f4d7`: the swatch's right margin (6), the gap inside a finished-set chip (6), and the A board's serve chip padding (4 above and below, 10 left and right). Moving the chip gap to 8 widened each set chip by 2 px and wrapped the strip onto two rows in the end-change state (67.5 px tall instead of 32); moving the swatch margin and the serve chip padding shifted the A names and chips by 1 to 2 px. Also off the scale, and said plainly: the live view, the Today layout, the before frames on `top-and-bar.html` and the prototype's own control strip keep their older values (14, 10, 6), and the shipped Kit classes keep their own internal values. The 4 px text padding under `.kd-v2` (`.tsb-word`, `.kd-line`) is the one on-scale change in the upper board that took effect this round: it replaced an old 6, the text keeps the same x position (centred), and no line wrapped differently.
- One page gutter, `--kd-g` = 16. The header text, the status strip, the keys (or the A board and pads), the docked sheet and the bar all start at x = 16 and end at x = 344 on a 360 wide phone. Before, the title started at 18 while the keys and bar started at 14, and the right edges were 16, 14 and 17.
- One gap, `--kd-gap` = 8: between blocks down the screen (header, strip, keys or board and pads, sheet, bar), between the two keys, between bar buttons, between the sheet's two buttons. Before it was 10 between keys, 8 between bar buttons and 14 at the page edge. The board's own flex gap supplies the vertical 8; no block has a margin of its own.
- Header: 12 above, 0 below, text and Finish on the gutter. The strip is 32 tall and the chips are 30, so the space above and below them is the same. The strip is centred on the seam between the keys (x = 180).
- B key: one stack, centred in the part of the key above the watermark. Rows: name 40 (two lines reserved, text centred), sets won 16, score, serve tag 40, set point cue 32, last point 24, next tap hint 24, 4 between rows. Both keys reserve every row, so name, score and Serving are at the same y in both whoever serves or scored last.
- Watermark: the key's bottom padding is the watermark's height (84.3% of the key width, the shipped mark is 118% wide at 140:100) plus 16, so no text row reaches it. In docked states (150 px minimum, 275 to 414 rendered) the watermark is hidden and the serve row is the same 40 as in play, because "Serves first · right court" needs 36.7, so both keys keep the same rows in every state.
- Sets bar rule: one column per button, all columns equal, nothing spans two. Bar 3 is three columns (the seam runs through the middle button), bar 4 is four columns of the 8px gap, so the middle gap is the seam between the keys and each key has two buttons under it. Each button is 48 tall: icon 22, 4, label 14, centred. Undo's "back to 16–17" is one centred line (0.84rem, the Kit's Undo hint style, 16 high) above the row, 4 above the buttons. 16 + 4 + 48 is the old row's 68, so the bar's footprint is unchanged.
- Other games' bars (unchanged from round 3): one grid of N+1 equal columns for an N-button bar, Undo spanning 2, every other button 1, each 8 above the icon, 68 tall, a label that does not fit wraps to a second line.
- A: the board card and the pads sit on the same gutter and the same 8 gap; the two columns share five row tracks with 4 between rows. The pad stack (+1, Last point, hint) is centred in the whole pad, not above a reserved watermark band: reserving the band would lift it about 40 px in ordinary play. At 360 x 780 the visible "Last point" line clears the watermark by 27 px and the reserved, usually empty, hint row touches it (0.6 px overlap). At 390 x 844 the hint row clears it by 11.6 px.
- A first-server phase: the card is sized for its rows before the pads get the spare room, and because no serve chip or flag can exist yet, those two rows and the large numerals are not drawn. The names, scores and sets won all sit inside the card at 360 x 780 and 390 x 844.
- Open risk: the A board reserves a row for the set point flag, so the card has spare room under the serve chip when no flag shows. Collapsing it would move the pads under the scorer's thumb when a flag appears.

## Where Finish went

Nowhere new. Finish stays in the header, top right, the shipped `.se-ctl.sb-finish`, about 73 x 48 px (73.35 measured; font loading moves it by under 1 px; the title is larger, so it no longer leads). In the prototype it opens a "Finish this match?" sheet with the score. It is dashed and disabled once the match is over, because New match takes over. It is not in the thumb zone on purpose: a deliberate action should not sit next to Undo.

## Elements changed from the old look and the shipped class now used

| Old look | Now |
| --- | --- |
| Black scoreboard (`.b-info`, `.a-board`) | One status strip `.tsb-meta` with light set chips `.tsb-set`; in A a `.sb-sheet-group` card |
| Uppercase mono labels | Sentence case in `.tsb-meta`, `.tsb-word`, `.sb-title small` |
| Framed keys with hard 3px shadow | `.tsb-key` (24px radius, hairline, soft lift) |
| Court and net lines in B | Removed; the 8px gap between keys is plain spacing |
| White SERVING pill | B: `.tsb-srv` tag (in the flow) plus the sport mark `.tsb-mark` on the serving key only. A: `.kit-chip` on the board column plus `.tsb-mark` on the serving pad |
| Gold capital flags | `.tsb-point-cue` ("Set point", "Deuce") on the team that has it |
| Framed prompt cards | `.sb-sheet` with `.sb-sheet-head`, docked above the bar |
| Hard-edged pick buttons | `.se-go` (Flip the screen, Start set, New match), `.se-ctl` (Keep), `.kit-seg` (between sets choices, format) |
| Mono top bar with Back and Saved | `.sb-top` with `.sb-title` and `.se-ctl.sb-finish`; `.sb-live` in the live view |
| Undo row | `.sb-bar.kd-bar` with `.se-ctl.sb-undo` first, `.se-ctl.kd-act` actions, `.se-ctl.sb-more` last |
| Team swatches (square, ink edge) | `.sb-sport-dot` with the shipped `.tsb-key-a` or `.tsb-key-b` class, so it takes the team gradient (no inline colour) |
| Live table | `.kit-live-list`, `.kit-live-row`, `.kit-live-team`, `.kit-live-score`, `.kit-live-sets`, `.kit-live-meta`, `.kit-chip` |
| Last 12 points dots | `.kit-step-num` with the shipped `.tsb-key-a` or `.tsb-key-b` class |
| Winner flag | `.tsb-srv` ("Winner") on the key, `.kit-chip` on the A board and live rows |

## Differences from today's board, said plainly

- The header title is the sport, not "Team v Team", so names appear once, on the keys, in full (up to two lines, no ellipsis).
- The header's small line carries the set: `Set 2 · best of 5 · to 25, win by 2`. The old `Set 2 · Sets 0–1` meta row is gone; sets won is `1 set won` on each team.
- Completed set chips sit in one strip under the header. Today they live in the More sheet.
- The last-point line is gone. `Last point` sits on the team that scored it, and Undo says the score it goes back to.
- Set point and match point sit on the team that has it. Deuce shows on both keys.
- The serve tag is in the flow under the score, in a slot both keys reserve, not on the key's top edge.
- The sets bar is equal buttons, 3 or 4 by the owner's choice (see `top-and-bar.html`). Under bar 3, the default, Replay (volleyball) and Let (badminton) are rows in More and the note there says Swap ends moved to the bar; under bar 4 they are bar buttons and the rows are gone.
- End change, between sets and match over dock above the bar instead of opening over the board.
- In A, the serve cue is one chip in the board column in every state: "Serving" (with the court side or "1 of 2") during play, end change and interval, "Serves first" at the break. The pads only carry the sport mark on the serving side. In B it is the in-flow tag on the key.
- In A the two columns share their row heights, so a two-line team name at 360px does not push that team's score below the other.
- The live view header shows the green Live badge while the match runs and the shipped `.kit-live-paused` label "Match over" once it ends.
- The live view is built from Kit parts. No shipped Kit spectator scorecard exists yet, and the old spectator page is not a style source.
- At 360px the B key names wrap to two lines ("Chennai Challengers"). Today's board cuts them with an ellipsis.

## Files

- `top-and-bar.html`: before and after of the top section and the bar, and the bar drawn for every game. `top-and-bar.png` is a picture of its "The sets bar: three symmetric grids" section at 1960 x 1000, reduced to 256 colours to stay under the 250 KB image limit. `top-bar-before-vb.png`, `top-bar-after-b-vb.png`, `top-bar-after-a-vb.png`, `top-bar-after-b-bd-deuce.png`, `top-bar-after-b-tt-endchange.png`: 360 x 780 pictures (rendered at 1.25x, so 450 x 975 px). `geometry-overlay-b-vb.png`: the B volleyball board with the gutter (pink), the 8px gaps (amber), the seam (blue) and the block edges (green) drawn over it. The overlay was drawn on the open page and is not in any shipped file.
- `prototype.html`: the tappable prototype. Open it in a browser. Tap the gear row at the top to change sport, layout (B, A, or Today) and team colours, and to open the live view. The strip also has "Bar: 3 or 4", default 3. Query options: `?sport=vb|bd|tt&dir=b|a|today&state=mid|deuce|change|between|over|decider&bar=3|4&live=1&kit=light&bare=1`.
- `b-court-*.png`, `a-board-*.png`: each sport, each layout, 390 x 844: mid-set, deuce, end change, between sets or games, match over, and for volleyball the deciding set toss. Frames run left to right in the file name order.
- `live-*.png`: the spectator view, three sports mid-set and one match over.
- `compare-*-today-b-a.png`: today's board (rebuilt from the shipped TeamSetsBoard markup and CSS), B and A at the same state.
- `narrow-360x780-*.png`: 360 x 780 checks.
- `today-*-360x780.png`: captures of the real app today, for reference. The app shell adds a "Reconnecting" badge that the rebuilt board leaves out.

## Not done, said plainly

- The pictures were rendered with web fonts loaded. The fonts-blocked render was not done in this pass.
- In the prototype the More sheet lists Correct a score as a disabled row, and Finish only shows its check. Correct works as on today's board and was left out. Swap sides moved to the bar as Swap ends.
- Clock, Pause, Period, Foul, Corner and Swap strike buttons on `top-and-bar.html` are drawings; their engines are not in this prototype. So are the More items marked "proposed, not built" there (for example volleyball Timeouts, hockey End quarter and its extended-corner state). Let and Replay only show a note: a replayed rally records nothing.
- The b-court, a-board, compare, narrow and live PNGs in this folder were taken before the top section and bar redesign. They show the old layout. The new pictures are the `top-bar-*.png` files.
- No tests were run, and nothing under `src/` was touched.
