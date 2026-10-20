# Direction E in the app — design

- **Feature:** `direction-e-app` · epic `scoreeasy-mni`
- **Date:** 2026-10-20
- **Status:** approved in session (Harsha), Phase 1

## Purpose

Today the scoreboard colours mean *score state* (green = leading, amber = tie, ink = behind) and
teams have no colour at all. On a busy court the scorer and spectators identify teams by their
kit colour, not by "the green one is winning". Direction E (approved design:
`docs/plans/2026-07-26-icp-games-design/directions/e-broadcast/`) makes each team's own colour the
identity of its half of the board: a blended two-team score area, two big team-coloured point keys,
and a faint court drawing for the sport, legible in sunlight for *any* colour a team picks.

This is the v1 release cut: ship it, don't polish it (see the shipping regime in `AGENTS.md`).

## Decisions made in Q&A

| Question | Decision |
|---|---|
| Governance | Team colour owns the scoring and live screens. `BLEND-GOVERNANCE.md` gains a rule: on scoring/live surfaces team colour carries identity; green stays for LIVE badges and app actions. Lead is no longer coloured. §4 (hard shell / soft content) still holds: the blend sits inside the brutalist border. |
| Theme | Light only in v1 (the app is light-only today). App-wide dark theme is a follow-up. |
| Scope | The shared score surface (`.mono-arena-half`) used by the 12 sets + goals sports, in quick match and tournament, plus the spectator page. Cricket and tennis layouts follow in their own PRs. |
| Colour data | Picked on the quick-match setup screen; stored in the match draft; sent to the existing optional `liveMatchMeta.teamA/teamB.color`. No Convex schema change. Tournament team colours later. |
| Engine delivery | Plain-JS engine → CSS custom properties → Tailwind theme colours (`@theme`). Tailwind chosen over StyleX: already installed and wired, no new compile plugin, and the engine's runtime CSS variables map straight onto Tailwind colours. |
| Motifs | Court drawings for all 12 sports in scope. |

## Success criteria

1. A scorer can pick a colour for each team on quick-match setup (6 preset swatches + custom), and the choice survives a refresh mid-match.
2. On the scoring screen for every sets and goals sport, each half/key is in its team's colour; the score area blends A → B; the sport's court drawing sits faintly behind.
3. For **any** pair of colours, including yellow v white, black v black and neon, every label on team colour is ≥ 4.5:1 and every score numeral ≥ 7.5:1 on its scrim. Enforced by unit tests across the 6 presets plus edge colours.
4. Two teams that pick near-identical colours stay distinguishable (engine lightness split, ΔE check in tests).
5. Spectator (`/live/:token`) shows the same team colours.
6. Scoring behaviour unchanged: tap, undo, −1, swap sides, finish, offline outbox and draft restore all work as before. Existing tests stay green.
7. Touch targets unchanged or larger; the board renders correctly at 360 × 640 and 390 × 844.
8. Merge artifact: phone-viewport screenshots (volleyball, football, kabaddi, a yellow v white pair, spectator) plus this checklist walked.

## Out of scope (v1)

- Dark theme, anywhere.
- Cricket and tennis scoring layouts (separate PRs).
- Tournament team colours, and any Convex schema change.
- Arena (venue backdrop), game scenes, animations (wave/flare).
- Unifying the duplicated rule logic in `src/models/live/` vs `src/utils/` (noted, filed separately).
- Reconciling `sportsTokens.js` drift with `index.css` (filed separately).

## Approach selected

1. **`src/lib/teamColour.js`**: port the mockup engine (`volleyball.html` colour engine: OKLab/OKLCH conversion, gamut clamp, `band`, `stops`, `normalise`, clash split, `accents`, scrim solve, `contrast`). Pure functions, no DOM. Export `deriveTeamColours(aHex, bHex, theme='light')` and `teamColourVars(derived)` → `{ '--team-a-hi': …, … }`. Light-theme neutrals from the app's `--se-*` tokens. Extend rather than duplicate: `theme/sportsTokens.js#getReadableTextColor` stays for its current callers; the new module owns team colour.
2. **Tailwind bridge**: `@theme inline` entries `--color-team-a`, `--color-team-a-on`, `--color-team-b`, … pointing at the runtime variables, so components use `bg-team-a`, `text-team-a-on`.
3. **`TeamColourProvider` / `useTeamColours(teamA, teamB)`**: memoised derive; spreads the variables onto the scoring screen root.
4. **Score surface**: restyle `.mono-arena-half` (shared by `MonoQuickMatch`, `MonoSetsLiveScore`, `MonoGoalsLiveScore`) to the Direction E key: team gradient, on-colour text, numeral scrim, court motif layer. The 4 copies of `teamAccent()` are replaced by team colour. Markup and handlers untouched, so scoring logic is not touched.
5. **Court motifs**: `src/lib/courtMotifs.js` holds the line drawings (the 5 from `motifs.html` plus 7 new ones) as SVG strings, rendered as a CSS mask; colour and alpha come from the engine (`motifCol`/`motifA`) so contrast is gated.
6. **Setup**: a `TeamColourPicker` (6 swatches + native `<input type=color>`) per team on quick-match setup; defaults red v blue; values in the draft (`se_quickmatch_draft_<sport>`) and in `teamA/teamB.color` passed to `live.create`.
7. **Spectator**: `MonoWatchMatch` reads `meta.teamA.color` / `teamB.color` → same provider.

## Constraints

- Plain JS/JSX only; bun; no new runtime dependency.
- Sport rules stay where they are; this PR touches presentation only.
- No change to how points are written, queued or undone.
- Contrast gates are tests, not comments.

## Edge cases (decided)

- **No colour picked / old draft without colour / spectator without colour:** default pair red `#d62828` v blue `#1d4ed8`.
- **Invalid hex input:** ignored; keep the previous valid colour.
- **Near-identical colours:** the engine splits lightness (ΔE ≥ 0.15 after the split). It never silently changes hue, so the team keeps its identity.
- **Sides swapped:** colour follows the team, not the side.
- **Lead and tie:** no colour cue (the numbers show it). The board stays truthful.
- **Serving dot / labels:** use the team's on-colour, so they're always legible.
- **Reduced motion:** nothing animates in v1.

## Ambiguity policy

Use the 7-dimension rubric per the `/dev` decision gate. Confidence ≥ 80%: proceed and document
the choice in the PR. Below 80%: stop and ask Harsha.
