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

**NEXT (in order):**
1. **USER must runtime-verify goals + volleyball** (auth-gated, can't be automated): sign in, score a match, open `/live/:token` in a browser, confirm headline + scorecard update live. This GATES the fan-out.
2. **Fan-out the remaining scorers**: `MonoTennisLiveScore`, `MonoCricketLiveScore`, `MonoCricketTestLiveScore`. Pattern = goals/volleyball: add `useLiveBroadcast` + `LiveBroadcastBar` + push an engine-derived snapshot per scoring action + finalize. Tennis maps to sets/games (snapshot pointsA/B = current game/points, setScores = set grid); cricket is the hardest — its snapshot fields (runs as pointsA/B, wickets/overs need a periodLabel or generic header; the public whitelist strips per-ball detail, so cricket falls back to GenericStatHeader on the watch). Workflow-fan-out is fine here (disjoint files; YOU run gate + commit) ONCE goals/volleyball are verified.
3. For tennis, also give `TennisScorebug` a snapshot `state` path on the watch side (same Trap B fix as volleyball).
4. Deferred (NOT in "shareable scores" scope): `q7k` moderation, `3ws` public feed, `s5m/obd/4qu/1bc/bx1` infra.


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
