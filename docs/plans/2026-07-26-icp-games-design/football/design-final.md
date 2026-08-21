# ScoreEasy — Football: DESIGN-FINAL (locked, buildable)

**Date:** 2026-07-26 · **Status:** LOCKED — the single decisive spec that supersedes the four working docs for build scope. · **Game:** Association Football — Indian college / university / turf ICP.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN). **No new colours.**
**Consolidates:** `research.md`, `main-scoreboard.md`, `scorer.md`, `live-innovations.md`, `design-brief.md`. Where those disagree or over-reach, **this document wins.**

**Design thesis:** *Two thumb-sized GOAL keys that never block on data, a count-up scoreline everyone reads across the turf, and an instant shareable result card that recruits the next match's spectators — everything else is derived from the honest event ledger a student volunteer can actually keep.*

---

## 0. CRITIQUE VERDICT — what shipped, what got cut, and why

The four working docs are strong and governance-clean. The critique cut or deferred three things that failed the bar, and resolved four open questions. **The v1 scope below is the survivor.**

### CUT / DEFERRED (failed the "real value at casual scale" test)
1. **Momentum bar → FUTURE, not v1.** It is the one genuine gimmick. Cricket's momentum wave rides a *dense* ledger (240+ balls); a football match's ledger is **sparse** — 2–4 goals plus a couple of cards. A wave computed from ~5 events is noise dressed as insight, and "labelled derived" doesn't rescue a signal that isn't there. **Revisit only if goal-location/shot capture ever makes the ledger dense.** The Timeline already answers "who's scoring, when."
2. **Goal-location capture (Tier 3) → FUTURE / on-demand.** Genuinely the honest wagon-wheel analogue and *pure upside if used* — but even one tap per goal, pitch-side under glare, deferred-behind-deferred, will rarely be used at casual level, and the SVG pitch-capture sheet + pitch-type awareness is real build cost. **v1's interactive-tracking layer is the Timeline alone.** Ship the lean loop first; add capture when the base is adopted.
3. **Follow & notify → FUTURE.** Real reach multiplier, but it needs push + WhatsApp notification infra that is not "near-free from the ledger." Defer behind the growth loop that *is* near-free (the shareable result card + live link).

### RESOLVED open questions (design-brief §9)
- **Q3 Match-minute:** clock **runs but every event's minute is editable**, and turf presets may use a **single running clock** (no half auto-prompt). The clock **never force-ends** anything — it *proposes* end-of-half at 45'/90'; the operator confirms. No preset assumes a precise, trusted clock.
- **Q7 Own-goal:** **single path — a chip in the goal-attribution row.** Not a long-press (mis-tap risk), not a separate More primary. Retroactive correction goes through Edit-last-event.
- **Q1 Attribution:** always-skippable, "Unknown / #__" ever-present; the log is never blocked. Guided nudges toward naming; Quick preset drops the prompt entirely.
- **Q8 MOTM:** v1 = **optional manual scorer pick** at full-time (skippable). Derived heuristic is future.

### KEPT (passed every criterion)
Lean scorer (2 GOAL keys + deferrable attribution), the 4-element board, the Live/Timeline/Stats spectator surface, the Timeline as the record, the honest Stats panel, the signature-moment ladder, the shareable result card + live-link growth loop, spectator reactions, milestones + tournament Golden Boot, and preset-driven setup. All governance-clean, no new colours, one pulse / one gold-at-FT motion budget intact.

---

## 1. Scoring model — the event-sourced ledger (LOCKED)

**The one law:** *the team score is a derived projection of attributed goal events, never a stored counter.* If the operator can raise the score without an event row existing, we rebuilt the generic +/- counter. **The second law:** *attribution never blocks the log* — a goal is capturable in the two seconds after the ball crosses the line; scorer/assist/type is a fast-follow, deferrable forever.

### 1.1 Events (the only things ever written)
| Event | Fields | Notes |
|---|---|---|
| `GOAL` | `id, creditedTo (home\|away), scorer?, assist?, minute, stoppage?, type (open\|penalty\|freekick\|header), isOwnGoal:false` | scorer/assist deferrable; score increments on write |
| `OWN_GOAL` | `id, creditedTo (team that benefits), concededBy (player, opposing roster), minute, stoppage?, isOwnGoal:true, noPersonalTally:true` | **structurally distinct** — credits the beneficiary team total; attributed to the conceding player; **never** touches any personal goal tally |
| `CARD` | `id, player, team, colour (yellow\|red), minute, stoppage?` | engine derives `sendOff` (straight red, or 2nd yellow to same player → auto-red) |
| `SUB` | `id, team, playerOff, playerOn, minute` | no cap (rolling subs); updates on-pitch set |
| `CLOCK` | `id, transition (KICKOFF\|PAUSE\|RESUME\|STOPPAGE\|END_H1\|START_H2\|END_MATCH\|START_ET1\|…\|START_SHOOTOUT), phase, stoppageAdded?` | the football state machine — absent from the generic path today |
| `PEN_KICK` | `id, team, order, result (scored\|missed)` | **shootout only** — never touches the match scoreline or any player goal tally |

### 1.2 Phase state machine (LOCKED)
`H1 → HT → H2 → FT` (league/group, draw is a valid terminal).
Knockout level at FT → operator picks `ET1 → HT2 → ET2 → (FT | PENS)` **or** `PENS` directly. No forced 30 minutes.
Turf golden-goal preset: `NEXT GOAL WINS` house-rule → the next `GOAL`/`OWN_GOAL` write **auto-commits `END_MATCH`**.
Single-clock turf preset: no `HT`; one running clock → `END_MATCH`.

### 1.3 Derivations (never entered — computed from the ledger)
Home/away score · goal difference · points · clean sheet · per-player goals / assists / yellows / reds / minutes-played (from subs + send-offs + kickoff) · brace / hat-trick · `onPitchCount` + short-handed state · result W/D/L · shootout line. **Own-goals are excluded from every personal tally by construction.**

---

## 2. SCREEN 1 — SETUP (skippable-to-scoring in <30s)

The organiser/scorer's on-ramp. **One preset tap ripples the whole stack** — the operator never tunes ten toggles.

```
┌──────────────────────────────────────────┐
│  New match                                │
│                                           │
│  FORMAT                                   │
│  [ 5s turf ] [ 7s ] [ College 11s ]       │  ← one tap ripples defaults
│                                           │
│  TEAM A  [ name ______ ] ◆                │  crest = initial squircle (accent)
│  TEAM B  [ name ______ ] ◆                │
│  › Add players (optional — paste a list)  │  loose roster; empty is valid
│                                           │
│  › Rules (auto-set by format — tap to see)│  plain-language switches, not jargon
│                                           │
│  [        ▶  Start match        ]         │
└──────────────────────────────────────────┘
```

**Preset ripple table (LOCKED):**
| Preset | Halves / clock | Cards | Subs | Attribution mode | Decider |
|---|---|---|---|---|---|
| **5s turf** | single running clock (or 2×15) | hidden | rolling | **Quick** (no prompt) | golden-goal `NEXT GOAL WINS` |
| **7s** | 2×20 | optional (off default) | rolling | Quick (off default) | golden-goal or ET |
| **College 11s** | 2×45 + stoppage | on | on (no cap) | **Guided** | ET → penalties |

- Roster is **optional**: start with empty rosters; `+ add` and `?Unknown` cover everything mid-match.
- Rules screen shows the ripple as **plain-language switches** ("Rolling subs · Show cards · Track assists · Stoppage time") — pre-set by preset, individually overridable for the edge case. This is the single manual override point for Quick/Guided.
- **Tournament setup** (organiser): a name + a list of teams → auto-generated standings + bracket on the existing `GenericGoalsTournament` shell (reuse, don't rebuild).

---

## 3. SCREEN 2 — LEAN SCORER (the primary build)

**Job:** capture goals (attributed) · cards · subs · clock — fast, one-handed, un-fumbleable. It shows the match **nowhere**; it enters. Thumb-zone discipline: most-tapped at the bottom, read-only glance up top.

```
┌───────────────────────────────────────────────┐
│  ‹   MUN v ARS · College Cup            ≡      │ order:0  topbar
├───────────────────────────────────────────────┤
│  ◆MUN  2 – 1  ARS◆      H2 · 67:14   ● +2 ⑩ARS │ order:1  COMPACT READOUT (glance; tap→board)
├───────────────────────────────────────────────┤
│  last ⚽ 67' Rashford (Bruno)          ↩ Undo  │ order:2  last-event + persistent Undo
├───────────────────────────────────────────────┤
│  [ ▮▮ PAUSE     67:14      + Stoppage ]         │ order:3  CLOCK BAR (becomes handoff prompt)
├───────────────────────────────────────────────┤
│     🟨 Card        ⇄ Sub          ⋯ More        │ order:4  SECONDARY strip (rare, 1 tap)
├───────────────────────────────────────────────┤
│  ╔═══════════════╗   ╔═══════════════╗          │
│  ║      ⚽       ║   ║      ⚽       ║          │ order:5  THUMB ZONE — two giant GOAL keys
│  ║     GOAL      ║   ║     GOAL      ║          │          (home left · away right, code-labelled)
│  ║     MUN       ║   ║     ARS       ║          │
│  ╚═══════════════╝   ╚═══════════════╝          │
└───────────────────────────────────────────────┘
```

### 3.1 The primary — two GOAL keys
Tap = **scoreline increments instantly** (score-pop on the board), *then* an inline deferrable attribution row slides under the key. Tap away = attribute later or never. Team identity is crest + 3-letter code, never a colour fill (green = lead/live only). GOAL keys get the one tinted promotion (`--se-color-action-soft`); `:active` press physics is the only motion.

### 3.2 Attribution row (inline `<details>`, never a modal, fully deferrable)
```
╔═ GOAL · MUN → 2  (67')            tap away = attribute later ═╗
║ Scorer  [10 Rashford][8 Bruno][7 Antony][+ add][?Unknown]    ║
║ Assist  [skip][8 Bruno][11 Garnacho] …                       ║
║         ⚑ Penalty        ⤾ Own goal                          ║
╚══════════════════════════════════════════════════════════════╝
```
- `+ add` quick-adds a player mid-match; `?Unknown` attributes to "Unknown #—" so the goal is **never** blocked.
- **⤾ Own goal (single path):** flips the scorer picker to the **opposing** roster, writes `OWN_GOAL` with `noPersonalTally` — the top-scorer table can never be corrupted by construction.
- **⚑ Penalty:** tags `type=penalty` (in-play stat only; does not touch scoreline logic). Shootout penalties are a different surface (§3.5).

### 3.3 Secondary strip
- **🟨 Card** → side → Yellow/Red → player. Engine derives send-off: 2nd yellow or straight red → one-tap confirm `2nd yellow · Ravi → RED · ENG down to 10`; board `⑩` updates automatically. Operator cannot silently log a 2nd yellow as "just a booking."
- **⇄ Sub** → side → off (on-pitch list) → on (bench / `+ add`). Minute auto-stamped, no cap.
- **⋯ More** → bottom-sheet for the genuinely rare (see 3.4).

### 3.4 More sheet (rare only — trimmed)
```
Correct  [ Undo last ]  [ Edit last event ]        ← edit covers "move minute" + retro fixes
Score    [ Disallow goal ]                          ← chalked-off goal
Clock    [ End half ]  [ Extra time ]  [ Timeout ]
Match    [ Format & rules ]  [ Penalty shootout ]  [ Edit teams ]  [ Share live ↗ ]
         [        End match        ]   ← danger
```

### 3.5 Clock lifecycle & shootout
- Clock bar **becomes the inline handoff prompt** at each transition, then reverts: `KICK OFF ▶` → running (`▮▮ Pause · + Stoppage`) → at 45'/90' it *offers* `End half` (never forces) → `HT` card `▶ Start 2nd half` → `FT`/`ET`/`Penalties` by format. Stoppage is operator-typed (`45+2`), never guessed. **Every event minute is editable.**
- **Penalty shootout** = its own mini-surface (`More → Penalty shootout`), two giant `Scored / Missed` targets, alternating auto-managed, best-of-5 → sudden death, produces the separate `won 4–3 on penalties` line. Functional grid ships v1; animated reveal is future.

### 3.6 Guided vs Quick — a consequence of the preset (not a chore)
Guided (College 11s) = full attribution + send-off derivation + halves/stoppage. Quick (turf) = GOAL tap is scoreline-only, cards hidden, single clock, golden-goal. **Quick never loses the ledger** — goals are still individual timeline events; scorers can be back-filled later. Quick removes the *prompt*, not the *record*. No denser "expert keypad" — two keys are already the fastest possible primary.

---

## 4. SCREEN 3 — MAIN SCOREBOARD (live) + SPECTATOR SURFACE

The glance surface everyone reads, wrapped in the lean-back watch experience.

### 4.1 The board — exactly four glance-elements (LOCKED, resist all additions)
1. **Scoreline** — two big mono tabular numerals `2 – 1` (largest object; read at 40m). Derived projection, never stored.
2. **Two team identities** — crest squircle + 3-letter code, home left / away right.
3. **Clock + phase** — count-up `H2 · 67:14`, dead-centre; stoppage renders `90+3` + a `+N` badge.
4. **State riders (only when true)** — `●LIVE` pulse (the board's single pulsing element, danger-red, reduced-motion gated; replaced by static `HT`/`FT`); short-handed `⑩` beside a sent-off team's code; the **one** computed context rider — `13 MIN LEFT` (late+close, only when a real clock runs) or `NEXT GOAL WINS` (golden-goal house-rule).

Green lead-wash sits behind the leading half only; level/draw = neutral. **Two densities:** compact persistent bug (rides above every screen) and a fuller live-screen hero (huge scoreline + full sans names + one static latest-goal caption `⚽ RASHFORD 67'`). **The takeover:** on a goal the board briefly becomes the goal caption + score-pop, then settles — the board's one animated beat.

**Never on the board:** scorers list, card list, possession, momentum, xG/win-prob, full names (compact), subs, decorative motion, any second accent, any gold while live. *Test: can a player read it in one second from across the pitch, and is it true right now?*

### 4.2 Spectator surface — `Live · Timeline · Stats` (single 390px column, hero pinned)
The board hero (State B) is pinned on top and never scrolls away; three tabs carry the depth.

- **`Live` (default, calm):**
  - **NOW-card (derived)** — `SCORERS` both sides · `ON PITCH MUN 11 · ARS ⑩10 (last send-off)` · last 2 subs. Answers "who scored, who's a man down, who came on" — no possession pretence.
  - **KEY MOMENTS digest** — top 3–4 goals + reds only, newest first, minute-stamped; goals `.six`-green, reds `.wkt`-danger; ends with `See full timeline →`.
  - *(No momentum bar in v1 — cut, §0.)*
- **`Timeline` — the record + the interactive-tracking layer (the one v1 spatial/temporal layer).** Full minute-by-minute vertical feed: ⚽ goal (scorer • assist • type • new scoreline), 🟨/🟥 card, ⇄ sub, clock milestones (KO/HT/FT/+stoppage), newest-first. Own-goal renders `⚽ OG · Odegaard (o.g.) · credited MUN` — visibly distinct, no personal tally. Filter chips `All · Goals · Cards · Subs`. **Doubles as undo-context** — it *is* the ledger projection.
- **`Stats` — honest panel only.** Paired bars for rows the ledger can fill: Goals · Yellow cards · Red cards · Subs used · Scorers. Possession/shots/corners **absent by design**, with a greyed footnote: *"Possession & shot stats need live tracking we don't ask a pitch-side scorer for."* Honesty over completeness.
- **Presence footer:** `👁 312 watching · 🔥 41` + Following pill (feeds reactions §6.2).

---

## 5. SCREEN 4 — SCORECARD / RESULT (the record + the shareable artifact)

The designed end-peak and the growth engine.

- **Result line, plain language:** *"Man Utd won 3–1" · "Drew 2–2" · "Man Utd won 4–3 on penalties."* A draw is a **first-class finished result**, never a "waiting" state. Both teams mono, loser at `opacity 0.55` (draw = both full).
- **Goals list** (minute · scorer · assist · type) · **cards list** · **subs list** · per-player goals/assists/cards/minutes · team totals · **MOTM** (optional manual pick) · shootout breakdown if applicable.
- **3-up stat tiles** (goals · scorers · cards). **Gold appears here only** (result frame + MOTM accent) — one gold element, never live.
- **Instant shareable result card** (§6.1) is generated from this surface's tokens — beautiful by default.

---

## 6. SIGNATURE MOMENTS (LOCKED ladder — reduced-motion gated, motion budget: one pulse + one score-pop + auto-dismissing overlays + gold only at FT)

| # | Moment | Trigger | Treatment | Scope |
|---|---|---|---|---|
| 1 | **The Goal** | `GOAL` commits | score-pop (scale 1→1.18→1) + full-width goal takeover ~2.2s (`⚽ RASHFORD · 67' assist Bruno · 2–1`), then settle + prepend to feed. Own-goal = muted `⚽ OG · 67'`, never celebratory | **SHIP** |
| 2 | **Late winner** | `GOAL` minute ≥80/stoppage **that changes the leader** | #1 escalated: `LATE` kicker, holds +0.6s, wash sweeps rather than cuts. Same green, hotter timing | **SHIP** (flag on #1) |
| 3 | **Red / send-off** | `CARD` red or derived 2nd-yellow | danger-tinted banner ~2s `🟥 ARSENAL DOWN TO 10 · Odegaard 67'` + board `⑩` flip (non-animated). Never full-bleed red. Yellow = feed row only | **SHIP** |
| 4 | **Hat-trick** | derived personal tally = 3 | one gold milestone card, sans sentence + mono figures line; one-gold-per-screen (mutually exclusive with result card). Brace = future lighter toast | **SHIP** (hat-trick) |
| 5 | **Final whistle** | `END_MATCH` → `FT` | result card takeover (§5), gold, loser dimmed, draw first-class, Share / Rematch CTAs, no pulse | **SHIP** |
| 6 | **Shootout reveal** | `PEN_KICK` per kick | animated dot fill | **FUTURE** (functional grid ships) |

---

## 7. INTERACTIVE TRACKING LAYER (marked easy-now vs future)

| Tier | Layer | Input cost | v1? |
|---|---|---|---|
| 1 | **Minute-by-minute Timeline** | zero (pure derivation of captured events) | **EASY-NOW · SHIP** — the one v1 spatial/temporal layer, football's spine |
| 2 | **Momentum bar** | zero input, but sparse ledger ⇒ statistically thin | **FUTURE** — cut from v1 (§0.1); revisit only if the ledger becomes dense |
| 3 | **Goal-location capture + pitch map** | optional 1 tap/goal, on-demand, pitch-type-aware SVG sheet | **FUTURE / on-demand** — the true wagon-wheel analogue, pure-upside, added post-adoption (§0.2) |

Full xG shot map: **permanently out of casual scope** — we plot locations at most, never fabricate expected-goals.

---

## 8. ADOPTION FEATURES (the school/university wedge)

| Feature | Value | v1? |
|---|---|---|
| **8.1 Instant shareable result card + live-link** | ⭐ headline growth loop — a WhatsApp group sees the card, taps the link, becomes spectators of the *next* match. Near-free from result tokens | **EASY-NOW · SHIP** |
| **8.2 Spectator reactions** (🔥/⚽/👏 tap, live count, goal burst) | the "watch the turf game live" delight that today exists only for pro fixtures; reuses ported Convex presence | **SHIP** (needs presence infra already in port list) |
| **8.3 Milestones + tournament Golden Boot** | brace/hat-trick/clean-sheet + Golden Boot / most-assists / cards table across a tournament — the retention loop grassroots tools lack; derived from the ledger the standings shell already feeds | **EASY-NOW · SHIP** |
| **8.4 Follow & notify** (push / WhatsApp goal + result alerts) | the async reach multiplier | **FUTURE** — needs notification infra, not near-free (§0.3) |
| **8.5 One-tap preset setup** | the organiser enabler | **SHIP** — this *is* Screen 1 (§2) |

---

## 9. PORT vs BUILD (same split cricket made)

**Port verbatim:** blend tokens + governance; `GenericGoalsTournament` shell (standings, bracket, `calculateGoalsStandings`, `KnockoutMatchCard`); cricket primitives (`MonoSheet`, hero, segmented tabs, event-strip grammar, result/scorecard/share trio, Convex live-sync, crest, presence footer); `useTimer`/`MonoLiveGame` as clock *starting point*.
**Build bespoke:** the event-sourced football engine (the core net-new work — the generic path stores only team-level score); the lean scorer console; the three bespoke match surfaces; format presets.

---

## 10. ORDERED BUILD PLAN

1. **Football match engine** (event-sourced) — events (§1.1) + phase state machine (§1.2) + all derivations (§1.3) + own-goal / send-off semantics. Foundation everything else projects from. Port cricket's C1 engine pattern.
2. **Setup + presets** (Screen 1, §2) — the three presets and their ripple table; loose roster + quick-add; `<30s` start path. Unblocks realistic scorer testing.
3. **Lean scorer console** (Screen 2, §3) — two GOAL keys, deferrable attribution row, clock bar + handoff prompts, Card/Sub/More strip, persistent Undo, Quick/Guided from preset. **The primary build.**
4. **Main board** (§4.1) — compact + hero, four glance-elements, riders, green lead-wash, takeover + score-pop. Derived projection only.
5. **Spectator surface** (§4.2) — hero + `Live/Timeline/Stats`, derived NOW-card, key-moments digest, **the Timeline** (§7 tier 1), honest Stats panel, presence footer.
6. **Scorecard / result + signature moments** (Screen 4 §5, moments 1–5 §6) — result peak, plain-language margin, per-player record, MOTM, gold-at-FT.
7. **Shareable result card + live-link growth loop** (§8.1) + **spectator reactions** (§8.2).
8. **Tournament roll-ups** (§8.3) — Golden Boot / most-assists / cards leaderboards on the ported standings shell.
9. **Penalty shootout mini-surface** (§3.5) — functional grid.

**FUTURE (post-adoption, in order of expected value):** momentum bar (only if ledger densifies) · goal-location capture + pitch map (§7 tier 3) · follow & notify (§8.4) · shootout animated reveal + brace toast + late-winner "screamer" variants.

---

## Summary

Football's ScoreEasy is **two thumb-sized GOAL keys feeding an event-sourced ledger that never blocks on attribution**, a **four-element count-up board** everyone reads across the turf, a **Live/Timeline/Stats** spectator surface whose one interactive layer is the honest minute-by-minute Timeline, and a **result peak that produces an instant shareable card + live link** — the growth loop that recruits the next match's crowd. Presets ripple the whole stack from one tap; own-goals and second-yellows are handled structurally so a volunteer can't corrupt the record; and the retention engine is the tournament Golden Boot the standings shell almost gives us for free. The momentum bar, goal-location capture, and push/WhatsApp notify are deliberately future-flagged so v1 nails the lean loop that actually gets a college to adopt it. No new colours; one pulse; gold only at full-time.
