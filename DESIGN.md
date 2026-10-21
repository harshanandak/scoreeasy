# Score Easy visual direction

Status: cross-screen direction, 2026-10-21. Harsha chose it over Mono. Only the
volleyball scorer implements it so far (PR #157, `TeamSetsBoard`, recorded in
docs/plans/2026-10-20-direction-e-app-design.md, "Design revision 2"). Home,
Play, setup and the other scorers still ship Mono; their current tokens and
behaviour remain the source of truth until a reviewed change moves them.

## Reference

Use Refined Soft from the left column of
docs/plans/2026-10-20-direction-e-app-screens/scorer-options-A-B-C.png as the
overall app language. Retain clearly defined controls from the middle column,
especially scoring, Undo/More, and deliberate Finish. The exact control mix is
being evaluated; do not restore a heavy frame around every surface.

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

Review the direction across Home, Play, setup, scorer, and Finish first. Then
update shared tokens and components and complete one flow at a time. Preserve
the sport rules, persistence, routing, auth, and undo logic. Revise the older
governance documents alongside any implementation that changes their promises.
