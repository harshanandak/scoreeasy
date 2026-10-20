# ScoreEasy — Adaptive System Addendum

**Date:** 2026-08-21 · **Status:** ADDENDUM to `README-deep-synthesis.md` — governs how the shared system adapts per game. Where this differs from a mechanical reading of the synthesis, **this wins**.
**Source:** 7-game audit (2026-08-21) against the locked cricket blend. Cricket supplies the *grammar*; each game themes the *expression*.

---

## 1. The principle

**Substrate shared, expression adapted.** Cricket's contract ("record is brutalist, conversation is soft") is sport-agnostic and inherited whole: shell frame + budget law, mono-tabular quantities, escalation ladder as the only state encoding, LIFO undo that names its target, warm-canvas handoffs (never modals), floors (touch ≥44px, captions ≥9px at ink-muted, human/team names sans sentence-case ≥12px — never uppercase a human), narration band after every event, confirmation-echo cards with outcome-naming CTAs.

What adapts per game is everything sensory: verb set, record-strip slot type, state-emphasis weight, narration voice, density, motion personality. A game that feels like cricket reskinned is a defect.

## 2. Three rhythm profiles

Games inherit one profile, then theme it.

| Profile | Games | Primary zone | Handoff cadence | Motion personality |
|---|---|---|---|---|
| **Rhythm-tap** | volleyball · throwball · badminton | 2 arena/target keys | one-tap at natural breaks (set/game ends) | pulse-per-point; tension builds through the ladder |
| **Burst-capture** | kabaddi · kho-kho | semantic outcome keys (Big-4 / Big-1) | zero-tap auto (possession, do-or-die, all-out); one-tap halves/turns | peripheral confirm (narration flash + dolls/dots move); gold reserved for peaks |
| **Moment-log** | football · basketball | GOAL keys / value keypad | sequenced questions at period edges (+N before End half) | stillness until the moment, then takeover |

## 3. Per-game adaptation packs

Each pack is *declared* by the game inside parametrized components — never invented ad hoc.

### Volleyball — "the rhythm tap"
- **Thesis:** scoring is a pulse; the screen is the match's heartbeat.
- Verb set: two giant Point→Team targets. Serve shown ON the button (serving side's target carries action-soft wash — never a 1px border).
- Record strip: set-boxes + pips, filled in sets-won order with legend.
- State emphasis: serve derived silently; phase vocabulary `SET PT ▸ MATCH PT ▸ DEUCE`.
- Chrome subtitle always states the finish line: `BO3 · SET 3 · TO 25 · WIN BY 2` (decider: `TO 15 · SWITCH AT 8`).
- Narration voice: plain sportscaster. Rally strip (8 chips L/R) above controls for self-audit.
- Inversion reserved for MATCH POINT only — board is not permanently ink-inverted.

### Throwball — "reassurance first"
- **Thesis:** same engine as volleyball, opposite temperament — anxious teacher-scorers need to never feel lost.
- Warmest narration voice in the program; every point echoed as a full sentence + "nothing is lost — Undo restores it".
- Colour pip on each primary tied to setup colours (tint by side, not leadership) — ends swap mid-set.
- 3-second-hold rule surfaces once as a friendly teaching line, then never nags.
- Set-break card celebrates: "St. Joseph's take Set 2 · 15–12 · Match level!" + Undo escape.
- Ruleset stamp in chrome (`COLLEGE · RALLY · BO3`, tap-to-expand).

### Badminton — "the umpire in your pocket"
- **Thesis:** the app officiates; "who serves, from which box" is the product.
- Serve sentence as hero second line: "Sharma to serve · RIGHT court · 19–18" with the why ("odd → right"). R/L chip bound to the serving name row in EVERY state.
- Server's name printed on the tap target (doubles: "Meera to serve →").
- Change-ends banner refusable: `[We swapped ✓] [Not yet]`; More gains "Re-sync ends".
- Court view co-hero beside score. `Let` glossed "replay · no point".
- Names sans sentence-case ≥12px everywhere (mono stays on numerals/stamps).

### Kabaddi — "the raid ledger"
- **Thesis:** absorb a tap, resolve every rule silently, answer back in one glance. Mat-edge, ~30s cycles, eyes-on-mat.
- Big-4 semantic keys built for look-tap-look-away: result confirmed peripherally via narration flash + doll movement.
- Raid clock = ambient tension (draining ring, warning ≤5s), display-only, never authority.
- Do-or-die arming zero-tap and loud (band + word); EMPTY on do-or-die narrates enforcement.
- All-out = program's biggest peak: gold takeover + dolls re-light sweep + "+2 · all 7 back".
- Offline-saved chip visible in chrome (offline-first is launch core — make it tangible).
- RAID ▸ possession marker separate from DO-OR-DIE state word (whose raid ≠ state of game).

### Football — "the patient log"
- **Thesis:** eyes-on-play 95% of the time; capture must be single-glance single-tap, never blocking.
- Two GOAL keys huge and calm; score lands instantly; attribution row deferrable with honest `Unknown #—`.
- The last-event line IS the recovery affordance: tap "⚽ 67' Unknown" to reopen attribution inline.
- Clock is the heartbeat: `H2 67:14 · +3` always visible; momentum stays cut (sparse ledger honesty).
- Permanent helper under keys: "Tap the team that gets the point — even if it was an own goal."
- Half-time sequences "+N added?" BEFORE End half. Golden-goal auto-end shows a 5s "Not a goal? Undo" window.
- Pen/Own-goal on their own row (never beside player picks). Cards/subs get the same `?Unknown` escape as goals.

### Basketball — "the official book"
- **Thesis:** seated table-desk duty with an audience; precision instrument the referee trusts.
- Keypad reshapes by format at SETUP only (5×5 ↔ `+1 INSIDE`-huge 3×3) — never mid-game.
- Quarter line-score columnised exactly like cricket's over chips; BONUS stamp as loud as cricket's `OUT`.
- Foul-out flow teaches with an echo card ("5th foul — player exits"). Run tracker: "12–2 RUN" band on lead swings.
- Narration band after every event (table officials announce while tapping).

### Kho-kho — "stopwatch + tally"
- **Thesis:** long quiescence + sudden bursts; two co-equal instruments (turn clock, OUT tally).
- One giant `OUT +1` with 400ms undo debounce + loud undo narration (burst-thumb safety).
- Batch dots read as the turn's sentence; `THIS TURN n` mono counter in the hero band kills cumulative-only math.
- Lull drama: derived dream-run watch fills the band ("Runner on mat 1:47 — longest today").
- Turn-end card delays CTA enable 350ms (muscle-memory taps land on nothing harmful).
- Pause affordance enlarged with ≥9px caption + full-width PAUSED state banner.
- `RECYCLE ×n` glossed on first render: "All out — order restarts (×1)".

## 4. What this changes about the build order

Nothing structural — Layer-0 substrate and the cluster order stand. It changes *acceptance*: a game passes its vertical slice only when its adaptation pack is declared (verb set, strip slot, emphasis dial, voice pack, density/motion trim) AND the shared floors hold. The wall page (`all-games-one-wall.html`) is the review surface for both.
