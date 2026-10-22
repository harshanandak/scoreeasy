import { beforeEach, expect, it, vi } from 'vitest';
import * as storage from './storage';
import { createGameSession, createHistoryRecord, createParticipant } from '../models/types';
import { getSportsList } from '../models/sportRegistry';

const removed = ['pickleball', 'squash', 'rugby', 'futsal', 'handball'];
// Master has no purge API: its counterfactual must fail on retained data.
const purge = () => storage.purgeRetiredSportData?.();
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

it('purges removed sport keys and explicitly tagged rows, preserving factory and registered records', () => {
  const participant = createParticipant({ name: 'North' });
  const session = createGameSession({ templateId: 'preset_volleyball', participants: [participant] });
  session.scores[participant.id].total = 7;
  const history = createHistoryRecord(session);
  const kept = [session, history, ...getSportsList().map(({ id }) => ({ id, sport: id })),
    {}, null, 'malformed', { templateId: 'preset_custom' }];
  const deleted = removed.map(sport => ({ id: sport, sport }));
  for (const sport of removed) {
    localStorage.setItem(`se_${sport}`, '[{}]');
    localStorage.setItem(`se_quickmatch_draft_${sport}`, '{}');
    localStorage.setItem(`gamescore_${sport}`, '[{}]');
    localStorage.setItem(`gamescore_quickmatch_draft_${sport}`, '{}');
  }
  for (const key of ['se_quickmatches', 'gamescore_quickmatches', 'gs_sessions', 'gs_history', 'gs_templates']) {
    localStorage.setItem(key, JSON.stringify([...deleted, ...kept]));
  }
  localStorage.setItem('se_volleyball', JSON.stringify([session]));
  purge();
  for (const sport of removed) {
    expect(localStorage.getItem(`se_${sport}`)).toBeNull();
    expect(localStorage.getItem(`se_quickmatch_draft_${sport}`)).toBeNull();
    expect(localStorage.getItem(`gamescore_${sport}`)).toBeNull();
    expect(localStorage.getItem(`gamescore_quickmatch_draft_${sport}`)).toBeNull();
  }
  for (const key of ['se_quickmatches', 'gamescore_quickmatches', 'gs_sessions', 'gs_history', 'gs_templates']) {
    expect(JSON.parse(localStorage.getItem(key))).toEqual(kept);
  }
  expect(JSON.parse(localStorage.getItem('se_volleyball'))).toEqual([session]);
});

it('runs once behind the version flag', () => {
  purge();
  expect(localStorage.getItem('se_retired_purge_v1')).toBe('1');
  localStorage.setItem('se_rugby', '[{}]');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  purge();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(localStorage.getItem('se_rugby')).toBe('[{}]');
});
