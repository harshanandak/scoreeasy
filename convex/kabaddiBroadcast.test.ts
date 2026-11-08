// @vitest-environment edge-runtime
import { describe, expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import { Infer } from 'convex/values';
import { kabaddiSnapshotValidator, validateKabaddiSnapshot } from './lib/kabaddiValidators';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch.js';
import { beginLiveRaid, cancelLiveRaid, landRaid, markDefender, reopenRaid } from '../src/utils/kabaddiBoardModel.js';
import { kabaddiSnapshot, kabaddiUpdates, kabaddiWatchMatch } from '../src/utils/kabaddiBroadcast.js';
import { raidStory } from '../src/utils/kabaddiLiveModel.js';
import { resolveKabaddiRules } from '../src/utils/kabaddiRules.js';

const modules = (import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }).glob('./**/*.ts');

describe('kabaddi live publication', () => {
  test('matches the saved journal after Stop, private Undo/cancel, replacement raid and re-share', async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('users', { tokenIdentifier: 'republish-owner', createdAt: 0 }));
    const owner = t.withIdentity({ tokenIdentifier: 'republish-owner', subject: 'owner', issuer: 'https://clerk.scoreeasy.test' });
    const details = { sport: 'kabaddi', scorecardKind: 'kabaddi', teamA: { name: 'A' }, teamB: { name: 'B' }, clientMatchId: 'republish' };
    const { matchId, token } = await owner.mutation(api.live.create, details);
    const initial = createKabaddiMatch({ format: { kabaddiRules: resolveKabaddiRules('quick') }, names: ['A', 'B'], colours: [undefined, undefined] });
    const started = beginLiveRaid(initial, { atMs: 100, raider: undefined });
    const first = landRaid(markDefender(started, 'B1', 'touched'), 'safe', { atMs: 200 });
    if (!first) throw new Error('Expected a landed fixture raid');
    const snapshot = (match: NonNullable<typeof first>) => ({ pointsA: match.state.teams[0].score.touch, pointsB: 0, setsA: 0, setsB: 0, setScores: [], currentUnit: 1, kabaddi: kabaddiSnapshot(match) as Infer<typeof kabaddiSnapshotValidator> });
    await owner.mutation(api.live.create, { ...details, kabaddiHistory: raidStory(first) });
    await owner.mutation(api.live.setVisibility, { matchId, visibility: 'unlisted', snapshot: snapshot(first) });
    await owner.mutation(api.live.setVisibility, { matchId, visibility: 'private' });
    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    const cancelled = cancelLiveRaid(reopenRaid(first, { atMs: 300 }));
    const replacement = landRaid(markDefender(beginLiveRaid(cancelled, { atMs: 400, raider: undefined }), 'B2', 'touched'), 'safe', { atMs: 500 });
    if (!replacement) throw new Error('Expected a replacement fixture raid');
    const expected = raidStory(replacement);
    expect(expected).toHaveLength(1);
    expect(expected[0].number).toBe(1);
    await owner.mutation(api.live.create, { ...details, kabaddiHistory: expected });
    await owner.mutation(api.live.setVisibility, { matchId, visibility: 'unlisted', snapshot: snapshot(replacement) });
    const events = await t.query(api.live.eventsSince, { token, sinceSeq: 0 });
    expect(events.flatMap(e => e.kabaddi?.kind === 'raid' ? [e.kabaddi.raid.id] : [])).toEqual(expected.map((e: { id: string }) => e.id));
    const refreshed = kabaddiWatchMatch(await t.query(api.live.getByToken, { token }), await t.query(api.live.getMeta, { token }), events);
    expect(raidStory(refreshed).map((e: { id: string }) => e.id)).toEqual(expected.map((e: { id: string }) => e.id));
  });

  test('a cancelled saved raid is absent after the spectator reloads the server snapshot', async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('users', { tokenIdentifier: 'cancel-owner', createdAt: 0 }));
    const owner = t.withIdentity({ tokenIdentifier: 'cancel-owner', subject: 'owner', issuer: 'https://clerk.scoreeasy.test' });
    const { matchId, token } = await owner.mutation(api.live.create, { sport: 'kabaddi', scorecardKind: 'kabaddi', teamA: { name: 'A' }, teamB: { name: 'B' }, clientMatchId: 'cancel' });
    const started = beginLiveRaid(createKabaddiMatch({ names: ['A', 'B'], colours: [undefined, undefined] }), { atMs: 100, raider: undefined });
    const snapshot = (match: typeof started) => ({ pointsA: 0, pointsB: 0, setsA: 0, setsB: 0, setScores: [], currentUnit: 1, kabaddi: kabaddiSnapshot(match) as Infer<typeof kabaddiSnapshotValidator> });
    await owner.mutation(api.live.setVisibility, { matchId, visibility: 'unlisted', snapshot: snapshot(started) });
    const cancelled = cancelLiveRaid(started);
    for (const [index, update] of kabaddiUpdates(started, cancelled).entries()) {
      await owner.mutation(api.live.scorePoint, { matchId, clientEventId: `cancel-${index}`, team: 'A', value: 0, at: 200, type: update.type, kabaddi: update.data, snapshot: snapshot(cancelled) });
    }
    const reloaded = await t.query(api.live.getByToken, { token });
    expect(reloaded?.kabaddi?.activeRaid).toBeNull();
  });

  test.each([
    ['last-raid score pair length', (k: Infer<typeof kabaddiSnapshotValidator>) => { k.lastRaid!.score = [1]; }],
    ['last-raid points pair length', (k: Infer<typeof kabaddiSnapshotValidator>) => { k.lastRaid!.points = [1]; }],
    ['last-raid team index', (k: Infer<typeof kabaddiSnapshotValidator>) => { k.lastRaid!.team = 3; }],
    ['last-raid half index', (k: Infer<typeof kabaddiSnapshotValidator>) => { k.lastRaid!.half = 3; }],
    ['last-raid dismissal pair', (k: Infer<typeof kabaddiSnapshotValidator>) => { k.lastRaid!.lostSlots = [[]]; }],
    ['last-raid dismissal counts', (k: Infer<typeof kabaddiSnapshotValidator>) => { k.lastRaid!.lostSlots[1] = []; }],
    ['unknown version', (k: Infer<typeof kabaddiSnapshotValidator>) => { Object.assign(k, { version: 99 }); }],
  ])('rejects malformed nested state: %s', (_label, corrupt) => {
    const started = beginLiveRaid(createKabaddiMatch({ names: ['A', 'B'], colours: [undefined, undefined] }), { atMs: 100, raider: undefined });
    const landed = landRaid(markDefender(started, 'B1', 'touched'), 'safe', { atMs: 200 });
    const k = kabaddiSnapshot(landed) as Infer<typeof kabaddiSnapshotValidator>;
    corrupt(k);
    expect(() => validateKabaddiSnapshot(k, [1, 0])).toThrow();
  });

  test('keeps roster and raid state private until shared; deduplicates the empty raid payload', async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('users', { tokenIdentifier: 'kabaddi-owner', createdAt: 0 }));
    const owner = t.withIdentity({ tokenIdentifier: 'kabaddi-owner', subject: 'owner', issuer: 'https://clerk.scoreeasy.test' });
    const match = createKabaddiMatch({ format: { kabaddiRules: resolveKabaddiRules('quick') }, names: ['A', 'B'], colours: [undefined, undefined] });
    const { matchId, token } = await owner.mutation(api.live.create, { sport: 'kabaddi', scorecardKind: 'kabaddi', teamA: { name: 'A' }, teamB: { name: 'B' }, clientMatchId: 'private-kabaddi', players: [{ team: 'A', name: 'Ravi Kumar' }] });
    expect(await t.query(api.live.getByToken, { token })).toBeNull();
    expect(await t.query(api.live.getMeta, { token })).toBeNull();
    const started = beginLiveRaid(match, { atMs: 100, raider: undefined });
    const landed = landRaid(started, 'safe', { atMs: 200 });
    const snapshot = { pointsA: 0, pointsB: 0, setsA: 0, setsB: 0, setScores: [], currentUnit: 1, kabaddi: kabaddiSnapshot(landed) as Infer<typeof kabaddiSnapshotValidator> };
    await owner.mutation(api.live.setVisibility, { matchId, visibility: 'unlisted', snapshot });
    const raid = kabaddiUpdates(started, landed)[0].data;
    const args = { matchId, clientEventId: `kabaddi-raid:${raid.raid.id}`, team: 'A' as const, value: 0, at: 200, type: 'kabaddi_raid' as const, kabaddi: raid, snapshot };
    await owner.mutation(api.live.scorePoint, args);
    await owner.mutation(api.live.scorePoint, args);
    const read = await t.query(api.live.getByToken, { token });
    expect(read?.kabaddi?.raidNumber).toBe(1);
    expect(read).not.toHaveProperty('ownerId');
    const meta = await t.query(api.live.getMeta, { token });
    expect(meta?.players[0].name).toBe('Ravi Kumar');
    const events = await t.query(api.live.eventsSince, { token, sinceSeq: 0 });
    expect(events).toHaveLength(1);
    expect(events[0].kabaddi?.kind).toBe('raid');
    await owner.mutation(api.live.create, { sport: 'kabaddi', scorecardKind: 'kabaddi', teamA: { name: 'A' }, teamB: { name: 'B' }, clientMatchId: 'private-kabaddi', kabaddiHistory: [raid.raid] });
    expect(await t.query(api.live.eventsSince, { token, sinceSeq: 0 })).toHaveLength(1);
    await owner.mutation(api.live.finalize, { matchId });
    const archives = await t.run(ctx => ctx.db.query('matches').collect());
    expect(archives).toEqual([]);
  });
});
