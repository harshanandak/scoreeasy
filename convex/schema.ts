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
  })
    .index("by_operator", ["operatedBy"])
    .index("by_operator_client_match", ["operatedBy", "clientMatchId"])
    .index("by_date", ["date"]),

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
});
