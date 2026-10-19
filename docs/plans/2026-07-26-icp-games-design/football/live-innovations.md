# ScoreEasy — Football: THE LIVE / SPECTATOR SCREEN + SIGNATURE MOMENTS + INTERACTIVE TRACKING

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the watch experience) · **Game:** Association Football — Indian college / university / turf ICP.
**Design system:** design1-mono (brutalist shell × HiFi-blend) · **Governance:** `src/designs/design1-mono/BLEND-GOVERNANCE.md` (FROZEN).
**Grounds on:** `research.md` §2.2 (broadcast overlays + Sofascore/FotMob second-screen bar), §5 (drama beats + the interactive-tracking ranking), `main-scoreboard.md` (the hero this screen wraps), `scorer.md` (the ledger this screen reads), and the cricket exemplars `cricket/cricket-spectator-clean.html` (hero + tabs + momentum `<details>` + now-card + moments feed + presence footer) and `cricket/cricket-shot-tracking.html` (optional on-demand spatial capture, ground-type-aware, tap-to-place, Skip/Save).

**What this document is:** the definition of the *spectator surface* — the richer lean-back experience built **around** the main board. The board (`main-scoreboard.md`) is the glance; this is the *watch*. A friend props a phone on the sideline, a college crowd casts it to a laptop, a parent follows from home. It is the football twin of `cricket-spectator-clean.html`: same hero on top, same tab strip, same "the record is brutalist, the conversation is soft" split. Everything here **reads the honest event ledger the scorer captures** (goals+attribution, cards, subs, clock) and never demands pro-grade input the volunteer can't feed.

**The one law (restated for the read-side):** *we only ever show what the ledger honestly contains.* No possession %, no xG, no win-probability — the casual ledger can't feed them and faking them breaks the cricket win-prob discipline (`research.md` §5.2). Momentum is *derived from the event stream and labelled as derived*. Everything richer than the ledger allows stays out.

**No new colours.** `--se-*` / `--se-blend-*` only. Green = lead / live / primary. Escalation ladder (yellow→warning, red→danger) covers cards. Gold is reserved for the **final result card only** and never appears on a live surface.

---

## 1. Live screen layout — hero + simple scores + the richer context

The screen is a **single scrolling column, `max-width: 390px`**, exactly the cricket spectator frame. Top to bottom: header → tab strip → **the board hero** (borrowed from `main-scoreboard.md` State B, unchanged) → then the tab body. The hero is *always* mounted above the tabs — the score never scrolls away, exactly as cricket keeps `.hero` pinned above `.tabs` body. Below the hero, three tabs carry the depth so the default view stays calm.

### 1.1 Header + tab strip (ported grammar)

```
   ‹        SUNDAY CUP · FINAL          ↗       ← .hdr: back · title + ●LIVE · share
              ● LIVE
  ┌──────────┬───────────┬───────────┐
  │   Live   │  Timeline  │   Stats   │         ← .tabs capsule segmented (cricket)
  └──────────┴───────────┴───────────┘
```

Three tabs — **Live · Timeline · Stats** — the football rename of cricket's *Live · Scorecard · Stats*. `Live` is the default. The `↗` share icon in the header is load-bearing (see §4.1). The `●LIVE` dot is the same `--se-color-danger` pulse, reduced-motion gated, present only while the clock runs; it becomes a static `HT` / `FT` stamp otherwise.

### 1.2 The hero (borrowed, not re-drawn)

The **LIVE-screen hero from `main-scoreboard.md` §2 State B** renders here verbatim — full team names, ~5.5rem scoreline, centred `phase · clock`, green lead-wash behind the leading half, `⑩` short-handed rider, `+N` stoppage, and the single static **latest-goal caption** (`⚽ RASHFORD 67'`). This document does **not** restate the board; it consumes it. The board's discipline (four glance-elements, nothing more) is preserved — all richness lives *below* it in the tab body.

### 1.3 The `Live` tab — balanced default (the calm centrepiece)

The default tab is deliberately **not** the full timeline — it is a curated "what's happening right now" digest, three blocks, in this order:

**(a) Momentum bar — collapsed behind a `<details>` toggle** (cricket `.mom-d` grammar exactly). Summary row: `📊  MOMENTUM · pressure  —  derived`. Tap to expand a horizontal wave. This is FotMob's "attack momentum" ported (`research.md` §2.2, §5.2): a CSS-only bar, **derived purely from the event stream** (goal events, cards, recent-event recency weighting) and **labelled `derived`** so it never masquerades as tracked possession. Collapsed by default — momentum is a *feel*, not the headline. Full spec in §3.2.

**(b) NOW-card — "who's on the pitch, what just changed"** (cricket `.now-card` grammar). Football's honest analogue of cricket's *batters + bowler* card is a compact **two-line "in-form / last events" panel**, because the ledger doesn't track who has the ball:

```
┌─────────────────────────────────────────────┐  ← .now-card
│ SCORERS          MUN                    ARS   │  ← .row.head
│ ● Rashford 45',67'    2   –   1   Saka 30'    │  ← goal-getters both sides
│ ─────────────────────────────────────────────│
│ ON PITCH   MUN 11  ·  ARS ⑩10   (Ode 🟥 67') │  ← derived counts + last send-off
│ SUBS   ⇄ Bruno→Mount 70'  ·  ⇄ Saka→Ivan 74' │  ← last 2 subs, most-recent first
└─────────────────────────────────────────────┘
```

Every value is **derived** — scorers from goal events, on-pitch counts from send-offs+subs, no manual entry. It answers the three questions a spectator actually asks ("who scored, who's a man down, who came on") without pretending to know possession or shots.

**(c) KEY MOMENTS feed — the top 3–4, not the full timeline** (cricket `.moment` grammar). A curated highlight strip — goals and reds only, newest first, minute-stamped:

```
KEY MOMENTS
67'   ⚽ GOAL — Rashford (Bruno) · Man Utd lead 2–1
67'   🟥 RED — Odegaard 2nd yellow · Arsenal to 10
45'   ⚽ GOAL — Rashford header · 1–1 at the break
```

Goals render `.six`-green, reds render `.wkt`-danger — the same two-colour emphasis cricket uses for six/wicket. This is the *digest*; the exhaustive minute-by-minute lives one tab over. **A "See full timeline →" link** ends the block and switches to the Timeline tab.

### 1.4 The `Timeline` tab — the full record (the centrepiece interactive layer)

The complete **minute-by-minute vertical feed** — every goal ⚽, card 🟨🟥, sub ⇄, and clock milestone (KO / HT / FT / +stoppage), newest-first, each stamped with the match minute. This is football's spine and the primary interactive-tracking layer (`research.md` §5.2 — "SHIP — the centrepiece"). It doubles as the record and the undo-context. Full spec in §3.1.

### 1.5 The `Stats` tab — honest half-time/full-time panel

The broadcast stat-comparison panel (`research.md` §2.2) — but **only the rows the ledger can honestly fill**. Paired horizontal bars, home-left / away-right:

```
STATS                          MUN  ·  ARS
Goals                            2  ▓▓▓▓░░  1
Shots on target (goals)          2  ▓▓▓▓░░  1      ← = goals unless goal-location capture used (§3.3)
Yellow cards                     1  ░░▓▓▓░  2
Red cards                        0  ░░░░▓░  1
Subs used                        2  ▓▓▓░░░  1
Scorers                    Rashford×2   ·   Saka
```

Possession %, total shots, corners, fouls are **absent by design** — a greyed footnote reads *"Possession & shot stats need live tracking we don't ask a pitch-side scorer for."* Honesty over completeness. If the operator used the optional **goal-location capture** (§3.3), a mini pitch-map thumbnail appears here and expands.

### 1.6 Presence footer (ported)

The cricket `.pres` footer verbatim: `👁 312 watching · 🔥 41` on the left, a **Following ✓ / Follow** pill on the right. Ties into spectator reactions (§4.2) and the follow/notify feature (§4.4).

---

## 2. Signature moments — the drama beats worth a tokenized animation

Each beat below is a discrete, **reduced-motion-gated** animation, fired from a ledger event, `@media (prefers-reduced-motion: reduce)` collapsing it to an instant static state-change. All obey the rubric laws: **one pulse reserved for genuinely-live only, one gold element max (and none while live), nothing decorative moves.** Ranked by weight (`research.md` §5.1). Each specifies *trigger* and *restraint*.

### 2.1 THE GOAL — score-pop + goal takeover ★ SHIP

- **Trigger:** a `GOAL` event commits to the ledger for either side.
- **Animation:** the hero scoreline numeral **pops** (reuse cricket's score-pop — scale 1→1.18→1, ~380ms) as it ticks; simultaneously the whole spectator surface briefly becomes the **goal takeover** — a full-width caption swaps in over the hero for ~2.2s: `⚽ RASHFORD` (sans, large) · `67' · assist Bruno` (mono) · new scoreline `MUN 2 – 1 ARS`, then settles back to the normal hero + prepends the moment to the feed. This is the interactive/animated expression of drama beat #1 and the direct port of the broadcast goal caption (`research.md` §2.2).
- **Restraint:** green wash only, no confetti, no full-bleed fill; own-goal renders `⚽ OG · 67'` in muted ink (never celebratory, never credited to a player — §3.1). Basic ships; the hotter *screamer* variant is future-flagged.

### 2.2 THE LATE WINNER — escalated goal takeover ★ SHIP (as a flag on 2.1)

- **Trigger:** a `GOAL` event whose `minute ≥ 80` (or in stoppage `45+`/`90+`) **that takes or restores a lead** (changes the leader).
- **Animation:** the §2.1 takeover, escalated — the caption gains a `LATE` mono kicker and holds ~0.6s longer; the hero lead-wash sweeps in rather than cuts. Same green, same motion vocabulary, just *hotter timing*. No new colour.
- **Restraint:** only fires on a **lead-changing** late goal — a late consolation in a 4–0 game gets the normal §2.1 treatment. The escalation is earned by stakes, not just by the clock.

### 2.3 RED CARD / SEND-OFF — danger banner + short-handed flip ★ SHIP

- **Trigger:** a `RED` or derived second-yellow send-off commits; team `onPitchCount` drops.
- **Animation:** a **restrained danger-tinted banner** slides under the hero for ~2s — `🟥 ARSENAL DOWN TO 10 · Odegaard 67'` — while the board's `⑩` rider appears beside the team code (a single non-animated state-flip). Danger-tint = `--se-color-danger` at low wash, never a full-bleed red slab (governance "resting red = delete").
- **Restraint:** banner auto-dismisses; the *lasting* signal is the quiet `⑩` rider, not the motion. A yellow card gets **no** takeover — only a feed row.

### 2.4 HAT-TRICK / BRACE — one gold milestone card ★ SHIP (hat-trick) · flag (brace)

- **Trigger:** a player's derived personal goal tally reaches **3 in the match** (hat-trick) — brace (2) future-flagged as a lighter toast.
- **Animation:** **one gold milestone card** (the single permitted gold element, and permitted here because a milestone is a *result-adjacent* achievement, not the live board) slides up: human sentence in sans — *"Rashford with the hat-trick"* — and a mono figures line — `3 goals · 45' 67' 82' · 37 min`. One-gold-per-screen enforced: it cannot co-occur with the final result card.
- **Restraint:** own-goals excluded from the tally by construction (`scorer.md` §1.2); fires once per threshold crossing, never re-fires on a 4th goal (that's a feed row).

### 2.5 FINAL WHISTLE / RESULT — the designed end peak ★ SHIP

- **Trigger:** `End 2nd half` (or ET/shootout resolution) commits phase `FT`.
- **Animation:** the hero settles to static, the `●LIVE` becomes `FT`, and a **result card** takes the surface: plain-language margin — *"Man Utd won 3–1"* / *"Drew 2–2"* / *"Man Utd won 4–3 on penalties"* — both teams in mono with the **loser at `opacity: 0.55`** (draw = both full), a **Player of the Match** card, **3-up stat tiles** (goals · scorers · cards), and **Share / Rematch** CTAs. This is the one surface that wears gold (the result frame + PotM accent).
- **Restraint:** a draw is a **first-class finished result**, never a "still waiting" state (`research.md` §3.2). No pulse (match is over). Gold appears *only* now.

### 2.6 THE SHOOTOUT — per-kick reveal ◇ FUTURE-FLAG (functional grid ships)

- **Trigger:** `More → Penalty shootout` surface, each kick `scored`/`missed`.
- **Animation (deferred):** each kick dot fills with a short reveal (●=scored green, ○=missed muted) as it's tapped, sudden-death tension building. **Ships first as a static functional grid** (`scorer.md` §3.4); the animated reveal is future-flagged (`research.md` §5.1).
- **Restraint:** shootout goals never touch the scoreline or personal tallies — the reveal is celebratory only, over a separate surface.

**Motion budget summary:** live surface carries exactly **one pulse** (the live dot) + **one score-pop per goal** + **transient takeover/banner overlays that auto-dismiss**. Nothing loops, nothing shimmers, nothing decorative moves. Gold appears once, at FT (plus the hat-trick milestone, mutually exclusive with the result card).

---

## 3. Interactive tracking innovation — football's "wagon-wheel"

Cricket's signature spatial layer is the wagon-wheel (`cricket-shot-tracking.html`): an *optional, on-demand, ground-type-aware, tap-to-place* capture layered onto boundary entry, never a required mode. Football's adaptation is a **three-tier ladder**, each tier honest about input-cost against what a one-handed pitch-side volunteer can sustain (`research.md` §5.2). Tiers 1–2 need **zero extra input** (pure derivations); Tier 3 is the true on-demand wagon-wheel analogue — **one optional tap per goal**, not per shot.

### 3.1 Tier 1 — Minute-by-minute timeline (SHIP · the centrepiece · zero input)

The vertical, newest-first event feed rendered on the `Timeline` tab. It is football's spine and needs **no input beyond the events the scorer already captures**. Each row: a minute rail (mono, `.moment .ov` grammar) + a typed event body.

```
TIMELINE                                       MUN 2 – 1 ARS
│
├ 90+3'  🟥 FULL TIME — Man Utd win 2–1
│
├ 82'   ⇄  Arsenal — Saka → Nketiah
├ 74'   ⚽ GOAL — Rashford (Bruno) · 2–1        ← .six green
│         └ ⚑ from inside the box · [pitch ▸]   ← goal-location chip if captured (§3.3)
├ 67'   🟥 RED — Odegaard (2nd yellow) · ARS→10  ← .wkt danger
├ 45+1' ═  HALF TIME · 1–1
├ 30'   ⚽ GOAL — Saka (penalty) · 0–1
├ 22'   🟨 YELLOW — Casemiro
├ 12'   ⚽ GOAL — Rashford (header) · 1–0
│
└ 00'   ▶ KICK OFF — Man Utd v Arsenal
```

- **Event vocabulary:** ⚽ goal (scorer • assist • type • new scoreline), 🟨/🟥 card, ⇄ sub (off→on), and clock milestones (KO/HT/FT/+stoppage). **Own-goal** renders `⚽ OG · Odegaard (o.g.) · credited MUN` — visibly distinct, never crediting a personal tally.
- **Doubles as undo-context:** because the timeline *is* the ledger projection, the scorer's persistent Undo (`scorer.md`) pops the top row and every derived surface recomputes.
- **Filter chips (optional):** `All · Goals · Cards · Subs` — a hairline chip row to focus the feed. Default `All`.

### 3.2 Tier 2 — Momentum bar (SHIP-candidate · low input-cost · derived)

A horizontal **attack-momentum wave** (FotMob port, `research.md` §2.2, §5.2), living in the collapsed `<details>` on the `Live` tab. **CSS-only, derived entirely from the event stream** — no new operator input:

- **Derivation:** the match timeline is bucketed into ~5-minute segments; each segment gets a signed magnitude from event weight × recency — a goal is heaviest, a red card swings the bar toward the *opponent* (a team going to 10 loses pressure), sub/yellow are light. Bars lean **up-green toward the pressing side, down-danger toward the other** (reuse cricket `.bar.hi` / `.bar.wk`).
- **Honesty guardrail:** the summary row and an inline caption both read **`derived — not tracked possession`**. It is a *feel* graphic, explicitly not a measured stat. It never appears on the board (governance) and never claims a number it doesn't have.

```
📊 MOMENTUM · pressure          derived   ▾
   ▁▂▄▆█▅▃  ·  ▂▁▃▂     ← green up = pressing, danger down = pressed
   MUN                        ARS
```

### 3.3 Tier 3 — Goal-location capture + pitch event map (SHIP the capture · on-demand · the true wagon-wheel analogue)

The honest football twin of cricket's wagon-wheel: **not** a per-shot map (a volunteer won't sustain shot-by-shot placement — the same reason cricket rejected required gesture-mode), but an **optional single tap per goal** layered onto the existing attribution flow. One goal = at most one tap. It feeds a **goal/shot pitch-map** into player & team stats and the live Stats tab.

**Capture interaction (ported from `cricket-shot-tracking.html`, football-shaped):**

- **Where it lives:** appended to the scorer's deferrable goal-attribution row (`scorer.md` §1.2) as an optional step. After Scorer/Assist, an inline `⚑ Where? (optional)` chip. Tap it → the pitch-capture sheet slides up. **Skip = the goal is fully logged without it** — attribution never blocks the log; location is a fast-follow of a fast-follow.
- **The sheet** (cricket `.sheet` grammar): title *"Where did it go in?"*, sub *"Goal · Rashford · tap the pitch"*, an **`Optional`** eyebrow, and two Skip / Save buttons at the bottom.
- **Pitch-type aware** (the football analogue of cricket's ground-type chips): a `.gt` chip row — **`11-a-side` · `7s` · `5s turf`** — selects the pitch aspect ratio once at match setup and is reused every goal. The SVG pitch redraws to the format's shape (full pitch vs compact turf box), exactly as cricket's `drawRect()` reshapes for box/gully. No metre-presets needed — a football pitch is a known rectangle; only the aspect changes.
- **Two taps captured, both optional within the optional step:** the operator taps **(1) where it crossed the line** (a point on the goal-mouth strip) and **(2) where it was struck from** (a point on the pitch); a shot-line is drawn between them (reuse the green `stroke-width:3` boundary line). One tap alone (just the strike point, or just the goal-mouth) is valid — partial is fine. `long-press = header` tags aerial (mirrors cricket's `long-press = along the ground`).
- **The half is auto-known:** the attacking direction is derived from which side scored + which half — the operator never sets orientation.

**How it feeds stats + the live visualisation:**

- **Player stats:** each captured goal contributes a point/line to that scorer's **goal map** (their personal wagon-wheel — where this player scores from), shown on their profile and the milestone card.
- **Team stats:** aggregated into the **pitch event map** on the `Stats` tab — a single pitch with all goals plotted (green) and, if the operator also logged near-misses via the same optional chip on a `Disallow/Shot` event, muted shot markers. This is the honest, casual version of Sofascore's shot map (`research.md` §5.2) — populated only as richly as the operator chose to tap.
- **Live visualisation:** a goal with a captured location deep-links from its timeline row (`[pitch ▸]` chip, §3.1) to the map with that goal highlighted; the goal takeover (§2.1) can optionally show the mini pitch-thumb.

**Restraint / scope:** the full xG shot map stays **out of scope** for casual input (`research.md` §5.2) — we plot *locations*, never fabricate expected-goals. Empty state is graceful: no taps ever made → the map simply isn't offered on Stats, and nothing looks broken. The feature earns its place by being *pure upside* — richer if used, invisible if not.

### 3.4 Wireframe — the goal-location capture sheet

```
┌─────────────────────────────────────────────┐  ← .sheet (1.5px ink border, r16)
│  Where did it go in?              Optional   │  ← .sheet-head · eyebrow
│  Goal · Rashford (Bruno) · tap the pitch     │  ← .sheet-sub, scorer in green
│                                              │
│   ┌────────┬────────┐                        │  ← pitch-type chips (.gt), set once
│   │11-a-sd │  7s  │ 5s turf│  ← 11s selected │
│   └────────┴────────┘                        │
│                                              │
│   ╭──────────────────────────────────────╮   │  ← SVG pitch (aspect per format)
│   │            ·  ← (2) struck from        │   │
│   │             ╲                          │   │
│   │        ╭─────╲──────╮                  │   │  penalty box
│   │        │      ╲     │                  │   │
│   │      ══╪═══════●════╪══  ← goal line    │   │  (1) where it crossed = ●
│   │        │  GOAL MOUTH │                  │   │
│   ╰──────────────────────────────────────╯   │
│                                              │
│  Tap where it crossed + where it was struck  │  ← .hint
│  long-press = header                          │
│  ▄ Goal    ▄ Shot (muted)                     │  ← .legend
│                                              │
│  ┌───────────────┐  ┌───────────────────┐   │
│  │     Skip      │  │     Save goal ✓    │   │  ← .btn.skip · .btn.done (green)
│  └───────────────┘  └───────────────────┘   │
│  Pitch type set once at match start. Feeds   │  ← .note
│  the scorer's goal map & team shot map.      │
│  One optional tap per goal — never per shot. │
└─────────────────────────────────────────────┘
```

**Design conclusion:** the timeline is the guaranteed record (Tier 1, zero input); the momentum bar is the low-cost derived feel (Tier 2, labelled derived); the goal-location map is the optional wagon-wheel enrichment (Tier 3, one tap per goal, deferred, pitch-type-aware). The full xG shot map stays out of scope — exactly as cricket ruled required gesture-mode out. Every tier is *pure upside*: richer if the operator engages, invisible and unbroken if they don't.

---

## 4. Additional features — what these underserved games lack (the adoption wedge)

Football's grassroots tools are UK/FA-admin-shaped and read-only-pro apps can't score your match (`research.md` §4). These five inventions close that gap and are what makes a college or university actually *adopt* ScoreEasy over a WhatsApp scoreline. Each is ICP-realistic and derivable from the ledger we already keep.

### 4.1 The instant shareable result card (⭐ the headline adoption driver)

The deliverable the ICP actually wants (`research.md` §3.2, §4). At any point — but designed for full-time — a **one-tap `↗ Share`** generates a clean, screenshot-ready **result card image**: scoreline, both crests, scorers with minutes, Player of the Match, a `NEXT GOAL WINS`/`won on penalties` line where relevant, and a small `scoreeasy.live/m/xxxx` deep-link. It renders from the same tokens as the result surface (§2.5), so it's beautiful by default. **Every share carries the live-link** — the card is both the trophy *and* the growth loop: a WhatsApp group sees the card, taps the link, becomes spectators of the *next* match. This is the single feature no grassroots tool delivers well and the one that spreads the app for free.

### 4.2 Spectator reactions — 🔥 tap-to-react (⭐ the "watch the turf game live" hook)

The pres-footer `🔥 41` is live and interactive. A spectator on the live link can **tap 🔥 / ⚽ / 👏** and the count updates for everyone (the presence footer is already ported from cricket). At a goal, a brief **reaction burst** rides the takeover (reduced-motion gated, capped, no spam). This is the experience that *only exists for pro fixtures today* (`research.md` §4) — a friend watching *this* college turf match live, reacting in real time. Low-stakes, high-delight, and it makes the live-link worth opening.

### 4.3 Player milestones + the tournament Golden Boot (⭐ the "why we keep using it" retention loop)

Derived, near-free tournament assets (`research.md` §4, §5.1). Within a match: **brace / hat-trick / clean-sheet** milestones (§2.4). Across a tournament: a **Golden Boot leaderboard** (top scorers), plus **most assists** and a **fair-play / cards** table — all derived from the goal+card ledger the standings shell already feeds (GF/GA/GD/Pts). A student who scores a hat-trick gets a shareable milestone card; a tournament that crowns a Golden Boot winner is a *reason to run the whole tournament on ScoreEasy*. This turns single matches into a season-long habit — the retention engine grassroots tools lack.

### 4.4 Follow & notify — the async spectator (📲 the reach multiplier)

Not everyone watches live. **`Follow ✓`** on any match/team/tournament subscribes a spectator to **push/WhatsApp notifications**: goal alerts (`⚽ 67' — Man Utd lead 2–1`), the send-off swing, and the full-time result card — delivered even to someone who never opened the live screen. A parent, an alumni group, a rival team scouting — all reachable without watching. It extends the audience of a turf game far beyond the sideline and feeds §4.1's growth loop (each notification is a tap back into the live link).

### 4.5 One-tap match & tournament setup with India-native presets (🏫 the "schools can actually run it" enabler)

The reason a college *organiser* (not just a scorer) picks ScoreEasy. **Format presets as first-class** (`research.md` §3.1): pick `5s turf` / `7s` / `college 11s` once and the whole stack ripples — clock length, cards on/off, rolling subs, offside, golden-goal, and the scorer mode (Quick vs Guided, `scorer.md` §4) all configure from one tap. Teams arrive as a **paste-a-WhatsApp-list roster** (loose-roster, `?Unknown` tolerant). A tournament is **a name + a list of teams → auto-generated standings + bracket** on the existing `GenericGoalsTournament` shell. Setup that takes a volunteer 60 seconds, not a form-filling detour — the operational ease that gets an institution to standardise on us.

---

## Summary

The football live/spectator screen is the **cricket spectator frame, football-shaped**: the `main-scoreboard.md` hero pinned on top, a `Live · Timeline · Stats` tab strip below, and the depth split so the default `Live` tab stays calm — a **derived momentum bar** (collapsed, labelled derived), a **derived NOW-card** (scorers · on-pitch · last subs), and a **curated key-moments digest**, with the full **minute-by-minute timeline** one tab over and an **honest stats panel** (only ledger-fillable rows) the next. Signature moments are a reduced-motion-gated ladder — **goal takeover + score-pop**, **escalated late-winner**, **red-card danger banner + `⑩` flip**, **one gold hat-trick card**, the **FT result peak** (gold, loser dimmed, draw first-class), and a future-flagged **shootout reveal** — inside a strict motion budget (one pulse, one pop, auto-dismissing overlays, gold only at FT). The interactive-tracking innovation is a three-tier wagon-wheel ladder: the **timeline** (zero input, the centrepiece), the **momentum bar** (low-cost derived feel), and the true analogue — an **optional one-tap-per-goal, pitch-type-aware goal-location capture** that feeds a player goal-map and a team pitch/shot map, richer if used and invisible if not, with the full xG shot map ruled out of casual scope. Five adoption features — **instant shareable result card + live-link growth loop**, **live spectator reactions**, **player milestones + tournament Golden Boot**, **follow & notify**, and **one-tap India-native preset setup** — close the Camp-A/Camp-B gap no grassroots tool bridges, giving a college crowd the rich, live, shareable watch experience that today exists only for pro fixtures.
