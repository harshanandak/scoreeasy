# Sets board: two layouts in the shipped Kit style

Volleyball, badminton and table tennis. Two layouts, B Court and A Board over pads, drawn with the Kit that is already shipped. Owner call, 13 Nov: layout may change, style may not. The earlier pass used a different look. That look is gone from this folder.

## How the style is kept

`prototype.html` inlines the shipped CSS word for word, taken from origin/master: Tailwind preflight, the `src/index.css` tokens with `.se-ctl` and `.se-go`, `safeArea.css`, `boardShell.css`, `teamBoard.css`, `kit.css`, `live.css`, `setup.css`. The markup uses their classes: `.sb`, `.sb-top`, `.sb-bar`, `.sb-undo`, `.sb-sheet`, `.tsb-key`, `.tsb-mark`, `.tsb-srv`, `.tsb-point-cue`, `.tsb-set`, `.se-ctl`, `.se-go`, `.kit-seg`, `.kit-chip`, `.kit-live-*`.

The prototype's own style block is layout only: sizes, grids, spacing, overflow. It has no colour values, no font-family, no border-radius, no box-shadow and no border. Colour appears only as references to shipped tokens (`var(--se-*)`, `var(--team-*)`). Fonts are the shipped Figtree and Barlow Condensed. The rules engine is unchanged from the earlier pass.

## What B and A are

**B Court.** The two team keys are the board. Each key is a whole half of the screen, in the order the teams stand on court. Name, score and serve sit on the key. This is today's board with a tidier head and the set results shown under the status line.

**A Board over pads.** A scoreboard card sits on top: both team names once, big scores, sets won. Two tall pads sit under it, one per team, in team colour, with a big +1. The serve marker is on the serving pad. The board is for reading, the pads are for tapping.

Both layouts: the status line reads `Set 2 · Sets 0–1` (B) or `Set 2 · To 25` (A), then the set chips (swatch plus score), then the last point. Undo stays in the bottom thumb zone and says the score it goes back to. When play pauses (end change, between sets, match over, new match) the shipped sheet look docks above the bar, so the board stays on screen.

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

- Undo bottom edge: 18px above the bottom safe area (the shipped `.sb-bar` padding). The rule is 24px at most. Undo is 283 x 60 px (without Let). More is 64 x 60 px.
- Numeral contrast, white numerals on the team key, worst point of the gradient with the 7% sheen: red 4.69:1, blue 4.69:1. Yellow v white kit: 10.95:1 and 12.50:1 (ink numerals). The A board numerals are ink on white, about 19.7:1.
- The keys are 176 x 591 px in B at mid-set. The smallest key in a docked state is 150px high.

## Where Finish went

Nowhere new. Finish stays in the header, top right, the shipped `.se-ctl.sb-finish`, 75 x 48 px. In the prototype it opens a "Finish this match?" sheet with the score. It is dashed and disabled once the match is over, because New match takes over. It is not in the thumb zone on purpose: a deliberate action should not sit next to Undo.

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
| Undo row | `.sb-bar` with `.se-ctl.sb-undo` and `.sb-more` |
| Team swatches (square, ink edge) | `.sb-sport-dot`, painted with the team core token |
| Live table | `.kit-live-list`, `.kit-live-row`, `.kit-live-team`, `.kit-live-score`, `.kit-live-sets`, `.kit-live-meta`, `.kit-chip` |
| Last 12 points dots | `.kit-step-num` painted with the team tokens |
| Winner flag | `.tsb-srv` ("Winner") on the key, `.kit-chip` on the A board and live rows |

## Differences from today's board, said plainly

- The header title is the sport, not "Team v Team", so names appear once.
- Completed set chips sit under the status line. Today they live in the More sheet.
- The last-point line uses a swatch, not a team name.
- Let (badminton, table tennis) sits in the bar between Undo and More. The More button is 56px wide there (it is 64px without Let), so Undo keeps its whole hint at 360px.
- End change, between sets and match over dock above the bar instead of opening over the board.
- At the break in A, "Serves first" is a chip in the board column, because the pads are gone then. In B it is the key tag.
- The live view is built from Kit parts. No shipped Kit spectator scorecard exists yet, and the old spectator page is not a style source.
- At 360px the B key names truncate with an ellipsis ("Chennai Challeng..."), as they do on today's board.

## Files

- `prototype.html`: the tappable prototype. Open it in a browser. Tap the gear row at the top to change sport, layout (B, A, or Today) and team colours, and to open the live view. Query options: `?sport=vb|bd|tt&dir=b|a|today&state=mid|deuce|change|between|over|decider&live=1&kit=light&bare=1`.
- `b-court-*.png`, `a-board-*.png`: each sport, each layout, 390 x 844: mid-set, deuce, end change, between sets or games, match over, and for volleyball the deciding set toss. Frames run left to right in the file name order.
- `live-*.png`: the spectator view, three sports mid-set and one match over.
- `compare-*-today-b-a.png`: today's board (rebuilt from the shipped TeamSetsBoard markup and CSS), B and A at the same state.
- `narrow-360x780-*.png`: 360 x 780 checks.
- `today-*-360x780.png`: captures of the real app today, for reference. The app shell adds a "Reconnecting" badge that the rebuilt board leaves out.

## Not done, said plainly

- The pictures were rendered with web fonts loaded. The fonts-blocked render was not done in this pass.
- In the prototype the More sheet lists Swap sides and Correct as disabled rows, and Finish only shows its check. Those work as on today's board and were left out.
- No tests were run, and nothing under `src/` was touched.
