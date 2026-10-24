# s1 · Scorer: "Raid pad"

**The idea.** The scorer's screen is a fixed keypad, like an official scoring tablet. The bottom ~70% is the pad: 1 2 3 4+ / Bonus · Empty / Tackled · Raider out. No key moves between raids, so after a few raids the thumb learns where everything is. One bar under the pad starts the raid (30 s clock) and then becomes Confirm, which reads the engine's result back in words: "Confirm · Royals +2 — Strikers 2 out · Royals 2 back · next: Strikers raid".

**Who it optimises for, and how.** It is built for the courtside scorer with eyes on the court.
- **Keys mean the same thing every raid.** The top row is touch counts (the raider's points), the middle row is the raider's other outcomes, and the bottom row is the defence's. Raider keys carry the raiding team's colour on top; defence keys carry the defending team's colour underneath. Colour tells you who scores; position tells you what happened.
- **The engine decides which keys work.** It previews each key's own ruling, and a key it rejects stays in place, dashed and grey, with the reason ("needs 6 · 3 on mat", "3 on mat"). Every key's sub-label is that engine preview, e.g. Empty in a do-or-die raid reads "do or die · Strikers +2" and Tackled reads "Strikers +2 · super".
- **The tape** is a fixed 56 px "display" between the strip and the pad. It shows the entry being built, a C (clear) key, the reason chips for Raider out, the 4–7 keys, and at rest the last raid (tap it for the raid log).
- **Cancel raid** sits at the left of the tape and C at the right, so a double tap can't cancel a raid.
- **Big moments** (super tackle, all out) appear in a team-coloured banner over the status strip only, never over the pad. It carries the new score and the mat changes, and dismisses after 4.5 s or on a tap.
- **The status strip** shows both scores in court-side order, the mat as a number plus 7 pips, the half clock, and the raid clock (big, inside a ring in the raider's colour, while a raid runs). DO OR DIE (danger) and SUPER TACKLE ON (gold) are loud, worded flags.

**What it shows about the progress of the game.** Deliberately little: score, mat strength, clocks, the last raid, and the do-or-die and super-tackle flags. The half story is shown only at half time and full time, where the summary takes the pad's place: points by type, a 1st/2nd-half split, and raids · all outs · super tackles per team. This direction does not try to serve the live viewer.

**Tap counts** (Start raid on the whistle → keys → Confirm):

| Raid | #210 v1 | Raid pad, with raid clock | Raid pad, quick (no clock) |
|---|---|---|---|
| Empty | 3 | 3 | 2 |
| 1 touch | 3 | 3 | 2 |
| 2 touches + bonus | 5 | **4** | 3 |
| Tackled | 3 | 3 | 2 |
| Super tackle | 3 | 3 (same keys as Tackled; the engine awards it) | 2 |

The "quick" path: tapping a result key at rest stages an implicit raid. The engine already supports this ("with no draft, applyRaid starts and resolves one atomically"), so the scorer can skip the raid clock. With the clock, the pad beats v1 only on compound raids and ties it everywhere else. 4–7 touches cost one extra tap (4+, then the number).

**Fixture (engine-true; nothing hand-set).** `.kbs1/fixture.js` plays every raid through `startRaid`/`applyRaid` from 0–0.
- Half 1 is 26 raids, one every 45 s. It ends 15–15 with an all out of Royals on raid 26; there was also an all out of Strikers on raid 17.
- Half 2 is 11 raids, one every 40 s, ending at 12:40 left: 24–21, mat 5–3, Royals on 2 empties (do or die), super tackle on.
- Raid 38 is tackled, which gives a super tackle: 24–23, mat 4–4.
- 17 more raids lead to time-up. Final: Strikers win 33–30, with an all out on raid 45.

The wall clock is frozen per scene, so 12:40 and the 18 s raid clock are exact. One departure from the brief: the earlier all out falls at the end of half 1, not inside the visible recent raids; it is in the raid log and in the full-time counts.

**Data it needs that the engine or broadcast doesn't expose today.**
- `preview()` returns per-team totals, not award categories. "Super" is inferred from `isSuperTackleOn` plus a raider-out outcome, and the banner reads categories from the confirmed entry. A `preview().awards` would remove the inference.
- There is no half-time score API. The 1st/2nd-half split is read from the last half-1 raid's `after` snapshot.
- Implicit (no-clock) raids record no raid duration.
- The live broadcast still carries totals only. Mat, do-or-die, the raid clock and moments never leave the scorer's phone.

**Honest weaknesses.**
- **Keys re-tint every raid.** Positions are fixed, but the touch row's colour bar flips with the raiding team. Court-side order also flips at half time, which is truthful to the court but means the score positions swap.
- **No way to enter "touched then tackled".** The engine's `mixed` ruling is not on the pad (the same gap as #210). Neither are technical points or defender-out by referee.
- **The quick path makes it easy to never run the raid clock.** That hides the 30 s / do-or-die timing from the scorer.
- **The banner covers the flags and score strip for 4.5 s.** It repeats the score, but a scorer starting the next raid at once sees the flags only after it clears.
- **Raider out silently defaults its reason to "Stepped out".** Points are unaffected; only the log wording is.
- **Little game sense: no court and no momentum.** That is right for the scorer, but this screen is no help to the live viewer.
- **This is a harness prototype.** MonoQuickMatch mounts the pad only when localStorage `se_kabaddi_board=pad` is set (the harness sets it); the court board stays the default, so #210's board tests still pass (229 passed, 4 expected-fail, plus the 74 engine and glue tests). The pad has no tests of its own, and nothing was checked on a real phone, in sunlight or with haptics.

Screens: `s1-1-rest-390.png`, `s1-1-rest-360.png`, `s1-1-rest-390-dark.png`, `s1-2-raid-390.png` (2 touches staged; bonus and 4+ disabled with only 3 defenders), `s1-3-moment-390.png` (super tackle banner), `s1-4-end-390.png` (full time).

Measured in the rendered pages:
- Every enabled target is at least 48 px. Keys are 85×142 and 177×110 at 390, 79×93 and 163×72 at 360.
- Key coordinates are identical in the rest, raid and moment states.
- The pad zone starts at 28% of the screen height at 390×844 and 30% at 360×640.
- The board fits exactly in 640 px.
- Minimum text contrast is 6.21:1 in light and 5.59:1 in dark, after fixing the dark do-or-die flag, which first measured 2.21:1.
