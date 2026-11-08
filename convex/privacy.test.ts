// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import { getFunctionName } from "convex/server";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const [ownerId, otherId] = await t.run(async (ctx) => Promise.all(
    ["owner", "other"].map((name) => ctx.db.insert("users", {
      tokenIdentifier: `${name}|privacy`, username: name,
      displayName: name, email: `${name}@example.test`, createdAt: 1,
    })),
  ));
  const owner = t.withIdentity({ tokenIdentifier: "owner|privacy" });
  const other = t.withIdentity({ tokenIdentifier: "other|privacy" });
  const savedId = await owner.mutation(api.matches.save, {
    sport: "volleyball", team1: "Secret Falcons", team2: "Secret Hawks",
    score1: 3, score2: 1, date: 1, team1Players: [ownerId, otherId],
    clientMatchId: "private-saved", detail: { privateNote: "owner only" },
  });
  const live = await owner.mutation(api.live.create, {
    sport: "volleyball", scorecardKind: "volleyball",
    teamA: { name: "Falcons" }, teamB: { name: "Hawks" },
    clientMatchId: "private-live",
  });
  await owner.mutation(api.live.scorePoint, {
    matchId: live.matchId, clientEventId: "p1", team: "A", at: Date.now(),
  });
  return { t, owner, other, ownerId, otherId, savedId, ...live };
}

describe("saved match ownership", () => {
  for (const ref of [api.matches.getByUser, api.matches.getRecent, api.matches.getUserStats]) {
    test(`${getFunctionName(ref)} requires identity and the requested owner`, async () => {
      const { t, owner, other, ownerId } = await fixture();
      await expect(t.query(ref, { userId: ownerId })).rejects.toThrow(/authenticated/i);
      await expect(other.query(ref, { userId: ownerId })).rejects.toThrow(/authorized/i);
      expect(await owner.query(ref, { userId: ownerId })).toBeTruthy();
    });
  }

  test("tagging a player never grants access to the scorer's private match or stats", async () => {
    const { owner, other, ownerId, otherId, savedId } = await fixture();
    expect((await owner.query(api.matches.getByUser, { userId: ownerId })).map((m) => m._id)).toEqual([savedId]);
    expect(await other.query(api.matches.getByUser, { userId: otherId })).toEqual([]);
    expect(await other.query(api.matches.getRecent, { userId: otherId })).toEqual([]);
    expect(await other.query(api.matches.getUserStats, { userId: otherId })).toMatchObject({ totalMatches: 0, gamesOperated: 0 });
  });

  for (const ref of [api.matches.getPublicRecentByUsername, api.matches.getPublicUserStatsByUsername]) {
    test(`${getFunctionName(ref)} cannot bypass ownership using a username`, async () => {
      const { t, owner, other } = await fixture();
      await expect(t.query(ref, { username: "owner" })).rejects.toThrow(/authenticated/i);
      await expect(other.query(ref, { username: "owner" })).rejects.toThrow(/authorized/i);
      expect(await owner.query(ref, { username: " OWNER " })).toBeTruthy();
    });
  }

  test("save scopes team lookup/count writes to the scorer", async () => {
    const { t, other, ownerId, otherId } = await fixture();
    const args = { sport: "volleyball", team1: "Secret Falcons", team2: "Secret Hawks", score1: 0, score2: 0, date: 2 };
    await expect(t.mutation(api.matches.save, args)).rejects.toThrow(/authenticated/i);
    await other.mutation(api.matches.save, args);
    const teams = await t.run((ctx) => ctx.db.query("teams").collect());
    expect(teams.filter((team) => team.createdBy === ownerId)).toHaveLength(2);
    expect(teams.filter((team) => team.createdBy === otherId)).toHaveLength(2);
    expect(teams.every((team) => team.matchCount === 1)).toBe(true);
  });

  test("finalized matches remain in the scorer's private history", async () => {
    const { owner, ownerId, matchId } = await fixture();
    const result = await owner.mutation(api.live.finalize, { matchId });
    expect((await owner.query(api.matches.getByUser, { userId: ownerId })).some((m) => m._id === result.matchId)).toBe(true);
  });
});

describe("profile and team data minimization", () => {
  test("username availability and search require auth; public profile is a strict card", async () => {
    const { t, owner, other } = await fixture();
    await expect(t.query(api.users.checkUsername, { username: "owner" })).rejects.toThrow(/authenticated/i);
    await expect(t.query(api.users.search, { prefix: "own" })).rejects.toThrow(/authenticated/i);
    for (const client of [owner, other]) {
      expect(await client.query(api.users.checkUsername, { username: "owner" })).toBe(false);
      const found = await client.query(api.users.search, { prefix: "own" });
      expect(found).toHaveLength(1);
      expect(Object.keys(found[0]).sort()).toEqual(["_id", "avatarUrl", "displayName", "username"].filter((key) => found[0][key as keyof typeof found[0]] !== undefined).sort());
    }
    const card = await t.query(api.users.getByUsername, { username: "owner" });
    expect(card).toMatchObject({ username: "owner", displayName: "owner", createdAt: 1 });
    expect(Object.keys(card!).every((key) => ["username", "displayName", "avatarUrl", "createdAt"].includes(key))).toBe(true);
  });

  test("team autocomplete returns only the scorer's teams and own match counts", async () => {
    const { t, owner, other } = await fixture();
    const args = { sport: "volleyball", prefix: "Secret" };
    await expect(t.query(api.teams.search, args)).rejects.toThrow(/authenticated/i);
    expect(await other.query(api.teams.search, args)).toEqual([]);
    // Old shared team counters may include other scorers' matches.
    await t.run(async (ctx) => {
      for (const team of await ctx.db.query("teams").collect()) await ctx.db.patch("teams", team._id, { matchCount: 99 });
    });
    const found = await owner.query(api.teams.search, args);
    expect(found).toHaveLength(2);
    expect(found.every((team) => team.matchCount === 1)).toBe(true);
  });
});

describe("explicit live sharing", () => {
  test("create requires auth and scopes a reused client ID to each scorer", async () => {
    const { t, other, otherId, matchId } = await fixture();
    const args = {
      sport: "volleyball", scorecardKind: "volleyball",
      teamA: { name: "Other A" }, teamB: { name: "Other B" }, clientMatchId: "private-live",
    };
    await expect(t.mutation(api.live.create, args)).rejects.toThrow(/authenticated/i);
    const created = await other.mutation(api.live.create, args);
    expect(created.matchId).not.toBe(matchId);
    expect(await t.run((ctx) => ctx.db.get("liveMatches", created.matchId))).toMatchObject({ ownerId: otherId, visibility: "private" });
  });
  test("default/legacy public rows stay hidden until this match is explicitly shared", async () => {
    const { t, owner, other, token, matchId } = await fixture();
    expect((await t.run((ctx) => ctx.db.get("liveMatches", matchId)))?.visibility).toBe("private");
    for (const client of [t, owner, other]) {
      expect(await client.query(api.live.getByToken, { token })).toBeNull();
      expect(await client.query(api.live.getMeta, { token })).toBeNull();
      expect(await client.query(api.live.eventsSince, { token, sinceSeq: 0 })).toEqual([]);
      expect((await client.query(api.live.listEvents, { token, paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([]);
      expect(await client.query(api.live.listLiveFeed, {})).toEqual([]);
    }
    await t.run((ctx) => ctx.db.patch("liveMatches", matchId, { visibility: "public" }));
    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    expect(await t.query(api.live.listLiveFeed, {})).toEqual([]);
    await t.mutation(api.live.report, { token, reason: "spam", reporterId: "anon" });
    expect(await t.run((ctx) => ctx.db.query("moderationReports").collect())).toEqual([]);
    await owner.mutation(api.live.setVisibility, { matchId, visibility: "public" });
    for (const client of [t, owner, other]) {
      const snapshot = await client.query(api.live.getByToken, { token });
      expect(snapshot?.pointsA).toBe(1);
      expect(snapshot).not.toHaveProperty("ownerId");
      expect(await client.query(api.live.getMeta, { token })).toMatchObject({ teamA: { name: "Falcons" } });
      expect((await client.query(api.live.eventsSince, { token, sinceSeq: 0 }))).toHaveLength(1);
      expect((await client.query(api.live.listEvents, { token, paginationOpts: { numItems: 10, cursor: null } })).page).toHaveLength(1);
      expect(await client.query(api.live.listLiveFeed, {})).toHaveLength(1);
    }
    await t.mutation(api.live.report, { token, reason: "spam", reporterId: "anon" });
    expect(await t.run((ctx) => ctx.db.query("moderationReports").collect())).toHaveLength(1);
    await owner.mutation(api.live.setVisibility, { matchId, visibility: "unlisted" });
    expect(await t.query(api.live.getByToken, { token })).not.toBeNull();
    expect(await t.query(api.live.listLiveFeed, {})).toEqual([]);
    await owner.mutation(api.live.setVisibility, { matchId, visibility: "private" });
    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    expect(await t.query(api.live.getMeta, { token })).toBeNull();
    expect(await t.query(api.live.eventsSince, { token, sinceSeq: 0 })).toEqual([]);
    expect((await t.query(api.live.listEvents, { token, paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([]);
  });

  test("all live writes reject anonymous and other scorers", async () => {
    const { t, owner, other, matchId } = await fixture();
    const calls = [
      [api.live.scorePoint, { matchId, clientEventId: "p2", team: "B" as const, at: 2 }],
      [api.live.undo, { matchId, clientEventId: "u1", at: 3 }],
      [api.live.setVisibility, { matchId, visibility: "public" as const }],
      [api.live.pause, { matchId }],
      [api.live.finalize, { matchId }],
    ] as const;
    for (const [ref, args] of calls) {
      await expect(t.mutation(ref, args)).rejects.toThrow(/authenticated/i);
      await expect(other.mutation(ref, args)).rejects.toThrow(/authorized/i);
      expect(await owner.mutation(ref, args)).toBeTruthy();
    }
  });

  test("explicit create visibility is a share decision; held and expired matches stay hidden", async () => {
    const { t, owner } = await fixture();
    const { matchId, token } = await owner.mutation(api.live.create, {
      sport: "volleyball", scorecardKind: "volleyball", teamA: { name: "A" }, teamB: { name: "B" },
      clientMatchId: "explicit", visibility: "public",
    });
    expect(await t.query(api.live.getByToken, { token })).not.toBeNull();
    for (const patch of [{ moderationStatus: "held" as const }, { moderationStatus: "clean" as const, publicExpiresAt: 1 }]) {
      await t.run((ctx) => ctx.db.patch("liveMatches", matchId, patch));
      expect(await t.query(api.live.getByToken, { token })).toBeNull();
      expect(await t.query(api.live.getMeta, { token })).toBeNull();
      expect(await t.query(api.live.eventsSince, { token, sinceSeq: 0 })).toEqual([]);
      expect(await t.query(api.live.listLiveFeed, {})).toEqual([]);
      await t.mutation(api.live.report, { token, reason: "spam", reporterId: "anon" });
    }
    expect(await t.run((ctx) => ctx.db.query("moderationReports").collect())).toEqual([]);
  });
});
