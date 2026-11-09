// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.ts");
const saved = { sport: "football", team1: "North", team2: "South", score1: 2, score2: 1, date: 1, clientMatchId: "bound-save" };
const live = { sport: "football", scorecardKind: "goals", teamA: { name: "North" }, teamB: { name: "South" }, clientMatchId: "bound-live" };
const snapshot = { pointsA: 2, pointsB: 1, setsA: 0, setsB: 0, setScores: [], currentUnit: 1 };

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const a = await ctx.db.insert("users", { tokenIdentifier: "issuer|A", createdAt: 1 });
    const b = await ctx.db.insert("users", { tokenIdentifier: "issuer|B", createdAt: 1 });
    return { a, b };
  });
  const identity = (subject: string) => ({ subject, issuer: "issuer", tokenIdentifier: `issuer|${subject}` });
  return { t, ids, a: t.withIdentity(identity("A")), b: t.withIdentity(identity("B")) };
}

async function data(t: ReturnType<typeof convexTest>) {
  return t.run(async ctx => ({
    matches: await ctx.db.query("matches").collect(),
    teams: await ctx.db.query("teams").collect(),
    players: await ctx.db.query("matchPlayers").collect(),
    live: await ctx.db.query("liveMatches").collect(),
    meta: await ctx.db.query("liveMatchMeta").collect(),
    events: await ctx.db.query("matchEvents").collect(),
  }));
}

test("submitted save rejects a switched identity without writing any match data, then saves once for its owner", async () => {
  const { t, a, b, ids } = await setup();
  const args = { ...saved, expectedOwnerId: "A" };
  const before = await data(t);
  await expect(b.mutation(api.matches.save, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect(await data(t)).toEqual(before);
  const id = await a.mutation(api.matches.save, args);
  expect(await a.mutation(api.matches.save, args)).toBe(id);
  expect((await data(t)).matches).toMatchObject([{ _id: id, operatedBy: ids.a }]);
});

test("save supports the queue's Convex user id fallback and legacy caller-owned requests", async () => {
  const { t, a, b, ids } = await setup();
  const args = { ...saved, expectedOwnerId: ids.a };
  await expect(b.mutation(api.matches.save, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  await a.mutation(api.matches.save, args);
  await b.mutation(api.matches.save, { ...saved, clientMatchId: "legacy" });
  expect((await data(t)).matches.map(match => match.operatedBy)).toEqual([ids.a, ids.b]);
});

test("live creation is bound before creating a switched account's private broadcast", async () => {
  const { t, a, b, ids } = await setup();
  const args = { ...live, expectedOwnerId: "A" };
  const before = await data(t);
  await expect(b.mutation(api.live.create, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect(await data(t)).toEqual(before);
  const created = await a.mutation(api.live.create, args);
  expect(await a.mutation(api.live.create, args)).toEqual(created);
  expect((await data(t)).live).toMatchObject([{ ownerId: ids.a }]);
});

test.each(["scorePoint", "undo", "setVisibility", "finalize"] as const)("live %s keeps A's queued mutation unapplied under B and accepts it after A returns", async operation => {
  const { t, a, b } = await setup();
  const { matchId } = await a.mutation(api.live.create, live);
  await a.mutation(api.live.scorePoint, { matchId, clientEventId: "initial", team: "A", at: 1 });
  const common = { matchId, expectedOwnerId: "A" };
  const invoke = (client: typeof a) => {
    if (operation === "scorePoint") return client.mutation(api.live.scorePoint, { ...common, clientEventId: "point", team: "A", at: 2 });
    if (operation === "undo") return client.mutation(api.live.undo, { ...common, clientEventId: "undo", at: 2 });
    if (operation === "setVisibility") return client.mutation(api.live.setVisibility, { ...common, visibility: "public", snapshot });
    return client.mutation(api.live.finalize, common);
  };
  const before = await data(t);
  await expect(invoke(b)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect(await data(t)).toEqual(before);
  await invoke(a);
  const after = await data(t);
  if (operation === "scorePoint") expect(after.live[0].pointsA).toBe(2);
  if (operation === "undo") expect(after.live[0].pointsA).toBe(0);
  if (operation === "setVisibility") expect(after.live[0].visibility).toBe("public");
  if (operation === "finalize") expect(after.live[0].status).toBe("final");
});

test("expected-owner binding does not replace authentication or live-match ownership", async () => {
  const { t, a, b } = await setup();
  const { matchId } = await a.mutation(api.live.create, live);
  const args = { matchId, expectedOwnerId: "B" };
  await expect(t.mutation(api.live.finalize, args)).rejects.toThrow(/authenticated/i);
  await expect(b.mutation(api.live.finalize, args)).rejects.toMatchObject({ data: { code: "not_authorized" } });
});

test("a switched account without a bootstrapped user still rejects the originating Clerk subject as owner_mismatch", async () => {
  const { t, b, ids } = await setup();
  await t.run(ctx => ctx.db.delete("users", ids.b));
  const args = { ...saved, expectedOwnerId: "A" };
  await expect(b.mutation(api.matches.save, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect((await data(t)).matches).toEqual([]);
});

test("recovery lookup cannot resolve the switched account's same-named live session", async () => {
  const { a, b } = await setup();
  const original = await a.mutation(api.live.create, live);
  await b.mutation(api.live.create, live);
  const args = { clientMatchId: live.clientMatchId, expectedOwnerId: "A" };
  await expect(b.query(api.live.getOwnedSession, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect(await a.query(api.live.getOwnedSession, args)).toMatchObject({ matchId: original.matchId });
});
