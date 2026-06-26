import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LiveBroadcastBar from './LiveBroadcastBar';

beforeEach(() => {
  localStorage.clear();
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

describe('LiveBroadcastBar (b0z)', () => {
  it('shows the one-time consent disclosure when consent is unseen', () => {
    const broadcast = makeBroadcast();
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled={false} onEnableChange={() => {}} />);
    expect(screen.getByText(/Scores and team names will be public/i)).toBeInTheDocument();
    expect(broadcast.goLive).not.toHaveBeenCalled();
  });

  it('accepting consent enables broadcasting and persists the choice', () => {
    const broadcast = makeBroadcast();
    const onEnableChange = vi.fn();
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled={false} onEnableChange={onEnableChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Share live' }));

    expect(onEnableChange).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('se_live_public_consent')).toContain('accepted');
  });

  it('declining keeps the match private and never broadcasts', () => {
    const broadcast = makeBroadcast();
    const onEnableChange = vi.fn();
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled={false} onEnableChange={onEnableChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Keep private' }));

    expect(onEnableChange).toHaveBeenCalledWith(false);
    expect(broadcast.goLive).not.toHaveBeenCalled();
    expect(localStorage.getItem('se_live_public_consent')).toContain('declined');
  });

  it('fires goLive exactly once when enabled and consent already accepted', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast();
    const { rerender } = render(
      <LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={() => {}} />,
    );

    expect(broadcast.goLive).toHaveBeenCalledTimes(1);
    expect(broadcast.goLive).toHaveBeenCalledWith(descriptor);

    rerender(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={() => {}} />);
    expect(broadcast.goLive).toHaveBeenCalledTimes(1);
  });

  it('when live, shows LIVE + Share + Stop; Stop flips visibility to private', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, token: 'TOK' });
    const onEnableChange = vi.fn();
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={onEnableChange} />);

    expect(screen.getByText(/LIVE/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(broadcast.setVisibility).toHaveBeenCalledWith('private');
    expect(onEnableChange).toHaveBeenCalledWith(false);
  });

  it('Stop then resume goes private then re-publishes (full transition)', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, token: 'TOK' });
    const onEnableChange = vi.fn();
    // Start LIVE (the real precondition), then drive Stop -> resume rather than
    // mounting straight into the stopped state.
    const { rerender } = render(
      <LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={onEnableChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(broadcast.setVisibility).toHaveBeenLastCalledWith('private');
    expect(onEnableChange).toHaveBeenLastCalledWith(false);

    // Parent reflects the disable; now the bar shows "Go live" — resume.
    rerender(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled={false} onEnableChange={onEnableChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    expect(broadcast.setVisibility).toHaveBeenLastCalledWith('public');
    expect(onEnableChange).toHaveBeenLastCalledWith(true);
  });

  it('Go live when no match exists yet re-enables without re-publishing', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('declined'));
    const broadcast = makeBroadcast({ isLive: false });
    const onEnableChange = vi.fn();
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled={false} onEnableChange={onEnableChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));

    expect(broadcast.setVisibility).not.toHaveBeenCalled();
    expect(onEnableChange).toHaveBeenCalledWith(true);
  });

  it('retries a FAILED initial go-live when Go live is tapped (effect re-fires)', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    // A failed go-live: the hook resolves null and isLive stays false (the hook
    // never rejects). startedRef has latched, so without the retry-nonce bump the
    // effect would never re-fire and the operator would be stuck.
    const broadcast = makeBroadcast({ isLive: false });
    broadcast.goLive.mockResolvedValue(null);
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={() => {}} />);

    expect(broadcast.goLive).toHaveBeenCalledTimes(1); // initial (failed)
    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    expect(broadcast.goLive).toHaveBeenCalledTimes(2); // retried
  });

  it('opens the share sheet from the live state', () => {
    localStorage.setItem('se_live_public_consent', JSON.stringify('accepted'));
    const broadcast = makeBroadcast({ isLive: true, token: 'TOK' });
    render(<LiveBroadcastBar broadcast={broadcast} descriptor={descriptor} enabled onEnableChange={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByRole('dialog', { name: 'Share live match' })).toBeInTheDocument();
    expect(screen.getByText('https://scoreeasy.app/live/TOK')).toBeInTheDocument();
  });
});
