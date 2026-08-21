# ScoreEasy — Kho-Kho LIVE / SPECTATOR SCREEN + Innovations

**Date:** 2026-07-26 · **Status:** DESIGN (feeds the build; no code yet) · **Scope:** the lean-back watch experience built AROUND the hero board — feed, momentum, now-cards, signature-moment animations, the interactive tracking layer, and the adoption features that make a school/university switch.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · flat-black hero, one hard offset shadow, mono tabular numerals, **green = live / chasing / lead only** — NO new colours.
**Lineage:** ports the cricket spectator surface (`cricket-spectator-clean.html`: capsule tabs, black dual-team hero, collapsible momentum `<details>`, `.now-card` rows, key-moments feed, presence footer) and the cricket shot-tracking sheet (`cricket-shot-tracking.html`: optional on-demand spatial capture, court-type chips set once at match start, tap-to-place, `Skip`/`Save`, "feeds the wagon wheel" note). Kho-Kho keeps every frame; the "ball" becomes the **OUT**, the "wagon wheel" becomes the **Chase Map**, and the free derivation becomes the **Survival Timeline**.

> **Reading note:** this doc consumes `main-scoreboard.md` (the hero), `scorer.md` (the operator), `research.md` (the evidence). It does **not** re-litigate the hero — it wraps it. Point values are **league-preset only and flagged**; confirm against the current season's rulebook at build, never hardcode (research §1.3).

---

## 0. The one design decision this doc makes

**The spectator screen is the hero board PLUS three derived layers and one optional capture — never a denser dashboard.** Research §5.2 proves the highest-value Kho-Kho tracking (survival timeline, dream-run tracker, batch tension, turn-takeover compare) needs **no data the OUT log + clock don't already give.** So the whole live screen is built from events the scorer already logs; the *only* new manual input on the entire surface is the **optional Chase-Map tag-spot** (§3), which mirrors exactly how cricket's wagon wheel is the one optional spatial capture bolted onto an otherwise-derived scorecard.

> Everything a spectator reads is free (derived from OUT + clock). The one thing that costs a tap is optional, on-demand, and skippable — precisely cricket's bargain.

---

## 1. Live screen layout — balanced detail, tabs

### 1.1 Tab structure (capsule segmented, verbatim from `cricket-spectator-clean.html .tabs`)

`[ Live ] [ Scorecard ] [ Stats ] [ Chase Map ]`

- **Live** (default) — the hero board + the richer watch context below. This section.
- **Scorecard** — the turn-by-turn record (`Turn 1: 14–1 · Turn 3: 10–3 · …`), per-chaser tag counts, per-defender survival table. The dense stuff kept OFF the board (`main-scoreboard.md §4`).
- **Stats** — cumulative player/team leaders (most outs, longest dream run, best survival %).
- **Chase Map** — the interactive tracking layer (§3), only present when the operator captured any tag-spots; otherwise the Survival Timeline stands alone here.

### 1.2 Live tab — vertical order (top → bottom)

1. **Top bar** — back · "Inter-School Cup · Final" · `●LIVE` · share ↗ (mirrors `.hdr`).
2. **The hero board** — imported wholesale from `main-scoreboard.md §2.2` (fuller state): two cumulative totals, big turn clock, green wash + `ATTACK` on the chaser, `● ● ○` defender dots, dream-run tension band, final-turn chase equation. This is the co-hero; nothing here is re-specified.
3. **Team scores shown SIMPLY** — directly under the hero, a one-line per-turn ledger so the cumulative total is legible as a story, not a mystery number:
   `WARRIORS  14 · — · 10 · —   =31   ·   PANTHERS  1 · 16 · — · 2   =26`
   (each team's four turn-deltas + the running sum; the current turn's cell pulses). This is the "simple score" the task asks for — the totals broken into their turns, no more.
4. **Momentum** — collapsed `<details>` (cricket's `.mom-d`), **outs-per-minute bars across the current turn** (see §1.3). Summary line carries the turn's out-rate vs the opponent's chase turn.
5. **Now-cards** — the live actors (see §1.4): the active chaser with tag count, and the on-mat batch of 3 with live survival timers.
6. **Key moments feed** — the drama log (see §1.5).
7. **Presence footer** — `👁 312 watching · 🔥 41` + a `Following ✓` pill (mirrors `.pres`), extended with spectator reactions (§4).

### 1.3 Momentum — "outs / minute", the Kho-Kho analog of runs/over

Cricket's momentum is runs-per-over bars. Kho-Kho's turn is a **race against the clock**, so the momentum unit is **outs logged per minute of the current chase turn** — a bar per minute, `.hi` (green) on a hot minute (3+ outs), `.wk` (danger-tint) on a barren minute (0 outs = defenders surviving), `.now` (dashed) on the minute in progress. The summary line compares chase turns: `THIS TURN 10 outs / 7:00 · vs PANTHERS' 16`. Same `<details>` collapse so it never crowds the glance.

Defender-team momentum (survival) is the *inverse* read: a barren bar column = a dream run building — which is where the eye should go, and where §2's gold moment fires.

### 1.4 Now-cards (mirrors `.now-card` rows)

Two stacked cards, `.row`-grid, mono figures:

```
┌──────────────────────────────────────────────┐
│ CHASING · WARRIORS                       OUTS │  ← .row.head
│ ● Sanket K. (active)                        3 │  ← green dot = active chaser
│   Kho chain: 4 handoffs this turn             │  ← .psh sub-line (optional stat)
├──────────────────────────────────────────────┤
│ ON MAT · PANTHERS               SURVIVING     │  ← .row.head
│ R. Kashyap                         2:38  ▲    │  ← live climbing timer; ▲ near threshold
│ A. Singh                           1:12       │
│ M. Das                             0:47       │
└──────────────────────────────────────────────┘
```

- **Active chaser** row: name + live tag count ("3 outs this turn") — the broadcast lower-third (research §2.2), here as a card not on the board.
- **On-mat batch** rows: the 3 current defenders with **live survival timers** climbing toward 3:00; the longest gets a `▲` warning glyph as it nears threshold. This *is* the batch-of-3 turn-tension viz (research §5.2 item 3) in card form — the derived "how close is this batch to falling."
- League preset adds a Wazir marker on the differently-jerseyed attacker and a `POWERPLAY` chip when two are active.

### 1.5 Key moments feed (mirrors `.moment`)

Time-stamped (turn-clock, not over) drama log, newest first:

```
T3 2:38   ★ DREAM RUN — Kashyap survives 3:00 unbroken · Panthers +1
T3 3:05   OUT — Das tagged by Sanket K. (pole) · batch 2/3 down
T3 4:12   LONA! Warriors clear the full side — order recycles
T2 1:20   TURN TAKEOVER — Panthers now chasing
```

Colour grammar borrowed verbatim: dream run / milestone in green-gold `<b>`, OUT/LONA danger-tint `.wkt`-style, plain beats in ink. The feed is the narrative spine the shareable card (§4) is generated from.

---

## 2. Signature moments — tokenized, reduced-motion-gated

Each is a **drama beat worthy of one animation**, drawn from the hardness budget (`main-scoreboard.md §5`: ≤1 gold · ≤1 glow · ≤1 inversion · ≤1 pulse per screen). Every animation is **tokenized** (uses design tokens, no new colour) and **gated by `prefers-reduced-motion`** — reduced-motion always collapses to a static stamp/instant state change, never a removed signal.

| # | Moment | Trigger (derived) | Animation (motion) | Reduced-motion fallback | Restraint |
|---|--------|-------------------|--------------------|-------------------------|-----------|
| **1** | **Dream-run threshold — THE marquee** | on-mat survival timer crosses **3:00** (league) / prestige mark (college), and every **+30s** after | the **one gold card** rises over the tension band, `--se-blend-gold` 2px + 3px ink offset, ~500ms ease-out; sentence in sans ("Great run — 3:04 unbroken."), figures in mono ("184s · Kashyap") | card appears instantly, no rise; identical content | **one gold per screen**; re-crossings replace, never stack |
| **2** | **Turn takeover / role swap — the identity beat** | turn clock hits **0:00** → swap confirmed | the green `--se-blend-green-wash` + `ATTACK` badge **slides** from old chaser to new across the hero, ≤600ms | wash + badge **cut** to the new chaser instantly | the one accent *moving* IS the turn-based identity; no other element animates during the slide |
| **3** | **Lona / all-out — bragging-rights peak** | last defender of the side out **before** clock ends | a distinct `LONA` **stamp** flashes in the feed + a brief ink glow on the chaser total, ~400ms | static `LONA` stamp in the feed, no glow | spends the **≤1 glow**; no colour persists (Lona = prestige, no points college) |
| **4** | **Final-turn chase equation — the tension band** | `currentTurn.index == turnsTotal` AND result mathematically in reach | the hero chase-line `NEED 4 · 1:47 LEFT` **colour-climbs** neutral → `--se-color-danger-soft` in the closing 60s; the `NEED` figure pulses on each OUT | colour state set by remaining time, no pulse | a colour band, not a motion piece; the closing-minute climb is the only escalation |
| **5** | **Sky Dive / Pole Dive (league) — +3 pop** | logged `outType ∈ {poleDive, skyDive}` | a `+3` **echo stamp** pops in the feed with the dive glyph, ~300ms scale | static `+3 · SKY DIVE` stamp | transient feed echo only; never touches the board slab |
| **6** | **Wazir / Powerplay (league) — momentum shift** | two Wazirs active simultaneously | a slim `POWERPLAY` **banner** slides over the now-card, ~400ms | static banner, present while active | shares the ≤1-pulse budget with LIVE by suppressing the LIVE pulse while shown |

**Global rule:** at most one of {1,3,6} fires visibly at a time; the feed queues the rest as static stamps. Signature ≠ noisy — the restraint is what makes the gold moment feel earned.

---

## 3. INTERACTIVE TRACKING INNOVATION — the Chase Map (Kho-Kho's wagon wheel)

### 3.1 What it is + why this candidate

Cricket's wagon wheel is an **optional, on-demand spatial capture**: after a boundary the operator *may* tap the ground to place the shot; skipped freely; ground-type set once at match start; feeds the batsman's zones. Kho-Kho's exact analog is **"where on the court did the tag land?"** — the **Chase Map**.

The court is the decisive difference from cricket. Cricket grounds vary wildly (round/oval/box/gully) so the cricket sheet needs shape chips + dimension presets. **Kho-Kho's court is standardized** — a rectangle with a central lane, cross-lanes, two poles, two free zones — so the "court-type" axis is a *format* choice, not a survey: **Traditional 9s (27×16, 8 cross-lanes) · School 7s (shorter, fewer lanes) · League Mat.** Chosen once at setup, reused every tag. Zones are then **auto-classified from the tap coordinates** — the operator never names a zone.

**Why the tag-spot over the heavier chase-path lane diagram (research §5.2 item 5):** a single tap is grassroots-viable; tracing the active-chaser's full kho-to-kho path is not. The tag-spot still yields the chase story (where a chaser is lethal, where a defender falls) at one-tap cost. The full path stays a FUTURE flag, exactly as cricket defers the ball-by-ball tap-to-place layer.

**The free layer stands without it.** Even if every operator skips the Chase Map, the **Survival Timeline (Gantt)** — one bar per defender across the turn clock, length = time survived, marked with the out-event and any dream-run threshold — renders from the OUT log alone (research §5.2 item 1). The Chase Map is the *optional spatial enrichment on top*, never a gate.

### 3.2 Capture interaction (how the operator taps it)

Triggered the same way cricket's is: **on a notable OUT** (or any OUT via the scorer's rare strip), a slim optional sheet slides up — the OUT is already logged and scored; this only *enriches* it, so dismissing loses nothing.

- **Single tap on the court** = the tag spot (a dot). Zone auto-derived: `POLE (near/far)`, `FREE ZONE`, `CENTRAL LANE`, or `CROSS-LANE n`.
- **Long-press** = a **dive tag** — the dot renders as a dive glyph; in league preset this pre-selects Pole Dive / Sky Dive (+3) by zone (a pole-zone long-press → Pole Dive; mid-court → Sky Dive), still operator-confirmable.
- **Optional two-tap** (`+ chase path` toggle) = tap the chaser's start/last-kho point, then the tag spot → draws the **chase line** (green), the wagon-wheel-style ray. Off by default; power users only.
- **`Skip`** (muted) / **`Save tag`** (green) — identical to the cricket sheet's actions. Skipping is frictionless and expected.
- **Court-type is NOT re-picked per tag** — set once at match setup (Traditional 9s / School 7s / League Mat), shown as a read-only label on the sheet.

### 3.3 How it feeds stats + the live visualisation

| Capture | Feeds player/team stats | Feeds live viz |
|---------|-------------------------|----------------|
| Tag-spot zone | per-chaser **tag-zone profile** ("Sanket: 60% pole, lethal near-pole"); per-defender **fall-spot** | dots accumulate on the Chase-Map court; a chaser filter isolates one attacker's kills |
| Dive flag | per-chaser dive count; league +3 attribution | dive glyph on the court + `+3` feed echo (§2 moment 5) |
| Chase path (opt) | avg chase distance per out | green rays on the court, wagon-wheel read |
| Survival (derived, no tap) | per-defender survival time, dream-run threshold crossings | **Survival Timeline Gantt** — the primary derived layer, always present |

Team roll-up: a **court heat read** ("Warriors dominate the near-pole; Panthers survive the free zones") and the Gantt together answer *who lasted, who fell, and where* — the cross-turn compare that decides a Kho-Kho match.

### 3.4 Wireframe — Chase Map capture sheet (ports `cricket-shot-tracking.html`)

```
┌──────────────────────────────────────────────┐
│  Where was the tag?              [ Optional ] │  ← .sheet-head
│  OUT · Das tagged by Sanket K. · tap the court│  ← .sheet-sub (green verbs)
│  ──────────────────────────────────────────   │
│  Court:  ● Traditional 9s   (set at match start)│ ← read-only label, not chips
│                                                │
│   FAR POLE ○───────────────────────────         │
│   ┌────────────────────────────────────────┐   │
│   │  · free zone ·                         │   │  ← tap-to-place court schematic
│   │  ├─┬─┬─┬─┬─┬─┬─┬─┤  ← 8 cross-lanes     │   │
│   │  ═══════════ central lane ═══════════   │   │
│   │            ✕ (tag spot)                 │   │  ← single tap = dot
│   │  · free zone ·                         │   │
│   └────────────────────────────────────────┘   │
│   NEAR POLE ○───────────────────────────        │
│                                                │
│  Tap = tag spot · long-press = dive · +path ▢  │  ← .hint
│  ◾ tag   ◈ dive   ─ chase path                 │  ← .legend
│  ┌──────────┐  ┌────────────────────────────┐  │
│  │   Skip   │  │        Save tag            │  │  ← .actions (skip muted / save green)
│  └──────────┘  └────────────────────────────┘  │
│  Court format set once at match start. Tags feed│
│  each chaser's zones + the Survival Timeline.   │  ← .note
│  Full chase-path animation comes later.         │
└──────────────────────────────────────────────┘
```

### 3.5 Wireframe — Chase Map tab (the live visualisation)

```
┌──────────────────────────────────────────────┐
│ CHASE MAP · Turn 3         [All ▾ chaser filter]│
│  ┌────────────────────────────────────────┐   │
│  │ FAR POLE ○   ◈        ✕                 │   │  ← accumulated tags; ◈ = dive
│  │  ═══════════ central ══════ ✕ ✕ ═════   │   │
│  │        ✕            ◈                    │   │
│  │ NEAR POLE ○   ✕ ✕ ✕ (cluster)           │   │  ← Sanket's near-pole kill zone
│  └────────────────────────────────────────┘   │
│  Sanket K.: 5 outs · 60% near-pole · 2 dives   │
│  ──────────── SURVIVAL TIMELINE ───────────    │
│  Kashyap  ████████████████████★ 3:04  (survived)│ ← Gantt: length=time, ★=dream run
│  Singh    ██████░ 1:12  (OUT · central)         │
│  Das      ███░ 0:47  (OUT · near-pole)          │
│  0:00 ────────── turn clock ───────────── 7:00  │
└──────────────────────────────────────────────┘
```

The Gantt (bottom) is **always present** (free derivation); the court map (top) is **present only if tags were captured**. That split is the whole innovation: guaranteed drama for free, richer spatial story when someone bothered to tap.

---

## 4. ADDITIONAL FEATURES — what makes a school/university adopt us

Underserved games (research §4: stadium hardware OR two-number counters, nothing between). These are the "missing middle" hooks — inventive but ICP-realistic for an Indian PT teacher / student on a cheap Android over WhatsApp, offline-tolerant.

1. **WhatsApp turn-story card (the share loop).** At every turn-end and at match-end, auto-generate a share image from the feed: the `31–26` scoreline, the four turn-deltas, and the match's single most-shareable beat ("Kashyap's 3:04 dream run sealed it"). One tap → WhatsApp/status. This is the growth engine — every match a school plays advertises the tool to the next school. No incumbent produces a grassroots share artifact (research §4).

2. **One-tap tournament / league setup.** Spin up an inter-school or inter-house tournament in one screen: add teams, pick pool or knockout, and the app auto-computes **standings with the real league math** (win 3 · tie 2 each · loss-by-<3-margin earns 1, research §1.3) and a live bracket. Each match gets its own shareable live link. Turns the tool from a single-match counter into the thing that runs the whole sports day — the reason an athletics teacher standardizes on it.

3. **Scan-to-watch QR poster.** The scorer generates a printable QR poster ("Scan to watch live") to tape on the ground/notice board. Parents and students scan → the read-only spectator board on their own phone, no app install. Turns a bystander crowd into a live audience and drives the watching-count that feeds reactions — the grassroots substitute for a broadcast.

4. **Spectator reactions (the crowd, lightweight).** On the read-only board, tap-to-react (🔥 / 👏 / a Kho-Kho "dream-run cheer") with a live count (extends the `.pres` footer `🔥 41`). Reactions **spike visibly during a survival run**, giving the dream run a crowd roar it never had at grassroots. Zero moderation surface, no accounts — an anonymous tap.

5. **Auto player-milestone cards.** The app watches the derived log and fires a gold milestone card (§2 grammar) on real achievements: "50th career out," "longest dream run of the tournament (3:41)," "most outs in a turn (7)." Each is shareable (feature 1) and accretes a lightweight per-player history across matches — the recognition layer that makes students *want* to be scored, and coaches keep the app between seasons.

**Selection rationale (ICP-realistic):** every feature runs on one cheap phone, tolerates offline, needs no login, and rides WhatsApp — the channels Indian schools already live in. None require the stadium hardware, video arbitration, or wired setup the federation-grade competitor assumes (research §4). The share loop (1) + tournament setup (2) are the two that convert a single curious teacher into a whole institution's default scorer.

---

## 5. Hardness budget (rubric, verbatim)

Per screen: **1 hard shadow · 1 ink frame · ≤3 soft surfaces · ≤1 gold · ≤1 glow · ≤1 inversion · ≤1 live pulse.** The live screen spends its inversion on the black hero (imported), its shadow on the hero offset, its **one gold** on the dream-run milestone (§2.1), its **one glow** on Lona (§2.3), its **one pulse** on LIVE (yielded to Powerplay when active). The momentum bars, now-cards, feed, Chase Map, and Gantt are all flat soft surfaces or hairline strips — no second accent, green stays the only colour and only on the chaser. The Chase-Map capture sheet is a separate surface with its own budget (one green Save action, one ink frame), exactly like the cricket shot sheet.
