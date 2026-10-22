import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createGameSession, createHistoryRecord, createParticipant } from '../../models/types';
import { loadHistory, loadSessions, saveHistory, saveSession } from '../../utils/universalStorage';
import { loadData, saveQuickMatch, saveSportTournament } from '../../utils/storage';
import { loadAppEntryState } from '../../utils/appEntry';
import MonoHistory from './MonoHistory';
import DashboardLanding from './landing/DashboardLanding';

vi.mock('convex/react', () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ cloudAuthAvailable: false, isAuthenticated: false }) }));

function session(templateId = 'preset_volleyball') {
  const participant = createParticipant({ name: 'North' });
  const saved = createGameSession({ templateId, templateName: 'Volleyball', name: 'Factory seven', participants: [participant] });
  saved.scores[participant.id].total = 7;
  return saved;
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps a factory-made seven-point volleyball session on Home and in app entry', () => {
  const saved = session();
  expect(saved).not.toHaveProperty('sport');
  expect(saveSession(saved)).toBe(true);
  expect(loadSessions()).toEqual([saved]);
  expect(loadAppEntryState().returningPlayerState).toBe(true);
  render(<MemoryRouter><DashboardLanding /></MemoryRouter>);
  expect(screen.getByText('Factory seven')).toBeInTheDocument();
  expect(screen.getAllByText('7').length).toBeGreaterThan(0);
});

it('keeps a factory-made volleyball history record and its seven-point score in History', () => {
  const record = createHistoryRecord(session());
  expect(record).not.toHaveProperty('sport');
  expect(saveHistory(record)).toBe(true);
  expect(loadHistory()).toEqual([record]);
  render(<MemoryRouter><MonoHistory /></MemoryRouter>);
  expect(screen.getByText('Factory seven')).toBeInTheDocument();
  expect(screen.getAllByText('7').length).toBeGreaterThan(0);
});

it.each(['preset_custom', 'my-personal-template', undefined])('keeps sportless factory records with template %s', (templateId) => {
  const saved = session();
  saved.templateId = templateId;
  saveSession(saved);
  const record = createHistoryRecord(saved);
  saveHistory(record);
  expect(loadSessions()).toEqual([saved]);
  expect(loadHistory()).toEqual([record]);
});

it('ignores a known unregistered preset but does not guess from an unknown template id', () => {
  const unsupported = session('preset_chess');
  const unknown = session('preset_personal');
  localStorage.setItem('gs_sessions', JSON.stringify([unsupported, null, 'broken', unknown]));
  expect(loadSessions()).toEqual([unknown]);
});

it('allows collection saves to drop retired rows previously ignored on read', () => {
  const ignored = { id: 'old', sport: 'pickleball', status: 'completed' };
  localStorage.setItem('se_quickmatches', JSON.stringify([ignored]));
  saveQuickMatch({ id: 'new', sport: 'football', score1: 1, score2: 0, winner: 'A' });
  expect(JSON.parse(localStorage.getItem('se_quickmatches')).map(row => row.id)).toEqual(['new']);
  localStorage.setItem('se_volleyball', JSON.stringify([ignored]));
  saveSportTournament('se_volleyball', { id: 'cup', teams: [], matches: [] });
  expect(JSON.parse(localStorage.getItem('se_volleyball')).map(row => row.id)).toEqual(['cup']);
  localStorage.setItem('gs_sessions', JSON.stringify([ignored]));
  const saved = session();
  saveSession(saved);
  expect(loadData('gs_sessions')).toEqual([saved]);
  expect(JSON.parse(localStorage.getItem('gs_sessions'))).toEqual([saved]);
});
