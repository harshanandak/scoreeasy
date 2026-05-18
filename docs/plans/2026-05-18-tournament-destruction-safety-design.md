# Tournament Destructive Safety PR

Date: 2026-05-18
Branch: `codex/tournament-destruction-safety`
Base: `origin/master`

## Scope

This is an independent, unstacked PR. It avoids files touched by open PRs for native store polish and history retention safety.

Covered backlog:
- `P1-044` Tournament score clearing lacks confirm/undo.
- `P1-045` Tournament delete has no recovery path.
- `P1-046` Tournament not-found detail state should offer recovery actions.

Current `master` already has an app-styled tournament delete confirmation in `MonoTournamentList`. The remaining verified gaps are:
- Deleting a tournament has no undo.
- Clearing completed group-stage scores is immediate in sets and goals tournaments.
- Tournament detail not-found screens are dead ends.

## Acceptance

- Tournament delete still requires confirmation and now offers undo before leaving the screen.
- Clearing a sets/goals group-stage match score requires confirmation.
- Confirmed sets/goals score clearing can be undone before leaving the tournament detail.
- Missing tournament detail routes offer return/create recovery actions.

## Validation

- Focused component tests for tournament delete undo and sets/goals score clear confirmation/undo.
- `bun run test`
- `bun run type-check`
- `bun run lint`
- `bun run build`
