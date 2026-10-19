# ScoreEasy — Flow & Information-Architecture Evaluation

**Date:** 2026-07-19 · **Author:** Fable (UX/IA synthesis) · **Inputs:** 9 traced+critiqued journeys (activation, core-loop, in-match, spectator, returning-live, social, tournament, records, teams, settings) + 3 IA analyses against the 60-screen inventory and design1-mono source.

**Goal:** SIMPLE and INTUITIVE. Seamless transitions. Surface the useful screens. Never let people get lost.

---

## 1. Recommended End-to-End Navigation Model

### One-line model
**4-tab bottom nav — Home · [Play·center-emphasized] · History(+Stats) · Profile/More-hub — with a link-first Watch/Spectator layer, growing to 5 tabs (Watch/Friends) only when the social+live slice ships.**

### 1.1 Primary nav (bottom tab bar)

| Slot | Tab | Contents | Notes |
|---|---|---|---|
| 1 | **Home** | Signed-in dashboard: Live-now friends band → own Resume band → Start CTA → activity feed → recent results. Signed-out: merged guest landing. | Today `DashboardLanding` exists but is NOT in the tab bar — users have no anchor. Home becomes the discovery surface for everything live/social. |
| 2 (center) | **Play** | Single create-match funnel: sport pick → one setup screen → scorer. Raised/emphasized CTA styling — it is the one action every session funnels through. | Merge Play hub + Sport home into ONE surface. Tournament entry lives here as a secondary action per sport AND gets a top-level resume path (see hubs). |
| 3 | **History** | The record: Games (match list) · Players/Leaderboard · Stats — as segmented sub-tabs. | Absorbs `/statistics`. Kills the Stats-vs-Statistics split (I-066) and frees a slot. Stats is a lens on history, not a destination. |
| 4 | **Profile / More** | Hub: profile card, **Settings** (scoring defaults, sharing/auto-share, appearance, data export/clear), Teams, Find friends (/users/search), notifications inbox (until a bell ships). | Resolves the "two Accounts" confusion: bottom-nav Account = profile+settings hub; Clerk avatar popover = auth ONLY. |
| (5, later) | **Watch / Friends** | Add ONLY when spectator + activity feed + follow graph ship. Never ship a tab that opens an empty shell. Profile then stays in slot 4 or moves behind the avatar. | Pick ONE label deliberately (Watch if live-feed-first, Friends if graph-first). No slash-labels. |

### 1.2 Key hubs
- **Home = discovery hub.** Live-now (friends) band ABOVE own-session Resume band — visually distinct: friends get `LIVE · Watch`, own sessions get `Resume` (never "LIVE"). Empty states are designed and encouraging, not blank.
- **Play = creation hub.** One start flow per sport (kill the duplicate cricket paths, I-085). Sport is remembered; returning users get a one-tap "Quick start <last sport>" shortcut.
- **Tournament workspace = competition hub.** A stable route (`:sport/tournament/:id`) with three internal tabs **Fixtures | Standings | Bracket** wrapping the engine views. Re-entry via a Home resume card and/or a Tournaments entry — never re-walk Play → sport → list.
- **Profile hub = everything low-frequency.** Settings, Teams, search, legal. One door, clearly labeled.

### 1.3 Cross-links (the connective glue)
- **Player names tappable everywhere** (match detail, scorecard, leaderboard) → `/profile/:username`. This single pattern stitches History, Stats, and Profile into one records spine.
- Match row → **Match-detail route** (`/history/:matchId`) → scorecard → players. Quick actions (Rematch/Share) demote to a sheet on that screen.
- Result screen → Share / Rematch / History / soft sign-in. Home Live band → Spectator. Notification → deep-link to Spectator/Profile with synthesized back-stack.
- Quick Match setup → **roster picker** (saved Teams) so teams feed scoring and scoring feeds team stats.

### 1.4 Back-stack & deep-link rules (global, non-negotiable)
1. **Tabs are lateral roots.** Tab switches are instant (no directional slide), each tab owns its own stack; tapping the active tab scrolls-to-top.
2. **Drill-downs are forward pushes** (slide-in / shared-element); Back always returns to the parent **with scroll + filter + query state preserved**.
3. **Committing transitions use `replace`**: Setup → Live scorer, Create-team → Roster. Back must never re-enter a torn-down setup or re-run creation.
4. **Destructive/exit guards:** system-back from a live scorer fires the leave-match confirm ("Pause & save / discard?") — never a silent pop. Back from Result goes to a safe hub, never back into a completed match.
5. **Deep links synthesize parents.** Cold-start spectator/tournament/roster links get a sane synthesized stack (→ Home or section list), so Back walks up, never exits or 404s.
6. **In-setup steps are internal state synced to history** (or back intercepted to decrement the step) so back mid-setup loses nothing.
7. **No back-press may ever land on a broken, empty, or orphan screen.** Orphans get deleted, not routed around.

---

## 2. Top Seamlessness + Lost-Risk Problems (ranked)

| # | Problem | Severity | Fix |
|---|---|---|---|
| 1 | **Match ends on a cliff.** No Result/FULL-TIME screen; end is a manual, uncelebrated tap; the highest-intent moment has no summary, share, rematch, or sign-in hook. (activation, core-loop) | Critical | Auto-detect match point → celebratory FULL-TIME overlay → Result screen: score + set breakdown, share card, Rematch, soft "Sign in to save". Layered above the scorer; back → safe home. |
| 2 | **Inverted destruction guard.** `Discard` (unrecoverable, `clearData`+navigate) is a raw one-tap sitting beside `Finish` — which IS confirmed. Data-loss trap at the exact moment of victory. (core-loop, in-match) | Critical | Confirm ON Discard (destructive-red, ConfirmActionPanel exists), demote it into the ⋯ menu; collapse Finish + End-chip into ONE "End match" → explicit "Save result / Exit without saving". Show a "Saved to history" acknowledgement. |
| 3 | **The live/watch promise is 100% unreachable.** Spectator screens, ShareLiveMatch, convex/live.ts live only in worktree branches; no share affordance, no route, no friend graph, no Live-now band. Three journeys (in-match, spectator, returning-live) are broken by it. | Critical | Ship as ONE vertical slice: follow graph → Home Live-now band → production Spectator route (engine-parameterized) → public share link + QR. A spectator screen alone stays unreachable. |
| 4 | **False affordances actively mislead.** Own-session "LIVE" badge reads as watchable friend content → dumps users into /game recovery. Dashboard card says "profile settings →" but /profile has zero settings. "team1 vs team2" implies teams that don't exist. | High | Relabel own sessions "Resume"; reserve LIVE·Watch for friends. Fix the settings label now (point at the real hub or stop saying "settings"). Never ship a label promising an absent feature. |
| 5 | **Social/records terminal actions don't exist.** Public profile has no Follow/Add CTA; Statistics has no player rows/leaderboard; match "detail" is a 3-button sheet; milestones have no surface. | High | Follow CTA (asymmetric follow, ONE graph — no request inbox) on `/profile/:username`; Players/Leaderboard tab in History; real Match-detail route with scorecard; milestones folded into MonoProfile. |
| 6 | **Redundant + forked entry funnel.** Sport picked on landing is re-asked by the Play-hub grid; Guided/Browse toggle routes first-timers into the orphan NewUserFlow; dual Quick/Tournament CTAs per card. | High | Landing `START <SPORT>` deep-links straight to `/:sport/quick`; delete the Guided toggle (or wire it for real); one primary "Play" per card, Tournament secondary. |
| 7 | **Settings doesn't exist; the app splits "Account" across two surfaces.** All four config goals (defaults, auto-share, dark mode, export/clear) unreachable; .dark theme coded but unwired. | High | One Account hub (profile + grouped settings sections); Clerk popover = auth only. Sane defaults + system-pref dark so settings is override-only, instant-apply toggles, guarded Clear-all with undo. |
| 8 | **Tournament re-entry + payoff friction.** No top-level re-entry (4-tap walk every session); Standings/Bracket partial with no confirmation a score registered; 1838-line setup monolith with per-team entry. | Med-High | Tournaments resume card on Home; tabbed workspace shell; post-score return highlights the updated row/advanced slot; setup stepper with bulk team paste. |
| 9 | **Invisible guest state.** First match saved local-only (`sync:'idle'`) with zero signal; silent-loss trust erosion. | Medium | Non-blocking "Playing as guest — sign in to sync" chip AFTER the first match. Never gate scoring on auth. |
| 10 | **Exploration debt makes tabs feel broken.** I-053 perpetual-loading (undefined vs []) on History/Stats; I-086 filters+summary eat the mobile fold; I-066 Stats/Statistics mismatch; empty states eject users into scoring. | Medium | Loading-vs-empty guards; results-first History layout with collapsed filters; one label token everywhere; in-place encouraging empty states that never teleport the user out of their journey. |
| 11 | **In-match affordance scatter.** No ⋯ menu; Undo undifferentiated among 4 twin text buttons; cryptic Side-out/Rally toggle; no attribution. | Medium | Bottom bar = 1 big iconed Undo + 1 ⋯ menu (Edit setup, Share, End). Hide rally jargon behind advanced settings. Attribution NON-blocking (long-press quick-tag / post-hoc), never a per-point sheet — protect the one-tap loop. |
| 12 | **Teams is a false door.** No routes, no UI, read-only backend; per-match names silently discarded. | Medium | 3-screen MVP (My Teams+empty → Create+Add combined → Roster) led by the keystone: roster picker in Quick Match. Reuse MonoUserSearch + MonoStatistics-filtered-by-team. |

---

## 3. Promote / Demote / Merge / Cut

### PROMOTE (surface the useful)
- **Home/Dashboard** → first tab slot with Live-now + Resume + Start CTA + feed.
- **Result/Scorecard** → build and make it the terminal of every match.
- **Spectator/Watch** → build; link-first destination of every share; later the 5th tab.
- **Settings** → build under the Profile/Account hub.
- **Players Leaderboard + Match detail/graphs** → History sub-tabs, direct entries.
- **User search (/users/search)** → out of orphan status into the Profile hub (later Friends tab), relabeled "Find & invite friends" with an invite path.
- **Tournaments** → top-level re-entry (Home resume card), stable tabbed workspace.
- **Profile career records/milestones** → enrich MonoProfile (fold in, don't add a screen).

### DEMOTE
- **Statistics** as a top-level tab → segmented view inside History.
- **History filters + 3-col summary** → collapsed control below results (I-086).
- **Tournament** CTA on sport cards → secondary to a single primary "Play".
- **Discard** → destructive item inside the ⋯ menu, behind a confirm.
- **Legal pages** → Settings footer. **Dev showcases (/showcase/*)** → build-time gate, never runtime nav.
- **Clerk avatar popover** → auth only; stops pretending to be app settings.

### MERGE
- Guest landing `/` + `/dashboard` + Play-as-home → **one Home** (signed-in/out variants).
- Play hub + Sport home → **one creation surface** (also settle the `_TABBED` variant question by deleting it).
- Finish button + End-match chip → **one End control**.
- The two cricket start paths (I-085) → one setup branching on format.
- Create Team + Add Players → **one create flow**. Team Stats → MonoStatistics filtered by team, not a bespoke screen.
- MonoLiveGame (generic live view) → into the per-engine scorers.
- Milestones → into MonoProfile. Match quick-actions sheet → into the Match-detail screen's overflow.

### CUT
- **Orphans:** MonoHome.jsx, MonoSetup.jsx, NewUserFlow.jsx, MonoSportHome_TABBED.jsx — delete. One canonical component per destination.
- **Guided/Browse toggle** on /play (unless Guided is rebuilt for real — until then it's a live route into a dead surface).
- **"LIVE" semantics on own sessions**, the misleading "profile settings →" copy, and the slash-label "Friends/More" concept.
- **Scorer style variant toggle** (refined/new/old) from user-facing surface — pick refined, hide the rest.

---

## 4. Missing Connective Screens/Patterns → file as issues

1. **Result / FULL-TIME screen** (summary, share card, rematch, soft sign-in) + auto-detected match-point transition.
2. **In-match ⋯ menu** (Edit setup · Share · End) + differentiated Undo — one surface resolves three dead-ends.
3. **Between-sets interstitial** (confirm set winner → auto-swap sides → next set) — mandatory for sets sports, currently unhandled.
4. **"Saved to history" confirmation** after End — makes save-vs-discard legible.
5. **Match-detail route** `/history/:matchId` with Scorecard (per-player lines) + Match graphs link.
6. **Players/Leaderboard surface** + tappable-player-name pattern everywhere.
7. **Follow CTA + relationship state machine** (none/following) on public profile, with optimistic flip + toast; distinct "< @handle" header so public ≠ own profile.
8. **Home Live-now band** (live-subscribed, slides in real time) + designed "no friends live" empty state.
9. **Production Spectator route** (one engine-parameterized screen, read-only, in-place score ticks, reconnect/stale banner, match-end → summary in place).
10. **Public share-live link + QR** with synthesized back-stack for cold-start entry.
11. **Search empty-state → Invite** ("No user named X · Invite them") — turns failed search into growth.
12. **Settings hub screen** with grouped sections, instant-apply toggles, System/Light/Dark tri-state, guarded Clear-all + undo snackbar.
13. **Tournament workspace shell** (Fixtures|Standings|Bracket tabs) + post-score highlight-on-return + honest partial/empty states for Standings/Bracket.
14. **Tournaments resume card** on Home (deep-link with synthesized parent).
15. **Teams front door + 3-screen MVP + roster picker sheet in Quick Match** (+ backend: roster junction table, create/add/remove/getRoster).
16. **Loading-vs-empty guards + Band-13 empty states** for History/Statistics/Home — in-place, never ejecting.
17. **Guest-sync chip** ("Playing as guest — sign in to sync") post-first-match.
18. **Share fallback chain**: navigator.share → clipboard copy → generated share-card/QR. Share never terminates in an error.
19. **Back-press exit guard** for the scorer (pause-save-or-discard), and setup step-state ↔ history sync.

---

## 5. Transition & Motion Guidance (brutalist × HiFi blend)

Brutalist = hard edges, instant confidence, no decorative easing. HiFi = legible spatial model, celebratory peaks. The blend: **motion only where it carries meaning — hierarchy, commitment, or reward. Everything else is instant.**

- **Tab switches:** instant cut (≤100ms opacity at most). No slides between lateral peers — horizontal motion falsely implies hierarchy.
- **Drill-down pushes:** fast slide-in from trailing edge (~200ms, sharp ease-out) or shared-element expand from the tapped row (match card → detail header). Back reverses it exactly; state preserved.
- **Setup steps:** internal horizontal slide + progress bar advance; back decrements the step, data preserved.
- **Committing transitions** (Start scoring, Create): `replace` + a decisive snap — the UI should feel like a door closing, on-brand brutalist.
- **In-scorer:** score changes tick/pop in place with haptic; Undo plays the reverse micro-animation so corrections are legible. Live surfaces NEVER full-reload.
- **Sheets/overlays** (share, attribution tag, roster picker, quick actions): bottom sheets over a still-live surface; dismiss = downward swipe, no stack entry, no re-mount.
- **The one celebratory exception:** FULL-TIME. Match point → brief lock + winner reveal overlay (respect prefers-reduced-motion) layered above the frozen scorer — the single place motion is allowed to be loud.
- **Set transitions:** brief interstitial with an explicit animated side-swap so the score reset reads as intentional, not a bug.
- **Theme toggle:** live ~150ms color transition; persists.
- **Failure states:** non-blocking banners (reconnecting / stale score) in place — never navigate away from a live surface.

---

## 6. Prioritized Flow/IA Directives (for Opus) + Epic-Sequencing Impact

Ordered by (user-harm × frequency) ÷ effort. D1–D5 are the top five.

- **D1 — Ship the Result/FULL-TIME terminal screen.** Auto-detect match point → celebratory overlay → summary + share card + Rematch + soft sign-in nudge; back → safe home. Closes the activation loop; every retention/virality hook lives here.
- **D2 — Fix scorer safety & consolidation.** Confirm on Discard (demoted to ⋯), ONE End control ("Save result / Exit without saving"), differentiated Undo, in-match ⋯ menu, back-press pause-guard, "Saved" acknowledgement, between-sets interstitial.
- **D3 — Restructure primary nav to the 4-tab model.** Home · [Play] · History(+Stats sub-tabs) · Profile/More hub; merge the three home-ish surfaces; delete orphans (MonoHome/MonoSetup/NewUserFlow/_TABBED) and the Guided toggle; unify the Stats label; adopt the global back-stack rules (§1.4) as a standing convention for every subsequent screen.
- **D4 — Ship the live/spectator vertical slice as ONE epic.** Follow graph → Home Live-now band (with empty state, own-session "Resume" relabel) → engine-parameterized Spectator route → public share link + QR + in-match Share entry. Sequenced as a slice — a spectator screen alone is unreachable; a band alone has no data.
- **D5 — Collapse the start funnel to ~2 taps.** Landing CTA deep-links `/:sport/quick`; one setup screen with "Quick start (defaults)" express lane and skippable team names; auto-advance on preset tap; remembered last sport for returning users; break MonoQuickMatch into Setup / Dispatch / Scorer.
- **D6 — Build the Account hub with Settings.** Profile + grouped settings (defaults, auto-share, System/Light/Dark, export/guarded clear); Clerk popover auth-only; fix the lying "settings" label immediately (independent quick win).
- **D7 — Build the records spine.** Match-detail route with Scorecard, Players/Leaderboard tab in History, tappable player names everywhere, milestones folded into Profile; demote the quick-actions sheet.
- **D8 — Tournament workspace + re-entry.** Tabbed shell (Fixtures|Standings|Bracket), finish Standings/Bracket (or honest empty states), post-score highlight-on-return, Home resume card, setup stepper with bulk paste, sport pick folded into creation.
- **D9 — Social minimum: asymmetric Follow only.** Follow CTA on public profile, /friends (following) list, search relabeled "Find & invite friends" + invite-on-empty; NO request inbox, NO second graph. Feed + notifications = phase 2.
- **D10 — Teams MVP led by the keystone.** Roster picker in Quick Match first, then My Teams(+empty) → Create+Add → Roster; backend roster junction + 4 functions; Team Stats = filtered MonoStatistics.
- **D11 — Guest trust + share resilience.** Post-match guest-sync chip; share fallback chain (clipboard → card/QR) so share never errors out.
- **D12 — Exploration-debt cleanup.** I-053 loading-vs-empty guards, I-086 results-first History, in-place empty states that never eject users into scoring, I-066 label unify (if not already dissolved by D3).
- **D13 — Motion system.** Implement §5 as a small shared transition kit (tab-cut, push, sheet, commit-replace, FULL-TIME overlay) so every epic composes the same primitives instead of inventing motion per screen.

### How this changes epic sequencing
1. **D1+D2 jump the queue as P0** — they fix data loss and the dead terminal moment inside the flow that already works; smallest effort, largest harm removed. Ship before any new surface.
2. **D3 (nav restructure) must land BEFORE the social/live/teams epics**, not after: every later epic needs a Home to surface bands/cards on, a hub to hang settings/teams off, and the back-stack conventions. Building social onto the current 3-tab shell would be rework.
3. **D4 becomes a single vertical-slice epic** replacing any plan that ships spectator screens, share links, and feeds as separate epics — separately they each dead-end (screen unreachable / band data-less / link 404s).
4. **D5 and D6 run parallel to D4** (no contention: funnel + settings touch different surfaces than live).
5. **D7–D10 sequence after nav**: records (D7) before social phase-2 (feed/notifications need follow data from D9); teams (D10) gates on the D5 setup split (the roster picker mounts into the new Setup screen).
6. **D11–D13 are continuous rails**, folded into every epic's definition-of-done rather than standalone epics — plus the standing rule: *no tab or entry ships pointing at an empty shell, and no label may promise an absent feature.*
