# Live Matches — Orchestrator Handoff (resume here)

You are taking over the **live match streaming + mature scorecards** build with fresh context. Everything below is the ground truth; trust it over any stale memory.

## Progress — 2026-06-25 (resume HERE)
First end-to-end BROADCAST slice shipped (commits 4412193 + ee6353a, pushed):
- **Keystone built & tested:** `src/hooks/useLiveBroadcast.js` (create → scorePoint/undo/finalize through the outbox, optimistic, additive — a failed push never breaks local scoring; clientEventId `${clientMatchId}:${seq}` with seq persisted in `src/lib/live/liveSession.js` so reload re-attaches, no double-count). Includes the finalize-drain fix (finalize awaits in-flight point sends before archiving, via the now-coalescing `useLiveOutbox.flush`).
- **Reusable UI:** `src/designs/design1-mono/live/LiveBroadcastBar.jsx` (b0z: public-by-default + one-time consent + LIVE indicator + Stop/visibility) and `ShareLiveMatch.jsx` + `src/lib/live/watchUrl.js` (6fj: QR via `qrcode.react` + canonical link + native/web share). Drop the bar into any scorer + call `live.point/undo/finalize`.
- **Wired:** `MonoGoalsLiveScore` only (GOALS = flat score → round-trips through the existing backend with ZERO change; chosen as the de-risk slice). 827 tests green; type-check/lint/build green.

### Update 2 — 2026-06-25 (87d DONE + volleyball wired; commits 18a89ca)
- **`87d` backend snapshot extension — DONE (closed), deployed to dev.** `scorePoint`/`undo` take an optional operator `snapshot` (current-set pointsA/B, setsA/B, setScores, servingTeam, currentUnit, periodLabel) patched in ONE mutation (no egress amplification); event rows now carry snapshot-derived sets/serving; **reject writes to a `final` match** (after the idempotency check); `finalize` archives the SET tally for set sports. The snapshot arg validator is in `convex/live.ts`; `convex/live.test.ts` covers it (20 convex tests).
- **Volleyball/net wired** (`MonoSetsLiveScore`): mirrors point/undo with the engine snapshot via an effect on COMMITTED state (a point can close a set / open the next), finalizes on completion, same `LiveBroadcastBar`. The snapshot is computed from the local `sets[]` structure — no engine re-run.
- **Watch Trap B fixed:** `ScorecardPanel` renders volleyball from the snapshot (`VolleyballScorebug` gained an optional `state` prop) instead of re-deriving from the earliest-page event slice with default config.
- **`at` contract:** always epoch ms on the wire (matches feedRank); the engine's seconds interpretation is client-only. Period is explicit via `currentUnit`/`periodLabel`.
- Full gate green: **833 tests**, type-check, lint, build.

### Update 3 — 2026-06-25 (broadcast fan-out COMPLETE; commit 6d05484)
- **dkt / b0z / 6fj CLOSED.** All FIVE scorers now broadcast: goals, volleyball/net (`MonoSetsLiveScore`), tennis (`MonoTennisLiveScore`, quick + tournament), cricket (`MonoCricketLiveScore`), Test cricket (`MonoCricketTestLiveScore`). Each = `useLiveBroadcast` + `LiveBroadcastBar` + an engine-derived snapshot pushed per action (computed in a post-commit effect) + finalize.
- **Per-sport snapshot mapping:** goals = flat points; volleyball/tennis = current-set games/points -> pointsA/B, sets -> setsA/B, completed sets -> setScores, tennis game points -> periodLabel ("40-30"); cricket/Test = cumulative team runs -> pointsA/B, innings -> currentUnit, "<team> <runs>/<wkts> (<ov>)" -> periodLabel.
- **Watch:** VolleyballScorebug + TennisScorebug gained a snapshot `state` path (Trap B fix); cricket uses GenericStatHeader (whitelist strips per-ball detail) but the headline/PinnedScorebug is correct from the snapshot.
- Cricket scorer was Convex-agent authored then reviewed; Test cricket result logic (checkResult/advanceInnings/guards) left UNTOUCHED (additive only). Full gate green: **834 tests**, type-check, lint, build.

### Update 4 — 2026-06-26 (q7k + 6tf DONE; master merged in; commits 49f93cf, c30ea70, 4997c1d)
- **Branch synced with master** (merge 46ac5ac) — picks up the m39 Test-result fix + the Cloudflare Worker CI, so **PR #93 now gets its own Cloudflare preview** (`pr-93-scoreeasy.harshananda57.workers.dev`) for the runtime verify below.
- **`6tf` CLOSED** — `finalize` skips the `matches` archive for cricket (defers to the local scorer; a Test result can't be derived from cumulative runs).
- **`q7k` CLOSED — moderation floor shipped:** `convex/lib/profanity.ts` (NFKD/leet/spacing-resistant) holds operator team names on a hit; `resolveReadableMatch` (single chokepoint for all 4 public readers) hides `held`/`removed`/expired; public `report` mutation + `moderationReports` table (dedup, uniform/no-enum-leak, **FLAG-for-review via `flaggedAt`, never auto-hide** — reports can't censor); per-owner create rate cap; `by_owner_client` index; watch-page Report affordance (`ReportMatch` + `reporterId`). Advisor-verified. **862 tests; deployed to dev.**
- **cxr fast-follow gaps recorded** (see `scoreeasy-cxr`): operator un-hold/restore (profanity false-positives like "Scunthorpe" are silent takedowns with no recourse), word-boundary matching, a human review-queue UI over `flaggedAt`, per-reporter report cap, reactive auto-expire.

**NEXT (the ONLY remaining gate before #93 merges):**
1. **USER runtime-verify** (auth-gated; now possible via the #93 Cloudflare preview): sign in, score a match in EACH family (goals, volleyball/net, tennis, cricket, **Test cricket**), open the preview's `/live/:token` in a browser, confirm the headline + scorecard update live and Clerk/Convex work. The whole feature is unit-tested (862) but still **0% runtime-proven** — this is the merge gate. "q7k done" does NOT mean "#93 mergeable."
2. After verify → mark #93 ready + merge.
3. Deferred (post-launch): `cxr` heavier moderation, `3ws` public Watch feed, `s5m/obd/4qu/1bc/bx1` infra crons, tennis short-code.


## 0. Where to work
- **Worktree:** `C:\Users\harsha_befach\Downloads\Volleyball\.worktrees\live-matches`
- **Branch:** `feat/live-matches` (pushed to `origin/feat/live-matches`). Do NOT merge to master — the feature is not end-to-end yet.
- **Design doc (authoritative architecture):** `docs/plans/2026-06-22-live-matches-and-scorecard-design.md` — READ IT, esp. §3 (split-doc + offline), §4 (schema/functions), §7 (moderation, public-by-default), §12 (cost/efficiency + UX). Research: `docs/research/2026-06-22-*.md`.
- **Beads epic:** `scoreeasy-7ye`. Run `bd ready` / `bd show <id>` to see state + per-issue notes.

## 1. Current state — DONE & committed (807 tests green, all pushed)
- **Engine** (`src/models/live/`): `scoringEvents.js` (append-compensating undo, O(n) reduce), `scorecard.js` (generic derivations), `volleyball.js`, `tennis.js`, `goals.js`, `cricket.js`.
- **Backend** (`convex/live.ts`): mutations `create / scorePoint (idempotent on clientEventId) / undo / setVisibility / pause / finalize` (owner-enforced); PUBLIC token-gated queries `getByToken / getMeta / listEvents / eventsSince` — **security-hardened** (token-gate via `resolveReadableMatch`: allows public+unlisted, blocks private/removed; strict return whitelists; no ownerId/_id/token leak). Tests `convex/live.test.ts` (15, `// @vitest-environment edge-runtime`). Schema deployed to dev.
- **Scorecard UI** (`src/designs/design1-mono/scorecard/`): generic suite + Volleyball/Tennis/Cricket scorebugs+grids/cards + goals LineScore/Timeline. All over the engine selectors.
- **Offline** (`src/lib/live/outbox.js` + `src/hooks/useLiveOutbox.js`): persisted `se_outbox`, idempotent reconcile.
- **Watch side** (`src/designs/design1-mono/MonoWatchMatch.jsx` + route `/live/:token`): no-sign-in spectator page; **split-query** (one reactive `getByToken` snapshot + read-once `getMeta` + paginated `listEvents`); `/live` is in `GUARD_BYPASS_PREFIXES`.

Closed beads: `bpx gfn z7l 6ae 9ym qrg mh7 ppy 14n xjz 0yr`.

## 2. Remaining work — prioritized (critical path = end-to-end first)
1. **`dkt` — `useLiveBroadcast` hook + wire the scoring screens** (the BROADCAST half; unblocks end-to-end). On each local score, mirror to Convex via `live.create` (on go-live) → `live.scorePoint` (per point, through the outbox, OPTIMISTIC) → `live.finalize` (on end). **Discover the actual scoring screens** (`grep` for `*LiveScore*.jsx` / `MonoLiveGame`). localStorage stays AUTHORITATIVE — a failed push must never break local scoring. EGRESS: coalesce the snapshot push to ≤1/250ms for continuous sports (volleyball/etc.); cricket ball-by-ball immediate; never debounce the event append.
2. **`b0z` — visibility (public default, opt-out) + "LIVE — scores are public" indicator + one-time consent sheet** (`localStorage se_live_public_consent`). Overlaps the scorer UI from `dkt`.
3. **`6fj` — ShareLiveMatch sheet**: QR (`bun add qrcode.react`) + 6-char code + Capacitor Share (`@capacitor/share` is installed; see `src/mobile/share.js`). Encodes `https://scoreeasy.app/live/{token}`.
4. **END-TO-END VERIFY** (do this after 1–3): `preview_start`, score a match in the app, open `/live/:token` in the browser, confirm it updates live; measure egress via the Convex dashboard / MCP.
5. **`q7k` — moderation floor** (server-side profanity filter on team/player names in `create`; report affordance; auto-expire). REQUIRED before any public feed ships (Apple 1.2). Youth redaction already in `getMeta`.
6. **`3ws` — Watch Live feed**: a cron-materialized `feedSnapshot` doc (de-reactivated, rebuilt 15–30s; §12.2) + `/live` feed UI. Depends on `q7k`.
7. **`s5m` reaper · `obd` compaction+drop-guard · `4qu` cleanup sweep** (Convex crons; §12.3).
8. **`1bc` free-tier monitoring + Pro upgrade trigger + broadcast kill-switch** · **`bx1` viewer-scale load test** (Phase-1 exit gate).
9. **`bji` — spectator feed newest-first + full-log scorecard tab** (a dedicated desc paginated feed query; scorecard tab loads all pages).
10. Phase 2/3: `1fe` commentary feed, `qw6` replay, `1mx` net-sport variants; `cxr` heavy moderation, `qp0` history bridge, `0w6` nav, `tgp`/`00g` spikes, `d2p` video.

## 3. Mechanics & conventions (match these exactly)
- **bun**: `bun run test` (vitest, full suite ~160s), `bun run type-check` (tsc), `bunx eslint <files>`. TDD; **never commit red**; run the FULL gate (type-check + full suite + lint) before every commit.
- **Convex**: dev deployment `notable-hippopotamus-913` (`.env.local` present, gitignored). `bunx convex codegen` regenerates `convex/_generated` (tracked) AND **pushes functions to dev** — that is expected/authorized. convex-test files need `// @vitest-environment edge-runtime`. Authed mutations CANNOT be called via the Convex MCP `run` tool (no Clerk identity) — test them with convex-test (`t.withIdentity(...)`) or via the app.
- **Verification**: `preview_*` tools for the running app; Convex MCP (`status`/`run`/`functionSpec`/`tables`) for the backend (status `projectDir` = this worktree).
- **Parallel sub-agents**: spawn your own (Agent tool) or use the Workflow tool (Ultracode is on). Partition by DISJOINT files; agents verify only their own files via targeted `bunx vitest run <paths>`; YOU run the final full gate + commit (agents must NOT commit/git). Beware: parallel agents editing shared files (e.g. `index.jsx` routing, vitest config) conflict — serialize those.
- **Commit + push** (per issue or logical group): `git add <files>` → `git commit` (end message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`) → `git push origin feat/live-matches`.
- **Beads workflow**: claim `bd update <id> -s in_progress`; close `bd close <id> --reason="..."`. To persist beads to the branch (`.beads` is gitignored but `.beads/issues.jsonl` is tracked), use this EXACT pattern after closing/updating issues:
  ```
  git checkout 0e65c15 -- .beads/issues.jsonl
  IDS='scoreeasy-(7ye|bpx|gfn|6ae|9ym|mh7|dkt|6fj|0yr|b0z|q7k|z7l|qrg|bx1|1mx|ppy|14n|xjz|1fe|qw6|cxr|3ws|qp0|tgp|00g|d2p|obd|s5m|4qu|1bc|0w6|bji|<ANY-NEW-IDS>)'
  bd export 2>/dev/null | grep -E "\"id\":\"$IDS\"" >> .beads/issues.jsonl
  # verify: git diff 0e65c15 -- .beads/issues.jsonl | grep '^-' | grep -v '^---' | wc -l   → MUST be 0
  git add -f .beads/issues.jsonl && git commit -m "chore(beads): ..."
  ```
  Reset-to-baseline-then-append keeps the diff to additions only (avoids dragging unmerged audit-branch beads state). `0e65c15` is the master baseline this branch forked from. **Add any new issue IDs you create to the `IDS` list.**

## 4. Hard rules
- **Public-by-default + data minimization** (user decision): every match public-live by default, opt-out; ONLY scores + team/player names ever exposed (Convex return-validator whitelists — never add fields that leak `ownerId`/`token`/`_id`/`clientEventId`/`meta`/`playerId`).
- **Egress/caching efficiency is a stated user priority**: snapshot doc tiny (≤~300B), names OFF the hot path, snapshot-push coalesced, feed de-reactivated (cron), events paginated, NO presence heartbeats. Spectator scoreboard reads ONLY the snapshot.
- **Offline-first**: localStorage authoritative; broadcast is an additive async mirror; never break local scoring.
- **Free tier first** (user decision): launch on Convex Free, upgrade reactively; alerts at 50/75/90% + a broadcast kill-switch backstop (`1bc`).
- **Don't merge to master** until score → share → watch works end-to-end (and ideally the moderation floor, since public-by-default).
