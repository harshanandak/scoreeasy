import { loadQuickMatchDrafts } from '../../utils/appEntry';
import { applyStandardDefaults } from '../../utils/sportDefaults';
import { applySetsPreset, freezeSetsFormat } from '../../models/setsRules';
import { getSportById } from '../../models/sportRegistry';
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
  const first = renderQuick('/volleyball/quick');
  await screen.findByRole('button', { name: 'Start volleyball' });
  goToSetupStep('Rules');
  expect(screen.queryByRole('button', { name: /Use my last custom setup/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '15' }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));
  const expected = freezeSetsFormat(getSportById('volleyball'), applySetsPreset('volleyball', 'custom', { ...applyStandardDefaults('volleyball', {}), points: 15 }));
  await waitFor(() => expect(loadQuickMatchDrafts().find(d => d.sport === 'volleyball')?.format).toEqual(expected));
  const { setsRules: _rules, ...savedExpected } = expected;
  expect(loadCustomSetup('volleyball').format).toEqual(savedExpected);
  first.unmount(); dropDrafts();
  renderQuick('/volleyball/quick');
  await screen.findByRole('button', { name: 'Start volleyball' });
  goToSetupStep('Rules');
  expect(screen.getByRole('heading', { name: /Standard/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
});


it('keeps card descriptions and started rules consistent with the current edited values', async () => {
  renderQuick('/volleyball/quick');
  await screen.findByRole('button', { name: 'Start volleyball' });
  goToSetupStep('Rules');
  fireEvent.click(screen.getByRole('button', { name: '15' }));
  goToSetupStep('Game');
  const card = screen.getByRole('radio', { name: 'Best of 5' });
  expect(card).toHaveAccessibleDescription(/15 points a set/);
  fireEvent.click(card);
  fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));
  await waitFor(() => expect(loadQuickMatchDrafts().find(d => d.sport === 'volleyball')?.format.setsRules).toMatchObject({ sets: 5, points: 15 }));
});

it('preserves the match toss when applying saved rules and never stores it as a preference', async () => {
  const standard = applyStandardDefaults('volleyball', {});
  saveCustomSetup('volleyball', { format: applySetsPreset('volleyball', 'custom', { ...standard, points: 15, initialServer: 1 }), source: { label: 'Standard', format: standard } });
  renderQuick('/volleyball/quick');
  await screen.findByRole('button', { name: 'Start volleyball' });
  goToSetupStep('Rules');
  fireEvent.click(screen.getByRole('button', { name: 'Team B' }));
  expect(screen.queryByRole('heading', { name: /^Customised/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(screen.getByRole('button', { name: 'Team B' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));
  expect(loadCustomSetup('volleyball').format).not.toHaveProperty('initialServer');
  await waitFor(() => expect(loadQuickMatchDrafts().find(d => d.sport === 'volleyball')?.format.setsRules.initialServer).toBe(2));
});

it('does not overwrite a saved custom setup after selecting an unchanged Custom chip', async () => {
  const previous = { ...applyStandardDefaults('volleyball', {}), points: 15, rulesPreset: 'Custom school' };
  saveCustomSetup('volleyball', { format: previous });
  renderQuick('/volleyball/quick');
  await screen.findByRole('button', { name: 'Start volleyball' });
  goToSetupStep('Rules');
  fireEvent.click(screen.getByRole('radio', { name: 'Custom school' }));
  expect(screen.getByRole('heading', { name: /^Custom school/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start volleyball' }));
  expect(loadCustomSetup('volleyball').format).toEqual(previous);
});
