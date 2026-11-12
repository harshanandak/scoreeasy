# Sets board redesign: three directions (volleyball, badminton, table tennis)

Concept round for Harsha to approve. Design only: nothing under `src/` changed, no PR.

Open [compare.html](compare.html) first. It shows today's board and the three directions in the same match states. Each direction also has its own page with every state for all three sports, a 360x780 row and a long-name stress test:

- [direction-a-board-over-pads.html](direction-a-board-over-pads.html)
- [direction-b-court.html](direction-b-court.html)
- [direction-c-bands.html](direction-c-bands.html)

PNG renders sit next to the pages. Name pattern: `<direction>-<scorer|live>-<390x844|360x780>-<fonts|nofonts>.png`. Each PNG is a sheet of 12 screens: rows are mid-set, set point or deuce, end change, between sets; columns are volleyball, badminton, table tennis. `nofonts` is the same page with web fonts blocked, to prove the layout holds on system fonts. [compare-overview.png](compare-overview.png) is a full capture of compare.html. [today-board-360.png](today-board-360.png) is today's board.

All numbers below are measured on the 390x844 PNGs (volleyball mid-set, set 2 at 18-16) unless said otherwise. Today's numbers come from the existing 360x780 capture, so they are close but not the same size of screen.

## What is shared by all three

- Real tokens and fonts from the app (`mono.css`, `index.css`, `sportsTokens.js`): Figtree, JetBrains Mono, Barlow Condensed numerals, hard 3px shadow, teal for team A and orange for team B.
- Left and right court sides are labelled on screen. After an end change the labels stay put until the scorer taps Swap sides, so the screen never flips under their thumb.
- Serve is always visible: volleyball "serving", badminton "A serves, left court" with a small service-court glyph, table tennis "serve 1 of 2" that becomes "serve changes each point" at 10-10.
- Undo shows the point it will remove ("CHA 18-16"). It must also reverse a serve change and a set change. After a set is won it says it undoes the winning point.
- Let (badminton and table tennis only) never adds a point.
- Smallest text is 12px in every direction. Today's smallest is also 12px (`text-xs`).
- Live screens add "last 12 points", key moments and a point-by-point lead line. Those are derived from recorded point events and hide themselves if a match has none. Sample sequences in these mockups are made up.

## Direction A: Board over pads

Idea:
- Dark scoreboard on top, two tinted tap pads below.
- The board carries every fact: both names in full (two lines), score, sets won, past set scores, serve and set point.
- Undo and Let sit in one row between board and pads, so they cannot be hit by accident from a pad tap.

What it does better than today:
- Names are never cut: two lines on the board, full name in the serve line.
- Tap area: 2 pads of 414 high by 172 wide (49% of screen height). Today is about 558 by 160 (71%), so A gives some of the height back to the information.
- Shows past set scores, sets won, timeouts, serve and "to 19" on each pad.
- Closest to the July concept and to today's code: one dark scorebug component can serve both the scorer and the live page.

Weak point: the pads shrink whenever the board grows. At an end change they drop to 311 high, and at 360 wide with long names they are smaller again.

## Direction B: Court

Idea:
- The screen is the court. A slim dark bar holds the set, sets won and past set scores.
- The two court halves are the tap targets, left and right as the scorer sees them, with the net between. Court lines are drawn per sport (attack line, service boxes, table).
- Serve is drawn on the court: pill on the serving half, the service box and its diagonal in badminton, "1 of 2" in table tennis. Undo, Let and Swap sides share one bottom row.

What it does better than today:
- Biggest tap area: 2 halves of 579 high by 175 wide (69% of screen height), 517 high at an end change.
- The screen matches the physical court, so left and right are obvious and serve location reads at a glance.
- Giant numerals (about 113px) readable at arm's length in sunlight.
- Live page: a read-only court plus race-to-target bars ("CHA needs 7, MUM needs 9").

Weak point: least set history on the scorer (only a chip row in the top bar), and the only guard between two huge taps is the net strip. A stray thumb near the middle scores for someone. Needs a real device test.

## Direction C: Bands

Idea:
- Two full-width bands, one per team, stacked like a TV scorebug. Each band is the scoreboard row and the tap target in one: name, sets, timeouts, past set scores, serve and a huge score.
- A thin spine between the bands holds the set, serve line, flags, Undo, Let and Swap sides.
- The live page uses the same rows as a score table (sets, past sets, now) with a worm chart of the lead below it.

What it does better than today:
- Widest targets: 2 bands of 315 high by 346 wide (75% of screen height in total, about 280 high at an end change).
- Most information per team: past set scores as chips right on the band.
- Best live page: one score table that shows every set at once, plus the lead line and key moments.

Weak point: the top band is a long reach for a thumb, and the top and bottom rows do not match left and right on the court. They are labelled LEFT SIDE and RIGHT SIDE by reading order, which a scorer has to translate in their head.

## Recommendation

Pick B for the scorer. It has the biggest tap areas (579 high), it is the only one where the layout matches the court, and it carries serve and sides without extra text. Its weak point (set history and a stray tap at the net) is fixable: raise the history chips into a second line and add a 12px dead zone at the net, then test on a phone.

Use C's live table for the spectator page. It shows every set score in one place, which B's live page does not.

If B fails the courtside test, fall back to A. It is the safest build and the closest to the July concept.

## Decisions needed

1. Which direction for the scorer (default: B).
2. Timeouts are shown in these concepts (volleyball 2 per set, table tennis 1 per match, none in badminton). Today's engine does not track them, so this is a new feature. Keep it, or drop the T.O marks.
3. First-server choice is shown only for volleyball, where the rules module uses a manual first server. Badminton and table tennis pick it by rule.
4. Key moments and "last 12 points" need point events stored per match. Confirm they are, or the live pages need a simpler fallback.
5. Spectator counts ("watching now") are not shown because there is no data for them. Do not show them as zero.

## What was not checked

- Nothing was run on a real phone. Tap sizes are from rendered pixels.
- No tests were run (design-only change).
- At 360 wide with web fonts blocked, C's volleyball set-point numeral touches the card edge. With the real fonts it fits.
