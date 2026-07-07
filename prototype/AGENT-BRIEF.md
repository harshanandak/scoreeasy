# Prototype module brief (for build agents)

You are building ONE file of the ScoreEasy HiFi prototype: a no-build, classic-script,
mobile-first interactive prototype. Read these before writing anything:

1. `docs/superpowers/specs/2026-07-07-hifi-prototype-design.md` — the approved design
2. `prototype/js/core.js` — the SE global you register into (read the whole file)
3. `prototype/js/app.js` — how screens mount you (score/watch routes) and what setupFields render
4. `prototype/css/tokens.css` — design tokens + component classes you MUST reuse
5. Your reference screen fragments in `prototype/reference/screens/` (named in your task)

## Hard rules

- Classic script, IIFE `(function(){ 'use strict'; ... })();` — NO import/export, NO libs.
- Use `SE.h(tag, attrs, ...children)` to build DOM. NEVER use the `html:` attr with any
  user-entered value (team names etc.) — pass them as text children.
- Reducers in `actions` are PURE: take `(snap, cfg, payload)`, return `{ snap: <new object>, label }`.
  Never mutate the incoming snap — undo works by replaying reducers from `init()`.
- Match the visual language of your reference fragment: layout, hierarchy, micro-labels,
  chips, big DM Mono numerals. Prefer tokens.css classes (`card chip microlabel bignum
  tapzone btn banner actionstrip seg row`) + minimal inline styles. Fonts come free.
- Mobile-first inside a 420px column. Big tap targets for scoring (the whole team panel taps).
- Undo button (`↩`) on every scorer → `api.undo()`.
- Spectator screens are READ-ONLY and re-render automatically on store changes — just render
  from `match.snapshot`/`match.events`. Include the last few events as a feed where the
  fragment shows one.
- If time/clock is needed, store timestamps/elapsed in the snapshot via actions
  (e.g. toggle-clock action records elapsed); use `SE.interval(fn, 1000)` ONLY to update
  displayed text from live wall-clock, never to dispatch.
- Scorer gets `api = { dispatch(action, payload), undo(), end(result), nav(hash) }`.
  `api.dispatch` auto-navigates to the result screen when `isOver` returns a result.
  `result = { summary: 'Hawks won 3–1', winnerIndex: 0|1|null }`.

## Sport def shape (register exactly this)

```js
SE.registerSport({
  key: 'volleyball', label: 'Volleyball', icon: '🏐', priority: 3,
  tagline: 'rally point',                    // short, for picker card
  sampleTeams: ['Hawks', 'Wolves'],          // from your fragment
  defaultConfig: { ... },
  setupFields: [                              // rendered by generic setup screen
    { key:'sets', label:'Best of', type:'choice', options:[{label:'3',value:3},{label:'5',value:5}] },
    { key:'target', label:'Points per set', type:'number', min:5, max:50 },
  ],
  init(config) { return { ...initial snapshot... }; },
  actions: { point: function(snap,cfg,payload){ return {snap: {...}, label:'Hawks +1'}; }, ... },
  isOver(snap, cfg) { return null_or_result; },
  headline(match) { return '24–23 · set 3'; },   // one-liner for home live card
  renderScorer(el, match, api) { el.appendChild(SE.h('div',{class:'screen'}, ...)); },
  renderSpectator(el, match) { ... },
});
```

## FIDELITY V2 (supersedes anything above that conflicts)

The first build pass was functionally correct but visually skeletal. This pass is about
1:1 visual fidelity to the reference fragments. Rules:

- **Port the fragment's DOM structure and inline styles nearly verbatim.** Open your
  reference fragment and translate each element to `SE.h(...)` keeping the exact inline
  styles (colors, px sizes, gaps, radii, shadows, DM Mono letter-spacing). The fragments
  are flow-layout (flex) — they port directly.
- **`prototype/sports/volleyball.js` `renderScorer` is the exemplar.** Read it first and
  match its porting style exactly (full-bleed root `style="flex:1;display:flex;
  flex-direction:column;background:#f4f6f3"` — NOT class="screen"; header with 32px white
  icon buttons; inline `<style>` tag via `h('style',{html:...})` for the fragment's
  keyframes like geP/geGlow; `env(safe-area-inset-bottom)` padding on the footer).
- **Skip only the iPhone status bar row** (9:41 + battery). Everything else in the
  fragment must exist on screen.
- **Every visible control must do something.** Map to a real reducer when natural; for
  soft actions (Timeout, Rotate, Swap ends, …) add a pure no-op reducer that returns the
  same snap with a good `label` so it lands in the event feed. Never render dead UI.
- Decorative live-ish numbers (viewer counts) may derive from `match.events.length`.
- Keep your existing rules/reducers intact — extend, don't regress. Undo must keep working.
- Scorer AND spectator both get this treatment (5x and 6x fragments).

## Definition of done

- File loads with zero console errors when opened via `prototype/index.html`.
- A full match can be scored start→finish with your reducers; `isOver` fires correctly.
- Undo mid-match replays correctly (pure reducers make this automatic).
- Scorer and spectator both visually echo your reference fragments.
- Report back: file path, the rules you implemented, anything from the fragment you
  intentionally dropped or simplified, and anything you could NOT verify.
