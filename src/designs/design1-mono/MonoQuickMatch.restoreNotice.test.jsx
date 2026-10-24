import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({ sport: 'volleyball' }));
vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(), useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams('local=1&resume=3003'), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false, cloudAuthAvailable: false }) }));
vi.mock('../../hooks/useLiveBroadcast', () => ({ useLiveBroadcast: () => ({ isLive: false, reset: vi.fn(), point: vi.fn(), undo: vi.fn(), finalize: vi.fn() }) }));
import MonoQuickMatch from './MonoQuickMatch';
import { deriveTeamColours } from '../../lib/teamColour';

const copy = 'Resumed your in-progress quick match on this device.';
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it.each(['volleyball', 'badminton', 'tabletennis', 'football', 'basketball', 'kabaddi', 'hockey', 'cricket'])(
  '%s restores into an in-flow polite notice after the header and keeps scoring, Undo and Finish usable', (sport) => {
    ctx.sport = sport;
    localStorage.setItem(`se_quickmatch_draft_${sport}`, JSON.stringify({
      phase: 'scoring', sport, quickMatchId: 3003, team1Name: 'Royals', team2Name: 'Strikers',
      updatedAt: new Date().toISOString(), lastAction: '',
      ...(sport === 'cricket' ? {} : { format: sport === 'volleyball' || sport === 'badminton' || sport === 'tabletennis'
        ? { type: 'best-of', sets: 3, points: 25 } : { type: 'timed', minutes: 20 } }),
    }));
    render(<MonoQuickMatch />);
    const notice = screen.getByText(copy);
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(notice.previousElementSibling).toHaveClass('sb-top');
    const undo = screen.getByRole('button', { name: /Undo last/ });
    expect(undo).toBeDisabled();
    if (sport === 'kabaddi') {
      // A raid is recorded once: start, touch a defender on the court, confirm.
      fireEvent.click(screen.getByRole('button', { name: 'Start · first raid by Royals' }));
      fireEvent.click(screen.getByRole('button', { name: / defender 1$/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Confirm raid/ }));
    } else {
      const score = sport === 'cricket' ? screen.getByRole('button', { name: '1 run' })
        : sport === 'football' || sport === 'hockey' ? screen.getByRole('button', { name: 'Add 1 to Royals' })
          : sport === 'basketball' ? screen.getByRole('button', { name: 'Add +1 for Royals' })
            : screen.getByRole('button', { name: 'Add point for Royals' });
      fireEvent.click(score);
    }
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    // Kabaddi's first whistle (the half's clock start) is its own, earlier undo step.
    if (sport === 'kabaddi') expect(undo).toHaveTextContent('Back to the start');
    else expect(undo).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('dialog', { name: 'End match?' })).toBeInTheDocument();
    expect(screen.getByText(copy)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3299));
    expect(screen.getByText(copy)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText(copy)).not.toBeInTheDocument();
  },
);

it('restores the same score, Undo history and picked colours after a refresh with the notice showing', () => {
  ctx.sport = 'volleyball';
  localStorage.setItem('se_quickmatch_draft_volleyball', JSON.stringify({
    phase: 'scoring', sport: 'volleyball', quickMatchId: 3003,
    team1Name: 'Royals', team2Name: 'Strikers', team1Color: '#7c3aed', team2Color: '#fbbf24',
    format: { type: 'best-of', sets: 3, points: 25 },
    sets: [{ score1: 12, score2: 10, completed: false }], currentSet: 0,
    updatedAt: new Date().toISOString(), lastAction: '',
  }));
  const first = render(<MonoQuickMatch />);
  fireEvent.click(screen.getByRole('button', { name: 'Add point for Royals' }));
  expect(document.querySelector('.tsb-big')).toHaveTextContent('13');
  first.unmount();
  render(<MonoQuickMatch />);
  expect(screen.getByText(copy)).toBeInTheDocument();
  expect(document.querySelector('.tsb-big')).toHaveTextContent('13');
  const { A, B } = deriveTeamColours('#7c3aed', '#fbbf24');
  const board = document.querySelector('[data-team-board]');
  expect(board.style.getPropertyValue('--team-a-core')).toBe(A.core);
  expect(board.style.getPropertyValue('--team-b-core')).toBe(B.core);
  fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
  expect(document.querySelector('.tsb-big')).toHaveTextContent('12');
});

it('keeps restore notices in document flow without a motion-dependent dismissal', () => {
  const css = readFileSync('src/designs/design1-mono/mono.css', 'utf8');
  const noticeRule = css.match(/\.mono-scorer-note\s*\{([^}]+)\}/)[1];
  expect(noticeRule).not.toMatch(/position:\s*(fixed|absolute)|\b(top|left|z-index|animation|transform):/);
  expect(css).not.toContain('mono-note-toast');
});

