import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import MonoMatchResult, { MonoMatchResultView } from './MonoMatchResult';

// --- Container wiring fixtures (Sets reference wiring) ---
const rt = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { sport: 'volleyball', id: '1', matchId: 'm1' },
  tournaments: [],
  auth: { isAuthenticated: false, cloudAuthAvailable: true },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => rt.navigate,
  useParams: () => rt.params,
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => rt.auth }));
vi.mock('../../../utils/storage', () => ({ loadSportTournaments: () => rt.tournaments }));

const completedTournament = {
  id: 1,
  teams: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
  format: { type: 'best-of', sets: 5 },
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
  sets: completedTournament.matches[0].sets,
  sportId: 'volleyball',
  sportName: 'Volleyball',
  team1Name: 'Alpha',
  team2Name: 'Beta',
  isSignedIn: true,
  onDone: vi.fn(),
  onRematch: vi.fn(),
  onScorecard: vi.fn(),
  onShare: vi.fn(),
  onSignIn: vi.fn(),
};

beforeEach(() => {
  Object.values(decided).forEach((v) => typeof v === 'function' && v.mockClear?.());
});

describe('MonoMatchResultView — decided match (Kit Finish)', () => {
  it('names the winner in the heading and moves focus to it on mount (a11y)', () => {
    render(<MonoMatchResultView {...decided} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Winner: Alpha');
    expect(heading).toHaveFocus();
  });

  it('exposes a labelled result region with a spoken summary', () => {
    render(<MonoMatchResultView {...decided} />);
    expect(screen.getByRole('region', { name: /match result/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Alpha won. Took the last set 25–22. Alpha 3, Beta 1.');
  });

  it('shows the sets score winner-first and one chip per set in board order', () => {
    render(<MonoMatchResultView {...decided} />);
    expect(screen.getByTestId('winner-card')).toHaveTextContent('3–1');
    const chips = within(screen.getByRole('list', { name: 'Set scores' })).getAllByRole('listitem');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Set 1 25–20, Alpha', 'Set 2 20–25, Beta', 'Set 3 25–18, Alpha', 'Set 4 25–22, Alpha',
    ]);
  });

  it('puts the loser on a tinted row and spends the one gold on the Winner tag', () => {
    const { container } = render(<MonoMatchResultView {...decided} />);
    expect(container.querySelectorAll('.kit-fin-medallion')).toHaveLength(1);
    const loser = container.querySelector('.kit-fin-row');
    expect(loser).toHaveTextContent('Beta');
    expect(loser).toHaveTextContent('1');
  });

  it('draws confetti, the trophy and the circle once, and drops the confetti under reduced motion', () => {
    const { rerender } = render(<MonoMatchResultView {...decided} reduceMotion={false} />);
    rerender(<MonoMatchResultView {...decided} reduceMotion={false} />);
    expect(screen.getAllByTestId('finish-confetti')).toHaveLength(1);
    expect(screen.getAllByTestId('finish-trophy')).toHaveLength(1);
    expect(screen.getAllByTestId('finish-circle')).toHaveLength(1);
    rerender(<MonoMatchResultView {...decided} reduceMotion />);
    expect(screen.queryByTestId('finish-confetti')).toBeNull();
    expect(screen.getByTestId('winner-card')).not.toHaveClass('is-animated');
    // Still drawn, never animated: the trophy and the circle stay as decoration.
    expect(screen.getByTestId('finish-circle')).toBeInTheDocument();
  });
});

describe('MonoMatchResultView — actions', () => {
  it('invokes Done and Rematch; Rematch is the only Go', () => {
    const { container } = render(<MonoMatchResultView {...decided} />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    fireEvent.click(screen.getByRole('button', { name: /rematch/i }));
    expect(decided.onDone).toHaveBeenCalledTimes(1);
    expect(decided.onRematch).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.se-go')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /rematch/i })).toHaveClass('se-go');
  });

  it('disables Match details and Share until those screens exist, as Mono-strength controls', () => {
    render(<MonoMatchResultView {...decided} />);
    expect(screen.getByRole('button', { name: /match details/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /share/i })).toHaveClass('se-ctl');
  });

  it('enables Match details and Share when ready', () => {
    render(<MonoMatchResultView {...decided} scorecardReady shareReady />);
    fireEvent.click(screen.getByRole('button', { name: /match details/i }));
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(decided.onScorecard).toHaveBeenCalledTimes(1);
    expect(decided.onShare).toHaveBeenCalledTimes(1);
  });

  it('offers an honest Sign in CTA for guests only (no promise to save THIS match)', () => {
    const { rerender } = render(<MonoMatchResultView {...decided} isSignedIn={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(decided.onSignIn).toHaveBeenCalledTimes(1);
    // Guest matches persist locally regardless of auth; signing in does NOT
    // upload this already-completed match (guest -> cloud sync is a separate M1
    // issue), so the CTA must not promise to "save" it.
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    rerender(<MonoMatchResultView {...decided} isSignedIn />);
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
  });

  it('hides the Sign in CTA when cloud auth is unavailable (local/offline mode)', () => {
    render(<MonoMatchResultView {...decided} isSignedIn={false} cloudAuthAvailable={false} />);
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
  });

  it('shows the Sign in CTA for a guest when cloud auth is available', () => {
    render(<MonoMatchResultView {...decided} isSignedIn={false} cloudAuthAvailable />);
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });
});

describe('MonoMatchResultView — edge states', () => {
  const draw = {
    ...decided,
    sets: [],
    verdict: {
      status: 'completed', isDecided: false, isDraw: true, winnerSide: 'draw',
      winnerName: null, headline: 'Match drawn', scoreLine: '2 – 2',
      detailLabel: 'goals', lineScore: [], ariaSummary: 'Match drawn. Alpha 2, Beta 2.',
    },
  };

  it('shows no winner card, no gold and no hand-drawn moment on a draw', () => {
    const { container } = render(<MonoMatchResultView {...draw} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Match drawn');
    expect(screen.queryByTestId('winner-card')).toBeNull();
    expect(container.querySelector('.kit-fin-medallion')).toBeNull();
    expect(screen.queryByTestId('finish-confetti')).toBeNull();
    expect(screen.queryByTestId('finish-trophy')).toBeNull();
    expect(screen.getByTestId('level-card')).toHaveTextContent('2–2');
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
    expect(screen.getByText('No result')).toBeInTheDocument();
    expect(container.querySelector('.kit-fin-medallion')).toBeNull();
  });
});

describe('MonoMatchResult — Sets container wiring', () => {
  beforeEach(() => {
    rt.navigate.mockClear();
    rt.tournaments = [completedTournament];
    rt.params = { sport: 'volleyball', id: '1', matchId: 'm1' };
    rt.auth = { isAuthenticated: false, cloudAuthAvailable: true };
  });

  it('hides the Sign in CTA when the auth context has no cloud auth available', () => {
    rt.auth = { isAuthenticated: false, cloudAuthAvailable: false };
    render(<MonoMatchResult />);
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
  });

  it('shows the Sign in CTA when cloud auth is available and the user is a guest', () => {
    rt.auth = { isAuthenticated: false, cloudAuthAvailable: true };
    render(<MonoMatchResult />);
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('builds the Finish from a completed Sets match in storage', () => {
    render(<MonoMatchResult />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winner: Alpha');
    expect(screen.getByTestId('winner-card')).toHaveTextContent('3–1');
    expect(screen.getByText('Volleyball · Best of 5')).toBeInTheDocument();
    expect(screen.getByText(/25–20/)).toBeInTheDocument();
  });

  // MonoTennisLiveScore's tournament save persists sets[] + winner and NO
  // setsWon1/setsWon2, so the container must derive the tally rather than default
  // it to 0 — otherwise a real 2–1 win headlines "0–0" above its own set scores.
  it('derives the result for a stored match that has only sets[] (tennis, with a tiebreak)', () => {
    rt.tournaments = [{
      ...completedTournament,
      matches: [{
        id: 'm1', team1Id: 1, team2Id: 2, status: 'completed', winner: 1,
        sets: [
          { score1: 6, score2: 4, completed: true },
          { score1: 3, score2: 6, completed: true },
          { score1: 7, score2: 6, tiebreakPoints1: 7, tiebreakPoints2: 5, completed: true, isTiebreak: true },
        ],
      }],
    }];
    render(<MonoMatchResult />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winner: Alpha');
    expect(screen.getByTestId('winner-card')).toHaveTextContent('2–1');
    expect(screen.getByText('Took the last set 7–6')).toBeInTheDocument();
    expect(screen.getByText('7–6 (7–5)')).toBeInTheDocument();
  });

  it('routes Done to the tournament bracket, REPLACING the Result entry', () => {
    // Result is pushed on top of the pre-scorer route (the unwind fix), so leaving
    // it must replace the Result entry — otherwise Back after Done re-enters a
    // stale Result screen. The stack contract must hold in both directions.
    render(<MonoMatchResult />);
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(rt.navigate).toHaveBeenCalledWith('/volleyball/tournament/1', { replace: true });
  });

  it('hides Rematch on a tournament result, so the screen has no Go', () => {
    const { container } = render(<MonoMatchResult />);
    expect(screen.getByRole('region', { name: 'Match result' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rematch/i })).not.toBeInTheDocument();
    expect(container.querySelector('.se-go')).toBeNull();
    expect(rt.navigate).not.toHaveBeenCalled();
  });

  it('falls back to a safe recovery surface when the match is missing', () => {
    rt.tournaments = [];
    render(<MonoMatchResult />);
    expect(screen.getByText(/result unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /winner/i })).toBeNull();
  });

  it('resolves a completed tournament stored under a STRING id', () => {
    // Tournament ids may be non-numeric (e.g. 'cup-1'); every other mono loader
    // matches both Number(id) and the raw string, so the result screen must too —
    // otherwise a valid stored tournament opens everywhere except its result.
    rt.tournaments = [{ ...completedTournament, id: 'cup-1' }];
    rt.params = { sport: 'volleyball', id: 'cup-1', matchId: 'm1' };
    render(<MonoMatchResult />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winner: Alpha');
    expect(screen.queryByText(/result unavailable/i)).toBeNull();
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
