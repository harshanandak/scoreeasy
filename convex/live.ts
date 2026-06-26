import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/functions";
import { containsProfanity } from "./lib/profanity";

// Coarse 30s time bucket for feed ranking — patched only when the bucket
// rolls over so the feed does not reorder on every rally (§12.2 feedRank).
const FEED_BUCKET_MS = 30000;
function feedBucket(now: number) {
  return Math.floor(now / FEED_BUCKET_MS);
}

// Public visibility lifetime after finalize (grace before auto-expire, §7.1).
const PUBLIC_EXPIRY_GRACE_MS = 1000 * 60 * 60 * 24;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Unguessable, non-enumerable share handle (§4.4). Uses Web Crypto
// (crypto.getRandomValues) which exists in the Convex/edge runtime —
// NOT Node's crypto.randomBytes and NOT Math.random.
function generateToken(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += BASE32_ALPHABET[bytes[i] & 31];
  }
  return out;
}

function redactPlayerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map((p) => p[0].toUpperCase()).join(".") + ".";
}

// Operator-pushed engine-derived snapshot (§87d). For non-flat sports the
// CLIENT engine is authoritative (localStorage is the source of truth, §3.1):
// it computes the current-set points, set tally, completed set scores, serving
// team and period, and hands them to scorePoint/undo to patch onto the match
// doc. All fields here are ALREADY in the public snapshot whitelist
// (publicSnapshotValidator) — this is a write-side input only, no new exposure.
// `pointsA/pointsB` are the CURRENT-set (not cumulative) score.
const snapshotArgValidator = v.object({
  pointsA: v.number(),
  pointsB: v.number(),
  setsA: v.number(),
  setsB: v.number(),
  setScores: v.array(v.object({ a: v.number(), b: v.number() })),
  servingTeam: v.optional(v.union(v.literal("A"), v.literal("B"))),
  currentUnit: v.number(),
  periodLabel: v.optional(v.string()),
});

// The match-doc fields a snapshot patches (kept in one place so scorePoint and
// undo stay in lockstep). servingTeam/periodLabel may be undefined → Convex
// patch clears them, which is correct for sports without serving/periods.
function snapshotPatch(snap: {
  setsA: number;
  setsB: number;
  setScores: { a: number; b: number }[];
  servingTeam?: "A" | "B";
  currentUnit: number;
  periodLabel?: string;
}) {
  return {
    setsA: snap.setsA,
    setsB: snap.setsB,
    setScores: snap.setScores,
    servingTeam: snap.servingTeam,
    currentUnit: snap.currentUnit,
    periodLabel: snap.periodLabel,
  };
}

// Moderation floor knobs (§7.1). Lightweight, index-counted — no rate-limiter
// component for v1.
const CREATE_CAP = 20; // max new live matches per owner per window
const CREATE_WINDOW_MS = 60 * 60 * 1000; // 1h
const REPORT_FLAG_THRESHOLD = 3; // distinct reporters that flag a match for review

// ---------------------------------------------------------------------------
// MUTATIONS — operator only (authedMutation; owner enforced per handler)
// ---------------------------------------------------------------------------

export const create = authedMutation({
  args: {
    sport: v.string(),
    scorecardKind: v.string(),
    teamA: v.object({ name: v.string(), color: v.optional(v.string()) }),
    teamB: v.object({ name: v.string(), color: v.optional(v.string()) }),
    visibility: v.optional(
      v.union(v.literal("public"), v.literal("unlisted"), v.literal("private")),
    ),
    isYouthMatch: v.optional(v.boolean()),
    clientMatchId: v.string(),
  },
  handler: async (ctx, args) => {
    // Idempotent create: reuse an existing live match for this owner+clientMatchId
    // (compound index, no table scan).
    const existing = await ctx.db
      .query("liveMatches")
      .withIndex("by_owner_client", (q) =>
        q.eq("ownerId", ctx.user._id).eq("clientMatchId", args.clientMatchId),
      )
      .unique();
    if (existing) {
      return { token: existing.token, matchId: existing._id };
    }

    // Rate cap: bound NEW live matches per owner per window (abuse/DoS, §7.1).
    const recent = await ctx.db
      .query("liveMatches")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
      .order("desc")
      .take(CREATE_CAP + 1);
    if (
      recent.length > CREATE_CAP &&
      recent[CREATE_CAP]._creationTime > Date.now() - CREATE_WINDOW_MS
    ) {
      throw new Error("Rate limit exceeded — too many live matches created");
    }

    // Server-side profanity floor on the PUBLIC team names (§7.1; never
    // client-only). A hit HOLDS the match: the row persists so the operator keeps
    // scoring locally (and the idempotent outbox does not loop on a throw), while
    // resolveReadableMatch hides held matches from every public reader.
    const flagged =
      containsProfanity(args.teamA.name) || containsProfanity(args.teamB.name);

    const now = Date.now();
    const token = generateToken();

    const matchId = await ctx.db.insert("liveMatches", {
      token,
      ownerId: ctx.user._id,
      clientMatchId: args.clientMatchId,
      sport: args.sport,
      scorecardKind: args.scorecardKind,
      status: "live",
      visibility: args.visibility ?? "public",
      isYouthMatch: args.isYouthMatch ?? false,
      moderationStatus: flagged ? "held" : "clean",
      pointsA: 0,
      pointsB: 0,
      setsA: 0,
      setsB: 0,
      setScores: [],
      currentUnit: 1,
      lastSeq: 0,
      feedRank: feedBucket(now),
      startedAt: now,
      lastEventAt: now,
    });

    await ctx.db.insert("liveMatchMeta", {
      matchId,
      teamA: args.teamA,
      teamB: args.teamB,
      sport: args.sport,
    });

    return { token, matchId };
  },
});

async function loadOwnedMatch(
  ctx: { db: any; user: { _id: Id<"users"> } },
  matchId: Id<"liveMatches">,
) {
  const match = await ctx.db.get(matchId);
  if (!match) throw new Error("Live match not found");
  if (match.ownerId !== ctx.user._id) {
    throw new Error("Not authorized");
  }
  return match;
}

export const scorePoint = authedMutation({
  args: {
    matchId: v.id("liveMatches"),
    clientEventId: v.string(),
    team: v.union(v.literal("A"), v.literal("B")),
    value: v.optional(v.number()),
    at: v.number(),
    playerId: v.optional(v.string()),
    snapshot: v.optional(snapshotArgValidator),
  },
  handler: async (ctx, args) => {
    const match = await loadOwnedMatch(ctx, args.matchId);

    // IDEMPOTENT: a repeated clientEventId returns the prior event, no double-count.
    const prior = await ctx.db
      .query("matchEvents")
      .withIndex("by_match_client", (q) =>
        q.eq("matchId", args.matchId).eq("clientEventId", args.clientEventId),
      )
      .unique();
    if (prior) return prior;

    // Reject NEW writes to a finalized match (placed AFTER the idempotency check
    // so a replayed clientEventId still returns its prior row, §87d hardening).
    if (match.status === "final") throw new Error("Match is final");

    const snap = args.snapshot;
    const delta = args.value ?? 1;
    // With a snapshot the client engine is authoritative: running totals ARE the
    // current-set points, and sets/serving come from the snapshot. Without one
    // (flat sports like goals) we keep cumulative running totals.
    const runningA = snap ? snap.pointsA : match.pointsA + (args.team === "A" ? delta : 0);
    const runningB = snap ? snap.pointsB : match.pointsB + (args.team === "B" ? delta : 0);
    const seq = match.lastSeq + 1;
    const bucket = feedBucket(args.at);

    const eventId = await ctx.db.insert("matchEvents", {
      matchId: args.matchId,
      seq,
      clientEventId: args.clientEventId,
      type: "point",
      team: args.team,
      value: delta,
      playerId: args.playerId,
      runningA,
      runningB,
      setsA: snap ? snap.setsA : match.setsA,
      setsB: snap ? snap.setsB : match.setsB,
      servingAfter: snap ? snap.servingTeam : match.servingTeam,
      at: args.at,
    });

    await ctx.db.patch(args.matchId, {
      pointsA: runningA,
      pointsB: runningB,
      lastSeq: seq,
      lastEventAt: args.at,
      ...(snap ? snapshotPatch(snap) : {}),
      ...(bucket !== match.feedRank ? { feedRank: bucket } : {}),
    });

    return await ctx.db.get(eventId);
  },
});

export const undo = authedMutation({
  args: {
    matchId: v.id("liveMatches"),
    clientEventId: v.string(),
    at: v.number(),
    snapshot: v.optional(snapshotArgValidator),
  },
  handler: async (ctx, args) => {
    const match = await loadOwnedMatch(ctx, args.matchId);

    // Idempotent on clientEventId.
    const prior = await ctx.db
      .query("matchEvents")
      .withIndex("by_match_client", (q) =>
        q.eq("matchId", args.matchId).eq("clientEventId", args.clientEventId),
      )
      .unique();
    if (prior) return prior;

    // Reject undo on a finalized match (after idempotency, §87d hardening).
    if (match.status === "final") throw new Error("Match is final");

    // Find the last active point that has not already been undone WITHOUT
    // collecting the whole log. Walk the seq index DESCENDING: undo events
    // always have a higher seq than the point they reverse, so by the time we
    // reach a candidate point we have already seen every undo that could
    // reverse it. Break on the first still-active point.
    const undoneSeqs = new Set<number>();
    let target: Doc<"matchEvents"> | null = null;
    for await (const e of ctx.db
      .query("matchEvents")
      .withIndex("by_match_seq", (q) => q.eq("matchId", args.matchId))
      .order("desc")) {
      if (e.type === "undo" && typeof e.meta?.reversesSeq === "number") {
        undoneSeqs.add(e.meta.reversesSeq);
      } else if (e.type === "point" && !undoneSeqs.has(e.seq)) {
        target = e;
        break;
      }
    }

    const snap = args.snapshot;
    const delta = target ? target.value : 0;
    const reverseTeam = target?.team;
    // The scan still determines the reversed point (team/value/seq) for the feed
    // and audit trail, but when a snapshot is present the client engine is
    // authoritative for the resulting score/sets — undo can cross a set boundary,
    // which the cumulative subtraction below cannot express.
    const runningA = snap
      ? snap.pointsA
      : match.pointsA - (reverseTeam === "A" ? delta : 0);
    const runningB = snap
      ? snap.pointsB
      : match.pointsB - (reverseTeam === "B" ? delta : 0);
    const seq = match.lastSeq + 1;
    const bucket = feedBucket(args.at);

    const eventId = await ctx.db.insert("matchEvents", {
      matchId: args.matchId,
      seq,
      clientEventId: args.clientEventId,
      type: "undo",
      team: reverseTeam,
      value: -delta,
      runningA,
      runningB,
      setsA: snap ? snap.setsA : match.setsA,
      setsB: snap ? snap.setsB : match.setsB,
      servingAfter: snap ? snap.servingTeam : match.servingTeam,
      meta: target ? { reversesSeq: target.seq } : undefined,
      at: args.at,
    });

    await ctx.db.patch(args.matchId, {
      pointsA: runningA,
      pointsB: runningB,
      lastSeq: seq,
      lastEventAt: args.at,
      ...(snap ? snapshotPatch(snap) : {}),
      ...(bucket !== match.feedRank ? { feedRank: bucket } : {}),
    });

    return await ctx.db.get(eventId);
  },
});

export const setVisibility = authedMutation({
  args: {
    matchId: v.id("liveMatches"),
    visibility: v.union(
      v.literal("public"),
      v.literal("unlisted"),
      v.literal("private"),
    ),
  },
  handler: async (ctx, args) => {
    await loadOwnedMatch(ctx, args.matchId);
    await ctx.db.patch(args.matchId, { visibility: args.visibility });
    return { ok: true };
  },
});

export const pause = authedMutation({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, args) => {
    await loadOwnedMatch(ctx, args.matchId);
    await ctx.db.patch(args.matchId, { status: "paused" });
    return { ok: true };
  },
});

export const finalize = authedMutation({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, args) => {
    const match = await loadOwnedMatch(ctx, args.matchId);
    const now = Date.now();

    await ctx.db.patch(args.matchId, {
      status: "final",
      publicExpiresAt: now + PUBLIC_EXPIRY_GRACE_MS,
    });

    const meta = await ctx.db
      .query("liveMatchMeta")
      .withIndex("by_match", (q) => q.eq("matchId", args.matchId))
      .unique();

    const team1 = meta?.teamA.name ?? "Team A";
    const team2 = meta?.teamB.name ?? "Team B";

    // Archive into `matches`, reusing clientMatchId dedup (§3.5).
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_operator_client_match", (q) =>
        q
          .eq("operatedBy", ctx.user._id)
          .eq("clientMatchId", match.clientMatchId),
      )
      .unique();

    if (existing) {
      return { matchId: existing._id, archived: false };
    }

    // Cricket finalize does NOT archive into `matches` (scoreeasy-6tf). A cricket
    // result (Test draw, innings victory, D/L) cannot be derived from the live
    // snapshot's cumulative runs, so the sets/points winner below would be wrong.
    // The local cricket scorer writes the authoritative `matches` row under the
    // same clientMatchId; defer to it rather than racing it with a wrong winner.
    if (match.scorecardKind === "cricket") {
      return { matchId: null, archived: false };
    }

    // Sets are PRIMARY; current points break ties only when sets are equal.
    const winner =
      match.setsA !== match.setsB
        ? match.setsA > match.setsB
          ? team1
          : team2
        : match.pointsA !== match.pointsB
          ? match.pointsA > match.pointsB
            ? team1
            : team2
          : undefined;

    // A set-based match archives its SET tally as the headline score (so History
    // reads "3–1 sets", consistent with the sets-primary winner); flat sports
    // (goals) archive their point total. `pointsA/pointsB` is the last-set score
    // once snapshots are in play, so it is NOT the right headline for set sports.
    const isSetSport = match.setsA > 0 || match.setsB > 0;
    const score1 = isSetSport ? match.setsA : match.pointsA;
    const score2 = isSetSport ? match.setsB : match.pointsB;

    const archivedId = await ctx.db.insert("matches", {
      sport: match.sport,
      team1,
      team2,
      score1,
      score2,
      winner,
      operatedBy: ctx.user._id,
      date: now,
      clientMatchId: match.clientMatchId,
      token: match.token,
      eventCount: match.lastSeq,
    });

    return { matchId: archivedId, archived: true };
  },
});

// PUBLIC, no-auth report of objectionable content (§7.1 / Apple 1.2). A spectator
// (signed-out) flags a match by its share token. `reporterId` is an untrusted
// client session id used ONLY for per-reporter dedup. Returns a UNIFORM
// { ok: true } for missing / private / removed tokens so it never leaks whether a
// token exists. At REPORT_FLAG_THRESHOLD distinct reporters the match is FLAGGED
// for human review (flaggedAt) but stays publicly visible — reports must NOT
// auto-takedown content (reporterId is forgeable; auto-hide would be a one-call
// censorship/DoS vector). Removal is a human decision via the cxr review queue
// (fast-follow). The create-time profanity filter is the only automated hide,
// and only on the operator's OWN typed names.
export const report = mutation({
  args: {
    token: v.string(),
    reason: v.union(
      v.literal("abuse"),
      v.literal("hate"),
      v.literal("sexual"),
      v.literal("spam"),
      v.literal("other"),
    ),
    reporterId: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token, reason, reporterId }) => {
    const match = await ctx.db
      .query("liveMatches")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    // Uniform response: no enumeration leak for unknown/private/removed tokens.
    if (!match || match.visibility === "private" || match.moderationStatus === "removed") {
      return { ok: true };
    }

    // Dedup per (match, reporter) — a reporter can only count once.
    const dup = await ctx.db
      .query("moderationReports")
      .withIndex("by_match_reporter", (q) =>
        q.eq("matchId", match._id).eq("reporterId", reporterId),
      )
      .first();
    if (dup) return { ok: true };

    await ctx.db.insert("moderationReports", {
      matchId: match._id,
      reason,
      reporterId,
      status: "open",
      createdAt: Date.now(),
    });

    // FLAG for review at the distinct-reporter threshold — does NOT hide the match
    // (see the header: auto-hide on reports would be a censorship vector). Set
    // flaggedAt once for the human review queue; the match stays public. Dedup-at-
    // write means each row is a distinct reporter, so the bounded .take(N) count
    // is the distinct-reporter count.
    if (match.flaggedAt == null) {
      const rows = await ctx.db
        .query("moderationReports")
        .withIndex("by_match", (q) => q.eq("matchId", match._id))
        .take(REPORT_FLAG_THRESHOLD);
      if (rows.length >= REPORT_FLAG_THRESHOLD) {
        await ctx.db.patch(match._id, { flaggedAt: Date.now() });
      }
    }

    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// PUBLIC QUERIES — no auth, token-gated, strict return-validator whitelist
// ---------------------------------------------------------------------------

// §7.2 data-minimization whitelist: ONLY these fields are ever exposed.
// ownerId / _id / token / clientMatchId / moderationStatus / feedRank etc.
// are stripped by construction (this validator rejects extra fields).
const publicSnapshotValidator = v.object({
  sport: v.string(),
  status: v.union(v.literal("live"), v.literal("paused"), v.literal("final")),
  scorecardKind: v.string(),
  pointsA: v.number(),
  pointsB: v.number(),
  setsA: v.number(),
  setsB: v.number(),
  setScores: v.array(v.object({ a: v.number(), b: v.number() })),
  servingTeam: v.optional(v.union(v.literal("A"), v.literal("B"))),
  currentUnit: v.number(),
  periodLabel: v.optional(v.string()),
  lastSeq: v.number(),
  startedAt: v.number(),
  lastEventAt: v.number(),
  isYouthMatch: v.boolean(),
});

// Shared token gate (§4.4 / §7.1). Token possession authorizes reads of
// `public` OR `unlisted` matches (link sharing must work for unlisted), but
// NEVER `private` matches or `removed` (moderated-out) content. Returns the
// match doc only when it is readable; otherwise null.
async function resolveReadableMatch(ctx: QueryCtx, token: string) {
  const match = await ctx.db
    .query("liveMatches")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!match) return null;
  if (match.visibility === "private") return null;
  // Only `clean` content is publicly readable — `held` (profanity/auto-report)
  // and `removed` (moderated-out) are hidden from every public reader (§7.1).
  if (match.moderationStatus !== "clean") return null;
  // Auto-expire: bound standing public exposure after the match ends + grace.
  // (Date.now() in a query is non-reactive — the view drops on the next re-run,
  // not exactly at the deadline; a scheduled status flip is the fast-follow.)
  if (match.publicExpiresAt != null && Date.now() > match.publicExpiresAt) {
    return null;
  }
  return match;
}

export const getByToken = query({
  args: { token: v.string() },
  returns: v.union(v.null(), publicSnapshotValidator),
  handler: async (ctx, { token }) => {
    const match = await resolveReadableMatch(ctx, token);
    if (!match) return null;

    // Explicit projection — never spread the raw doc.
    return {
      sport: match.sport,
      status: match.status,
      scorecardKind: match.scorecardKind,
      pointsA: match.pointsA,
      pointsB: match.pointsB,
      setsA: match.setsA,
      setsB: match.setsB,
      setScores: match.setScores,
      servingTeam: match.servingTeam,
      currentUnit: match.currentUnit,
      periodLabel: match.periodLabel,
      lastSeq: match.lastSeq,
      startedAt: match.startedAt,
      lastEventAt: match.lastEventAt,
      isYouthMatch: match.isYouthMatch,
    };
  },
});

// §7.2 meta whitelist: roster + team labels only. ownerId / token / clientMatchId
// never appear because we project explicitly from `meta`, not the raw doc.
const teamMetaValidator = v.object({
  name: v.string(),
  color: v.optional(v.string()),
});
const playerMetaValidator = v.object({
  team: v.union(v.literal("A"), v.literal("B")),
  name: v.string(),
  jersey: v.optional(v.string()),
});
const metaValidator = v.object({
  sport: v.string(),
  teamA: teamMetaValidator,
  teamB: teamMetaValidator,
  players: v.array(playerMetaValidator),
  isYouthMatch: v.boolean(),
});

export const getMeta = query({
  args: { token: v.string() },
  returns: v.union(v.null(), metaValidator),
  handler: async (ctx, { token }) => {
    const match = await resolveReadableMatch(ctx, token);
    if (!match) return null;

    const meta = await ctx.db
      .query("liveMatchMeta")
      .withIndex("by_match", (q) => q.eq("matchId", match._id))
      .unique();
    if (!meta) return null;

    // Youth matches redact player names to initials (+ jersey), §7.1 COPPA floor.
    const players = match.isYouthMatch
      ? meta.players?.map((p) => ({
          team: p.team,
          name: redactPlayerName(p.name),
          jersey: p.jersey,
        }))
      : meta.players;

    return {
      sport: meta.sport,
      teamA: meta.teamA,
      teamB: meta.teamB,
      players: players ?? [],
      isYouthMatch: match.isYouthMatch,
    };
  },
});

// §7.2 event-stream whitelist. The raw `matchEvents` doc carries operator-only
// fields — clientEventId, meta, playerId — that MUST NEVER reach a viewer. We
// project explicitly into this validator; commentary is included ONLY for
// non-youth matches (added per-event below). Optional fields mirror the schema:
// team / servingAfter / commentary are frequently absent at runtime, so they
// are v.optional or the validator rejects real events.
const publicEventValidator = v.object({
  seq: v.number(),
  type: v.union(
    v.literal("point"),
    v.literal("set_end"),
    v.literal("serve_change"),
    v.literal("timeout"),
    v.literal("undo"),
    v.literal("correction"),
    v.literal("note"),
  ),
  team: v.optional(v.union(v.literal("A"), v.literal("B"))),
  value: v.number(),
  runningA: v.number(),
  runningB: v.number(),
  setsA: v.number(),
  setsB: v.number(),
  servingAfter: v.optional(v.union(v.literal("A"), v.literal("B"))),
  at: v.number(),
  commentary: v.optional(v.string()),
});

function projectEvent(e: Doc<"matchEvents">, isYouthMatch: boolean) {
  const out: {
    seq: number;
    type: Doc<"matchEvents">["type"];
    team?: "A" | "B";
    value: number;
    runningA: number;
    runningB: number;
    setsA: number;
    setsB: number;
    servingAfter?: "A" | "B";
    at: number;
    commentary?: string;
  } = {
    seq: e.seq,
    type: e.type,
    team: e.team,
    value: e.value,
    runningA: e.runningA,
    runningB: e.runningB,
    setsA: e.setsA,
    setsB: e.setsB,
    servingAfter: e.servingAfter,
    at: e.at,
  };
  // Commentary is free-text; suppress it entirely for youth matches.
  if (!isYouthMatch && e.commentary !== undefined) {
    out.commentary = e.commentary;
  }
  return out;
}

export const listEvents = query({
  args: {
    token: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(publicEventValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, { token, paginationOpts }) => {
    const match = await resolveReadableMatch(ctx, token);
    if (!match) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    // DESC by seq: the first page is the NEWEST events, so a spectator opening a
    // live match lands on the live tail (not the start of the match), and
    // `loadMore` pages backward into history. The feed is the only consumer; the
    // analytical panels read the always-current snapshot, not this log.
    const result = await ctx.db
      .query("matchEvents")
      .withIndex("by_match_seq", (q) => q.eq("matchId", match._id))
      .order("desc")
      .paginate(paginationOpts);

    // Reconstruct the page object explicitly so the return validator surface is
    // exactly three keys (no splitCursor / pageStatus leak-through).
    return {
      page: result.page.map((e) => projectEvent(e, match.isYouthMatch)),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const eventsSince = query({
  args: { token: v.string(), sinceSeq: v.number() },
  returns: v.array(publicEventValidator),
  handler: async (ctx, { token, sinceSeq }) => {
    const match = await resolveReadableMatch(ctx, token);
    if (!match) return [];

    // BOUNDED tail read: .take(200) caps a single call so eventsSince(0) cannot
    // pull the entire log. The client advances sinceSeq to page the tail.
    const events = await ctx.db
      .query("matchEvents")
      .withIndex("by_match_seq", (q) =>
        q.eq("matchId", match._id).gt("seq", sinceSeq),
      )
      .order("asc")
      .take(200);

    return events.map((e) => projectEvent(e, match.isYouthMatch));
  },
});
