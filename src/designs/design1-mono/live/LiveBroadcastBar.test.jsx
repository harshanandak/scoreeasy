import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LiveBroadcastBar from './LiveBroadcastBar';
import MonoSheet from '../components/MonoSheet';

// Navigate is mocked to a spy so we can assert the sign-in route; the rest of
// react-router-dom (MemoryRouter, useLocation) stays real.
const nav = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => nav }));

// Auth is mocked per-test; default = signed in with a cloud backend, resolved.
const auth = vi.hoisted(() => ({ cloudAuthAvailable: true, isAuthenticated: true, isUserReady: true }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth }));

beforeEach(() => {
  localStorage.clear();
  nav.mockClear();
  auth.cloudAuthAvailable = true;
  auth.isAuthenticated = true;
  auth.isUserReady = true;
});

function makeBroadcast(overrides = {}) {
  return {
    goLive: vi.fn().mockResolvedValue({ token: 'TOK', matchId: 'mid1' }),
    setVisibility: vi.fn().mockResolvedValue({ ok: true }),
    isLive: false,
    token: null,
    ...overrides,
  };
}

const descriptor = {
  clientMatchId: 'cm1',
  sport: 'football',
  scorecardKind: 'goals',
  teamA: { name: 'Alpha' },
  teamB: { name: 'Beta' },
};

function renderBar(props) {
  return render(
    <MemoryRouter initialEntries={['/football/quick']}>
      <LiveBroadcastBar {...props} />
    </MemoryRouter>,
  );
}

describe('LiveBroadcastBar (b0z)', () => {
  it('shows the one-time consent disclosure when consent is unseen', () => {
    const broadcast = makeBroadcast();
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });
    expect(screen.getByText(/Scores and team names will be public/i)).toBeInTheDocument();
    expect(broadcast.goLive).not.toHaveBeenCalled();
  });

  it('accepting consent enables broadcasting and persists the choice', () => {
    const broadcast = makeBroadcast();
    const onEnableChange = vi.fn();
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange });

    fireEvent.click(screen.getByRole('button', { name: 'Share live' }));

    expect(onEnableChange).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('se_live_public_consent')).toContain('accepted');
  });

  it('declining keeps the match private and never broadcasts', () => {
    const broadcast = makeBroadcast();
    const onEnableChange = vi.fn();
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange });

    fireEvent.click(screen.getByRole('button', { name: 'Keep private' }));

    expect(onEnableChange).toHaveBeenCalledWith(false);
    expect(broadcast.goLive).not.toHaveBeenCalled();
    expect(localStorage.getItem('se_live_public_consent')).toContain('declined');
  });

  it('fires goLive exactly once when enabled and consent already accepted', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast();
    const { rerender } = renderBar({ broadcast, descriptor, enabled: true, onEnableChange: () => {} });

    expect(broadcast.goLive).toHaveBeenCalledTimes(1);
    expect(broadcast.goLive).toHaveBeenCalledWith(descriptor);

    rerender(
      <MemoryRouter initialEntries={['/football/quick']}>
        <LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={() => {}} />
      </MemoryRouter>,
    );
    expect(broadcast.goLive).toHaveBeenCalledTimes(1);
  });

  it('when live, shows LIVE + Share + Stop; Stop flips visibility to private', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, token: 'TOK' });
    const onEnableChange = vi.fn();
    renderBar({ broadcast, descriptor, enabled: true, onEnableChange });

    expect(screen.getByText('Live · public')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(broadcast.setVisibility).toHaveBeenCalledWith('private');
    expect(onEnableChange).toHaveBeenCalledWith(false);
  });

  it('Go live when no match exists yet re-enables without re-publishing', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('declined'));
    const broadcast = makeBroadcast({ isLive: false });
    const onEnableChange = vi.fn();
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange });

    fireEvent.click(screen.getByRole('button', { name: /Go live/i }));

    expect(broadcast.setVisibility).not.toHaveBeenCalled();
    expect(onEnableChange).toHaveBeenCalledWith(true);
  });

  it('retries a FAILED initial go-live when Go live is tapped (effect re-fires)', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: false });
    broadcast.goLive.mockResolvedValue(null);
    renderBar({ broadcast, descriptor, enabled: true, onEnableChange: () => {} });

    expect(broadcast.goLive).toHaveBeenCalledTimes(1); // initial (failed)
    fireEvent.click(screen.getByRole('button', { name: /Go live/i }));
    expect(broadcast.goLive).toHaveBeenCalledTimes(2); // retried
  });

  it('opens the share sheet from the live state', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, token: 'TOK' });
    renderBar({ broadcast, descriptor, enabled: true, onEnableChange: () => {} });

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'Share the live score' })).toBeInTheDocument();
    expect(screen.getByText('scoreeasy.app/live/TOK')).toBeInTheDocument();
  });

  // --- auth-aware behaviour (live-ux) ---
  it('routes a signed-out user to sign-in instead of a silently-failing go-live', () => {
    auth.isAuthenticated = false;
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast();
    renderBar({ broadcast, descriptor, enabled: true, onEnableChange: () => {} });

    expect(broadcast.goLive).not.toHaveBeenCalled(); // effect gated on auth
    fireEvent.click(screen.getByRole('button', { name: /Sign in to go live/i }));
    expect(nav).toHaveBeenCalledWith(expect.stringContaining('/login?returnTo='));
  });

  it('surfaces a failed go-live error instead of swallowing it (Go live doubles as retry)', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('declined'));
    const broadcast = makeBroadcast({ isLive: false, error: new Error('boom') });
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Couldn.t go live/i);
    // The retry control is the existing Go live button, not a second one.
    expect(screen.getByRole('button', { name: /Go live/i })).toBeInTheDocument();
  });

  it('does not show an error alert when go-live has not failed', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('declined'));
    const broadcast = makeBroadcast({ isLive: false });
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does NOT show the go-live error after a FAILED Stop (isLive stays true, enabled flipped off)', () => {
    // A failed Stop sets the hook's shared `error` but leaves isLive=true while
    // enabled=false, so render falls through to the bottom branch. The go-live copy
    // must NOT appear — that error came from setVisibility/finalize, not go-live.
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, error: new Error('stop failed') });
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Couldn.t go live/i)).toBeNull();
    // We're still in the bottom (offer-to-go-live) branch, so the button remains.
    expect(screen.getByRole('button', { name: /Go live/i })).toBeInTheDocument();
  });

  it('explains why an account is needed (free + private-until-live)', () => {
    auth.isAuthenticated = false;
    const broadcast = makeBroadcast();
    renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });
    expect(screen.getByText(/free account/i)).toBeInTheDocument();
    expect(screen.getByText(/stay private until you go live/i)).toBeInTheDocument();
  });

  it('renders nothing when there is no cloud backend (offline build)', () => {
    auth.cloudAuthAvailable = false;
    const broadcast = makeBroadcast();
    const { container } = renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while auth is still resolving (no premature sign-in flash)', () => {
    auth.isAuthenticated = false;
    auth.isUserReady = false;
    const broadcast = makeBroadcast();
    const { container } = renderBar({ broadcast, descriptor, enabled: false, onEnableChange: () => {} });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /Sign in to go live/i })).toBeNull();
  });
});

describe('Kit live controls', () => {
  it('closes only Share on Escape when nested in scorer options', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const closeOptions = vi.fn();
    render(<MemoryRouter><MonoSheet open onClose={closeOptions} title="Match options">
      <LiveBroadcastBar broadcast={makeBroadcast({ isLive: true, token: 'TOK' })} descriptor={descriptor} enabled onEnableChange={vi.fn()} />
    </MonoSheet></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Done' }), { key: 'Escape' });
    expect(closeOptions).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Share the live score' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toHaveFocus();
  });
  it('offers consent in place with a headline and full-width Kit controls', () => {
    renderBar({ broadcast: makeBroadcast(), descriptor, enabled: false, onEnableChange: vi.fn() });
    expect(screen.getByRole('heading', { name: 'Share this match live?' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share live' })).toHaveClass('se-go');
    expect(screen.getByRole('button', { name: 'Keep private' })).toHaveClass('se-ctl');
  });

  it('stops from the sheet with the same visibility action as the bar', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, token: 'TOK' });
    const onEnableChange = vi.fn();
    renderBar({ broadcast, descriptor, enabled: true, onEnableChange });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(broadcast.setVisibility).toHaveBeenCalledExactlyOnceWith('private');
    expect(onEnableChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to Share after Done or Escape', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    renderBar({ broadcast: makeBroadcast({ isLive: true, token: 'TOK' }), descriptor, enabled: true, onEnableChange: vi.fn() });
    const share = screen.getByRole('button', { name: 'Share' });
    fireEvent.click(share);
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(share).toHaveFocus();
    fireEvent.click(share);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(share).toHaveFocus();
  });
});
