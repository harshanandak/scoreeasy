# Volleyball — THE LIVE / SPECTATOR SCREEN + SIGNATURE MOMENTS + INTERACTIVE TRACKING

**Date:** 2026-07-26 · **Status:** DESIGN SPEC (the lean-back watch experience)
**Feeds:** `research.md` §2.2 (broadcast overlays) + §4 (gaps) + §5 (drama beats & tracking) · `main-scoreboard.md` (the hero it reuses) · `scorer.md` (the operator that feeds it)
**Design system:** design1-mono (brutalist shell × HiFi-blend), governance FROZEN. `--se-*` / `--se-blend-*` tokens only, never raw hex. Pure-black ink, ONE hard offset shadow, mono tabular numerals, **green = live/lead/serve accent ONLY** — no new colours.
**Lineage:** ports the cricket spectator screen verbatim (`cricket-spectator-clean.html`: black dual-team hero → tabs → collapsed momentum → now-card → key-moments feed → presence footer) and the cricket shot-tracking sheet (`cricket-shot-tracking.html`: optional, on-demand, court/ground-type-aware spatial capture). Same skeletons, volleyball brain.

This is the surface a **parent, student or coach WATCHES** — not the scorer console (that is `scorer.md`), not the irreducible board (that is `main-scoreboard.md`). The board is the hero *inside* this screen; everything below it is the richer context the research says the market completely lacks (`research.md` §4.4: "there is little to no lean-back live view for parents/students, no shareable live link, no post-match result card"). This screen is our answer to the empty middle.

---

## 0. The one governing principle

Volleyball's defining feel is **momentum** (`research.md` §2.2, §4.5: "point-runs and set-swings are volleyball's defining feel and its best broadcast stat — yet consumer apps rarely visualise them"). So where cricket's spectator screen leads with a run-chase note, **volleyball's leads with the swing.** Every richer element on this screen exists to answer one of three spectator questions:

1. **Who's winning right now?** → the hero board (reused verbatim).
2. **Which way is it swinging?** → the momentum worm + point-run band (the signature read).
3. **What just happened / what's at stake?** → the key-moments feed + phase spine.

Anything that doesn't answer one of those three is garnish and is cut.

---

## 1. LIVE SCREEN LAYOUT — balanced detail, tabs

Single column, `max-width:390px`, exactly the cricket-spectator skeleton. Three tabs; **Live** is the default and holds 90% of the value. The richer stuff is *revealed, not stacked* — the screen must read in one thumb-scroll.

### 1.1 The tab set (capsule segmented, ported from cricket)

```
┌  Live  ┊  Sets  ┊  Stats  ┐
```

| Tab | Holds | Why |
|---|---|---|
| **Live** (default) | Hero board → momentum worm → point-run "now" band → set-history strip → key-moments feed → presence footer | The lean-back watch. Everything a spectator needs while the rally is live. |
| **Sets** | Per-set score table (points, side-out%, aces/blocks/errors *if* tagged, longest run, set duration) + the rotation wheel (formal mode) | The "scorecard" analogue — read between sets, not during the rally. |
| **Stats** | Team & player stat panel + the interactive **zone map** read (attack/serve heat) + set-point / clutch conversion | The deep-dive, all log-derived or from optional zone capture (§3). |

The board never leaves the top of any tab — it is the persistent bug (`main-scoreboard.md` State B). Tabs swap only the body beneath it.

### 1.2 Live tab — top-to-bottom wireframe

```
┌──────────────────────────────────────────────┐
│  ‹        Sunday Cup · Final          ↗       │  ← header: back · title · share (ported cricket .hdr)
│                   ● LIVE                        │
├──────────────────────────────────────────────┤
│              Live  ┊  Sets  ┊  Stats           │  ← capsule tabs (Live on)
├──────────────────────────────────────────────┤
│  ▸ KBS                                 AHV     │  ┐
│   21          · SET POINT ·            23       │  │ HERO BOARD — main-scoreboard.md State B,
│  ▓▓▓▓▓                               ▓▓▓▓▓      │  │ verbatim. Five fields + T.O dots + set line.
│  SETS ● ● ○                    ○ ● ● SETS       │  │ Read-only glass. THE score.
│  25–23 · 23–25 · 21▸                            │  ┘
├──────────────────────────────────────────────┤
│  ⟿ MOMENTUM                    KBS on serve 6▸ │  ← point-run "now" band (ALWAYS visible, 1 line)
│  ░░▓▓▓▓█████░░░▒▒▒▒▒▓▓▓▓▓▓▓ ← KBS ·6· run       │     the signature read; green=KBS lead, red=AHV
├──────────────────────────────────────────────┤
│  ▾ Set swing · this set        lead ±  KBS +4  │  ← collapsed momentum worm (details, cricket .mom-d)
├──────────────────────────────────────────────┤
│  NOW                                            │  ┐
│  Serving   ▸ KBS   ·  6 straight  ·  side-out? │  │ NOW-CARD — the volleyball analogue of cricket's
│  On court   R. Nair sets · A. Roy at net       │  │ batters+bowler. Server streak, who's hot, last
│  Last point  KILL · A. Roy · line 4→1          │  │ point's shape. Formal mode adds names; casual
│                                                 │  │ mode shows just the streak + last-point line.
├──────────────────────────────────────────────┤  ┘
│  KEY MOMENTS                                    │  ┐
│  21▸  SET POINT · KBS lead 21–19, serving       │  │ FEED — reverse-chron, ported cricket .moment.
│  18   RUN · KBS 5 straight on Nair's serve      │  │ Auto-generated from the rally log: runs, set/
│  16   TECH · AHV timeout, KBS momentum          │  │ match points, set closes, comebacks, aces.
│  11   SET 2 · AHV take it 25–19                  │  │ No taps required — all derived.
├──────────────────────────────────────────────┤  ┘
│  👁 312 watching · 🔥 41      [ Following ✓ ]    │  ← presence footer (ported cricket .pres)
└──────────────────────────────────────────────┘
```

### 1.3 What each new block is (and its restraint)

- **Point-run "now" band (always visible, one line).** THE signature. A CSS-only horizontal bar whose fill origin sits at the *current lead*: green mass toward the leading side, danger toward the other, a moving cursor at the live point. The right-side label reads the live streak (`KBS on serve · 6▸`). Zero extra taps — pure `deriveSet()` read. This is volleyball's wagon-wheel-equivalent-at-a-glance; it is the thing the market is missing (`research.md` §4.5).
- **Set-swing worm (collapsed `<details>`).** Ported cricket `.mom-d` verbatim: an icon-toggled bar chart, one bar per *point-run segment* this set (height = run length, green = leading team's run, danger-tint = the other's, dashed = live). Collapsed by default so it never fights the hero. Opens to show the whole set's swing. The summary line carries `lead ±` so the value shows without opening.
- **Now-card.** Reuses cricket's `.now-card` grid. **Casual mode:** two rows — `Serving ▸ KBS · N straight · side-out?` and `Last point · <shape>`. **Formal mode:** adds an `On court` row (setter + front-row hitter from the lineup). It restates the live state in words, once.
- **Key-moments feed.** Ported `.moment` rows, reverse-chron, **fully auto-generated from the rally log** — no operator tagging. Triggers: set/match point reached, a run of ≥5, a set close, a comeback (trailing team erases a set point or wins from ≥N down), and — *only if the optional stat tag exists* — an ace/kill/block. Each row: `pointLabel · human sentence`. This is the emotional transcript the pro tools never produce.
- **Presence footer.** Ported verbatim: watchers + reaction count + Follow. Powers the reaction feature (§4.3).

**Balance rule:** the hero is the only heavyweight. The momentum band is one line. The worm and now-card are collapsible / two-row. The feed is the only scrolling region. A spectator gets *the whole story in one screen height* and *the depth on scroll* — never a wall.

---

## 2. SIGNATURE MOMENTS — the drama beats

These are the tokenized, **reduced-motion-gated** animations. Straight from `research.md` §5.1, ranked by emotional payload. All obey the frozen governance budget: **ONE live pulse, ONE inversion, no second hue, no decorative motion** (`main-scoreboard.md` §4). The *escalation ladder* IS the encoding — a moment is a tint step on an existing element, never a new colour or a glow. Each below specifies **trigger + exactly what animates + the restraint.**

| # | Moment | Trigger (derived flag) | The beat | Restraint |
|---|---|---|---|---|
| 1 | **SET POINT** | `deriveSet().isSetPoint` | The centre phase spine steps to `SET POINT` on the warning ladder tint; a single 200ms tint-in. The target-line pips fill toward the winning side. | No pulse, no sound. Tint step only. Re-fires (re-tints) each time it's saved and re-reached — the tension *recurs*, it doesn't accumulate decoration. |
| 2 | **MATCH POINT** | `deriveMatch().isMatchPoint` | Phase spine steps to `MATCH POINT` on the danger-soft ladder tint AND **retains the one live pulse** (the screen's single allowed pulse migrates here from the LIVE dot). The peak-tension held state. | This is the ONE place the pulse is allowed to move. Still no inversion, no new colour. One pulse, one tint. |
| 3 | **DEUCE (24–24 / target−1 each)** | `deriveSet().isDeuce` | Phase spine → `DEUCE` on warning-soft tint; the two big numbers get a hairline tie-underline so the "level, win-by-2" state is unmistakable. | Recurs and re-escalates every tied point — but it is *the same tint*, re-applied, never brighter. Kills the documented "deuce confusion" anxiety (`research.md` §3.3). |
| 4 | **POINT-RUN FLARE** | run counter crosses 5, then each +1 | The momentum "now" band's streak label steps one ladder-tint brighter at 5, and the run segment on the worm grows. A 120ms width-grow on the band fill — the *only* size motion, and it's data, not decoration. | Caps at the ladder's top tint; a 10-run and a 6-run look the same brightness (the *number* differentiates). No confetti, no flash. |
| 5 | **SET WON** | `deriveSet().isClosed` | A soft card slides (150ms translate) into the end-switch handoff space: human sentence in sans (`KBS take set 2, 25–22`) + the mono figure line. The natural crowd-reaction pause. | One slide, one card, auto-dismiss on next-set start. No inversion. Sans sentence + mono line only — the ONE sans intrusion, mirroring the board's title. |
| 6 | **COMEBACK / SET-POINT SAVED** | trailing team erases a set point, or wins from ≥N down | A quiet one-line feed entry gets the danger→green tint-flip on its label (`SAVED · AHV erase set point`). No card, no motion beyond the tint. | The quietest beat — high narrative value, near-zero decoration. Lives only in the feed, never seizes the hero. |
| 7 | **MATCH WON** | `deriveMatch().isComplete` | THE designed peak. The one **gold milestone card** (the single allowed inversion of the whole product): plain-language result (`KBS won 3–1`), set line in mono, `Share ↗ / Rematch`. A 200ms scale-in, gated. | The only inversion in the entire live experience. Everything else spent its restraint so this one lands. One card, one gold, done. |

**Global gate:** every animation above is wrapped in `@media (prefers-reduced-motion: reduce)` → the tint/state still applies instantly (state is never lost), only the *transition* is removed. A reduced-motion viewer sees every drama state, zero movement. Each beat is a named design token (`--moment-setpoint`, `--moment-matchwon`…) so the set is auditable and capped — you cannot add a beat without adding a token, which is the governance choke point.

---

## 3. INTERACTIVE TRACKING INNOVATION — Attack & Serve Zone Capture

Cricket's signature toy is tap-to-place the ball on the ground (wagon wheel). **Volleyball's analogue is: tap the 6-zone court where the point-winning action landed / came from** (`research.md` §5.2 item 4 — "borrows exactly ONE idea from DataVolley's coding system (origin/target zone) without its full contact-coding burden"). It is **optional, on-demand, court-aware, and never blocks the one-tap core flow** — exactly the discipline of `cricket-shot-tracking.html`.

### 3.1 The design decision: TWO free reads + ONE opt-in capture

The research ranks four candidate trackers by value-per-tap-cost (`research.md` §5.2). We ship them in that order, and this spec is explicit about which cost taps:

| Tracker | Taps | Status | Lives |
|---|---|---|---|
| **Point-run / momentum worm** | ZERO (log-derived) | **Ship-first** — §1.3, it's the signature | Live tab |
| **Serve / side-out takeover strip** | ZERO (log-derived) | **Ship-first** | Stats tab |
| **Rotation wheel** | ZERO (needs lineup) | Formal mode only | Sets tab |
| **Attack & serve ZONE map** | ONE optional tap/point | **The opt-in enrichment** (this section) | Capture sheet → Stats tab heat |

The zone map is the *only* one that costs a tap, so it is the only one gated behind an explicit opt-in — mirroring how cricket deferred tap-to-place. **Everything valuable ships free; the spatial layer is a bonus a keen scorer can switch on.**

### 3.2 The capture interaction (how the operator taps it)

**Entry — on-demand, never forced.** After a point is awarded on the scorer console (`scorer.md` §2), *if* "Zone tracking" is switched on for this match (a single setup toggle, off by default), a **thin, dismissable prompt** slides above the two giant targets:

```
│  📍 Where was the point won?   [ tap court ]  [ skip ]  │
```

- **Skip** (or scoring the next rally) dismisses it instantly — the core flow is never blocked, identical to cricket-shot's Skip button. A scorer running fast just never looks at it.
- **Tap court** opens the capture sheet (below). The whole interaction is **one tap on a zone + auto-save**, ≤1.5s. If the operator ignores it, the point is still fully scored — zone is pure enrichment.

**The capture sheet — ported from `cricket-shot-tracking.html`, court-typed.** Cricket's sheet is ground-shape-aware (Round/Oval/Box/Gully) because gully cricket is played on wildly different grounds. Volleyball's court is standardised, so the "court-type" axis instead captures **what kind of point** it was — which changes what zone means:

```
┌──────────────────────────────────────────────┐
│  Where was the point won?            Optional  │  ← ported .sheet-head
│  KBS point · was 20–19 · tap a zone            │  ← .sheet-sub (green KBS)
│                                                 │
│  ┌ Kill ┐┌ Ace ┐┌ Block ┐┌ Opp error ┐         │  ← point-TYPE chips (ported .gt, court-analogue)
│  └──on──┘└─────┘└───────┘└───────────┘         │     changes what the zone means (target vs serve-land)
│                                                 │
│        ── NET ──────────────────────            │
│      ┌──────┬──────┬──────┐                      │
│      │  4   │  3   │  2   │   front row          │  ← the 6-zone court, standard numbering
│      ├──────┼──────┼──────┤                      │     tap the zone the kill LANDED (or ace landed,
│      │  5   │  6   │  1▸  │   back row           │     or block-to zone). 1 = serve/back-right.
│      └──────┴──────┴──────┘                      │     ▸ marks current server's zone (context)
│              KBS ends                            │
│                                                 │
│  Tapped: zone 4  ·  Kill  ·  A. Roy (if lineup) │  ← echo line
│  ┌──────────────┐        ┌──────────────────┐   │
│  │     Skip     │        │   Save zone  →    │   │  ← ported .btn.skip / .btn.done
│  └──────────────┘        └──────────────────┘   │
└──────────────────────────────────────────────┘
```

**Interaction rules (ported discipline):**
- **Point-type chip is sticky** (like cricket's ground shape "set once, reused"). Most points a scorer tracks are Kills; the chip defaults to the last-used type, so the common case is *one tap on the zone, done*.
- **The zone tap is the whole capture.** For a **Kill/Block** the tapped zone = *where the ball landed on the opponent's floor* (attack target). For an **Ace**, the sheet flips to the opponent's court and the tap = *where the serve landed*. For **Opp error**, zone is optional/greyed (an error has no attack zone) — one tap Save with no zone is valid.
- **Player attribution is free when a lineup exists** (formal mode): the front-row hitter in the tapped zone is pre-filled; the scorer can override with a long-press → player picker. Casual mode: no player, just team + zone.
- **Court-side awareness:** the court orientation follows *which team won* — the tapped court is always the side the point was won *into*, so "zone 4" always means the same thing to the reader regardless of which team is on which end this set (ends switch every set — the capture normalises this, exactly as cricket normalised ground orientation).

### 3.3 How it feeds player/team stats + the live visualisation

The zone tap writes one enrichment record onto the rally in the log: `{ rallyId, winTeam, type: kill|ace|block|error, zone: 1–6|null, playerId?: }`. Everything downstream is a **read-only derivation**, identical to how the core score is derived:

- **Team attack heat (Stats tab).** A 6-zone court rendered as a heat grid — each zone shaded by *share of points won from/into it*. Instantly answers "KBS win everything down line 4" / "AHV's serve dies in zone 1." This is the DataVolley tendency-map read (`research.md` §2.2) delivered from ONE tap instead of full contact-coding.
- **Player zone signature (Stats tab, formal).** Per-hitter: kills by zone, kill%, favourite lane — a mini heat court per player. The thing that makes a college coach screenshot the app.
- **Serve map (Stats tab).** Aces plotted where they landed → a server's placement tendency. Free once serve is derived + the ace-zone tapped.
- **Live feed enrichment.** A tagged point upgrades its key-moments line from `KILL · A. Roy` to `KILL · A. Roy · line 4` and, on the momentum band, can flash the zone. Purely additive — an untagged point just shows the plainer line.
- **Set-point / clutch read.** Cross the zone data with the set-point flag → "who converts set points, and from which zone" — the highest-drama derived stat, surfaced small on Stats.

**The guarantee (cricket-parallel):** the persisted truth is still the **rally log**; zone is an optional column on it. A match scored with *zero* zone taps has a complete score, momentum worm, feed, and result — the zone layer only ever *adds* heat maps and player signatures on top. It can never break, block, or be required. This is precisely cricket's "shape capture is deferred, opt-in, never blocks the one-tap flow," adapted to volleyball's court.

### 3.4 Wireframe — the Stats-tab heat read (the payoff)

```
┌──────────────────────────────────────────────┐
│  Live  ┊  Sets  ┊  Stats                       │
├──────────────────────────────────────────────┤
│  ATTACK ZONES · where points are won            │
│        ── NET ──────────────────────            │
│      ┌──────┬──────┬──────┐                      │
│      │ ████ │ ▓▓   │ ██   │   KBS 41% of kills   │  ← heat: darker = more points won there
│      │  4   │  3   │  2   │   down line 4         │
│      ├──────┼──────┼──────┤                      │
│      │ ░    │ ▓    │ ███  │                       │
│      │  5   │  6   │  1   │   AHV serve dies z1   │
│      └──────┴──────┴──────┘                      │
│  [ KBS ]  [ AHV ]  [ A. Roy ▾ ]                  │  ← toggle team / drill to a player's signature
│                                                 │
│  SERVE · aces landed          KBS 4 · AHV 2      │
│  ┌──────┬──────┬──────┐  (● = ace landing spot)  │
│  │  ●   │      │  ●●  │                           │
│  └──────┴──────┴──────┘                           │
│                                                 │
│  CLUTCH · set points   KBS 3/4 won · AHV 1/3     │  ← log-derived, free, no zone needed
└──────────────────────────────────────────────┘
```

---

## 4. ADDITIONAL FEATURES — what would make schools & universities adopt us

The research is blunt that the whole category is two disappointing halves with an empty middle (`research.md` §4). Below are five ICP-realistic features that turn "a scorer app" into "the thing our college volleyball runs on." Each is cheap to build on the existing log + spectator surface, and each targets a documented ICP truth.

### 4.1 Shareable live link + auto result card (the growth loop)
**The gap:** "no shareable live link, no post-match result card" (`research.md` §4.4). **The feature:** every match has a public read-only URL — this exact live screen — that the scorer shares to a WhatsApp/section group in one tap (the `Share ↗` in the header). No login to watch. On match end, the **gold result card** (§2 moment 7) auto-renders as a shareable image (`KBS won 3–1`, set line, momentum sparkline, "scored on <app>"). This is the acquisition engine: every college-fest match seeds its own audience, and the result card is a branded artefact that spreads. **Why schools adopt:** the PE teacher becomes the person who "put the match online" for free, in 15 seconds.

### 4.2 15-second team & league setup (zero-roster start, presets)
**The gap:** pro tools "demand a lineup, positions and coded contacts before you can start" (`research.md` §4.2); format rigidity breaks on Indian reality (§4.3). **The feature:** start a match with **two labels + a preset chip** (`Bo3 to 25`, `Single set to 15`, `to 21 cap`, `PVL-style to 15`) and go — <15s, no roster (mirrors `scorer.md` §4.5). For a fest, a **bracket/league mode**: paste/enter N team names once, the app generates the fixtures, and each match's result auto-advances the bracket + updates a shareable standings table. **Why universities adopt:** one volunteer runs a whole 16-team inter-department knockout from a phone, and the live bracket is a shareable link the whole campus follows.

### 4.3 Spectator reactions (the live crowd, tap-to-cheer)
**The gap:** volleyball is "intensely momentum-driven and social at college level, and that emotional surface is essentially absent" (`research.md` §4.4). **The feature:** the presence footer (§1.2) is live — anyone on the share link taps 🔥 / 🏐 / 👏 and a lightweight reaction burst rises on the momentum band, with a running count (ported cricket's `🔥 41`). Reactions spike naturally on kills and set points (the feed already knows those moments), so a big rally visibly lights up the screen for everyone watching. **Restraint:** reactions are ephemeral micro-glyphs on an existing surface, reduced-motion-gated, never touching the hero. **Why schools adopt:** it makes a mud-court section game *feel* like a broadcast — the students watching from the hostel are part of it.

### 4.4 Player milestones & season card (the retention hook)
**The feature:** because points can carry a player attribution (§3.2, free in formal mode) and matches persist, the app tracks lightweight **milestones** — "A. Roy · 100th career kill," "first 10-ace match," "5-match win streak" — surfaced as a small feed moment and a shareable player card. Over a season, each player accrues a **season card** (matches, kills, aces, best game) — the college-sport equivalent of a stat line, which no free tool offers. **Why universities adopt:** it gives players a reason to *want* every match scored on the app — their card grows. That is the retention flywheel the dumb counters can never build.

### 4.5 Rivalry & head-to-head (the local-drama layer)
**The feature:** when two teams that have played before meet again, the setup echo and the live header surface their **head-to-head** ("KBS lead the series 3–1 · last: AHV won 2–0") and the result card notes it ("KBS reclaim the section"). Built entirely from persisted match history — zero new input. **Why schools adopt:** inter-department and hostel rivalries ARE the emotional core of college volleyball; naming the rivalry turns a routine fixture into an event, and every rematch pulls a bigger share-link audience. This is the cheapest possible feature (a history query) with the highest local-drama payoff.

**Selection logic:** these five are ranked by adoption leverage — 4.1 (share loop) and 4.2 (frictionless setup) are the *table stakes that win the trial*; 4.3–4.5 are the *emotional hooks that win the season*. All ride the existing rally log + spectator screen + result card; none requires new operator burden on the lean scoring path. That is the discipline: every feature is a **read** on data we already have, or a **one-tap opt-in** — never a tax on the two-target core.

---

## 5. What NOT to build here (holding the line)

- **NO full DataVolley contact-coding.** One optional zone tap per point is the ceiling (`research.md` §2.3, §5.2). We never ask for skill+tempo+eval per contact — that is the pro-tool trap that kills casual adoption.
- **NO second colour / decorative motion / extra pulse.** The signature moments spend a fixed, tokenized budget (§2). Green = lead/live/serve; the ladder is the state; one pulse, one inversion, total.
- **NO stats that need taps we don't already collect.** Every Stats-tab read is either log-derived (free) or a bonus of the opt-in zone tap. If a stat needs new operator input, it is cut.
- **NO clutter on the hero.** The board holds the line at five/seven fields (`main-scoreboard.md` §4). All richness lives *below* it, revealed by scroll or tab — never crammed into the score bug's airspace.
- **NO gated watching.** The spectator link is public and login-free (§4.1). The moment we ask a parent to sign up to watch, the growth loop dies.

**The test for anything proposed for this screen:** *does it answer "who's winning / which way is it swinging / what just happened," or does it grow the share loop, for zero cost on the scoring path?* If no → it belongs on the scorecard, the pro tier, or nowhere.
