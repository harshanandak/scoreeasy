# ScoreEasy — Brutalist × HiFi Live-App Upgrade · MASTER PLAN

_Plan date: 2026-07-19 · Read top-to-bottom. 17 epics · 99 PRs · 3 milestones._

---

## 1. Vision — best of both worlds

ScoreEasy today has a distinctive brutalist identity (pure-black ink borders, hard `3px 3px 0` zero-blur offset shadows, boxy 4px radii, `clamp()` mega-numerals, open borderless tap-zones, off-white faint-green `#F1F4EF` canvas) but a bare, dead-end UX: no Home discovery hub, no match-end screen, an inverted "discard is one tap / finish is confirmed" safety guard, no live/spectator layer, no social or teams surfaces, monolith files, and orphan routes. The HiFi vision brings warmth and intuitiveness — plain-language prompts that _ask a question_ ("Tap who won the rally"), rounded capsule/circular tap targets, soft green washes and gold-for-wins, gentle breathing LIVE pulses, coaching caption chips, bottom-tab navigation, designed empty states, and a full Result→Scorecard→Share activation loop. This upgrade does not pick a winner: it keeps the hard brutalist **shell** (scoring arenas, competition chrome, the record ledger stay boxy and monospaced) and wraps HiFi **content warmth** around it — softness never replaces the load-bearing structure. The result is an app that stays visually unmistakable while becoming simple, intuitive, and seamless: two taps to start scoring, a coaching voice that guides without cluttering, safe exits that never destroy a match by accident, and complete flows from first-run to shared final result. Everything composes from ONE shared token + component + motion layer so the two aesthetics blend instead of fighting per-screen.

---

## 2. Navigation model + back-stack rules

**Model:** a **4-tab bottom nav** — **Home · [Play, center-emphasized] · History (+Stats sub-tabs) · Profile/More** — with a link-first Watch/Spectator layer. It grows to a **5th Watch/Friends tab ONLY when the social+live slice actually ships** (never a tab that opens an empty shell).

- **Home** = discovery hub (Live-now band above own-session Resume band, plus the Start CTA).
- **Play** = the single creation funnel; sport pick folds into creation; START deep-links to `/:sport/quick`.
- **History** = the record; Statistics is folded in as segmented sub-tabs (Games · Players/Leaderboard · Stats).
- **Profile/More** = the low-frequency hub (settings, teams, account). The Clerk avatar popover is **auth only** — it stops pretending to be app settings.

Nav ships in **two PRs** to reconcile the evals: (1) shared `BottomTabNav` + the missing Home tab + I-066 Stats-label fix **on the current 5-tab IA**; (2) the **4-tab restructure** (Stats→History, Account→Profile/More, orphan/Guided cleanup) landing **before** any social/live/teams epic, gated on product sign-off.

### Back-stack rules (standing convention, per-PR acceptance gate)

1. **Tabs are lateral roots** — switches are instant (≤100ms opacity, no directional slide); each tab owns its stack; tapping the active tab scrolls-to-top.
2. **Drill-downs are forward pushes** (~200ms slide/shared-element); Back returns to parent with scroll + filter + query state preserved.
3. **Committing transitions use `replace`** (Setup→Live, Create-team→Roster) so Back never re-enters a torn-down setup or re-runs creation.
4. **Destructive/exit guards** — system-back from a live scorer fires the pause/discard confirm, never a silent pop; Back from Result goes to a safe hub, never into a completed match.
5. **Deep links synthesize parents** — cold-start spectator/tournament/roster links get a sane synthesized stack so Back walks up, never exits or 404s.
6. **In-setup steps sync to history** — back mid-setup decrements the step and loses nothing.
7. **No back-press ever lands on a broken/empty/orphan screen.** Orphans are deleted (except NewUserFlow — KEEP, live at `/play`), never routed around.
8. **Per-PR gate:** `a11yContracts.test` green + reduced-motion respected; no tab/entry ships pointing at an empty shell; no label promises an absent feature.

---

## 3. Blend-governance contract

This contract ships as comments/docs beside the Foundation tokens; every screen issue references it instead of re-deriving the rules.

- **GREEN = lead / live / positive ONLY.** Never decorative. `teamAccent` uses `var(--primary)` only when ahead; cricket 4/6 boundaries use green accent **TEXT**, never a filled box (I-068 KEEP decision).
- **GOLD = exactly ONE milestone/victory accent per screen** (`--se-color-gold` / `--se-color-win-gold`), appearing only after a result is decided or a rank/champion earned. Never competes with green-for-lead.
- **CAPSULES (999px) and CIRCLES (50%) are for INTERACTIVE elements only** (CTAs, chips, avatars, steppers, medallions) — never for containers/cards, which stay boxy 4px with the hard `3px 3px 0 0.5px` zero-blur offset shadow and 1–1.5px pure-black hairlines.
- **HARD SHELL / SOFT CONTENT** — scoring arenas (`.mono-arena-half`, `clamp()` numerals), competition chrome (fixture ribbon, standings) and the record ledger stay brutalist; warmth (plain-language prompts, rounded chips, breathing pulses, gold celebration) wraps AROUND them, never replaces them.
- **BREATHING PULSE = live-state signal ONLY** (LIVE badge/dot), ~1.2–1.8s, ALWAYS gated in the existing `@media (prefers-reduced-motion: reduce)` blocks (mono.css:862, 1793). Not decoration; cut it before cutting a load-bearing signal.
- **Per-screen SOFT-ELEMENT BUDGET** — cap rounded/washed/gold/pulse elements per screen (Cricket-toss and My-teams are closest to dilution — hold to one gold + two greens). When in doubt, brutalize.
- **ALL new tokens derive from the oklch `--primary`/action token** via color-mix / relative color so they behave in dark + theme modes; ZERO per-screen hardcoded hex. Sole exception: the fixed-size share-card raster subtree inlines hex (oklch/color-mix break rasterization).

---

## 4. Milestones

### M1 — Foundation + core scoring transformation
A complete user-visible upgrade of the flow that **already works**, before any new backend surface: the blend token/component/motion layer, 4-tab nav + IA restructure, warmed onboarding & setup funnel, all scorers reskinned, in-match safety (confirm-on-discard, unified End, ⋯ menu, between-sets, differentiated Undo, team-only), and the entirely-missing match-end terminal (Result → Scorecard → Share). **Why first:** this is the activation loop and the safety fixes — highest user value, zero new backend risk.
_Epics: Foundation · Navigation & IA · Onboarding/auth · Dashboard Live-now · Play & Setup · Live scorers · In-match safety · Match-end flow · Utility/legal/cleanup._

### M2 — Records, competition depth + live/spectator vertical slice
Tournament shell extraction / standings correctness / bracket / fixtures / workspace; the history/stats/leaderboard/profile records spine; Settings + dark mode; player-stats + persisted event-log backends with goals attribution; and the live stack → public snapshot query → share-live QR → tennis spectator. **Why second:** these need the M1 shell in place and introduce the first real backends. (P3 spectator sports + deep viz land in the M3 tail via prOrder.)
_Epics: Tournament & Schedule · Attribution & player-stats · Settings/account/appearance · History & Statistics · Live & Spectator infrastructure._

### M3 — Social graph, teams, and deferred depth
Everything that gates on the M1/M2 backends: friends schema + social screens, teams membership model + 3-screen MVP + roster picker, remaining spectator sports + momentum viz, dashboard social band, share-card rasterization, design-system explainer. **Why last:** every add-friend/team/watch CTA is a dead button until its backend exists.
_Epics: Social layer · Teams management · Deferred polish/deep-viz/rasterization._

Milestone boundaries (M1→M2→M3) are **re-planning checkpoints**.

---

## 5. Epics (goal + ordered issues)

Format per issue: **Title** · _type_ · priority · effort · one-line PR boundary.

### M1

#### Epic 1 — Foundation: shared token + component + motion layer
_Goal: define the blend design system ONCE (tokens + governance, keyframes, shared primitives, motion kit) so every screen composes the two aesthetics instead of forking hex/keyframes._
1. **Blend design tokens + blend-governance contract** · chore · P0 · M — token+keyframe+governance layer with dark-mode smoke check; no consumer yet.
2. **Shared MonoSheet bottom-sheet primitive** · feature · P0 · M — sheet host + hook + a11y tests; no consumer wired.
3. **Shared CaptionChip / CoachChip + capsule-CTA classes** · feature · P0 · S — chip + capsule-CTA components/classes + tests.
4. **Shared SegmentedToggle (capsule segmented control)** · feature · P0 · S — component + CSS + tests.
5. **Shared AvatarCircle + SportMedallion + LiveDot** · feature · P0 · M — three presentational components + tests.
6. **Shared EmptyState (extract from MonoStatistics)** · feature · P1 · M — extraction refactor + call-site updates; no new screen.
7. **Shared motion/transition kit** (tab-cut, push, sheet, commit-replace, FULL-TIME overlay) · feature · P1 · M — motion primitives + hooks + tests.

#### Epic 2 — Navigation & information architecture
_Goal: ship the shared bottom nav, then restructure to the 4-tab IA before any social/live/teams surface._
8. **Shared BottomTabNav + Home tab + I-066 Stats-label fix** · feature · P1 · M — nav component + Home-tab wiring + label fix on current 5-tab IA; regression-check every shell screen.
9. **4-tab IA restructure (+ Guided-toggle decision)** · feature · P1 · M — IA rework across shell paths + Stats→History merge + Profile/More hub + Guided-toggle gate; no per-screen features.

#### Epic 3 — Onboarding, auth & first-run
_Goal: warm the guest→auth→first-run funnel; collapse the start funnel to ~2 taps; keep the brutalist auth scaffold._
10. **Guest landing blend + START deep-link to /:sport/quick** · feature · P1 · M — GuestLanding + LivePreviewCard/PillCTA consuming shared tokens; START routes to `/:sport/quick`.
11. **Login blend (capsule OAuth/guest CTAs, question copy)** · feature · P2 · M — clerkTheme + MonoAuthPageFrame + MonoLogin + capsule/secure-chip CSS.
12. **Signup blend (brand medallion, capsule CTAs, SSO loading)** · feature · P2 · M — clerkTheme + shared frame + MonoSignUp + SSOCallback + medallion/loading.
13. **Onboarding wizard reskin + celebratory finish (fix #0066ff debt)** · feature · P2 · M — MonoOnboarding + local classes; data/validation untouched.
14. **Home first-run empty (EmptyDashboard upgrade)** · feature · P1 · M — DashboardLanding EmptyDashboard + tests; self-contained.
15. **Guest-sync chip (post-first-match)** · feature · P2 · S — chip + first-match trigger + dismissal persistence; never gates scoring.

#### Epic 4 — Signed-in dashboard: Live-now band
_Goal: insert the HiFi Live-now feed + tournament resume using only data available today (self active sessions); defer social/watch._
16. **Dashboard Live-now band (self active sessions)** · feature · P1 · M — DashboardLanding + LiveNowFeed + liveFeed.js (self-only stub) + tests.
17. **Tournaments resume card on Home** · feature · P2 · S — resume card deep-linking to workspace with synthesized back-stack.

#### Epic 5 — Play & Setup
_Goal: decompose the MonoQuickMatch monolith (I-085), collapse start to ~2 taps, blend the pick/setup flow._
18. **Extract MonoQuickSetup from MonoQuickMatch (lift, zero visual change)** · chore · P1 · M — extraction refactor with regression screenshots; behavior identical.
19. **Play hub blend (capsule mode toggle, badges, chips)** · feature · P1 · M — MonoPlayHub + NewUserFlow + MonoSportHome touch-points consuming shared toggle/chip.
20. **Sport home blend + delete _TABBED duplicate** · feature · P1 · M — MonoSportHome + CSS + delete _TABBED; nav consumed.
21. **Match setup restyle (on extracted MonoQuickSetup) + express lane** · feature · P1 · M — MonoQuickSetup restyle + "Quick start (defaults)" express lane; consumes MonoSheet.
22. **Customize & rules capsule controls (MonoSegment/MonoStepper/RuleSummaryChip)** · feature · P1 · L — QuickMatch Step 2 + capsule controls + tokens; no sibling adoption.
23. **Cricket toss interstitial (Setup → Live)** · feature · P1 · M — new "toss" phase for regular in-page cricket only; consumes MonoSheet + CoachChip.

#### Epic 6 — Live scorers: visual blend
_Goal: blend HiFi warmth into all scorers WITHOUT touching scoring logic, sharing one coaching-status selector; resolve the Goals + Generic-live splits._
24. **Shared coaching-status selectors (per-sport)** · feature · P1 · M — setsCoaching.js + cricket/tennis/goals selector utils + tests; net-new derivation.
25. **Cricket LO scorer visual blend (+ I-068 keep-green)** · feature · P1 · M — MonoCricketLiveScore CSS/markup + CoachChips; no behavior change.
26. **Cricket test scorer visual blend** · feature · P1 · M — MonoCricketTestLiveScore CSS/markup + shared chips.
27. **Tennis scorer visual blend (Part A)** · feature · P1 · M — MonoTennisLiveScore CSS/markup + chips + new match-won toast.
28. **Sets scorer visual blend (prompt, per-set strip, coaching chip)** · feature · P1 · M — MonoSetsLiveScore CSS/markup + setsCoaching + chips.
29. **Goals scorer visual blend PR1 (seam prompt + Mode-B chips + football coaching + live dot)** · feature · P1 · M — MonoGoalsLiveScore CSS/markup; football-only coaching; no engine change.
30. **Basketball quarter+bonus engine + Q3/BONUS chip (Goals PR2)** · feature · P2 · S — goalsScoring.js quarter/bonus engine + tests, then chip wiring.
31. **Generic live game routing decision (retire vs model-dispatch)** · chore · P2 · S — routing relax + retire-vs-keep decision confirmed with main/eval-app.
32. **Generic live game rebuild on arena system (only if kept)** · feature · P2 · M — MonoLiveGame rewrite on arena+tokens; gated on keep decision.

#### Epic 7 — In-match UX & scorer safety
_Goal: fix the in-match dead-ends and the inverted destruction guard (D2)._
33. **In-match ⋯ menu (MonoScorerMenuButton + MonoMatchMenuSheet)** · feature · P1 · M — ⋯ button + menu sheet across 5 scorer topbars; Share-live row gated. Must precede the Share-live QR sheet.
34. **Scorer exit safety (confirm-on-discard, unified End, back-press guard, saved ack)** · feature · P1 · M — unified End + Discard-confirm-in-menu + back-press guard + saved-ack across 5 scorers.
35. **Between-sets interstitial (confirm winner → side-swap → next set)** · feature · P1 · M — BetweenSetsInterstitial + wiring into sets/tennis completion; consumes motion kit.
36. **Undo confirmation feedback (shared UndoControl + single toast slot)** · feature · P2 · M — UndoControl + useUndoFeedback + 5 scorers markup swap.
37. **Team-only mode (flag + gate + toggle + prompt caption)** · feature · P2 · M — teamOnly flag threaded through scorers + hook + toggle + roster-hide; no spectator.

#### Epic 8 — Match-end flow (Result / Scorecard / Share)
_Goal: build the entirely-missing terminal states (flow/IA Critical #1) — where every retention/virality hook lives._
38. **MonoMatchResult shared screen + verdict helper (Sets wiring)** · feature · P1 · L — MonoMatchResult + matchResult util + Sets completion wiring + tests.
39. **Result rollout (Goals/Tennis/Cricket wiring)** · feature · P2 · M — per-engine wiring; no MonoLiveGame.
40. **Result rollout (MonoLiveGame follow-up)** · feature · P3 · S — MonoLiveGame completion→Result; gated on keep decision.
41. **MonoScorecard shared screen** · feature · P2 · L — MonoScorecard + route + wiring from match-complete and History + tests.
42. **Share result card sheet (static render + shareFiles + text fallback)** · feature · P3 · M — MonoShareCard + shareFiles primitive; no rasterization.

#### Epic 9 — Utility, legal & cleanup
_Goal: reconcile orphans (KEEP NewUserFlow), warm static/utility surfaces, stand up the internal design-system lab._
43. **Delete legacy orphans + harden NewUserFlow shadow** · chore · P2 · S — delete MonoHome/MonoSetup/MonoSportHome_TABBED + one-line shadow token fix; NewUserFlow retained.
44. **Route recovery / 404 MonoFallbackScreen** · feature · P2 · M — MonoFallbackScreen + 3 consumers via CSS; ErrorBoundary decoupled.
45. **Dev showcases hub + ShowcaseFrame (PR-A)** · feature · P3 · M — ShowcaseHub + shared frame + reframe 4 orphan pages; internal-only.
46. **Legal pages blend** · feature · P3 · S — LegalPage.jsx single-file + token bridge key.

### M2

#### Epic 10 — Tournament & Schedule
_Goal: blend the tournament group killing ~90% triplication + off-palette blue, fix standings correctness, add the tabbed workspace + fixture ribbon (dependency-corrected: shell extraction precedes the ribbon)._
47. **Tournament dispatch shell extraction + blue-to-token migration** · chore · P2 · L — pure refactor + ~113-hex migration; visual parity.
48. **Tournament match fixture ribbon + advance-to-final finish** · feature · P1 · L — ScorerShell slot refactor + FixtureRibbon + round-name formatter; scorer edits minimal.
49. **Tournament list blend** · feature · P2 · M — MonoTournamentList + local chip/progress components; nav consumed.
50. **Standings shared config-driven table + column correctness** · feature · P2 · L — StandingsTable extraction + per-sport column correctness fix; visual parity otherwise.
51. **Standings qualification rail + rank chips (blend)** · feature · P3 · M — visual blend consuming StandingsTable + shared chips.
52. **Tournament setup reskin** · feature · P2 · L — MonoTournamentSetup restyle + coaching chips + bulk paste.
53. **Tournament dispatch HiFi blend (bracket, champion, chips)** · feature · P3 · M — shell-consuming visual blend across 3 engines.
54. **Bracket tree view** · feature · P3 · L — KnockoutBracket + KnockoutMatchCard restyle; round-groups unchanged.
55. **Schedule / fixtures screen (round-axis)** · feature · P3 · M — MonoTournamentFixtures + route + util extraction + "View fixtures" link.
56. **Tournament workspace tabbed shell (Fixtures | Standings | Bracket)** · feature · P3 · M — TournamentTabs shell + route + post-score highlight; wraps existing views.

#### Epic 11 — Attribution & player-stats
_Goal: build who/how/credit-point capture as a shared bottom-sheet feeding a real player-stats model + persisted event log, rolled out per engine behind the Confirm toggle._
57. **Player-stats + roster-in-scoring data model** · feature · P2 · L — schema/types + storage + engine write-paths; no UI.
58. **Persisted per-point/ball event log (cross-engine)** · feature · P3 · L — engine completion write-paths + storage/types; no UI.
59. **AppAttributionSheet primitive + one sport (goals who-scored)** · feature · P2 · L — AppAttributionSheet + goals wiring + isInteractionLocked extension + tests.
60. **Attribution rollout — cricket (how-out / new-batter)** · feature · P3 · M — cricket wiring consuming the primitive; gated behind Confirm-wicket.
61. **Attribution rollout — tennis (credit point)** · feature · P3 · M — tennis credit-point wiring; gated behind Confirm setting.
62. **Attribution rollout — sets (credit point)** · feature · P3 · M — sets credit-point wiring; gated behind Confirm setting.

#### Epic 12 — Settings, account & appearance
_Goal: build the missing Settings/More surface, activate dark mode, warm the own-profile; defer inert-toggle wiring._
63. **Dark mode token system (.dark oklch overrides)** · feature · P2 · M — index.css .dark token set + smoke check across shell screens.
64. **Settings / More screen core** · feature · P2 · L — MonoSettings + MonoSwitch + settingsPrefs + /settings route + tests.
65. **Your profile account (own-profile polish, circle avatar)** · feature · P2 · M — MonoProfile own-profile polish; social chips conditional; no new data.
66. **Wire se_settings into scorers + share sheet** · chore · P3 · S — consumer wiring so Confirm-wicket/goal + Auto-share actually read se_settings.

#### Epic 13 — History & Statistics
_Goal: blend the ledger screens, build the records spine (tappable player names everywhere) + the viz layer; gate true point-by-point on the event log._
67. **History screen blend (I-086 filter, I-053 loading residual)** · feature · P2 · L — MonoHistory + HistoryDetailSheet + I-053 screenshot confirmation.
68. **History empty state (medallion + CTA)** · feature · P2 · M — MonoHistory zero branch + EmptyState + tests.
69. **Match detail dedicated screen (from history)** · feature · P2 · M — MonoMatchDetail + route + raw-data resolution; graph/share deferred.
70. **Statistics overview blend** · feature · P2 · L — MonoStatistics + WinRateRing/FormSparkline/StatChip; now a segmented lens inside History.
71. **Players leaderboard (team-ranked)** · feature · P2 · M — MonoLeaderboard + gold token; /statistics only.
72. **Player profile career visual slice** · feature · P2 · M — MonoProfile public-view polish; milestone rail/add-friend gated elsewhere; no new data.
73. **Match graphs momentum viz (set-level fallback)** · feature · P3 · M — MonoMatchGraphs + MomentumChart + momentum.js (volleyball/sets) + History affordance.
74. **Team stats — stable team-key + aggregation util + primitive extraction** · feature · P3 · M — stable key + teamStats util + primitive extraction; no screen.
75. **Team stats screen (MonoTeamStats layout)** · feature · P3 · M — MonoTeamStats screen consuming util + primitives.

#### Epic 14 — Live & Spectator infrastructure
_Goal: ship the live/spectator vertical slice as ONE epic (D4) — backend, public snapshot, share-live QR, shared spectator primitives, then per-sport screens (P3 sports land in the M3 tail)._
76. **Land live-broadcast stack to production** · feature · P2 · L — worktree→prod promotion; canonical-worktree decision recorded FIRST.
77. **Public per-match snapshot query + share-token guard** · feature · P2 · M — convex query + schema fields + route guard; youth privacy enforced; no per-sport UI.
78. **Share live link QR sheet reskin** · feature · P2 · M — ShareLiveMatch reskin + mono.css + qrcode dep + ⋯ trigger wiring.
79. **Wire se_settings into scorers + share sheet** — _(see #66; sequenced here in prOrder after the QR sheet lands)_.
80. **Shared spectator primitives (LiveBadge, ShareLiveSheet, MomentumStrip, SpectatorCaptionChip)** · feature · P2 · M — four primitives + CSS + tests; no screen.
81. **Spectator — tennis (read-only screen)** · feature · P2 · L — MonoTennisSpectator + tennisScore.js (+ characterization tests) + route.
82. **Match graphs momentum viz (set-level fallback)** — _(see #73; sequenced here in prOrder)_.
83. **Spectator — other sports (sets/goals engines)** · feature · P3 · M — one screen, two branches, consuming primitives.
84. **Spectator — football** · feature · P3 · M — MonoGoalsSpectator shell + HONEST empty states; possession/timeline gated on attribution.
85. **Spectator — cricket backend fields + scorer emission + youth-privacy sign-off** · feature · P3 · M — backend cricket snapshot fields + emission + sign-off; no UI.
86. **Spectator — cricket scorebug + chase chips + this-over UI** · feature · P3 · L — cricket spectator UI consuming backend fields + primitives.
87. **Spectator momentum / graphs tab** · feature · P3 · L — viz components after the event log lands.

### M3

#### Epic 15 — Social layer
_Goal: build the friends backend then the social screens; asymmetric Follow only, no request-inbox second graph (D9)._
88. **Friends backend (schema + convex/friends.ts)** · feature · P2 · L — schema + functions + tests; no UI.
89. **Find friends screen (add CTA gated)** · feature · P3 · M — MonoUserSearch reskin + FriendResultRow + invite-on-empty; Add gated.
90. **Friends list screen** · feature · P3 · L — MonoFriends page + nav entry; live-ring deferred.
91. **Activity feed screen** · feature · P3 · M — MonoActivityFeed + empty state + Home-entry; data wired later (no fake data).
92. **Notifications screen** · feature · P3 · M — MonoNotifications + route + APP_SHELL_PREFIXES + header bell.
93. **Dashboard social band (activity teaser, friends-live, watch, share)** · feature · P3 · M — follow-up wiring onto DashboardLanding.

#### Epic 16 — Teams management
_Goal: build the missing teams flow led by the roster-picker keystone (D10), on the existing Convex teams table._
94. **Team membership data model + convex/teams functions** · feature · P3 · L — schema + functions + useTeams hook; no screen.
95. **My teams grouped list** · feature · P3 · M — MonoTeams list consuming model; nested under Profile/More.
96. **Create team screen** · feature · P3 · M — MonoCreateTeam + TeamCrestPicker + route; stub add-players target.
97. **Add players sources screen** · feature · P3 · M — MonoAddPlayers core + SourceCard + PlayerChip upgrade.
98. **Roster squad & bench screen** · feature · P3 · M — MonoRoster + RosterPlayerRow + PlayerManageSheet; no drag in v1.
99. **Teams empty state** · feature · P3 · S — MonoTeams empty branch consuming EmptyState.

#### Epic 17 — Deferred polish, deep-viz & rasterization
_Goal: the genuinely-deferred tail, gated on prerequisites._
- **Share result card image export (rasterization)** · feature · P3 · M — shareCardImage.js hand-rolled canvas; high-risk spike isolated.
- **Dev showcases explainer (PR-B)** · feature · P3 · M — DesignSystemExplainer consuming tokens + a landed scorer.

---

## 6. Full build sequence (prOrder — numbered)

Build strictly in this order. Concurrent Opus agents each work in an isolated worktree; use a merge-train (update only the next-at-bat PR). M-boundaries are re-planning checkpoints.

**M1 — Foundation & core transformation**
1. Blend design tokens + blend-governance contract
2. Shared MonoSheet bottom-sheet primitive
3. Shared CaptionChip / CoachChip + capsule-CTA classes
4. Shared SegmentedToggle (capsule segmented control)
5. Shared AvatarCircle + SportMedallion + LiveDot
6. Shared EmptyState component (extract from MonoStatistics)
7. Shared motion/transition kit (tab-cut, push, sheet, commit-replace, FULL-TIME overlay)
8. Delete legacy orphans + harden NewUserFlow shadow
9. Shared BottomTabNav component + Home tab + I-066 Stats-label fix
10. 4-tab IA restructure (Home·Play·History+Stats·Profile/More) + Guided-toggle decision
11. Extract MonoQuickSetup from MonoQuickMatch (lift, zero visual change)
12. Shared coaching-status selectors (per-sport)
13. Guest landing blend + START deep-link to /:sport/quick
14. Login blend (capsule OAuth/guest CTAs, question copy)
15. Signup blend (brand medallion, capsule CTAs, SSO loading state)
16. Onboarding wizard reskin + celebratory finish (fix #0066ff debt)
17. Home first-run empty (EmptyDashboard upgrade)
18. Guest-sync chip (post-first-match)
19. Dashboard Live-now band (self active sessions)
20. Tournaments resume card on Home
21. Play hub blend (capsule mode toggle, badges, chips)
22. Sport home blend + delete _TABBED duplicate
23. Match setup restyle (on extracted MonoQuickSetup) + express lane
24. Customize & rules capsule controls (MonoSegment/MonoStepper/RuleSummaryChip)
25. Cricket toss interstitial (Setup → Live)
26. Cricket LO scorer visual blend (+ I-068 keep-green decision)
27. Cricket test scorer visual blend
28. Tennis scorer visual blend (Part A)
29. Sets scorer visual blend (prompt, per-set strip, coaching chip)
30. Goals scorer visual blend PR1 (seam prompt + Mode-B chips + football coaching + live dot)
31. Basketball quarter+bonus engine + Q3/BONUS coaching chip (Goals PR2)
32. Generic live game routing decision (retire vs model-dispatch)
33. Generic live game rebuild on arena system (only if kept)
34. In-match ⋯ menu (MonoScorerMenuButton + MonoMatchMenuSheet)
35. Scorer exit safety (confirm-on-discard, unified End, back-press guard, saved ack)
36. Between-sets interstitial (confirm winner → side-swap → next set)
37. Undo confirmation feedback (shared UndoControl + single toast slot)
38. Team-only mode (flag + gate + toggle + prompt caption)
39. MonoMatchResult shared screen + verdict helper (Sets wiring)
40. Result rollout (Goals/Tennis/Cricket wiring)
41. Result rollout (MonoLiveGame follow-up)
42. MonoScorecard shared screen
43. Share result card sheet (static render + shareFiles + text fallback)
44. Route recovery / 404 MonoFallbackScreen
45. Dev showcases hub + ShowcaseFrame (PR-A)
46. Legal pages blend

**M2 — Records, competition depth & live/spectator slice**
47. Tournament dispatch shell extraction + blue-to-token migration
48. Tournament match fixture ribbon + advance-to-final finish
49. Tournament list blend
50. Standings shared config-driven table + column correctness
51. Standings qualification rail + rank chips (blend)
52. Tournament setup reskin
53. Tournament dispatch HiFi blend (bracket, champion, chips)
54. Bracket tree view
55. Schedule / fixtures screen (round-axis)
56. Tournament workspace tabbed shell (Fixtures | Standings | Bracket)
57. Player-stats + roster-in-scoring data model
58. Persisted per-point/ball event log (cross-engine)
59. AppAttributionSheet primitive + one sport (goals who-scored)
60. Dark mode token system (.dark oklch overrides)
61. Settings / More screen core
62. Your profile account (own-profile polish, circle avatar)
63. Attribution rollout — cricket (how-out / new-batter)
64. Attribution rollout — tennis (credit point)
65. Attribution rollout — sets (credit point)
66. History screen blend (I-086 filter, I-053 loading residual)
67. History empty state (medallion + CTA)
68. Match detail dedicated screen (from history)
69. Statistics overview blend
70. Players leaderboard (team-ranked)
71. Player profile career visual slice
72. Team stats — stable team-key + aggregation util + primitive extraction
73. Team stats screen (MonoTeamStats layout)
74. Land live-broadcast stack to production
75. Public per-match snapshot query + share-token guard
76. Share live link QR sheet reskin
77. Wire se_settings into scorers + share sheet
78. Shared spectator primitives (LiveBadge, ShareLiveSheet, MomentumStrip, SpectatorCaptionChip)
79. Spectator — tennis (read-only screen)
80. Match graphs momentum viz (set-level fallback)
81. Spectator — other sports (sets/goals engines)
82. Spectator — football
83. Spectator — cricket backend fields + scorer emission + youth-privacy sign-off
84. Spectator — cricket scorebug + chase chips + this-over UI
85. Spectator momentum / graphs tab

**M3 — Social, teams & deferred depth**
86. Friends backend (schema + convex/friends.ts)
87. Find friends screen (add CTA gated)
88. Friends list screen
89. Activity feed screen
90. Notifications screen
91. Dashboard social band (activity teaser, friends-live, watch, share)
92. Team membership data model + convex/teams functions
93. My teams grouped list
94. Create team screen
95. Add players sources screen
96. Roster squad & bench screen
97. Teams empty state
98. Share result card image export (rasterization)
99. Dev showcases explainer (PR-B)

---

## 7. Screens cut / merged / demoted

| Screen | Decision | Rationale |
|---|---|---|
| MonoHome.jsx (orphan) | **cut** | Verified-dead, no importers/tests. One canonical Home = DashboardLanding in the tab bar. |
| MonoSetup.jsx (orphan) | **cut** | Verified-dead. Canonical setup = the extracted MonoQuickSetup. |
| MonoSportHome_TABBED.jsx (orphan) | **cut** | Dead duplicate with off-palette #0066ff. Follow-up ports its category-tabs into live MonoSportHome. |
| NewUserFlow.jsx | **keep** | Contradiction resolved conservatively: it is NOT an orphan (live at /play). Harden its shadow token; gate the Guided/Browse toggle, don't blind-delete. |
| Guided/Browse toggle on /play | **gate** | Routes first-timers into NewUserFlow. Gate until rebuilt for real (product decision) — neither blind-delete nor ship-as-dead-route. |
| MonoLiveGame.jsx (generic live view) | **cut-or-route** | Orphan reachable by no route. Default: retire + relax TennisQuickScorerRoute to model-based dispatch (MonoTennisLiveScore is already the config-driven engine). |
| Statistics (top-level tab) | **merge** | Demoted into History as segmented sub-tabs (Games · Players/Leaderboard · Stats). Kills the Stats-vs-Statistics split (I-066), frees a nav slot. |
| Guest landing + /dashboard + Play-as-home | **merge** | One Home surface with signed-in/out variants; Home becomes the discovery hub (Live-now + Resume + Start). |
| Play hub + Sport home | **merge** | One creation surface (Play tab); sport pick folded into creation; START deep-links to /:sport/quick. |
| Finish button + End-match chip | **merge** | One "End match" → explicit Save result / Exit without saving; fixes the inverted destruction guard. |
| Two cricket start paths (I-085) | **merge** | One setup branching on format; the toss interstitial handles regular in-page cricket. |
| Clerk avatar popover "settings" | **demote** | Auth ONLY; stops pretending to be app settings. Real settings live in Profile/More. |
| Milestones (as a screen) | **merge** | Folded into MonoProfile career rail (gated on backend), not a standalone screen. |
| Scorer style variant toggle (refined/new/old) | **cut** | Pick refined; hide the rest from user-facing surface. |
| Dev showcases (/showcase/*) | **demote** | Build-time gate, never runtime nav; internal DX only. |

---

## 8. OPEN QUESTIONS FOR THE USER

Product decisions that must be answered before or during the milestones they gate:

1. **Canonical live-broadcast worktree (M2 blocker):** promote the live stack from `.worktrees/live-matches` or `.claude/worktrees/wf_5fe79697`? A diff-and-pick decision that must precede "Land live-broadcast stack to production" (PR #74).
2. **Guided/Browse toggle on /play (M1 nav scope):** rebuild it for real, or remove it? Default = KEEP NewUserFlow (it is live-routed) and gate the toggle until rebuilt. Confirm the product intent.
3. **4-tab IA product sign-off (M1 nav scope):** confirm Home · [Play] · History (+Stats sub-tabs) · Profile/More, with the **5th Watch/Friends tab deferred** until the social+live slice ships.
4. **MonoLiveGame fate (M1 scorer scope):** retire (delete the orphan) + relax TennisQuickScorerRoute to model-based dispatch, or keep a distinct config-less generic screen? Default = retire + route.
5. **Youth-match privacy (M2 spectator gate):** sign off on the public-snapshot name-hiding rules for cricket (and all sports) before the spectator backend fields ship.
6. **Green hue confirmation (cross-cutting):** confirm `--se-color-action` / `--primary` actually resolves GREEN before any "green" copy or green-for-lead treatment lands (several issues flag this assumption).
7. **I-068 green 4/6 boundary accent:** reconciliation recommends KEEP (documented boundary semantic). Confirm you want it retained, not removed.
