# Throwball — Live / Spectator Screen, Signature Moments, Tracking + Extra Features

**Status:** Design spec for the watch-experience built AROUND the hero board.
**Siblings:** `main-scoreboard.md` (the five-fact bug this wraps), `scorer.md` (the operator tool that feeds it), `research.md` (§2 volleyball-bug anatomy, §5 drama beats + spatial layer).
**Inherits:** cricket spectator (`../../2026-07-20-icp-games/cricket/cricket-spectator-clean.html` — flat-black dual hero, `hero-note` derived sentence, capsule tabs, `<details>` momentum, now-card, moments feed) + cricket shot-tracking (`../../2026-07-20-icp-games/cricket/cricket-shot-tracking.html` — optional "Where did it go?" tap-to-place sheet, court/ground-type awareness, feeds a spatial stat).
**One line:** The scorer is one tap per rally; the **spectator page is where that atomic stream becomes a watchable story** — momentum runs, set-point tension, a serve-zone heat grid, and moments worth sharing. It never adds a tap to the operator; every richer thing here is either *free from the point sequence* or *one optional tap gated behind roster mode*.

---

## 1. Live screen layout — hero + simple scores + richer context

The spectator page is a single scrolling column, `max-width: 390px`, that opens on the **Live** tab. It is the **State B flat-black hero** (`main-scoreboard.md` §2) with context layered *around* it — never inside it. Depth is managed by **three capsule tabs** so the Live tab stays lean and the density lives one tap away.

### Vertical order (Live tab)

```
┌─────────────────────────────────────────────┐
│  Inter-College Cup · Final          ● LIVE   │  header: title + live dot (danger)
│  [ Live ]   [ Scorecard ]   [ Stats ]        │  capsule tabs (segmented, on=ink)
│                                              │
│  ┌─────────────────────────────────────────┐│  ██ FLAT-BLACK HERO ██  (the board)
│  │ Madras          SETS 1 · 0      Chennai  ││  full names (sans), sets tally
│  │   8  ▸                            6      ││  GIANT inverse mono; leader=green ▸serve
│  │  25–22  ·  23–25  ·  8–6◦                 ││  set-box strip, inline finals, live=◦
│  │ ─────────────────────────────────────── ││  hairline
│  │   Match point — Madras serve for it      ││  hero-note (danger tint), the one sentence
│  └─────────────────────────────────────────┘│
│                                              │
│  ▸ Madras on a 6-point run          🔥        │  RUN BADGE (signature; §2.3, in-flow)
│                                              │
│  ▾ Momentum · points this set    Run 6 · 0   │  <details>, collapsed by default
│    ▁▂▃█████▂▁  (worm: who scored each point)  │    CSS-only bar strip, opens on tap
│                                              │
│  ┌─────────────────────────────────────────┐│  NOW-CARD — the "what's happening"
│  │  SERVE   Madras  ·  R. Iyer              ││  serving team + server (roster) / — 
│  │  THIS SET  to 11  ·  Madras need 3        ││  derived pace line ("need N")
│  │  LAST 5   M M C M M   →  Madras +3        ││  micro-run of last 5 points
│  └─────────────────────────────────────────┘│
│                                              │
│  KEY MOMENTS                                  │  feed (reverse-chron, capped ~8)
│  ● 8–6   Set point saved — Chennai dig       │
│  ● 6–6   Madras break a 4-point Chennai run  │
│  ● Set 2  Chennai take it 25–23              │
│  ● Set 1  Madras take it 25–22               │
│                                              │
│  ♡ 214 watching   👏 Cheer   ↗ Share          │  presence + reaction + share footer
└─────────────────────────────────────────────┘
```

### The three tabs (the detail-by-surface split)

| Tab | Owns | Why here |
|-----|------|----------|
| **Live** | Hero board + run badge + momentum worm (collapsed) + now-card + moments feed + reactions. | The lean lean-back watch. Everything glanceable, one screen, no scrolling required to read the score. |
| **Scorecard** | Per-set breakdown table (finals, durations, longest run per set), the result line when done, Player-of-the-Match. | The record. Read a fact off a row → brutalist chips/table, cricket `.blk` grammar. |
| **Stats** | Serve/throw **heat grid** (§3), set-point pressure (converted / saved), team run summary, per-player points (roster). | The spatial + derived story — the wagon-wheel analogue. Opt-in data lives here, absent gracefully when not captured. |

### Simple vs rich — the balance rule
- **The two big numbers and whose-serve are ALWAYS the loudest thing on screen** (the hero owns the single inversion + the one live pulse). A casual viewer who wants only the score reads it in <1s and never scrolls.
- **Everything below the hero is progressive:** the run badge only appears when a run exists; momentum is collapsed behind a `<details>` (cricket pattern) so it costs zero attention until tapped; the now-card is three quiet mono rows; the feed is capped at ~8 and auto-trims.
- **No stat, no per-player row, no heat grid on the Live tab.** Those are Stats/Scorecard. Live tab = board + the *story of the current run*, nothing that needs study.

### Blend law on the page (no new colours, per-screen budget)
- **One inversion** = the hero. **One live pulse** = the LIVE dot. **Zero gold** on any live tab (gold is the result card only).
- Green = live/lead only (leader numeral, run-badge accent, worm bar for the team on the run). A trailing side is never green, never red.
- Escalation tint is the ONLY state colour and it lives on the hero-note + run badge: neutral → set point `--se-color-warning-soft` → match point `--se-color-danger-soft`.
- Moments-feed dots and worm bars are mono/ink record marks, not decoration.

---

## 2. Signature moments — the drama beats

Each beat is a **tokenized, reduced-motion-gated** animation. Global gate: everything below is wrapped in `@media (prefers-reduced-motion: no-preference)`; under `reduce`, the *state still renders* (the tint, the badge, the banner) but with **no motion** — the information is never motion-dependent. Per-screen motion budget: **≤1 live pulse + 1 transient beat at a time** (never two animations running together). No confetti, no dark takeover on a point, no pulsing giant numerals.

| # | Moment | Trigger (engine event) | Animation | Restraint |
|---|--------|------------------------|-----------|-----------|
| 1 | **Set-point escalation** | `setPoint({team})` armed (team one point from set, win-by-2/cap aware) | hero-note fades in + numeral row tint climbs to `--se-color-warning-soft`; the flag word writes on. ~200ms, no loop. | Tint + one fade. No pulse, no glow. Disarms silently if the point is lost — no "saved" flash on the hero (that goes to the feed). |
| 2 | **Match-point banner** | `matchPoint({team})` armed | hero-note swaps to `Match point — {team} serve for it`, tint to `--se-color-danger-soft`, one 120ms emphasis scale on the note only. | The strongest live tint but still no pulse. One line, danger soft, never red-fill. Stacks over set-point? No — one flag at a time (match point supersedes). |
| 3 | **Point run / rally momentum — THE signature** | run length crosses threshold (**≥4** straight points to one team; re-fires at 5, 6, …) | **Run badge** slides in above the momentum block: `▸ {team} on a {n}-point run 🔥`; CSS-only slide + the crossed bar in the worm fills green. The badge is the emotional core no throwball tool has. | Appears only while the run stands; **auto-dismisses the instant the other team scores** (run broken → replaced by a quiet feed line `broke a 6-point run`). Slide only, no bounce. Threshold ≥4 so it stays rare and meaningful. |
| 4 | **Set won** | set completion (≥target AND lead≥2, OR cap) | hero freezes the set final into a set-box chip with a 220ms fill; hero-note shows `{team} take Set 2 · 25–23 · match level 1–1`; feed prepends the set line. | Chip fill + text. No celebration chrome on the live board — the *set* is a record event, not the result peak. |
| 5 | **Deciding / short-decider start** | new set begins with a different `target` (e.g. decider to 11) | context subtitle writes `SET 3 · TO 11` with a one-shot underline sweep; now-card `need N` recomputes to the new target. | Surfaces the target *change* explicitly (research §5.5) — the tension is "shorter set, every point heavier." Underline sweep once, then static. |
| 6 | **Side-out swing** (Federation / serve-shown only) | serving side broken after a serve run ≥3 | serve marker `▸/◂` does a single 120ms flip; small feed line `Chennai break serve`. | Federation-tier only (casual hides serve). Marker flip is the whole animation — no banner. |
| 7 | **Match won → result peak** | match completion (sets-to-win reached) | Hands off to the **result / POTM card** (separate surface): gold milestone, plain margin `Madras win 2–1 · 25–22, 23–25, 11–8`, POTM. This is the ONE gold + ONE glow of the whole product. | Lives on the result card, **never on the live board**. The live tabs carry zero gold. Reduced-motion → static gold card, no glow. |

**The discipline:** a beat earns animation only if it changes *what matters right now* (set/match point, a run, a set closing). Point-to-point score changes get score-pop + press physics only — never a signature animation, or the signatures stop meaning anything.

---

## 3. Interactive tracking innovation — Serve / Throw Zone Tracking

**The analogue:** cricket's wagon-wheel is a free, glanceable spatial story from one optional tap. Throwball's honest transplant is **where the winning throw or serve landed (or where the receiving fault happened)** on the opponent's half — the closest cousin to volleyball serve/attack zones and, per research §5, the single most defensible spatial layer for this game.

**Why it fits the ICP better than cricket's version:** the throwball court is a **fixed** 12.2 × 18.3 m rectangle with a **1.5 m neutral/free box** each side of the net — there is no ground-shape variance to chip through (round/oval/box/gully). So we drop cricket's ground-type selector entirely and replace it with a **zone-granularity preset** chosen once at setup. Court-type awareness here = *how finely the operator wants to place*, not *what shape the ground is*.

### Capture interaction — optional, on-demand, one tap, roster/Guided-plus only

- **Never on the default casual path.** Under Guided-casual the operator taps one point button and moves on — zero spatial tax (scorer.md §5). Zone capture appears **only when the match is in roster mode or the operator flips on "Track serves" at setup.**
- **On-demand, post-point:** when tracking is on, a scored point slides up a compact **"Where did it land?"** sheet over the primaries (mirrors cricket's post-boundary sheet). The operator taps the receiving half once → the zone lights → auto-saves and returns to scoring. **Skip is always right there** and one tap; a skipped point simply carries no zone (the score is already recorded, tracking never blocks it).
- **Zone-granularity preset (set once):**
  - **Simple (default)** — 6 zones: **Deep / Short × Left / Centre / Right** on the receiving half. One glance, one confident tap for a student volunteer.
  - **Grid** — 3×3 (9 zones) for a keener scorer; same tap, finer bucket.
  - **Free** — raw tap point (x,y) for federation/analyst use; buckets to the grid for stats but keeps the exact dot for a future shot-line render.
- **What is placed:** on a **won rally**, tap where the *winning throw/serve landed* (green). Optional long-press = **fault at receipt** (the receiving side dropped/faulted there — muted mark), so the grid also shows *where they got broken*. Neutral-box landings (the 1.5 m dead zone) are a distinct edge tap → logged as `out / dead`.

### Wireframe — the capture sheet (court-half, tap-to-place)

```
┌─────────────────────────────────────────────┐
│  Where did it land?                 Optional  │  title + Optional eyebrow (cricket grammar)
│  Point Madras · 8–6 · tap the receiving half  │  context: who scored, current score
│                                              │
│  [ Simple ]   [ Grid ]   [ Free ]            │  zone-granularity chips (set once, remembered)
│                                              │
│        NET ═════════════════════════          │  net at top of the receiving half
│   ┌─────────────┬─────────────┬─────────────┐ │
│   │  SHORT-L    │   SHORT-C   │   SHORT-R   │ │  ← 1.5 m box row reads as "short"
│   ├─────────────┼─────────────┼─────────────┤ │
│   │   DEEP-L    │   DEEP-C    │  ● DEEP-R    │ │  tapped zone fills green + dot
│   └─────────────┴─────────────┴─────────────┘ │
│        ┈┈┈┈ neutral / free box ┈┈┈┈           │  back line; edge tap = out/dead
│                                              │
│  Tap a zone · long-press = they faulted here  │  hint (cricket "long-press" affordance)
│  🟢 Winner landed   ◦ Fault at receipt         │  legend
│                                              │
│  ┌──────────┐            ┌─────────────────┐ │
│  │  Skip    │            │   Save zone  ›   │ │  Skip always one tap; Save auto on tap
│  └──────────┘            └─────────────────┘ │
│  Set once at match start. Feeds the serve     │  note: what it powers + what's deferred
│  heat grid & player zones. Shot-line          │
│  animation on the live feed comes later.      │
└─────────────────────────────────────────────┘
```

### How it feeds stats + the live visualisation

- **Per team & per player (roster):** each saved zone increments a bucket → **serve/throw heat grid** on the **Stats tab**: the same 6- or 9-cell court half, cells shaded by frequency, e.g. *"Madras: 72% of winning serves land deep-right · R. Iyer strongest deep-R (9)."* Fault-at-receipt marks build the mirror view: *"Chennai broken most in short-centre."*
- **Live visualisation (Stats tab, updates as taps land):** the heat grid is the headline; a small **"hot zone"** line rides the now-card only when a clear pattern emerges (`Madras hammering deep-right`) — never on the hero.
- **Free-from-the-stream companions (no tap, always on):**
  - **Momentum worm** — the who-scored-each-point bar strip (Live tab), runs encoded by colour; the run badge (§2.3) reads off the same array. Zero capture cost.
  - **Set-point pressure** — converted vs saved set points, pure from score+timestamp; shown on Stats. No tap.
- **Graceful absence:** if nobody tracked zones, the Stats tab shows momentum + set-point pressure and a single quiet line *"Serve zones not tracked this match"* — the page never looks broken for the casual majority.

### Sequencing (research §5 recommendation, kept)
1. **Ship first (free):** momentum worm + run badge + set-point pressure — universal, zero capture, unclaimed by any competitor.
2. **Ship second (opt-in):** serve/throw zone tap-to-place → heat grid, once rosters/Guided-plus exist.
3. **Later (federation):** per-player heat, Free-mode exact dots + shot-line animation on the live feed, rotation-position overlays.

---

## 4. Additional features to win schools & universities

Five features the underserved space lacks; each is inventive but ICP-realistic (a PT teacher, a student volunteer, a WhatsApp group, an inter-house/inter-college draw).

### 4.1 One-tap **League & Bracket** (the adoption hook)
Schools and colleges run **inter-house leagues and inter-college knockouts** on paper draws. Offer a **create-tournament** flow: pick format (round-robin / single-knockout / groups→knockout), add teams (just name + colour, no rosters needed), and every finished match **auto-updates standings and the bracket**. The result each scorer already produces flows straight into the table — no organiser retyping scores into a spreadsheet. *This is the difference between one teacher using us for one match and a whole department running its season on us.*

### 4.2 Spectator **cheer reactions + live presence**
The share link opens a live page with a **👏 / 🔥 / house-colour cheer** tap that floats a brief burst and a **"214 watching"** presence count (research §4: no throwball tool has live viewership at all). Reactions are ephemeral, rate-limited, and **house-tinted** so a crowd of Blue-House phones visibly "cheers" Blue. Turns a static WhatsApp score-text into an actual event the stands and absent parents share.

### 4.3 **Player milestones + auto Player-of-the-Match**
Derived, zero extra scorer work where possible. From the point stream + (optional) zone/fault tags: **most points won**, **clutch set-points saved**, **longest personal serve run**, **match-winning point**. Surface as small milestone cards in the feed (`R. Iyer — 9 winning serves, all deep-right`) and an **auto-nominated POTM** on the result card the operator can one-tap confirm. Gives students a personal record to screenshot — the thing that makes *players* pull their friends onto the app.

### 4.4 **Shareable moment cards** (auto-generated, WhatsApp/Insta-native)
At each signature beat — a 6-point run, a set win, match point, the final — auto-compose a **branded card** (mono record grammar, house colours, the exact score line) ready to share. The **result card** (`Madras win 2–1 · 25–22, 23–25, 11–8` + POTM) is the anchor; run/match-point cards are the in-match hooks. Replaces the incumbent's plain text-dump share (research §4) with something a student *wants* to post — organic distribution built into the drama.

### 4.5 **Cast / PA-announcer mode**
One tap casts the **flat-black hero** big to a projector, TV, or a second phone propped courtside — the filmable board (`main-scoreboard.md` State B) with the LIVE pulse and set/match-point flags, and **auto text call-outs** the PA reads (`Set point, Madras`, `Chennai break serve`). Gives a school hall a broadcast-grade scoreboard from a single phone, no OBS, no laptop — the "we look like a real tournament now" moment that sells a department.

---

**Net:** the live page turns the one-tap-per-rally stream into a watchable, shareable story — momentum and set-point tension *for free*, a serve-zone heat grid for one optional tap, drama beats that stay rare enough to matter, and a league/reactions/milestones/share/cast layer that makes a school or university adopt us for a whole season rather than a single match. Every richer thing is progressive, reduced-motion-safe, and never adds a tap to the scorer.
