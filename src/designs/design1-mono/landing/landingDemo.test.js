import { describe, expect, it } from 'vitest';
import { getSportsList } from '../../../models/sportRegistry';
import { buildDemo, DEMO_SPORT_IDS } from './landingDemo';

const scores = (demo) => demo.teams.map((team) => team.score);

describe('landing demo', () => {
  it('has an engine-derived example for every registered sport, with two sides and one context line', () => {
    expect(DEMO_SPORT_IDS).toEqual(getSportsList().map((sport) => sport.id));
    expect(DEMO_SPORT_IDS).toHaveLength(9);
    for (const id of DEMO_SPORT_IDS) {
      const demo = buildDemo(id);
      expect(demo.sportId).toBe(id);
      expect(demo.teams).toHaveLength(2);
      expect(demo.colours).toHaveLength(2);
      expect(demo.context).toBeTruthy();
      expect(demo.context).not.toMatch(/\n/);
      for (const team of demo.teams) {
        expect(team.name).toBeTruthy();
        expect(team.score).toMatch(/^\d+$/);
      }
    }
  });

  it('reads volleyball from the sets engine: set 3 of 5, 1-1 in sets, 18-16 in the set', () => {
    const demo = buildDemo('volleyball');
    expect(demo.context).toBe('Set 3 of 5 · sets 1-1');
    expect(scores(demo)).toEqual(['18', '16']);
  });

  it('uses the Game label for badminton', () => {
    const demo = buildDemo('badminton');
    expect(demo.context).toBe('Game 2 of 3 · games 1-0');
    expect(scores(demo)).toEqual(['15', '12']);
  });

  it('counts table tennis from the sets engine: set 3 of 5, 1-1 in sets, 8-6 in the set', () => {
    const demo = buildDemo('tabletennis');
    expect(demo.context).toBe('Set 3 of 5 · sets 1-1');
    expect(scores(demo)).toEqual(['8', '6']);
  });

  it('reads tennis as 30-15 at 3-2 in set two', () => {
    const demo = buildDemo('tennis');
    expect(demo.context).toBe('Set 2 · games 3-2');
    expect(scores(demo)).toEqual(['30', '15']);
  });

  it("sums football goals from the goals engine and gives the minute and half-time score", () => {
    const demo = buildDemo('football');
    expect(scores(demo)).toEqual(['2', '1']);
    expect(demo.context).toBe("63' · HT 1-0");
  });

  it('sums basketball baskets to the scripted totals, with the half-time score from the line score', () => {
    const demo = buildDemo('basketball');
    expect(scores(demo)).toEqual(['78', '72']);
    expect(demo.context).toMatch(/^Q3 of 4 · HT \d+-\d+$/);
    const [htA, htB] = demo.context.match(/HT (\d+)-(\d+)/).slice(1).map(Number);
    expect(htA).toBeGreaterThan(0);
    expect(htA).toBeLessThan(78);
    expect(htB).toBeGreaterThan(0);
    expect(htB).toBeLessThan(72);
  });

  it("plays hockey in the registry's four field-hockey quarters", () => {
    const demo = buildDemo('hockey');
    expect(scores(demo)).toEqual(['3', '2']);
    expect(demo.context).toMatch(/^Q[1-4] of 4 · HT \d+-\d+$/);
    const [htA, htB] = demo.context.match(/HT (\d+)-(\d+)/).slice(1).map(Number);
    expect(htA).toBeLessThanOrEqual(3);
    expect(htB).toBeLessThanOrEqual(2);
  });

  it("reads cricket as a chase: India's full 20 overs, Australia 5.3 overs in, from the innings engine", () => {
    const demo = buildDemo('cricket');
    expect(demo.teams.map((team) => team.name)).toEqual(['India', 'Australia']);
    expect(demo.teams.map((team) => team.suffix)).toEqual([expect.stringMatching(/^\/\d+$/), '/2']);
    // The chase line comes from deriveChase: the target is India's total + 1 and 120 - 33 balls are left.
    const [indiaRuns, australiaRuns] = scores(demo).map(Number);
    expect(demo.context).toBe(`Australia need ${indiaRuns + 1 - australiaRuns} off 87 balls`);
  });

  it('only cricket carries a suffix on the big number', () => {
    for (const id of DEMO_SPORT_IDS) {
      for (const team of buildDemo(id).teams) {
        if (id === 'cricket') expect(team.suffix).toBeDefined();
        else expect(team.suffix).toBeUndefined();
      }
    }
  });

  it('totals kabaddi from the raid engine and names the side that raids next', () => {
    const demo = buildDemo('kabaddi');
    expect(demo.teams.map((team) => team.name)).toEqual(['Tigers', 'Bulls']);
    expect(demo.teams.every((team) => Number.isInteger(Number(team.score)))).toBe(true);
    expect(demo.context).toMatch(/^Half 1 · (Tigers|Bulls) raid next$/);
  });

  it('rejects a sport with no demo', () => {
    expect(() => buildDemo('curling')).toThrow('No landing demo');
  });
});
