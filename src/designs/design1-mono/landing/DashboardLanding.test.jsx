import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardLanding, { relativeDay, scorePair } from './DashboardLanding';
import { deriveTeamColours } from '../../../lib/teamColour';

let authState;

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>
      <output aria-label="Route state">{JSON.stringify(location.state ?? null)}</output>
    </>
  );
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <LocationProbe />
      <Routes>
        <Route path="/app" element={<DashboardLanding />} />
        <Route path="/:sport/tournament/:id" element={<p>Tournament</p>} />
        <Route path="/:sport/quick" element={<p>Quick match</p>} />
        <Route path="/play" element={<p>Play hub</p>} />
        <Route path="/history" element={<p>History</p>} />
        <Route path="/login" element={<p>Account entry</p>} />
        <Route path="/profile" element={<p>Profile</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const day = 864e5;
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const volleyball = {
  id: 'vb-1', sport: 'volleyball', team1: 'Royals', team2: 'Strikers', score1: 3, score2: 1, winner: 'Royals',
  status: 'completed', team1Color: '#d62828', team2Color: '#1d4ed8', date: iso(day), completedAt: iso(day),
  sets: [
    { score1: 25, score2: 21, completed: true }, { score1: 22, score2: 25, completed: true },
    { score1: 25, score2: 19, completed: true }, { score1: 25, score2: 23, completed: true },
  ],
};
const kabaddi = { id: 'kb-1', sport: 'kabaddi', team1: 'Bulls', team2: 'Panthers', score1: 38, score2: 31, winner: 'Bulls', date: iso(3 * day) };
const football = { id: 'fb-1', sport: 'football', team1: 'City', team2: 'United', score1: 2, score2: 2, winner: 'Draw', date: iso(4 * day) };
const seed = (matches) => globalThis.localStorage.setItem('se_quickmatches', JSON.stringify(matches));

describe('DashboardLanding (Kit Home)', () => {
  beforeEach(() => {
    authState = {
      cloudAuthAvailable: true,
      isAuthenticated: false,
      isLoading: false,
      needsOnboarding: false,
      user: null,
    };
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback?.(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  describe('first run (zero saved data)', () => {
    it('shows the play-your-first-match hero with one Go and the hand-drawn arrow at it', () => {
      const { container } = renderDashboard();

      expect(screen.getByRole('heading', { level: 1, name: 'Welcome.' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Play your first match.' })).toBeInTheDocument();
      expect(container.querySelectorAll('.se-go')).toHaveLength(1);
      const go = screen.getByRole('button', { name: 'Play your first match' });
      expect(go).toHaveClass('se-go');
      // The coach-mark arrow sits beside that Go, inside the same hero, and is decorative.
      const arrow = container.querySelector('.kit-coach-arrow');
      expect(arrow).not.toBeNull();
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(arrow.parentElement).toBe(go.parentElement);
      expect(screen.getByText('Play a match')).toBeInTheDocument();
      expect(screen.getByText('Your matches will appear here')).toBeInTheDocument();
    });

    it('sends the first-run Go to the play hub', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: 'Play your first match' }));
      await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/play'));
    });

    it('offers the first sports in focus order as quick-start tiles', async () => {
      renderDashboard();
      const tiles = within(screen.getByRole('region', { name: 'Quick start' })).getAllByRole('button');
      expect(tiles.map((tile) => tile.dataset.sport)).toEqual(['cricket', 'kabaddi', 'volleyball']);
      fireEvent.click(tiles[0]);
      await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/cricket/quick'));
    });

    it('never shows the arrow once anything has been scored', () => {
      seed([kabaddi]);
      const { container } = renderDashboard();
      expect(container.querySelector('.kit-coach-arrow')).toBeNull();
    });
  });

  describe('returning scorer', () => {
    it('shows the last match as a compact card with team colour accents, and Rematch is the only Go', () => {
      seed([volleyball, kabaddi]);
      const { container } = renderDashboard();

      expect(screen.getByRole('heading', { name: 'Last match' })).toBeInTheDocument();
      const card = container.querySelector('.kit-last');
      // Meta line: the sport chip and the day.
      expect(card.querySelector('.kit-last-meta')).toHaveTextContent('Volleyball');
      expect(card.querySelector('.kit-last-meta')).toHaveTextContent('Yesterday');
      // Team identity is the engine's line colour on a slim bar beside each name.
      const { A, B } = deriveTeamColours('#d62828', '#1d4ed8');
      expect(card.style.getPropertyValue('--team-a-line')).toBe(A.line);
      expect(card.style.getPropertyValue('--team-b-line')).toBe(B.line);
      expect(card.querySelectorAll('.kit-last-bar')).toHaveLength(2);
      // Names and scores are ink on the card surface; the winner is bold.
      expect(within(card).getByRole('group', { name: 'Royals 3, Strikers 1. Royals won' })).toBeInTheDocument();
      expect(card.querySelector('.kit-last-team.is-winner')).toHaveTextContent('Royals3');
      expect(card.querySelectorAll('.kit-last-team.is-winner')).toHaveLength(1);
      expect(card.querySelector('.kit-last-detail')).toHaveTextContent('Sets 25–21 · 22–25 · 25–19 · 25–23');
      // No full-bleed team gradient any more.
      expect(container.querySelector('.kit-half, .kit-hero-teams')).toBeNull();

      const gos = container.querySelectorAll('.se-go');
      expect(gos).toHaveLength(1);
      expect(gos[0]).toHaveAccessibleName('Rematch: Royals vs Strikers');
      expect(gos[0]).toHaveClass('kit-go-compact');
      expect(within(card).getByRole('button', { name: 'Last match details' })).toHaveClass('se-ctl');
    });

    it('falls back to the engine default pair for records saved without colours', () => {
      seed([kabaddi]);
      const { container } = renderDashboard();
      const { A, B } = deriveTeamColours();
      const card = container.querySelector('.kit-last');
      expect(card.style.getPropertyValue('--team-a-line')).toBe(A.line);
      expect(card.style.getPropertyValue('--team-b-line')).toBe(B.line);
    });

    it('rematches with the same teams and colours into quick setup', async () => {
      seed([volleyball]);
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /Rematch:/ }));
      await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/quick'));
      expect(JSON.parse(screen.getByLabelText('Route state').textContent))
        .toEqual({ teams: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] });
    });

    it('keeps a sportless stored match without offering an invalid rematch path', () => {
      seed([{ id: 'recent-1', team1: 'A', team2: 'B' }]);
      const { container } = renderDashboard();
      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back.' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Rematch:/ })).not.toBeInTheDocument();
      expect(container.querySelector('.se-go')).toBeNull();
    });

    it('marks no winner on a draw', () => {
      seed([football]);
      const { container } = renderDashboard();
      expect(container.querySelector('.kit-last-team.is-winner')).toBeNull();
      expect(container.querySelector('.kit-last-detail')).toHaveTextContent('Draw');
    });

    it('lists the other recent matches with doodle badges, bolding the winner only', () => {
      seed([volleyball, kabaddi, football]);
      const { container } = renderDashboard();

      const rows = within(screen.getByRole('region', { name: 'Recent' })).getAllByRole('button', { name: /v/ });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Bulls v Panthers');
      expect(rows[0]).toHaveTextContent('38–31');
      expect(rows[0].querySelector('strong')).toHaveTextContent('Bulls');
      expect(rows[1].querySelector('strong')).toBeNull();
      // The doodle sits in the sport's identity badge: a hand-drawn stroke icon, never the tile mark.
      const badge = rows[0].querySelector('.kit-badge');
      expect(badge.querySelector('svg')).toHaveAttribute('stroke-width', '2');
      expect(badge.style.getPropertyValue('--sport-core')).not.toBe('');
      expect(container.querySelectorAll('.kit-tile .kit-badge, .kit-tile svg')).toHaveLength(0);
    });

    it('greets a signed-in scorer by name with the underline, and the avatar opens the profile', async () => {
      authState = { ...authState, isAuthenticated: true, user: { username: 'harsha', favoriteGames: ['cricket'] } };
      seed([volleyball]);
      const { container } = renderDashboard();

      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent('Hi harsha.');
      expect(title.querySelector('.kit-underlined')).toHaveTextContent('harsha');
      expect(container.querySelectorAll('.kit-underline')).toHaveLength(1);
      expect(within(screen.getByRole('region', { name: 'Quick start' })).getByRole('button')).toHaveAccessibleName('Quick match: Cricket');
      expect(screen.getByText('Your favourites')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Account' }));
      await waitFor(() => expect(screen.getByLabelText('Current route')).toHaveTextContent('/profile'));
    });

    it('leaves guest account entry to the Profile dock tab', () => {
      seed([volleyball]);
      renderDashboard();
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });

    it('falls back to recently played sports when stored favourite ids are stale', () => {
      authState = { ...authState, isAuthenticated: true, user: { username: 'harsha', favoriteGames: ['not-a-real-sport'] } };
      seed([volleyball, kabaddi]);
      renderDashboard();
      expect(screen.getByText('Recently played')).toBeInTheDocument();
      expect(within(screen.getByRole('region', { name: 'Quick start' })).getAllByRole('button').map((b) => b.dataset.sport))
        .toEqual(['volleyball', 'kabaddi']);
    });

    it('counts this week from the full history, not just the rows shown', () => {
      seed([volleyball, kabaddi, football, { ...kabaddi, id: 'old', date: iso(30 * day) }, { ...kabaddi, id: 'k2', date: iso(2 * day) }]);
      renderDashboard();
      expect(screen.getByText('4 matches scored this week')).toBeInTheDocument();
    });

    it('renders stored data on the first paint without an empty-then-populated flash', () => {
      vi.unstubAllGlobals();
      seed([volleyball]);
      renderDashboard();
      expect(screen.getByRole('heading', { name: 'Last match' })).toBeInTheDocument();
      expect(screen.queryByText('Your matches will appear here')).not.toBeInTheDocument();
    });

    it('renders the returning Home when session storage is corrupt', () => {
      globalThis.localStorage.setItem('gs_sessions', JSON.stringify({ id: 'bad-session' }));
      seed([volleyball]);
      renderDashboard();
      expect(screen.getByRole('heading', { name: 'Last match' })).toBeInTheDocument();
    });

    it('does not render a second navigation inside the app shell', () => {
      seed([volleyball]);
      renderDashboard();
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
  });

  it('formats scores and days for the rows', () => {
    expect(scorePair({ score1: 3, score2: 1 })).toEqual(['3', '1']);
    expect(scorePair({ innings: [{ teamId: 'team1', runs: 120 }, { teamId: 'team2', runs: 98 }] })).toEqual(['120', '98']);
    const now = new Date(2026, 9, 22, 12).getTime();
    expect(relativeDay(now - 3600e3, now)).toBe('Today');
    expect(relativeDay(now - day, now)).toBe('Yesterday');
    expect(relativeDay(now - 3 * day, now)).toBe('Mon');
    expect(relativeDay(now - 20 * day, now)).toBe('2 Oct');
    expect(relativeDay(null, now)).toBe('');
  });
});
