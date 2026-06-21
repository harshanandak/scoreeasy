<!--
Provenance: 8th research dimension (feed & commentary UX), run 2026-06-22.
Companion to docs/research/2026-06-22-live-matches-and-scorecard-research.md.
Bound to the live Mono design tokens (var(--primary), var(--accent), var(--foreground),
var(--muted-foreground), var(--card), t.divider).
-->

# Live Commentary Feed & Discovery Feed — UX Spec

## 1. Live commentary / event feed

**Line anatomy — exact field order (left → right):**
1. **Event icon** (24px, naked ink stroke 1.5px, `var(--foreground)`; accent only for key moments) — leading, vertically top-aligned.
2. **Timestamp / position label** (mono, weight 700, tracking 0.08em, `var(--muted-foreground)`) — e.g. `18.4`, `45'+2`, `SET 2 · 5-4`.
3. **Primary text** (Swiss sans, weight 400, `var(--foreground)`, 15px/1.4) — the play description; bowler/server name bolded 700 inline.
4. **Score-after chip** (right-aligned, tabular-nums, weight 700, 1px black edge, 2px radius, `var(--card)` fill) — state immediately after the event, e.g. `78/3`, `1-1 (40-30)`, `2-1`.

Row = 1px bottom divider at black ~14% (`t.divider`). Vertical padding 12px. Icon column fixed 32px; chip column shrink-to-fit.

**Grouping rules per sport family:**
- **Cricket** — group by **over**. Sticky over-header row: `OVER 14 · R Jadeja · 8 runs` (eyebrow label 700/0.08em). Balls listed newest-first within the over; completed overs collapse to a one-line summary strip (`14 · • 4 1 W 2 •`) that expands on tap.
- **Volleyball / Tennis** — group by **set**. Sticky set-header: `SET 2 · 18–21`. Within set, group tennis sub-rows by game; volleyball lists rallies/points continuously. At tiebreak, header shows tiebreak score in-corner (`SET 3 · 6–6 (5–4)`).
- **Goal sports (football etc.)** — group by **half**, with a minute label per row. Header: `SECOND HALF`. Half-time and full-time render as full-width centered rule rows (`— HALF TIME 1–0 —`).
- Generic/unknown sport → group by **scoring period** (period N), same header pattern.

**Order & auto-scroll (one coherent rule):** Newest event on **top** (Cricinfo/FotMob convention). Feed stays **pinned to the top** and auto-advances as events arrive *only while the user is at scroll-top*. The moment the user scrolls **down** into history, auto-advance halts; incoming events buffer and a floating pill appears bottom-center: **`↑ 3 new plays`** (`var(--primary)` fill, white text, hard offset shadow `2px 2px 0` of `--accent-foreground`). Tapping it scrolls to top and resumes pinning. Pill count increments live.

**Key-moment highlight (goal / wicket / set point / match point / break point):**
- Full-row treatment: `var(--accent)` pale-green fill, **left accent bar** 3px `var(--primary)`, primary text weight 700.
- Icon swaps to filled accent variant; one hard offset shadow `4px 4px 0 var(--primary)` on the row card (decision-moment emphasis only — never on ordinary rows).
- Optional eyebrow above the line: `WICKET`, `GOAL`, `SET POINT`, `MATCH POINT` — weight 800, `var(--primary)`, tracking 0.08em.
- Entrance gets a one-shot 1px→accent edge flash (240ms) so it reads as "just happened."

**Iconography (stroke icons, accent-fill for key moments):**
- Cricket: ● dot-ball, ④/⑥ boundary numerals, ✕ wicket, ↔ wide/no-ball.
- Goal sports: ⚽ goal, ▮ yellow / ▮▮ red card, ⇄ substitution, ⊘ VAR.
- Tennis/volleyball: ◦ point, ⚡ ace/kill, ⊗ break, ★ set/match point.
- Match lifecycle: ▷ start, ⏸ pause, ⏹ final.

**Timestamp format:** sport-position primary (`18.4`, `45'+2`, `SET 2 · 5–4`), never wall-clock in the line. A faint relative wall-time (`2m ago`) may sit under the chip in `var(--muted-foreground)` 11px for the latest 3 rows only.

## 2. Spectator match page composition

**Vertical layout (top → bottom):**
1. **Pinned scorebug** — sticky top, `var(--card)`, 2px bottom black rule. Contents: sport icon · team A name + score · serve/possession indicator (●) · team B score + name · period/set summary line below (`SET 2 · 18–21`) · live-pulse dot + `LIVE` eyebrow top-right. Scores tabular-nums weight 800. Stays fixed on scroll; no shadow (chrome gets hairlines, not shadows).
2. **Tab bar** — directly under scorebug, sticky. Exact tab set: **`Feed` · `Scorecard` · `Stats`**. Tab labels mono weight 700, tracking 0.08em; selected tab `var(--primary)` text with 2px `var(--primary)` underline; unselected `var(--muted-foreground)`. **Default tab = `Feed`** (the live narrative is the reason a spectator opened the page).
3. **Tab body** — scrollable region.
   - `Feed` → §1 commentary feed.
   - `Scorecard` → structured current state (cricket batting/bowling card, set-score grid, lineup).
   - `Stats` → aggregate counters (run rate, aces, possession, shots).

**Final state:** Live-pulse dot is removed; eyebrow flips to `FULL TIME` / `FINAL` in `var(--foreground)`. Scorebug gains a winner marker (winning team name weight 900, ▸ or trophy glyph). Feed prepends a centered full-width terminal row `— FINAL · 2–1 —`. Auto-advance and the "new plays" pill are disabled. A subtle `MATCH ENDED` divider caps the top of the feed.

**Stale / paused (no event ~90s while still live):**
- Live-pulse dot **stops pulsing** and dims to `var(--muted-foreground)`.
- Scorebug shows a small pill `PAUSED` / `DELAY` (1px black edge, no fill).
- Auto-advance pauses (no buffer pill needed since nothing arrives).
- On next event, dot resumes pulse and pill clears with a 240ms fade.

## 3. "Live now" discovery feed

**Card anatomy — exact element order:**
- **Row 1 (header):** sport icon (left, 20px stroke) · sport/competition eyebrow (700/0.08em, muted) · live-pulse dot + `LIVE` (right).
- **Row 2 (teams + score):** team A name (weight 700) — center score block `2–1` or `21–18` (tabular-nums, weight 800, largest type on card) — team B name (weight 700). Names truncate with ellipsis; score never truncates.
- **Row 3 (context line, muted 12px):** sets/period state `· SET 2 ·` + elapsed `· 63'` + optional viewer count `· 👁 1.2k`. Order: period → elapsed → viewers.
- Card = `var(--card)`, 1px black edge, 4px radius, 16px padding, 12px vertical gap between cards. Whole card tappable → spectator page (§2), defaulting to Feed.

**Sort + filter:**
- **Sort control** (top-right segmented, mono labels): **`Recent`** (default, by `lastEventAt` desc — most-active-first) · **`Popular`** (by `viewers` desc). Selected segment `var(--primary)` underline.
- **Sport-filter chip row** — horizontal scroll above the list. First chip `All` (default selected), then per-sport chips (icon + name). Selected chip: `var(--primary)` fill, white text, 4px radius; unselected: 1px black edge, `var(--card)` fill. Sticky under the page header.

**Empty state:** centered, generous whitespace. Naked stroke icon (a dimmed pulse glyph), then headline (Swiss weight 800) **"No live matches right now"** and sub-line (muted 14px) **"Start one yourself or check back soon."** Primary action button `Start a match` (`var(--primary)` fill, white, 4px radius, hard offset shadow `4px 4px 0 var(--accent-foreground)`). If a sport filter is active with no results: **"No live {sport} matches"** + `Show all sports` text button.

**Skeleton / loading:** render 4–5 placeholder cards matching real card geometry (1px edge, 4px radius). Replace text with neutral bars at `color-mix(black 8%)`: icon square, two ~40%-width team bars flanking a ~20% score bar, one ~50% context bar. Subtle shimmer sweep ~1.2s left→right (respect reduced-motion: static bars). No spinner.

**Live-pulse indicator:** 8px solid dot, `var(--primary)`. Pulse = outer ring scales 1→2.2 and fades opacity 0.6→0 over 1.4s, infinite ease-out (the dot core stays solid). One pulse element per live card/scorebug. When stale/paused or final, dot is solid-dim and the animation is removed.

## 4. Entrance motion

Restrained, token-disciplined — motion present but never flashy. All values inline:

| Element | Motion | Duration | Easing | Notes |
|---|---|---|---|---|
| New feed row (incoming) | fade 0→1 + slide-up 8px | 200ms | ease-out (`cubic-bezier(0.16,1,0.3,1)`) | Single row; only animates when pinned at top. Reserve height to avoid layout-shift jank. |
| Initial feed list load | staggered fade + 8px slide-up | 200ms each | ease-out | Stagger delay **40ms** per row, cap at first 8 rows; rest appear instantly. |
| Key-moment row | base entrance + one-shot left-edge accent flash (1px→3px `var(--primary)`) | 240ms flash | ease-out | The only "extra" — reserved for goal/wicket/set·match point. |
| Tab switch (Feed/Scorecard/Stats) | crossfade opacity 0→1 on incoming panel | 150ms | ease-in-out | **No horizontal slide** (avoids carousel flashiness). Underline glides 150ms. |
| Discovery card list load | staggered fade + 8px slide-up | 200ms | ease-out | 40ms stagger, cap 8. |
| Live-pulse ring | scale 1→2.2, opacity 0.6→0 | 1.4s loop | ease-out | Core dot static; ring only. |
| "↑ N new plays" pill | fade + slide-up 8px in; fade out | 180ms | ease-out | |

**`prefers-reduced-motion: reduce`** — disable all slide/stagger/shimmer/pulse-ring; keep only instant opacity 0→1 (≤80ms) for incoming rows and tab panels. Live-pulse becomes a solid static dot. Key-moment flash becomes a static accent edge (no animation).

## Sources
- ESPNcricinfo ball-by-ball commentary — https://www.espncricinfo.com/live-cricket-score
- FotMob match center / Commentary tab — https://www.fotmob.com/
- Livesport tennis point-by-point — https://www.livesport.com/en/tennis/
- LiveScore live football list — https://www.livescore.com/en/football/live/
- Sofascore live scores — https://www.sofascore.com/tennis
