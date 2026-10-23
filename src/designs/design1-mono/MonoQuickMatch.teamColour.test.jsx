import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_TEAM_COLOURS, deriveTeamColours } from '../../lib/teamColour';

// Direction E in quick match: team colours picked on setup, kept in the draft, shared to the
// live meta, and painted on the board for sports that opt in (volleyball first). Drives the real
// component, seeded through the draft like MonoQuickMatch.broadcast.test.jsx.

const live = vi.hoisted(() => ({
  point: vi.fn(() => Promise.resolve()),
  undo: vi.fn(() => Promise.resolve()),
  finalize: vi.fn(() => Promise.resolve()),
  goLive: vi.fn(() => Promise.resolve({ token: 'TOK', matchId: 'mid' })),
  setVisibility: vi.fn(() => Promise.resolve()),
  reset: vi.fn(),
}));

const ctx = vi.hoisted(() => ({ sport: 'volleyball', draft: null, classic: false }));
vi.mock('../../models/sportRegistry', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isTeamColourSport: (id) => !ctx.classic && actual.isTeamColourSport(id) };
});
const storage = vi.hoisted(() => ({ saveData: null, saveQuickMatch: null }));

vi.mock('convex/react', () => ({ useMutation: () => vi.fn(), useQuery: () => undefined }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ sport: ctx.sport }),
  useLocation: () => ({ pathname: `/${ctx.sport}/quick`, search: '' }),
  useSearchParams: () => [new URLSearchParams(''), vi.fn()],
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, cloudAuthAvailable: true }),
}));
vi.mock('../../hooks/useLiveBroadcast', () => ({
  useLiveBroadcast: () => ({ ...live, isLive: false, token: null, error: null }),
}));
vi.mock('../../lib/live/liveSession', () => ({
  getConsent: () => 'accepted',
  setConsent: vi.fn(),
  loadSession: () => null,
  saveSession: vi.fn(),
}));
vi.mock('../../utils/storage', () => {
  storage.saveData = vi.fn(() => true);
  storage.saveQuickMatch = vi.fn(() => true);
  return {
    listDataKeys: () => [],
    loadData: vi.fn((key, def) => (key === `se_quickmatch_draft_${ctx.sport}` ? ctx.draft : def)),
    loadQuickMatch: vi.fn(() => null),
    saveData: storage.saveData,
    clearData: vi.fn(),
    saveQuickMatch: storage.saveQuickMatch,
    isStaleQuickMatchDraft: () => false,
  };
});

const { default: MonoQuickMatch } = await import('./MonoQuickMatch.jsx');

function seedSets(sport, colours = {}) {
  ctx.sport = sport;
  ctx.draft = {
    phase: 'scoring', sport, team1Name: 'Reds', team2Name: 'Blues', lastAction: '', quickMatchId: 3003,
    format: { type: 'best-of', sets: 3, target: 25, winBy: 2 },
    sets: [{ score1: 0, score2: 0, completed: false }], currentSet: 0,
    ...colours,
  };
}

const board = () => document.querySelector('[data-team-board]');
const keys = () => [...document.querySelectorAll('.tsb-key')];

beforeEach(() => {
  ctx.draft = null;
  ctx.classic = false;
  live.goLive.mockClear();
  live.point.mockClear();
  storage.saveData.mockClear();
  storage.saveQuickMatch.mockClear();
});

// Home shows the last match in its team colours (Kit S1), so the finished record keeps them.
async function finishAfterOnePoint() {
  const reds = await screen.findByRole('button', { name: 'Add point for Reds' });
  fireEvent.click(reds);
  await waitFor(() => expect(reds).toHaveTextContent('1'));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'End match?' })).getByRole('button', { name: 'End match' }));
  await waitFor(() => expect(storage.saveQuickMatch).toHaveBeenCalled());
  return storage.saveQuickMatch.mock.calls.at(-1)[0];
}

describe('quick match team colour: the finished record', () => {
  it('keeps the picked colours on a finished volleyball match', async () => {
    seedSets('volleyball', { team1Color: '#facc15', team2Color: '#16a34a' });
    render(<MonoQuickMatch />);
    const saved = await finishAfterOnePoint();
    expect(saved).toMatchObject({ status: 'completed', team1Color: '#facc15', team2Color: '#16a34a' });
  });

  // Kit S3: the Finish winner card is the winner's engine-gated colour, the loser row its tint.
  it('paints the Finish in the picked colours: winner card in the winner\'s, loser row in the other\'s tint', async () => {
    seedSets('volleyball', { team1Color: '#facc15', team2Color: '#16a34a' });
    render(<MonoQuickMatch />);
    await finishAfterOnePoint();
    const { A, B } = deriveTeamColours('#facc15', '#16a34a');
    const screenRoot = await screen.findByRole('region', { name: 'Match result' });
    expect(screenRoot.style.getPropertyValue('--kit-win-core')).toBe(A.core);
    expect(screenRoot.style.getPropertyValue('--kit-win-on')).toBe(A.on);
    expect(screenRoot.style.getPropertyValue('--kit-lose-tint')).toBe(B.tint);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Winner: Reds');
    expect(document.querySelector('.kit-fin-row')).toHaveTextContent('Blues');
    // Rematch is the only Go; the rest are Mono-strength controls.
    expect([...document.querySelectorAll('.se-go')].map((b) => b.textContent)).toEqual(['Rematch']);
    expect(screen.getByRole('button', { name: 'History' })).toHaveClass('se-ctl');
  });

  it('adds no colours for a sport that has not opted in', async () => {
    ctx.classic = true;
    seedSets('tabletennis', { team1Color: '#facc15' });
    render(<MonoQuickMatch />);
    const saved = await finishAfterOnePoint();
    expect(saved.status).toBe('completed');
    expect(saved).not.toHaveProperty('team1Color');
    expect(saved).not.toHaveProperty('team2Color');
  });
});

describe('quick match team colour: volleyball board', () => {
  it('restores the picked colours from the draft and paints the board with them', async () => {
    seedSets('volleyball', { team1Color: '#facc15', team2Color: '#16a34a' });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Reds' });

    const expected = deriveTeamColours('#facc15', '#16a34a');
    expect(board().style.getPropertyValue('--team-a-core')).toBe(expected.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(expected.B.core);
    expect(keys().map((k) => k.dataset.team)).toEqual(['a', 'b']);
  });

  it('shares the colours to the live meta', async () => {
    seedSets('volleyball', { team1Color: '#facc15', team2Color: '#16a34a' });
    render(<MonoQuickMatch />);
    await waitFor(() => expect(live.goLive).toHaveBeenCalled());
    const descriptor = live.goLive.mock.calls[0][0];
    expect(descriptor.teamA).toEqual({ name: 'Reds', color: '#facc15' });
    expect(descriptor.teamB).toEqual({ name: 'Blues', color: '#16a34a' });
  });

  it('keeps the colours in the saved draft', async () => {
    seedSets('volleyball', { team1Color: '#facc15', team2Color: '#16a34a' });
    render(<MonoQuickMatch />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add point for Reds' }));
    await waitFor(() => expect(storage.saveData).toHaveBeenCalled());
    const draft = storage.saveData.mock.calls.at(-1)[1];
    expect(draft.team1Color).toBe('#facc15');
    expect(draft.team2Color).toBe('#16a34a');
  });

  it('falls back to red v blue for an old draft without colours, and for a crafted colour', async () => {
    seedSets('volleyball', { team2Color: 'url(//x)' });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Reds' });
    const expected = deriveTeamColours(DEFAULT_TEAM_COLOURS.a, DEFAULT_TEAM_COLOURS.b);
    expect(board().style.getPropertyValue('--team-a-core')).toBe(expected.A.core);
    expect(board().style.getPropertyValue('--team-b-core')).toBe(expected.B.core);
    await waitFor(() => expect(live.goLive).toHaveBeenCalled());
    expect(live.goLive.mock.calls[0][0].teamB.color).toBe(DEFAULT_TEAM_COLOURS.b);
  });

  it('keeps colour with the team when sides swap (from the options sheet)', async () => {
    seedSets('volleyball', { team1Color: '#facc15', team2Color: '#16a34a' });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Reds' });
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Swap sides' }));
    expect(keys().map((k) => k.dataset.team)).toEqual(['b', 'a']);
    expect(keys()[0]).toHaveTextContent('Blues');
  });

  it('scores, says what undo will do, undoes, and corrects from the sheet', async () => {
    seedSets('volleyball');
    render(<MonoQuickMatch />);
    const reds = await screen.findByRole('button', { name: 'Add point for Reds' });
    fireEvent.click(reds);
    await waitFor(() => expect(reds).toHaveTextContent('1'));
    expect(screen.getByRole('button', { name: 'Undo last action' })).toHaveTextContent('back to 0–0');
    // lead is not colour-coded: the key keeps its team class whatever the score
    expect(reds).toHaveClass('tsb-key-a');
    fireEvent.click(screen.getByRole('button', { name: 'Undo last action' }));
    await waitFor(() => expect(reds).toHaveTextContent('0'));
    expect(screen.getByRole('button', { name: 'Undo last action' })).toBeDisabled();

    fireEvent.click(reds);
    await waitFor(() => expect(reds).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Match options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Subtract one from Reds' }));
    await waitFor(() => expect(reds).toHaveTextContent('0'));
  });

  it('shows the score it is about to keep in the Finish dialog', async () => {
    seedSets('volleyball');
    render(<MonoQuickMatch />);
    const reds = await screen.findByRole('button', { name: 'Add point for Reds' });
    fireEvent.click(reds);
    await waitFor(() => expect(reds).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const dialog = screen.getByRole('dialog', { name: 'End match?' });
    expect(within(dialog).getByText('Set 1 · Sets 0–0')).toBeInTheDocument();
    expect(within(dialog).getByText('1–0')).toBeInTheDocument();
  });

  it('states the deciding set rule the scorer is actually playing to', async () => {
    seedSets('volleyball', {
      sets: [
        { score1: 25, score2: 20, completed: true },
        { score1: 21, score2: 25, completed: true },
        { score1: 0, score2: 0, completed: false },
      ],
      currentSet: 2,
    });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Reds' });
    expect(screen.getByText('Volleyball · 15 pts · win by 2')).toBeInTheDocument();
  });

  it('keeps the live-sharing bar mounted while the options sheet is closed', async () => {
    seedSets('volleyball');
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Reds' });
    expect(screen.queryByRole('dialog', { name: 'Match options' })).toBeNull();
    await waitFor(() => expect(live.goLive).toHaveBeenCalled());
  });
});

describe('quick match team colour: registry opt-out compatibility', () => {
  it('preserves the classic board and live meta when a registry entry does not opt in', async () => {
    ctx.classic = true;
    seedSets('tabletennis', { team1Color: '#facc15' });
    render(<MonoQuickMatch />);
    await screen.findByRole('button', { name: 'Add point for Reds' });
    expect(board()).toBeNull();
    await waitFor(() => expect(live.goLive).toHaveBeenCalled());
    expect(live.goLive.mock.calls[0][0].teamA).toEqual({ name: 'Reds' });
  });
});

describe('quick match team colour: setup', () => {
  it('offers a colour picker per team for volleyball', async () => {
    ctx.sport = 'volleyball';
    render(<MonoQuickMatch />);
    const teamA = await screen.findByRole('group', { name: 'Team A colour' });
    expect(screen.getByRole('group', { name: 'Team B colour' })).toBeInTheDocument();
    const yellow = within(teamA).getByRole('button', { name: 'Yellow' });
    fireEvent.click(yellow);
    expect(yellow).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers no picker for a sport that has not opted in', async () => {
    ctx.classic = true;
    ctx.sport = 'tabletennis';
    render(<MonoQuickMatch />);
    await screen.findByLabelText('Team A name');
    expect(screen.queryByRole('group', { name: 'Team A colour' })).toBeNull();
  });
});
