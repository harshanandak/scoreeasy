# ScoreEasy — Basketball DESIGN (FINAL, LOCKED)

**Date:** 2026-07-26 · **Status:** LOCKED — buildable spec. Supersedes the four source drafts (`research.md`, `main-scoreboard.md`, `scorer.md`, `live-innovations.md`) wherever they conflict.
**Design system:** design1-mono (brutalist shell × HiFi-blend). Pure-black ink · one hard `3px 3px 0` offset shadow · mono tabular numerals · **green (`--se-color-action`) = live/lead ONLY** · **BONUS/foul rides `--se-danger-soft`, never green** · one gold per screen · reduced-motion gated. **No new colours.**
**ICP:** Indian school / college / university / gully scorer, one thumb, no table crew, no clock, game starts in ~15 seconds.

---

## 0. Critique verdict — what survived, what got cut, what got fixed

The drafts are strong and research-grounded. The engine justification (value × nested foul/period state) is real — this is not a re-skin of the generic goals counter. Discipline on colour and read-order is intact. Three problems were fixed and five features were demoted to keep launch lean:

**FIXED — the one genuine fumble bug:**
- **3×3 keypad was inverted.** The 5×5 pad correctly makes the *most-frequent tap the biggest, lowest key* (`+2` field goal). The 3×3 draft (`scorer.md` §2.2) kept `+2 ARC` as the huge bottom key and called it "the big one here" — but in 3×3 the **inside-the-arc 1-pointer is the most common score**, not the behind-arc 2. That breaks the core principle and invites a mis-tap on every layup. **Locked fix:** in 3×3 the huge bottom key is **`+1` INSIDE**; **`+2` ARC** is the secondary (still large, green-inked as the marquee value, but above and smaller). Biggest key = most frequent tap, always.

**CUT from launch (kept as reserved/future, not built now):**
- **Possession arrow** — requires operator input no casual ground will supply; honest-fallback means it renders empty 99% of the time. Reserved in the model for future 5×5-detailed; **not a launch surface.**
- **Spectator reactions (🔥 tally)** — presence-gimmick, non-core. Cheap later; **not launch.**
- **League / bracket wrapper** — oversold as "cheap, under a minute." It is a whole tournament data model (standings, W-L, point-diff tiebreak, cross-match leaderboard). Real institutional lever, **Phase 2**, not launch.
- **Player profiles / season cards** — depend on rosters + cross-match persistence. **Phase 2.**
- **Shot chart tap-to-place capture** — correctly deferred in the drafts; stays deferred. `shotZone` reserved now.

**KEPT as launch-core:** the two-column lean scorer, the compact + fuller board, the clock-optional whistle-driven flow, the casual↔detailed toggle over one engine, the run/lead tracker + foul-trouble board (both zero-capture), shareable moment cards, and the one-link read-only live share. These are the adoption wedge and they all ride the existing engine + black-shell card with no new surface.

**Adoption thesis:** a school adopts because a hostel final becomes a WhatsApp-shareable broadcast in 15 seconds with zero install for spectators — *not* because of a bracket engine. Lead with the wedge; the institutional features follow once the wedge is loved.

---

## 1. Scoring model (the engine — single source of truth)

One engine, two rule-forks selected at setup. All surfaces read derivations; nothing computes score ad-hoc.

### 1.1 Events (the only things stored)

```
ScoreEvent {
  id, ts,
  team: 'A' | 'B',
  value: 1 | 2 | 3,               // 3 illegal when format === '3x3'
  kind: 'ft' | 'fg2' | 'three',   // 3x3: 'ft'|'in'(1)|'arc'(2)
  playerId?,                       // detailed mode only
  period: number,                  // 3x3: always 1
  gameClock?: string,              // only if clockEnabled
  assistPlayerId?,                 // detailed mode only
  shotZone?: CourtZone             // reserved; filled only if location-tracking on
}
FoulEvent {
  id, ts, team, playerId?,
  type: 'personal'|'shooting'|'technical'|'unsportsmanlike'|'offensive',
  period, resultingFTs?: 0|1|2|3
}
Timeout   { id, ts, team, period }
PeriodEnd { id, ts, period }       // resets team fouls; may flag basket-swap
```

Every event is one atomic, LIFO-undoable unit. Undo is the most-used action and is never buried.

### 1.2 The two rule-forks

| | **5×5 (FIBA/school)** | **3×3 (fest/gully default)** |
|---|---|---|
| Values | 1 (FT) / 2 (FG) / 3 (arc) | 1 (inside) / 2 (behind arc) — **no 3** |
| Structure | 2 or 4 periods, length set at setup | one period; **first to 21** OR 10-min cap |
| OT | tied after regulation → OT period | first to +2 |
| Team-foul → bonus | **5th team foul in period → 2 FT** on every later defensive foul (period resets to 0) | fouls 7–9 → 2 FT; **10th+ → 2 FT + possession** |
| Player foul-out | **5th personal foul** (config 6 for NBA) | none by personal count |
| Win check | at end of final period | after **every** scoring event (target/cap) |

### 1.3 Derivations the engine owns (`deriveGame`)

`score[team]`, `leader`, `margin`, `lineScore[team][period]`, `biggestLead`, `leadChanges`, `activeRun` (`{team,"9–0"}`), `bonusTeam` (per current period), `foulTrouble[]` (players at limit−1), `fouledOut[]`, `timeouts[team]`, and for 3×3 `pointsToTarget` + `winBy2` state. `isFinal`, `period`, `phaseLabel`. Nothing is stored that a derivation can compute.

**Casual forgiveness (default):** a made FT logs as a plain `+1` with no attribution; and-1s need no special flow; the engine never *requires* a foul or clock to advance a score. Strict bonus/FT/attribution is opt-in (detailed mode).

---

## 2. SCREEN 1 — Setup (15-second start)

One screen, top-to-bottom, **only the first two rows are required**:

1. **Two team names** — `Team A` / `Team B` prefilled (`SKINS`/`SHIRTS` placeholder). Abbrev auto-derives (3-char). → this row + Start is the entire minimum.
2. **Format preset** — a two-card pick: **`5×5 full-court`** · **`3×3 half-court`** (default-highlighted for the fest ICP). This single choice reshapes the keypad, the board, and the win-logic. Nothing else about scoring format is asked.
3. **`START` (huge)** — begins the match. Everything below is collapsed under **`▸ More options`** and skippable:
   - 5×5: period count (2 / 4) + length; foul-out limit (5 / 6). Defaults: 4 × 10, limit 5.
   - 3×3: target (21 / 11) + time cap on/off. Defaults: 21, cap off.
   - Mode: **Guided (default)** / Quick.
   - Rosters: add players per team (optional; upgrades attribution in place). Off = roster-less team-total scoring.
   - Clock: enable game clock (off by default). Shot clock only appears if game clock on.
   - Track shot locations: off by default (detailed only).

**Rule:** no roster, no clock, no jersey numbers, no rule config is ever a gate. Name two teams → pick format → Start.

---

## 3. SCREEN 2 — Lean scorer (the un-fumbleable console)

The one job: move the right number up, instantly, one thumb, no mis-tap. **INPUT device, not a dashboard.** Two mirrored self-contained columns so a made basket is always ONE tap on the scoring team's side — never a "who scored?" prompt, never a wrong-team fat-finger (neither column's keys reach into the other's thumb-zone).

### 3.1 Vertical order (top → bottom; most-tapped pinned lowest)

1. **Top bar** (thin, top-reach) — back · match title + phase · `● LIVE` · `≡`.
2. **Compact board readout** (read-only mirror of Screen 3 State A) — two scores (leader green), centre phase pill, ONE context line. The operator's truth-check; never tapped.
3. **Foul / bonus micro-strip** (glance) — team-foul pips per side, flipping to a hard **`BONUS`** stamp at threshold. This is the only live state the *scorer* needs that the board deliberately under-surfaces.
4. **Handoff banner slot** — empty except at breaks (§3.4).
5. **Scoring pads** — two mirrored columns, pinned to the bottom third, biggest key lowest.
6. **Control row** (safe-area padded) — **`↩ UNDO`** (big, left-thumb) · **`⋯ More`**.

### 3.2 The pad — 5×5 (biggest key = most frequent tap)

Per column: **`+2 FIELD GOAL`** = HUGE, lowest (the 55–60% tap). **`+3 THREE`** = large, green-inked (marquee value, tiered pop). **`+1 FT`** = medium. Below the values, one secondary inline row: **`FOUL`** · **`T/O`**.

```
├───────────────────────┬──────────────────────┤
│        LIONS          │        BOSTON         │
│  ┌──────┐ ┌────────┐  │  ┌────────┐ ┌──────┐  │
│  │  +1  │ │   +3   │  │  │   +3   │ │  +1  │  │   +1 med · +3 large green
│  │  FT  │ │ THREE  │  │  │ THREE  │ │  FT  │  │
│  └──────┘ └────────┘  │  └────────┘ └──────┘  │
│  ┌─────────────────┐  │  ┌─────────────────┐  │
│  │       +2        │  │  │       +2        │  │   +2 HUGE — 90% tap, best reach
│  │   FIELD GOAL    │  │  │   FIELD GOAL    │  │
│  └─────────────────┘  │  └─────────────────┘  │
│  ┌──────┐   ┌──────┐  │  ┌──────┐   ┌──────┐  │
│  │ FOUL │   │ T/O  │  │  │ T/O  │   │ FOUL │  │   secondary, per team
│  └──────┘   └──────┘  │  └──────┘   └──────┘  │
```

### 3.3 The pad — 3×3 (FIXED: biggest key = the inside 1-pointer)

The pad **physically drops the third key** — no greyed slot. **`+1 INSIDE`** is now the HUGE lowest key (the most frequent 3×3 score). **`+2 ARC`** is the secondary large green key above it (marquee value, tiered pop). Phase pill becomes the target (`→21`); foul pips show the 3×3 thresholds.

```
├───────────────────────┬──────────────────────┤
│         SKINS         │        SHIRTS         │
│  ┌────────┐           │           ┌────────┐  │
│  │   +2   │           │           │   +2   │  │   +2 ARC — large, green (marquee)
│  │  ARC   │           │           │  ARC   │  │
│  └────────┘           │           └────────┘  │
│  ┌─────────────────┐  │  ┌─────────────────┐  │
│  │       +1        │  │  │       +1        │  │   +1 INSIDE HUGE — the 90% tap
│  │     INSIDE      │  │  │     INSIDE      │  │
│  └─────────────────┘  │  └─────────────────┘  │
│  ┌──────┐   ┌──────┐  │  ┌──────┐   ┌──────┐  │
│  │ FOUL │   │ T/O  │  │  │ T/O  │   │ FOUL │  │
```

Target-reached / win-by-2 checks run after every tap and raise the game-over handoff automatically.

### 3.4 Handoffs — inline banners, never a screen, never block a basket

Single dismissible banner in slot 4, one tap to advance, whistle-driven (surfaces when due; a scorer who ignores it keeps scoring — the engine just doesn't reset fouls until they tap it).

| Handoff | Trigger | One-tap effect |
|---|---|---|
| Quarter end | `▸ END OF Qn` (auto at clock 0 or manual) | resets team fouls to 0, keeps personal, `Qn → Qn+1` toast |
| Half break | end of period 2 | resets team fouls + quiet **swap-baskets** reminder |
| Overtime | regulation tied | new OT period, fouls reset |
| Foul-out | 5th (config 6th) personal foul | soft `#7 fouled out — sub in` → sub picker (detailed) |
| Game end | final-period end, or 3×3 target/cap | `▸ FINAL — Lions win by 8` → result + Share |

### 3.5 Guided (default) vs Quick — same pad, only interruptions differ

- **Guided:** `FOUL` asks one plain-language *"Shooting foul?"* → auto-awards the correct bonus-aware FTs (no FT math in the head). BONUS shows as `BONUS · next foul = 2 FT`, never `TF: 5`. Handoff banners pulse once. End-game/end-quarter want one confirm.
- **Quick:** `FOUL` is a raw counter bump; scorer logs FTs as plain `+1`. No nudges, no confirms. Undo is the only net.
- Both write the identical event stream. **A scoring tap NEVER shows a confirm dialog in either mode** — points are instant and undoable. Muscle memory is preserved: Quick removes prompts, never moves a key.

### 3.6 Kept OFF the scorer (on purpose)

Full board (line score, timeouts detail, momentum line, biggest-lead), per-player box, shot chart, percentages/rates, clock by default, assist/sub/technical nuance (→ More sheet), any second colour/shadow. **Test:** *does the operator tap it >once a game AND does tapping change score/state?* If read-only → board. If once-a-game → More sheet. Only values, fouls, timeouts, undo, and the current handoff earn pad space.

---

## 4. SCREEN 3 — Main scoreboard (live board, the glance)

The score bug / stadium board. ONE job: who's winning, by how much, what phase — read in under a second from across a court. The shell is the brutalist record: flat black card, one 1px ink border, one hard `3px 3px 0` shadow. Identical to the cricket `.hero`.

### 4.1 Read-order contract (fixed by the real world)

1. **Two team scores** — biggest by far, mono tabular, each with a 3-letter abbrev. **Leader's score is green**; trailing stays inverse-white. Tie → both white. This green digit-block is "who's winning" from across the room.
2. **Phase pill** — dead centre: `Q3` / `HALF` / `OT` / `FINAL` (5×5) or `→21` target (3×3).
3. **ONE context line** — state-driven, precedence, **never stacked:** `FINAL` result → else `BONUS` state → else live `run` → else `margin`.
4. **Clock / shot-clock** — OPTIONAL, off by default; small mono chip only if enabled.

### 4.2 State A — compact (DEFAULT)

~64–80px black hero. Tiers 1–3 only. Lives atop the scorer, atop the LIVE tab, inside every share preview. 90% of eyes, 90% of the time.

```
┌──────────────────────────────────────────────┐
│  ● LIVE                                  Q3   │
│   LIO            ┌────┐            BOS         │
│    88            │ Q3 │             84         │   88 GREEN (leader)
│                  └────┘                        │
│  ───────────────────────────────────────────  │
│           Lions +4  ·  9–0 run                 │   ONE context line
└──────────────────────────────────────────────┘
```

3×3 reshapes: centre pill `→21`, context `Skins +3 · win by 2`, no quarter/possession/3-pt anywhere.

### 4.3 State B — fuller (stadium / cast / LIVE-tab hero)

Same shell, scaled up (scores 3–4rem), plus the record the room wants between plays. **Possession arrow is CUT for launch** (reserved for future 5×5-detailed).

```
┌────────────────────────────────────────────────────────┐
│  ● LIVE · Sunday Cup — Final                    Q3 6:12 │  clock only if enabled
│    LIONS                                    BOSTON       │
│     88                                        84         │  88 GREEN
│     ◆◆◇ TO                               TO ◆◇◇          │  timeout pips
│    Q │ 1 │ 2 │ 3 │ 4 │                                   │
│    LIO│24 │22 │[20]│ — │                                 │  current period boxed, — unplayed
│    BOS│20 │25 │[19]│ — │                                 │
│  ┌───────┐  BOS in bonus · next foul = 2 FT             │  hard stamp, danger-soft
│  │ BONUS │                                               │
│  └───────┘                                               │
│           Lions on a 9–0 run  ·  biggest lead +11        │  momentum line
└────────────────────────────────────────────────────────┘
```

State B never invents data — roster-less or clock-off simply doesn't render those rows (honest fallback, no empty scaffolding).

### 4.4 Banned from the board

Per-player box lines, raw foul ledgers (show the *bonus crossing*, not `TF:5`), shot clock by default, play-by-play feed, the keypad/undo/controls, percentages, a second colour/shadow/gradient/logo, stacked context lines, the shot chart. **Test:** *readable while running, from across the court, under a second?* If not → a tab.

---

## 5. SCREEN 4 — Scorecard / spectator (the read + the share)

The lean-back watch, opened on a shared WhatsApp link, **read-only, no install, no login**. Wraps the board in exactly the context that makes basketball feel like it's turning, without becoming FIBA LiveStats. Three tabs (capsule control):

| Tab | Job |
|---|---|
| **LIVE** (default, 90% of eyes) | hero board (State B) + collapsed momentum + now-card + key-moments feed + presence footer |
| **BOX** | line score + per-player box (PTS/FG/3PT/FT/REB/AST/PF) + shot chart artefact (when captured) |
| **STATS** | FG%/FT%/pace/+−/lead-changes/biggest-lead/team-foul history |

**Balance principle:** basic scores show SIMPLY (the board is the hero, unchanged) while richer context sits BELOW and mostly COLLAPSED. BOX/STATS are honest fallbacks — roster-less shows team-only rows; clock-off drops the clock column.

### 5.1 LIVE tab stack

```
┌──────────────────────────────────────────────┐
│  ‹     Sunday Cup · Final     ● LIVE       ↗  │  header · share
│  [ Live ]   [ Box ]   [ Stats ]               │
│   ┌── HERO = Screen 3 State B, verbatim ──┐   │  88 GREEN, simple, huge
│   └────────────────────────────────────────┘  │
│  ▸ Momentum · run & lead tracker          ▾   │  COLLAPSED by default
│   ┌── NOW-CARD ──────────────────────────┐    │  top 2–3 scorers, on-floor count
│   │ ● #7 Rohit (LIO) 22 PTS · 4! fouls   │    │  4! = foul-trouble whisper
│   └──────────────────────────────────────┘    │
│   KEY MOMENTS (last 3–5, plain language)      │
│   Q3 3:04  ● THREE! Rohit — Lions +11         │
│   Q3 4:12  ○ BONUS — Boston over the limit    │
│   Q2 0:00  ★ BUZZER! Sameer beats the half    │
│  👁 312 watching        [ Following ✓ ]       │  presence (count only at launch)
└──────────────────────────────────────────────┘
```

Three modules: (1) **Momentum run/lead tracker** — CSS-only lead-over-time strip, header `biggest lead +11 · 4 lead changes`, zero operator work. (2) **Now-card** — live slice only (top 2–3 scorers + on-floor count; roster-less → two team totals + biggest run). (3) **Key-moments feed** — last 3–5 beats, colour-typed: three/buzzer green, bonus/foul-out danger, run/lead-change ink, milestone gold.

---

## 6. Signature moments (tokenized, reduced-motion-gated)

Each is a named, budgeted animation on a precise engine trigger. Restraint-bound: one pulse budget, one gold per screen, press-physics baseline; every token collapses to an instant state-flip under `prefers-reduced-motion`.

| # | Moment | Trigger | Animation | Restraint |
|---|---|---|---|---|
| 1 | **Made three** | `value===3` (5×5) / `value===2` arc (3×3) | score-pop tiered **bigger than the common value** + brief green ring | the everyday marquee; tier IS the signature |
| 2 | **Buzzer-beater** | scoring event at `gameClock 0:00` of a period | the one near-takeover: pop + full-width buzzer sweep + auto-pinned `★` feed entry | ~700ms, card-scoped, once, end-of-period only |
| 3 | **BONUS crossing** | team period-foul hits threshold | hard status-stamp flip on `--se-danger-soft` + `next foul = 2 FT` | a flip, not a bounce; never green |
| 4 | **Foul trouble → foul-out** | limit−1 (whisper) then limit | danger ladder: soft `4!` whisper → row dims + `FOULED OUT` chip + feed entry | two soft rungs; a state stamp + bench nudge |
| 5 | **Scoring run / lead change** | `activeRun` crosses threshold or leader flips | momentum-line bar sweep + `▲ 9–0 RUN` feed beat; lead-change = margin pill emphasises | subtle; runs are frequent, no hero takeover |
| 6 | **Player milestone** | PTS crosses 20/30 | one gold milestone card `★ Rohit — 20 points` | **one gold per screen**, shared with final-result peak |

---

## 7. Interactive tracking layer (optional / on-demand)

Two-tier ship, exactly like cricket's wagon-wheel discipline.

### 7.1 EASY-NOW (zero-capture, ships at launch)

Both derive purely from the ordered event stream — no operator taps, no new capture:
- **Scoring-run / lead tracker** — CSS-only lead-over-time strip; encodes runs, lead changes, biggest lead. Highest-value viz for zero cost. Build first.
- **Foul-trouble board** — 0–5 pips per player, colouring toward foul-out, straight off `FoulEvent` accumulation.

### 7.2 FUTURE (on-demand capture, deferred)

- **Tap-to-place shot chart** — the marquee interactive artefact, deferred like the wagon-wheel. `shotZone` reserved now so it bolts on with no engine migration.
  - **Off by default.** One setup toggle "Track shot locations" (detailed mode only; Quick never shows it).
  - **Capture:** an optional, dismissible **"Where from?"** micro-sheet piggybacks on a `+2`/`+3` tap. The score moves instantly and is never blocked; tap the court → save, or Skip (a missed placement just leaves that basket un-located — never a gate).
  - **Court-type aware, set once at setup:** 5×5 → paint/mid/corner-3/above-the-break-3; 3×3 → arc-is-the-1/2-line, no three geometry; gully → close/long two-zone fallback.
  - **Feeds:** per-player + team shot charts (BOX tab), zone FG counts, hot-zone; upgrades feed language (`THREE! from the left corner`) but never gates it.

---

## 8. Additional features — launch vs Phase 2

**Launch (ride the existing engine + black-shell card, no new surface):**
- **Shareable moment cards** — any key-moment/milestone auto-renders a 1080×1080 brutalist card (buzzer-beater, game-winning three, `Rohit — 22 pts, 3 threes`, final result + top scorer). One tap → WhatsApp/IG. Reuses the black hero shell; every share is an acquisition loop back to the live link. **This is the structural edge — build it.**
- **One-link read-only live share + Follow** — `scoreeasy.in/live/<slug>` opens the LIVE tab, no install/login. Follow → push on tip-off / final whistle. `👁 watching` count in the footer. The parents'-WhatsApp broadcast a school never had.

**Phase 2 (real levers, but heavier surfaces — not launch):**
- **Spectator reactions** (🔥/🏀/👏 floating tally) — presence-only, non-corrupting, cheap; nice-to-have after the wedge lands.
- **League / bracket wrapper** — tournament model + live standings/bracket + point-diff tiebreak + cross-match leaderboard. The biggest *institutional* lever; ship once single-match is loved.
- **Player profiles / season cards** — cross-tournament persistence + shareable season card. The university retention hook.

**Discipline:** no launch feature adds a new colour, a new heavyweight surface, or anything that gates the 15-second gully start.

---

## 9. Ordered build plan

**Phase 0 — Engine (no UI).** Event types + `deriveGame` (score, leader, margin, lineScore, activeRun, biggestLead, leadChanges, bonusTeam, foulTrouble, fouledOut, timeouts; 3×3 pointsToTarget/winBy2). LIFO undo. Both rule-forks + fork selection. Reserve `shotZone`. Unit-test the fork math (bonus thresholds, foul-out, 3×3 target/win-by-2) first.

**Phase 1 — Compact board (Screen 3 State A).** The black hero: two scores (leader green), phase pill, one context line with precedence. 5×5 + 3×3 reshape. This is the shared readout everything reuses.

**Phase 2 — Lean scorer (Screen 2).** Two mirrored columns; 5×5 pad (`+2` huge) + **3×3 reshape (`+1 INSIDE` huge — the fixed layout)**; FOUL/T/O secondary strip; foul/bonus micro-strip; always-visible Undo; More sheet. Guided default with "Shooting foul?" flow; Quick toggle. Inline handoff banners. Wire to Phase 0 engine + Phase 1 readout.

**Phase 3 — Setup (Screen 1).** Two names → format preset (5×5 / 3×3) → Start. Everything else under collapsed More options. 15-second path is the acceptance test.

**Phase 4 — Fuller board (Screen 3 State B) + zero-capture tracking.** Line-score strip, timeout pips, BONUS stamp, foul-trouble whisper, momentum line. Ship the **run/lead tracker + foul-trouble board** (§7.1) here — free from the event stream.

**Phase 5 — Scorecard/spectator (Screen 4).** LIVE/BOX/STATS tabs; collapsed momentum; now-card; key-moments feed; presence footer (count). Honest fallbacks for roster-less / clock-off.

**Phase 6 — Signature moments.** Tokens 1–6 (§6), reduced-motion gated, one gold/screen budget.

**Phase 7 — Share layer.** Shareable moment cards (1080×1080) + one-link read-only live share + Follow.

**Phase 8+ (FUTURE, gated):** shot-chart tap-to-place capture (§7.2) → spectator reactions → league/bracket wrapper → player/season cards.

**Sequencing rationale:** engine → the board everything reuses → the input tool → the 15-sec on-ramp → depth → delight → spread. Each phase is independently demoable; nothing after Phase 3 gates a working scored match.
