// @vitest-environment edge-runtime
import { expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = (import.meta as unknown as {
  glob: (pattern: string) => Record<string, () => Promise<unknown>>;
}).glob("./**/*.ts");
const saved = { sport: "football", team1: "North", team2: "South", score1: 2, score2: 1, date: 1, clientMatchId: "bound-save" };

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
  }));
}

test("local storage migration only receives a Convex alias bound to the requested Clerk account", async () => {
  const { t, a, b, ids } = await setup();
  expect(await t.query(api.users.getCurrent, { expectedOwnerId: "A" })).toBeNull();
  expect(await b.query(api.users.getCurrent, { expectedOwnerId: "A" })).toBeNull();
  expect(await a.query(api.users.getCurrent, { expectedOwnerId: "A" })).toMatchObject({ _id: ids.a });
  expect(await a.query(api.users.getCurrent, {})).toMatchObject({ _id: ids.a });
});

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
  const before = await data(t);
  await expect(b.mutation(api.matches.save, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect(await data(t)).toEqual(before);
  await a.mutation(api.matches.save, args);
  await b.mutation(api.matches.save, { ...saved, clientMatchId: "legacy" });
  expect((await data(t)).matches.map(match => match.operatedBy)).toEqual([ids.a, ids.b]);
});

test("a switched account without a bootstrapped user still rejects the originating Clerk subject as owner_mismatch", async () => {
  const { t, b, ids } = await setup();
  await t.run(ctx => ctx.db.delete("users", ids.b));
  const args = { ...saved, expectedOwnerId: "A" };
  await expect(b.mutation(api.matches.save, args)).rejects.toMatchObject({ data: { code: "owner_mismatch" } });
  expect((await data(t)).matches).toEqual([]);
});
