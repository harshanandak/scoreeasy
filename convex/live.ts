import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/functions";

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
    // Idempotent create: reuse an existing live match for this owner+clientMatchId.
    const existing = await ctx.db
      .query("liveMatches")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.user._id))
      .filter((q) => q.eq(q.field("clientMatchId"), args.clientMatchId))
      .first();
    if (existing) {
      return { token: existing.token, matchId: existing._id };
    }

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
      moderationStatus: "clean",
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

    const delta = args.value ?? 1;
    const runningA = match.pointsA + (args.team === "A" ? delta : 0);
    const runningB = match.pointsB + (args.team === "B" ? delta : 0);
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
      setsA: match.setsA,
      setsB: match.setsB,
      servingAfter: match.servingTeam,
      at: args.at,
    });

    await ctx.db.patch(args.matchId, {
      pointsA: runningA,
      pointsB: runningB,
      lastSeq: seq,
      lastEventAt: args.at,
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

    // Find the last active point that has not already been undone.
    const events = await ctx.db
      .query("matchEvents")
      .withIndex("by_match_seq", (q) => q.eq("matchId", args.matchId))
      .order("desc")
      .collect();

    const undoneSeqs = new Set<number>();
    for (const e of events) {
      if (e.type === "undo" && typeof e.meta?.reversesSeq === "number") {
        undoneSeqs.add(e.meta.reversesSeq);
      }
    }
    const target = events.find(
      (e) => e.type === "point" && !undoneSeqs.has(e.seq),
    );

    const delta = target ? target.value : 0;
    const reverseTeam = target?.team;
    const runningA =
      match.pointsA - (reverseTeam === "A" ? delta : 0);
    const runningB =
      match.pointsB - (reverseTeam === "B" ? delta : 0);
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
      setsA: match.setsA,
      setsB: match.setsB,
      servingAfter: match.servingTeam,
      meta: target ? { reversesSeq: target.seq } : undefined,
      at: args.at,
    });

    await ctx.db.patch(args.matchId, {
      pointsA: runningA,
      pointsB: runningB,
      lastSeq: seq,
      lastEventAt: args.at,
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

    const winner =
      match.setsA > match.setsB || match.pointsA > match.pointsB
        ? team1
        : match.setsB > match.setsA || match.pointsB > match.pointsA
          ? team2
          : undefined;

    const archivedId = await ctx.db.insert("matches", {
      sport: match.sport,
      team1,
      team2,
      score1: match.pointsA,
      score2: match.pointsB,
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

export const getByToken = query({
  args: { token: v.string() },
  returns: v.union(v.null(), publicSnapshotValidator),
  handler: async (ctx, { token }) => {
    const match = await ctx.db
      .query("liveMatches")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
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

export const getMeta = query({
  args: { matchId: v.id("liveMatches") },
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get(matchId);
    if (!match) return null;

    const meta = await ctx.db
      .query("liveMatchMeta")
      .withIndex("by_match", (q) => q.eq("matchId", matchId))
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

export const listEvents = query({
  args: { matchId: v.id("liveMatches"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { matchId, paginationOpts }) => {
    return await ctx.db
      .query("matchEvents")
      .withIndex("by_match_seq", (q) => q.eq("matchId", matchId))
      .order("asc")
      .paginate(paginationOpts);
  },
});

export const eventsSince = query({
  args: { matchId: v.id("liveMatches"), sinceSeq: v.number() },
  handler: async (ctx, { matchId, sinceSeq }) => {
    return await ctx.db
      .query("matchEvents")
      .withIndex("by_match_seq", (q) =>
        q.eq("matchId", matchId).gt("seq", sinceSeq),
      )
      .order("asc")
      .collect();
  },
});
