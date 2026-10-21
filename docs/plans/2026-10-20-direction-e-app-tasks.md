# Direction E in the app — task list

Design: `docs/plans/2026-10-20-direction-e-app-design.md` · epic `direction-e-in-the-9be869f4` (forge issue) · branch `feat/direction-e-app`

Waves run in order; tasks inside a wave own disjoint files. Every task is TDD: write the test,
watch it fail, implement, watch it pass, commit.

## PR plan (one point per PR, one PR per game)

Harsha asked (2026-10-21) for optimal-size PRs, one per game. Each sport carries a
`teamColour: true` flag in its own `sportRegistry.js` entry; boards render the Direction E arena
only for flagged sports, so each game ships in its own PR without conflicting with the others.

| # | Branch | Point | Tasks |
|---|---|---|---|
| 1 | `feat/team-colour-engine` | Colour engine + court drawings (library only, no UI change) | 1, 2 |
| 2 | `fix/live-team-colour-hex` | Server stores a team colour only when it is a strict hex | 11 |
| 3 | `feat/team-colour-arena` | Rule 7, arena styles + Tailwind tokens, `useTeamColours`, `TeamColourPicker`, per-sport flag (all off) | 3, 4, 5, 6 + flag helper |
| 4 | `feat/team-colour-volleyball` | Volleyball in team colour: quick-match picker, draft, live share, and the new team-colour scorer (option B, see design revision) | 7, 8 (sets) |
| 4b | `feat/team-colour-tournament-sets` | Tournament sets board on the same scorer for flagged sports | 9 |
| 5 | `feat/team-colour-football` | Football in team colour: goals boards (quick + tournament) | 8 (goals), 10 |
| 6 | `feat/team-colour-spectator` | Spectator scorebug in team colour for flagged sports | 12 |
| 7–16 | `feat/team-colour-<sport>` | One per sport: badminton, tabletennis, pickleball, squash, basketball, hockey, handball, futsal, kabaddi, rugby. Flip the flag, test that sport's board (its own controls, swap, undo), phone screenshot | 13 (per sport) |

Tennis stays out (own layout). PRs 1 and 2 are independent of each other; 3 stacks on 1; 4–6 stack
on 3; 7–16 branch from master once 4 (sets sports) or 5 (goals sports) has merged. Every game PR
carries its own phone screenshots and acceptance walk (Task 13 is split across them).

---

## Wave 1: foundations

### Task 1: Colour engine
OWNS: `src/lib/teamColour.js`, `src/lib/teamColour.test.js`
Anchors: success criteria 3, 4; edge cases (invalid hex, near-identical, defaults); OWASP A03.
What to implement: port the Direction E engine from `docs/plans/2026-07-26-icp-games-design/directions/e-broadcast/volleyball.html` (the "Colour engine" script) to plain ES module JS, light theme only:
`normaliseHex(input) → '#rrggbb' | null` (accepts `#rgb`, `#rrggbb`, with or without `#`; rejects everything else),
`DEFAULT_TEAM_COLOURS = { a: '#d62828', b: '#1d4ed8' }`, `PRESETS` (the six pairs),
`deriveTeamColours(aHex, bHex) → { A, B, note }` (each team: `hi, core, lo, on, veil, scrimA, tint, line, motifCol, motifA, band`; invalid input → defaults; never throws),
`contrastReport(derived) → [[label, ratio, min], …]`,
`teamColourVars(derived) → { '--team-a-hi': …, '--team-a-core': …, '--team-a-lo': …, '--team-a-on': …, '--team-a-scrim': 'rgba(…)', '--team-a-tint': …, '--team-a-line': …, '--team-a-motif': 'rgba(…)', …same for b }`.
Neutrals come from the light `--se-*` palette (canvas/surface/ink), hard-coded as constants matching `src/index.css`.
TDD steps:
  1. Write `teamColour.test.js`: scenarios 1–5 from the design (happy path; all six presets pass every `contrastReport` row; clash `#e11d2a` v `#e11d2b` → ΔE ≥ 0.15 and hue kept within ±10°; `normaliseHex('red;background:url(x)') === null` and `deriveTeamColours('nope', null)` equals the defaults; extremes `#000000`/`#000000`, `#ffffff`/`#ffff00`, `#39ff14`/`#ff00ff` all pass).
  2. Run `bun run test src/lib/teamColour.test.js`: fails with "Failed to resolve import ./teamColour".
  3. Implement the module.
  4. Run again: all pass.
  5. Commit: `feat(colour): team colour engine with contrast-gated tokens`
Expected output: about 12 passing tests, no failures.

### Task 2: Court motifs for the 12 sets + goals sports
OWNS: `src/lib/courtMotifs.js`, `src/lib/courtMotifs.test.js`
Anchors: success criterion 2; motif decision (all 12).
What to implement: `COURT_MOTIFS` keyed by registry sport id: volleyball, badminton, tabletennis, tennis, pickleball, squash, football, basketball, hockey, handball, futsal, kabaddi, rugby. Each is SVG body markup in viewBox `0 0 400 260`, black stroke on transparent, team A half on the left. Port volleyball, badminton, football, basketball and kabaddi from `motifs.html`; draw table tennis, tennis, pickleball, squash, hockey, handball, futsal and rugby to regulation proportions in the same style. `motifMaskUrl(sportId, half?) → 'url("data:image/svg+xml,…")' | null` (`half` = 'a' | 'b' crops to that team's half, for the keys).
TDD steps:
  1. Test: every sets/goals sport id in `src/models/sportRegistry.js` has a motif; `motifMaskUrl` returns a `url("data:image/svg+xml,` string that decodes to a parseable SVG (DOMParser has no `parsererror`); unknown sport → `null`; `half='a'` uses viewBox `0 0 200 260`.
  2. Run: fails (module missing).
  3. Implement.
  4. Run: passes.
  5. Commit: `feat(motifs): court line drawings for the 12 sets and goals sports`
Expected output: about 4 passing tests (one parametrised over 13 ids).

### Task 3: Governance rule for team colour
OWNS: `src/designs/design1-mono/BLEND-GOVERNANCE.md`, `src/designs/design1-mono/blendTokens.test.js`
Anchors: governance decision.
What to implement: add rule **7. Team colour = identity on scoring and live surfaces.** On scoring and spectator screens each team's own colour (from the colour engine only, never a raw hex) fills its half and keys; green there is limited to the LIVE badge and app actions; lead and tie are not colour-coded. The hard shell still holds (§4). Update §1 to point at §7 for the scoring exception.
TDD steps:
  1. Extend `blendTokens.test.js`: the governance doc contains a "7." rule mentioning "Team colour" and "colour engine".
  2. Run: fails.
  3. Edit the doc.
  4. Run: passes; the existing six-rule assertions still pass.
  5. Commit: `docs(governance): team colour owns scoring and live surfaces (rule 7)`

## Wave 2: shared UI pieces

### Task 4: Tokens + Direction E arena styles
OWNS: `src/index.css`, `src/designs/design1-mono/mono.css`, `src/designs/design1-mono/teamArena.css.test.js`
Anchors: success criteria 2, 7; Tailwind decision.
What to implement:
- `src/index.css` `@theme inline`: `--color-team-a: var(--team-a-core)`, `--color-team-a-on: var(--team-a-on)`, `--color-team-a-tint: var(--team-a-tint)`, `--color-team-a-line: var(--team-a-line)`, plus the same for b. Fallbacks on `:root` = the engine output for the default pair.
- `mono.css`: `.mono-arena-grid[data-team-colour]` variant. Each `.mono-arena-col` gets a team gradient (`--team-x-hi → core → lo`), `.mono-arena-overline` / `.mono-arena-num` / `.mono-arena-hint` use `--team-x-on`; the numeral sits on a blurred `--team-x-scrim` ellipse (`::before`); a `.mono-arena-motif` layer (mask = `--sport-motif-x`, background = `--team-x-motif`) sits behind the content. Press feedback: brightness dip, not a tint. `.mono-arena-action` buttons inside a team column use `--team-x-tint` with ink text (≥4.5:1, from the engine). Keep the brutalist outer border and hard shadow on the grid (§4). Columns keep `min-height` ≥ the current values (thumb targets).
TDD steps:
  1. `teamArena.css.test.js` (reads the CSS files like `blendTokens.test.js` does): `@theme` has the 8 `--color-team-*` entries; mono.css has the `[data-team-colour]` selectors for the gradient, on-colour text, scrim and motif; there's no `transform` in `.mono-arena-half:active`.
  2. Run: fails.
  3. Implement.
  4. Run: passes; `blendTokens.test.js` still passes.
  5. Commit: `feat(arena): Direction E team-colour styles and Tailwind team tokens`

### Task 5: `useTeamColours` hook
OWNS: `src/designs/design1-mono/scoring/useTeamColours.js`, `src/designs/design1-mono/scoring/useTeamColours.test.jsx`
Anchors: approach step 3.
What to implement: `useTeamColours(colourA, colourB, sportId)` → a memoised `style` object = `teamColourVars(deriveTeamColours(a, b))` plus `--sport-motif-a/-b` from `motifMaskUrl(sportId, 'a'|'b')` (omitted if `null`).
TDD steps:
  1. Test with `renderHook`: defaults when both are undefined; the same inputs return the same object (memo); an invalid colour falls back; football includes `--sport-motif-a`.
  2. Run: fails. 3. Implement. 4. Run: passes.
  5. Commit: `feat(arena): useTeamColours hook`

### Task 6: `TeamColourPicker`
OWNS: `src/designs/design1-mono/TeamColourPicker.jsx`, `src/designs/design1-mono/TeamColourPicker.test.jsx`
Anchors: success criterion 1; invalid-hex edge case.
What to implement: a radiogroup of 6 swatches (from the engine's `PRESETS` colours, de-duplicated) plus a "Custom" native `<input type="color">`. Props: `label`, `value`, `onChange(hex)`. Each swatch is a ≥44 px target with an accessible name ("Red", "Blue", …) and `aria-checked`. Shows a small preview chip in the engine-derived core + on colour. Only `normaliseHex`-valid values call `onChange`.
TDD steps:
  1. Tests: clicking "Blue" calls `onChange('#1d4ed8')`; arrow keys move the selection; the custom input with an invalid value does not call `onChange`; the swatch has `aria-checked=true` for the current value.
  2. Run: fails. 3. Implement. 4. Run: passes.
  5. Commit: `feat(setup): team colour picker`

## Wave 3: wiring

### Task 7: Quick match: colour setup, draft, live share
OWNS: `src/designs/design1-mono/MonoQuickMatch.jsx`, `src/designs/design1-mono/MonoQuickMatch.teamColour.test.jsx`
Anchors: success criteria 1, 5, 6; edge cases (old draft, sides swapped).
What to implement: `team1Color` / `team2Color` state (default from `DEFAULT_TEAM_COLOURS`); a `TeamColourPicker` under each team-name input (around lines 2318–2400); add `team1Color, team2Color` to the draft save effect (586–619) and restore (around 556; old drafts without colour → defaults); pass `color` in `teamA`/`teamB` to `live.create` (773–774).
TDD steps:
  1. Test: render setup, pick "Yellow" for Team A, start the match, unmount and remount (draft restore) → the scoring screen's grid style has `--team-a-core` from the yellow derivation; the live-create descriptor includes `teamA.color === '#facc15'`; a draft fixture without colour restores with the defaults.
  2. Run: fails. 3. Implement. 4. Run: passes; the existing MonoQuickMatch tests stay green.
  5. Commit: `feat(quick-match): pick team colours, persist in draft, share to live`

### Task 8: Quick match: arena in team colour (sets + goals branches)
OWNS: `src/designs/design1-mono/MonoQuickMatch.jsx` (sequential after Task 7), `src/designs/design1-mono/MonoQuickMatch.arena.test.jsx`
Anchors: success criteria 2, 6; "lead not coloured"; "colour follows team".
What to implement: in the sets (around 2882) and goals (around 2772) branches, map each half's colour from its **team** (`h.team === 1 ? 'a' : 'b'`), so a swap keeps colours with teams. Spread `useTeamColours(team1Color, team2Color, sport)` on `.mono-arena-grid` with `data-team-colour`. Add the `.mono-arena-motif` span. Each column gets `data-team="a|b"`. Remove `teamAccent` and the inline `color: h.accent` / `--score-accent`. Keep handlers, aria-labels and `CorrectionControls` unchanged.
TDD steps:
  1. Test: volleyball and football quick matches render `data-team-colour`; after "Swap" the left column's `data-team` follows Team B; tapping a half still adds a point and Undo restores it; `teamAccent` is no longer referenced (grep assertion in the test).
  2. Run: fails. 3. Implement. 4. Run: passes; full `bun run test` green.
  5. Commit: `feat(arena): quick-match sets and goals boards in team colour`

### Task 9: Tournament sets board
OWNS: `src/designs/design1-mono/scoring/MonoSetsLiveScore.jsx`, its new test `MonoSetsLiveScore.teamColour.test.jsx`
What to implement: the same change as Task 8 at around 593 and 706–750, using `DEFAULT_TEAM_COLOURS` (tournament team colours are out of scope).
TDD: render with a fixture match → `data-team-colour` present, a point tap works. Commit: `feat(arena): tournament sets board in team colour`

### Task 10: Tournament goals board
OWNS: `src/designs/design1-mono/scoring/MonoGoalsLiveScore.jsx`, `MonoGoalsLiveScore.teamColour.test.jsx`
What to implement: the same at around 452. TDD and commit as Task 9: `feat(arena): tournament goals board in team colour`

### Task 11: Server-side colour sanitising
OWNS: `convex/live.ts`, `convex/live.test.ts`
Anchors: OWASP A03; TDD scenario 7. **Read `CODING_STANDARDS.md` before editing.**
What to implement: in `create`'s handler, `color` is kept only if it matches `/^#[0-9a-fA-F]{6}$/`, otherwise dropped (stored as undefined). No validator or schema change.
TDD: a `convex-test` case for `'url(x)'` stores no colour and `'#1d4ed8'` stores it. Commit: `fix(live): store team colour only when it is a strict hex`

### Task 12: Spectator page in team colour
OWNS: `src/designs/design1-mono/MonoWatchMatch.jsx`, `MonoWatchMatch.teamColour.test.jsx`
Anchors: success criterion 5.
What to implement: `PinnedScorebug` derives team colours from `meta.teamA.color` / `meta.teamB.color` (via `deriveTeamColours`, so it's validated again on read). Each score number sits in its team's core with the on-colour text; the serving dot uses the on-colour. Missing colour → defaults.
TDD: render with a meta that has a colour → the A score cell style uses the derived core; a malicious colour → defaults. Commit: `feat(watch): spectator scorebug in team colour`

## Wave 4: ship evidence (last, manual)

### Task 13: Demo + acceptance walk
OWNS: `docs/plans/2026-10-20-direction-e-app-demo.md` (+ screenshots under `docs/plans/2026-10-20-direction-e-app-demo/`)
Anchors: success criteria 7, 8.
What to do: `bun run dev`, phone viewports 360 × 640 and 390 × 844. Screenshot volleyball (tap, undo, swap), football, kabaddi, Yellow v White, a near-identical pair, and the spectator page. Walk all 8 success criteria in the doc. Commit: `docs(direction-e-app): demo screenshots and acceptance walk`
