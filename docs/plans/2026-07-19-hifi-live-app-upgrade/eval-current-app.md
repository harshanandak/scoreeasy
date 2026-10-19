# ScoreEasy — Current Live App Inventory (design1-mono)

_Analysis only. No code modified. Date: 2026-07-19._

Entire live app: `src/designs/design1-mono/`. `src/App.jsx` lazy-loads `designs/design1-mono/index.jsx` (the router, 1568 lines). Design system: `src/designs/design1-mono/mono.css` (1986 lines). Core tokens live in `src/index.css` (`:root`). React + Vite + Tailwind v4, Convex backend, Clerk-style cloud auth.

---

## 1. SCREEN / FEATURE INVENTORY

Router = `src/designs/design1-mono/index.jsx`. 34 `<Route>` entries (many are redirects/recovery). App shell tabs (`index.jsx:566-582`): **Play / History / Stats**.

### Primary app screens
| Screen | Route | Component (file) | Purpose | State |
|---|---|---|---|---|
| Landing (guest) | `/` marketing | `MonoLanding.jsx` → `landing/GuestLanding.jsx` | Marketing/hero, sport grid | Built |
| Dashboard landing | `/dashboard`→redirect, `landing/DashboardLanding.jsx` | Signed-in home | Built |
| Play hub | `/play` | `MonoPlayHub.jsx` | Pick a sport → quick/tournament | Built |
| Sport home | (within play) | `MonoSportHome.jsx` (258 ln) + `MonoSportHome_TABBED.jsx` (169, alt/unused?) | Per-sport entry | Built; two variants exist |
| Quick match setup+scorer | `:sport/quick` | `MonoQuickMatch.jsx` (**2850 ln**, largest) | Setup + dispatch to scorer | Built, heavy/monolithic |
| Cricket scorer (limited) | dispatched | `scoring/MonoCricketLiveScore.jsx` (1007) | Ball-by-ball | Built |
| Cricket scorer (test/innings) | `:sport/quick/test-match/:matchId` | `scoring/MonoCricketTestLiveScore.jsx` (956) | Multi-innings | Built |
| Tennis scorer | `:sport/quick/live/:matchId` | `scoring/MonoTennisLiveScore.jsx` (766) | Games/sets/tiebreak | Built |
| Sets scorer | dispatched | `scoring/MonoSetsLiveScore.jsx` (646) | volleyball/badminton/tt/pickleball/squash | Built |
| Goals scorer | dispatched | `scoring/MonoGoalsLiveScore.jsx` (683) | football/basketball/hockey/handball/futsal/kabaddi/rugby | Built |
| Live game (generic) | — | `MonoLiveGame.jsx` (309) | Generic live view | Partial |
| Tournament list | `:sport/tournament` | `MonoTournamentList.jsx` (312) | List tournaments | Built |
| Tournament setup | `:sport/tournament/new` | `MonoTournamentSetup.jsx` (**1838**) | Create bracket/round-robin | Built, heavy |
| Tournament dispatch | `:sport/tournament/:id` | `TournamentDispatcher` → `MonoCricketTournament` / `GenericSetsTournament` / `GenericGoalsTournament` | Per-engine | Built |
| Tournament match score | `:sport/tournament/:id/match/:matchId/score` | `MonoTournamentLiveScore.jsx` | Score a fixture | Built |
| History | `/history` | `MonoHistory.jsx` (899) | Past matches, filters | Built (see debt) |
| Statistics | `/statistics` (`/stats`→redirect) | `MonoStatistics.jsx` (891) | Overview + per-sport + quick tabs | Built (see debt) |
| Profile | `/profile`, `/profile/:username` | `MonoProfile.jsx` (394) | Account/profile (no settings screen) | Built |
| User search | `/users/search` | `MonoUserSearch.jsx` (189) | Find users | Built |
| Onboarding | `/onboarding` | `MonoOnboarding.jsx` (922) | First-run setup | Built |
| Login / Signup | `/login`, `/signup`, `/sso-callback` | `MonoLogin`, `MonoSignUp`, `SSOCallback` (via `CloudAuthOnly`) | Auth | Built |
| Legal | `/privacy`, `/terms`, `/contact` | `landing/LegalPage.jsx` | Static | Built |
| Showcases (dev) | `/showcase/*` | `MonoMatchCardShowcase`, `MonoSetDisplayShowcase`, `BrutalistColorShowcase`, `DashboardShowcase` | Internal, gated by `SHOW_INTERNAL_ROUTES` | Dev-only |
| Recovery/404 | `*`, `/game/:id` | `RouteRecoveryActions`, `NotFoundRoute` | Fallbacks | Built |

**Stubs/orphans:** `MonoHome.jsx` (154), `MonoSetup.jsx` (210), `NewUserFlow.jsx` (513) — not referenced by the router; likely legacy. `MonoSportHome_TABBED.jsx` is an alternate not wired in.

**14 sports** (`src/models/sportRegistry.js`): sets(6)=volleyball, badminton, tabletennis, tennis, pickleball, squash; goals(7)=football, basketball, hockey, handball, futsal, kabaddi, rugby; custom-cricket(1)=cricket.

---

## 2. BRUTALIST VISUAL IDENTITY (must preserve)

Tokens in `src/index.css :root` (oklch). Semantic `--se-*` aliases map onto them.

**Color (hex approximations of oklch):**
- Canvas/background `oklch(0.9782 0.0039 145.5458)` ≈ `#F1F4EF` — off-white, faint green tint (`index.css:` background).
- Ink/foreground `oklch(0 0 0)` = **pure black `#000`** (foreground, and `--border`, `--input` are ALSO pure black — the defining brutalist move).
- Card/surface `oklch(0.9855 0.0026 145.5558)` ≈ near-white.
- Primary (green) `oklch(0.6230 0.1688 149.1777)` ≈ `#2FA64F` — brand green; `--secondary` `oklch(0.6270 0.1940 149.2140)` slightly more saturated.
- Accent (soft green) `oklch(0.9231 0.0773 156.7494)`; accent-foreground `oklch(0.4104 0.1066 149.9393)`.
- Destructive `oklch(0.5308 0.2178 29.2339)` red; danger `oklch(0.49 0.17 29)`.
- `--se-color-line: var(--border)` = pure black lines everywhere.

**The hallmark — hard offset shadow (0px blur), `index.css`:**
- `--shadow-2xs/xs: 3px 3px 0px 0.5px hsl(0 0% 0% / 0.35)`
- `--shadow/sm: 3px 3px 0px 0.5px hsl(0 0% 0% / 0.70)` — **solid black hard drop-shadow, no blur** = classic brutalism.
- `--shadow-x/y: 3px`, `--shadow-blur: 0px`.

**Borders:** `--se-border-standard: 1.5px`; components use `1px solid var(--se-color-line)` (pure black). Note: borders are thin (1–1.5px) but hard black + hard shadow carry the brutalist weight (not thick-border brutalism).

**Corner radius (near-square):** `--radius: 0.25rem` (4px); `--se-radius-card: calc(radius + 4px)` = 8px. Tight, boxy.

**Typography:** `--font-sans: Inter`; `--font-mono: JetBrains Mono`; `--font-serif: Merriweather` (imported Google Fonts, `index.css:1`).
- Mono type used for labels/scores; uppercase + tracking is the signature: e.g. `mono.css:68-70` `font-size:0.75rem; text-transform:uppercase; letter-spacing:0.12em`; `mono.css:700-704` mono/uppercase/`letter-spacing:0.08em`/`font-weight:700`; `mono.css:1160-1165` `letter-spacing:0.1em` uppercase.
- Heavy weights: `font-weight:700–900` (`mono.css:588,1078,1110`). Big score numerals `font-size: clamp(3rem, min(22vh,26vw), 8rem)` (`mono.css:1109,1220`) and `3.75rem` (1211).

**Signatures:** open borderless typographic tap-zones for scoring (`mono.css:880` "no card, no blue edge; press flashes the accent"; `.mono-arena-half` 1027), uppercase mono micro-labels, hard black hairlines, hard offset shadows, boxy 4–8px radius, green reserved for lead/emphasis.

---

## 3. TECH SHAPE

- **Styling: hybrid.** (a) `mono.css` semantic classes (`mono-btn`, `mono-arena-half`, `mono-scorer-run-button`, `mono-cricket-key`…) carry the identity; (b) Tailwind v4 utilities used inline in JSX (`grid grid-cols-3 gap-3`, `text-sm font-semibold`); (c) inline `style={{}}` for one-off values (e.g. `MonoHistory.jsx:637`, `color:'#111'` hardcodes appear at `MonoStatistics.jsx:526`, `MonoHistory.jsx:562`). Tokens flow oklch → `--se-*` → CSS classes.
- **Sport modularity:** central `models/sportRegistry.js` (engine + config + standingsColumns + features per sport). Engine → scorer/tournament chosen by dispatcher (`index.jsx:1262-1283` TournamentDispatcher; scorers by storageMode). Adding a sport = registry entry mapping to an existing engine.
- **Shared components:** `design1-mono/components/` (BackArrow, ConfirmActionPanel, PlayerChip, RouteRecoveryActions, AppScoringPrompt…), `hooks/`, `landing/`, `theme/sportsTokens.js`.
- **Tests: strong presence.** ~30+ `*.test.jsx/js` co-located (MonoStatistics, MonoHistory, MonoPlayHub, MonoProfile, scoring/*, a11yContracts, guard tests, AppOwnedScoringPrompts asserts CSS-class usage). Convex `convex/*.ts` (matches, teams, users, schema) with tests.

---

## 4. DESIGN DEBT — locations + root-cause (many already partly fixed in code)

**IMPORTANT:** Several issue IDs appear as fix-comments already in the source, i.e. prior work shipped for them. Verify against kernel "open" status before re-fixing.

- **I-044 tiny fonts** — `mono.css` + `MonoSportHome.jsx`. Already addressed: explicit "decorative floor 0.6875rem / functional floor 0.75rem (I-044)" comments at `mono.css:698,1161,1357,1441,1538,1640`, `MonoSportHome.jsx:24,38`. Root cause: uppercase mono micro-labels sized ≤0.6875rem (11px). Floors set but 0.6875rem is still small on mobile.
- **I-047 CTAs lack tap feedback** — `mono.css`. `:active` states DO exist (`.mono-btn:active` 605, `.mono-btn-primary:active` 643, `.mono-action-primary:active` 682, `.mono-score-btn:active` 774). Root cause: coverage is uneven — some CTAs (inline-styled buttons in JSX, e.g. history/stats action buttons) have no `:active`/scale, so feedback is inconsistent rather than absent.
- **I-068 arbitrary green run-button highlight** — `scoring/MonoCricketLiveScore.jsx:717,729,915,934` `mono-scorer-run-button-accent` applied only to 4/6. Root cause: 4/6 get green accent text while other run buttons don't — an ad-hoc emphasis that reads as outside the system (comment 926 defends it as "the single documented green accent").
- **I-066 nav labels (Statistics vs STATS)** — bottom-nav uses **"Stats"** (`index.jsx:568,582`) while the page title/tablist/copy says **"Statistics"** (`MonoStatistics.jsx:362,490`, `/statistics` route). Root cause: label mismatch between nav and destination.
- **I-052 rugby buttons non-uniform** & **I-051 football/basketball tap-cards** — `scoring/MonoGoalsLiveScore.jsx` + `mono.css:1070-1083` `.mono-arena-action`. Already addressed: comment `mono.css:1072` "3/5/7 reads as a uniform, finished, pressable set (I-051, I-052)". Root cause: goal/point increment buttons had ad-hoc sizing per value; shared `.mono-arena-action` class introduced to unify.
- **I-049 opponent line looks disabled** — `scoring/MonoGoalsLiveScore.jsx:510` comment "disabled <button> reads as a dead control (I-049)"; opacity dimming at 655/663/674 (`opacity:0.4/0.45`). Root cause: real `disabled` + `opacity:0.4` made legitimate controls look dead; partially reworked.
- **I-085 play screen duplicates cricket start paths** — `MonoQuickMatch.jsx` (2850) + cricket routes (`:sport/quick/test-match/:matchId` vs dispatched `MonoCricketLiveScore`). Root cause: two cricket entry paths (limited-overs vs test) plus quick-match dispatch overlap; the mega `MonoQuickMatch` conflates setup and multiple start flows.
- **I-086 history filters dominate mobile** — `MonoHistory.jsx:529` (`grid grid-cols-3` summary) + search/filter block ~637+. Root cause: filter/search + 3-col summary consume the top of a mobile viewport before any results.
- **I-013 empty Statistics overview** — `MonoStatistics.jsx:339,381` — already addressed: "skip zero-value stat grids, lead with a CTA (I-013)". Root cause: overview rendered empty zero grids for new users; now CTA-first.
- **I-053 History/Statistics perpetual loading** — `MonoStatistics.jsx` / `MonoHistory.jsx` data fetch (Convex `useQuery`). No explicit loading guard surfaced in grep. Root cause (guess): `useQuery` returns `undefined` while loading and the components render a loading state that never resolves when the query has no data / user is guest (undefined vs empty-array not distinguished).

---

## 5. GAPS / UNDERDEVELOPED

- **Live / spectator / broadcast: NOT in the shipped app.** `live/` components (LiveBroadcastBar, LiveMatchCard, LiveNowStrip, ShareLiveMatch, ReportMatch) and `convex/live.ts` exist ONLY under `.claude/worktrees/wf_*` (a branch), not in real `src/designs/design1-mono/` or `convex/`. A real-time spectator view is effectively missing from production.
- **No Settings screen** — no settings/preferences/theme-toggle route; Profile is the only account surface. No dark mode toggle (a `.dark` variant is declared in `index.css` but unused).
- **Statistics depth** — overview intentionally minimal (I-013); no charts/trends/head-to-head visualizations beyond tables.
- **Schedule/fixtures** — tournament has bracket/list but no standalone schedule/calendar screen.
- **Monolith risk** — `MonoQuickMatch.jsx` (2850) and `MonoTournamentSetup.jsx` (1838) are very large; setup+scoring+dispatch conflated (feeds I-085).
- **Legacy orphans** — `MonoHome`, `MonoSetup`, `NewUserFlow`, `MonoSportHome_TABBED` unwired; dead-weight to reconcile during upgrade.
