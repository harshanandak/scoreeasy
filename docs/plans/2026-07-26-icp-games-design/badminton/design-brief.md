# ScoreEasy — Badminton bespoke design brief

**Date:** 2026-07-26 · **Status:** DESIGN BRIEF (no code, no mockups yet) · **ICP:** Indian college / university / school / local-ground scorers — casual self-scorers dominate, a minority of club/umpire scorers exist.
**Design system:** design1-mono (brutalist shell × HiFi blend). **Governance is law:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` + the cricket `blend-rubric.md` (record is brutalist, conversation is soft; green = lead/live only; one gold, one glow, one live pulse per screen; detail-by-surface — scorer lean, spectator/scorecard richer). This brief inherits that rubric verbatim; it does **not** re-decide it.

**The one-line thesis:** *Badminton input is the simplest of any racquet sport — every rally awards exactly one point to one side, so the scorer is a two-zone "who won the rally" tap. ALL the difficulty is derived: server, service court (L/R), sides, deuce, cap, game/match completion, and doubles rotation. The app's entire value is being the thing that never loses track of "who serves, from which box, on which end" — the #1 thing casual players argue about.*

---

## 1. Scoring model + India/college nuances

### Canonical BWF model (the default)
- **Rally-point scoring:** every rally ends in a point for one side (no service-only scoring). One tap per rally.
- **Game to 21, win by 2, hard cap 30:** first to 21 wins the game **unless** the trailing side is within 1 → play continues until a 2-point lead **or** a side reaches **30** (at 29–29, the next point wins 30–29). "Setting" (the old choose-to-play-to-3 rule) is gone; win-by-2-to-cap-30 is automatic. Casual players still verbally call 20–20 "deuce" and 29–29 "sudden point" — mirror that language.
- **Best of 3 games:** first to 2 games wins the match. Winner of a game serves first in the next game.
- **Serve mechanics (the derived core):**
  - The **serving side is whoever won the previous rally** (rally-point). Win the rally → you serve next. Lose it → serve passes.
  - **Service court is derived from the serving side's score parity:** serve from the **right** court when that side's score is **even** (0, 2, 4 …), from the **left** when **odd**. This is a pure function of state — the app should render it, never ask.
  - **Singles:** server + receiver stand in the court dictated by the server's score; nothing else to track.
  - **Doubles:** only one serve per side (no "second server" since 2006). The serving pair keeps their current left/right positions and only the **server** swaps courts with their partner when the serving side wins consecutive points; when serve is lost, players stay where they are and the new serving side serves from the court its score parity dictates. The receiver is the player diagonally opposite. This player-and-court bookkeeping is exactly what casual doubles players get wrong every third rally.
- **Change ends:** at the end of each game; **and mid-way through the deciding (3rd) game when either side first reaches 11.** (Also nominally after game 1 the winner chooses ends/serve — collapse to "swap ends between games" for casual.)

### India / college / ground variants the setup MUST offer (house-rule toggles)
Casual Indian play deviates from BWF constantly for time/court reasons — the format picker has to cover these or the scorer is wrong on day one:
- **Single game to 21** (quick knockouts, intramurals) — most common casual format after best-of-3.
- **Single game to 15** and **to 11** (time-boxed college fixtures, PE classes, crowded club rotations "next pair on").
- **Win-by-2 toggle + cap toggle:** many gully/college games play **straight to 21/15, no deuce, no cap** ("first to 21 flat"). Must be switchable off.
- **Best-of-3 to 15** (older/rural convention still alive).
- **Singles / Doubles** (mixed-doubles events are big in college fests) — chosen at setup, drives the serve engine.
- **Change-ends at 11 in decider:** on by default, but a "don't prompt ends" toggle for casual play that ignores it.
- **Server auto-tracking:** on by default with a manual override; some ultra-casual scorers just want the number and don't care who serves — allow muting the serve layer (see Open Questions).

**Anti-goal:** supporting the pre-2006 service-only 15-point men's / 11-point women's legacy scoring as a first-class path. Offer plain "to 15 / to 11 rally-point" instead.

---

## 2. Screens needed

### A. Setup
Reuse the mono setup-option card pattern. Must capture, one decision band at a time:
1. **Singles vs Doubles** (drives serve engine + name capture: 2 vs 4 names).
2. **Player / team / pair names** (sans, sentence case — never uppercase a human). Doubles = two named players per side.
3. **Format preset** as tap cards: *Best of 3 · to 21* (default) / *Single game · to 21* / *to 15* / *to 11* / *Custom*. Custom exposes: points-to-win, win-by-2 on/off, cap value (or none), games-to-win.
4. **First serve + first end** (who serves, which side starts left) — one tap, or "toss for me" randomiser.
5. Optional: event/venue, umpire name, court number (for college tournament context strip).
Ends in a plain-English confirmation summary card ("Best of 3, games to 21, win by 2, cap 30 · A. Sharma serves first from the right") before "Start match".

### B. Scorer (the core surface — operator-lean)
Two-zone rally-winner tap. Must, at a glance and one-handed:
- Show both current-game scores huge (mono tabular), leading side marked.
- Show **who is serving + from which court (R/L)** persistently, and in doubles **which player**.
- Show game state (game 1/2/3, games-won pips, points-to-win/deuce/game-point/match-point).
- Record a point in **one tap** on the side that won the rally; the engine derives serve, court, side-swap-eligibility, deuce, cap, game end, match end.
- Prompt **change ends** at 11 in the decider (and between games) without the operator having to know the rule.
- Undo the last rally; rare manual serve/court override.

### C. Live / spectator (lean-back, richer)
Read-only broadcast of the same state: hero, serve indicator, games strip, point-streak/momentum, game-point/match-point moment, per-game breakdown, viewer presence + reactions.

### D. Scorecard / match summary
Per-game line scores (21–19, 18–21, 21–15), match result with margin, per-player/pair stats, share card.

---

## 3. Scorer interaction design (operator-lean, thumb-first)

**Primary interaction = the arena two-zone tap** (`mono-arena-grid` / `mono-arena-col` / `mono-arena-half` already exist and are perfect). The whole screen is two full-height typographic tap zones, score left / score right. **Tapping a side = "this side won the rally"** → +1 to that side, engine does the rest. This is the single most-tapped action and it occupies the entire thumb-reachable canvas — no button hunting, works one-handed on either thumb because both zones are full-height.

**Badminton-specific primary actions (in priority/frequency order, weight descends downward):**
1. **POINT LEFT / POINT RIGHT** — the two arena halves. ~100% of taps.
2. **UNDO** — permanent compact square in the bottom control strip (reuse `mono-quick-undo`); the only frequently-needed correction.
3. **CHANGE ENDS (confirm)** — appears as a soft inline prompt only when the rule fires (11 in decider / between games); one tap to acknowledge + swap.
4. **Correct serve / court** — rare override chip (in case the auto-derivation ever disagrees with a real umpire call, e.g. an unrecorded let). Tucked, not competing with the tap zones.
5. **LET / replay rally** — optional quick-action (no point, re-serve same server/court). See Open Questions — include as a small ghost chip if we support it.

**Thumb-zone / most-tapped-at-bottom discipline:**
- The two tap halves fill the screen, so the *point action* is reachable everywhere — good.
- Everything the operator must *read but not tap* (serve indicator, court, game state, deuce/game-point) lives in the **seam between the zones** (`mono-arena-seam`) and the header context subtitle — glanceable, out of the thumb path.
- Everything the operator *occasionally taps* (undo, change-ends confirm, correct-serve) sits in a bottom control strip below the seam, within thumb reach, visually one tier down (line-divided, borderless — `mono-quick-action-row`).

**The serve indicator (the signature scorer element):** a persistent **shuttle glyph + court chip** attached to the serving side's zone — e.g. a small shuttlecock mark on the serving half plus a hard `R`/`L` badge (grammar-2 status stamp, mono, ≥10px). In doubles, the serving player's initial/name is bolded and the receiver diagonally marked. When serve changes hands, the glyph animates across the seam (see §7). This is the brutalist "record" of who serves — precise, non-jittering, trustworthy at a noisy court.

**Change-ends handling:** at 11-in-decider / between games, the tap zones must not silently flip (an operator mid-rally would tap the wrong side). Instead: a **soft inline banner** slides in ("Change ends — A. Sharma's side moves right"); on confirm, the zones swap with a brief labeled transition so the operator re-anchors. Auto-swap-without-confirm is an Open Question.

---

## 4. Live / spectator design (richer detail, signature moments)

Per the rubric, spectator = the broadcast: keep only the outer hard shell, everything interior softens.
- **Hero:** both game scores mono tabular in a `--se-blend-green-wash` stage; leading side takes the green baseline; games-won pips (grammar-3 record chips) above. Serve indicator (shuttle + court) rendered read-only.
- **Signature moments surfaced:**
  - **Game point / match point** — escalation-ladder chip (`--se-color-warning-soft`, or danger-soft at match point) + live pulse on the LIVE dot only.
  - **Deuce / cap run (20-all onward, 29–29 sudden point)** — a small persistent "DEUCE · win by 2" strip so viewers understand why it isn't over.
  - **Point streak / momentum** — CSS-only run of pips or a thin bar showing the current unanswered-point run ("6 in a row") — the badminton equivalent of a bowling spell; encoded in action/surface-warm, no library.
  - **Change-ends / mid-game interval** — a quiet interstitial line.
- **Per-game breakdown** rail (21–19, 18–21 …) with the current game live.
- **Presence + reactions** first-class (viewer count in chrome, capsule reaction pills with mono counts) — college crowds are the sharing audience.
- **INFO tab:** teams/pairs, event, court, format + house-rules summary, umpire.

---

## 5. Blend direction (brutalist identity × HiFi warmth — tokens only, no new colours)

Keep the minimal-brutalist palette + single green accent. Apply the rubric per element class:

| Element | Treatment | Tokens |
|---|---|---|
| Outer shell / header | **Brutalist** — the one hard frame + one offset shadow; context subtitle always states match state ("GAME 3 · 11–8 · DECIDER"). | `--se-border-standard`, `--se-shadow-hard`, mono eyebrow |
| Score numerals + two tap zones | **Hard number, soft stage.** Mono tabular arena numerals; leading side = 2px green baseline (already built). Zones are open typographic tap surfaces, press = accent-tint flash only. | `mono-arena-num`, `--score-accent`, `--se-blend-green-wash` behind the hero readout |
| Serve / court indicator, games-won pips | **Brutalist record chips.** Shuttle glyph + hard `R`/`L` status stamp (grammar-2, squarer than pills); games pips are grammar-3 record chips. | `--se-radius-button`, mono, `--se-color-ink-strong` |
| Deuce / game-point / match-point | **Escalation ladder, never a new hue.** neutral → `--se-color-warning-soft`/`warning` at game point → `--se-color-danger-soft`/`danger` at match point. | ladder only |
| Change-ends prompt, interval, any guidance | **HiFi-soft** — sentence-case sans inline banner on `--se-color-surface-warm`, soft radius, no shadow; echoes the action ("A. Sharma's side moves right"). | `--se-blend-radius-soft`, `--se-color-surface-warm` |
| Undo / secondary controls | Borderless line-divided tiles, one tier down. | `mono-quick-action-row` |
| Game won | **HiFi-soft celebration** with the existing `set-complete` beat; human sentence in sans, figures line in mono ("Game 2 to Meera — 21–18"). | `mono-set-complete` |
| Match won | **Gold milestone card** — 2px gold border + `3px 3px 0` ink shadow anchor, soft gold interior; exactly one gold. Result headline sans 800, margin in plain language ("in 3 games · 21–19 in the decider"), per-game lines mono, loser at reduced opacity. | `--se-blend-gold*`, `MonoMatchResult` |
| Spectator interior | Hairlines only, capsule tabs, green wash hero, one live pulse. | per rubric §9 |

Budgets enforced per screen: 1 hard shadow, 1 hard frame, ≤3 soft surfaces, ≤1 gold, ≤1 glow (primary CTA), ≤1 inversion, ≤1 live pulse.

---

## 6. Data touchpoints + stats worth capturing

Because **every tap already IS a rally record**, rich stats cost the scorer zero extra taps — capture the point-by-point log by default:
- **Per rally:** winner side, serving side + player (doubles), service court (R/L), running score, game no, timestamp → derives everything below.
- **Per game:** final line score (21–19), duration, whether it went to deuce, biggest lead, comeback flag (won after trailing by ≥N).
- **Per player / pair:**
  - Points won total + per game.
  - **Points won on own serve vs on receive** (rally-point badminton's key split — who converts serve).
  - **Longest point streak** (consecutive rallies won) — the momentum stat.
  - Serve retention (rallies held while serving).
  - Doubles: points won while that player was the designated server.
  - Deuce-game record; decider record.
- **Match:** result + margin, games line, total rallies, longest streak of the match, time.

(Fault/service-error and shot-type capture are explicitly out of scope for the casual ICP — see Open Questions; leave model fields but no scorer surface.)

---

## 7. Animations / signature moments

Reduced-motion gated; nothing decorative moves; one live pulse max.
- **Score pop** on every point — reuse existing `score-pop`.
- **Serve-hand-over glide** — when the serve switches sides, the shuttle glyph slides across the seam to the new server; court chip flips R↔L. Signature but light; ship at launch. (*Future-flag* a fuller court-diagram flip animation.)
- **Game point / match point** — chip escalates via the ladder + LIVE-dot pulse (live only).
- **Game won** — existing `set-complete` beat + soft sentence/figures card.
- **Change ends** — inline banner slide + brief zone-swap transition so the operator re-anchors.
- **Match won** — gold milestone card + existing confetti overlay (*confetti already exists; keep, reduced-motion off*).
- ***Future-flagged (heavy):*** momentum-worm animation on the spectator feed, doubles court-position diagram with animated rotation, rally-length heat.

---

## 8. Port-vs-redesign

**Reuse (port) from the generic scorer + shared primitives — do NOT rebuild:**
- `mono-arena-grid` / `mono-arena-col` / `mono-arena-half` two-zone tap + leading-team green baseline (`mono-arena-num`) — the scorer skeleton.
- Games-won / sets tracking scaffold from `GenericSetsTournament.jsx` (`setsToWin = ceil(games/2)`, completion check) — extend, don't replace.
- `MonoSheet` (any decision sheet), `MonoMatchResult` (result + share), setup option cards, undo pattern, `score-pop` / `set-complete` animations, all blend tokens (frozen), spectator shell + reaction/presence primitives.

**Build bespoke (the generic scorer has none of this):**
- **Badminton scoring engine:** win-by-2 + cap-30 + configurable points/games, game→match rollup — the generic sets scorer only counts sets, it has no per-point win-by-2/cap logic.
- **Serve + service-court derivation** (server = last-rally winner; court = server-score parity → R/L) — net-new; the single biggest differentiator.
- **Doubles server/receiver/court-rotation tracking** (positions, one-serve rule) — net-new.
- **Serve indicator UI** (shuttle glyph + R/L stamp + doubles player highlight) — net-new.
- **Change-ends engine + prompt** (between games + 11-in-decider) with confirmed zone swap — net-new.
- **Deuce / game-point / match-point detection** feeding the escalation-ladder chips — net-new.
- **Point-by-point log + badminton stat derivations** (serve/receive split, streaks) and the per-game line-score scorecard — net-new.
- **House-rule format picker** (to 21/15/11, win-by-2 toggle, cap toggle, best-of-N) — generic setup only picks `sets`.

---

## 9. Open questions / product decisions

1. **Doubles serve depth:** full BWF server/receiver/court-rotation tracking, or a simplified "which side serves + R/L" only (skip per-player position)? Casual doubles may not need player-level bookkeeping — but it's the exact thing they argue about. *Leaning: track player-level, but allow muting.*
2. **Serve layer mute:** do ultra-casual scorers who "just want the number" get a toggle to hide the serve/court engine entirely? *Leaning: on by default, mutable.*
3. **Change-ends UX:** confirmed prompt + explicit zone swap (safe, re-anchors operator) vs silent auto-swap (fewer taps, risk of mis-tap)? *Leaning: confirmed prompt.*
4. **Default format for the college ICP:** best-of-3-to-21 (BWF) vs single-game-to-21 (intramural reality) as the out-of-box default? *Leaning: best-of-3 default, but surface single-game one tap away; possibly remember per-device.*
5. **"Let" support:** include a LET / replay-rally quick-action (no point, same server) or omit for casual? Un-tracked lets are the main reason a manual serve override might be needed.
6. **Fault / service-error / shot-type capture:** confirmed out of scope for casual — model fields reserved, no scorer surface? (Parallels cricket's deferred shot-tracking.)
7. **Point-by-point storage cost:** capturing every rally for stats is free on taps but is the storage/sync acceptable offline-first (parallels cricket's offline-conflict open decision)?
8. **Manual score correction:** beyond LIFO undo, do we need edit-past-rally (which re-derives serve/court/side forward, like cricket's replay-forward)? *Leaning: undo-only at launch, edit-past future.*
9. **Randomiser at setup:** "toss for me" for first serve/end — nice for casual, confirm scope.
