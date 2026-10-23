import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { deriveTeamColours } from '../../lib/teamColour';
import { readFileSync } from 'node:fs';

const state = vi.hoisted(() => ({ draft: null, saved: null }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: 'cricket' }),
  useLocation: () => ({ pathname: '/cricket/quick', search: '' }),
  useSearchParams: () => [new URLSearchParams('resume=3003'), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ point: vi.fn(), undo: vi.fn(), finalize: vi.fn(), reset: vi.fn(), isLive: false }) }));
vi.mock('../../lib/live/liveSession', () => ({ getConsent: () => 'declined', setConsent: vi.fn(), loadSession: () => null, saveSession: vi.fn() }));
vi.mock('../../utils/storage', () => ({
  loadData: (key, fallback) => key === 'se_quickmatch_draft_cricket_3003' ? state.draft : fallback,
  loadQuickMatch: () => null, saveQuickMatch: () => true, clearData: vi.fn(),
  isStaleQuickMatchDraft: () => false,
  saveData: (key, value) => { if (key === 'se_quickmatch_draft_cricket_3003') state.saved = structuredClone(value); return true; },
}));

const { default: MonoQuickMatch } = await import('./MonoQuickMatch');

it('fits the six primary run keys in one row without the legacy viewport-sized rows', async () => {
  const style = document.createElement('style');
  style.textContent = readFileSync(`${import.meta.dirname}/scoring/cricketBoard.css`, 'utf8');
  document.head.append(style);
  try {
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Four runs' });
    const grid = document.querySelector('.mono-cricket-keys');
    expect(grid.children).toHaveLength(6);
    expect(getComputedStyle(grid).gridTemplateColumns).toBe('repeat(6,minmax(0,1fr))');
    expect(getComputedStyle(grid).gridAutoRows).toBe('auto');
  } finally {
    style.remove();
  }
});

beforeEach(() => {
  state.saved = null;
  state.draft = {
    phase: 'scoring', sport: 'cricket', quickMatchId: 3003,
    team1Name: 'Lions', team2Name: 'Tigers', team1Color: '#2563eb', team2Color: '#fbbf24',
    format: { preset: 'custom', overs: 20, players: 11, totalInnings: 2, trackOvers: true, freeHit: true },
    innings: 1, battingTeam: 1, cricketHistory: [],
    scores: { team1: { runs: 0, balls: 0, wickets: 0 }, team2: { runs: 0, balls: 0, wickets: 0 } },
  };
});

it('restores picked cricket colours, saves the same score, refreshes, and undoes from the thumb bar', async () => {
  const first = render(<MonoQuickMatch />);
  fireEvent.click(await screen.findByRole('button', { name: 'Four runs' }));
  await waitFor(() => expect(state.saved?.scores.team1.runs).toBe(4));
  const colours = deriveTeamColours('#2563eb', '#fbbf24');
  const board = () => document.querySelector('[data-cricket-board]');
  expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
  expect(board().style.getPropertyValue('--team-b-core')).toBe(colours.B.core);
  expect(state.saved).toMatchObject({ team1Color: '#2563eb', team2Color: '#fbbf24' });
  state.draft = state.saved;
  first.unmount();
  render(<MonoQuickMatch />);
  await screen.findByRole('button', { name: 'Four runs' });
  expect(document.querySelector('.mono-scorer-score-value')).toHaveTextContent('4/0');
  expect(board().style.getPropertyValue('--team-a-core')).toBe(colours.A.core);
  expect(screen.getByRole('button', { name: 'Undo last action' })).toHaveTextContent('Back to 0.0');
  fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
  await waitFor(() => expect(state.saved.scores.team1.runs).toBe(0));
  expect(screen.getByRole('button', { name: 'Undo last action' })).toBeDisabled();
});
