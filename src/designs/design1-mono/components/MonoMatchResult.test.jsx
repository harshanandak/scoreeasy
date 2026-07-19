import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MonoMatchResult, { MonoMatchResultView } from './MonoMatchResult';

// Confetti is a DOM/side-effect; stub it so the pure view tests stay hermetic
// and we can assert the one-shot fire + dedupe.
const confetti = vi.hoisted(() => ({ triggerConfetti: vi.fn() }));
vi.mock('../utils/confetti', () => confetti);

// --- Container wiring fixtures (Sets reference wiring) ---
const rt = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { sport: 'volleyball', id: '1', matchId: 'm1' },
  tournaments: [],
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => rt.navigate,
  useParams: () => rt.params,
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../../models/sportRegistry', () => ({
  getSportById: (id) => (id === 'volleyball' ? { id: 'volleyball', name: 'Volleyball', storageKey: 'vb' } : null),
}));
vi.mock('../../../utils/storage', () => ({ loadSportTournaments: () => rt.tournaments }));

const completedTournament = {
  id: 1,
  teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
  matches: [{
    id: 'm1', team1Id: 1, team2Id: 2, status: 'completed', winner: 1,
    setsWon1: 3, setsWon2: 1,
    sets: [
      { score1: 25, score2: 20, completed: true },
      { score1: 20, score2: 25, completed: true },
      { score1: 25, score2: 18, completed: true },
      { score1: 25, score2: 22, completed: true },
    ],
  }],
  knockoutMatches: [],
};

const decided = {
  verdict: {
    status: 'completed',
    isDecided: true,
    isDraw: false,
    winnerSide: 'team1',
    winnerName: 'Alpha',
    headline: 'Alpha win 3–1',
    scoreLine: '3 – 1',
    detailLabel: 'sets',
    lineScore: ['25–20', '20–25', '25–18', '25–22'],
    ariaSummary: 'Alpha win 3–1. Alpha 3, Beta 1.',
  },
  team1Name: 'Alpha',
  team2Name: 'Beta',
  context: 'tournament',
  isSignedIn: true,
  onDone: vi.fn(),
  onRematch: vi.fn(),
  onScorecard: vi.fn(),
  onShare: vi.fn(),
  onSignIn: vi.fn(),
};

beforeEach(() => {
  confetti.triggerConfetti.mockClear();
  Object.values(decided).forEach((v) => typeof v === 'function' && v.mockClear?.());
});

describe('MonoMatchResultView — decided match', () => {
  it('renders the verdict headline and moves focus to it on mount (a11y)', () => {
    render(<MonoMatchResultView {...decided} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Alpha win 3–1');
    expect(heading).toHaveFocus();
  });

  it('exposes a labelled result region with a spoken summary', () => {
    render(<MonoMatchResultView {...decided} />);
    expect(screen.getByRole('region', { name: /match result/i })).toBeInTheDocument();
    expect(screen.getByText('Alpha win 3–1. Alpha 3, Beta 1.')).toBeInTheDocument();
  });

  it('shows the primary score line, unit, and per-set line score', () => {
    render(<MonoMatchResultView {...decided} />);
    expect(screen.getByText('sets')).toBeInTheDocument();
    expect(screen.getByText(/25–20/)).toBeInTheDocument();
  });

  it('marks the winning team as the lead and shows the gold medallion once', () => {
    const { container } = render(<MonoMatchResultView {...decided} />);
    expect(container.querySelectorAll('.mono-result-medallion')).toHaveLength(1);
    expect(container.querySelectorAll('.mono-result-team-winner')).toHaveLength(1);
    expect(screen.getByText('Alpha').closest('.mono-result-team')).toHaveClass('mono-result-team-winner');
  });

  it('fires a one-shot celebration confetti on mount (deduped)', () => {
    const { rerender } = render(<MonoMatchResultView {...decided} />);
    rerender(<MonoMatchResultView {...decided} />);
    expect(confetti.triggerConfetti).toHaveBeenCalledTimes(1);
  });

  it('does not celebrate or fire confetti under reduced motion', () => {
    const { container } = render(<MonoMatchResultView {...decided} reduceMotion />);
    expect(confetti.triggerConfetti).not.toHaveBeenCalled();
    expect(container.querySelector('.mono-result-celebrate')).toBeNull();
  });
});

describe('MonoMatchResultView — actions', () => {
  it('invokes Done and Rematch', () => {
    render(<MonoMatchResultView {...decided} />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    fireEvent.click(screen.getByRole('button', { name: /rematch/i }));
    expect(decided.onDone).toHaveBeenCalledTimes(1);
    expect(decided.onRematch).toHaveBeenCalledTimes(1);
  });

  it('disables Scorecard and Share until those screens exist', () => {
    render(<MonoMatchResultView {...decided} />);
    expect(screen.getByRole('button', { name: /scorecard/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
  });

  it('enables Scorecard and Share when ready', () => {
    render(<MonoMatchResultView {...decided} scorecardReady shareReady />);
    fireEvent.click(screen.getByRole('button', { name: /scorecard/i }));
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(decided.onScorecard).toHaveBeenCalledTimes(1);
    expect(decided.onShare).toHaveBeenCalledTimes(1);
  });

  it('offers Sign in to save for guests only', () => {
    const { rerender } = render(<MonoMatchResultView {...decided} isSignedIn={false} />);
    fireEvent.click(screen.getByRole('button', { name: /sign in to save/i }));
    expect(decided.onSignIn).toHaveBeenCalledTimes(1);
    rerender(<MonoMatchResultView {...decided} isSignedIn />);
    expect(screen.queryByRole('button', { name: /sign in to save/i })).toBeNull();
  });
});

describe('MonoMatchResultView — edge states', () => {
  const draw = {
    ...decided,
    verdict: {
      status: 'completed', isDecided: false, isDraw: true, winnerSide: 'draw',
      winnerName: null, headline: 'Match drawn', scoreLine: '2 – 2',
      detailLabel: 'goals', lineScore: [], ariaSummary: 'Match drawn. Alpha 2, Beta 2.',
    },
  };

  it('shows no gold medallion and no lead highlight on a draw', () => {
    const { container } = render(<MonoMatchResultView {...draw} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Match drawn');
    expect(container.querySelector('.mono-result-medallion')).toBeNull();
    expect(container.querySelector('.mono-result-team-winner')).toBeNull();
  });

  it('renders an abandoned match honestly', () => {
    const abandoned = {
      ...decided,
      verdict: {
        status: 'abandoned', isDecided: false, isDraw: false, winnerSide: 'none',
        winnerName: null, headline: 'Match abandoned', scoreLine: '1 – 0',
        detailLabel: null, lineScore: [], ariaSummary: 'Match abandoned.',
      },
    };
    const { container } = render(<MonoMatchResultView {...abandoned} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Match abandoned');
    expect(container.querySelector('.mono-result-medallion')).toBeNull();
  });
});

describe('MonoMatchResult — Sets container wiring', () => {
  beforeEach(() => {
    rt.navigate.mockClear();
    rt.tournaments = [completedTournament];
    rt.params = { sport: 'volleyball', id: '1', matchId: 'm1' };
  });

  it('builds the verdict from a completed Sets match in storage', () => {
    render(<MonoMatchResult />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha win 3–1');
    expect(screen.getByText(/25–20/)).toBeInTheDocument();
  });

  it('routes Done to the tournament bracket, REPLACING the Result entry', () => {
    // Result is pushed on top of the pre-scorer route (the unwind fix), so leaving
    // it must replace the Result entry — otherwise Back after Done re-enters a
    // stale Result screen. The stack contract must hold in both directions.
    render(<MonoMatchResult />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(rt.navigate).toHaveBeenCalledWith('/volleyball/tournament/1', { replace: true });
  });

  it('routes Rematch to a fresh quick match, REPLACING the Result entry', () => {
    render(<MonoMatchResult />);
    fireEvent.click(screen.getByRole('button', { name: /rematch/i }));
    expect(rt.navigate).toHaveBeenCalledWith('/volleyball/quick', { replace: true });
  });

  it('falls back to a safe recovery surface when the match is missing', () => {
    rt.tournaments = [];
    render(<MonoMatchResult />);
    expect(screen.getByText(/result unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /win/i })).toBeNull();
  });

  it('does not render a result for an in-progress match', () => {
    rt.tournaments = [{
      ...completedTournament,
      matches: [{ ...completedTournament.matches[0], status: 'in-progress', winner: null }],
    }];
    render(<MonoMatchResult />);
    expect(screen.getByText(/result unavailable/i)).toBeInTheDocument();
  });
});
