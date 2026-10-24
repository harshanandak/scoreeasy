# v: kabaddi LIVE VIEWER (spectator page). v-a "Broadcast", v-b "Match story"

**Idea.** The person watching the live page has their eyes on the phone, so give them the match rather than the scoring controls. **v-a** is a TV scorebug over a side-on court. Royals' half sits on the left, under Royals' score; it shows who is on the mat, the sitting block in revival order and the raider crossing the midline, plus the last raid in plain words. **v-b** puts the progress of the game first: a lead-by-raid chart, then key moments, where the points came from, the mat now and the half story.

**Who it's for.** It is built for the spectator only and is read-only. The only interactive element is v-b's chart scrub. Every number comes from `src/utils/kabaddiLiveModel.js`, which folds the engine state and journal (`raidLog` effects, `before`/`after` snapshots and `result()`). The view never re-derives a rule. A test checks that the folded breakdown equals `result().breakdown`.

**Progress of the game.** v-a shows it with recent-raid chips (who raided, who scored, AO/ST), the half-time / this-half / all-outs tiles and, at full time, the turning points in order. v-b shows it with the lead after every raid. The two halves are split at HT, all outs and super tackles are marked where they happened, and you can scrub to read any raid. Both variants announce the big moment and say what it changed ("Royals lead cut to 1 · 24–23").

| | 3 seconds | 30 seconds |
|---|---|---|
| **v-a** | The score and who's ahead, the half clock, who raids next (or the raid clock and bar during a raid), DO OR DIE and SUPER TACKLE ON. | Who's on the mat and who's sitting (3 v 5, next-in order), the last raid in a sentence, the last 9 raids, half-time vs this half, all outs. **It doesn't show why the score is what it is.** |
| **v-b** | The score, and the shape of the match: Royals led all match and the gap is closing. | Every swing with its AO/ST marks, the key moments with clock and score, raid / tackle / all-out / extras per team, the mat now, each half's story. In a raid, what's at stake: "must score or the raider is out · 3 on the mat: stop the raider for a super tackle (+2)". |

**What the live broadcast must carry (checked against `MonoQuickMatch.jsx` on this branch).** Kabaddi goes live through the *goals* path (`sportRegistry` sets `engine: 'goals'`). Today the snapshot is `{pointsA, pointsB, setsA:0, setsB:0, setScores:[], currentUnit:1}` with no `periodLabel`. Each raid sends one `point` event, `{team: the bigger gainer, value: that gain}`, or an `undo`. That has three consequences on the current watch page:
1. A kabaddi viewer's scorebug reads **"0–0 sets"** (`MonoWatchMatch` falls back to sets when `periodLabel` is missing).
2. **Empty raids send nothing**, so `lastEventAt` stops moving and the page shows **PAUSED** after 90 s of empty raids, which happens routinely in kabaddi.
3. When both teams score in one raid (technical awards), the event row drops the smaller side's points.

Fields to add to a whitelisted `kabaddi` snapshot object:
- half and phase (playing / half time / full time)
- the half clock (remaining ms, a wall-clock anchor, running)
- the active raid: team, number, start time, defenders at the start
- the next raider, do-or-die and super-tackle-on flags
- the mat `[a,b]` and the sitting count `[a,b]`
- empty streaks
- the points breakdown per team (raid, incl. bonus / tackle, incl. super / all out / extras)
- the half-time score

Every raid, **including empty ones**, should send one `raid` event that carries:
- number, half, raiding team, outcome, touches, bonus
- points `[a,b]`
- the mat before and after, lost and revived counts
- the all-out team, and the super tackle, super raid and do-or-die flags
- the half clock at the start of the raid
- the score after

Undo already exists. The engine exposes all of this; the only thing it lacks is the raid's end time or duration.

**Fixture (engine-true, built by `.kbv/fixture.js`, 64 real raids).** Royals lead 18–10 at half time after an all out on raid 23. In half 2 Strikers open on a carried do-or-die, Royals lose a do-or-die, and Strikers inflict an all out (18–17). That reaches the brief's rest state exactly: H2 12:40 left, 24–21, mat 5–3, Royals on 2 empty raids (do-or-die), super tackle on. Then: mid-raid at 0:18, the super tackle by 3 Strikers (24–23), a late Strikers all out, and **Strikers win 33–31**. The half-2 sequence was found by a search through the engine (`.kbv/search*.mjs`), not typed in. The state 4 shown is the full-time result, not half time.

**Honest weaknesses.**
- **v-a** has a court that still can't show *who* is out. Slots are anonymous (`countOnly`), so "next in" is order only and no names are possible. The moment card covers the court for a moment.
- **v-b** is a long scroll (1343 px). Above the fold you get the score, chart and moments; the breakdown and mat need a scroll. The chart needs ~10 raids before its shape means anything.
- Both read the full journal. Today's broadcast gives a viewer none of it (above).
- Dark chart colours use the engine's `hi` tones, which pass the palette check. Elsewhere the per-text contrast audit the PR ran was not repeated here.
- The raid clock on the viewer is only as good as the scorer's taps; the engine never auto-ends a raid.
