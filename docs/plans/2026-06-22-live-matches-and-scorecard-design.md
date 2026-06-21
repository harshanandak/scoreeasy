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
| Discovery / visibility | **Per-match visibility choice** — scorer picks "Everyone" (public feed) **or** "People I choose" (private link), per match *(refined 2026-06-22)* | First-class **visibility selector** is a Phase-1 primitive. "People I choose" = link/QR/code (`unlisted`) ships first behind the moderation floor; "Everyone" (`public`) is the opt-in that brings the full Apple 1.2 moderation stack + browse feed (Phase 3, §7–§8). |
| Spectator auth | **No sign-in; link is enough** | Public, token-gated Convex queries with args **and** return validators; unguessable token, no enumeration (§4.4). |
| Rollout across scoring screens | **All 4 at once** (generic/sets, tennis, cricket, tournament) | The broadcast layer wires into every live-score screen in Phase 1. (Scorecard *maturity* per sport is still sequenced generic-first — see §6.) |
| Ball-by-ball log | **Persist for replay** | Append-only `matchEvents` survives into history; powers replay + the scorecard. |

> **Visibility framing (the user's refinement).** Rather than a single global on/off, every match carries a visibility the scorer chooses when going live: **"People I choose"** (a private share link — the default, low-risk, Phase 1) or **"Everyone"** (surfaces in the public *Watch Live* feed — opt-in, gated on the full moderation stack, Phase 3). A match can be flipped between them; it only appears in the browse feed once that feed + moderation ship.

### Non-goals (this initiative)
- Video streaming (spectator view is a live scoreboard, not video — matches the amateur-app norm).
- A social follow graph / friends list (sharing is link/code/QR; presence-based popularity is Phase 3+).
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
One operator per match = single serial writer = zero OCC write conflicts. Points arrive every few seconds. So: **one mutation per point**, doing **two writes in one transaction** — append the `matchEvents` row *and* patch the `liveMatches` snapshot — keyed by a client `idemKey` for idempotent retries. No batching/debounce (that literature is about many concurrent writers; it does not apply).

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

### 4.3 Phase-3 moderation tables
`moderation_reports` (reason enum, signed-out reporter via session token, status), `blocks` (blocker/blocked, enforced both directions in feed query), `hidden_matches` (userId/matchId), `moderation_audit` (append-only). Plus `users.acceptedTermsAt`.

### 4.4 Function surface
**Operator (authed, `authedMutation`):** `live.create`, `live.scorePoint` (append event + patch snapshot, idempotent), `live.undo`/`live.correct`, `live.setVisibility`, `live.pause`, `live.finalize` (→ archive into `matches`).
**Public (plain `query`, no auth, token-gated):** `live.getByToken` (single doc; **return validator strips `ownerId`/`_id`/`token`**), `live.listEvents` (`usePaginatedQuery`, ordered by `seq`), `live.eventsSince(seq)`.
**Public feed (Phase 3, plain `query`):** `live.listPublicFeed` — server-side filter `visibility==='public' AND moderationStatus==='clean' AND publicExpiresAt > now` (+ block/hide for signed-in viewers). **Never** returns secrets; never an enumerable list of private matches.
**Security invariants:** token is an unguessable `v.string()` (not `_id`); every public function has args **and** return validators; no public enumerate query; rate limiter on the write path (Phase 3).

---

## 5. Client architecture

- **`useLiveBroadcast(localMatch)`** — scorer-side hook. Mirrors each local scoring action to `live.scorePoint`; owns the `se_outbox`, optimistic updates, and reconnect replay. Imported by all 4 live-score screens *without altering their localStorage-authoritative loop*.
- **Scorer UI:** a "Go Live" affordance + **`ShareLiveMatch`** bottom sheet (QR via `qrcode.react`, 6-char code, Capacitor Share / `navigator.share`). Read-only expectation copy: *"Anyone with this can watch. They can't change the score."*
- **Spectator route `/live/:token`** (public, unauthenticated, outside the scoring-exit guard): pinned scorebug + serve indicator + completed-sets ledger + live-pulse flash + 90s stale→`PAUSED` badge + `?kiosk=1` chromeless cast mode. Tabs: **Feed / Scorecard / Stats** (default Feed).
- **Scorecard component library** (shared by scorer, spectator, and history replay): generic suite + per-sport families (§6).
- **Discovery `/live` tab** (Phase 3): ledger rows, sport-chip filter, live-pulse, empty/cold-start state. New bottom-nav entry.

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

## 7. Security, privacy & moderation (release-blocking for the public feed)

The global public feed turns every team/player name, title, and note into **publishable UGC reaching strangers** — a materially higher risk tier than link sharing. Per research §3, the following are **App-Store-release-blocking** (Apple Guideline 1.2) and **must ship with the public feed**, not after:

- **Default-private, per-match opt-in** (3-state Private / Link-only / Public). A shared link is `unlisted`; only an explicit choice makes a match appear in the browse feed.
- **Server-side profanity/slur filter** in the Convex publish mutation (NFKC-normalize, strip zero-width, evasion-resistant) — *never* client-only (the mutation is directly callable).
- **Report / Block / Hide — three distinct flows**, block enforced both directions in the feed query, **report available to signed-out viewers**, → operator queue + append-only audit.
- **Youth safeguard** (COPPA): a youth flag forces visibility ≤ `unlisted` and **redacts player names to initials + jersey number** in any public view; server-enforced.
- **Rate-limit** publish/report/public-text-edits; **AUP acceptance** + reachable contact route; **auto-expire** public visibility (~match end + grace) to keep the feed live-only and bound standing exposure.

**OWASP / threat notes:** A01 (broken access control) — single-writer enforced server-side, spectators read-only, ownerId never leaves the server; A03 (injection / stored XSS) — all UGC strings are user-rendered text, sanitize + escape, no `dangerouslySetInnerHTML`; enumeration — unguessable token + return validators + no public list of private matches; abuse/DoS — rate limiter on write path; privacy — default-private, youth redaction, auto-expire.

### 7.1 Phase-1 moderation *floor* vs Phase-3 full stack
A subtlety: the moment a **signed-out stranger** loads `/live/:token` and sees user-entered team/player names, there is already a (small) public UGC surface — even with no browse feed. So the split is not "moderation = Phase 3, nothing before":

- **Phase 1 floor (ships with the spectator link):** server-side profanity/slur filter on **public-facing strings** (team/player names, match title) in the create/publish path + a **report affordance on the spectator page** (works signed-out). This is the minimum responsible exposure for a stranger-loadable page and avoids carrying "link sharing needs zero moderation" into the build.
- **Phase 3 full stack (ships with the browse feed):** Block/Hide, operator review queue + audit, youth redaction, AUP gate, auto-expire, rate limiting, visibility controls — the browsable directory is the materially higher risk tier that triggers the full Apple 1.2 obligations.

> **Sequencing consequence:** the headline "share my match to anyone via link" value ships in Phase 1 behind the moderation *floor*; the global browse feed + full moderation stack ship together in Phase 3. See §8.

---

## 8. Phasing & PR sequence

All three phases are **in scope** (honoring the locked decisions). Sequencing is by dependency and by grouping the release-blocking moderation work with the feed it gates.

**Phase 1 — Core live-share + scorecard foundation (link/code/QR sharing, no browse feed)**
Schema (`liveMatches` + `matchEvents`) → operator mutations (transactional, idempotent) → public token-gated queries (args+return validators) → offline `se_outbox` + reconcile → `useLiveBroadcast` wired into **all 4** scoring screens → ShareLiveMatch sheet → `/live/:token` spectator (no-signin, serve indicator, stale badge, kiosk) → **generic scorecard suite** + **volleyball** scorecard → **moderation floor** (server-side profanity filter on public-facing strings + signed-out report affordance, §7.1) → per-match **visibility selector** ("People I choose" = private link, fully working now; "Everyone" present as opt-in but only becomes *discoverable* once the Phase-3 feed + moderation land).
> **Phase-1 exit gates (must pass before promising the feature):** (a) a **viewer-scale load test** validating Convex reactive fan-out cost for hundreds of signed-out spectators on a hot rally-every-few-seconds match — this is existential to "share to any number of people," not a footnote; (b) the offline invariant (no data loss across app-kill mid-match); (c) idempotent reconcile (no double-count on outbox replay).

**Phase 2 — Scorecard maturity across all sports**
Other net sports (config variants) → tennis → cricket → goals/period → live commentary feed + spectator Feed/Scorecard/Stats tabs + live-pulse → history replay of persisted `matchEvents`.

**Phase 3 — Global public discovery feed + moderation (release-blocking gates grouped here)**
Moderation schema + server-side filter → Report/Block/Hide + queue + audit → youth safeguard → AUP + contact + auto-expire + rate limiting → per-match visibility controls → **"Watch Live"** discovery tab (sport filter, live-pulse rows, empty/cold-start). Phase-3+ extras: presence/viewer-count, multi-scorer, sparklines, player box scores.

---

## 9. Open questions / decisions needed (from research §8)
1. **Convex reactive fan-out cost at viewer-scale** — unvalidated for hundreds of signed-out spectators on one hot match. Needs a **load test** before promising "unlimited free spectators." → promoted to a **Phase-1 exit gate** (§8), not a deferrable footnote.
2. **Capacitor deep-link config** for `/live/:token` (iOS associated domains / Android App Links; app-not-installed → web, not App Store). (Spike)
3. **Multi-scorer serialization** (co-scorers break single-writer; `lastSeq` compare-and-set vs active-writer lease). Deferred — design spike only.
4. **Discovery cold-start threshold** — how many concurrent public matches unlock the "Watch Live" tab (+ "be the first" fallback).
5. **Volleyball `competitionLevel` flag** — technical timeouts fire only in FIVB World/Olympic, sets 1-4; default off?
6. **Two-sided football timeline on ~380px mobile** — collapse to single minute-ordered column? (Design call.)
7. **Moderation operator staffing** — Apple ~24h / DSA "without undue delay" are real commitments for a small team; profanity-filter sensitivity + allowlist tuning baseline.
8. **History read-bridge for past public matches.** History today reads **localStorage only**; Convex `matches` is written but never read back. In-match replay covers the *live* match for free, but browsing a *past* public match's scorecard from the discovery feed needs a new Convex read path (and an archived-scorecard read query). Not free — scoped into Phase 3 with the feed.

---

## 10. Testing strategy (TDD-first per forge)
- **Pure scoring/derivation logic** (set-close, win-by-2/cap, tennis point ladder, cricket card projections, generic stat header, segmentation) — unit tests *first*; these are deterministic and the highest-value coverage.
- **Idempotency** — `scorePoint` with a repeated `idemKey` must not double-count; outbox replay after simulated reconnect reconciles exactly.
- **Offline invariant** — local scoring fully functional with Convex unreachable; no data loss across app-kill mid-match.
- **Security** — public query return validators strip `ownerId`/`token`; token enumeration impossible; profanity filter runs server-side (bypass attempt via direct mutation call is blocked).
- **Integrity invariants** — cricket `sum(batter runs)+extras === innings.runs`; serve boolean stored not derived; event log + snapshot stay consistent after undo.

---

## 11. Beads epic
Tracked under the epic **"Live match streaming + mature scorecards"** with child issues mapped to §8 phases (created alongside this doc; see `bd show` for the epic). Dependencies: schema → mutations/queries → broadcast wiring → spectator; shared event model → generic scorecard → per-sport; moderation stack → public feed.
