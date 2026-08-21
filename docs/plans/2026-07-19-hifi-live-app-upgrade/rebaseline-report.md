# M1 Re-baseline vs `origin/master` (cd61636)

**Date:** 2026-07-19
**Baseline:** ScoreEasy build plan authored 16 commits behind production `origin/master` @ `cd61636`.
**Scope:** M1 issues that MODIFY EXISTING built code (reskins of built screens, in-match safety/scorer-exit, folded design-debt). Excludes Foundation token/component/motion issues and net-new greenfield screens (Result/Scorecard/Share, Settings, Social, Teams).
**Method:** Read files on `origin/master`, grep the feature, classify DONE / PARTIAL / TODO with file:line evidence.

Recent master PRs consulted: #124/#106 (MonoQuickMatch UX+a11y, confirm dialogs), #123 (spectator serve labels), #121 (Sets/volleyball scorer UX), #115 (go-live/share UX), #119/#104 (app-shell nav, routing recovery, deep-links), #118/#105 (MonoOnboarding UX+consent), #122/#109 (tennis UX), #117 (MonoWatchMatch spectator), #116 (dashboard Go-live hero), #99 (merge Stats into History), #100/#96 (live-now rail, share flow).

## Status table

| Issue | Epic | Status | Evidence | Recommended action |
|---|---|---|---|---|
| Scorer exit safety (confirm-on-discard, unified End, back-press guard, saved ack) | In-match safety | **DONE** | `AppOwnedExitGuard.test.jsx` popstate guard (no `beforeunload`) L30-91; `MonoQuickMatch.jsx` `ThumbActionBar` [Undo·Swap·Discard·Finish] L174-202, `EndMatchButton` L211-214, `AppScoringConfirmDialog` "End match?"/"Discard" L34-45; `appConfirmUtils.js`; saving is automatic (comment L175). | close |
| Sets scorer visual blend (prompt, per-set strip, coaching chip) | Live scorers | **PARTIAL** | `MonoSetsLiveScore.jsx` already on arena blend: `mono-arena-screen/grid/half/overline`, `var(--se-color-*)`, `var(--primary)` L627-769; #121 added UX fixes. | rescope to residual: verify per-set strip + shared coaching chip vs spec; core visual blend already shipped |
| Tennis scorer visual blend (Part A) | Live scorers | **PARTIAL** | `MonoTennisLiveScore.jsx` arena blend + `mono-arena-seam`/`seam-rule` L772-858, tokens throughout; #122/#109 tennis UX. | rescope to residual: Part A extras (coaching/attribution seam) only; blend shipped |
| Goals scorer visual blend PR1 (seam prompt + Mode-B chips + football coaching + live dot) | Live scorers | **PARTIAL** | `MonoGoalsLiveScore.jsx` `mono-arena-screen/grid/half`, `mono-badge-live/paused`, `sidesSwapped` L58/444-450, tokens L485-572. | rescope to residual: seam prompt + football coaching chip + live dot specifics; base blend + Mode-B present |
| Cricket LO scorer visual blend (+ I-068 keep-green decision) | Live scorers | **PARTIAL** | `MonoCricketLiveScore.jsx` fully token-blended (`var(--se-color-*)`, `var(--primary)`), super-over UI L687-836; uses tokens not hardcoded green. | rescope to residual: confirm I-068 keep-green accent decision; visual blend shipped |
| Cricket test scorer visual blend | Live scorers | **PARTIAL** | `MonoCricketTestLiveScore.jsx` present alongside LO scorer sharing token/arena system. | rescope to residual: spot-verify parity with LO blend |
| Onboarding wizard reskin + celebratory finish (fix #0066ff debt / I-044) | Onboarding | **PARTIAL** | #105/#118 added UX + consent (`MonoOnboarding.jsx` +201). BUT `#0066ff` still hardcoded at L153,166,524,536,542,571,573,673,683,687 — I-044 token debt NOT fixed. | rescope to residual: #0066ff→token migration + celebratory finish; UX/consent already advanced |
| Home first-run empty (EmptyDashboard upgrade) | Onboarding | **PARTIAL** | `DashboardLanding.jsx` `EmptyDashboard` L584-707: hero CTA + get-started checklist + ghost caption (Variant A empty state, test L64). | rescope to residual: verify medallion/HiFi spec deltas; functional empty state shipped |
| Shared BottomTabNav component + Home tab + I-066 Stats-label fix | Nav & IA | **PARTIAL** | Nav is inline in `index.jsx` (tabs `home/play/matches/stats/account` L576); NO extracted `BottomTabNav` component. #99 merged Stats→History (`/stats`→`/history` L1742, comment L778). | rescope to residual: extract shared BottomTabNav; confirm I-066 label (stats cell now routes to history) |
| 4-tab IA restructure (Home·Play·History+Stats·Profile/More) + Guided-toggle decision | Nav & IA | **PARTIAL** | #119/#104 unified app shell nav; #99 Stats merged into History. But tab set is 5 cells (`home/play/matches/stats/account`), not collapsed to 4. | rescope to residual: collapse to 4-tab set; Guided-toggle decision still open |
| Dashboard Live-now band (self active sessions) | Dashboard | **PARTIAL** | `DashboardLanding.jsx` `getActiveSessions()` L724 + `LiveNowStrip` L769 (public rail scoreeasy-3ws) + Go-live hero L342-643 (#116/#96). | rescope to residual: confirm self-sessions "band" styling vs spec; wiring present |
| Tournaments resume card on Home | Dashboard | **PARTIAL** | `DashboardLanding.jsx` `collectTournamentsBySport` L89, `activeTournaments`/`displayTournaments` L160-161, "Resume →" button L274-275. | rescope to residual: HiFi card restyle only; resume functionality shipped |
| Sport home blend + delete _TABBED duplicate | Play & Setup | **PARTIAL** | `MonoSportHome_TABBED.jsx` exists but is UNREFERENCED (grep in src empty) — safe orphan. Blend of `MonoSportHome.jsx` not done. | rescope to residual: delete unreferenced _TABBED + apply blend |
| Between-sets interstitial (confirm winner → side-swap → next set) | In-match safety | **PARTIAL** | Side-swap exists (`handleSideSwap` `MonoQuickMatch.jsx` L937/2963; `sidesSwapped` in Goals L58). No confirm-winner→next-set interstitial screen. | rescope to residual: build confirm-winner interstitial; side-swap primitive present |
| Undo confirmation feedback (shared UndoControl + single toast slot) | In-match safety | **PARTIAL** | Undo wired per-scorer (`ThumbActionBar` `canUndo`/`onUndo` L176-196). No shared `UndoControl` component or single toast slot. | rescope to residual: extract shared UndoControl + toast slot |
| Route recovery / 404 MonoFallbackScreen | Utility & cleanup | **PARTIAL** | `RouteRecoveryActions.jsx` + `AppRouteRecovery.test.jsx` + `TournamentNotFoundActions.jsx`; #119/#104 routing recovery & deep-links. | rescope to residual: dedicated generic 404 `MonoFallbackScreen`; recovery actions/mechanism shipped |
| Delete legacy orphans + harden NewUserFlow shadow | Utility & cleanup | **PARTIAL** | `NewUserFlow.jsx` + `MonoSportHome_TABBED.jsx` orphans still present; _TABBED already unreferenced. | rescope to residual: delete confirmed orphans + shadow-harden NewUserFlow |
| Dev showcases hub + ShowcaseFrame (PR-A) | Utility & cleanup | **PARTIAL** | `DashboardShowcase.jsx`, `MonoMatchCardShowcase.jsx`, `MonoSetDisplayShowcase.jsx`, landing-designs/* exist; no unified `ShowcaseFrame` hub. | rescope to residual: build ShowcaseFrame hub over existing showcases |
| Basketball quarter+bonus engine + Q3/BONUS coaching chip (Goals PR2) | Live scorers | TODO | No quarter/bonus/Q3/BONUS logic in `MonoGoalsLiveScore.jsx`. | build as planned |
| Shared coaching-status selectors (per-sport) | Live scorers | TODO | `AppScoringPrompt.jsx` is the confirm-prompt host, not coaching-status selectors; none found in scorers. | build as planned |
| Generic live game routing decision (retire vs model-dispatch) | Live scorers | TODO | `MonoLiveGame.jsx` still present; no routing/retire decision recorded. | build as planned (decision) |
| Generic live game rebuild on arena system (only if kept) | Live scorers | TODO | Conditional on above decision. | build as planned (conditional) |
| Login blend (capsule OAuth/guest CTAs, question copy) | Onboarding | TODO | `MonoLogin.jsx` not touched by the 16 commits for blend. | build as planned |
| Signup blend (brand medallion, capsule CTAs, SSO loading state) | Onboarding | TODO | `MonoSignUp.jsx` untouched for blend. | build as planned |
| Guest landing blend + START deep-link to /:sport/quick | Onboarding | TODO | `GuestLanding.jsx` untouched for blend/deep-link. | build as planned |
| Guest-sync chip (post-first-match) | Onboarding | TODO | No guest-sync / sync-chip found in landing or MonoHome. | build as planned |
| Extract MonoQuickSetup from MonoQuickMatch (lift, zero visual change) | Play & Setup | TODO | No `MonoQuickSetup` file; `MonoQuickMatch.jsx` still monolithic (setup inline). | build as planned |
| Play hub blend (capsule mode toggle, badges, chips) | Play & Setup | TODO | `MonoPlayHub.jsx` untouched for blend by the 16 commits. | build as planned |
| Match setup restyle (on extracted MonoQuickSetup) + express lane | Play & Setup | TODO | Blocked on extraction; no express-lane markers in `MonoQuickMatch.jsx`. | build as planned |
| Customize & rules capsule controls (MonoSegment/MonoStepper/RuleSummaryChip) | Play & Setup | TODO | No MonoSegment/MonoStepper/RuleSummaryChip primitives found. | build as planned |
| Cricket toss interstitial (Setup → Live) | Play & Setup | TODO | No toss interstitial component found. | build as planned |
| In-match ⋯ menu (MonoScorerMenuButton + MonoMatchMenuSheet) | In-match safety | TODO | No `MonoScorerMenuButton`/`MonoMatchMenuSheet` files; actions live in inline `ThumbActionBar`. | build as planned |
| Team-only mode (flag + gate + toggle + prompt caption) | In-match safety | TODO | No teamOnly flag/gate/toggle found. | build as planned |
| Legal pages blend | Utility & cleanup | TODO | `LegalPage.jsx` exists but no design-token markers found. | build as planned |
