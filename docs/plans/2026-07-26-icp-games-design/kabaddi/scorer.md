# ScoreEasy — Kabaddi SCORER (the operator's field console)

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the hot path) · **ICP:** Indian college / university / school / ground scorers (casual dominates).
**Design system:** design1-mono (brutalist record × HiFi-soft) · tokens verbatim from `src/index.css` — **no new colours**.
**Pattern inheritance:** the cricket lean scorer (`cricket-scorer-alt-big5.html`) — thumb-zone shell, most-tapped targets at the **bottom**, big one-tap primaries, rare outcomes in ONE compact strip, rarest in a **More** sheet, always-visible Undo. Guided-default + Power-toggle decision inherited exactly.

> **The one law of this screen.** The scorer answers exactly ONE question per raid — *"how did this raid end?"* — and the engine does **every** derived thing (revival count, revive order, all-out +2 + full revive, super-tackle, do-or-die penalty, bonus eligibility). The two commonest answers (a **single touch**, an **empty raid**) are one tap. Everything else is one lean sub-step. The scorer watches the mat, not the screen — so the buttons must be readable and un-fumble-able at arm's length in sun-glare, and no tap can ever produce an illegal state. Detail (rosters, tallies, feed, analytics) lives on the **board** and the **scorecard** — never here.

---

## 1. The verb set — primary one-tap targets + what's tucked away

Every raid resolves into **one** outcome. The engine already knows **whose raid it is** and **how many are on each mat**, so the buttons are *semantic* (what happened), never *team-picked* (which side) — that removes the single biggest fumble.

### 1.1 The Big-4 — the 90% case, big one-tap targets (thumb zone, bottom)

Four outcomes cover the overwhelming majority of raids. Each button states its own consequence in plain mono so a novice trusts the tap:

| Target | One-tap meaning | Engine does (silently) | Accent |
|---|---|---|---|
| **TOUCH** | Raider touched **one** defender & got home. `+1 · 1 OUT` | +1 raiders · 1 defender out · revive 1 raider (out-order) · all-out check | action / green (raiders score) |
| **TACKLE** | Defenders stopped the raider. `RAIDER OUT · +1` | +1 defenders · raider out · revive 1 defender · **super-tackle → +2 auto** if ≤3 on mat | danger-tint (a man goes out — never green) |
| **BONUS** | Raider crossed the bonus line. `+1` | +1 raiders · no roster change · **auto-disabled when <6 defenders on mat** | action-soft / green |
| **EMPTY** | Nothing scored. `0` | increments the empty counter → **arms do-or-die** automatically · flips possession | neutral ink |

- **TOUCH is single-touch by design** (the 90%). A multi-touch raid (2+ defenders in one raid) is the **rare strip** — the hot path never asks "how many?".
- **TACKLE never needs a super-tackle button** — the engine reads on-mat ≤3 at the moment of the tackle and awards +2 itself, narrating `SUPER TACKLE · +2`.
- **BONUS dims itself** when it isn't legal (<6 defenders, or house-rule 7-only). The scorer can't award an illegal bonus.
- **EMPTY on a do-or-die raid is structurally re-routed:** the engine converts it to `raider out · opponents +1` and narrates the penalty. An "empty" that scores nothing is *impossible* on a do-or-die raid — the scorer taps what they saw; the engine enforces the rule.

### 1.2 The rare strip — one compact hairline row (just above the Big-4)

Uncommon-but-real outcomes, one tap each, mono, low-contrast — present but never competing for the eye:

- **MULTI** — raider touched 2+ / did a combo. Expands **inline** (no modal) to a tiny count row: `+2 · +3 · +4 · +5`, plus a `+ BONUS` chip to log **bonus + touches** on the same raid (e.g. bonus +1 & touch 2 = **+3**, auto-tagged *Super Raid*). This is the only place a raid's point-total is ever composed by hand.
- **SELF-OUT** — line-out / illegal entry / lobby (plain English: **"Out of bounds"**). `+1 opponents · offender out`. Hidden entirely when the setup's *Track fouls* toggle is OFF (default OFF for a quick school game, ON for college).

### 1.3 The More sheet — the rarest / management (tucked behind `⋯ More`)

Bottom-sheet, opened only when needed, never on the hot path:
- **Timeout** (per team, engine tracks remaining) · **Substitution** (optional, off→on, never a blocker) · **Correct last raid** (full edit of the previous resolve) · **Edit setup** (half length, do-or-die trigger, bonus/super-tackle rules) · **Share live ↗** · **End half** / **End match**.

### 1.4 What is auto — the scorer NEVER taps these

All-out (+2 & full revive) · super-tackle (+2) · do-or-die penalty · revival & revive-order (Sanjeevani) · bonus eligibility · empty-counter / do-or-die arming · super-raid & Super-10 / High-5 tags · possession flip · raid-clock. The engine owns them and **narrates** each in plain English on resolve.

---

## 2. Thumb-zone layout + wireframe

Same shell law as cricket: the **record is pinned at the top and never scrolls** (`flex:none`); the **most-tapped targets sit at the very bottom** in the natural thumb arc; rarer things climb upward. One-handed, portrait, `max-width:390px`, `--se-*` tokens only.

**Top → bottom weight order (CSS `order`, most-tapped last):**
1. Topbar (back · match title · `⋯` menu)
2. **Compact live board** (State A from `main-scoreboard.md`) — pinned, never scrolls: two scores · 7 dolls/side · centre raid clock · `RAID ▸` on the raiding side · one context line.
3. **Last-raid confirm line + Undo** — the plain-English narration of the tap just made, with a fat always-visible Undo.
4. Inline **handoff banner** (only when a break/do-or-die is armed — see §3).
5. **Rare strip** (MULTI · SELF-OUT).
6. **BIG-4 primary grid** — bottom, thumb zone.
7. Footer: `Full scorecard ›` · `Share live ↗`.

```
┌───────────────────────────────────────────────┐
│  ‹   Sunday Cup · Semi-final          ● LIVE  ⋯ │  ← topbar
├───────────────────────────────────────────────┤
│  ██ COMPACT LIVE BOARD (pinned, flex:none) ██  │
│                                                │
│  RAIDERS ▸RAID        ╭────╮         SULTANS   │
│    38                 │ 22 │            31      │  ← scores (mono), raid clock centre
│                       ╰────╯                    │
│  ● ● ● ● ● ○ ○                    ● ● ● ● ● ● ● │  ← 7 dolls / side
│  5 ON MAT                            7 ON MAT   │
│ ──────────────────────────────────────────────│
│                 H1 · 08:12                      │  ← the ONE context line
├───────────────────────────────────────────────┤
│  ↺  Touch on 2 — Raiders +2, 2 back, Blue → 4  │  ← last-raid narration + UNDO
├───────────────────────────────────────────────┤
│  MULTI (2·3·4·5 +Bonus)          SELF-OUT      │  ← rare strip (hairline)
├───────────────────────────────────────────────┤
│                                                │
│   ┌──────────────────┐  ┌──────────────────┐  │
│   │      TOUCH       │  │      TACKLE       │  │  ← BIG-4: two commonest
│   │   +1 · 1 OUT     │  │  RAIDER OUT · +1  │  │     top row (largest)
│   └──────────────────┘  └──────────────────┘  │     TOUCH=green  TACKLE=danger
│   ┌──────────────────┐  ┌──────────────────┐  │
│   │      BONUS       │  │      EMPTY        │  │  ← +1 bonus  ·  0 raid
│   │       +1         │  │        0          │  │
│   └──────────────────┘  └──────────────────┘  │
│                                                │
│  Full scorecard ›                Share live ↗ │  ← footer
└───────────────────────────────────────────────┘
        ▲ thumb rests here — 90% of taps land in the Big-4
```

- **TOUCH / BONUS** carry the action-green accent (raiders scoring, the lead/positive family). **TACKLE** is danger-tinted (a raider goes out — green never sits behind a man going out, per the board's colour law). **EMPTY** is neutral ink. The colour itself tells the thumb which family it's in before the label is read.
- The board's dolls give the scorer their only roster feedback — they watch the pip dim on their own tap and trust the engine did the revive math. No roster UI on the hot path.
- **No per-raid handoff.** Unlike cricket (strike swap / new over every 6 balls), kabaddi possession **flips automatically on every resolve** — the single biggest ergonomic win. The scorer taps an outcome and is immediately ready for the next raid; the `RAID ▸` marker and dolls just update.

---

## 3. Mandatory handoffs — clean inline steps, minimal friction

Kabaddi has far fewer forced interruptions than cricket. The only true breaks are handled as **slim inline banners above the Big-4** (never modals, never blocking a tap) or, for the optional ones, a single tap in **More**.

| Handoff | Trigger | The step (friction) |
|---|---|---|
| **Turn / possession flip** | every resolve | **Zero taps.** Automatic. `RAID ▸` and dolls update; scorer is instantly ready for the next raid. |
| **Do-or-die armed** | empty-counter hits the configured trigger (default 3rd, school 2nd) | **Zero taps.** Board context line flips to `DO-OR-DIE`, raiding panel goes warning-band. Scorer just scores the raid as normal; the engine enforces the penalty on an empty. Purely informational. |
| **All-out** | a side hits 0 on mat | **Zero taps.** Engine fires +2, re-lights all 7 dolls, plays the one gold `ALL OUT · +2` beat, narrates it in the confirm line. Scoring continues. |
| **Half-time** | match clock reaches half | Inline banner replaces the rare strip: **`HALF TIME · ▸ START 2ND HALF`** — **one tap.** Engine swaps sides, keeps scores, resets both rosters to 7, resets the empty counter. No modal. |
| **Timeout** | scorer-initiated | `⋯ More → Timeout (Team)`. One tap; pauses the match clock, decrements that team's remaining. Rare, so it lives in the sheet. |
| **Substitution** | scorer-initiated (optional) | `⋯ More → Sub` → pick off / on. Never a setup blocker; casual games skip it entirely. |
| **End half / match** | scorer-initiated | `⋯ More → End half / End match` → routes to the scorecard. |

Half-time inline banner:
```
├───────────────────────────────────────────────┤
│   HALF TIME               ▸ START 2ND HALF     │  ← replaces rare strip; one tap
├───────────────────────────────────────────────┤
│              ( Big-4 stays put below )          │
```

The design intent: **the scorer should be able to run a full raid without ever leaving the Big-4 zone.** Every break either resolves itself (turn / do-or-die / all-out) or is a single unambiguous tap (half-time), and the rarest management sits one sheet away.

---

## 4. Guided (default) vs Power mode

Inherits the cricket decision exactly: **Guided is the default and is hard-to-mis-score; Power is an opt-in toggle for the experienced scorer.** Same engine, same board, same buttons — only the *confirmation ceremony* and *density* change.

### Guided (DEFAULT — un-fumble-able)
- Every resolve shows the **plain-English narration + Undo** confirm line (`"Touch on 2 — Raiders +2, 2 men back, Blue down to 4"`) so a PT teacher who doesn't know the rulebook trusts every tap.
- MULTI is collapsed (single touch is one tap; counts appear only when MULTI is opened).
- All jargon suppressed: **"Out of bounds"** not "lobby / technical"; **"players on mat"** not "antis". Fouls hidden unless enabled at setup.
- Illegal taps are structurally impossible (BONUS dims when ineligible; EMPTY re-routes on do-or-die; TACKLE auto-upgrades to super-tackle).

### Power mode (OPTIONAL toggle — the dense fast lane)
Warranted, exactly as in cricket, for the minority experienced scorer running a fast tournament:
- **Confirm line suppressed** — taps resolve instantly (Undo still always present). No narration ceremony.
- **MULTI count row always inline** on TOUCH (`1·2·3·4·5` + Bonus visible), so a multi-touch is one tap not two.
- Denser tile rhythm, foul/self-out surfaced by default.
- Everything else identical — **the engine still owns every derived rule.** Power removes hand-holding, never correctness.

Toggle lives in the scoring caption (like cricket's *Track shots* switch) and in Edit setup. Default = Guided.

---

## 5. How it stays SIMPLE — what is deliberately kept OFF the scorer

The scorer is a **resolver, not a dashboard.** If a control makes the operator *read* or *decide the rules*, it doesn't belong here — it lives on the board or the scorecard. Explicitly banned from the hot path:

- **Manual roster / revival UI.** No "click the player who's out", no revive-order picker. The engine owns Sanjeevani out-order; the scorer only ever sees the 7 dolls dim/relight. (This is where kabaddi.eu's desktop card-clicking fails — we refuse it.)
- **All-out / super-tackle / do-or-die / bonus-eligibility buttons.** All auto-derived. Zero taps. A scorer who had to *know* super-tackle applies at ≤3 is a scorer who mis-scores.
- **Point-type tallies, per-player raid/bonus/tackle splits, Super-10 / High-5.** That's the **scorecard**. Never on the scorer.
- **The raid-by-raid feed / game log.** Lives on the spectator surface / scorecard, not under the thumb.
- **Analytics — heatmaps, raid-path, momentum.** Later waves, on the analysis surface. The raid-path tap-to-place capture is modelled in the data but **deferred behind Power-mode enrichment** (mirrors cricket's wagon-wheel decision) — never a required step.
- **The raid clock as an authority.** It's advisory on the board; the scorer never has to "submit at 0". Time never auto-scores a raid.
- **Consecutive-empty counters, super-tackle-armed flags, bonus-armed flags.** Engine state, surfaced only as the board's do-or-die word — never a number the scorer tracks.
- **Circle / Punjab kabaddi, pursuit.** A different game; out of scope for this resolver (future ruleset, not a toggle here).
- **Timeouts / subs on the hot path.** Real but rare → tucked in More, never competing with the Big-4.
- **Any team-picker on the outcome buttons.** Possession is engine-known; buttons are semantic. Removing the "which side?" decision is the core anti-fumble move.

**The discipline test:** if the scorer has to think about *anything other than "how did this raid end?"* — revival counts, whose point it is, whether a tackle was super, when do-or-die triggers — the engine has failed and a tap is at risk. The scorer sees one question, four big answers, and a sentence back that proves it was right.
