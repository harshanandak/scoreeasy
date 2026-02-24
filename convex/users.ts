import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authedQuery, authedMutation } from "./lib/functions";

// Idempotent — called on every sign-in via useAuth hook
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (existing) {
      // Update avatar/email if changed
      const updates: Record<string, string> = {};
      if (identity.pictureUrl && identity.pictureUrl !== existing.avatarUrl) {
        updates.avatarUrl = identity.pictureUrl;
      }
      if (identity.email && identity.email !== existing.email) {
        updates.email = identity.email;
      }
      if (identity.name && identity.name !== existing.displayName) {
        updates.displayName = identity.name;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      displayName: identity.name ?? undefined,
      avatarUrl: identity.pictureUrl ?? undefined,
      email: identity.email ?? undefined,
      createdAt: Date.now(),
    });
  },
});

// Claim a unique gamertag
export const claimUsername = authedMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = username.toLowerCase().trim();

    if (normalized.length < 3 || normalized.length > 20) {
      throw new Error("Username must be 3-20 characters");
    }
    if (!/^[a-z0-9_]+$/.test(normalized)) {
      throw new Error("Only lowercase letters, numbers, and underscore allowed");
    }
    if (/^_|_$/.test(normalized)) {
      throw new Error("Cannot start or end with underscore");
    }

    // Check uniqueness via transactional index (NOT search index)
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();

    if (taken) {
      if (taken._id === ctx.user._id) return; // Already yours, no-op
      throw new Error("Username already taken");
    }

    await ctx.db.patch(ctx.user._id, { username: normalized });
  },
});

// Live availability check (uses by_username index, NOT search)
export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = username.toLowerCase().trim();
    if (normalized.length < 3) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();

    return !existing;
  },
});

// Prefix search for player tagging
export const search = query({
  args: { prefix: v.string() },
  handler: async (ctx, { prefix }) => {
    if (prefix.length < 2) return [];
    const results = await ctx.db
      .query("users")
      .withSearchIndex("search_username", (q) =>
        q.search("username", prefix.toLowerCase())
      )
      .take(10);

    return results
      .filter((u) => u.username)
      .map((u) => ({
        _id: u._id,
        username: u.username!,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        role: u.role,
      }));
  },
});

// Public profile lookup by username
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", username.toLowerCase())
      )
      .unique();

    if (!user) return null;
    return {
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  },
});

// Complete onboarding — saves name, gamertag, role, preferences atomically
export const completeOnboarding = authedMutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    username: v.string(),
    role: v.string(),
    favoriteGames: v.array(v.string()),
    playStyle: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = args.username.toLowerCase().trim();

    // Validate username
    if (normalized.length < 3 || normalized.length > 20) {
      throw new Error("Username must be 3-20 characters");
    }
    if (!/^[a-z0-9_]+$/.test(normalized)) {
      throw new Error("Only lowercase letters, numbers, and underscore allowed");
    }
    if (/^_|_$/.test(normalized)) {
      throw new Error("Cannot start or end with underscore");
    }

    // Check uniqueness via transactional index
    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();

    if (taken && taken._id !== ctx.user._id) {
      throw new Error("Username already taken");
    }

    await ctx.db.patch(ctx.user._id, {
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      displayName: `${args.firstName.trim()} ${args.lastName.trim()}`,
      username: normalized,
      role: args.role,
      favoriteGames: args.favoriteGames,
      playStyle: args.playStyle,
      onboardedAt: Date.now(),
    });
  },
});

// Current user's own record (strips internal fields)
export const getMe = authedQuery({
  args: {},
  handler: async (ctx) => {
    const { tokenIdentifier, email, migratedAt, ...safe } = ctx.user;
    return safe;
  },
});
