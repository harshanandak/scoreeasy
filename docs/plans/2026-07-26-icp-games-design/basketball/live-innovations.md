# ScoreEasy — Basketball LIVE / SPECTATOR SCREEN + Signature Moments + Interactive Tracking

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (no code) · **Screen:** the lean-back watch experience built AROUND the main board — the thing that makes a hostel final feel like a broadcast.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Anchors:** `research.md` §2.2/§5, `main-scoreboard.md` (compact + fuller hero reused verbatim), `scorer.md` (one engine, casual↔detailed), cricket spectator (`cricket-spectator-clean.html` — hero → collapsible momentum → now-card → key-moments feed → presence footer) + cricket shot-tracking (`cricket-shot-tracking.html` — optional on-demand spatial capture, ground-type aware, "set once at setup, skippable every event").
**Rule:** pure-black ink · one hard offset shadow · mono tabular numerals · **green = live/lead ONLY** · BONUS/foul rides `--se-danger-soft`, never green · one gold per screen · reduced-motion gated.

> The scorer is an INPUT device; the board is a GLANCE. This screen is the **read** — the surface a spectator opens on a shared WhatsApp link and leans back into. It wraps the main board in exactly the context that makes basketball feel like it's turning (runs, bonus, foul trouble, buzzer moments) without ever becoming FIBA LiveStats. Everything below is subordinate to the board staying the hero.

---

## 1. Live screen layout — hero board + simple scores + richer context, balanced by tabs

### 1.1 The tab contract (mirror cricket's Live / Scorecard / Stats)

A capsule segmented control under the header. Basketball's three tabs:

| Tab | Job | Who opens it |
|---|---|---|
| **LIVE** (default) | The lean-back watch: hero board + momentum + now-cards + key-moments feed. Reads at a glance, updates live. | 90% of eyes |
| **BOX** | The ledger: quarter-by-quarter line score, per-player box (PTS/FG/3PT/FT/REB/AST/PF), and the **shot chart** artefact (§3). | the curious / coach |
| **STATS** | Rates & analytics: FG%, FT%, pace, +/−, lead-changes, biggest-lead, team-foul history. | the nerd |

The LIVE tab is everything below. BOX/STATS are honest fallbacks — roster-less matches show team-only rows, clock-off matches drop the clock column; nothing renders empty scaffolding.

### 1.2 Vertical stack of the LIVE tab (top → bottom)

```
┌──────────────────────────────────────────────┐
│  ‹      Sunday Cup · Final       ● LIVE     ↗ │  ← header: back · title · LIVE · share
├──────────────────────────────────────────────┤
│  [ Live ]   [ Box ]   [ Stats ]               │  ← capsule tabs
├──────────────────────────────────────────────┤
│                                                │
│   ┌────────────────────────────────────────┐  │
│   │  ● LIVE                          Q3     │  │  ← HERO = main-scoreboard.md State B
│   │   LIONS                    BOSTON       │  │    (fuller stadium board), verbatim.
│   │    88                        84         │  │    88 GREEN (leader). Simple, huge.
│   │    ◆◆◇ TO              TO ◆◇◇           │  │
│   │   Q │ 1 │ 2 │ 3 │ 4 │        ►          │  │  ← quarter strip + possession
│   │   LIO│24 │22 │[20]│ — │                 │  │
│   │   BOS│20 │25 │[19]│ — │                 │  │
│   │  ┌───────┐ BOS in bonus · next foul=2FT │  │  ← BONUS stamp (danger-soft)
│   │  │ BONUS │                              │  │
│   │  └───────┘                              │  │
│   │      Lions on a 9–0 run · lead +11      │  │  ← momentum line
│   └────────────────────────────────────────┘  │
│                                                │
│  ▸ Momentum · run & lead tracker         ▾    │  ← COLLAPSED details (cricket .mom-d)
│                                                │
│   ┌────────────────────────────────────────┐  │
│   │ TOP SCORERS            PTS  FG  3P  PF  │  │  ← NOW-CARD: who's hot right now
│   │ ● #7 Rohit  (LIO)      22   9   3   4! │  │    4! = foul-trouble whisper inline
│   │   #4 Aditya (LIO)      18   7   1   2  │  │
│   │   #11 Sameer (BOS)     20   8   2   3  │  │
│   │   On floor · LIO 5 · BOS 5             │  │
│   └────────────────────────────────────────┘  │
│                                                │
│   KEY MOMENTS                                  │  ← timestamped feed (cricket .moment)
│   Q3 3:04  ● THREE! Rohit from the corner —    │
│            Lions stretch to +11                │
│   Q3 4:12  ○ BONUS — Boston over the limit     │
│   Q3 5:40  ▲ 9–0 RUN since the timeout         │
│   Q2 0:00  ★ BUZZER! Sameer beats the half     │
│                                                │
│  👁 312 watching · 🔥 41      [ Following ✓ ]  │  ← presence footer
└──────────────────────────────────────────────┘
```

**Balance principle (the whole point of the brief):** the **basic scores show SIMPLY** (the hero is the board, unchanged — huge mono digits, leader green, one context line) while the **richer context sits BELOW and mostly COLLAPSED**. Momentum is a `<details>` that opens on tap (default closed — cricket's `.mom-d` pattern). The now-card shows only the *live* truth (top 2–3 scorers + who's on the floor), not a full box. The feed is the last three drama beats, not a full play-by-play. Depth is one tap away in BOX; the LIVE tab never out-shouts the score.

### 1.3 The three richer-context modules

1. **Momentum · run & lead tracker (collapsed by default).** A CSS-only horizontal lead-over-time strip — a centre baseline, green bars pushing up when the leader extends, danger-tint pushing down on the opponent's runs, a dashed "now" slot. Derived purely from the event stream (zero operator work — §3.2). Header line carries `biggest lead +11 · 4 lead changes`. This is basketball's answer to the cricket runs-per-over momentum bars.
2. **Now-card (who's hot).** The live-only slice of the box: **top 2–3 scorers** with PTS/FG/3P/PF, a `●` dot on the current leading scorer, and a one-line **on-floor** count (`LIO 5 · BOS 5`). A player at limit−1 fouls shows a `4!` foul-trouble whisper in the PF column. Roster-less match → this card collapses to the two team totals + biggest run. Never the full box (that's BOX tab).
3. **Key-moments feed.** The last 3–5 drama beats, timestamped `Q3 3:04`, plain-language, colour-coded by type: `● THREE!`/buzzer in green, `○ BONUS`/foul-out in danger, `▲ RUN`/lead-change in ink, `★` gold for a milestone. Tapping "show all" pushes to the full play-by-play in BOX. This is the cricket `.moment` feed, re-typed for basketball events.

---

## 2. Signature moments — the drama beats worth a tokenized, reduced-motion-gated animation

Each is a **token** (a named, budgeted animation), fires on a precise engine trigger, and is **restraint-bound**: one pulse budget, one gold per screen, press-physics baseline, and every motion collapses to an instant state-flip under `prefers-reduced-motion`. Ranked by how much each defines basketball.

| # | Moment | Trigger (engine) | The animation | Restraint |
|---|---|---|---|---|
| 1 | **Made three** | `ScoreEvent.value === 3` | Score-pop **tiered bigger than a +2** — the digit block scales+settles, a brief green ring off the +3. | The everyday marquee. No takeover, no sound. Tier is the whole signature — a +2 pops small, a +3 pops big. |
| 2 | **Buzzer-beater** | scoring event lands at `gameClock === 0:00` of any period | The one designed **near-takeover**: score-pop + a full-width buzzer sweep across the hero + the moment auto-pinned to the feed with `★`. | The single most iconic beat — earns the biggest motion, but still card-scoped, ~700ms, once. End-of-period only. |
| 3 | **BONUS crossing** | team period-foul count hits threshold (5 FIBA / 7 in 3×3) | Hard **status-stamp flip** — the `BONUS` rectangle snaps in on `--se-danger-soft` with the explained line `next foul = 2 FT`. | State change, not celebration. A flip, not a bounce. Rides danger-soft, never green. |
| 4 | **Foul trouble → foul-out** | player reaches limit−1 (whisper) then limit (foul-out) | Escalating **danger ladder**: limit−1 = soft `4!` whisper appears in the now-card; foul-out = the row dims + a `FOULED OUT` chip + feed entry. | Two rungs, both soft. The foul-out is a state stamp + a bench nudge, not a flourish. |
| 5 | **Scoring run / momentum swing** | `derived.activeRun` crosses a run threshold (e.g. 8–0) or flips who's leading | The **momentum line** emphasises (bar sweep) + a plain-language feed beat `▲ 9–0 RUN since the timeout`. Lead-change = the margin pill briefly emphasises. | Subtle. One emphasis on the line, one feed entry. No hero takeover — runs are frequent. |
| 6 | **Player milestone** | player PTS crosses 20/30, or a personal double-digit run | One **gold milestone card** (`★ Rohit — 20 points`), reused for the final-result peak. | **One gold per screen.** Gold is spent here and on the final; it never co-occurs with another gold. |

**Reduced-motion contract:** every token above has a static equivalent — the three-pop becomes an instant larger digit + green ring (no scale), the buzzer becomes an instant stamp + pinned feed entry, runs/bonus/foul-out are already state-flips. Motion is decoration on a state change that is always legible without it.

---

## 3. INTERACTIVE TRACKING INNOVATION — the basketball shot chart (cricket's wagon-wheel analogue)

Cricket's signature interactive layer is the **wagon-wheel**: an optional, on-demand, ground-type-aware tap-to-place spatial capture piggybacked on a scoring event, that feeds the batsman's shot zones. Basketball's direct analogue — pro-validated by FIBA LiveStats' native shot chart (`research.md` §5.2) — is the **half-court shot chart**: tap *where the basket was made* to build 2-pt/3-pt zone maps per player and team.

**Two-tier ship, exactly like cricket:**
- **Ship-early, zero-capture:** the **scoring-run / lead tracker** (§1.3.1) + the **foul-trouble board** — both derive purely from the event stream, no operator taps. These are live at launch.
- **Ship-later, on-demand capture:** the **tap-to-place shot chart** — the marquee interactive artefact, deferred like the wagon-wheel. The `shotZone` field is **reserved now** in `ScoreEvent` (`research.md` §1.2) so the capture layer bolts on without an engine migration.

### 3.1 The capture interaction (adapting cricket's optional micro-sheet)

**Where it lives:** NOT on the scoring pad. Exactly like cricket, capture is an **optional micro-sheet that piggybacks on a scoring tap**. The operator taps `+2` / `+3` as always (the score moves instantly — never blocked); a slim, dismissible **"Where from?"** sheet slides up. Tap the court → save; or **Skip** (or ignore — auto-dismisses). The 90% loop is untouched; spatial capture is pure opt-in on top.

**On-demand & mode-gated:**
- **Off by default** for casual/gully scoring. A single setup toggle **"Track shot locations"** turns it on (like cricket's wagon-wheel opt-in). Detailed mode surfaces it; Quick mode never shows it.
- Even when on, **every sheet is skippable** — a missed placement just leaves that basket un-located; the score and box are unaffected. Never a gate.

**Court-type aware (the ground-type analogue).** Cricket picks a ground *shape* once at setup (Round/Oval/Box/Gully); basketball picks a **court type** once at setup, which reshapes the diagram and the zones:
- **Full-court 5×5** → standard FIBA/NBA half-court with a **three-point arc** — zones: paint / mid-range / left-corner-3 / right-corner-3 / above-the-break-3.
- **3×3 half-court** → the **arc is the 1-vs-2 line** (inside arc = 1, behind = 2, no 3) — zones reshape to paint(1) / arc-2 left / arc-2 right / top-of-key-2. The diagram physically drops the NBA/college three geometry, matching the keypad reshape in `scorer.md`.
- **Gully / single-basket** → a simplified half-court with a rough arc, "close / long" two-zone fallback for courts with no painted lines.

The court type is chosen at match setup and **reused every event** — the operator never re-picks it, identical to cricket's "shape set once at match start."

### 3.2 How it feeds stats + the live visualisation

- **Per-player shot chart** (BOX tab): the player's makes plotted as dots on the half-court, split into zones. Derived: **zone FG counts**, points-by-zone, "hot zone" (most-scored area). This is the wagon-wheel's per-batsman equivalent.
- **Team shot chart:** all makes aggregated — shows where a team scores from (paint-heavy vs perimeter), a genuine coaching artefact.
- **Zero-capture derivations (always on, no shot chart needed):** the **run/lead tracker** and **biggest-lead / lead-changes** come free from the ordered event stream. The **foul-trouble board** (0–5 pips per player, colouring toward foul-out) reads straight off `FoulEvent` accumulation. These ship at launch regardless of whether anyone taps the shot chart.
- **Live feed tie-in:** a located `+3` can enrich its key-moment beat (`THREE! from the left corner`) once capture is on — the spatial layer *upgrades* the feed language, it doesn't gate it.

### 3.3 Wireframe — the "Where from?" capture sheet (5×5)

```
┌──────────────────────────────────────────────┐
│  Where from?                        Optional   │  ← sheet head (cricket .sheet-head)
│  Scored THREE · #7 Rohit · tap the court       │  ← sub: value + player + prompt
│                                                │
│  [ 5×5 court ]  [ 3×3 half ]  [ Gully ]        │  ← court-type chips (set once, shown for ref)
│                                                │
│        ┌──────────────────────────────┐        │
│        │            ▢ basket           │        │  ← baseline top
│        │        ╭───────────╮          │        │
│        │        │   PAINT   │          │        │  ← zones: paint / mid / corners / top
│        │   ◗────┤     ●     ├────◖      │        │    ● = this make (tap to place)
│        │ corner │  mid-range │ corner   │        │    green dot = make, faint = miss (opt)
│        │   3    ╰───────────╯   3       │        │
│        │      above-the-break 3         │        │
│        │   ·  ·   (prior makes plotted) │        │
│        └──────────────────────────────┘        │
│                                                │
│  Tap the spot · zones aggregate to the chart   │  ← hint
│  ● make (green)   · faint = missed (detailed)  │  ← legend
│                                                │
│  [   Skip   ]              [  Save spot  ]      │  ← skip = un-located; never blocks score
│                                                │
│  Court type set once at setup. Feeds the       │
│  player & team shot charts. Score is already    │
│  counted — this only adds the location.        │  ← note (cricket-style reassurance)
└──────────────────────────────────────────────┘
```

For 3×3 the same sheet renders with the **arc as the 1/2 line** and no above-the-break-3 zone; for Gully it collapses to a two-zone **close / long** tap. Identical interaction, court-aware geometry — the exact discipline cricket's shot-tracking uses for Round/Oval/Box/Gully.

---

## 4. ADDITIONAL FEATURES — what these underserved games lack (ICP-realistic adoption drivers)

Grassroots Indian basketball is digitally underserved (`research.md` §4). Five features that turn a scorekeeper into something a school/university *adopts*, each cheap to build on the existing engine and share layer.

1. **Shareable moment cards (WhatsApp-native).** Any key-moment or milestone auto-renders a **1080×1080 brutalist card** — the buzzer-beater, the game-winning three, `Rohit — 22 pts, 3 threes`, or the final result with top scorer. One tap → share to WhatsApp status / Instagram. This is ScoreEasy's structural edge (`research.md` §4.5): the thing that makes a hostel final *spread*. The card reuses the black hero shell — zero new design, and every share is an acquisition loop back to the live link.

2. **One-link live share + follow (spectator presence).** A single short link (`scoreeasy.in/live/lions-boston`) opens the LIVE tab read-only — no app install, no login. Spectators tap **Follow** to get a push when the game tips off / final whistle, and a live **👁 watching · 🔥 reactions** count (footer). For a school this is the parents'-WhatsApp-group broadcast they never had; for a fest it's the bracket everyone refreshes.

3. **Spectator reactions (lightweight, non-corrupting).** Followers tap 🔥 / 🏀 / 👏 — a live floating tally on the spectator screen (never on the scorer, never touches the score). Basketball's crowd energy, digitised. Rate-limited, anonymous, purely presence — the "312 watching · 🔥 41" line. Makes a watched game *feel* watched.

4. **Instant league / bracket setup (schools & fests).** A **tournament** wrapper over matches: create a league or single-elim bracket in under a minute (name it, add teams, pick 5×5 or 3×3 preset), and every scored match auto-feeds a **live standings / bracket page** — points, W-L, point-differential tiebreak, top-scorer leaderboard across the tournament. This is the single biggest *institutional* adoption lever: an inter-college fest or a school's inter-house championship runs its whole event on one shareable bracket link. Roster-less teams still rank; brackets update the moment a final locks.

5. **Player milestones & season card.** The engine already derives milestones for the signature layer; surface them as a **per-player profile** that persists across a tournament — points, threes, best game, milestone badges (`First 20-point game`, `Buzzer-beater`). At season/fest end, each player gets a shareable **season card**. For universities this is the retention hook — students come back to see their own stat line, and coaches get a real leaderboard nobody else offers at the grassroots.

**ICP discipline:** every feature above rides the existing engine derivations and the black-shell share card — no new colour, no new heavyweight surface, nothing that gates the 15-second gully start. They are the *watch-and-spread* layer sitting on top of a scorer that still opens with "name two teams → Start."
