import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { authedMutation } from "./lib/functions";

export const save = authedMutation({
  args: {
    sport: v.string(),
    team1: v.string(),
    team2: v.string(),
    score1: v.number(),
    score2: v.number(),
    detail: v.optional(v.any()),
    winner: v.optional(v.string()),
    format: v.optional(v.any()),
    date: v.number(),
    duration: v.optional(v.number()),
    team1Players: v.optional(v.array(v.id("users"))),
    team2Players: v.optional(v.array(v.id("users"))),
    matchRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { team1Players, team2Players, matchRole, ...matchData } = args;

    // Find or create teams atomically (server-side, no frontend delay)
    const findOrCreateTeam = async (name: string) => {
      const nameLower = name.trim().toLowerCase();
      if (!nameLower || nameLower.length > 50) return undefined;
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_sport_name_lower", (q) =>
          q.eq("sport", matchData.sport).eq("nameLower", nameLower)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          matchCount: (existing.matchCount ?? 0) + 1,
        });
        return existing._id;
      }
      return ctx.db.insert("teams", {
        name: name.trim(),
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
    });

    // Create operator entry
    await ctx.db.insert("matchPlayers", {
      matchId,
      userId: ctx.user._id,
      team: "operator",
      sport: args.sport,
      role: "operator",
    });

    // Create player entries for tagged registered users
    const insertPlayer = async (
      userId: Id<"users">,
      team: string
    ) => {
      await ctx.db.insert("matchPlayers", {
        matchId,
        userId,
        team,
        sport: args.sport,
        role: "player",
      });
    };

    if (team1Players) {
      await Promise.all(
        team1Players.map((uid) => insertPlayer(uid, args.team1))
      );
    }
    if (team2Players) {
      await Promise.all(
        team2Players.map((uid) => insertPlayer(uid, args.team2))
      );
    }

    return matchId;
  },
});

export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const playerEntries = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const matchIds = [...new Set(playerEntries.map((e) => e.matchId))];
    const matches = await Promise.all(
      matchIds.map((id) => ctx.db.get(id))
    );

    return matches
      .filter(Boolean)
      .sort((a, b) => b!.date - a!.date);
  },
});

export const getUserStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const playerEntries = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Separate player entries from operator entries
    const playerMatches = playerEntries.filter((e) => e.role === "player");
    const operatorEntries = playerEntries.filter((e) => e.role === "operator");

    // Fetch all unique match docs
    const matchIds = [...new Set(playerMatches.map((e) => e.matchId))];
    const matches = await Promise.all(
      matchIds.map((id) => ctx.db.get(id))
    );
    const matchMap = new Map(
      matches.filter(Boolean).map((m) => [m!._id, m!])
    );

    let wins = 0;
    const sportBreakdown: Record<
      string,
      { played: number; wins: number }
    > = {};

    for (const entry of playerMatches) {
      const match = matchMap.get(entry.matchId);
      if (!match) continue;

      const sport = entry.sport;
      if (!sportBreakdown[sport]) {
        sportBreakdown[sport] = { played: 0, wins: 0 };
      }
      sportBreakdown[sport].played++;

      // Check if this player's team won
      if (match.winner && match.winner === entry.team) {
        wins++;
        sportBreakdown[sport].wins++;
      }
    }

    const totalMatches = playerMatches.length;

    return {
      totalMatches,
      wins,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
      gamesOperated: operatorEntries.length,
      sportBreakdown,
    };
  },
});

export const getRecent = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const playerEntries = await ctx.db
      .query("matchPlayers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const matchIds = [...new Set(playerEntries.map((e) => e.matchId))];
    const matches = await Promise.all(
      matchIds.map((id) => ctx.db.get(id))
    );

    return matches
      .filter(Boolean)
      .sort((a, b) => b!.date - a!.date)
      .slice(0, 10);
  },
});
