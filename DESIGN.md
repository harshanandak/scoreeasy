# Score Easy visual direction

Status: The Kit is the decided app style (owner, 2026-11-13: 'we should only use kit design style ... design style that's been decided already'). It lives in src/index.css (--se-* tokens, .se-ctl, .se-go), src/designs/design1-mono/kit/*.css, scoring/boardShell.css and scoring/teamBoard.css. mono.css is the older layer: do not design from it. A redesign changes layout, not style, unless Harsha asks for a style change.

Where the Kit is in the code (checked 2026-11-13): `TeamSetsBoard` is used by
`MonoQuickMatch.jsx` and `MonoSetsLiveScore.jsx`. Home
(`landing/DashboardLanding.jsx`, the route at `APP_ENTRY_PATH`) and Play
(`MonoPlayHub.jsx`) import `kit/KitParts`. The cricket, goals, kabaddi and
tennis boards import the shared `BoardShell`. `mono.css` is still imported by
`src/designs/design1-mono/index.jsx`, so older classes can still render; new
work does not copy from it. `MonoHome.jsx` is not routed.

Source gap: `boardShell.css` and `BoardShell.jsx` cite "Kit plan 2026-10-22",
and `src/index.css` cites "plan 2026-10-22 §4". No such plan document is in the
repo. The `kit-*` folders under `docs/plans/` hold screenshots, and two of
them also hold implementation evidence (`2026-10-23-kit-s5-share-live/` and
`2026-10-23-kit-s6/` have a README.md and a JSON audit file); none is the plan. The CSS files named above are the
source of truth for the Kit until that plan is written down.

## Reference

Use Refined Soft from the left column of
docs/plans/2026-10-20-direction-e-app-screens/scorer-options-A-B-C.png as the
overall app language. Retain clearly defined controls from the middle column,
especially scoring, Undo/More, and deliberate Finish. The control mix is
decided: `.se-ctl` is the pressed control (2px ink border, ink offset shadow)
and `.se-go` is the one forward action per screen, both in `src/index.css`. Do
not restore a heavy frame around every surface.

## Physical setting

A scorer stands courtside in daylight, holds a phone in one hand, and needs to
record the next point quickly. Keep the light direction, readable numbers, and
reachable controls.

## Surfaces and spacing

Use neutral light canvas, white surfaces, generous but purposeful spacing,
rounded panels, fine borders, and restrained ambient shadows. Keep information
hierarchy and touch geometry consistent across Home, Play, setup, scoring, and
confirmation dialogs. Do not hide controls to make a mockup look cleaner.

## Colour and type

Team identity uses the existing colour engine and its contrast-gated text.
Preserve green for primary go actions and live state; danger red is for
destructive actions. Use a readable sans for interface labels and tabular
numerals for scores. Large score numerals may use the scorer's existing condensed
face. Avoid uppercase monospace on every label.

Behind the score: the team gradient, plus the sport's ball-and-action mark on
the serving team's key only (src/lib/sportMarks.js, painted in the engine's
gated motif colour). No court line drawings on the scorer.

## Controls and state

Use clear boundaries and strong ink on Undo, More, and Finish, with the lighter
surface language around them. Selection and keyboard focus must look different.
Provide pressed, disabled, loading, error, and focus states. Keep Undo at the
bottom, with the score it restores. Confirm Finish and Discard distinctly.

## Rollout

The Kit is already applied across Home, Play, setup, scoring, finish, history,
stats, tournaments and sign-in (Kit CSS in `src/designs/design1-mono/kit/` and
`src/designs/design1-mono/scoring/`). New screens and redesigns reuse its tokens
and classes. Preserve the sport rules, persistence, routing, auth, and undo
logic. Revise the older governance documents alongside any implementation that
changes their promises.
