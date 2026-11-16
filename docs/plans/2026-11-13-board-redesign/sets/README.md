# Sets board: two layouts in the shipped Kit style

Volleyball, badminton and table tennis. Two layouts, B Court and A Board over pads, drawn with the Kit that is already shipped. Owner call, 13 Nov: layout may change, style may not. The earlier pass used a different look. That look is gone from this folder.

## How the style is kept

`prototype.html` and `top-and-bar.html` both inline the shipped CSS word for word, taken from origin/master: Tailwind preflight, the `src/index.css` tokens with `.se-ctl` and `.se-go`, `safeArea.css`, `boardShell.css`, `teamBoard.css`, `kit.css`, `live.css`, `setup.css`. Each shipped file sits between `/* shipped:<repo path> */` and `/* /shipped */` marker lines, and `src/index.css` is pasted whole, including its `@import`, `@custom-variant` and `@theme inline` lines, which browsers ignore inline. `scripts/check-concept-style.sh` prints ok for both pages. The script is in origin/master, not in this branch; it was run from a copy of that file, from this worktree, against this worktree's shipped files. The markup uses their classes: `.sb`, `.sb-top`, `.sb-bar`, `.sb-undo`, `.sb-more`, `.sb-sheet`, `.tsb-key`, `.tsb-mark`, `.tsb-srv`, `.tsb-point-cue`, `.tsb-set`, `.se-ctl`, `.se-go`, `.kit-seg`, `.kit-chip`, `.kit-step-num`, `.kit-live-*`. Team colour on swatches and dots comes from the shipped `.tsb-key-a` and `.tsb-key-b` classes, not from inline paint.

The prototype's own style block is layout only: sizes, grids, spacing, overflow. It has no colour values, no font-family, no border-radius, no box-shadow and no border. The only inline `style` attributes set custom properties (the engine's `--team-*` palette and `--sport-mark`, and `--kit-seg-cols`) or grid and size layout; none sets a colour, background, border, radius or shadow. Fonts are the shipped Figtree and Barlow Condensed. The rules engine is the earlier pass's with one added event: `flip`, for the Swap ends button. It turns left and right over during play; score, serve and phase do not change, and Undo reverses it. Nothing else in the engine changed.

## What B and A are

**B Court.** The two team keys are the board. Each key is a whole half of the screen, in the order the teams stand on court. Name, sets won, score, serve, set point and last point sit on the key. This is today's board with a tidier head, one status strip and a new action bar.

**A Board over pads.** A scoreboard card sits on top: both team names once, big scores, sets won. Two tall pads sit under it, one per team, in team colour, with a big +1. The serve cue is the chip on the board column; the serving pad carries only the sport mark. The board is for reading, the pads are for tapping. `Last point` and "+1 wins the set" sit on the pads.

Both layouts (top section, redesigned 16 Nov, see `top-and-bar.html`): two rows above the board. Row one is the header: the sport, then `Set 2 · best of 5 · to 25, win by 2`, and Finish. Row two is one status strip: the finished sets as chips (swatch plus score), or one short prompt before the first set ends. Sets won (`1 set won`), serve, set point, match point, deuce and `Last point` sit on the team they belong to. `Last point` comes from the team that scored last in the current game, so Swap ends does not remove it and Undo of a later point restores it. The bottom bar is the action bar: Undo (first, says the score it goes back to), the game's own actions, then More. When play pauses (end change, between sets, match over, new match) the shipped sheet look docks above the bar, so the board stays on screen.

**The action bar.** Two, three or four buttons depending on the game. The prototype wires volleyball (Undo, Swap ends, More), badminton (same, Let is in More) and table tennis (Undo, Let, Swap ends, More). `top-and-bar.html` draws the bar for all eleven game modes with a line of reasoning each. Swap ends and Let are disabled while play is paused, because the docked sheet handles the end change then.

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

- Action bar, measured at 360 px wide on `top-and-bar.html` (grid rule under "Geometry"): every button is 68 px tall. Two buttons: Undo 216 x 68, More 104 x 68. Three buttons: Undo 160 x 68, Swap ends 76 x 68, More 76 x 68. Four buttons: Undo 126 x 68, the others 59 x 68. The bar has 16px under the buttons.
- Top section at 360 x 780: the B keys start 108 px from the top (168 px before) and are 580 px tall (520 px before). Those two numbers are printed on `top-and-bar.html`, read from the page.
- Tap targets: every tappable control in both pages is at least 48 px tall, including the prototype's own gear, Live view and Restart controls and the "Tap it in the prototype" buttons.
- The contrast figures below were measured in the repaint round, at 390 x 844, and the redesign did not change the colours they use.
- Numeral contrast, white numerals on the team key, worst point of the gradient with the 7% sheen: red 4.69:1, blue 4.69:1. Yellow v white kit: 10.95:1 and 12.50:1 (ink numerals). The A board numerals are ink on white, about 19.7:1.
- The smallest key in a docked state is 150px high.

## Geometry (round 3, 17 Nov)

The owner said the direction was right but spacing and alignment were bad. These are the rules now, in `prototype.html` under `/* layout only */`, and `geometry-overlay-b-vb.png` draws them on the B board.

- Spacing scale, px: 4, 8, 12, 16, 24, 32, 40, 48. The v2 layout uses no other value. 48 is the tap minimum; 24 to 40 are only used for reserved text slots inside a key.
- One page gutter, `--kd-g` = 16. The header text, the status strip, the keys (or the A board and pads), the docked sheet and the bar all start at x = 16 and end at x = 344 on a 360 wide phone. Before, the title started at 18 while the keys and bar started at 14, and the right edges were 16, 14 and 17.
- One gap, `--kd-gap` = 8: between blocks down the screen (header, strip, keys or board and pads, sheet, bar), between the two keys, between bar buttons, between the sheet's two buttons. Before it was 10 between keys, 8 between bar buttons and 14 at the page edge. The board's own flex gap supplies the vertical 8; no block has a margin of its own.
- Header: 12 above, 0 below, text and Finish on the gutter. The strip is 32 tall and the chips are 30, so the space above and below them is the same. The strip is centred on the seam between the keys (x = 180).
- B key: one stack, centred in the part of the key above the watermark. Rows: name 40 (two lines reserved, text centred), sets won 16, score, serve tag 40, set point cue 32, last point 24, next tap hint 24, 4 between rows. Both keys reserve every row, so name, score and Serving are at the same y in both whoever serves or scored last.
- Watermark: the key's bottom padding is the watermark's height (84.3% of the key width, the shipped mark is 118% wide at 140:100) plus 16, so no text row reaches it. In docked states the keys are 150 tall and the watermark is hidden; the Serving tag stays.
- Bar: one grid of N+1 equal columns for an N-button bar. Undo spans 2 columns, every other button 1. Every button, Undo included, has one layout: 8 above, a 22px icon, 4, a 14px label centred, so the icons and the labels share a y in every bar. Undo adds its "back to" hint as a third row. A label that does not fit on one line (Swap ends in a 59px column) wraps to a second line instead of shrinking.
- A: the board card and the pads sit on the same gutter and the same 8 gap; the two columns share five row tracks with 4 between rows; the pad stack is centred above its watermark.
- Open risk: the A board reserves a row for the set point flag, so the card has spare room under the serve chip when no flag shows. Collapsing it would move the pads under the scorer's thumb when a flag appears.

## Where Finish went

Nowhere new. Finish stays in the header, top right, the shipped `.se-ctl.sb-finish`, 73 x 48 px (the title is larger, so it no longer leads). In the prototype it opens a "Finish this match?" sheet with the score. It is dashed and disabled once the match is over, because New match takes over. It is not in the thumb zone on purpose: a deliberate action should not sit next to Undo.

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
- The bar is Undo, the game's actions, More (see `top-and-bar.html`). Let (table tennis) is in the bar; in badminton it is a row in More.
- End change, between sets and match over dock above the bar instead of opening over the board.
- In A, the serve cue is one chip in the board column in every state: "Serving" (with the court side or "1 of 2") during play, end change and interval, "Serves first" at the break. The pads only carry the sport mark on the serving side. In B it is the in-flow tag on the key.
- In A the two columns share their row heights, so a two-line team name at 360px does not push that team's score below the other.
- The live view header shows the green Live badge while the match runs and the shipped `.kit-live-paused` label "Match over" once it ends.
- The live view is built from Kit parts. No shipped Kit spectator scorecard exists yet, and the old spectator page is not a style source.
- At 360px the B key names wrap to two lines ("Chennai Challengers"). Today's board cuts them with an ellipsis.

## Files

- `top-and-bar.html`: before and after of the top section and the bar, and the bar drawn for every game. `top-and-bar.png` is a picture of its first section, reduced to 256 colours to stay under the 250 KB image limit. `top-bar-before-vb.png`, `top-bar-after-b-vb.png`, `top-bar-after-a-vb.png`, `top-bar-after-b-bd-deuce.png`, `top-bar-after-b-tt-endchange.png`: 360 x 780 pictures (rendered at 1.25x, so 450 x 975 px). `geometry-overlay-b-vb.png`: the B volleyball board with the gutter (pink), the 8px gaps (amber), the seam (blue) and the block edges (green) drawn over it. The overlay was drawn on the open page and is not in any shipped file.
- `prototype.html`: the tappable prototype. Open it in a browser. Tap the gear row at the top to change sport, layout (B, A, or Today) and team colours, and to open the live view. Query options: `?sport=vb|bd|tt&dir=b|a|today&state=mid|deuce|change|between|over|decider&live=1&kit=light&bare=1`.
- `b-court-*.png`, `a-board-*.png`: each sport, each layout, 390 x 844: mid-set, deuce, end change, between sets or games, match over, and for volleyball the deciding set toss. Frames run left to right in the file name order.
- `live-*.png`: the spectator view, three sports mid-set and one match over.
- `compare-*-today-b-a.png`: today's board (rebuilt from the shipped TeamSetsBoard markup and CSS), B and A at the same state.
- `narrow-360x780-*.png`: 360 x 780 checks.
- `today-*-360x780.png`: captures of the real app today, for reference. The app shell adds a "Reconnecting" badge that the rebuilt board leaves out.

## Not done, said plainly

- The pictures were rendered with web fonts loaded. The fonts-blocked render was not done in this pass.
- In the prototype the More sheet lists Correct a score as a disabled row (and Let in badminton, which works), and Finish only shows its check. Correct works as on today's board and was left out. Swap sides moved to the bar as Swap ends.
- Clock, Pause, Period, Foul, Corner and Swap strike buttons on `top-and-bar.html` are drawings; their engines are not in this prototype. So are the More items marked "proposed, not built" there (for example volleyball Timeouts, hockey End quarter and its extended-corner state). Let only shows a note: a let records nothing.
- The b-court, a-board, compare, narrow and live PNGs in this folder were taken before the top section and bar redesign. They show the old layout. The new pictures are the `top-bar-*.png` files.
- No tests were run, and nothing under `src/` was touched.
