// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';

const modules = import.meta.glob('./**/*.ts');
test('account History authenticates, scopes by scorer and pages by match date', async () => {
  const t = convexTest(schema, modules);
  const [userId, otherId] = await t.run(async ctx => Promise.all(['X', 'Y'].map(name => ctx.db.insert('users', { tokenIdentifier: name, createdAt: 1 }))));
  const owner = t.withIdentity({ tokenIdentifier: 'X', subject: 'X' });
  const other = t.withIdentity({ tokenIdentifier: 'Y', subject: 'Y' });
  const args = { userId, paginationOpts: { numItems: 2, cursor: null } };
  await expect(t.query(api.matches.getByUser, args)).rejects.toThrow(/authenticated/i);
  await expect(other.query(api.matches.getByUser, args)).rejects.toThrow(/authorized/i);
  await expect(owner.query(api.matches.getByUser, { ...args, expectedOwnerId: 'Y' })).rejects.toThrow(/authorized/i);
  await t.run(async ctx => {
    for (const date of [1, 4, 2, 3]) await ctx.db.insert('matches', { operatedBy: userId, sport: 'football', team1: 'Private X', team2: 'B', score1: date, score2: 0, date });
    await ctx.db.insert('matches', { operatedBy: otherId, sport: 'football', team1: 'Private Y', team2: 'B', score1: 99, score2: 0, date: 99 });
  });
  const first = await owner.query(api.matches.getByUser, { ...args, expectedOwnerId: 'X' });
  expect(first.page.every(m => m.accountOwnerId === 'X')).toBe(true);
  expect(first.page.map(m => m.date)).toEqual([4, 3]);
  expect(first.isDone).toBe(false);
  const next = await owner.query(api.matches.getByUser, { ...args, paginationOpts: { numItems: 2, cursor: first.continueCursor } });
  expect(next.page.map(m => m.date)).toEqual([2, 1]);
  expect(next.isDone).toBe(true);
  expect((await other.query(api.matches.getByUser, { ...args, userId: otherId })).page.map(m => m.team1)).toEqual(['Private Y']);
});
