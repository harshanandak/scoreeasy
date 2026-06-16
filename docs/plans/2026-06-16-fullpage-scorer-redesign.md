# Score Easy — Full-Page Live Scorer Redesign (Mobile-First)

**Design name:** Whistle Arena — full-bleed referee-speed scorer
**Date:** 2026-06-16
**Target files:**
- `src/designs/design1-mono/MonoQuickMatch.jsx`
- `src/designs/design1-mono/mono.css`

## 1. Concept

Turn the live scorer from a centered, top-stacked **document** into a full-bleed **instrument**. The two team scores become full-bleed tap halves that fill 100dvh corner-to-corner — the numeral is the hero (up to ~22vh), labels collapse to a single mono overline, all chrome is flat hairlines, and every global verb lives in the sticky frosted bottom strip the cricket engine already ships. One 100dvh shell, four engines.

This is a synthesis: arena geometry + score-as-hero from **Full-Bleed/Whistle**, accent-rationing + single-brutal-object discipline + real-class-name honesty from **Ledger**, and the keep-the-visible-minus feasibility win from **Broadcast Board**.

## 2. Verified ground truth (checked against the files)

- The `.mono-scorer-*` and `.mono-score-*` class families **exist** and are reusable: `.mono-scorer-screen` (100dvh, safe-area, mono.css:900-903,1153-1156), `.mono-scorer-shell` (905-908), `.mono-scorer-topbar` (910-916), `.mono-scorer-score-value` (931-934; mobile clamp 1180-1182), `.mono-scorer-run-grid/-button(-accent)/-extra-row` (940-971), `.mono-scorer-control-strip` (973-975), `.mono-score-pad` (848-877), `.mono-score-grid` (842-846), `.mono-score-mini` (889-894).
- **Cricket already uses the unified shell + sticky frosted bottom bar** (`.mono-scorer-screen`, JSX:2217-2218; sticky strip mono.css:1241-1252 with `env(safe-area-inset-bottom)` + `backdrop-filter:blur(12px)` + `box-shadow:none`). **Goals and sets do NOT** — they use raw `min-h-screen px-6 py-10` + `max-w-2xl mx-auto` (JSX:2363-2364, 2510-2511) and miss the mobile padding + sticky bar entirely.
- The **150ms debounce silently returns** (JSX:971 in `addPoint`, and the `addGoal` twin) — `scoreImpact()` already fires on accept (JSX:973) but a dropped fast tap gives no feedback.
- `CorrectionControls` is a visible `-1` pill (JSX:126-139) — the only decrement; there is **no** existing long-press / `touch-action` / `contextmenu` infra to build on, and a11y is thin (1 `aria-live`, 1 `sr-only` heading).
- Live hardcoded-hex violations in the cricket branch: `#888`, `#111`, `#bbb`, `#555`, `#0066ff`, `#ff6b00` (JSX:2228-2336); `.mono-badge` uses system-ui (not JetBrains Mono); `.mono-quick-end-button` uses `#dc2626`.

## 3. Page regions

| Region | Sizing | Tokens / classes |
|---|---|---|
| **Shared shell** | `100dvh` flex column (svh fallback): spine(auto)/arena(1fr)/strip(auto sticky) | `.mono-scorer-screen`, `.mono-scorer-shell` + NEW `.mono-arena-shell` |
| **Top spine** | ~48-56px, flat, 1px @14% bottom hairline | `.mono-scorer-topbar`; mono-700 tabular timer; `.mono-badge` (fix font → `var(--se-font-mono)`) |
| **Team Half A / B** (goals/sets) | each `flex:1`, no cap; numeral `clamp(4rem,22vw,11rem)`; brutal 0 radius; 1px black edge; shadow-on-press only | `.mono-score-pad` + NEW `.mono-arena-half`; `.mono-score` (tabular-nums); `--score-accent` |
| **Center seam** | ~30-40px, flat, collapses when empty | NEW `.mono-arena-seam` (1px @14% hairlines); serve dot |
| **Cricket region** | hero ~38% + instrument fills rest | `.mono-scorer-main-score`, `.mono-scorer-run-grid/-extra-row`, `.mono-quick-wicket-button` |
| **Bottom strip** | sticky, frosted, 44px+, safe-area | `.mono-scorer-control-strip` (mono.css:1241-1276), `ThumbActionBar` |

## 4. Interaction model

- **+1:** tap anywhere in a team half → `addGoal`/`addPoint` (whole-half button preserved). `scoreImpact()` + 120ms `.mono-score-animate` pop.
- **Dropped-tap feedback (NEW):** at the 150ms debounce `return` (JSX:971 + twin), add `void warningImpact()` + a brief dimmed pulse so debounced fast taps aren't silent.
- **−1 (hybrid, additive):** keep the **visible `-1` pill** (`CorrectionControls`, the accessible fallback) AND add long-press (~450ms) anywhere in the half → `adjustGoalScore`/`adjustSetScore(team,-1)` + `correctionImpact()`. Set `touch-action:manipulation` + `user-select:none` + `onContextMenu` preventDefault. Long-press is never the only path.
- **Quick-value sports:** `hasQuickButtons` disables the half tap (as today); render `quickButtons` as large in-half segmented buttons (≥52px, mono 800) → `addGoal(team,value)`.
- **Swap:** bottom-strip Swap (goals/sets only) → `handleSideSwap`; visual only, data stays team1/team2.
- **Undo:** first-class bottom-strip Undo (drop the 0.42 disabled opacity → clear locked color) → per-engine histories.
- **End:** bottom-strip End (red outline, farthest from +1) → `requestEndMatch` → two-step `EndMatchDialog`; Escape/focus-restore/draw-guard kept.
- **Serve:** seam serve dot follows `servingTeam` for `tracksPointWinnerServe` sports.
- **Timer:** display-only, promoted to glanceable spine clock.
- **a11y/motion:** keep aria-labels, sr-only heading, aria-live, inset focus ring; all pops/pulses collapse under `prefers-reduced-motion`; haptics still fire.

## 5. Per-engine adaptation

- **Goals:** two stacked halves, tap=+1; quick-button sports dock in-half value buttons; points-mode → 'FIRST TO N' in seam.
- **Sets:** same halves (current-set points); best-of sets-won tally + serve dot + win-by-2 rule move into the seam; `validateSingleSetScore` finalize unchanged.
- **Points-to-target:** same halves; seam 'FIRST TO N · WIN BY 2'; no sets-won tally.
- **Cricket:** single batting hero + thin other-innings line; real 7-run grid + extras + full-width Wicket ('Run Out Only' on free hit) + Trial-Ball Skip; banners become one-line chips; no Swap (2-col strip).

All four keep `addPoint/addGoal/addRuns/addWicket`, the three undo histories, draft auto-save, side-swap and serve mappings. **Reskin + token cleanup, never a logic change.**

## 6. Mono design-system fit

- **Single green accent** `var(--primary)` rationed to the leading/serving team; team2 = `var(--se-color-warning)` brown; white-on-accent via `var(--se-color-inverse)`. All `#0066ff`/`#ff6b00`/`#888`/`#111`/`#bbb`/`#dc2626` purged.
- **Lines:** 1px pure-black = half edges; 1px @14% = spine/seam/strip hairlines; 2px reserved for emphasis.
- **Radius:** 0 brutal score halves, 4px buttons, 8px End dialog.
- **Brutalism-as-action:** hard 3px/3px/0 offset shadow + bold mono only on press surfaces (`:active` on the halves, run buttons, End dialog); spine/seam/frosted strip are flat with hairlines and NO shadow.
- **Type:** JetBrains Mono 700 eyebrows/labels, 800 action labels, Inter body, tabular-nums numerals.

## 7. Implementation plan (ordered)

0. **Token + a11y debt cleanup** (cricket branch + `.mono-badge` + End button) — ship first.
1. **Add arena shell CSS** (`.mono-arena-shell`, `.mono-arena-half`, `.mono-arena-seam`, numeral clamp) — reuse the existing family.
2. **Migrate goals** onto the shell + two `.mono-arena-half` buttons.
3. **Migrate sets** identically; move sets-won/serve/rule into the seam.
4. **Cricket polish:** banners → one-line chips.
5. **Promote** timer + Undo.
6. **Dropped-tap feedback** at the debounce + accept pop.
7. **In-zone long-press −1** (additive; keep the pill).
8. **Capacitor/device QA** (svh/dvh, sticky, safe-area, short screens, gesture collisions).
9. **Regression + a11y pass** (47 logic tests stay green; VoiceOver/TalkBack/focus/reduced-motion).

## 8. Risks

Long-press discoverability/accidental-trigger (mitigated by keeping the visible pill); 100svh/dvh on old WebViews; mis-tap near the strip; cricket density on short screens; accent flicker on ties; reduced-motion compliance; a11y regression on borderless halves; familiarity shift from 'two cards' to full-bleed.

## 9. Open questions

1. Long-press −1 in v1, or pill-only first?
2. Cricket asymmetric hero vs forced symmetric halves?
3. Accent on leading/serving team only, or tint both halves?
4. Numeral clamp ceiling (reflow safety for cricket)?
5. Relocate quick-buttons into the halves — confirm?
6. Ship token/a11y cleanup as a separate PR or bundle?

## 10. Cricket — CrickHeroes reference (from user-provided screenshot)

The CrickHeroes live scorer (Lions XI screenshot) shows this anatomy, top→bottom:
1. **Top bar:** back · batting-team name · share + settings.
2. **Hero (dark):** big `47/0` with overs `(5.5/10)` inline; sub-line `CRR: 8.06 · Projected: 80 (at 8.06 RPO)`.
3. **Batsmen strip:** striker `Ankit Jha 27(20)` (highlighted) | non-striker `Aaryan Shah 20(15)`.
4. **Bowler row:** `Amit Patel` + figures `1.5-0-23-0`, and a **this-over ball strip** of circles `1 0 0 0 6` (the 6 accent-filled).
5. **Keypad (light):** runs grid `0 1 2 / 3 4(FOUR) 6(SIX)`, a right column `UNDO / 5,7 / OUT`, and an extras row `WD NB BYE LB`. Footer: "Scoring Shortcuts".

### Feasibility against our data model (`{runs, balls, wickets}` + `cricketHistory` per-delivery log)

**Build now (UI + trivial derivation, no new storage):**
- **This-over ball strip** — derive the current over's deliveries from `cricketHistory` (legal balls = `runs`/`wicket` entries this innings; `extra` shown as WD/NB pips). Boundaries (4/6) get the green accent. This is the signature CrickHeroes element and it's free.
- **CRR + projected score** sub-line under the hero (`projected = runRate × totalOvers`).
- **Bigger runs/wickets hero** filling the arena top, overs in parens.
- **BYE / LB extras** added beside WD/NB (small `addExtra` extension).
- **Clean keypad** in the Mono system: grouped run buttons (4=FOUR, 6=SIX accent), prominent OUT, extras row — replacing today's scattered rows.

**Needs a real feature (data + logic, NOT a reskin) — flagged for decision:**
- **Striker/non-striker batsmen** with runs(balls) + strike rotation, and **bowler** name + O-M-R-W figures. Our quick-match cricket is team-level only; adding per-player tracking is a sizable feature with storage + strike-rotation rules.

**Decision:** ship the team-level CrickHeroes look (hero + this-over strip + CRR/projected + BYE/LB + keypad) now; treat batsman/bowler tracking as a separate opt-in feature.

---

## 11. As-built design system — canonical scorer language (2026-06-16, shipped on PR #86)

This is the authoritative set of decisions realized in `MonoQuickMatch.jsx` + `mono.css`. **Every scoring surface must follow it** (see §12 for the propagation checklist). No one-off restyles, no hardcoded hex — tokens only.

### 11.1 No boxes — line-divided, open zones
- Team score "halves" are **borderless open tap zones**, NOT bordered/filled cards. No `border`, no fill, no radius, no shadow at rest. (`.mono-arena-half`)
- **Tap zones are always LEFT/RIGHT (side by side), never top/bottom** — people score with two thumbs side-by-side, in BOTH portrait and landscape. `.mono-arena-grid` is `flex-direction: row` with `gap: 0`; the two zones split by a **single vertical 1px @14% hairline seam** (`.mono-arena-col + .mono-arena-col` border-left). Columns use `min-width: 0` to stay equal regardless of score width; the numeral clamp is width-aware (`clamp(3rem, min(22vh, 26vw), 8rem)`) so a 2-digit score fits a ~50vw column. Short/landscape viewports get a `@media (max-height: 540px)` compaction (tighter padding, hidden hint).
- **Known gap:** on landscape *phones* the page still scrolls ~the global top-nav height — the wide-screen nav + the full-height (`100dvh`) scorer overflow. The arena itself fits; the fix is an app-shell change (immersive/compact nav on scorer routes in landscape), tracked separately.
- The leading team is marked by a **short 2px accent baseline** under the numeral (`.mono-arena-half[data-leading="true"] .mono-arena-num::after`, width 56px) — the decisive "who's ahead" cue replaces the box.
- Press feedback = a brief **accent-tint flash** only (`:active { background: color-mix(--score-accent 10%, surface) }`) — never a permanent box, transform, or shadow.
- Focus = **inset** ring (`outline-offset: -3px`), since there's no frame for an outer ring to hug.

### 11.2 Cricket keypad — brutalist-monotone, fading lines
- **No tile grid, no box.** Keys sit transparent on the open canvas. Structure is carried only by **soft gradient hairlines that bleed out / fade at the ends** (`linear-gradient(<dir>, transparent, var(--cricket-line), transparent)`), never solid full borders. Drawn via the container's `background-image` (edges + grid dividers) and `::before` pseudo-elements (per-cell dividers). `--cricket-line: color-mix(--se-color-line 46%, transparent)`.
- Run buttons are a **comfortable capped size** (`grid-auto-rows: clamp(72px, 12vh, 104px)`), never stretched to fill (no `flex: 1` on `.mono-cricket-keys`).
- **Boundaries (4 & 6) share the single green accent** (`var(--primary)`) so they read as a matched pair — never two different colours (the old brown-4 / green-6 is dead).

### 11.3 Hero & rhythm
- The cricket hero is the **flex sink** (`.mono-quick-cricket-score { flex: 1 1 auto; justify-content: center }`) — it absorbs slack and centres the batting summary so the score breathes with even whitespace; the keypad stays a comfortable block below. Fill the viewport, **no scroll, no empty band**.
- Score line: **baseline-aligned flex, tabular-nums** — big runs, faint `/wickets` (0.42em), muted uppercase `(overs)` (0.2em).
- Generous top spacing (mobile screen padding-top 16px; topbar→seam ~18px).

### 11.4 Chrome — controls, not cards
- **Bottom action strip:** flat, line-divided tiles (no boxed buttons). Undo is an **icon-only ~46–58px square**; labelled actions (Swap) fill the rest as **uppercase mono labels**; a **short centered 22px fading divider** between tiles. Cricket folds Undo into the **OUT row** (no separate strip).
- **End Match** = a small top **chip** (`.mono-scorer-end-chip`), red outline, `aria-label="End Match"`. Not a big bottom button.
- **Topbar** = a flat spine, items vertically centered, no heavy frame.

### 11.5 Notices — transient & toned
- The **resume info** ("Resumed your match") is a **transient toast**: fixed top-centred pill, green status dot, **fades in → holds → fades out over ~3.3s then auto-dismisses** (`mono-note-toast` + a JS timeout), does NOT shift layout. Reduced-motion → static + timeout-dismiss.
- Genuine **save errors** (danger) and **end-match validation** (warning) keep a proper in-flow `.mono-alert` box. Tone is derived in `ScoringNotice` (info | warning | danger).

### 11.6 Tokens, lines, motion (hard rules)
- **Tokens only.** `var(--primary)` (single green accent), `var(--se-color-warning)` brown (team-2 only), `var(--destructive)`, `var(--se-color-ink/-muted/-faint/-soft)`, `var(--se-color-surface)`, `var(--se-color-line)`, `var(--se-color-inverse)`, `var(--se-font-mono)`. **`#0066ff` is dead** — purge it and all `#888/#111/#ddd/#ccc/#fffbeb/#dc2626`-style literals.
- **Lines:** 1px pure black = object edge (rare); **1px @14% = interior divider/seam**; 2px = emphasis only (e.g. leading baseline). No 1.5px.
- **Radius:** 0 brutal score zones / keypad, 4px buttons, 8px dialogs.
- **Brutalism-as-action:** bold/fill/shadow only on press; ambient chrome is flat hairlines, no shadow.
- All animations collapse under `prefers-reduced-motion`; PropTypes defined on every in-file component.

## 12. Propagation — apply the §11 language to ALL scoring surfaces

`MonoQuickMatch.jsx` (cricket/goals/sets quick) is **done**. The following still use the **old design** (boxy blue `.mono-score-pad`/`.mono-score-grid`, dead `#0066ff`, hardcoded hex) and must be brought onto §11:

| Surface | Old debt | Action |
|---|---|---|
| `scoring/MonoTennisLiveScore.jsx` | boxy `.mono-score-pad`, `#0066ff` border, `#888/#111/#ddd/#ccc` | borderless line-divided score zones + tokens |
| `scoring/MonoGoalsLiveScore.jsx` | same | same |
| `scoring/MonoSetsLiveScore.jsx` | same | same |
| `scoring/MonoCricketLiveScore.jsx` | `#0066ff` + hardcoded hex, run-button grid | token cleanup; align keypad to §11.2 |
| `scoring/MonoCricketTestLiveScore.jsx` | same | same |
| `MonoCricketTournament.jsx`, `GenericGoalsTournament.jsx`, `GenericSetsTournament.jsx`, `MonoTournamentSetup.jsx`, `MonoTournamentList.jsx`, `MonoTournamentLiveScore.jsx` | `#0066ff` + hardcoded hex | token + line-divided pass (tournament family — secondary scope) |

**DRY lever:** the three two-team live scorers (Tennis/Goals/Sets) share `.mono-score-grid` + `.mono-score-pad`. Restyle those classes once in `mono.css` to the borderless line-divided design (§11.1) and remove the inline `#0066ff`/hex overrides in each file — that updates all three together. Keep the `AppOwnedScoringPrompts.test.jsx` contract in sync with any class changes.
