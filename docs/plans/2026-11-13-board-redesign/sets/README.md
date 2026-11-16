# Sets board: two layouts in the shipped Kit style

Volleyball, badminton and table tennis. Two layouts, B Court and A Board over pads, drawn with the Kit that is already shipped. Owner call, 13 Nov: layout may change, style may not. The earlier pass used a different look. That look is gone from this folder.

## How the style is kept

`prototype.html` inlines the shipped CSS word for word, taken from origin/master: Tailwind preflight, the `src/index.css` tokens with `.se-ctl` and `.se-go`, `safeArea.css`, `boardShell.css`, `teamBoard.css`, `kit.css`, `live.css`, `setup.css`. Each shipped file sits between `/* shipped:<repo path> */` and `/* /shipped */` marker lines, and `src/index.css` is pasted whole, including its `@import`, `@custom-variant` and `@theme inline` lines, which browsers ignore inline. `scripts/check-concept-style.sh prototype.html` (from PR #290, not merged yet) passes against origin/master files. The markup uses their classes: `.sb`, `.sb-top`, `.sb-bar`, `.sb-undo`, `.sb-sheet`, `.tsb-key`, `.tsb-mark`, `.tsb-srv`, `.tsb-point-cue`, `.tsb-set`, `.se-ctl`, `.se-go`, `.kit-seg`, `.kit-chip`, `.kit-live-*`.

The prototype's own style block is layout only: sizes, grids, spacing, overflow. It has no colour values, no font-family, no border-radius, no box-shadow and no border. Colour appears only as references to shipped tokens (`var(--se-*)`, `var(--team-*)`). Fonts are the shipped Figtree and Barlow Condensed. The rules engine is unchanged from the earlier pass.

## What B and A are

**B Court.** The two team keys are the board. Each key is a whole half of the screen, in the order the teams stand on court. Name, sets won, score, serve, set point and last point sit on the key. This is today's board with a tidier head, one status strip and a new action bar.

**A Board over pads.** A scoreboard card sits on top: both team names once, big scores, sets won. Two tall pads sit under it, one per team, in team colour, with a big +1. The serve marker is on the serving pad. The board is for reading, the pads are for tapping.

Both layouts (top section, redesigned 16 Nov, see `top-and-bar.html`): two rows above the board. Row one is the header: the sport, then `Set 2 · best of 5 · to 25, win by 2`, and Finish. Row two is one status strip: the finished sets as chips (swatch plus score), or one short prompt before the first set ends. Sets won (`1 set won`), serve, set point, match point, deuce and `Last point` sit on the team they belong to. The bottom bar is the action bar: Undo (first, says the score it goes back to), the game's own actions, then More. When play pauses (end change, between sets, match over, new match) the shipped sheet look docks above the bar, so the board stays on screen.

**The action bar.** Two, three or four buttons depending on the game. The prototype wires volleyball (Undo, Swap ends, More), badminton (same, Let is in More) and table tennis (Undo, Let, Swap ends, More). `top-and-bar.html` draws the bar for all eleven game modes with a line of reasoning each. Swap ends and Let are disabled while play is paused, because the docked sheet handles the end change then.

## What changed this round

1. The Mono look is gone: black scoreboard, uppercase JetBrains Mono labels, 2px ink frames and hard shadows on the keys, court and net lines, the white SERVING pill, capital gold flags, hard-framed prompt cards. Every element now uses a shipped class (list below).
2. The four rule and wording fixes stay:
   - Volleyball: the next set's first server is locked to the team that did not serve first last set. Only the deciding set has a toss, and there you tap a key (B) or a board column (A).
   - End change: title "Teams change ends", buttons "Flip the screen" (the green default) and "Keep the screen as is", note "Choose Keep if you moved round the court with them." The same wording is used between sets.
   - Each team name once per screen. Between sets: swatch plus "won 25–22". "Serves first" sits on that team's key. Live view: serve marker on the serving row, "swatch + 4 in a row", winner marked on its row.
   - B match over shows both teams once with final counts, winner marked.
3. C (Bands, two full-width bands stacked like a TV scorebug) was dropped. Its weak point, from the first review: the top band is a long reach for a thumb, and top and bottom do not match left and right on the court, so a scorer translates it in their head. It also depended on the scoreboard look that the owner has now ruled out. Two layouts are enough to choose from. Its live table idea lives on in the live view here, rebuilt from Kit parts.

## Measured

At 390 x 844, measured in the prototype with `getBoundingClientRect`:

- Action bar, measured at 360 px wide on `top-and-bar.html`: every button is 60 px tall. Three buttons: Undo 154 x 60, Swap ends 81 x 60, More 81 x 60. Four buttons: Undo 109 x 60, Let 60 x 60, Swap ends 79 x 60, More 60 x 60. Two buttons: Undo 248 x 60, More 76 x 60. The bar padding is 16px under the buttons (was 18), so the bottom gap is still under 24px.
- Top section at 360 x 780: the B keys start 110 px from the top (168 px before) and are 582 px tall (520 px before). Those two numbers are printed on `top-and-bar.html`, read from the page.
- The numbers below were measured in the previous round, at 390 x 844, before the redesign of the top section and bar. They are kept for the contrast and key figures, which the redesign did not change. The Undo and More sizes they gave are replaced by the bullets above.
- Numeral contrast, white numerals on the team key, worst point of the gradient with the 7% sheen: red 4.69:1, blue 4.69:1. Yellow v white kit: 10.95:1 and 12.50:1 (ink numerals). The A board numerals are ink on white, about 19.7:1.
- The keys are 176 x 591 px in B at mid-set. The smallest key in a docked state is 150px high.

## Where Finish went

Nowhere new. Finish stays in the header, top right, the shipped `.se-ctl.sb-finish`, 69 x 48 px (narrower padding than before, and the title is larger, so it no longer leads). In the prototype it opens a "Finish this match?" sheet with the score. It is dashed and disabled once the match is over, because New match takes over. It is not in the thumb zone on purpose: a deliberate action should not sit next to Undo.

## Elements changed from the old look and the shipped class now used

| Old look | Now |
| --- | --- |
| Black scoreboard (`.b-info`, `.a-board`) | Plain status text `.tsb-meta` plus light set chips `.tsb-set`; in A a `.sb-sheet-group` card |
| Uppercase mono labels | Sentence case in `.tsb-meta`, `.tsb-word`, `.sb-title small` |
| Framed keys with hard 3px shadow | `.tsb-key` (24px radius, hairline, soft lift) |
| Court and net lines in B | Removed; the 10px gap between keys is plain spacing |
| White SERVING pill | `.tsb-srv` tag plus the sport mark `.tsb-mark` on the serving key only |
| Gold capital flags | `.tsb-point-cue` ("Set point", "Deuce") |
| Framed prompt cards | `.sb-sheet` with `.sb-sheet-head`, docked above the bar |
| Hard-edged pick buttons | `.se-go` (Flip the screen, Start set, New match), `.se-ctl` (Keep), `.kit-seg` (between sets choices, format) |
| Mono top bar with Back and Saved | `.sb-top` with `.sb-title` and `.se-ctl.sb-finish`; `.sb-live` in the live view |
| Undo row | `.sb-bar.kd-bar` with `.se-ctl.sb-undo` first, `.se-ctl.kd-act` actions, `.se-ctl.sb-more` last |
| Team swatches (square, ink edge) | `.sb-sport-dot`, painted with the team core token |
| Live table | `.kit-live-list`, `.kit-live-row`, `.kit-live-team`, `.kit-live-score`, `.kit-live-sets`, `.kit-live-meta`, `.kit-chip` |
| Last 12 points dots | `.kit-step-num` painted with the team tokens |
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
- At 360px the B key names truncate with an ellipsis ("Chennai Challeng..."), as they do on today's board.

## Files

- `top-and-bar.html`: before and after of the top section and the bar, and the bar drawn for every game. `top-and-bar.png` is a picture of its first section. `top-bar-before-vb.png`, `top-bar-after-b-vb.png`, `top-bar-after-a-vb.png`, `top-bar-after-b-bd-deuce.png`, `top-bar-after-b-tt-endchange.png`: 360 x 780 pictures (rendered at 1.25x, so 450 x 975 px).
- `prototype.html`: the tappable prototype. Open it in a browser. Tap the gear row at the top to change sport, layout (B, A, or Today) and team colours, and to open the live view. Query options: `?sport=vb|bd|tt&dir=b|a|today&state=mid|deuce|change|between|over|decider&live=1&kit=light&bare=1`.
- `b-court-*.png`, `a-board-*.png`: each sport, each layout, 390 x 844: mid-set, deuce, end change, between sets or games, match over, and for volleyball the deciding set toss. Frames run left to right in the file name order.
- `live-*.png`: the spectator view, three sports mid-set and one match over.
- `compare-*-today-b-a.png`: today's board (rebuilt from the shipped TeamSetsBoard markup and CSS), B and A at the same state.
- `narrow-360x780-*.png`: 360 x 780 checks.
- `today-*-360x780.png`: captures of the real app today, for reference. The app shell adds a "Reconnecting" badge that the rebuilt board leaves out.

## Not done, said plainly

- The pictures were rendered with web fonts loaded. The fonts-blocked render was not done in this pass.
- In the prototype the More sheet lists Correct a score as a disabled row (and Let in badminton, which works), and Finish only shows its check. Correct works as on today's board and was left out. Swap sides moved to the bar as Swap ends.
- Clock, Period, Foul, Corner and Swap strike buttons on `top-and-bar.html` are drawings; their engines are not in this prototype. Let only shows a note: a let records nothing.
- The b-court, a-board, compare, narrow and live PNGs in this folder were taken before the top section and bar redesign. They show the old layout. The new pictures are the `top-bar-*.png` files.
- `scripts/check-concept-style.sh` is not in this branch (it is in origin/master). Both pages were checked with that copy, run from this worktree, and print ok.
- No tests were run, and nothing under `src/` was touched.
