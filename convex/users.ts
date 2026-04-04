import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authedQuery, authedMutation } from "./lib/functions";

const LEET_MAP: Record<string, string> = {
  a: "[a@4]", b: "[b8]", c: "[ck]", d: "[d]", e: "[e3]",
  f: "[f]", g: "[g9]", h: "[h]", i: "[i1!l]", j: "[j]",
  k: "[k]", l: "[l1!i]", m: "[m]", n: "[n]", o: "[o0]",
  p: "[p]", q: "[q]", r: "[r]", s: "[s$5z]", t: "[t7]",
  u: "[uv]", v: "[vu]", w: "[w]", x: "[x]", y: "[y]", z: "[zs]",
};

const SEP = "[_.0-9]?";

function wordToPattern(word: string): string {
  return word
    .split("")
    .map((ch) => {
      const cls = LEET_MAP[ch] || ch;
      return `${cls}+`;
    })
    .join(SEP);
}

const BLOCKED_WORDS = [
  "fuck", "shit", "cunt", "bitch", "dick", "cock", "pussy", "asshole",
  "bastard", "slut", "whore", "nigger", "nigga", "faggot", "retard",
  "wank", "twat", "bollocks", "prick", "arse",
  "chutiya", "chutia", "chutiye", "madarchod", "bhenchod", "bhosdike",
  "bsdk", "gandu", "randi", "haramkhor", "harami", "lodu", "lavde",
  "jhatu", "choot", "gaand", "tatti", "kutte", "kuttiya", "saala",
  "hramzada", "bhosdi", "lund", "chinal", "raand", "dalla",
  "kamina", "kamine", "kaminey", "hijra", "chakka", "laudu",
  "bhadwa", "bhadwe", "chodu", "chodna", "behenchod",
  "machar", "maderchod", "bhenkelode", "chodoo",
  "gandmara", "gandphadu", "jhaant", "jhaantu", "bhosad",
  "tharki", "lauda", "laude", "lundure", "gaandmara",
  "penchod", "bhenchodd", "kutti", "khotey", "khotay",
  "chootad", "teri_maa", "panchod", "gashti", "kanjar",
  "tattay", "phuddi", "phuddu", "ghasti",
  "maichod", "bhokal", "bhokaal", "chootmarani", "gandwa",
  "raandwa", "bhadwi", "khanki", "suar", "suwar",
  "bhadvo", "randvo", "kutto", "gandiya", "chootad",
  "zhavnya", "raand", "chhinaal", "aaizhavadya", "bhikarchot",
  "maadarchod", "gaandit", "zavnya",
  "thevidiya", "thevdiya", "oombu", "sunni", "punda", "pundai",
  "myiru", "baadu", "vesai", "vesi", "thayoli", "okka",
  "otha", "koothi", "naayee",
  "lanja", "lanjakodaka", "pooka", "modda", "dengey", "gudda",
  "sulli", "erripuka", "donga", "denga", "lanjodaka",
  "sule", "sulemaga", "bolimaga", "tunne", "munde", "hendti",
  "soolemaga",
  "banchod", "magi", "chodu", "bokachoda", "shala", "haramjada",
  "baal", "nangta", "khanki", "fatichod",
  "myiru", "thayoli", "kunna", "pooru", "thendi", "mandan",
  "gando", "gandi", "bhosdo", "chootiya", "lodo",
];

const PROFANITY_REGEX = new RegExp(
  BLOCKED_WORDS.map((w) => `(?:${wordToPattern(w)})`).join("|")
);

function normalizeUsernameValue(username: string) {
  return username.toLowerCase().trim();
}

function validateUsernameValue(username: string) {
  if (username.length < 4 || username.length > 20) {
    throw new Error("Username must be 4-20 characters");
  }
  if (!/^[a-z0-9_.]+$/.test(username)) {
    throw new Error("Only lowercase letters, numbers, underscore, and period allowed");
  }
  if (/(?:^[_.])|(?:[_.]$)/.test(username)) {
    throw new Error("Cannot start or end with underscore or period");
  }
  if (/(?:\.\.)|(?:__)|(?:_\.)|(?:\._)/.test(username)) {
    throw new Error("No consecutive special characters");
  }
  if (PROFANITY_REGEX.test(username)) {
    throw new Error("Username contains inappropriate language");
  }
}

async function getUserByTokenIdentifier(ctx: { db: any }, tokenIdentifier: string) {
  return ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

async function getUserByUsername(ctx: { db: any }, username: string) {
  return ctx.db
    .query("users")
    .withIndex("by_username", (q: any) => q.eq("username", normalizeUsernameValue(username)))
    .unique();
}

function toSafeCurrentUser(user: any) {
  if (!user) return null;
  const { tokenIdentifier, email, migratedAt, ...safe } = user;
  return safe;
}

function toPublicProfile(user: any) {
  if (!user) return null;
  return {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    if (existing) {
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

    return ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      displayName: identity.name ?? undefined,
      avatarUrl: identity.pictureUrl ?? undefined,
      email: identity.email ?? undefined,
      createdAt: Date.now(),
    });
  },
});

export const claimUsername = authedMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = normalizeUsernameValue(username);
    validateUsernameValue(normalized);

    const taken = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();

    if (taken) {
      if (taken._id === ctx.user._id) return;
      throw new Error("Username already taken");
    }

    await ctx.db.patch(ctx.user._id, { username: normalized });
  },
});

export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = normalizeUsernameValue(username);
    if (normalized.length < 4) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", normalized))
      .unique();

    return !existing;
  },
});

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

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await getUserByUsername(ctx, username);
    return toPublicProfile(user);
  },
});

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
    const normalized = normalizeUsernameValue(args.username);
    validateUsernameValue(normalized);

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

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);
    return toSafeCurrentUser(user);
  },
});

export const getMe = authedQuery({
  args: {},
  handler: async (ctx) => toSafeCurrentUser(ctx.user),
});
