import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadAppRoutes } from '../../test/preloadAppRoutes';
import { deriveTeamColours } from '../../lib/teamColour';
import Design1Mono from './index';

// Kit S1 round 2: Home's Rematch keeps the colours the hero shows. A real handoff through the app
// shell and real storage: finish yellow v green, open Home, tap Rematch, and the setup and the
// started board are yellow v green (not the red v blue default).

await preloadAppRoutes();

const authState = vi.hoisted(() => ({ current: null }));

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(() => Promise.resolve(null)),
  useQuery: () => [],
  usePaginatedQuery: () => ({ results: [], status: 'Exhausted', loadMore: vi.fn() }),
  useConvexConnectionState: () => ({ isWebSocketConnected: true, hasEverConnected: true, connectionRetries: 0 }),
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => authState.current }));
vi.mock('@clerk/clerk-react', () => ({ SignIn: () => <div>Sign in form</div> }));
vi.mock('./utils/confetti', () => ({ triggerConfetti: vi.fn() }));

const YELLOW = '#facc15';
const GREEN = '#16a34a';

function RouteProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteProbe />
      <Design1Mono />
    </MemoryRouter>,
  );
}

async function settleRoute() {
  await waitFor(() => {
    expect(document.querySelector('.route-skeleton')).toBeNull();
    expect(document.querySelector('main')?.textContent?.trim()).toBeTruthy();
  });
  await act(async () => {});
}

const checkedSwatch = (group) => within(screen.getByRole('group', { name: group })).getByRole('button', { pressed: true });

describe('Home Rematch keeps the saved team colours', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    authState.current = {
      authMode: 'local', cloudAuthAvailable: false, isAuthenticated: false, isLoading: false, needsOnboarding: false, user: null,
    };
  });

  afterEach(() => globalThis.localStorage.clear());

  it('finishes yellow v green, then Rematch sets up and starts yellow v green', async () => {
    globalThis.localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
      sport: 'volleyball', phase: 'scoring', team1Name: 'Royals', team2Name: 'Strikers',
      team1Color: YELLOW, team2Color: GREEN, format: { type: 'best-of', sets: 3, target: 25, winBy: 2 },
      sets: [{ score1: 0, score2: 0, completed: false }], currentSet: 0, updatedAt: new Date().toISOString(),
    }));

    // 1. Score and finish the yellow v green match in the real scorer.
    const scorer = renderApp('/volleyball/quick');
    await settleRoute();
    const royals = await screen.findByRole('button', { name: 'Add point for Royals' });
    fireEvent.click(royals);
    await waitFor(() => expect(royals).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'End match' }));
    await waitFor(() => {
      const saved = JSON.parse(globalThis.localStorage.getItem('se_quickmatches') || '[]');
      expect(saved[0]).toMatchObject({ team1: 'Royals', team2: 'Strikers', team1Color: YELLOW, team2Color: GREEN });
    });
    scorer.unmount();

    // 2. Home shows that match in yellow v green; Rematch hands the pair to quick setup.
    renderApp('/app');
    await settleRoute();
    const expected = deriveTeamColours(YELLOW, GREEN);
    expect(document.querySelector('.kit-last').style.getPropertyValue('--team-a-line')).toBe(expected.A.line);
    fireEvent.click(screen.getByRole('button', { name: 'Rematch: Royals vs Strikers' }));
    await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick'));
    await settleRoute();

    // 3. The setup pickers hold yellow v green ...
    expect(await screen.findByRole('group', { name: 'Team A colour' })).toBeInTheDocument();
    expect(checkedSwatch('Team A colour')).toHaveAccessibleName('Yellow');
    expect(checkedSwatch('Team B colour')).toHaveAccessibleName('Green');
    expect(screen.getByLabelText('Team A name')).toHaveValue('Royals');

    // ... and the match that starts is painted yellow v green.
    fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));
    await screen.findByRole('button', { name: 'Add point for Royals' });
    const board = document.querySelector('[data-team-board]');
    expect(board.style.getPropertyValue('--team-a-core')).toBe(expected.A.core);
    expect(board.style.getPropertyValue('--team-b-core')).toBe(expected.B.core);
  });

  it('keeps the default pair for an older record saved without colours', async () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([{
      id: 'old-1', sport: 'volleyball', team1: 'Royals', team2: 'Strikers', score1: 2, score2: 0, winner: 'Royals',
      status: 'completed', date: new Date().toISOString(),
    }]));
    renderApp('/app');
    await settleRoute();
    fireEvent.click(screen.getByRole('button', { name: 'Rematch: Royals vs Strikers' }));
    await settleRoute();
    await screen.findByRole('group', { name: 'Team A colour' });
    expect(checkedSwatch('Team A colour')).toHaveAccessibleName('Red');
    expect(checkedSwatch('Team B colour')).toHaveAccessibleName('Blue');
  });
});
