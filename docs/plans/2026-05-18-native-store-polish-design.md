# Native Store Polish PR Plan

Date: 2026-05-18
Branch: `codex/native-store-polish`
Base: `master`

## Scope

This PR is independent and unstacked. It covers the remaining native-store polish slice from the mobile app execution plan:

- `P1-043`: finish Android and iOS native verification coverage.
- `P2-009`: keep PWA and app-shell safe-area/install metadata current.
- `P2-010`: add native deep-link/app-link handling.
- `P2-011`: add native haptic feedback for scoring, corrections, warnings, and match completion.
- `P2-012`: confirm native offline build/sync paths.
- `P2-036`: document store-readiness verification steps.
- `P2-037`: keep install icons and shortcuts ready for native review surfaces.

## Merge Plan

This PR must merge directly into `master`. Later UX backlog PRs should also branch from `master` after this PR merges, or from a refreshed `origin/master` if they are opened in parallel. No stacked branch depends on this work.

## Validation Plan

- Run focused native helper tests.
- Run the full unit suite.
- Run lint, type-check, web build, Android sync build, and iOS sync build.
- Verify Android/iOS deep-link commands are documented for device review because real simulator availability differs by machine.
