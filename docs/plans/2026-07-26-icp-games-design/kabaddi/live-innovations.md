# ScoreEasy — Kabaddi LIVE / SPECTATOR + Signature Moments + Raid Tracking

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the watch experience) · **ICP:** Indian college / university / school / ground.
**Design system:** design1-mono (brutalist record × HiFi-soft) · tokens verbatim from `src/index.css` — **no new colours**.
**Pattern inheritance:** cricket spectator (`cricket-spectator-clean.html` — dual-team black hero, capsule tabs, collapsible momentum `<details>`, now-card, key-moments feed, presence footer) + cricket shot-tracking (`cricket-shot-tracking.html` — optional on-demand tap-to-place, ground-type-aware, "set once at match start", "feeds the wagon wheel", `Skip / Save` actions). *The record is brutalist; the conversation is soft.*

> **The one law of this screen.** The **hero board is the record** (score · 7 dolls/side · raid clock — from `main-scoreboard.md` State B) and it carries **only those five facts**. Everything richer — the raid feed, momentum, the now-on-mat cards, reactions, the raid-map — lives **below the hero, under tabs**, and is a *conversation the viewer opts into*, never clutter on the board. A spectator who glances gets score + all-out proximity + raid time; a spectator who leans in gets the whole match. Same engine bindings as the scorer and the compact board — this surface never invents data.

---

## 1. Live screen layout — hero + simple scores + richer context (tabbed)

Portrait, `max-width:390px`, `--se-*` tokens only. Vertical order top→bottom. The hero and tabs are pinned feel; everything under the tab row scrolls.

### 1.1 The shell (three fixed zones + a scrolling body)

```
┌───────────────────────────────────────────────┐
│  ‹        Sunday Cup · Semi-final       ● LIVE ↗│  ← 1. topbar (title + live + share)
├───────────────────────────────────────────────┤
│  ████  STATE-B HERO BOARD (the record)  ████   │  ← 2. hero (main-scoreboard §2 State B)
│   RAIDERS ▸RAID        30ring        SULTANS    │     five facts ONLY:
│     38          (raid ring)            31       │     scores · 7 dolls/side · raid clock
│   ● ● ● ● ● ○ ○            ● ● ● ● ● ● ●        │     · RAID ▸ · one context line
│   5 ON MAT                    7 ON MAT          │     + quiet star chips (Super-10/High-5)
│   ★R P.Narwal 9        ★D F.Maghsoudi 4         │
│               H1 · 08:12                         │
├───────────────────────────────────────────────┤
│   ( LIVE )   RAID MAP   SCORECARD   INFO        │  ← 3. capsule tabs (segmented, pinned)
├───────────────────────────────────────────────┤
│                                                 │
│   [ scrolling tab body — see §1.3 ]             │  ← 4. scroll region
│                                                 │
└───────────────────────────────────────────────┘
```

- **Topbar** — back · match title + `● LIVE` dot (danger red, mono) · share `↗`. Mirrors cricket spectator header.
- **Hero** = State B from `main-scoreboard.md`, verbatim: huge mono scores (active side green), a raid **countdown ring** (warning-flash `≤5s`), the two **animated 7-doll rows** (dim-on-out / re-light-on-revive — the always-on emotional micro-beat), `RAID ▸` green wash on the raiding side, the two quiet **star chips**, and the ONE context line (`H1 · 08:12`, escalating to `DO-OR-DIE` / `ALL OUT`). **Nothing else touches the hero.**
- **Tabs** — capsule segmented (cricket's `.tabs`): **LIVE · RAID MAP · SCORECARD · INFO**. LIVE default. (RAID MAP replaces cricket's "Stats" slot — it is the kabaddi spatial layer, §3.)

### 1.2 Balance principle — simple by default, depth one tap down

The **basic team/player scores are shown SIMPLY**: they live in the hero (team scores) and in the LIVE tab's slim now-cards (top raider/defender lines). The **richer context is deliberately demoted**: momentum is collapsed behind a `<details>` toggle (opens on tap, exactly like cricket's `mom-d`); full per-player splits are a whole tab away (SCORECARD); analytics is its own tab (RAID MAP). No spectator is ever forced to read a table to know who's winning.

### 1.3 The LIVE tab body (the default scroll)

Four blocks, in weight order, all below the hero:

**(a) NOW ON THE MAT — the two slim now-cards** (kabaddi's analog of cricket's batters+bowler `now-card`). Answers "who's on the mat right now that matters":
```
┌─ NOW ─────────────────────────────────────────┐
│ RAIDING   ● P. Narwal      RAID PTS 9 · SR 71% │  ← current raider (green dot), live tally
│ ───────────────────────────────────────────── │
│ DEFENCE   F. Maghsoudi (R-corner) · 4 tackles  │  ← key defender / corner in play
│ On mat  RAIDERS 5  ·  SULTANS 7                 │  ← plain mat-strength restatement (a11y)
└────────────────────────────────────────────────┘
```
Mono rows, cricket `.row` rhythm. Green dot = the man currently raiding. Updates every raid; no history here.

**(b) MOMENTUM — collapsed `<details>`, "points per 2-min" band.** Kabaddi's momentum is not runs/over; it is **raid pressure over time**. Bars = net points swing per rolling 2-minute window (or per 5-raid block), coloured `--primary` for the team ahead in that window, `--se-color-danger` tint for an all-out window. A dashed `now` bar for the in-progress window (cricket's `.bar.now`). Header line: `RAIDS 41 · ALL-OUTS 2` instead of RRR/CRR. Collapsed by default — depth for those who want it.

**(c) RAID FEED — the key-moments feed** (cricket's `.moment` list, one entry per notable raid, newest first). This is the game log made *readable* (research §4 gap: nobody produces a readable record). Each row: raid-clock stamp + plain-English line, event word coloured:
```
KEY RAIDS
08:12   SUPER RAID  Narwal ×3 — bonus + 2 touches, Blue → 4
07:40   ALL OUT     Sultans emptied — Raiders +2, mat re-set 7–7
06:55   SUPER TACKLE  R-corner stops Narwal (3 on mat) — +2
06:20   DO-OR-DIE ✗   empty raid — Sultans +1
```
`SUPER RAID / SUPER TACKLE / SUPER 10 / HIGH 5` in `--primary`; `ALL OUT / DO-OR-DIE ✗ / OUT` in `--se-color-danger`. Only *notable* raids surface here (empties collapse); the full raid-by-raid is in SCORECARD.

**(d) PRESENCE + REACTIONS footer** (cricket's `.pres`): `👁 312 watching · 🔥 41` + a `Following ✓` pill, plus the tap-reactions rail (§4.C).

### 1.4 The other three tabs (thin, honest)

- **RAID MAP** → the spatial layer (§3): the raid-outcome heatmap always available; the tap-to-place raid-path map shown when Power-mode capture was on.
- **SCORECARD** → the real record: per-player raid pts / bonus / tackle / super-raid split, Super-10 & High-5 badges, all-out timeline, points-by-type, plain-language result. (The research §4.5 gap — the readable scorecard that doesn't exist today.)
- **INFO** → teams, rules preset in play (half length, do-or-die trigger, bonus rule, super-tackle value), venue, referee. Static.

---

## 2. Signature moments — the drama beats worth a tokenized, reduced-motion-gated animation

Every animation is **token-only** (`--se-*`; green=live/lead, gold=the single all-out moment, danger/warning=escalation), **one-at-a-time** (never two banners stacked), **auto-fired by the engine** (the scorer taps an outcome; the beat plays on the spectator surface), and **fully gated by `@media (prefers-reduced-motion: reduce)`** — under which each beat degrades to a *static token-swapped chip* (no sweep, no pulse, just the coloured word appearing). Restraint is the point: these punctuate; the always-on doll dim/re-light carries the emotion between them.

| # | Moment | Trigger (engine event) | The animation | Restraint / gating |
|---|---|---|---|---|
| **1** | **ALL OUT** — the peak | `ALL_OUT {side,+2}` (a side hits 0 on mat) | Full-width **gold** banner `ALL OUT · +2` slides over the hero; the emptied side's **7 dolls re-light in a left→right sweep** (~600ms); score ticks +2. Then hero returns to calm. | **The ONE gold moment** (`--se-blend-gold`), max one on screen ever. Reduced-motion → static gold chip `ALL OUT · +2`, dolls snap full, no sweep. |
| **2** | **SUPER RAID** (≥3 in one raid) | `SUPER_RAID {raider,pts}` | `--primary` chip `SUPER RAID ×3` pulses up from the raider's star chip; the defenders' dolls that went out **cascade-dim in sequence** (not all at once) to show the multi-out. ~450ms. | Lighter than all-out — a pulse, not a takeover. Often *precedes* an all-out (research §5.1) so it must yield: if all-out fires in the same raid, super-raid plays first, then gold. Reduced-motion → static `SUPER RAID ×3` chip. |
| **3** | **DO-OR-DIE** resolve | pre: `DOD_ARMED`; resolve: `DOD_CONVERT` / `DOD_FAIL` | **Pre-raid:** raiding panel band swaps to `--se-color-warning-soft`, context line → `DO-OR-DIE · 3RD EMPTY` (a held state, not motion). **Resolve:** convert = brief green success pulse on the score; fail = `--se-color-danger` pulse + `+1` flies to the opponent. | The pre-warning is a *state hold* (no animation) so the tension sits. Only the resolve animates, ~300ms. Reduced-motion → band + word only, no pulse. |
| **4** | **SUPER TACKLE** (≤3 defenders, +2) | `SUPER_TACKLE {side,+2}` | `--se-color-danger`-tinted chip `SUPER TACKLE · +2` pulses from the defending panel; the raider's doll dims with a short shake. ~350ms. Defence's celebration — **never green** (a man went out). | Restrained tag pulse. Reduced-motion → static danger chip. |
| **5** | **SUPER 10 / HIGH 5** milestones | `MILESTONE_SUPER10 {raider}` / `MILESTONE_HIGH5 {defender}` | The relevant **star chip** on the hero flips to a filled state with a single `--primary` ring-pulse + a one-line `SUPER 10 · P. Narwal` stamp under the hero for ~2s. | The quietest beat — a chip state change, not a banner. Reduced-motion → chip fills, no pulse. |

**Always-on micro-beat (not a signature moment, the connective tissue):** the doll **dim-on-out / re-light-on-revive** transition (~180ms opacity+scale) on every single raid. This is the cheap emotional heartbeat that makes the mat feel alive between the five banners; it too is reduced-motion gated (snap, no transition).

**Firing discipline:** a queue, never a stack. If multiple events resolve on one raid (e.g. super-raid → all-out), they play in engine-lock order (research §1.2: touch pts → roster → all-out) one after another, ≤2 beats total, gold always last.

---

## 3. INTERACTIVE TRACKING INNOVATION — the Kabaddi wagon-wheel: Raid-Path & Mat-Position map

Cricket's signature interactive data is the **wagon-wheel** (tap-to-place shot direction). Kabaddi's analog — completely unbuilt at grassroots (research §4.6, §5.2) — is **raid-path / mat-position tracking**: on a stylised mat, capture *where the raider attacked* and *which defensive zone was tagged (or made the tackle)*. Two tiers ship together, exactly mirroring the cricket decision:

- **Tier 1 — Raid-outcome heatmap (FREE, always on, launch).** No extra capture. Derived from data the resolver already stores (raider × outcome, defending-zone × outcome). This is the "kabaddi has analytics too" hook, shipped like cricket's momentum band.
- **Tier 2 — Raid-path capture (optional, on-demand, tap-to-place, Power-mode).** The true wagon-wheel. An **optional post-raid step** — never on the hot path, never blocks a resolve. The raid model already carries the fields (`attackZone`, `tackleZone`, `path`); capture is off by default and toggled by *Track raids* in the scorer caption (mirrors cricket's *Track shots*).

### 3.1 The mat is court-type aware (the ground-type analog)

Cricket's tracker is ground-shape aware (round / oval / box / gully, set once at match start). Kabaddi's spatial surface is **mat-type aware**, set once at setup:
- **Standard mat (rectangle) — DEFAULT.** 13×10m, midline + two baulk lines + two bonus lines + lobbies. Covers the entire ICP (KIUG / SGFI / ground play — research §3.1). Defensive positions are the real named zones: **Left corner · Left cover · Centre (in/out) · Right cover · Right corner**, plus the two **lobby** strips.
- **Circle mat (future-flagged, disabled).** Circle/Punjab kabaddi is a *different game* (research §1.4, §4.7) — shown as a greyed, un-selectable chip so the surface reads "aware but out of scope", never half-built.

The mat-type chip row is identical UX to cricket's `.gt` ground chips.

### 3.2 The capture interaction (Tier 2 — optional, on-demand)

After a *scoring* raid (touch/tackle/multi/super), **if Track raids is on**, a slim optional sheet slides up (dismissible, `Skip`/`Save`, never modal-blocking — cricket shot-tracking pattern):

1. **Raider entry point** is pre-placed at the midline (like cricket's fixed batsman origin at the crease). The operator taps **where on the opponent half the raid reached** — one tap draws the raid path (midline → tap point), green if the raider scored, danger if tackled.
2. The tap **snaps to the nearest defensive zone** (corner/cover/centre/lobby) — the operator doesn't need pixel precision; the zone is the datum (like cricket snapping a shot to a scoring region). A one-line confirm: `Touch · Right corner · +1`.
3. **Tackle raids** invert: the tap marks **which zone made the stop** → feeds the defender/zone tackle map.
4. `Save` writes `{raidId, attackZone, tackleZone, outcome, path:[x,y]}` to the raid; `Skip` leaves it heatmap-only. Long-press = "chain/do-or-die" flavour (optional, like cricket's long-press "along the ground").

**On-demand & non-blocking guarantees:** default OFF; the resolve is already committed before the sheet appears (scoring never waits on it); every raid can be skipped; turning it off mid-match keeps Tier-1 heatmap alive. Zero risk to the un-fumble-able hot path.

### 3.3 How it feeds stats + the live visualisation

- **Per raider → Attack map:** direction tendency (where this raider scores — "78% right-side"), zone success %. The offensive wagon-wheel.
- **Per defender / per zone → Tackle map:** where this defence stops raids, weakest corner. The defensive heatmap ("Left corner leaks 60%").
- **Per team → Raid-outcome heatmap (Tier 1, free):** a CSS-grid `zone × outcome` matrix (touch / bonus / empty / out), cell colour by frequency — ships even with zero tap-to-place data.
- **Live viz:** the RAID MAP tab renders the stylised mat with accumulated raid paths (green scored / danger stopped, muted for older — cricket wagon `.hi`/`.mut` weighting); the all-out / super-raid **doll-row sweep (§2)** is the animated celebration payoff of this spatial data. Full mat-diagram *replay* animation is future-flagged (heavy) — launch ships the static accumulated map + the doll sweep.

### 3.4 Wireframe — RAID MAP tab (Tier-1 heatmap always; Tier-2 paths when captured)

```
┌───────────────────────────────────────────────┐
│  RAID MAP · P. NARWAL ▾            Optional     │  ← player picker; "Optional" eyebrow
│  Raids 14 · scored 71% · right-side 78%         │  ← derived headline (mono, green %)
│                                                 │
│  ┌── STANDARD MAT ─── CIRCLE (soon) ──┐         │  ← mat-type chips (circle greyed)
│                                                 │
│   ╔═══════════════ opponent half ═══════════╗   │  ← stylised mat SVG, tap-to-place
│   ║  L-corner    L-cover   R-cover  R-corner ║   │     zones labelled (mono, faint)
│   ║      \          |         /        /     ║   │     raid paths from midline:
│   ║       \         |        /        /      ║   │     green = scored (Tier-2)
│   ║        \        |       /       ✕        ║   │     danger ✕ = tackled
│   ║ ······· bonus line ····················· ║   │
│   ╠═══════════════ MIDLINE ══════════════════╣   │  ← raider origin (fixed, ● ink)
│   ║               ● raider                    ║   │
│   ╚═══════════════════════════════════════════╝   │
│   ◆ scored   ✕ tackled   · older              │  ← legend (cricket .legend)
│                                                 │
│  ── OUTCOME HEATMAP (always on) ──────────────  │  ← Tier-1, no capture needed
│           TOUCH  BONUS  EMPTY   OUT             │
│  L-corner  ███    ░     ░       █               │  ← CSS grid, cell colour = frequency
│  L-cover   ██     ░     █       ░               │
│  Centre    █      ░     ██      ░               │
│  R-cover   ███    █     ░       ░               │
│  R-corner  ████   ░     ░       █               │
│                                                 │
│  Tracking is optional & set at match start.     │  ← honest note (cricket .note)
│  Heatmap works from scores alone; tap-to-place  │
│  paths add the raid map. Circle mat = later.    │
└───────────────────────────────────────────────┘
```

---

## 4. ADDITIONAL FEATURES — what makes schools/universities adopt us (invented, ICP-realistic)

Five features, each a concrete adoption lever for the PT-teacher / student-volunteer / league-secretary persona (research §3.2, §4). All buildable on the same engine + share primitives; none adds hot-path friction.

**A. Shareable "Match Card" + live link (beats the WhatsApp-photo-of-paper incumbent).**
One tap `Share ↗` mints a **live link** (the State-B hero, read-only, auto-refreshing) *and*, at match end, a **1080×1080 Match Card** image: final score, the all-out timeline, top raider (Super-10 badge) + top defender (High-5), the raid-outcome mini-heatmap. This is the artefact a coach posts to the school group — the thing kabaddi has no dominant product for (research §4.4/§4.5). *Lever: zero-effort proof the match happened, branded ScoreEasy.*

**B. One-screen League / Tournament setup (the "run our inter-house" hook).**
A **bracket-in-5-taps** builder: name it, add teams (paste a list), pick knockout/round-robin, pick a rules preset (2×20 college / 2×10 school / 2×7 quick). Auto-generates fixtures; each match opens the scorer pre-filled; a **live standings table** (wins / all-outs for / score diff) updates as matches close. *Lever: a PT teacher runs the whole sports-day kabaddi event from one phone — the adoption unit is the tournament, not the match.*

**C. Spectator reactions + "raid-o-meter" (lightweight crowd energy).**
On the live link, viewers tap **🔥 (big raid) / 🛡 (great tackle) / 👏**; taps aggregate into the presence footer (`🔥 41`) and a live **raid-o-meter** that spikes on super-raids/all-outs. No login (rate-limited by device). *Lever: the bench and the crowd on their phones make a gully match feel broadcast; drives the live link's virality.*

**D. Player milestone badges + a shareable player card.**
The engine already tags **Super-10 / High-5 / Super-Raid**; surface them as collectable **badges on a per-player card** (season raid pts, best raid, tackle success %, all-outs caused). A student can share *their own* card. *Lever: individual recognition is what makes students bring the app back next match — the record follows the player, not just the team.*

**E. Paper-mode / offline-first resume (survives the dusty-ground reality).**
The scorer works **fully offline** (research §3.2: sun-glare ground, flaky signal); a match auto-persists locally and **syncs the live link + scorecard when signal returns**. A `Resume last match` card recovers an interrupted game exactly. *Lever: removes the #1 field-trust blocker — "what if my phone dies / there's no signal" — the reason paper still wins.*

*(A–B–E are the institutional adoption drivers — the tournament, the card, the reliability a school needs; C–D are the retention/virality drivers that pull students back.)*

---

## 5. One-paragraph synthesis

The Kabaddi live surface is the **State-B record hero + four tabs**: the hero carries only score · 7 dolls · raid clock (with the always-on dim/re-light doll heartbeat), and all richer context — slim now-on-mat cards, a collapsed points-momentum band, a *readable* raid feed, reactions — sits below it under **LIVE / RAID MAP / SCORECARD / INFO**, simple by default and deep one tap down. The signature beats are **ALL OUT** (the single gold banner + full-side doll re-light sweep), with **SUPER RAID, DO-OR-DIE, SUPER TACKLE, SUPER 10 / HIGH 5** as restrained token-only pulses, all engine-fired, one-at-a-time, reduced-motion gated to static chips. The wagon-wheel analog is the **Raid Map**: a free zone×outcome heatmap at launch plus an optional, on-demand, mat-type-aware **tap-to-place raid-path capture** (Power-mode, never blocking the hot path) that feeds per-raider attack maps and per-zone tackle maps. And the adoption wedge — the reasons a school or university actually switches off paper — is the **shareable Match Card + live link, one-screen tournament builder, spectator reactions, player milestone cards, and offline-first resume**.
