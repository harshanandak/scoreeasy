import { describe, expect, it } from 'vitest';
import { getSportsList } from '../../../models/sportRegistry';
import { buildDemo, DEMO_SPORT_IDS } from './landingDemo';

describe('landing demo', () => {
  it('has an engine-derived example for every registered sport', () => {
    expect(DEMO_SPORT_IDS).toEqual(getSportsList().map((sport) => sport.id));
    for (const id of DEMO_SPORT_IDS) {
      const demo = buildDemo(id);
      expect(demo.sportId).toBe(id);
      expect(demo.teams).toHaveLength(2);
      expect(demo.colours).toHaveLength(2);
      expect(demo.status).toBeTruthy();
      for (const team of demo.teams) {
        expect(team.name).toBeTruthy();
        expect(team.score).toBeTruthy();
      }
    }
  });

  it('reads volleyball from the sets engine: set 3 of 5, 1-1 in sets, 18-16 in the set', () => {
    const demo = buildDemo('volleyball');
    expect(demo.status).toBe('Set 3 of 5');
    expect(demo.teams.map((team) => team.score)).toEqual(['18', '16']);
    expect(demo.teams.map((team) => team.meta)).toEqual(['Sets won 1', 'Sets won 1']);
  });

  it('uses the Game label for badminton', () => {
    const demo = buildDemo('badminton');
    expect(demo.status).toBe('Game 2 of 3');
    expect(demo.teams.map((team) => team.score)).toEqual(['15', '12']);
  });

  it('reads tennis as 30-15 in game five of set two, after a 6-3 first set', () => {
    const demo = buildDemo('tennis');
    expect(demo.status).toBe('Set 2 · best of 3');
    expect(demo.teams.map((team) => team.score)).toEqual(['30', '15']);
    expect(demo.teams.map((team) => team.meta)).toEqual(['6 · 3', '3 · 2']);
  });

  it('sums football goals from the goals engine and names the half', () => {
    const demo = buildDemo('football');
    expect(demo.teams.map((team) => team.score)).toEqual(['2', '1']);
    expect(demo.status).toMatch(/2nd half$/);
  });

  it('sums basketball baskets to the scripted totals', () => {
    const demo = buildDemo('basketball');
    expect(demo.teams.map((team) => team.score)).toEqual(['78', '72']);
    expect(demo.status).toBe('Q3 of 4');
  });

  it("plays hockey in the registry's four field-hockey quarters", () => {
    const demo = buildDemo('hockey');
    expect(demo.teams.map((team) => team.score)).toEqual(['3', '2']);
    expect(demo.status).toMatch(/^Q[1-4] of 4 · \d+'$/);
  });

  it("reads cricket as a chase: India's full 20 overs, Australia 5.3 overs in, from the innings engine", () => {
    const demo = buildDemo('cricket');
    expect(demo.teams[0].score).toMatch(/^\d+\/\d+$/);
    expect(demo.teams[0].meta).toBe('20 overs');
    expect(demo.teams[1].score).toMatch(/^\d+\/2$/);
    expect(demo.teams[1].meta).toBe('5.3 overs');
    expect(demo.live).toBe(1);
    expect(demo.liveLabel).toBe('Batting');
    // The chase line comes from deriveChase: the target is India's total + 1 and 120 - 33 balls are left.
    const [indiaRuns] = demo.teams[0].score.split('/').map(Number);
    const [australiaRuns] = demo.teams[1].score.split('/').map(Number);
    expect(demo.foot).toContain(`need ${indiaRuns + 1 - australiaRuns} off 87 balls`);
  });

  it('gives every side the same cells as there are columns', () => {
    for (const id of DEMO_SPORT_IDS) {
      const demo = buildDemo(id);
      if (demo.kind === 'cricket') continue;
      for (const team of demo.teams) expect(team.cells).toHaveLength(demo.columns.length);
    }
  });

  it('shows the finished sets with their winner, and the server the engine reports', () => {
    const volleyball = buildDemo('volleyball');
    expect(volleyball.columns).toEqual(['S1', 'S2']);
    expect(volleyball.teams[0].cells).toEqual([{ value: '25', won: true }, { value: '23', won: false }]);
    expect(volleyball.teams[1].cells).toEqual([{ value: '21', won: false }, { value: '25', won: true }]);
    expect(volleyball.live).toBe(0);
    expect(buildDemo('badminton').columns).toEqual(['G1']);
    expect(buildDemo('badminton').live).toBe(0);
    expect(buildDemo('tabletennis').live).toBeUndefined();

    const tennis = buildDemo('tennis');
    expect(tennis.columns).toEqual(['S1', 'S2']);
    expect(tennis.teams[0].cells).toEqual([{ value: '6', won: true }, { value: '3', current: true }]);
    expect(tennis.live).toBeDefined();
  });

  it('breaks goal sports into the line score up to the period in play', () => {
    const basketball = buildDemo('basketball');
    expect(basketball.columns).toEqual(['Q1', 'Q2', 'Q3']);
    for (const team of basketball.teams) {
      expect(team.cells.reduce((sum, cell) => sum + Number(cell.value), 0)).toBe(Number(team.score));
    }
    expect(buildDemo('football').columns).toEqual(['1H', '2H']);
  });

  it('totals kabaddi from the raid engine, with both sides on the mat', () => {
    const demo = buildDemo('kabaddi');
    expect(demo.teams.every((team) => Number.isInteger(Number(team.score)))).toBe(true);
    expect(demo.status).toMatch(/^Half 1 · raid 12$/);
    // The category cells add up to the total, and each side shows one pip per player.
    for (const team of demo.teams) {
      expect(team.cells.reduce((sum, cell) => sum + Number(cell.value), 0)).toBe(Number(team.score));
      expect(team.pips.total).toBe(7);
    }
    expect([0, 1]).toContain(demo.live);
  });

  it('rejects a sport with no demo', () => {
    expect(() => buildDemo('curling')).toThrow('No landing demo');
  });
});
