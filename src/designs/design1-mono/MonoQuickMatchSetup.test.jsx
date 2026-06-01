import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoQuickMatch from './MonoQuickMatch';

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

function renderQuickMatch(initialEntry = '/volleyball/quick') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/:sport/quick" element={<MonoQuickMatch />} />
        <Route path="/:sport/quick/test-match/:matchId" element={<p>Cricket Test Match scorer</p>} />
        <Route path="/:sport/quick/live/:matchId" element={<p>Real tennis scorer</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderQuickMatchWithSwitcher(initialEntry = '/volleyball/quick') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Link to="/cricket/quick">Switch to cricket</Link>
      <Link to="/cricket/quick?format=gully">Switch to gully cricket</Link>
      <Link to="/volleyball/quick">Switch to volleyball</Link>
      <Routes>
        <Route path="/:sport/quick" element={<MonoQuickMatch />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoQuickMatch setup clarity', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('opens volleyball quick match on labeled teams with an immediate start path', async () => {
    renderQuickMatch();

    expect(await screen.findByRole('textbox', { name: 'Team A name' })).toHaveValue('Team A');
    expect(screen.getByRole('textbox', { name: 'Team B name' })).toHaveValue('Team B');
    expect(screen.getByRole('heading', { name: 'Match rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Volleyball' })).toBeEnabled();
    expect(screen.queryByText('Format Mode')).not.toBeInTheDocument();
  });

  it('uses the selected sport name in the setup start action', async () => {
    renderQuickMatch('/football/quick');

    expect(await screen.findByRole('button', { name: 'Start Football' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start Match' })).not.toBeInTheDocument();
  });

  it('starts tennis quick matches in the real tennis scorer without creating completed history', async () => {
    renderQuickMatch('/tennis/quick');

    fireEvent.click(await screen.findByRole('button', { name: 'Start Tennis' }));

    expect(await screen.findByText('Real tennis scorer')).toBeInTheDocument();
    expect(JSON.parse(globalThis.localStorage.getItem('se_quickmatches') || '[]')).toHaveLength(0);
    let draftKey = null;
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (key?.startsWith('se_tennis_quick_draft_')) draftKey = key;
    }
    expect(draftKey).toBeTruthy();
    expect(JSON.parse(globalThis.localStorage.getItem(draftKey))).toMatchObject({
      sport: 'tennis',
      team1: 'Team A',
      team2: 'Team B',
      status: 'in-progress',
    });
  });

  it('starts cricket Test Match quick matches on the product scorer route', async () => {
    renderQuickMatch({ pathname: '/cricket/quick', search: '?format=test' });

    fireEvent.click(await screen.findByRole('button', { name: 'Start Cricket' }));

    expect(await screen.findByText('Cricket Test Match scorer')).toBeInTheDocument();
    expect(JSON.parse(globalThis.localStorage.getItem('se_quickmatches') || '[]')).toEqual([
      expect.objectContaining({
        sport: 'cricket',
        status: 'in-progress',
        format: expect.objectContaining({ id: 'test', totalInnings: 4 }),
      }),
    ]);
  });

  it('resets cricket rules when switching into cricket on the same quick route', async () => {
    renderQuickMatchWithSwitcher('/volleyball/quick');

    expect(await screen.findByRole('button', { name: 'Start Volleyball' })).toBeEnabled();

    fireEvent.click(screen.getByRole('link', { name: 'Switch to cricket' }));

    expect(await screen.findByRole('button', { name: 'Start Cricket' })).toBeEnabled();
    expect(screen.getByText('T20')).toBeInTheDocument();
    expect(screen.getByText('T20 - 20 overs - 11 players - 1 innings per side')).toBeInTheDocument();
  });

  it('opens cricket query presets on the matching setup step after route switches', async () => {
    renderQuickMatchWithSwitcher('/volleyball/quick');

    expect(await screen.findByRole('button', { name: 'Start Volleyball' })).toBeEnabled();

    fireEvent.click(screen.getByRole('link', { name: 'Switch to gully cricket' }));

    expect(await screen.findByRole('button', { name: 'Start Cricket' })).toBeEnabled();
    expect(screen.getByText('Gully Cricket')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next:/i })).not.toBeInTheDocument();
  });

  it('resets non-cricket rules after leaving a cricket query preset', async () => {
    renderQuickMatchWithSwitcher('/cricket/quick?format=gully');

    expect(await screen.findByRole('button', { name: 'Start Cricket' })).toBeEnabled();

    fireEvent.click(screen.getByRole('link', { name: 'Switch to volleyball' }));

    expect(await screen.findByRole('button', { name: 'Start Volleyball' })).toBeEnabled();
    expect(screen.getByText('Best of 3 - 25 pts - win by 2')).toBeInTheDocument();
    expect(screen.queryByText('Gully Cricket')).not.toBeInTheDocument();
  });

  it('keeps optional player entry behind one roster section after both teams', async () => {
    renderQuickMatch();

    expect(await screen.findByRole('button', { name: 'Add players' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search @username or type name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add players' }));

    expect(await screen.findByText('Team A players')).toBeInTheDocument();
    expect(await screen.findByText('Team B players')).toBeInTheDocument();
    expect(await screen.findAllByPlaceholderText('Search @username or type name')).toHaveLength(2);
  });

  it('keeps the end-match confirmation inside the app with keyboard and focus recovery', async () => {
    renderQuickMatch();

    fireEvent.click(await screen.findByRole('button', { name: 'Start Volleyball' }));

    const endMatchButton = await screen.findByRole('button', { name: 'End Match' });
    fireEvent.click(endMatchButton);

    expect(screen.getByRole('dialog', { name: 'End match?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep scoring' })).toHaveFocus();

    fireEvent.keyDown(globalThis, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'End match?' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(endMatchButton).toHaveFocus();
    });

    fireEvent.click(endMatchButton);
    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'End match?' }).parentElement);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'End match?' })).not.toBeInTheDocument();
    });
  });

  it('clears team names when starting a distinct new match from the result screen', async () => {
    renderQuickMatch();

    fireEvent.change(await screen.findByRole('textbox', { name: 'Team A name' }), { target: { value: 'Eagles' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Team B name' }), { target: { value: 'Hawks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Volleyball' }));

    fireEvent.click(await screen.findByRole('button', { name: 'End Match' }));
    fireEvent.click(screen.getByRole('button', { name: 'End match' }));
    fireEvent.click(await screen.findByRole('button', { name: 'New Match' }));

    expect(await screen.findByRole('textbox', { name: 'Team A name' })).toHaveValue('Team A');
    expect(screen.getByRole('textbox', { name: 'Team B name' })).toHaveValue('Team B');
  });
});
