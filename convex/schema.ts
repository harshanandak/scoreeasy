import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    favoriteGames: v.optional(v.array(v.string())),
    playStyle: v.optional(v.array(v.string())),
    onboardedAt: v.optional(v.number()),
    color: v.optional(v.string()),
    migratedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_username", ["username"])
    .searchIndex("search_username", { searchField: "username" }),

  matches: defineTable({
    sport: v.string(),
    team1: v.string(),
    team2: v.string(),
    score1: v.number(),
    score2: v.number(),
    detail: v.optional(v.any()),
    winner: v.optional(v.string()),
    format: v.optional(v.any()),
    operatedBy: v.id("users"),
    date: v.number(),
    duration: v.optional(v.number()),
    team1Id: v.optional(v.id("teams")),
    team2Id: v.optional(v.id("teams")),
    matchRole: v.optional(v.string()),
    clientMatchId: v.optional(v.string()),
    token: v.optional(v.string()),
    eventBlobId: v.optional(v.id("_storage")),
    eventCount: v.optional(v.number()),
    finalizedReason: v.optional(v.string()),
  })
    .index("by_operator", ["operatedBy"])
    .index("by_operator_client_match", ["operatedBy", "clientMatchId"])
    .index("by_date", ["date"])
    .index("by_token", ["token"]),

  matchPlayers: defineTable({
    matchId: v.id("matches"),
    userId: v.id("users"),
    team: v.string(),
    sport: v.string(),
    role: v.union(v.literal("player"), v.literal("operator")),
  })
    .index("by_user", ["userId"])
    .index("by_match", ["matchId"]),

  teams: defineTable({
    name: v.string(),
    nameLower: v.string(),
    sport: v.string(),
    createdBy: v.id("users"),
    matchCount: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_sport", ["sport"])
    .index("by_creator", ["createdBy"])
    .index("by_sport_name_lower", ["sport", "nameLower"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["sport"],
    }),

  liveMatches: defineTable({
    token: v.string(),
    ownerId: v.id("users"),
    clientMatchId: v.string(),
    sport: v.string(),
    scorecardKind: v.string(),
    status: v.union(v.literal("live"), v.literal("paused"), v.literal("final")),
    visibility: v.union(
      v.literal("public"),
      v.literal("unlisted"),
      v.literal("private"),
    ),
    isYouthMatch: v.boolean(),
    moderationStatus: v.union(
      v.literal("clean"),
      v.literal("held"),
      v.literal("removed"),
    ),
    pointsA: v.number(),
    pointsB: v.number(),
    setsA: v.number(),
    setsB: v.number(),
    setScores: v.array(v.object({ a: v.number(), b: v.number() })),
    servingTeam: v.optional(v.union(v.literal("A"), v.literal("B"))),
    currentUnit: v.number(),
    periodLabel: v.optional(v.string()),
    lastSeq: v.number(),
    feedRank: v.number(),
    startedAt: v.number(),
    lastEventAt: v.number(),
    publishedAt: v.optional(v.number()),
    publicExpiresAt: v.optional(v.number()),
    eventBlobId: v.optional(v.id("_storage")),
    eventCount: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_feed", ["status", "visibility", "moderationStatus", "feedRank"])
    .index("by_stale", ["status", "lastEventAt"])
    .index("by_owner", ["ownerId"]),

  liveMatchMeta: defineTable({
    matchId: v.id("liveMatches"),
    teamA: v.object({ name: v.string(), color: v.optional(v.string()) }),
    teamB: v.object({ name: v.string(), color: v.optional(v.string()) }),
    players: v.optional(
      v.array(
        v.object({
          team: v.union(v.literal("A"), v.literal("B")),
          name: v.string(),
          jersey: v.optional(v.string()),
        }),
      ),
    ),
    sport: v.string(),
  }).index("by_match", ["matchId"]),

  matchEvents: defineTable({
    matchId: v.id("liveMatches"),
    seq: v.number(),
    clientEventId: v.string(),
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
    playerId: v.optional(v.string()),
    runningA: v.number(),
    runningB: v.number(),
    setsA: v.number(),
    setsB: v.number(),
    servingAfter: v.optional(v.union(v.literal("A"), v.literal("B"))),
    commentary: v.optional(v.string()),
    meta: v.optional(v.any()),
    at: v.number(),
  })
    .index("by_match_seq", ["matchId", "seq"])
    .index("by_match_client", ["matchId", "clientEventId"]),
});
