# HiFi Interactive Prototype — Design

**Date:** 2026-07-07 · **Branch:** `feat/prototype-redesign` · **Status:** approved (user: "go")

## Goal

Turn the static HiFi board (`prototype/reference/hifi-source.html`, 38 screens) into a **fully interactive, connected prototype** to test the redesigned UX before building the real app. Throwaway code, real feel: every sport's scoring rules work, spectator mirrors scorer live, rematch carries setup. Focus on games played in Indian schools/colleges; sports that can't reach a great experience get dropped after testing.

## Decisions (user-approved)

- **Base screens:** refined set only — 5a–5h scorers, 6a–6h spectators, 3a–3c result/rematch/records, 4a–4c scheduler/ground/home. v1 screens (1x/2x) dropped.
- **Fidelity:** fully interactive, all 8 sports (cricket, football, basketball, volleyball, kabaddi, badminton, tennis, hockey).
- **Form:** standalone no-build prototype (Approach A) at `prototype/` in the repo. Plain HTML/CSS/JS, classic `<script>` tags (works from `file://` and any static server), mobile-first full-viewport (max-width 420px).
- **Missing connective screens** (home-first entry, sport picker, match setup) are synthesized in the mockup's visual language.

## Design language (extracted from mockup)

- Ink `#14201a`, soft `#46554d`, muted `#6b7a72`, faint `#9aa8a0`; lines `#e4e9e5`/`#dfe7e1`; canvas `#f1f5f1`; surface `#f4f6f3`; card `#fff`; accent `#12936a` (live `#1aa75e`, soft `#e7f4ee`).
- Fonts: **Hanken Grotesk** (UI) + **DM Mono** (numerals/labels).
- Soft-rounded cards (14–18px), soft green shadows (`0 18px 42px -22px rgba(16,90,55,.5)`), pill chips, uppercase mono micro-labels.

## Architecture

```
prototype/
  index.html          shell; loads everything with classic script tags
  css/tokens.css      design tokens + shared component classes
  js/core.js          SE global: hash router, store (localStorage + BroadcastChannel), h() DOM helper
  js/app.js           screen registry, Home / Sport picker / Setup screens, boot
  sports/<sport>.js   one per sport — registers via SE.registerSport(def)
  flows/*.js          result, rematch, records, scheduler, ground-type, upcoming
  reference/          source fragments (split-screens.mjs output) — read-only
```

### Store (`SE.store`)

State persisted to `localStorage['se-proto']`, change events broadcast via `BroadcastChannel('se-proto')` + `storage` event → **spectator open in a second tab mirrors the scorer in real time**. Shape:

```js
{ matches: { [id]: Match }, scheduled: [...], settings: {...} }
Match = { id, sport, teams: [{name}], config, status: 'live'|'done',
          events: [Event], snapshot, startedAt, endedAt, result }
```

### Sport module contract

```js
SE.registerSport({
  key, label, icon, priority,          // priority = India schools/colleges rank
  defaultConfig, setupFields,          // generic Setup screen renders from these
  init(config) -> snapshot,
  actions: { [name]: (snap, cfg, payload) -> { snap, label } },  // PURE reducers
  isOver(snap, cfg) -> result | null,  // result = { summary, winnerIndex }
  renderScorer(el, match, api),        // api = { dispatch(action,payload), undo(), end(), nav }
  renderSpectator(el, match),          // read-only, re-invoked on store change
})
```

**Undo = event sourcing:** `events` is the log; undo pops the last event and replays reducers from `init`. No reducer ever mutates.

### Router

Hash-based: `#/home` `#/pick` `#/setup/:sport` `#/score/:id` `#/watch/:id` `#/result/:id` `#/records` `#/schedule` `#/ground` and dev index `#/board`.

### Flow wiring

Home → Pick sport → Setup → **Scorer** ⇄ (Share live) **Spectator** → match over → **Result moment** → Rematch (setup carried, one tap) / Records (streaks). Home also surfaces Scheduler → Ground type → Upcoming.

## Per-sport rules (prototype-real, not exhaustive)

| Sport | Core rules implemented |
|---|---|
| Cricket | runs 0–6, wicket, wide/no-ball (+1, ball not counted), overs config, 2 innings, target/chase, result |
| Football | goals, halves + running timer, cards optional |
| Basketball | +1/+2/+3, quarters, team fouls, timer |
| Volleyball | rally point, win-by-2 to target, best-of sets, serve tracking, set/match point detection |
| Kabaddi | raid/tackle points, all-out +2, 30s raid clock, halves |
| Badminton | to 21 win-by-2 cap 30, best-of-3, serve follows rally winner |
| Tennis | 0/15/30/40/adv, games/sets, 7-pt tiebreak, break-point detection |
| Hockey | goals, quarters, penalty-corner count |

## Multi-agent build plan

1. **Shell (session, Fable):** `index.html`, `tokens.css`, `core.js`, `app.js` — the contract everything implements.
2. **8 sport agents (Sonnet, parallel):** each reads its two fragments (`5x`, `6x`) + this spec, writes exactly `sports/<sport>.js`. No shared files → no conflicts.
3. **1 flow agent (Sonnet):** reads `3a–3c`, `4a–4c`, writes `flows/*.js`.
4. **Integration + review (session):** wire script tags, Playwright walk of every flow, fix, per-sport adversarial review where warranted.

## Testing

Manual: open `prototype/index.html` (or `npx serve prototype`) on desktop + phone; scorer in one tab, `#/watch/:id` in another. Automated: Playwright smoke — every route renders, one full match per sport scores to completion, undo replays correctly, rematch carries config.

## Out of scope

Backend/Convex, auth, real sharing, offline sync, the existing app's code. This is a disposable UX test bench; the real app gets rebuilt properly from what survives.
