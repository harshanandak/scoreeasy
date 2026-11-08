import { describe, expect, it } from 'vitest';
import { applyRaid, assertState, createKabaddiState, finish, migrateKabaddiState, pause, remainingTime, resume, startHalf, startRaid, teamTotal, timeUp, undo } from './kabaddiEngine';
import { resolveKabaddiRules } from './kabaddiRules';

const begin = (presetId, rules) => startHalf(createKabaddiState({ presetId, rules }));
const raid = (s, type = 'empty', extra = {}) => applyRaid(s, { id: `r-${s.revision}`, type, ...extra });

describe('versioned kabaddi formats', () => {
  it('copies complete presets and rejects unsupported combinations and fields', () => {
    const a = resolveKabaddiRules('quick');
    expect(a).toMatchObject({ initialPlayers: 5, strategy: 'pointsOnly', raidLimitMs: null, bonus: { enabled: false }, end: { kind: 'target', points: 21 } });
    a.end.points = 3;
    expect(resolveKabaddiRules('quick').end.points).toBe(21);
    expect(resolveKabaddiRules('women').end.halfMs).toBe(900000);
    expect(() => resolveKabaddiRules('beach')).toThrow();
    expect(() => resolveKabaddiRules('circle')).toThrow();
    expect(() => resolveKabaddiRules('custom', { ...resolveKabaddiRules('quick'), outs: { mode: 'fifo', revival: 'onePerOpponentOut', allOutPoints: 2, restore: 'allOrdinary' } })).toThrow();
    expect(() => resolveKabaddiRules('custom', { ...resolveKabaddiRules('standard'), unexpected: true })).toThrow();
  });

  it('quick raids retain players, have no clocks, bonus or super tackle and undo exactly', () => {
    let s = begin('quick');
    expect(remainingTime(s, 100)).toBeNull();
    s = startRaid(s, { id: 'draft', atMs: 100 });
    expect(s.activeRaid.raidClock).toBeNull();
    expect(() => raid(s, 'bonus', { bonusBeforeContact: true })).toThrow();
    s = raid(s, 'touch', { count: 5 });
    expect(s.mat.map(m => m.length)).toEqual([5, 5]);
    expect(s.teams.map(teamTotal)).toEqual([5, 0]);
    const restored = undo(s);
    expect(restored.teams.map(teamTotal)).toEqual([0, 0]);
    expect(restored.mat).toEqual(s.mat);
    expect(() => assertState(resume(restored))).not.toThrow();
    expect(() => timeUp(s)).toThrow();
    expect(() => assertState(pause(s))).not.toThrow();
  });

  it('resolves all effects before target finish and technical-only points wait for a raid', () => {
    const rules = { ...resolveKabaddiRules('quick'), end: { kind: 'target', points: 1 } };
    let s = begin('custom', rules);
    s = raid(s, 'technical', { to: 0, reason: 'Referee ruling', turnEffect: 'none' });
    expect(s.phase).toBe('playing');
    s = raid(s);
    expect(s.phase).toBe('finishReview');
    expect(finish(s).phase).toBe('finished');
    let tied = begin('custom', rules);
    tied = raid(tied, 'touch', { count: 1, technicalAwards: [{ to: 1, reason: 'Penalty' }] });
    expect(tied.teams.map(teamTotal)).toEqual([1, 1]);
    expect(tied.phase).toBe('playing');
    expect(raid(tied, 'tackled').phase).toBe('finishReview');
  });

  it('fixed raids allocate equal completed turns and exclude replay and ordinary technical', () => {
    const rules = { ...resolveKabaddiRules('quick'), end: { kind: 'raids', raidsPerTeam: 1 } };
    let s = begin('custom', rules);
    s = raid(s, 'technical', { to: 0, reason: 'Penalty', turnEffect: 'none' });
    s = startRaid(s, { id: 'replay' });
    s = raid(s, 'technical', { to: 1, reason: 'Replay', turnEffect: 'replay' });
    s = raid(s);
    expect(s.phase).toBe('playing');
    s = raid(s);
    expect(s.phase).toBe('finishReview');
  });

  it('locks rules after play starts and supports a configured FIFO capacity', () => {
    let s = begin('custom', { ...resolveKabaddiRules('standard'), initialPlayers: 8 });
    s = raid(s, 'touch', { count: 8 });
    expect(s.mat[1]).toHaveLength(8);
    expect(s.teams[0].score.allOut).toBe(2);
    s.rules.end.halfMs = 42;
    expect(() => assertState(s)).toThrow();
  });
});

describe('saved club state migration', () => {
  it.each(['ready', 'playing', 'paused', 'halfPending', 'finished'])('migrates the complete %s snapshot graph without changing ids or retry bytes', async (phase) => {
    const legacy = await import('./kabaddiLegacyEngine');
    let old = legacy.createKabaddiState();
    if (phase !== 'ready') old = legacy.startHalf(old);
    if (phase === 'paused') old = legacy.pause(old);
    if (phase === 'halfPending') old = legacy.timeUp(legacy.startRaid(old, { id: 'active' }));
    if (phase === 'finished') {
      old = legacy.timeUp(old);
      old = legacy.startHalf(old);
      old = legacy.finish(legacy.timeUp(old));
    }
    const bytes = JSON.stringify(old);
    const migrated = migrateKabaddiState(old);
    expect(JSON.stringify(old)).toBe(bytes);
    expect(migrateKabaddiState(migrated)).toEqual(migrated);
    expect(migrated.rules.presetId).toBe('legacy-club');
    expect(migrated.events.map(e => [e.id, e.inputKey])).toEqual(old.events.map(e => [e.id, e.inputKey]));
    expect(() => assertState(migrated)).not.toThrow();
    for (const e of migrated.events) {
      expect(e.before.version).toBe(2);
      expect(e.after.rules).toEqual(migrated.rules);
    }
    if (migrated.activeRaid) expect(migrated.activeRaid.before.version).toBe(2);
  });

  it('rejects unknown versions without altering the original', () => {
    const future = { version: 99 };
    expect(() => migrateKabaddiState(future)).toThrow();
    expect(future).toEqual({ version: 99 });
  });
});
