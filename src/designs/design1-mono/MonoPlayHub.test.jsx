import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MonoPlayHub from './MonoPlayHub';

const PLAY_MODE_KEY = 'se_play_mode';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{`${location.pathname}${location.search}`}</output>;
}

function renderPlayHub() {
  return render(
    <MemoryRouter initialEntries={['/play']}>
      <LocationProbe />
      <Routes>
        <Route path="/play" element={<MonoPlayHub />} />
        <Route path="/:sport/quick" element={<p>Quick setup</p>} />
        <Route path="/:sport/tournament" element={<p>Tournament hub</p>} />
        <Route path="/:sport/tournament/new" element={<p>New tournament setup</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/* Guided renders the wizard (its first step is "PICK A SPORT").
   Browse renders the MonoSportHome ledger (heading "Play" + "Choose sport"). */
const guidedMarker = () => screen.queryByText('PICK A SPORT');
const browseMarker = () => screen.queryByRole('region', { name: 'Choose sport' });

describe('MonoPlayHub Guided | Browse toggle', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      callback?.(0);
      return 1;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  it('defaults to Guided when the device has no saved data', () => {
    renderPlayHub();

    expect(guidedMarker()).toBeInTheDocument();
    expect(browseMarker()).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Guided' })).toHaveAttribute('aria-selected', 'true');
  });

  it('defaults to Browse when the device already has saved matches', () => {
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'recent-1', sport: 'cricket', team1: 'A', team2: 'B' },
    ]));

    renderPlayHub();

    expect(browseMarker()).toBeInTheDocument();
    expect(guidedMarker()).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Browse' })).toHaveAttribute('aria-selected', 'true');
  });

  it('honours a saved mode preference over the data signal', () => {
    globalThis.localStorage.setItem(PLAY_MODE_KEY, 'browse');

    renderPlayHub();

    expect(browseMarker()).toBeInTheDocument();
    expect(guidedMarker()).not.toBeInTheDocument();
  });

  it('toggles between Guided and Browse and persists the choice', () => {
    renderPlayHub();

    // Starts Guided (no data) and persists that on mount.
    expect(guidedMarker()).toBeInTheDocument();
    expect(globalThis.localStorage.getItem(PLAY_MODE_KEY)).toBe('guided');

    fireEvent.click(screen.getByRole('tab', { name: 'Browse' }));

    expect(browseMarker()).toBeInTheDocument();
    expect(guidedMarker()).not.toBeInTheDocument();
    expect(globalThis.localStorage.getItem(PLAY_MODE_KEY)).toBe('browse');

    fireEvent.click(screen.getByRole('tab', { name: 'Guided' }));

    expect(guidedMarker()).toBeInTheDocument();
    expect(browseMarker()).not.toBeInTheDocument();
    expect(globalThis.localStorage.getItem(PLAY_MODE_KEY)).toBe('guided');
  });

  it('drives the Guided wizard through to the tournament-setup contract', async () => {
    // Preserves the wizard's navigate contract (now reached via the hub):
    // /{sport}/tournament/new with { state: { fromWizard, teams, tournamentName } }.
    renderPlayHub();

    fireEvent.click(await screen.findByRole('button', { name: /Volleyball/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tournament/i }));
    fireEvent.change(screen.getByLabelText('TOURNAMENT NAME'), { target: { value: 'Office Cup' } });
    fireEvent.change(screen.getByPlaceholderText('Team 1'), { target: { value: 'Eagles' } });
    fireEvent.change(screen.getByPlaceholderText('Team 2'), { target: { value: 'Hawks' } });

    fireEvent.click(await screen.findByText('Office Cup'));

    await waitFor(() => {
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/volleyball/tournament/new');
    });
    expect(screen.getByText('New tournament setup')).toBeInTheDocument();
  });
});
