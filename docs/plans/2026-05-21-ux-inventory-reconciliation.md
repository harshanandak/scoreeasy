# UX Inventory Reconciliation

Date: 2026-05-21
Base: repository default branch `master` at `765f0c879fe0bc94e740711afc667809ad2d8b06`

This reconciles the original May 15 UX inventory against current `master` after PR #48. The original inventory remains a historical audit snapshot; this file is the current status source.

## Verified Current State

- Open GitHub PRs before this reconciliation PR: 0. Current open reconciliation PR: #49.
- Open GitHub issues: 0.
- PRs #1-#48 are merged.
- Latest `master` checks for PR #48 are green: Build Android APK and AAB, verify, Build iOS Simulator App, SonarCloud Code Analysis, and Vercel Preview Comments.
- Local `master` matches `origin/master` at `765f0c879fe0bc94e740711afc667809ad2d8b06`.

## Resolved UX Work

The original P0/P1 implementation blockers are no longer active pending work in the tracker. They were covered by the merged PR sequence and have source/test evidence in current `master`.

| Area | Original IDs | Current evidence |
|---|---|---|
| Quick-match scoring correctness | P0-001, P0-013, P0-017, P0-018, P2-038, P2-039, P2-040, P2-041 | `src/designs/design1-mono/MonoQuickMatch.jsx`, `src/utils/quickMatchResult.test.js`, `src/utils/tennisScoring.test.js`, `src/models/sportRegistry.test.js` |
| Runtime, route, and profile recovery | P0-002, P0-004, P0-005, P0-006, P2-033 | `src/utils/reactGrab.test.js`, `src/mobile/backButton.test.js`, `src/designs/design1-mono/AppRouteRecovery.test.jsx`, `src/components/ErrorBoundary.test.jsx`, `src/designs/design1-mono/MonoProfile.test.jsx` |
| App-owned scoring prompts and exit safety | P0-016, P1-012, P2-011 | `src/designs/design1-mono/components/AppScoringPrompt.jsx`, `src/designs/design1-mono/scoring/AppOwnedScoringPrompts.test.jsx`, `src/mobile/haptics.test.js` |
| Live scoring UX | P0-007, P0-009, P0-011, P1-014, P1-015, P1-016, P1-036, DS-015 | `src/designs/design1-mono/MonoQuickMatch.jsx`, `src/designs/design1-mono/MonoQuickMatchSetup.test.jsx` |
| Mobile home and sport discovery | P0-003, P1-001, P1-002, P1-003, P1-004, P1-005, P1-006, P1-035, P2-016, P2-017, P2-018, P2-019, P2-020 | `src/designs/design1-mono/landing/GuestLanding.jsx`, `src/designs/design1-mono/landing/GuestLanding.test.jsx`, `src/designs/design1-mono/MonoSportHome.jsx`, `src/designs/design1-mono/MonoSportHome.test.jsx` |
| Quick-match setup flow | P0-012, P1-007, P1-008, P1-009, P1-010, P1-011, P1-028, DS-006, DS-007, DS-008, DS-009, DS-016, DS-020 | `src/designs/design1-mono/MonoQuickMatch.jsx`, `src/designs/design1-mono/MonoQuickMatchSetup.test.jsx`, `src/designs/design1-mono/mono.css` |
| Result, history, sharing, and retention | P0-008, P0-010, P0-014, P0-019, P1-029, P1-030, P2-002, P2-003, P2-004, DS-012 | `src/designs/design1-mono/MonoHistory.jsx`, `src/designs/design1-mono/MonoHistory.test.jsx`, `src/mobile/share.js`, `src/mobile/share.test.js`, `src/utils/quickMatchResult.test.js` |
| Tournament setup, resume, formats, and destructive safety | P1-017, P1-018, P1-019, P1-020, P1-021, P1-031, P1-032, P1-044, P1-045, P1-046, DS-013, P2-024, P2-025, P2-026 | `src/designs/design1-mono/MonoTournamentSetup.jsx`, `src/designs/design1-mono/MonoTournamentList.jsx`, `src/designs/design1-mono/TournamentDestructiveSafety.test.jsx`, `src/utils/tournamentDisplay.test.js` |
| Navigation shell and safe areas | P1-022, P1-023, P1-024, P1-042, P2-009, DS-018 | `src/designs/design1-mono/index.jsx`, `index.html` |
| Auth, profile, onboarding, and redirects | P1-025, P1-027, P1-039, P1-040, P1-041, P2-013, P2-031, P2-032, DS-017, DS-019 | `src/designs/design1-mono/MonoProfile.jsx`, `src/designs/design1-mono/MonoProfile.test.jsx`, `src/auth/CloudAuthRoot.jsx`, `src/designs/design1-mono/SSOCallback.jsx`, `src/designs/design1-mono/MonoUserSearch.jsx` |
| Statistics and insights | P1-033, P2-005, P2-006 | `src/designs/design1-mono/MonoStatistics.jsx`, `src/designs/design1-mono/MonoStatistics.test.jsx` |
| Native/offline readiness | P1-043, P2-007, P2-008, P2-010, P2-011, P2-012, P2-036, P2-037 | `src/components/OfflineFallback.jsx`, `src/components/OfflineFallback.test.jsx`, `src/mobile/deepLinks.js`, `src/mobile/deepLinks.test.js`, `vite.config.js`, `android/app/src/main/AndroidManifest.xml` |

## Remaining Non-Code Decisions

These are not active implementation blockers. They require product/provider decisions or device verification rather than another immediate UX patch.

| Status | IDs | Reason |
|---|---|---|
| Needs production/provider verification | P1-026, P1-034, P1-043, P2-008, P2-010, P2-011, DS-011, DS-021 | Requires a production/mobile build, real device, or configured provider state to verify accurately. |
| Needs product decision | P2-021, P2-028, P2-029, P2-030, P2-034, P2-035, P2-036, P2-037, DS-010 | These define optional product scope, provider choices, social/public surface policy, or advanced features. |
| Later design-system polish | DS-001, DS-002, DS-003, DS-004, DS-005, DS-014 | The launch-critical flows have been patched; these should be handled as a separate polish pass if the current visual QA still flags them. |

## Stale Local/Remote Branches

These are not open PRs:

- `codex/recover-quick-match-stack`: no diff versus current `master`; cleanup-only.
- `origin/claude/brainstorm-app-names-MTghU`: adds `DOMAIN_IDEAS.md`; no PR.
- `origin/claude/fix-tournament-match-status-EfOBA`: old match-status changes; no PR and stale against current `master`.

## Current Conclusion

There are no active open UX PRs or GitHub issues. The old May 15 tracker looked open because it was not status-updated during the PR sequence. Current remaining work is verification/decision/polish, not unresolved P0/P1 UX implementation from that tracker.
