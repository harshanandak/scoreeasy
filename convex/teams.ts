import { v } from "convex/values";
import { authedQuery } from "./lib/functions";

export const search = authedQuery({
  args: {
    sport: v.string(),
    prefix: v.string(),
  },
  handler: async (ctx, { sport, prefix }) => {
    const trimmed = prefix.trim();
    if (trimmed.length < 2) return [];

    const results = await ctx.db
      .query("teams")
      .withSearchIndex("search_name", (q) =>
        q.search("name", trimmed).eq("sport", sport).eq("createdBy", ctx.user._id)
      )
      .take(8);

    // Legacy team counters included matches from other scorers.
    const matches = await ctx.db.query("matches")
      .withIndex("by_operator", (q) => q.eq("operatedBy", ctx.user._id)).collect();
    return results.map((t) => ({
      _id: t._id,
      name: t.name,
      matchCount: matches.filter((m) => m.team1Id === t._id || m.team2Id === t._id).length,
    }));
  },
});
