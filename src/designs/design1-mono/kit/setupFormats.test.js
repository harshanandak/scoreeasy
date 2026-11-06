import { describe, expect, it } from 'vitest';
import { getSportById } from '../../../models/sportRegistry';
import { applyStandardDefaults } from '../../../utils/sportDefaults';
import { buildCricketFormat } from '../../../utils/cricketCalculations';
import { getSetWinRule } from '../../../utils/quickMatchSets';
import {
  applyFormatChoice,
  applyGoalsDetail,
  formatChoices,
  goalsDetail,
  selectedFormatChoice,
  setPointPresets,
  setupRulesLine,
} from './setupFormats';

const sport = (id) => getSportById(id);
const labels = (id) => formatChoices(sport(id)).choices.map((c) => c.label);

describe('quick setup format choices, per sport', () => {
  it('offers each sport its own formats', () => {
    expect(labels('volleyball')).toEqual(['Single set', 'Best of 3', 'Best of 5']);
    expect(labels('badminton')).toEqual(['Single game', 'Best of 3']);
    expect(labels('tabletennis')).toEqual(['Single game', 'Best of 5', 'Best of 7']);
    expect(labels('tennis')).toEqual(['Single set', 'Best of 3', 'Best of 5']);
    expect(labels('cricket')).toEqual(['T20', 'T10', 'ODI', 'Test', 'Gully', 'Custom']);
    for (const id of ['football', 'basketball', 'hockey']) {
      expect(labels(id)).toEqual(['Timed', 'First to', 'Free play']);
    }
    // Kabaddi plays the club raid engine: halves only, picked under one club format.
    expect(labels('kabaddi')).toEqual(['Club standard']);
    expect(goalsDetail(sport('kabaddi'), { mode: 'timed', timeLimit: 2400 })).toMatchObject({ label: 'Halves', selected: 'time-2400' });
    expect(goalsDetail(sport('kabaddi'), { mode: 'timed' }).options.map((o) => o.label)).toEqual(['2 × 10 min', '2 × 15 min', '2 × 20 min']);
    expect(setupRulesLine(sport('kabaddi'), { mode: 'timed', timeLimit: 2400 })).toBe('2 × 20 min halves · 7 a side · draws allowed');
  });

  it('starts every sport on its standard format', () => {
    expect(selectedFormatChoice(sport('volleyball'), applyStandardDefaults('volleyball'))).toBe('sets-3');
    expect(selectedFormatChoice(sport('tabletennis'), applyStandardDefaults('tabletennis'))).toBe('sets-5');
    expect(selectedFormatChoice(sport('football'), applyStandardDefaults('football'))).toBe('timed');
    expect(selectedFormatChoice(sport('cricket'), buildCricketFormat('T20'), 'T20')).toBe('T20');
  });

  it('switches sets formats and keeps the sport rules the scorer plays to', () => {
    const vb = sport('volleyball');
    const bo3 = applyStandardDefaults('volleyball');
    const bo5 = applyFormatChoice(vb, 'sets-5', bo3);
    expect(bo5).toMatchObject({ type: 'best-of', sets: 5, points: 25, customization: { pointCap: 27, winBy: 2 } });
    expect(getSetWinRule({ format: bo5, sportConfig: vb, currentSet: 4 }).target).toBe(15);

    const single = applyFormatChoice(vb, 'sets-1', bo5);
    expect(single).toMatchObject({ type: 'single', sets: 1, target: 25 });
    expect(selectedFormatChoice(vb, single)).toBe('sets-1');

    const back = applyFormatChoice(vb, 'sets-3', { ...single, target: 15 });
    expect(back).toMatchObject({ type: 'best-of', sets: 3, points: 25 });
    expect(back).not.toHaveProperty('target');
  });

  it('gives tennis the set count its scorer reads', () => {
    const t = applyFormatChoice(sport('tennis'), 'sets-5', applyStandardDefaults('tennis'));
    expect(t.sets).toBe(5);
    expect(applyFormatChoice(sport('tennis'), 'sets-1', t).sets).toBe(1);
  });

  it('switches goals modes and their detail row', () => {
    const fb = sport('football');
    const timed = applyStandardDefaults('football');
    expect(goalsDetail(fb, timed)).toMatchObject({ label: 'Match length', selected: 'time-5400' });
    const half = applyGoalsDetail(timed, 'time-2700');
    expect(half).toMatchObject({ mode: 'timed', timeLimit: 2700 });

    const points = applyFormatChoice(fb, 'points', half);
    expect(points).toMatchObject({ mode: 'points', target: 3 });
    expect(goalsDetail(fb, points).options.map((o) => o.label)).toEqual(['3 goals', '5 goals', '7 goals', '10 goals']);
    expect(applyGoalsDetail(points, 'pts-7')).toMatchObject({ mode: 'points', target: 7 });

    const free = applyFormatChoice(fb, 'free', points);
    expect(free.mode).toBe('free');
    expect(goalsDetail(fb, free)).toBeNull();
    expect(applyFormatChoice(fb, 'timed', free)).toMatchObject({ mode: 'timed', timeLimit: 5400 });
  });

  it('offers the points editor only where the scorer reads points', () => {
    expect(setPointPresets(sport('volleyball'))).toEqual([10, 15, 21, 25]);
    expect(setPointPresets(sport('badminton'))).toEqual([11, 15, 21]);
    expect(setPointPresets(sport('football'))).toEqual([]);
  });
});

describe('quick setup rules line', () => {
  it('states the sets rules the board will play to', () => {
    const vb = sport('volleyball');
    expect(setupRulesLine(vb, applyStandardDefaults('volleyball'))).toBe('25 points a set · win by 2 · decider to 15 · cap 27');
    expect(setupRulesLine(vb, { type: 'single', sets: 1, target: 21 })).toBe('First to 21 · win by 2');
    expect(setupRulesLine(sport('badminton'), applyStandardDefaults('badminton'))).toBe('21 points a game · win by 2 · cap 30');
    expect(setupRulesLine(sport('tennis'), applyStandardDefaults('tennis'))).toBe('6 games a set · tiebreak at 6–6');
  });

  it('states cricket length, players and innings', () => {
    const c = sport('cricket');
    expect(setupRulesLine(c, buildCricketFormat('T20'))).toBe('20 overs · 11 players · 1 innings each');
    expect(setupRulesLine(c, buildCricketFormat('test'))).toBe('Unlimited overs · 11 players · 2 innings each');
    expect(setupRulesLine(c, buildCricketFormat('gully'))).toBe('5 overs · 6 players · 1 innings each · bat only');
    expect(setupRulesLine(c, { ...buildCricketFormat('custom'), trackOvers: false, overs: null, maxBalls: 30 })).toMatch(/^30 balls/);
  });

  it('states goals mode and draws', () => {
    expect(setupRulesLine(sport('football'), applyStandardDefaults('football'))).toBe('90 min on the clock · draws allowed');
    expect(setupRulesLine(sport('basketball'), applyStandardDefaults('basketball'))).toBe('48 min on the clock · no draws');
    expect(setupRulesLine(sport('hockey'), { mode: 'points', target: 5 })).toBe('First to 5 goals wins');
    expect(setupRulesLine(sport('kabaddi'), { mode: 'free' })).toBe('No limit · finish when you are done');
  });
});
