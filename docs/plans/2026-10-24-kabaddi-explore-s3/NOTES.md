# s3 — Scorer: "Attack vs defence"

**The idea.** The board is split the way the scorer thinks about a raid: *who earned the point*. Each team keeps its own side, the side it stands on court and the side its score sits on in the strip. That side takes the role it plays in this raid. The raiding side holds the attack outcomes (touch count, bonus). The defending side holds the defence outcome (Tackled). Empty and Raider out sit neutrally underneath, because no team earns a touch from them. So the scorer taps toward the team that scored.

**Who it optimises for, and how.** The courtside scorer.
- **Large targets.** Touch keys are 52px. Tackled is a 96–200px slab on the defending side. The outcomes nobody earned are 56px. Raid by / Confirm sits in the same thumb spot every time.
- **Confirm reads the result back in words.** For example: "Confirm · Royals +2 · 2 touches / Strikers 3→1 · Royals 5→7 · 26–21 · Strikers next". The pips preview it too: defenders going out are struck through, and players coming back show as + in the team's own row.
- **Super tackle needs no extra step.** On the defending side, Tackled already says "Super tackle · Strikers +2", and the side is framed in gold.
- **Undo restores the whole raid.** The Undo bar shows what it will restore, and a note confirms afterwards ("Raid undone · 24–21 · mat 5–3 · Royals raid next").
- **Round-3 restraint.** Hairline/tinted sides, little shadow, numbers first. The hand-drawn underline appears only on the super tackle / all out moment and on the final verdict.

**What it shows about the progress of the game.**
- **Score strip:** both totals and the half clock.
- **Per side:** mat strength as a big number plus pips, and the sitting block in revival order with the next player in marked.
- **Tags:** Do or die, Super tackle on, and the empty-raid count.
- **Between raids, each side lists what the next raid puts at stake,** from engine previews. For example: "Must score · an empty raid puts the raider out, Strikers +2", "All out if all 3 are touched", "No bonus · Strikers have 3 on mat".
- **Below the sides:** the last three raids.
- **The big moment** lands on the side that earned it.
- **Full time:** each side gets its raid / tackle / all out / extras split, then first half, second half and super tackles. These come from the raid journal.

**Tap counts.** Each count includes Raid by and Confirm, the same way #210 v1 (3/3/5/3/3) was counted.

| Outcome | s3 | v1 |
|---|---|---|
| Empty | 3 (Raid · Empty · Confirm) | 3 |
| 1 touch | 3 (Raid · 1 · Confirm) | 3 |
| 2 touches + bonus | **4** (Raid · 2 · Bonus · Confirm) | 5 |
| Tackled | 3 (Raid · Tackled · Confirm) | 3 |
| Super tackle | 3 (detected automatically) | 3 |

- **Raider out:** 3 taps, or 4 if the reason is not the default "Stepped out".
- **Bonus only:** 3 taps.
- **Cancel raid:** 2 taps (⋯ → Cancel raid). This is one more than the court board (#210 v2).

**Fixture (engine-true).** Every number comes from real `applyRaid` events on a fresh match; the fixture lives in `.s3/harness.jsx`.
- **Half 1:** 20 raids, ending 16–10.
- **Half 2, to the rest state:** 13 raids. The all out is raid 25, when Strikers touched Royals' last player. The match reaches 24–21, mat 5–3, Royals on 2 empties (do or die), 12:40 left.
- **Mid-raid:** 12 s later, so 18 s are left on the raid clock, with 2 touched selected.
- **The moment:** Tackled at 3 defenders, which the engine scores as a super tackle → 24–23.
- **Full time:** 19 more raids, then time up → 37–31.

The clock is frozen in the harness. The brief's targets were hit exactly; no adjustment was needed.

**Data it needs that the engine / broadcast doesn't expose today.**
- **Scorer side: nothing new.** The stakes lines are `preview()` calls. The first-half score and super-tackle counts are read from the raid journal (`entry.after`, `superTackleExtra` awards). The engine could offer these as helpers so they don't live in a component.
- **Live broadcast: only score totals today.** If the viewer page ever mirrors this, it would need mat strength and sitting order, the raid state (raiding team, do or die, super tackle on), and moments (super tackle / all out).
- **Players are anonymous.** The pips are anonymous count-only slots (`A1…A7`). Named or numbered raiders would need the later roster policy.

**Honest weaknesses.**
- **The controls swap sides every raid.** Because sides are fixed to teams, the attack keys sit on the left in one raid and the right in the next. That is the point of "tap toward the team that scored", but it costs left/right muscle memory. Only the vertical positions stay fixed. The alternative is attack always on the left with colours following the raider; Harsha should choose.
- **Half 2 puts the second team on the left.** The board honours the engine's `courtSide` swap at half time, so in half 2 Strikers sit on the left, unlike the title order. Swap sides in ⋯ fixes it.
- **The seven touch keys are always drawn.** Keys beyond the defenders on the mat are disabled (dashed) to keep positions fixed. With 3 defenders, that leaves visible dead keys.
- **Wasted space at rest.** The sides have room the stakes list only partly fills.
- **Cancel raid is buried in ⋯.** It takes two taps where the court board took one.
- **No spectator value.** This is a scorer direction only; the live viewer still needs its own design.
- **The Confirm detail line truncates.** On complex raids (all out plus revivals) it ellipsises at 360px, though the headline stays whole.
- **Harness only.** This is a harness-level prototype. `KabaddiSplitBoard` replaces `KabaddiRaidBoard` in `MonoQuickMatch` on this branch only. I did not run the full test suite, and the existing kabaddi board tests target the court board.

Screens: `s3-1-rest-390.png`, `s3-1-rest-360.png`, `s3-1-rest-390-dark.png`, `s3-2-raid-390.png`, `s3-3-moment-390.png`, `s3-4-end-390.png`. Extras: `s3-3a-tackled-preconfirm-390.png` (Tackled picked, before Confirm) and `s3-5-undo-390.png` (super tackle undone). Every capture's in-page audit reported 0 enabled buttons under 48px and no page scroll.
