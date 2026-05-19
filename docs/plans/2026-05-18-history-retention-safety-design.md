# History Retention Safety PR

Date: 2026-05-18
Branch: `codex/history-retention-safety`
Base: `origin/master`

## Scope

This is an independent, unstacked PR. It intentionally avoids files touched by `codex/native-store-polish`.

Covered backlog:
- `P0-008` History cards should clearly open match details.
- `P0-010` History deletion should not be immediate or unrecoverable.
- `P2-003` Empty History should keep users in the scoring loop.

Current `master` already has a history detail panel, clear-history confirmation, clear-history undo, and empty-state CTAs. The remaining verified gaps are:
- Match cards are only implicitly clickable.
- Individual quick-match delete is immediate and has no recovery.

## Acceptance

- Every history card exposes a visible `View details` affordance.
- Quick-match delete opens an app-styled confirmation before deleting.
- Confirmed quick-match deletion can be undone before leaving the screen.
- Empty-history CTAs remain available.

## Validation

- Focused component tests for visible details affordance and delete confirmation/undo.
- `bun run test`
- `bun run type-check`
- `bun run lint`
- `bun run build`
