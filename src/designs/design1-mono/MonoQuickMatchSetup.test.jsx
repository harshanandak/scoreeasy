import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonoQuickMatch setup clarity', () => {
  it('opens volleyball quick match on labeled teams with an immediate start path', async () => {
    renderQuickMatch();

    expect(await screen.findByRole('textbox', { name: 'Team A name' })).toHaveValue('Team A');
    expect(screen.getByRole('textbox', { name: 'Team B name' })).toHaveValue('Team B');
    expect(screen.getByRole('heading', { name: 'Match rules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Match' })).toBeEnabled();
    expect(screen.queryByText('Format Mode')).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Start Match' }));

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
});
