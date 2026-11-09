import {
  customQuery,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";

function rejectOwnerMismatch(): never {
  throw new ConvexError({ code: "owner_mismatch", message: "Queued action belongs to another account" });
}

async function authenticatedUser(ctx: QueryCtx, expectedOwnerId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const subjectMatches = expectedOwnerId === undefined || expectedOwnerId === identity.subject;
  const expectedUserId = expectedOwnerId !== undefined && !subjectMatches ? ctx.db.normalizeId("users", expectedOwnerId) : null;
  if (!subjectMatches && !expectedUserId) rejectOwnerMismatch();
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  // Legacy user-id bindings need the auth lookup, never a match-data read.
  if (!subjectMatches && expectedUserId !== user?._id) rejectOwnerMismatch();
  if (!user) throw new Error("User not found");
  return user;
}

export const authedQuery = customQuery(query, {
  args: { expectedOwnerId: v.optional(v.string()) },
  input: async (ctx, { expectedOwnerId }) => ({
    ctx: { ...ctx, user: await authenticatedUser(ctx, expectedOwnerId) }, args: {},
  }),
});

export const authedMutation = customMutation(mutation, {
  // Older transport requests have no binding and retain caller-owned semantics.
  args: { expectedOwnerId: v.optional(v.string()) },
  input: async (ctx, { expectedOwnerId }) => ({
    ctx: { ...ctx, user: await authenticatedUser(ctx, expectedOwnerId) }, args: {},
  }),
});
