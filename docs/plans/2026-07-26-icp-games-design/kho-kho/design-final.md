# ScoreEasy — Kho-Kho DESIGN-FINAL (locked, buildable)

**Date:** 2026-07-26 · **Status:** LOCKED — this is the spec the build follows. Supersedes `research.md` / `main-scoreboard.md` / `scorer.md` / `live-innovations.md` where they conflict.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · flat-black hero, one hard offset shadow, mono tabular numerals, **green = live / chasing / lead only — NO new colours.**
**Thesis:** *Kho-Kho is a turn-based chase clock, not a two-number counter — so the scorer is a Big-1 (one giant OUT), the board shows four facts not two, and every spectator layer is free-derived from the OUT log + clock.*

---

## 0. Critique verdict — what was cut, kept, and demoted

The four source docs are largely correct and are ported wholesale. The decisive edits:

**CUT (fails "lean + un-fumbleable"):**
- **`DREAM RUN ✓` manual stamp** removed from the college scorer's rare strip. The dream-run timer and its threshold crossings are **100% derived** from the OUT log + clock (research §5.2). A manual "mark this run notable" tap is redundant, adds a fumble surface, and invites the operator to think it's *required* to score the run. Dream-run is derived-only in both presets. The rare strip drops to **two** items: `NEXT 3 IN` · `NAME DEFENDER`.

**DEMOTED to FUTURE (fails "single cheap phone, offline, no login" — needs a server or cross-match identity, so it is NOT a v1 easy-win):**
- **QR scan-to-watch live board**, **spectator reactions**, **tournament/league standings**, **auto cross-match player-milestone cards**. All four are real adoption drivers, but each requires hosted live sync or a persistent player-identity store beyond the single-device offline core. They are Phase 2+, not cut — see §7.
- **Chase-path two-tap ray** and the **full kho-lane diagram** stay FUTURE (need positional capture a casual scorer won't give), exactly as cricket defers ball-by-ball placement.

**KEPT as easy-now (single device, offline, static export):** the four-fact board, the Big-1 scorer, the guided handoffs, the derived **Survival Timeline** + **dream-run band**, the six signature moments, the **optional Chase-Map tag-spot** (single tap), and the **WhatsApp static turn-story image** (rendered on-device, no server).

Everything else in the four docs survives review unchanged.

---

## 1. Scoring model (locked)

### 1.1 The atom and the shape
- **OUT** = active chaser tags a defender / defender leaves limits. The one scored event.
- **Turn** = one team chases against a **countdown clock**; only the chasing team scores (college). Clock hitting 0 ends the turn.
- **Match** = cumulative sum of all your chase-turn points. Higher total wins. Result stated plainly: *"Warriors won by 6 points."*
- **The app never adjudicates chase mechanics** (kho, direction-lock, cross-at-pole). The ref calls the OUT; the scorer records it.

### 1.2 Presets
| Preset | Sides | Turns | Turn clock | Point/out | Dream run | Out-types |
|---|---|---|---|---|---|---|
| **College (DEFAULT)** | 9 | 4 (2 innings) | 9:00 | **+1** | prestige, **derived, no points** | none |
| **School** | 7 | 2 | 5:00–7:00 | +1 | derived, no points | none |
| **Power / League (toggle)** | 9 | 4 | 7:00 | **Touch 2 · Pole Dive 3 · Sky Dive 3 ⚑** | **scores: +1 at threshold, +1/30s → defending team ⚑** | Touch/Pole/Sky |

**⚑ FLAG — never hardcode point values or the dream-run threshold from memory.** Sources disagree (research §1.3: Sportskeeda S2 = Pole/Sky 3; myKhel = 2). **Confirm against the current season's rulebook at build.** Store as preset config, not literals.

### 1.3 Derived-automatically (never tapped)
Batch tracker (`● ● ○`, auto-feed on 3rd out), **Lona/all-out recycle** (order recycles, clock keeps running, no points college), dream-run survival timers + threshold crossings, per-turn deltas, cumulative totals, chase equation, momentum bars, Survival Timeline.

### 1.4 Edge toggles (More sheet only): declare, follow-on, standings-table points, reviews, cards, Wazir/powerplay. Never on a primary surface.

---

## 2. Screen 1 — SETUP

One short flow, thumb-friendly, all optional past the two team names.

1. **Teams** — Team A name · Team B name (only required fields).
2. **Preset** — `College 9s (default)` · `School 7s` · `Power/League`. Sets sides, turns, clock, scoring model, court format in one pick.
3. **Court format** (for the optional Chase Map, set once here, never re-picked): `Traditional 9s (27×16, 8 cross-lanes)` · `School 7s` · `League Mat`.
4. **Optional refinements** (collapsed): rosters, turn-clock override, who chases first.
5. **Start** → arms Turn 1, clock paused, first OUT ready.

Rule: a first-timer can reach a live scorer in **two taps** (names + Start on defaults).

---

## 3. Screen 2 — LEAN SCORER (Big-1)

Ports `cricket-scorer-alt-big5.html` thumb-zone grammar; the "ball" becomes the **OUT**.

### 3.1 Layout (top → bottom)
1. **Top bar** — ‹ back · "A vs B · Turn 3/4" · ●LIVE · ⋯
2. **Flat-black compact hero** (read-only except clock) — the four glance facts (see §4).
3. **Rare strip** (hairline splits): `NEXT 3 IN` · `NAME DEFENDER` *(both optional; naming never gates)*.
4. **THUMB ZONE:** `↩ UNDO` (small, always reachable) + **`OUT +1`** (giant full-width primary, transient danger flash + stamp).
5. **Footer:** quiet `Full scorecard ›` · `Share ↗`.

The **clock** is a large tap-to-pause co-primary one row up in the hero (play stops constantly at grounds).

### 3.2 The everyday loop
Hot turn = tap **OUT** every few seconds, nothing else. OUT auto: `+1` to chaser · advance `● ● ○` · on 3rd out auto `NEXT 3 IN` · on full clear fires `LONA` stamp and **keeps the clock running** · resets survivor derivation. **UNDO** reverts the last event — the fumble valve.

### 3.3 Guided handoffs (never a silent reset)
Each replaces the OUT primary with a one-tap card in the thumb zone:
- **Turn end (auto at 0:00, 4×/match):** shows turn points + cumulative + the plain swap (*"Next: PANTHERS chase · WARRIORS defend"*) → single `START TURN 4 ▸` (arms paused) + escape hatches (`Edit turn points` · `Undo turn end`).
- **Innings break:** same card with `INNINGS BREAK · 3:00` countdown, skippable.
- **Timeout / Substitution:** inline banner/row from More sheet; clock already frozen, no drift.

### 3.4 Power toggle (More → confirm, defaults OFF, remembered per match)
Changes **only the OUT interaction** → Big-3 keypad `TOUCH +2 · POLE DIVE +3 · SKY DIVE +3` (⚑ values). Dream-run flips to scoring (app derives, still one tap). Adds Wazir/powerplay, review, cards to More. No third "quick mode" — Guided **is** quick.

### 3.5 Off the scorer (deliberately): rich stats, the dream-run tension band, gold cards, chase equation, refereeing, out-type menu (college), mandatory naming, second accent colour.

---

## 4. Screen 3 — MAIN SCOREBOARD (live hero)

**A two-number board cannot express Kho-Kho.** The glance read is **four facts:** *cumulative totals · turn clock · who's attacking · defenders left.* Three tier-1 numerals + one live datum.

### 4.1 Elements (hierarchy order)
| # | Element | Treatment |
|---|---|---|
| 1 | **Two cumulative totals** `31 · 26` | Tier-1 giant mono tabular. Chasing side **green**; defender ink-inverse. Persists across all 4 turns — the match-deciding number. |
| 2 | **Turn countdown clock** `03:12` | Tier-1 **co-hero**, centered. `<60s` → warning ladder. LIVE pulse (reduced-motion gated). |
| 3 | **ATTACK / DEF role tag + green wash** | On the chasing team's name. The one moving accent; slides to the new chaser on swap. Without it the score is unreadable. |
| 4 | **Turn indicator** `TURN 3/4` | Mono eyebrow in the context subtitle. |
| 5 | **Defenders remaining** `● ● ○` | Tier-3 record-chips (filled = on mat). `RECYCLE ×n` hairline only after all-out. |

Persistent mono subtitle ties it together: `TURN 3/4 · GUJARAT CHASING · 03:12 LEFT`.

### 4.2 Two states
- **Compact (default):** five elements, one black slab, one shadow. Survives 40px on a projector. Clock is the only animation.
- **Fuller (spectator/big-screen):** compact **+ two derived additions only** — the **dream-run tension band** (`longest on mat 2:38`, escalates → fires the one gold card at threshold) and the **final-turn chase equation** (`CHENNAI NEED 4 · 1:47 LEFT`, green NEED → danger-soft in closing minute). No denser dashboard.

### 4.3 Off the board: chaser names/tag counts, out-type breakdown, survival table/Gantt, dream-run *points* in college, kho/lane diagrams, reviews/cards, per-turn history, a raw two-number score, any second accent.

---

## 5. Screen 4 — SCORECARD + LIVE tabs

Capsule tabs (verbatim `cricket-spectator-clean.html`): `[ Live ] [ Scorecard ] [ Stats ] [ Chase Map ]`.

- **Live** — the fuller hero (§4.2) + **simple per-turn ledger** directly under it (the "simple score" — totals broken into turns, current cell pulses):
  `WARRIORS 14 · — · 10 · — =31   ·   PANTHERS 1 · 16 · — · 2 =26`
  + collapsed **Momentum** (`<details>`, **outs/minute** bars — Kho-Kho's runs/over) + **Now-cards** (active chaser with tag count; on-mat batch of 3 with live survival timers) + **Key-moments feed** (turn-clock timestamped, newest first) + presence footer.
- **Scorecard** — turn-by-turn record, per-chaser tag counts, per-defender survival table.
- **Stats** — cumulative leaders (most outs, longest dream run, best survival %).
- **Chase Map** — §6; present only if tags were captured (else the Survival Timeline stands alone).

---

## 6. Interactive tracking layer (OPTIONAL / on-demand)

### 6.1 Survival Timeline (Gantt) — ALWAYS present, EASY-NOW, zero extra taps
One horizontal bar per defender across the turn clock, length = time survived, marked with the out-event and any dream-run `★`. **Pure derivation from the OUT log + clock.** This is the guaranteed-drama free layer; it renders even if every operator skips the Chase Map. Reads instantly as *who lasted, who fell early.*

### 6.2 Chase Map tag-spot — OPTIONAL, on-demand, EASY-NOW (single tap)
Ports the cricket wagon-wheel bargain. On a notable OUT a slim sheet slides up — the OUT is **already logged and scored**, this only enriches:
- **Single tap** on the standardized court schematic = tag spot; **zone auto-classified** (`POLE near/far` · `FREE ZONE` · `CENTRAL LANE` · `CROSS-LANE n`) — operator never names a zone.
- **Long-press** = dive tag (league: pre-selects Pole/Sky by zone, confirmable).
- **`Skip`** (muted) / **`Save tag`** (green). Skipping loses nothing.
- Court format is the read-only label set at setup — never re-picked per tag.
- Feeds per-chaser tag-zone profiles + the Chase-Map court heat read.

### 6.3 FUTURE-FLAGGED tracking (needs positional capture beyond a casual tap)
- **Chase-path two-tap ray** (start→tag green line) — power-user toggle, deferred.
- **Full kho-to-kho lane / active-chaser path diagram** — needs continuous positional capture; deferred exactly as cricket defers ball-by-ball placement.

---

## 7. Signature moments (locked, tokenized, reduced-motion gated)

Per screen budget: **1 hard shadow · 1 ink frame · ≤3 soft surfaces · ≤1 gold · ≤1 glow · ≤1 inversion · ≤1 live pulse.** At most one of {1,3,6} fires visibly at a time; the feed queues the rest as static stamps.

| # | Moment | Trigger (derived) | Motion → reduced-motion fallback |
|---|---|---|---|
| 1 | **Dream-run threshold — THE marquee** | survival timer crosses threshold + every +30s | the **one gold card** rises over the band (`--se-blend-gold`), sentence in sans, figures in mono → appears instantly |
| 2 | **Turn takeover / role swap** | clock 0:00 → swap | green wash + ATTACK **slides** old→new chaser → cuts instantly |
| 3 | **Lona / all-out** | side cleared before clock ends | `LONA` stamp + brief ink glow (the ≤1 glow) → static stamp |
| 4 | **Final-turn chase equation** | final turn AND result in reach | `NEED` band colour-climbs neutral→danger-soft in closing 60s → colour set by time, no pulse |
| 5 | **Sky/Pole Dive (league) +3** | `outType ∈ {pole,sky}` | `+3` echo stamp in feed → static stamp |
| 6 | **Wazir / Powerplay (league)** | two Wazirs active | `POWERPLAY` banner (suppresses LIVE pulse while shown) → static banner |

---

## 8. Ordered build plan

**Phase 1 — Core loop (single device, offline). Ships a usable college scorer.**
1. Data model: Match · Turn · OUT-event log · batch tracker · cumulative derivation. Preset config (college/school), point values + dream-run threshold as **config, flagged, confirmed at build.**
2. **Setup screen** (§2) — 2-tap start on defaults.
3. **Lean scorer** (§3): Big-1 OUT, UNDO, tap-to-pause clock, auto batch-feed, Lona recycle, rare strip (`NEXT 3 IN` · `NAME DEFENDER` only).
4. **Guided handoffs** (§3.3): turn-end swap, innings break, timeout, sub.
5. **Compact board** (§4.1–4.2) embedded read-only in the scorer.

**Phase 2 — Spectator + free-derived drama (still single device).**
6. **Fuller hero** (dream-run band + chase equation).
7. **Live/Scorecard/Stats tabs** (§5): per-turn ledger, outs/minute momentum, now-cards, key-moments feed.
8. **Survival Timeline Gantt** (§6.1) — free derivation, always on.
9. **Signature moments 1–4** (§7), tokenized + reduced-motion gated.
10. **WhatsApp static turn-story image** — on-device render (scoreline + four turn-deltas + top beat). No server. The growth loop's offline core.

**Phase 3 — Power/League preset (toggle).**
11. Big-3 OUT keypad, dream-run scoring, Wazir/powerplay/review/cards, moments 5–6, out-type attribution.

**Phase 4 — Optional spatial enrichment.**
12. **Chase-Map tag-spot** capture sheet + Chase-Map tab (§6.2).

**Phase 5 — FUTURE (needs server / realtime / cross-match identity).**
13. Hosted live link + **QR scan-to-watch** read-only board.
14. **Spectator reactions** (realtime write/aggregate).
15. **Tournament/league standings** (multi-match model, real league math).
16. **Auto cross-match player-milestone cards** (persistent player identity).
17. Chase-path ray + full lane diagram (positional capture).

**Rule:** a school can adopt at end of Phase 2 (scorer + board + share) with zero backend. Phases 3–4 deepen; Phase 5 is the institutional/broadcast layer.
