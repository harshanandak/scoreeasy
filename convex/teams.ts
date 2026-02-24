import { v } from "convex/values";
import { query } from "./_generated/server";

export const search = query({
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
        q.search("name", trimmed).eq("sport", sport)
      )
      .take(8);

    return results.map((t) => ({
      _id: t._id,
      name: t.name,
      matchCount: t.matchCount ?? 0,
    }));
  },
});
