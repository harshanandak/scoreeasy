# Badminton — the SCORER (the lean operator tool)

**Date:** 2026-07-26 · **Status:** SCORER SPEC (decisive) · **ICP:** Indian college / school / local-ground scorers — one hand, noisy court, no setup.
**Design system:** design1-mono (brutalist × HiFi blend). Inherits the cricket lean-scorer pattern (`cricket-scorer-alt-big5.html`) **verbatim**: thumb-zone order (rare/management on top via CSS `order`, most-tapped primaries at the bottom), big one-tap targets for the 90% case, rare actions tucked into ONE compact strip + a HiFi bottom-sheet, flat black hero, one hard shadow, one green accent, one live pulse.

**The thesis for THIS screen:** badminton is the leanest scorer of any racquet sport. **The record is one point per rally — every action is a single winner tap, and there are only two sides.** So the scorer's *entire* primary surface is **two enormous buttons, one per side.** Everything else — serve, court R/L, doubles rotation, deuce, cap, game/match point, change-ends — is *derived* by the engine and never entered. The design job is: make the two taps un-missable, make the derived state trustworthy, and keep every other number OFF the scorer (it lives on the board / scorecard).

**The wedge, restated:** casual badminton fights over three things — *who serves, from which box, did we change ends.* The scorer settles all three for free from the rally log. That trust is the product; the two buttons are just the input to it.

---

## 1. Primary actions (the 90% case) vs rare/secondary

### The primary surface — TWO buttons, that is the whole scorer

| Action | Target | Frequency | What the engine derives from it |
|---|---|---|---|
| **Point → Left side** | HUGE button, bottom-left, carries the side's name + live score | ~50% of all taps | +1 that side; new server = the winner; new court box = parity (even→R, odd→L); doubles court-swap eligibility + receiver diagonal; deuce / cap / game-point / match-point / game / match completion |
| **Point → Right side** | HUGE button, bottom-right, mirror of the above | ~50% of all taps | (same) |

That is it. **One tap per rally, two possible taps, spatially mapped to the physical court (left button = the pair on your left).** No "who won?" modal, no serve entry, no court entry. The badminton analogue of cricket's Big-5 is a **Big-2** — the sport genuinely has only two frequent outcomes.

The two buttons are laid low and side-by-side so a thumb (either hand) reaches both. Each button shows, live: the side **name/pair**, the side's **current score** (so the operator confirms the count without looking up), and the **shuttle glyph `🏸`** on whichever side currently serves (so the operator can watch the correct server). Tapping a button **is** "this side won the rally."

### Rare / secondary — one compact strip + a "More" sheet

Everything below is rare enough to evict from the thumb zone. It sits in ONE control strip directly above the two primaries, plus a HiFi bottom-sheet for the truly rare:

**Compact control strip (always visible, just above the primaries):**
- **↶ Undo** — LIFO revert of the last rally; re-derives all state. The single most-used secondary; gets its own fixed key.
- **Let / replay** — no point, re-serve same server & court (covers a service-judge let). One tap.
- **⋯ More** — opens the bottom-sheet.

**"More" bottom-sheet (rare, tucked away):**
- **Correct** → *Fix serve / court* (override an untracked let or service-judge call — the only manual poke at the serve engine), *Correct last point* (reassign the last rally to the other side).
- **Match** → *Timeout / interval* (start the optional 60s @ 11 or 120s between-games clock — umpire-tier, skippable), *Retire / injury / walkover* (badminton has **no substitutions**; this is the sport's only interruption path — the gap the category leader gets wrong), *Edit setup*, *Share live ↗*.
- **End** → *End game* / *End match* (manual close, in case a house rule ends early).

**Why this split holds:** in a normal game of ~40 rallies the operator taps a primary ~40 times, Undo maybe twice, and opens More zero times. Frequency dictates size and position — exactly the cricket rule.

---

## 2. Thumb-zone layout + ASCII wireframe

**Law (inherited verbatim):** compact glanceable state at the TOP (read, don't tap), most-tapped primaries at the BOTTOM (tap, don't read). Rare/management floats up via CSS `order` so it never sits under the thumb. Portrait, phone-first, ~390px, offline, one-handed.

**Vertical order, top → bottom:**
1. **Top bar** (chrome) — back · match title · `● LIVE` · menu.
2. **Compact score readout** (the mini-board, read-only) — the five facts, small: names + serve shuttle, the two scores, phase strip (`GAME 3 · DECIDER` → escalates to `DEUCE · WIN BY 2` / `GAME POINT` / `MATCH POINT`), games-won pips, court chip `R`/`L`. This mirrors the board's hierarchy but shrunk — it is a *confirmation*, not the board.
3. **Inline handoff banner** (appears only when a rule fires — change-ends / game-won / match-won; see §3). Slides in *above* the primaries so it interrupts the tap flow deliberately.
4. **Control strip** — `↶ Undo · Let · ⋯ More`.
5. **THE TWO PRIMARIES** — full-width, split 50/50, tallest objects on the screen, in the thumb zone.

```
┌──────────────────────────────────────────────┐
│ ‹  Sunday Cup · SF · Court 2      ● LIVE   ≡  │  top bar (chrome)
├──────────────────────────────────────────────┤ ◄ compact READ-ONLY score readout (mini-board)
│  ■ □                              ■ ■         │  games pips
│  🏸 A. SHARMA            MEERA & RIYA         │  names + serve shuttle
│      18       GAME 3  R        21             │  scores (green=lead) · phase · court box
│               DECIDER                         │
├──────────────────────────────────────────────┤
│  ↶ Undo      Let        ⋯ More                │  control strip (rare, above thumb zone)
├──────────────────────────────────────────────┤
│                                                │
│   ┌────────────────┐  ┌────────────────┐      │
│   │  🏸 A. SHARMA  │  │  MEERA & RIYA  │      │  ◄── THE TWO PRIMARIES
│   │                │  │                │      │      full-width, split 50/50,
│   │       18       │  │       21       │      │      tallest targets, thumb zone.
│   │                │  │                │      │      tap = this side won the rally.
│   │   + POINT      │  │   + POINT      │      │      name + live score + serve dot
│   └────────────────┘  └────────────────┘      │      on each; left btn = left court.
│                                                │
└──────────────────────────────────────────────┘
   ▲ NO momentum, NO stats, NO per-game rail, NO court-zone here.
     Those live on the live board / scorecard — never on the scorer.
```

**Spatial mapping is the anti-fumble device:** the left button *is* the pair standing on the umpire's left. On change-ends the app **swaps the two buttons' positions** (§3) so left-button = left-court stays true all match — the operator never has to re-map "which button is which side" after a swap.

---

## 3. Mandatory handoffs as clean inline steps

All handoffs are **inline banners in the score flow** (never modals, never a separate screen), each resolvable in **one tap**, styled HiFi-soft *outside* the black readout. The engine fires them; the operator only confirms.

**A. Change ends** (end of each game; and at **11 in the deciding game**). Engine detects the trigger and slides in:
```
  ┌──────────────────────────────────────────┐
  │  ⇄  CHANGE ENDS · 11 in the decider       │
  │     Sides swapped. [ Done ]                │
  └──────────────────────────────────────────┘
```
One tap on **Done** swaps the two primary buttons' left/right positions to match the new physical sides, then dismisses. In ultra-casual play a setup toggle *"don't prompt ends"* mutes this entirely.

**B. Game complete** (a side reaches game point and wins it — 21, or the deuce/cap resolution). The readout freezes the final and the banner states the result + who serves next, folding the between-games change-ends into the same step:
```
  ┌──────────────────────────────────────────┐
  │  GAME 2 → MEERA & RIYA · 21–18            │
  │  Serves next: Meera · ends swapped         │
  │  [ Start Game 3 ]      [ 120s interval ]   │
  └──────────────────────────────────────────┘
```
**Start Game 3** is the single primary tap. The **120s interval** timer is an *optional* chip (umpire-tier) — never blocks play.

**C. Match complete** (a side wins the 2nd game / decider). The designed result moment (the gold milestone the category lacks):
```
  ┌──────────────────────────────────────────┐
  │  🏆 MATCH — MEERA & RIYA · 2–1            │
  │  21–18 · 18–21 · 21–19 (decider)          │
  │  [ Share ↗ ]  [ Scorecard ]  [ New match ]│
  └──────────────────────────────────────────┘
```

**D. Timeouts / intervals** (60s @ 11 in every game; 120s between games). **Optional, offered inline, never forced** — a chip inside the 11-point / game-complete banner. Casual play ignores it; umpire mode surfaces the countdown.

**E. Subs** — **badminton has no substitutions.** The equivalent handoff is **Retire / injury / walkover**, which lives in the More sheet (rare, but must be clean — the leading app's #1 complaint is a missing retire flow). Selecting it awards the match per the interruption rules and jumps to the result moment.

**Design rule for all five:** the handoff interrupts the tap flow *in place*, states what the engine already decided in plain English, and needs exactly one confirming tap to continue. No screen change, no data entry, no losing the score.

---

## 4. Guided (default) vs Count-only (optional lean mode)

Badminton input is already one tap, so the meaningful axis is **not** entry speed — it is **how much the engine derives and polices.**

**GUIDED — default, hard-to-mis-score.** The full derived-state engine runs:
- Serve side + court box `R`/`L` shown live on the readout and on each button's shuttle glyph.
- **Doubles rotation handled *for* the operator** — the app tracks server-of-the-pair, the consecutive-point court swap, and the diagonal receiver, and renders them; the operator never bookkeeps the single hardest rule in the sport (the #1 home-grown-scorer bug).
- Deuce / cap / game-point / match-point called out in the phase strip so a mis-count is visible.
- Change-ends and game/match handoffs fire automatically (§3).
- **This is the wedge — pick it unless the user opts out.**

**COUNT-ONLY — optional, chosen at setup for scorers who "just want the number."** Mutes the serve/court/rotation engine and the change-ends prompt; keeps the two big buttons, the two scores, deuce/cap win-logic (so the game still ends correctly), and Undo. For a PE teacher or an apartment court that doesn't care who serves. It is a *reduction* of Guided, not a different screen — same two buttons, engine layer hidden.

No third "power" mode is warranted: there is no batch or expert entry faster than one tap, and a manual-serve mode would *add* fumble risk, defeating the tool's whole reason to exist. The **Fix serve** override in More covers the rare correction without a whole mode.

---

## 5. How it stays SIMPLE — what is deliberately kept OFF the scorer

The scorer scores; the **live board** and **scorecard** hold detail. Explicitly banned from this screen:

- ❌ **Momentum run / point-streak counter / momentum worm** — spectator richness; lives below the board, not on the scorer.
- ❌ **Stats** — points-won-on-serve-vs-receive, serve retention, deuce/decider record, longest streak. All free to derive, all belong on the **scorecard**, none on the scorer.
- ❌ **Per-game line-score rail** (`21–18 · 18–21`) — the *compact readout* shows only the current game + pips; full per-game history is a scorecard/board fact.
- ❌ **Court-zone heatmap / winning-shot placement / rally-length / shuttle speed / Hawk-Eye** — the enrichment/broadcast layer. Reserve `zone` and `rallyLength` model fields; **do not** put a tap-to-place ground on the default scorer (unlike cricket, where the wagon-wheel tap piggybacks the run tap, badminton's winner tap carries no natural placement, so forcing one would add friction to the one action that must stay instant). If ever offered, it is an *optional* post-point sheet behind a toggle — off by default.
- ❌ **Faults, service-error type, misconduct cards (yellow/red/black), shuttle-change count** — pro-umpire ledger; reserved model fields, zero casual surface.
- ❌ **Ticking interval/match timers on the face** — clutter; intervals are optional chips inside a handoff banner, only a dedicated umpire mode shows a live countdown.
- ❌ **A second accent colour, gradients, a "VS" divider, team-colour fills** — blend law: one green (lead/serve/live), one hard shadow, one frame.
- ❌ **Manual serve / court / rotation entry as a normal step** — deriving it is the product; the only touch-point is the rare **Fix serve** override in More.
- ❌ **Detailed player entry / edit mid-flow** — names are set at setup; editing is in More, never on the tap surface.

**The discipline:** the scorer answers exactly one question forty times — *"which side won that rally?"* — and quietly keeps the derived truth. Everything a viewer or analyst wants renders *around* it on the board and scorecard, never *on* it.

---

**Scorer = two enormous side-buttons, a compact derived readout above them, one control strip, inline one-tap handoffs, and a trustworthy serve/rotation engine the operator never touches. One tap per rally. Everything else lives elsewhere.**
