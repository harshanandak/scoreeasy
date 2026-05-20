import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OfflineFallback from './OfflineFallback';

function setOnlineState(isOnline) {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: isOnline,
  });
}

describe('OfflineFallback', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    setOnlineState(true);
  });

  it('stays hidden while online', () => {
    setOnlineState(true);

    render(
      <MemoryRouter>
        <OfflineFallback />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Offline mode')).not.toBeInTheDocument();
  });

  it('explains local scoring and exposes offline-safe actions', () => {
    setOnlineState(false);
    globalThis.localStorage.setItem('se_quickmatches', JSON.stringify([
      { id: 'match-1', team1: 'Team A', team2: 'Team B' },
    ]));

    render(
      <MemoryRouter>
        <OfflineFallback />
      </MemoryRouter>,
    );

    expect(screen.getByText('Offline mode')).toBeInTheDocument();
    expect(screen.getByText(/Scoring stays available locally/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start quick match' })).toHaveAttribute('href', '/volleyball/quick');
    expect(screen.getByRole('link', { name: 'View saved matches' })).toHaveAttribute('href', '/history');
  });
});
