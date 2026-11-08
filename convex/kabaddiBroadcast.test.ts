// @vitest-environment edge-runtime
import { describe, expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { api } from './_generated/api';
import { Infer } from 'convex/values';
import { kabaddiSnapshotValidator } from './lib/kabaddiValidators';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch.js';
import { beginLiveRaid, landRaid } from '../src/utils/kabaddiBoardModel.js';
import { kabaddiSnapshot, kabaddiUpdates } from '../src/utils/kabaddiBroadcast.js';
import { resolveKabaddiRules } from '../src/utils/kabaddiRules.js';

const modules = (import.meta as unknown as { glob: (pattern: string) => Record<string, () => Promise<unknown>> }).glob('./**/*.ts');

describe('kabaddi live publication', () => {
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
    const args = { matchId, clientEventId: 'empty-1', team: 'A' as const, value: 0, at: 200, type: 'kabaddi_raid' as const, kabaddi: raid, snapshot };
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
  });
});
