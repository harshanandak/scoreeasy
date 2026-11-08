import { describe, expect, it } from 'vitest';
import { createKabaddiMatch } from './kabaddiQuickMatch';
import { beginLiveRaid, cancelLiveRaid, landRaid, markDefender, reopenRaid } from './kabaddiBoardModel';
import { kabaddiSnapshot, kabaddiUpdates, kabaddiWatchMatch } from './kabaddiBroadcast';
import { liveNow, raidStory } from './kabaddiLiveModel';
import { resolveKabaddiRules } from './kabaddiRules';

const create = () => createKabaddiMatch({ format: { kabaddiRules: resolveKabaddiRules('quick') }, names: ['Private name A', 'Private name B'], colours: [undefined, undefined] });

describe('kabaddi public projection', () => {
  it('publishes a state update when a saved raid is cancelled without a journal entry', () => {
    const started = beginLiveRaid(create(), { atMs: 100 });
    const cancelled = cancelLiveRaid(started);
    expect(cancelled.state.events).toEqual(started.state.events);
    expect(kabaddiUpdates(started, cancelled)).toEqual([{ type: 'kabaddi_state', data: { kind: 'state' } }]);
    const refreshed = kabaddiWatchMatch(JSON.parse(JSON.stringify({ kabaddi: kabaddiSnapshot(cancelled) })), {}, []);
    expect(refreshed.state.activeRaid).toBeNull();
  });

  it('keeps names, journal, input keys, draft marks and identities out of hot snapshots', () => {
    const marked = markDefender(beginLiveRaid(create(), { atMs: 100 }), 'B1', 'touched');
    const json = JSON.stringify(kabaddiSnapshot(marked));
    for (const hidden of ['Private name', 'events', 'inputKey', 'draft', 'history', 'rosters']) expect(json).not.toContain(hidden);
  });

  it('sends a raid start and one landed event for an empty raid, even with unchanged totals', () => {
    const before = create();
    const started = beginLiveRaid(before, { atMs: 100 });
    expect(kabaddiUpdates(before, started).filter(e => e.type === 'raid_start')).toHaveLength(1);
    const landed = landRaid(started, 'safe', { atMs: 200 });
    const updates = kabaddiUpdates(started, landed);
    expect(updates).toHaveLength(1);
    expect(updates[0].data.raid).toMatchObject({ outcome: 'empty', points: [0, 0], number: 1 });
  });

  it('folds landed and undone ids and uses the current engine totals independently of loaded history', () => {
    const started = beginLiveRaid(create(), { atMs: 100 });
    const landed = landRaid(markDefender(started, 'B1', 'touched'), 'safe', { atMs: 200 });
    const event = kabaddiUpdates(started, landed)[0];
    const meta = { teamA: { name: 'Royals' }, teamB: { name: 'Strikers' } };
    let watch = kabaddiWatchMatch({ kabaddi: kabaddiSnapshot(landed) }, meta, [{ seq: 1, kabaddi: event.data }]);
    expect(raidStory(watch)).toHaveLength(1);
    expect(liveNow(watch, 300).totals).toEqual([1, 0]);
    const reopened = reopenRaid(landed, { atMs: 400 });
    const updates = kabaddiUpdates(landed, reopened);
    watch = kabaddiWatchMatch({ kabaddi: kabaddiSnapshot(reopened) }, meta, [{ seq: 1, kabaddi: event.data }, ...updates.map((e, i) => ({ seq: i + 2, kabaddi: e.data }))]);
    expect(raidStory(watch)).toEqual([]);
    expect(liveNow(watch, 500).totals).toEqual([0, 0]);
  });
});
