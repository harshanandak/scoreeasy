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

  it('reads cricket runs, wickets and overs from the innings engine', () => {
    const demo = buildDemo('cricket');
    expect(demo.teams[0].score).toMatch(/^\d+\/2$/);
    expect(demo.teams[0].meta).toBe('5.3 overs');
    expect(demo.teams[1].meta).toBe('To bat');
  });

  it('totals kabaddi from the raid engine, with both sides on the mat', () => {
    const demo = buildDemo('kabaddi');
    expect(demo.teams.every((team) => Number.isInteger(Number(team.score)))).toBe(true);
    expect(demo.status).toMatch(/^Half 1 · raid 12$/);
  });

  it('rejects a sport with no demo', () => {
    expect(() => buildDemo('curling')).toThrow('No landing demo');
  });
});
