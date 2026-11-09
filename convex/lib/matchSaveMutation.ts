import { customMutation } from "convex-helpers/server/customFunctions";
import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";

export const matchSaveMutation = customMutation(mutation, {
  // Older clients without a binding retain caller-owned behavior.
  args: { expectedOwnerId: v.optional(v.string()) },
  input: async (ctx, { expectedOwnerId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    // Only the caller's auth row may be read before resolving a legacy user-id binding.
    if (expectedOwnerId !== undefined && expectedOwnerId !== identity.subject && expectedOwnerId !== user?._id) {
      throw new ConvexError({ code: "owner_mismatch", message: "Queued action belongs to another account" });
    }
    if (!user) throw new Error("User not found");
    return { ctx: { ...ctx, user }, args: {} };
  },
});
