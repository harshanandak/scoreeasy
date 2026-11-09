import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoQuickMatch from './MonoQuickMatch';
import { loadCustomSetup, SETUP_PREFS_KEY } from '../../utils/setupPrefs';
import { closeOpenSheet, findTeamNameInput, goToSetupStep, teamColourGroup } from '../../test/teamColour';

vi.mock('convex/react', () => ({
  useConvex: () => ({ query: async () => null }),
  useMutation: () => vi.fn(),
  useQuery: () => [],
}));

function renderQuick(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:sport/quick" element={<MonoQuickMatch />} />
        <Route path="/:sport/quick/test-match/:matchId" element={<p>Cricket Test Match scorer</p>} />
        <Route path="/:sport/quick/live/:matchId" element={<p>Real scorer</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const dropDrafts = () => {
  for (const key of Object.keys(globalThis.localStorage)) {
    // Drafts live under the per-account storage scope (se_local:guest:...), so match the key name inside it.
    if (key.includes('se_quickmatch_draft')) globalThis.localStorage.removeItem(key);
  }
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

describe('quick setup steps', () => {
  it('tennis: Game and Teams steps, Start on both, no Rules step, the tabs and Back move between them', async () => {
    renderQuick('/tennis/quick');
    expect(await screen.findByRole('button', { name: 'Game', current: 'step' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rules' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'What are you playing?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start tennis' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Teams' }));
    expect(screen.getByRole('button', { name: 'Teams', current: 'step' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit Team A:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start tennis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Game' }));
    expect(screen.getByRole('button', { name: 'Game', current: 'step' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
  });

  it('kabaddi: three steps with who raids first on Teams and the rules on Rules', async () => {
    renderQuick('/kabaddi/quick');
    expect(await screen.findByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /^Start/ })).toBeInTheDocument();

    goToSetupStep('Teams');
    expect(screen.getByRole('group', { name: 'First raid' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Quick casual' })).toBeNull();

    goToSetupStep('Rules');
    expect(screen.getByRole('heading', { level: 2, name: /^Standard/ })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Raid clock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Start/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Bonus point' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More rules' }));
    expect(screen.getByRole('switch', { name: 'Bonus point' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Raid clock' }));
    expect(screen.getByRole('heading', { level: 2, name: /^Customised · from Standard/ })).toBeInTheDocument();
    goToSetupStep('Game');
    expect(screen.getByRole('radio', { name: 'Customised' })).toHaveAttribute('aria-checked', 'true');
  });

  it('skipped steps keep their defaults when Start is pressed from the first step', async () => {
    renderQuick('/volleyball/quick');
    fireEvent.click(await screen.findByRole('button', { name: 'Start volleyball' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Volleyball quick match' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add point for Team A' })).toBeInTheDocument();
  });
});

describe('remembered quick setup', () => {
  it('keeps colours and format per sport, never names, and Reset clears them', async () => {
    const first = renderQuick('/volleyball/quick');
    fireEvent.click(await screen.findByRole('radio', { name: 'Single set' }));
    fireEvent.change(await findTeamNameInput('A'), { target: { value: 'Royals' } });
    fireEvent.click(within(teamColourGroup('A')).getByRole('button', { name: 'Yellow' }));
    closeOpenSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));
    await screen.findByRole('button', { name: 'Add point for Royals' });

    const stored = globalThis.localStorage.getItem(SETUP_PREFS_KEY);
    expect(JSON.parse(stored).volleyball).toEqual({ colours: ['#facc15', '#1d4ed8'], formatId: 'sets-1' });
    expect(stored).not.toContain('Royals');

    first.unmount();
    dropDrafts();
    renderQuick('/volleyball/quick');
    expect(await screen.findByRole('status')).toHaveTextContent('Using your last colours for Volleyball.');
    expect(screen.getByRole('radio', { name: 'Best of 3' })).toHaveAttribute('aria-checked', 'true');
    expect(await findTeamNameInput('A')).toHaveValue('Team A');
    expect(within(teamColourGroup('A')).getByRole('button', { name: 'Yellow' })).toHaveAttribute('aria-pressed', 'true');

    goToSetupStep('Game');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByText(/Using your last colours/)).toBeNull();
    expect(screen.getByRole('radio', { name: 'Best of 3' })).toHaveAttribute('aria-checked', 'true');
    expect(within(teamColourGroup('A')).getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
    expect(globalThis.localStorage.getItem(SETUP_PREFS_KEY)).not.toContain('volleyball');
  });

  it('does not carry one sport into another', async () => {
    globalThis.localStorage.setItem(SETUP_PREFS_KEY, JSON.stringify({ volleyball: { colours: ['#facc15', '#1d4ed8'], formatId: 'sets-1' } }));
    renderQuick('/badminton/quick');
    expect(await screen.findByRole('button', { name: 'Start badminton' })).toBeInTheDocument();
    expect(screen.queryByText(/Using your last colours/)).toBeNull();
    expect(within(teamColourGroup('A')).getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
  });
});


it('starts kabaddi standard and offers the last custom rules only on request', async () => {
  const first = renderQuick('/kabaddi/quick');
  expect(await screen.findByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
  goToSetupStep('Rules');
  expect(screen.queryByRole('button', { name: /Use my last custom setup/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Fewer: Minutes a half' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start kabaddi' }));
  expect(loadCustomSetup('kabaddi').format.kabaddiRules.end.halfMs).toBe(1140000);
  first.unmount(); dropDrafts();
  renderQuick('/kabaddi/quick');
  expect(await screen.findByRole('radio', { name: 'Standard' })).toHaveAttribute('aria-checked', 'true');
  goToSetupStep('Rules');
  expect(screen.getByRole('spinbutton', { name: 'Minutes a half' })).toHaveValue('20');
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(screen.getByRole('spinbutton', { name: 'Minutes a half' })).toHaveValue('19');
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
  goToSetupStep('Game');
  fireEvent.click(screen.getByRole('radio', { name: 'Standard' }));
  goToSetupStep('Rules');
  expect(screen.getByRole('spinbutton', { name: 'Minutes a half' })).toHaveValue('20');
});
