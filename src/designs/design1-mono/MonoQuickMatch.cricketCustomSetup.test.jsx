import { loadQuickMatchDrafts } from '../../utils/appEntry';
import { buildCricketFormat } from '../../utils/cricketCalculations';
import { cricketRuleValues } from './kit/CricketSetup';
import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonoQuickMatch from './MonoQuickMatch';
import { loadCustomSetup, saveCustomSetup } from '../../utils/setupPrefs';
import { goToSetupStep } from '../../test/teamColour';

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


it('keeps the last edited setup after starting an unedited Custom card', async () => {
  const previous = buildCricketFormat('custom', { overs: 15, players: 8 });
  saveCustomSetup('cricket', { format: previous });
  renderQuick('/cricket/quick');
  fireEvent.click(await screen.findByRole('radio', { name: 'Custom' }));
  goToSetupStep('Rules');
  expect(screen.getByRole('heading', { name: /^Custom / })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start cricket' }));
  expect(loadCustomSetup('cricket').format).toEqual(previous);
});

it('retains the source preset when a customised match is restored', async () => {
  const first = renderQuick('/cricket/quick');
  await screen.findByRole('button', { name: 'Start cricket' });
  goToSetupStep('Rules');
  fireEvent.click(screen.getByRole('button', { name: 'Fewer: Players per side' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start cricket' }));
  await waitFor(() => expect(loadQuickMatchDrafts().find(d => d.sport === 'cricket')?.customSetupSource?.label).toBe('T20'));
  first.unmount();
  renderQuick('/cricket/quick');
  await screen.findByRole('heading', { name: 'Cricket quick match' });
  expect(loadQuickMatchDrafts().find(d => d.sport === 'cricket').customSetupSource.label).toBe('T20');
});

it('applies saved overs to the visible editor after typed overs', async () => {
  const source = { label: 'T20', format: buildCricketFormat('T20') };
  saveCustomSetup('cricket', { format: buildCricketFormat('custom', { ...cricketRuleValues(source.format), players: 8 }), source });
  renderQuick('/cricket/quick');
  await screen.findByRole('button', { name: 'Start cricket' });
  goToSetupStep('Rules');
  fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom overs (1 to 50)' }), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(screen.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('spinbutton', { name: 'Custom overs (1 to 50)' })).toBeNull();
  expect(screen.getByRole('heading', { name: /^Customised.*from T20/ })).toBeInTheDocument();
});
