import { loadQuickMatchDrafts } from '../../utils/appEntry';
import { buildCricketFormat } from '../../utils/cricketCalculations';
import { cricketRuleValues } from './kit/CricketSetup';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
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


it('starts with standard rules, saves Custom on Start, and applies it only when requested', async () => {
  const first = renderQuick('/cricket/quick');
  await screen.findByRole('button', { name: 'Start cricket' });
  goToSetupStep('Rules');
  expect(screen.queryByRole('button', { name: /Use my last custom setup/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Fewer: Players per side' }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start cricket' }));
  const expected = buildCricketFormat('custom', cricketRuleValues({ ...buildCricketFormat('T20'), players: 10 }));
  await waitFor(() => expect(loadQuickMatchDrafts().find(d => d.sport === 'cricket')?.format).toEqual(expected));
  expect(loadCustomSetup('cricket').format).toEqual(expected);
  first.unmount(); dropDrafts();
  renderQuick('/cricket/quick');
  await screen.findByRole('button', { name: 'Start cricket' });
  goToSetupStep('Rules');
  expect(screen.getByRole('heading', { name: /T20/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
});
