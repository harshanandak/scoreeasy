import { v } from "convex/values";
import { QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { authedMutation, authedQuery } from "./lib/functions";

async function getMatchesForUserId(ctx: QueryCtx, userId: Id<"users">) {
  const matches = await ctx.db.query("matches")
    .withIndex("by_operator", (q) => q.eq("operatedBy", userId)).collect();
  const ownedIds = new Set(matches.map((match) => match._id));
  const playerEntries = await ctx.db
    .query("matchPlayers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return {
    playerEntries: playerEntries.filter((entry) => ownedIds.has(entry.matchId)),
    matches,
  };
}

function buildStats(playerEntries: Doc<"matchPlayers">[], matches: Doc<"matches">[]) {
  const playerMatches = playerEntries.filter((entry) => entry.role === "player");
  const operatorEntries = playerEntries.filter((entry) => entry.role === "operator");
  const matchMap = new Map(matches.map((match) => [match._id, match]));

  let wins = 0;
  let decidedMatches = 0;
  const sportBreakdown: Record<string, { played: number; wins: number }> = {};

  for (const entry of playerMatches) {
    const match = matchMap.get(entry.matchId);
    if (!match) continue;

    if (!sportBreakdown[entry.sport]) {
      sportBreakdown[entry.sport] = { played: 0, wins: 0 };
    }
    sportBreakdown[entry.sport].played += 1;

    if (match.resultType === "abandoned") continue;
    decidedMatches += 1;
    if (match.winner && match.winner === entry.team) {
      wins += 1;
      sportBreakdown[entry.sport].wins += 1;
    }
  }

  const totalMatches = playerMatches.length;

  return {
    totalMatches,
    wins,
    winRate: decidedMatches > 0 ? Math.round((wins / decidedMatches) * 100) : 0,
    gamesOperated: operatorEntries.length,
    sportBreakdown,
  };
}

function sortMatchesByDate(matches: Doc<"matches">[]) {
  return [...matches].sort((a, b) => b.date - a.date);
}

export const save = authedMutation({
  args: {
    sport: v.string(),
    team1: v.string(),
    team2: v.string(),
    score1: v.number(),
    score2: v.number(),
    detail: v.optional(v.any()),
    winner: v.optional(v.string()),
    resultType: v.optional(v.union(v.literal("decided"), v.literal("abandoned"))),
    format: v.optional(v.any()),
    date: v.number(),
    duration: v.optional(v.number()),
    team1Players: v.optional(v.array(v.id("users"))),
    team2Players: v.optional(v.array(v.id("users"))),
    matchRole: v.optional(v.string()),
    clientMatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      team1Players,
      team2Players,
      matchRole,
      clientMatchId,
      ...matchData
    } = args;

    if (clientMatchId) {
      const existingMatch = await ctx.db
        .query("matches")
        .withIndex("by_operator_client_match", (q) =>
          q.eq("operatedBy", ctx.user._id).eq("clientMatchId", clientMatchId)
        )
        .unique();

      if (existingMatch) {
        return existingMatch._id;
      }
    }

    const findOrCreateTeam = async (name: string) => {
      const trimmedName = name.trim();
      const nameLower = trimmedName.toLowerCase();
      if (!nameLower || nameLower.length > 50) return undefined;

      const existing = await ctx.db
        .query("teams")
        .withIndex("by_creator_sport_name_lower", (q) =>
          q.eq("createdBy", ctx.user._id).eq("sport", matchData.sport).eq("nameLower", nameLower)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          matchCount: (existing.matchCount ?? 0) + 1,
        });
        return existing._id;
      }

      return ctx.db.insert("teams", {
        name: trimmedName,
        nameLower,
        sport: matchData.sport,
        createdBy: ctx.user._id,
        matchCount: 1,
        createdAt: Date.now(),
      });
    };

    const team1Id = await findOrCreateTeam(matchData.team1);
    const team2Id = await findOrCreateTeam(matchData.team2);

    const matchId = await ctx.db.insert("matches", {
      ...matchData,
      operatedBy: ctx.user._id,
      team1Id,
      team2Id,
      matchRole: matchRole ?? "playing",
      clientMatchId,
    });

    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: ctx.user._id,
      team: "operator",
      sport: args.sport,
      role: "operator",
    });

    const insertPlayer = async (userId: Id<"users">, team: string) => {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId,
        team,
        sport: args.sport,
        role: "player",
      });
    };

    if (team1Players) {
      await Promise.all(team1Players.map((uid) => insertPlayer(uid, args.team1)));
    }
    if (team2Players) {
      await Promise.all(team2Players.map((uid) => insertPlayer(uid, args.team2)));
    }

    return matchId;
  },
});

export const getByUser = authedQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (userId !== ctx.user._id) {
      throw new Error("Not authorized");
    }

    const { matches } = await getMatchesForUserId(ctx, userId);
    return sortMatchesByDate(matches);
  },
});

export const getUserStats = authedQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (userId !== ctx.user._id) {
      throw new Error("Not authorized");
    }

    const { playerEntries, matches } = await getMatchesForUserId(ctx, userId);
    return buildStats(playerEntries, matches);
  },
});

export const getRecent = authedQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (userId !== ctx.user._id) {
      throw new Error("Not authorized");
    }

    const { matches } = await getMatchesForUserId(ctx, userId);
    return sortMatchesByDate(matches).slice(0, 10);
  },
});

export const getPublicUserStatsByUsername = authedQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    if (username.toLowerCase().trim() !== ctx.user.username) throw new Error("Not authorized");

    const { playerEntries, matches } = await getMatchesForUserId(ctx, ctx.user._id);
    return buildStats(playerEntries, matches);
  },
});

export const getPublicRecentByUsername = authedQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    if (username.toLowerCase().trim() !== ctx.user.username) throw new Error("Not authorized");

    const { matches } = await getMatchesForUserId(ctx, ctx.user._id);
    return sortMatchesByDate(matches).slice(0, 10);
  },
});

