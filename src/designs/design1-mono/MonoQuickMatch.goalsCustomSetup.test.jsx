import { loadQuickMatchDrafts } from '../../utils/appEntry';
import { periodPreset } from '../../utils/goalsPeriods';
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
  const first = renderQuick('/basketball/quick');
  await screen.findByRole('button', { name: 'Start basketball' });
  goToSetupStep('Rules');
  expect(screen.queryByRole('button', { name: /Use my last custom setup/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Fewer: Minutes per period' }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start basketball' }));
  const expected = periodPreset('basketball', 'custom', 4, 9);
  await waitFor(() => expect(loadQuickMatchDrafts().find(d => d.sport === 'basketball')?.format).toEqual(expected));
  expect(loadCustomSetup('basketball').format).toEqual(expected);
  first.unmount(); dropDrafts();
  renderQuick('/basketball/quick');
  await screen.findByRole('button', { name: 'Start basketball' });
  goToSetupStep('Rules');
  expect(screen.getByRole('heading', { name: /FIBA/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Use my last custom setup/ }));
  expect(screen.getByRole('heading', { name: /^Customised/ })).toBeInTheDocument();
});


it('does not overwrite saved rules when an unchanged Custom card starts', async () => {
  const previous = periodPreset('basketball', 'custom', 4, 9);
  saveCustomSetup('basketball', { format: previous });
  renderQuick('/basketball/quick');
  fireEvent.click(await screen.findByRole('radio', { name: 'Custom school/event' }));
  goToSetupStep('Rules');
  expect(screen.getByRole('heading', { name: /^Custom school\/event/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Reset to/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start basketball' }));
  expect(loadCustomSetup('basketball').format).toEqual(previous);
});
