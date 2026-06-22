# Live Match Streaming + Mature Point-by-Point Scorecards — Design

- **Date:** 2026-06-22
- **Branch / worktree:** `feat/live-matches` → `.worktrees/live-matches` (off `origin/master` 0e65c15)
- **Research:** [research report](../research/2026-06-22-live-matches-and-scorecard-research.md) · [feed/commentary UX](../research/2026-06-22-feed-and-commentary-ux.md)
- **Status:** Plan — awaiting approval before `/dev`

---

## 1. What we're building

Two intertwined features for Score Easy:

1. **Live match broadcast & spectating.** While a match is being scored, the scorer can share it to anyone via **QR code, 6-char match code, or link**. Anyone with that link watches a **read-only live scoreboard** — *no sign-in required* — updating in real time. A **global public "Watch Live" feed** lets people browse all matches that have been published publicly and open them.
2. **Mature, broadcast-grade point-by-point scorecards.** A realistic scorecard layer — live scorebug, set/period structure, a running ball-by-ball / point-by-point history, and post-match replay — that feels like an official scoresheet for every sport family *and* for custom "silly" games.

### Locked product decisions (from the user, 2026-06-22)
| Axis | Decision | Consequence |
|---|---|---|
| Discovery / visibility | **Public-live by DEFAULT for every match** — opt-OUT to stop; private share link always available for specific people *(decided 2026-06-22, CricHeroes-style)* | Every match streams to the public *Watch Live* feed by default. Universal public ⇒ the feed **and** a compliant moderation floor are **Phase-1 core**, not deferrable (§7–§8). No "feed later" path exists once default is public. |
| Public data contract | **Only scores + team names + player names** are ever exposed publicly *(decided 2026-06-22)* | Strict whitelist enforced by Convex **return validators** — no other PII, location, contact, notes, or account data. Scorer sees a persistent **"LIVE — scores are public"** indicator (§7.2). |
| Spectator auth | **No sign-in; link is enough** | Public, token-gated Convex queries with args **and** return validators; unguessable token, no enumeration (§4.4). |
| Rollout across scoring screens | **All 4 at once** (generic/sets, tennis, cricket, tournament) | The broadcast layer wires into every live-score screen in Phase 1. (Scorecard *maturity* per sport is still sequenced generic-first — see §6.) |
| Ball-by-ball log | **Persist for replay** | Append-only `matchEvents` survives into history; powers replay + the scorecard. |

> **Model = CricHeroes-style universal public.** Like [CricHeroes](https://cricheroes.com/global) (40M+ users; every grassroots match is publicly scored ball-by-ball and discoverable in a live feed), every Score Easy match is **public-live by default**. The scorer can opt a match out (private / link-only) and can always share a private link to specific people. Because public is the default *and* universal, the public feed + a compliant moderation floor are **first-release requirements** (§7–§8), and the public payload is strictly minimized to **scores + team/player names** — nothing else.

### Non-goals (this initiative)
- **Live video streaming** — a future epic (CricHeroes does phone/OBS/VMix video; the user flagged it as a "maybe later"). v1 spectating is a live scoreboard + scorecard, not video.
- A social follow graph / friends list (presence-based popularity is later).
- Multi-scorer / co-scoring (breaks the single-writer guarantee — deferred, design spike only; §9).

---

## 2. Current state (verified)

- **Convex is fully wired** (`ConvexProviderWithClerk`, Clerk auth via `tokenIdentifier` → `users.by_token`). Tables: `users`, `matches`, `matchPlayers`, `teams` ([convex/schema.ts](../../convex/schema.ts)).
- **`matches` is a one-way archive.** Live scoring lives entirely in **localStorage** (`gs_sessions`, `se_quickmatches`); a completed match syncs to Convex **once, on completion** via `useMatchSync` → `matches.save`, deduped by `clientMatchId` ([convex/matches.ts:66](../../convex/matches.ts)). `matches.detail` is `v.optional(v.any())` — free-form, can hold a final scorecard JSON.
- **Public unauthenticated queries already exist** (`getPublicUserStatsByUsername`, `getPublicRecentByUsername` are plain `query`, no auth gate) — the token-gated spectator query follows an established pattern, not a new precedent.
- **Scoring model is thin:** `scores[participantId] = { total, sets:[], history:[{value,timestamp,newTotal}] }`. The point log has no event type, no team/player attribution, no set/rally context. Building the mature scorecard requires a **richer append-only event model**.
- **Sports:** `sportRegistry.js` — 14 sports, engines `sets` / `goals` / `custom`(cricket). Tennis & cricket already have dedicated live-score screens; the rest use a generic +1/−1 board.
- **Design system:** green-monotone oklch tokens in [src/index.css](../../src/index.css) + `mono.css`; hard offset shadows, 1px/1.5px/2px black edge system, 0/4/8px radius scale, `.mono-history-row` ledger pattern, bottom nav (Play/History/Stats/Profile), Capacitor safe-areas + back-button guards on scoring routes.

---

## 3. Architecture

### 3.1 Core principle — additive offline-first mirror, never a replacement
**localStorage stays authoritative for the live match.** Broadcast is an *additive async push* to Convex. A failed/slow/offline Convex write must **never** block or corrupt the local scoring loop. This is a Capacitor mobile app; the scorer must keep working with no network. Anyone refactoring the scorer *onto* Convex breaks offline play — explicitly out of bounds.

### 3.2 Split-document real-time model (Convex reactive queries)
Convex `useQuery` is a standing reactive subscription over a managed WebSocket — late joiners get current state for free, reconnection is internal. We do **not** build a WebSocket server, SSE replay buffer, or `Last-Event-ID` machinery. We build a **good schema**:

- **`liveMatches`** — one tiny denormalized **snapshot** doc per live match: only hot scoreboard fields (score, sets, serving, status). Spectators `useQuery` it by `token`; each point patches this one small doc → one cheap re-render.
- **`matchEvents`** — separate **append-only log**, the source of truth for play-by-play, replay, and scorecard derivation.

**The #1 anti-pattern to avoid:** recomputing the scoreboard from the event log inside the spectator query. That pulls every event into the read set and re-invalidates the subscription on every append. The spectator scoreboard reads the snapshot doc only; the log is read by the (paginated) feed/replay query.

### 3.3 Single writer = no batching, no conflicts
One operator per match = single serial writer = zero OCC write conflicts. Points arrive every few seconds. So: **one mutation per point**, doing **two writes in one transaction** — append the `matchEvents` row *and* patch the `liveMatches` snapshot — keyed by a client `idemKey` for idempotent retries. No *conflict*-batching is needed (that literature is about many concurrent writers; it does not apply). **Note:** §12.2 adds a 250 ms **snapshot-push coalescing** for rapid continuous sports — a cost/egress optimization, *not* conflict-batching; the per-point `matchEvents` append stays immediate so replay is never lossy.

### 3.4 Offline outbox (the part Convex does *not* give us)
Convex's exactly-once retry queue is **in-memory in `ConvexReactClient` and lost on app-kill/reload** — the common case on mobile. So:
- localStorage stays authoritative.
- Maintain a **persisted `se_outbox`** of unsynced events, each carrying an idempotency key (`${matchId}:${seq}`).
- On Capacitor `networkStatusChange → connected`, replay through an **upsert-by-`idemKey`** mutation (deduped via index).
- Optimistic update (`withOptimisticUpdate`) gives sub-100ms tap feel on the snapshot; rollback on failure.

### 3.5 Lifecycle & archive reconciliation
`liveMatches` is the *in-progress* doc; the existing `matches` table stays the *completed archive*. On finalize, a `live.finalize` mutation writes the final result into `matches` (scorecard JSON in `detail`), **reusing the existing `clientMatchId` dedup** so a match is never double-written or written in two conflicting shapes. `useMatchSync`'s completion path and the live path converge on the same `clientMatchId`. Finalized `matchEvents` are retained for replay (TTL/compaction is Phase 3).

### 3.6 Undo model — append-compensating, never destructive
Undo/correction is modeled as a **new appended `matchEvents` row** (`type: 'undo' | 'correction'`) that recomputes the snapshot in the same transaction — **not** a destructive `delete max seq`. A spectator's reactive feed and the persisted replay must stay internally consistent; deleting the last event would desync any spectator who already received it and corrupt the "persist for replay" guarantee. (The research report's cricket section says "delete max seq" for a single-device local log; **for the broadcast/replay path we override that with append-compensating** — this is the canonical rule for `matchEvents`.)

---

## 4. Data model (schema delta)

### 4.1 New: `liveMatches` (snapshot doc)
```ts
liveMatches: defineTable({
  token: v.string(),                 // unguessable crypto-random; NOT _id; the public handle
  ownerId: v.id("users"),            // NEVER returned to spectators (stripped by return validator)
  clientMatchId: v.string(),         // ties to local match + archive dedup
  sport: v.string(),
  scorecardKind: v.string(),         // 'generic' | 'volleyball' | 'tennis' | 'cricket' | 'goals' | ...
  status: v.union(v.literal("live"), v.literal("paused"), v.literal("final")),
  visibility: v.union(v.literal("private"), v.literal("unlisted"), v.literal("public")), // default 'unlisted' for a shared link
  isYouthMatch: v.boolean(),
  moderationStatus: v.union(v.literal("clean"), v.literal("held"), v.literal("removed")),
  teamA: v.object({ name: v.string(), color: v.optional(v.string()) }),
  teamB: v.object({ name: v.string(), color: v.optional(v.string()) }),
  // denormalized hot scoreboard (kept tiny — no arrays of history here):
  pointsA: v.number(), pointsB: v.number(),
  setsA: v.number(), setsB: v.number(),
  setScores: v.array(v.object({ a: v.number(), b: v.number() })),
  servingTeam: v.optional(v.union(v.literal("A"), v.literal("B"))),
  currentUnit: v.number(),           // set/game/period index
  periodLabel: v.optional(v.string()),
  lastSeq: v.number(),
  startedAt: v.number(), lastEventAt: v.number(),
  publishedAt: v.optional(v.number()), publicExpiresAt: v.optional(v.number()),
})
  .index("by_token", ["token"])
  .index("by_owner", ["ownerId"])
  .index("by_feed", ["visibility", "moderationStatus", "lastEventAt"]) // discovery feed
  .index("by_public_sport", ["visibility", "sport", "lastEventAt"]),
```

### 4.2 New: `matchEvents` (append-only log / source of truth)
```ts
matchEvents: defineTable({
  matchId: v.id("liveMatches"),
  seq: v.number(),                   // monotonic; order by THIS, not _creationTime
  idemKey: v.string(),
  type: v.union(
    v.literal("point"), v.literal("set_end"), v.literal("serve_change"),
    v.literal("timeout"), v.literal("undo"), v.literal("correction"), v.literal("note"),
  ),
  team: v.optional(v.union(v.literal("A"), v.literal("B"))),
  value: v.number(),                 // +1 default; +N for rugby/kabaddi/custom
  playerId: v.optional(v.string()),  // optional — gated behind "track players"
  // denormalized running state so any feed row re-derives indicators at any scroll position:
  runningA: v.number(), runningB: v.number(),
  setsA: v.number(), setsB: v.number(),
  servingAfter: v.optional(v.union(v.literal("A"), v.literal("B"))),
  commentary: v.optional(v.string()),
  meta: v.optional(v.any()),         // sport-specific (cricket delivery, tennis point kind, etc.)
  at: v.number(),
})
  .index("by_match_seq", ["matchId", "seq"])
  .index("by_match_idem", ["matchId", "idemKey"]),
```
> Cricket's ball-by-ball deliveries, tennis point kinds, etc. ride in `meta` (or a dedicated `deliveries` projection table if the cricket card needs richer indexing — decided in the cricket issue). The generic engine stores `value` + `type` + running totals so rugby (5/2/3), kabaddi (1/2), and custom (+N) all flow through one model.

### 4.3 Visibility / moderation fields & tables
On `liveMatches`: `visibility` (**`public` default** / `unlisted` / `private`), `isYouthMatch`, `moderationStatus` (`clean`/`held`/`removed`), `publishedAt`, `publicExpiresAt` (auto-expire). **v1-floor table:** `moderation_reports` (reason enum, signed-out reporter via session token, status). **Fast-follow tables (Phase 2/3):** `blocks` (blocker/blocked, enforced both directions), `hidden_matches` (userId/matchId), `moderation_audit` (append-only), `users.acceptedTermsAt`.

### 4.4 Function surface
**Operator (authed, `authedMutation`):** `live.create`, `live.scorePoint` (append event + patch snapshot, idempotent), `live.undo`/`live.correct`, `live.setVisibility`, `live.pause`, `live.finalize` (→ archive into `matches`).
**Public (plain `query`, no auth, token-gated):** `live.getByToken` (single doc; **return validator whitelists ONLY `sport`, `status`, scores, team/player names, timestamps** — strips `ownerId`/`_id`/`token` and everything else, §7.2), `live.listEvents` (`usePaginatedQuery`, ordered by `seq`), `live.eventsSince(seq)`.
**Public feed (Phase 1 — core, plain `query`):** `live.listPublicFeed` — server-side filter `visibility==='public' AND moderationStatus==='clean' AND publicExpiresAt > now`. Same minimized whitelist; never returns secrets; never an enumerable list of private matches.
**Security invariants:** token is an unguessable `v.string()` (not `_id`); every public function has args **and** return validators enforcing the §7.2 whitelist; no public enumerate query; rate caps on the write/report path (v1 floor).

---

## 5. Client architecture

- **`useLiveBroadcast(localMatch)`** — scorer-side hook. Mirrors each local scoring action to `live.scorePoint`; owns the `se_outbox`, optimistic updates, and reconnect replay. Imported by all 4 live-score screens *without altering their localStorage-authoritative loop*.
- **Scorer UI:** matches go **public-live automatically**; a persistent **"LIVE — scores are public"** indicator shows while broadcasting (plus a one-time first-run notice). A **`ShareLiveMatch`** bottom sheet (QR via `qrcode.react`, 6-char code, Capacitor Share / `navigator.share`) shares the spectator link; copy: *"Anyone can watch — scores + names only. They can't change the score."* A **visibility toggle** lets the scorer turn a match private/link-only (opt-out).
- **Spectator route `/live/:token`** (public, unauthenticated, outside the scoring-exit guard): pinned scorebug + serve indicator + completed-sets ledger + live-pulse flash + 90s stale→`PAUSED` badge + `?kiosk=1` chromeless cast mode. Tabs: **Feed / Scorecard / Stats** (default Feed).
- **Scorecard component library** (shared by scorer, spectator, and history replay): generic suite + per-sport families (§6).
- **Discovery `/live` "Watch Live" tab** (Phase 1 — core): ledger rows, sport-chip filter, live-pulse, empty/early-days state. New bottom-nav entry.

---

## 6. The mature scorecard (sequenced generic-first)

Detailed, directly-implementable specs (element order, column lists, line templates, edge cases) live in the [research report §4](../research/2026-06-22-live-matches-and-scorecard-research.md). Build order and the load-bearing invariants:

1. **Generic scorecard suite (FIRST — highest leverage).** `GenericStatHeader` (leader/margin, lead changes, times tied, largest lead, biggest run, scoring rate), `SegmentSummary` (manufactured line-score, auto-bucketed + captioned), `GenericTimeline`, `RunIndicator`, `LeaderStrip`, `DifferentialHero`. Works for **any +1/+N game** including the goal sports and custom/silly games → delivers "official feel" universally before any sport-specific box score exists. *This is the headline answer to "realistic feel even out of silly games."*
2. **Volleyball (set-sport superset).** Scorebug (serving glyph, sets-won pills, current points, set label, timeouts, set/match-point chip) + set-by-set matrix + rally point-log. Invariants: **`servingTeam` is a stored boolean, never derived from last scorer**; win-by-2 **no cap** (score can exceed 25); set-5 to 15 with side-switch at 8.
3. **Other net sports as config variants** over the same engine — but **do not collapse their distinct elements**: pickleball needs its 3-number `5-3-2` token; squash PAR engages win-by-2 only at 10-10; badminton stores `rulesetVersion` (21-pt now; 3×15 default flips 2027) with a frozen per-match rules snapshot; table-tennis serve cadence is engine state.
4. **Tennis.** Persist raw integer point counts (never the `15/30/40/AD` display string); 2-row scorebug + 5-col grid; format presets (ATP/Grand-Slam/doubles); tiebreak serve rotation is special-cased.
5. **Cricket** (additive over `MonoCricketTestLiveScore`). A `deliveries`/`matchEvents.meta` log is the source of truth; batting card, bowling card, extras, FoW, partnership, RRR, and ball-by-ball commentary are **pure projections**. Integrity invariant: `sum(batter runs) + extras === innings.runs` every ball. Wides/no-balls and byes/leg-byes each corrupt multiple columns if mishandled — dedicated unit tests.
6. **Goal/period sports.** Shared event model + `LineScore` (per-period team totals) + `Timeline` + football match-centre + rugby/kabaddi `+N` templates (these *are* the generic engine). Player box scores are Phase-3, behind a "track players" mode.
7. **Live commentary feed** + **spectator page composition** — see [feed/commentary UX](../research/2026-06-22-feed-and-commentary-ux.md). **Undo/correction is a first-class event type from day one** (a naive append-only log shows spectators the wrong play-by-play after a scorer fixes a mistake).

---

## 7. Security, privacy & moderation (public-by-default — the floor is release-blocking)

Because **every match is public-live by default** (§1), the whole app is a public UGC surface from the very first match — there is no pre-public phase to hide behind. The controls below are therefore **first-release requirements** (Apple Guideline 1.2; COPPA) that ship in Phase 1 *with* the feed. The decisive mitigation the user chose is **strict data minimization** (§7.2): the only user content ever exposed is **scores + team names + player names**.

### 7.1 v1 compliant floor (ships WITH the feed) vs fast-follow heavier stack
- **v1 floor (first release, ships with the public feed):**
  - **Server-side profanity/slur filter** on the exposed strings (team/player names) in the create/update mutation — NFKC-normalize, strip zero-width, evasion-resistant; **never client-only** (the mutation is directly callable). Block or `held`.
  - **Report affordance** on the spectator page + feed rows, **usable signed-out** (reason taxonomy → operator queue).
  - **Youth → initials:** matches flagged youth/under-18 render player names as **initials + jersey number** in every public view (COPPA-safe default; the lightest form of the user's "just names" rule). Server-enforced.
  - **Auto-expire** public visibility (~match end + grace) so the feed stays live-only and standing exposure is bounded.
  - **Opt-out:** the scorer can switch any match to `unlisted`/`private` at any time.
  - **Data-minimization whitelist** (§7.2) + **rate caps** on publish/report.
- **Fast-follow (Phase 2/3):** Block/Hide flows, operator review queue + audit log, AUP acceptance gate, appeals, ML/phonetic near-miss filtering, reserved/verified club names, DSA transparency counts.

### 7.2 Public data contract + transparency (the user's data-minimization mandate)
- **Whitelist, enforced server-side:** the public spectator payload and feed expose **only** `sport`, `status`, scores, team names, player names, and timestamps. Convex **return validators** strip everything else (`ownerId`, account info, location, contact, notes) — public minimization is true *by construction*, not by convention.
- **Transparency / consent:** while broadcasting, the scorer sees a persistent **"LIVE — scores are public"** indicator, plus a **one-time first-run notice** explaining that scores + names are visible to everyone and how to turn a match off.
- A leaked field is then a code-review failure, not a config mistake — this contract is *why* public-by-default is defensible.

**OWASP / threat notes:** A01 (broken access control) — single-writer enforced server-side, spectators read-only, `ownerId` never leaves the server; A03 (injection / stored XSS) — team/player names are user-rendered text: sanitize + escape, no `dangerouslySetInnerHTML`; enumeration — unguessable token + return validators + no public list query of private matches; abuse/DoS — rate caps on the write/report path; privacy — public-by-default bounded by the §7.2 whitelist + youth-initials + auto-expire.

---

## 8. Phasing & PR sequence

All work is **in scope**. Because public-by-default makes the feed + moderation floor first-release requirements, Phase 1 is larger than a typical MVP; sequencing within it is by dependency.

**Phase 1 — Public live-share + scorecard foundation (public-by-default, WITH the feed + floor)**
Schema (`liveMatches` + `matchEvents`) → operator mutations (transactional, idempotent) → public token-gated queries **with the §7.2 data-minimization whitelist** → offline `se_outbox` + reconcile → `useLiveBroadcast` into **all 4** scoring screens → `/live/:token` spectator (no-signin, serve indicator, stale badge, kiosk) → **public "Watch Live" feed** (sport filter, live-pulse rows) → **public-by-default visibility + opt-out** + **"LIVE — scores are public" indicator** + **ShareLiveMatch** private link → **moderation floor** (profanity on names + signed-out report + youth-initials + auto-expire + rate caps, §7.1) → **generic scorecard suite** + **volleyball** scorecard.
> **Phase-1 exit gates:** (a) **viewer-scale load test** (Convex reactive fan-out for hundreds of signed-out spectators on a hot match — existential to public-by-default scale); (b) offline invariant (no loss across app-kill mid-match); (c) idempotent reconcile (no double-count on outbox replay); (d) **App-Store-readiness review** of the moderation floor + §7.2 data contract.

**Phase 2 — Scorecard maturity + heavier moderation (fast-follow)**
Other net sports (config variants) → tennis → cricket → goals/period → live commentary feed + spectator Feed/Scorecard/Stats tabs + live-pulse → history replay of persisted `matchEvents`. In parallel: **fast-follow moderation** — Block/Hide + operator review queue + audit + AUP gate + appeals.

**Phase 3 — Depth & reach**
History read-bridge for past public matches; presence-driven viewer-count; multi-scorer; player box scores; per-unit sparklines; ML/phonetic moderation + DSA transparency; **live video streaming** (CricHeroes-style — new epic).

---

## 9. Open questions / decisions needed (from research §8)
1. **Convex reactive fan-out cost at viewer-scale** — unvalidated for hundreds of signed-out spectators on one hot match. Needs a **load test** before promising "unlimited free spectators." → promoted to a **Phase-1 exit gate** (§8), not a deferrable footnote.
2. **Capacitor deep-link config** for `/live/:token` (iOS associated domains / Android App Links; app-not-installed → web, not App Store). (Spike)
3. **Multi-scorer serialization** (co-scorers break single-writer; `lastSeq` compare-and-set vs active-writer lease). Deferred — design spike only.
4. **Discovery cold-start threshold** — how many concurrent public matches unlock the "Watch Live" tab (+ "be the first" fallback).
5. **Volleyball `competitionLevel` flag** — technical timeouts fire only in FIVB World/Olympic, sets 1-4; default off?
6. **Two-sided football timeline on ~380px mobile** — collapse to single minute-ordered column? (Design call.)
7. **Moderation operator staffing** — Apple ~24h / DSA "without undue delay" are real commitments for a small team; profanity-filter sensitivity + allowlist tuning baseline.
8. **History read-bridge for past public matches.** History today reads **localStorage only**; Convex `matches` is written but never read back. The *live* feed + in-match replay are Phase 1, but browsing a *finished* match's scorecard (from a profile or the feed after it ends) needs a new Convex archive read path. Not free — Phase 3.
9. **Public-by-default scale & abuse load.** Universal public broadcasting means the load test (#1) and the moderation-report volume both scale with adoption from day one; the v1 floor's rate caps + auto-expire are sized assumptions to validate, not finished numbers.

---

## 10. Testing strategy (TDD-first per forge)
- **Pure scoring/derivation logic** (set-close, win-by-2/cap, tennis point ladder, cricket card projections, generic stat header, segmentation) — unit tests *first*; these are deterministic and the highest-value coverage.
- **Idempotency** — `scorePoint` with a repeated `idemKey` must not double-count; outbox replay after simulated reconnect reconciles exactly.
- **Offline invariant** — local scoring fully functional with Convex unreachable; no data loss across app-kill mid-match.
- **Security** — public query return validators strip `ownerId`/`token`; token enumeration impossible; profanity filter runs server-side (bypass attempt via direct mutation call is blocked).
- **Integrity invariants** — cricket `sum(batter runs)+extras === innings.runs`; serve boolean stored not derived; event log + snapshot stay consistent after undo.

---

## 11. Beads epic
Tracked under the epic **"Live match streaming + mature scorecards"** (`scoreeasy-7ye`) with child issues mapped to §8 phases (see `bd show`). Dependencies: schema → mutations/queries → broadcast wiring → spectator; shared event model → generic scorecard → per-sport; **moderation floor + public feed ship together in Phase 1** (public-by-default), with the heavier moderation stack as a Phase-2 fast-follow.

---

## 12. Cost, efficiency & UX hardening

This section converts the cost/efficiency, data-lifecycle, and UX research into binding decisions for the public-by-default live-match feature. The split-document architecture (`liveMatches` snapshot + `matchEvents` append-only log + token-addressed `getByToken`) is the load-bearing decision everything below defends.

### 12.1 Cost model & dominant drivers

Convex caches query results: when a snapshot doc changes, exactly **one** query re-execution reads the DB and all other current subscribers are served the cached bytes. Consequences:

- **DB bandwidth** scales with `writes × snapshot-size`, **not** with spectator count. Per point ≈ 0.5 KB written (one `matchEvents` row + one snapshot patch).
- **Spectator fan-out is a function-call + egress story**, not a DB story. Each client's reactive sync is a function call; each cached snapshot result is pushed (egress) to all N subscribers on every change.
- **Dominant driver #1 — a hot match:** 300 spectators × ~15 updates/min × 120 min ≈ **0.5M function calls** and ~160 MB egress for a *single* match.
- **Dominant driver #2 — the Watch-Live feed:** a fully-reactive list of all live matches re-pushes to every browsing client whenever *any* listed match changes. At thousands of concurrent matches this invalidates near-continuously. This is the #1 thing to de-reactivate.
- **Free tier ends on function calls first** (1M/mo — a single hot match or a few thousand matches for ~1 hour exhausts it), then DB bandwidth (~1 GB/mo, ~0.9 GB/hr at 2000 matches). **Decision: Convex Professional ($25/mo; 250M calls, 50 GB I/O, 50 GB egress) is the floor.** Free is dev/demo only; it returns HTTP errors at real traffic.

### 12.2 Efficiency mechanisms (MVP)

| Mechanism | Parameter / value | Tag |
|---|---|---|
| **Snapshot field budget** (`liveMatches` hot doc) | ≤ 300 B / ≤ ~12 scalar fields: scores, set scores, sets-won, serving side, status, seq, token. **No names/avatars/log/event arrays.** Enforced by a `getByToken` return validator. | **Both** |
| **Snapshot patch debounce** (continuous sports) | Coalesce to ≤ 1 patch+push per **250 ms** tick (≤ 4/s/match); localStorage stays authoritative so the scorer's own UI is instant. **Cricket ball-by-ball stays immediate** (discrete, low rate). Never debounce the `matchEvents` append needed for replay. | **Cost** |
| **Discovery feed: de-reactivated** | Cron-materialized `feedSnapshot` doc rebuilt every **15–30 s** (status=`live`, top N by recency/heat, names+score whitelisted), served by one trivial reactive query. Decouples feed cost from match-mutation rate entirely. | **Cost** |
| **Feed page size** | `usePaginatedQuery`, **20/page**, bounded to **≤ 50 hottest** live matches, return-validated to `{teamNames, scores, sets, status, token}`. Reactive fallback (if not cron-materialized): `by_feed` index with **status as leading equality** + `.paginate(20)`. | **Both** |
| **Spectator scoreboard query** | `getByToken`: single `.get()` by indexed token, whitelist ~8 public scalars, no joins, no log read. | **Both** |
| **Events fetch** | `usePaginatedQuery` initial **50/page** by `[matchId, seq]`, plus `eventsSince(seq)` cursor for the live tail / reconnect deltas. Never recompute the board from the log. | **Both** |
| **feedRank throttle** | Bucket to ~**30 s** granularity (`floor(now/30000)`); only patch when the bucket rolls over, even though `lastEventAt` patches every point. Stops the feed reordering on every rally. | Cost |
| **Presence / viewer count** | **Disabled by default.** Heartbeats reintroduce crowd-scaling cost (each = a function call + a shared-counter write → N cached re-reads). If required, use a coarse cron-sampled estimate. | Cost |
| **Subscription hygiene** | On `visibilitychange`, unsubscribe the scoreboard after **60 s** hidden and pause the feed poll when backgrounded; resubscribe on focus. (Phase 2.) | Cost |
| **Usage alerts** | Convex dashboard alerts at **60% / 80%** of Pro inclusions on the three movers: function calls, egress, DB bandwidth. | Cost |

### 12.3 Data lifecycle & retention

**Organizing invariant (the drop guard):** granular `matchEvents` rows may be deleted for a match **only when both durable artifacts exist** — (a) the compacted scorecard JSON in `matches.detail`, and (b) for high-event sports, the cold gzip blob in Convex File Storage. The cleanup mutation re-checks this guard per match before deleting.

- **Compaction-on-finalize:** on finalize, write the compacted scorecard to `matches.detail`. Compaction is **lossless for low-event sports** (volleyball/TT/pickleball — set/point aggregate fully reconstructs the board) but **lossy for cricket ball-by-ball**, which therefore **must also** cold-store the raw ordered log as one `gzip(JSON)` blob (`eventBlobId`, `eventCount`, `eventSchemaVersion`) before any row is dropped — one object replaces thousands of indexed rows.
- **Abandoned-match reaper (cron every 10 min):** query `by_stale [status='live', lastEventAt < cutoff]`, `take(batch)`, run the **same** compaction+archive path as manual finalize, flip status to `final`/`expired`, self-reschedule until drained. Reaped matches must hit the archive path or the drop guard blocks their rows forever.
- **Per-sport finalize thresholds (mandatory):** a single global threshold wrongly kills paused cricket. Volleyball/TT **2–3 h**; cricket **12–24 h** (innings breaks, rain, multi-day). Feed-hide after **45 min** with no new event (distinct from finalize; a hidden match can resume).
- **Indexing & pagination:** `matchEvents` → `by_match_seq=[matchId, seq]` (pagination/replay) + `by_match_client=[matchId, clientEventId]` (idempotent `se_outbox` dedupe; the upsert no-ops if `(matchId, clientEventId)` exists → reconnect storms never double-count). `liveMatches` → `by_token`, `by_feed=[status, visibility, moderationStatus, feedRank]`, `by_stale=[status, lastEventAt]`. Paginate/replay by **`seq`, never `_creationTime`**.
- **Retention numbers:** keep `matchEvents` rows **48 h** post-finalize (late-spectator / re-watch convenience), then delete **only if** the drop guard passes; cold blob kept for the life of the match. **Cleanup sweep cron every 6 h** paginates finalized matches older than 48 h and deletes each match's events in one transaction (a single match < 16,384 rows). Cron runs don't overlap.
- **Token fallback:** store `token` on both `liveMatches` and `matches` (`by_token` on each); `getByToken` reads the snapshot if present, else the archived match — so snapshots can be reaped aggressively without breaking shared "Watch Live" links.

### 12.4 UX structure & IA decisions

- **Scorer go-live (public-by-default, consent once, never nag):** in the existing `.mono-scorer-topbar-actions` cluster add three persistent affordances next to the badge — (1) an **ambient `LIVE · PUBLIC` pill** (status, not a button; green dot + mono 700), (2) a **visibility control** (sheet with radios **Public (default) / Link-only / Private**), (3) a **Share** button reusing `src/mobile/share.js`. The **only** onboarding gate is a one-time first-run bottom sheet ("Your live scores are public. Only scores and names are shared."), persisted as `localStorage se_live_public_consent=1`; never shown again. No per-match confirmation — the ambient pill is the standing reminder, and the visibility control is present **every** match so opt-out is always one tap.
- **Spectator page at top-level `/live/:token`:** registered **above** the `:sport/*` routes — `/:sport/live/:matchId` is already taken by `LegacyTennisLiveRoute` (index.jsx L1541) which redirects into the protected scorer. `MonoWatchMatch.jsx` = sticky scorebug (reactive `useQuery(getByToken)`, never recomputed from the log) + a 3-tab strip: **FEED** (point-by-point via `usePaginatedQuery`, newest-first), **SCORECARD** (full breakdown from snapshot), **STATS** (Phase-2 stub — can't be live-accurate from the snapshot). Signed-out by default; **one** dismissable sign-up CTA docked at the bottom ("Save matches — create free account"), never a wall.
- **Dock / nav decision — do NOT add a 6th dock tab in MVP.** The mobile dock (`bottomNavItems`, index.jsx L578) is already 5 cells (Home/Play/History/Stats/Account) and is the **only** persistent mobile nav (top `global-nav` is `display:none` < 768px). A 6th cell at the 520px max width drops below the 54px touch target. **MVP:** surface Live via a "WATCH LIVE" rail on `DashboardLanding` and a "Watch live" entry atop `MonoPlayHub`, with the full feed at route `/live` (`MonoWatchFeed`). **Phase 2:** merge History+Stats into one sub-tabbed "Matches" destination (both retrospective) to free a cell → dock becomes Home / Play / **LIVE** / Matches / Account.
- **Feed IA + empty state (`MonoWatchFeed`, `/live`):** sticky horizontal sport-chip filter (reuse `SportIcon`, "All" default, single-select); sort = "Live now" then "Just finished". Card = live dot + sport eyebrow, two team rows (name 700, tabular score right, leader 800), thin status line, whole-card tap → `/live/:token`. **Empty state is never a dead end:** "No public matches right now" + **Start a match** (primary → `/play`) and **Browse recent results** (secondary → `/history`), using `RouteRecoveryActions` language. The feed query is bounded (≤ 50) and field-whitelisted because every browsing client hits it.
- **Onboarding — Share button IS the funnel:** target ≤ 2 taps from a live point to a shared link. Public-by-default means the `/live/:token` URL exists the moment the match starts (no "publish" step); tap Share → native sheet prefilled with the token URL and "Team A vs Team B — live". Spectators arriving cold need zero onboarding.
- **Capacitor / accessibility:** `/live` is **not** an app-shell prefix, so by construction it renders no dock, adds no `has-mobile-bottom-nav` body class, and the popstate/native back-button scoring guards (`isProtectedScoringRoute`, `src/mobile/backButton.js`) stay **dormant** — no new guard code. The **one** required wiring: add `/live` to `GUARD_BYPASS_PREFIXES` (index.jsx L161) so a signed-in-but-not-onboarded user following a share link isn't bounced to `/onboarding`. Spectator scorebug uses one **coarse `aria-live="polite"`** region announcing **set/game score changes only** (running point score = atomic/non-announced) to avoid per-rally SR spam; tab strip is a real `role=tablist`; honor `env(safe-area-inset-*)` on `/live` and kiosk.

### 12.5 Explicit cost ↔ UX tradeoffs

- **Names: cost wins — names are NOT in the hot snapshot.** The lifecycle research proposed denormalizing `team1Name/players[]` onto `liveMatches` for a self-contained `getByToken`; **rejected on cost**, because under Convex's full-result-push model those name bytes get re-pushed to every spectator on **every point**. Decision: the hot snapshot carries only scores/sets/serving/status/seq; **names live on a sibling meta doc read once** (invalidates ~never). The spectator still mounts two stable queries with no join — self-containment is preserved, the per-point name re-push is eliminated.
- **Feed: cron-materialized (chosen) vs reactive.** The 15–30 s `feedSnapshot` cron is the decision; the status-leading index + `.paginate(20)` + return-validator is the complementary reactive fallback (not an unresolved either/or). Cost: the feed lags new matches by up to one interval — acceptable for browsing discovery. The per-match scoreboard stays fully real-time via `getByToken`; only the aggregate feed is throttled.
- **Debounce vs liveness:** 250 ms snapshot coalescing is invisible (scorer sees instant local UI; spectators within perceptual "instant"). Pushing past ~300–400 ms feels laggy on fast rallies; cricket stays immediate.
- **48 h raw-row tail vs storage:** keeps re-watch/late-spectator reads hot but delays reclamation; shorten toward 6 h to cut cost at the expense of slower cold-blob replays.
- **No viewer count vs product expectation:** omitting presence avoids crowd-scaling heartbeat cost; if a count becomes a hard requirement, it is an explicit new cost line (coarse estimate only).
- **Lossy compaction:** cricket ball-by-ball fidelity lives **only** in the cold blob; if the blob write fails, the drop guard keeps the raw rows — never drop on a half-completed archive.

### 12.6 New / changed beads work

- **Schema + indexes:** add `liveMatches` (`by_token`, `by_feed` status-leading, `by_stale`) and `matchEvents` (`by_match_seq`, `by_match_client`); add `token`/`eventBlobId`/`eventCount`/`finalizedReason` to `matches`. AC: serial per-point mutation = dedupe on `clientEventId` → append with next `seq` → patch snapshot, one transaction.
- **`getByToken` + snapshot budget:** single indexed `.get()`, return validator whitelists ≤ 8 scalars; **names sourced from a separate meta query**, not the snapshot. AC: snapshot ≤ 300 B, no log read.
- **Snapshot debounce:** coalesce continuous-sport patches to ≤ 1/250 ms; cricket immediate; `matchEvents` append never debounced.
- **Watch-Live feed:** cron-materialized `feedSnapshot` (15–30 s, status=`live`, top ≤ 50, field-whitelisted); client reads via `usePaginatedQuery(20)`. AC: feed cost independent of match-mutation rate; no unbounded reactive `.collect()`.
- **Events delta endpoint:** `eventsSince(seq)` + paginated log (50/page); never recompute board from log.
- **Compaction-on-finalize + drop guard:** build `matches.detail`; high-event sports gzip raw log to File Storage; events deletable only when both artifacts exist.
- **Abandoned-match reaper:** 10-min cron, shared finalize path, **per-sport thresholds** (volley 2–3 h, cricket 12–24 h), 45-min feed-hide.
- **Guarded cleanup sweep:** 6-h cron, 48 h post-finalize retention, per-match single-transaction delete, re-verify guard.
- **feedRank throttle:** ~30 s bucket; patch only on bucket rollover. (Phase 2.)
- **Scorer go-live UI:** ambient `LIVE · PUBLIC` pill + visibility control (public/link-only/private) + Share in `.mono-scorer-topbar-actions`; one-time consent sheet (`se_live_public_consent`).
- **Spectator route `/live/:token`** (`MonoWatchMatch`, scorebug + Feed/Scorecard/Stats tabs) + **full feed `/live`** (`MonoWatchFeed`, sport-chip filter + empty state). AC: registered above `:sport/*`; add `/live` to `GUARD_BYPASS_PREFIXES`.
- **Watch Live nav placement:** MVP = dashboard rail + Play-hub entry (no dock change); Phase-2 issue = merge History+Stats → "Matches" to free a dock cell (touches `/history` + `/statistics` routes, redirects, and `MonoHistory.test`/`MonoStatistics.test`).
- **Accessibility/Capacitor verification:** coarse `aria-live="polite"` (set/game score only), `role=tablist` tabs, safe-area insets; confirm `/live` renders no dock and leaves scoring back-button guards dormant.
- **Plan for Professional plan + usage alerts** at 60/80% of inclusions on function calls / egress / DB bandwidth before launch.