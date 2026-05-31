# Mobile App Audit Beads Execution Map

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement PR groups task-by-task.

**Goal:** Preserve the completed mobile app audit as a Beads-backed execution backlog so the next implementation phase can work PR-by-PR without losing any issue.

**Canonical source:** `.beads/issues.jsonl` and `bd show <id>` are the source of truth for detailed issue descriptions and acceptance criteria. This markdown file is an index of the PR grouping currently exported from Beads.

**Current backlog:** 9 PR parent issues, 71 child issues, 80 Beads records total.

---

## Priority Order

1. **PR 1 - Build, native tooling, and Capacitor baseline** (`scoreeasy-x7s`, P0, 5 issues)
2. **PR 2 - Data integrity and persistence foundation** (`scoreeasy-viq`, P0, 10 issues)
3. **PR 3 - Critical routing, deep-link, and recovery flows** (`scoreeasy-9g4`, P1, 9 issues)
4. **PR 4 - Dashboard start/resume and first-run flow correctness** (`scoreeasy-nm8`, P1, 4 issues)
5. **PR 5 - Sport scoring logic and tournament flow defects** (`scoreeasy-9ve`, P1, 11 issues)
6. **PR 9 - Accessibility, auth, and backend session reliability** (`scoreeasy-ngb`, P1, 7 issues)
7. **PR 6 - Mobile scorer layout and app-shell ergonomics** (`scoreeasy-4ay`, P2, 5 issues)
8. **PR 7 - Visual system, contrast, and interaction polish** (`scoreeasy-oee`, P2, 15 issues)
9. **PR 8 - Content, share behavior, and legal completeness** (`scoreeasy-woa`, P2, 5 issues)

## PR 1: Build, Native Tooling, and Capacitor Baseline

Beads parent: `scoreeasy-x7s`
Priority: P0
Target: Make the repo buildable and make native mobile validation possible.

- `scoreeasy-x7s.1` - **I-001: Fix build failure from missing @tailwindcss/vite install** (P0 bug)
- `scoreeasy-x7s.2` - **I-002: Unblock Android emulator QA environment** (P0 task)
- `scoreeasy-x7s.3` - **I-017: Align iOS Capacitor SwiftPM version with JS Capacitor** (P3 chore)
- `scoreeasy-x7s.4` - **I-018: Regenerate native Capacitor config drift** (P3 chore)
- `scoreeasy-x7s.5` - **I-019: Rename stale Android starter test namespaces** (P3 chore)

Validation gate:
- `npm run type-check`
- `npm run build`
- `npm run mobile:android`
- Android emulator listed by `adb devices`

## PR 2: Data Integrity and Persistence Foundation

Beads parent: `scoreeasy-viq`
Priority: P0
Target: Fix the data-layer root causes behind missing History, false resume prompts, phantom records, broken tournament counters, and Statistics miscounts.

- `scoreeasy-viq.1` - **I-020: Completed matches do not save for most sports** (P0 bug)
- `scoreeasy-viq.2` - **I-021: Tournament results never reach History** (P0 bug)
- `scoreeasy-viq.3` - **I-022: Completed matches remain status in-progress drafts** (P0 bug)
- `scoreeasy-viq.4` - **I-023: Stale drafts trigger false resume prompts** (P0 bug)
- `scoreeasy-viq.5` - **I-024: Elimination tournament persists with 0 matches** (P0 bug)
- `scoreeasy-viq.6` - **I-025: Phantom 0-0 tie records pollute saved data** (P1 bug)
- `scoreeasy-viq.7` - **I-026: Wall-clock duration values are unrealistic** (P2 bug)
- `scoreeasy-viq.8` - **I-045: Statistics Overview counter tiles are wrong and inconsistent** (P0 bug)
- `scoreeasy-viq.9` - **I-046: Reconcile derived analytics with corrected persistence totals** (P1 task)
- `scoreeasy-viq.10` - **I-027: Statistics, History, and lower page sections disagree on same data** (P0 bug)

Validation gate:
- Completed matches persist for every supported sport.
- Tournament matches/results appear in History.
- Statistics and History totals reconcile against storage.
- Elimination tournaments persist generated matches and no longer show `0/0`.

## PR 3: Critical Routing, Deep-Link, and Recovery Flows

Beads parent: `scoreeasy-9g4`
Priority: P1
Target: Remove dead routes, permanent loading traps, wrong-sport recovery, and unsupported route aliases.

- `scoreeasy-9g4.1` - **I-003: Fix active game resume dead route /game/:id** (P1 bug)
- `scoreeasy-9g4.2` - **I-004: Replace scorer deep-link infinite Loading with recovery** (P1 bug)
- `scoreeasy-9g4.3` - **I-005: Add or document app-link association assets** (P1 task)
- `scoreeasy-9g4.4` - **I-008: Add fallback for Quick Match direct-entry back navigation** (P2 bug)
- `scoreeasy-9g4.5` - **I-009: Remove hard-coded Volleyball from OfflineFallback CTA** (P2 bug)
- `scoreeasy-9g4.6` - **I-010: Remove hard-coded Volleyball from empty History tournament CTA** (P3 bug)
- `scoreeasy-9g4.7` - **I-011: Preserve sport context in NotFound recovery** (P3 task)
- `scoreeasy-9g4.8` - **I-063: Resume trap has no fresh-match escape from scorer** (P1 bug)
- `scoreeasy-9g4.9` - **I-064: Routing inconsistencies across stats, signin, sport query, and tennis live URLs** (P1 bug)

Validation gate:
- Resume opens a valid scorer or recovery state.
- Missing scorer data routes show recovery instead of infinite loading.
- `/stats`, `/signin`, `?sport`, and tennis live URLs have one supported contract.
- Offline, History, and NotFound recovery do not force the wrong sport.

## PR 4: Dashboard Start/Resume and First-Run Flow Correctness

Beads parent: `scoreeasy-nm8`
Priority: P1
Target: Make dashboard CTAs and first-run app launch match user intent.

- `scoreeasy-nm8.1` - **I-006: Allow 2-team tournaments from new-user dashboard** (P1 bug)
- `scoreeasy-nm8.2` - **I-007: Make empty-dashboard New tournament open tournament flow** (P2 bug)
- `scoreeasy-nm8.3` - **I-028: App boots to marketing page instead of app experience** (P1 task)
- `scoreeasy-nm8.4` - **I-029: New Match does not reset team names** (P2 bug)

Validation gate:
- New-user dashboard can start a valid 2-team tournament.
- New tournament opens a tournament-focused flow.
- Native/mobile launch defaults to an app-first surface.
- New Match starts clean unless the user explicitly chooses a rematch/copy flow.

## PR 5: Sport Scoring Logic and Tournament Flow Defects

Beads parent: `scoreeasy-9ve`
Priority: P1
Target: Fix sport-specific scorer and tournament state defects that produce misleading or impossible game states.

- `scoreeasy-9ve.1` - **I-030: Cricket chase win is mislabeled as by runs** (P1 bug)
- `scoreeasy-9ve.2` - **I-031: Incomplete cricket match declares a winner** (P1 bug)
- `scoreeasy-9ve.3` - **I-032: Tennis shows phantom Set 3 of 3** (P1 bug)
- `scoreeasy-9ve.4` - **I-033: Tennis completion leaves inert controls looking active** (P2 bug)
- `scoreeasy-9ve.5` - **I-034: Basketball 0-0 deadlock has no overtime path** (P1 bug)
- `scoreeasy-9ve.6` - **I-035: Football countdown lacks halves, halftime, and full-time flow** (P1 bug)
- `scoreeasy-9ve.7` - **I-036: Elimination tournament dashboard shows 0/0** (P1 bug)
- `scoreeasy-9ve.8` - **I-037: Group plus Playoffs counter mismatch 18 vs 15** (P1 bug)
- `scoreeasy-9ve.9` - **I-038: Series preview truncates expected matches** (P2 bug)
- `scoreeasy-9ve.10` - **I-039: Elimination tournament is capped at 2-4 teams** (P2 task)
- `scoreeasy-9ve.11` - **I-040: Misleading tournament format strings such as 6 pts** (P2 bug)

Validation gate:
- Cricket, tennis, basketball, and football result states are correct.
- Tournament generated/displayed/persisted/completed counts reconcile.
- Tournament format copy describes the real rules.

## PR 6: Mobile Scorer Layout and App-Shell Ergonomics

Beads parent: `scoreeasy-4ay`
Priority: P2
Target: Make active scorer screens usable on phone viewports.

- `scoreeasy-4ay.1` - **I-041: Cricket scorer overflows most phone screens** (P2 bug)
- `scoreeasy-4ay.2` - **I-042: Undo is below the fold during scoring** (P2 bug)
- `scoreeasy-4ay.3` - **I-043: Resume banner further inflates active scorer height** (P2 task)
- `scoreeasy-4ay.4` - **I-067: Cricket scorer header is too tall on phones** (P2 bug)
- `scoreeasy-4ay.5` - **I-065: Inconsistent control order across scorers** (P2 bug)

Validation gate:
- Primary scorer controls fit common phone widths.
- Undo remains reachable during scoring.
- Header/banner chrome is compact.
- Scorer control order is consistent across sports.

## PR 7: Visual System, Contrast, and Interaction Polish

Beads parent: `scoreeasy-oee`
Priority: P2
Target: Make non-home screens look intentional, readable, responsive, and visually consistent.

- `scoreeasy-oee.1` - **I-012: Remove mojibake from core non-home screens** (P2 bug)
- `scoreeasy-oee.2` - **I-013: Make empty Statistics overview action-first** (P2 task)
- `scoreeasy-oee.3` - **I-014: Make Statistics tables readable on narrow screens** (P2 bug)
- `scoreeasy-oee.4` - **I-044: Tiny fonts undermine readability** (P2 bug)
- `scoreeasy-oee.5` - **I-047: CTAs lack tap feedback** (P2 task)
- `scoreeasy-oee.6` - **I-048: History fails WCAG AA contrast** (P2 bug)
- `scoreeasy-oee.7` - **I-049: Opponent line looks disabled** (P3 task)
- `scoreeasy-oee.8` - **I-050: Off-palette arbitrary button colors break visual system** (P3 task)
- `scoreeasy-oee.9` - **I-051: Football and basketball tap-cards feel unfinished** (P3 task)
- `scoreeasy-oee.10` - **I-052: Rugby buttons are non-uniform** (P3 task)
- `scoreeasy-oee.11` - **I-053: History and Statistics look perpetually loading** (P2 bug)
- `scoreeasy-oee.12` - **I-066: Inconsistent nav labels such as Statistics vs STATS** (P2 task)
- `scoreeasy-oee.13` - **I-068: Arbitrary green run-button highlighting breaks scoring visual system** (P2 task)
- `scoreeasy-oee.14` - **I-069: Wicket button uses off-palette cream/yellow styling** (P2 task)
- `scoreeasy-oee.15` - **I-070: Statistics fails WCAG AA contrast** (P2 bug)

Validation gate:
- History and Statistics meet WCAG AA contrast.
- Statistics empty and table layouts work on mobile.
- Scoring buttons use consistent semantic variants.
- Navigation labels and CTA feedback are consistent.

## PR 8: Content, Share Behavior, and Legal Completeness

Beads parent: `scoreeasy-woa`
Priority: P2
Target: Fix misleading copy, missing fallback behavior, and placeholder-grade legal surfaces.

- `scoreeasy-woa.1` - **I-054: T10 format says 20 overs** (P2 bug)
- `scoreeasy-woa.2` - **I-055: Duplicate tennis cards appear** (P3 bug)
- `scoreeasy-woa.3` - **I-056: Share has no web fallback** (P2 bug)
- `scoreeasy-woa.4` - **I-015: Add useful empty and no-results states to Find Players** (P2 task)
- `scoreeasy-woa.5` - **I-016: Replace placeholder-grade Legal pages with app-complete disclosure** (P2 task)

Validation gate:
- User-facing format copy is accurate.
- Share works with native and web fallbacks.
- Privacy, Terms, and Contact disclose real app/auth/backend/third-party behavior.
- Find Players has useful empty and no-results recovery states.

## PR 9: Accessibility, Auth, and Backend Session Reliability

Beads parent: `scoreeasy-ngb`
Priority: P1
Target: Make keyboard/screen-reader basics and signed-in backend/account state coherent.

- `scoreeasy-ngb.1` - **I-057: No visible focus outline anywhere** (P1 bug)
- `scoreeasy-ngb.2` - **I-058: Broken heading hierarchy outside scorer screens** (P2 bug)
- `scoreeasy-ngb.3` - **I-059: Disabled Start uses cursor pointer** (P2 bug)
- `scoreeasy-ngb.4` - **I-060: Clerk to Convex token exchange returns 404** (P1 bug)
- `scoreeasy-ngb.5` - **I-061: Convex WebSocket repeatedly drops with 1006** (P1 bug)
- `scoreeasy-ngb.6` - **I-062: Signed-in UI still shows Sign in and lacks account menu** (P1 bug)
- `scoreeasy-ngb.7` - **I-071: Scorer lacks a proper h1 or top-level heading** (P1 bug)

Validation gate:
- Focus indicators are visible.
- Scorer routes and non-scorer routes expose a logical heading structure.
- Disabled controls use proper disabled semantics.
- Clerk/Convex auth and signed-in UI state are consistent.

## Execution Rules

- Start from **PR 1**, then **PR 2**. Persistence and build reliability are prerequisites for trustworthy verification.
- Use `bd show <id>` before implementing any issue; the Beads description and acceptance criteria are the detailed task contract.
- Do not collapse distinct canonical audit issues back into shared implementation tasks unless the PR description explicitly calls out the merge.
- Every implementation PR must include tests or a written manual verification reason.
- Do not claim native Android app verification until an emulator/device run is actually completed.
