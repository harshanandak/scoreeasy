import { describe, expect, it } from 'vitest';
import { getSportById } from './sportRegistry';
import { applySetsPreset, broadcastServer, endChangeDue, firstServerForSet, freezeSetsFormat, isSetsGameComplete, serveAfterPoint, setWinRule } from './setsRules';

const rulesFor = (sport, format = {}, options) => freezeSetsFormat(getSportById(sport), {
  type: 'best-of', sets: sport === 'tabletennis' ? 5 : 3, ...format,
}, options).setsRules;
const score = (score1, score2, completed = false) => ({ score1, score2, completed });

describe('frozen edition-specific sets rules', () => {
  it('applies the badminton cap before the margin, without ending a tie', () => {
    const rule = setWinRule(rulesFor('badminton'));
    expect(isSetsGameComplete(score(29, 29), rule)).toBe(false);
    expect(isSetsGameComplete(score(30, 29), rule)).toBe(true);
    expect(isSetsGameComplete(score(29, 30), rule)).toBe(true);
    expect(isSetsGameComplete(score(30, 30), rule)).toBe(false);
    expect(isSetsGameComplete(score(21, 20), rule)).toBe(false);
    expect(isSetsGameComplete(score(22, 20), rule)).toBe(true);
    expect(isSetsGameComplete(score(30, 29), { ...rule, target: 40 })).toBe(true);
  });

  it('supports uncapped custom games, win-by-one, deciding targets and match length', () => {
    const rules = rulesFor('badminton', { sets: 5, points: 15, customization: { pointCap: null, winBy: 1, decidingPoints: 11 } });
    expect(rules.setsToWin).toBe(3);
    expect(setWinRule(rules, 0)).toMatchObject({ target: 15, winBy: 1, maxPoints: null });
    expect(setWinRule(rules, 4).target).toBe(11);
    expect(isSetsGameComplete(score(15, 14), setWinRule(rules))).toBe(true);
    const uncapped = rulesFor('badminton', { customization: { pointCap: null } });
    expect(isSetsGameComplete(score(30, 29), setWinRule(uncapped))).toBe(false);
  });

  it('round-trips frozen rules without consulting changed registry defaults', () => {
    const config = structuredClone(getSportById('badminton'));
    const frozen = freezeSetsFormat(config, { type: 'best-of', sets: 3, points: 21 });
    config.config.pointsPerSet = 15;
    config.config.maxPoints = 21;
    const restored = freezeSetsFormat(config, JSON.parse(JSON.stringify(frozen)));
    expect(restored.setsRules).toEqual(frozen.setsRules);
    expect(restored.setsRules).toMatchObject({ profile: 'bwf-2025', points: 21, cap: 30, initialServer: null });
    expect(Object.isFrozen(restored.setsRules)).toBe(true);
  });

  it('keeps source/edition presets distinct from casual and custom school choices', () => {
    const official = applySetsPreset('volleyball', 'official');
    expect(rulesFor('volleyball', official)).toMatchObject({ points: 25, decidingPoints: 15, cap: null, sets: 5 });
    expect(official.rulesPreset).toContain('FIVB indoor 2025');
    expect(applySetsPreset('badminton', 'casual')).toMatchObject({ type: 'single', target: 11, rulesPreset: 'Quick casual' });
    expect(applySetsPreset('badminton', 'custom').rulesPreset).toBe('Custom school');
    const tennis = { type: 'best-of', sets: 3 };
    expect(freezeSetsFormat(getSportById('tennis'), tennis)).toBe(tennis);
  });
});

describe('team-level service and end changes', () => {
  it.each(['volleyball', 'badminton'])('%s gives service to the rally winner', (sport) => {
    const rules = rulesFor(sport);
    expect(serveAfterPoint(rules, { score: score(1, 0), servingTeam: null, winner: 1 })).toBe(1);
    expect(serveAfterPoint(rules, { score: score(2, 0), servingTeam: 1, winner: 1 })).toBe(1);
    expect(serveAfterPoint(rules, { score: score(2, 1), servingTeam: 1, winner: 2 })).toBe(2);
  });

  it('alternates table tennis every two, then every one after 10-all', () => {
    const rules = rulesFor('tabletennis', { initialServer: 1 });
    for (const [a, b, server] of [[1, 0, 1], [1, 1, 2], [2, 1, 2], [2, 2, 1], [10, 9, 2], [10, 10, 1], [11, 10, 2], [11, 11, 1]]) {
      expect(serveAfterPoint(rules, { score: score(a, b), winner: 2, servingTeam: 2 })).toBe(server);
    }
    expect(firstServerForSet(rules, 1)).toBe(2);
    expect(firstServerForSet(rules, 2)).toBe(1);
  });

  it('keeps unknown and manual service truthful', () => {
    const rules = rulesFor('tabletennis');
    expect(serveAfterPoint(rules, { score: score(10, 10), winner: 1 })).toBeNull();
    expect(broadcastServer(null)).toBeUndefined();
    expect(serveAfterPoint({ ...rules, serviceMode: 'manual' }, { score: score(3, 2), servingTeam: 2, winner: 1 })).toBe(2);
    expect(firstServerForSet(rules, 0, [{ firstServer: 2 }])).toBe(2);
  });

  it('keeps a custom alternating cadence outside table tennis', () => {
    const rules = rulesFor('volleyball', { points: 3, initialServer: 1, customization: { serviceMode: 'alternating', serviceEvery: 2 } });
    expect(serveAfterPoint(rules, { score: score(3, 2), winner: 1, servingTeam: 2 })).toBe(1);
  });

  it('uses the badminton game winner, and asks again for volleyball', () => {
    const sets = [score(21, 18, true)];
    expect(firstServerForSet(rulesFor('badminton'), 1, sets)).toBe(1);
    expect(firstServerForSet(rulesFor('volleyball'), 1, sets, 1)).toBeNull();
  });

  it.each([['volleyball', 8], ['badminton', 11], ['tabletennis', 5]])('%s changes ends only at the deciding threshold', (sport, threshold) => {
    const rules = rulesFor(sport);
    expect(endChangeDue(rules, rules.sets - 1, score(threshold - 1, 0))).toBe(false);
    expect(endChangeDue(rules, rules.sets - 1, score(threshold, 0))).toBe(true);
    expect(endChangeDue(rules, 0, score(threshold, 0))).toBe(false);
    expect(Boolean(endChangeDue({ ...rules, sets: 1 }, 0, score(threshold, 0)))).toBe(false);
  });
});

describe('legacy match migration', () => {
  it('preserves old tournament cap ordering and every-point service', () => {
    const rules = rulesFor('badminton', {}, { legacy: true, path: 'tournament' });
    expect(rules).toMatchObject({ version: 0, initialServer: 1, firstServerPolicy: 'carry', marginBeforeCap: true });
    expect(isSetsGameComplete(score(30, 29), setWinRule(rules))).toBe(false);
    expect(serveAfterPoint(rules, { score: score(1, 0), servingTeam: 1, winner: 1 })).toBe(2);
    expect(firstServerForSet(rules, 1, [score(21, 15, true)], 2)).toBe(2);
  });

  it('preserves old quick cap/winner-serve, and untracked table tennis service', () => {
    const rules = rulesFor('badminton', {}, { legacy: true });
    expect(isSetsGameComplete(score(30, 29), setWinRule(rules))).toBe(true);
    expect(serveAfterPoint(rules, { score: score(1, 0), servingTeam: 2, winner: 1 })).toBe(1);
    expect(rulesFor('tabletennis', {}, { legacy: true }).serviceMode).toBe('manual');
  });
});
