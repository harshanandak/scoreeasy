import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareLiveMatch from './ShareLiveMatch';
import { contrastRatio, paletteHex, paletteDarkHex } from '../theme/palette';

// shareText (src/mobile/share.js) is the system-share helper: native → Web Share
// → clipboard. We mock it per-test to drive ShareLiveMatch's confirmation flow.
const shareText = vi.hoisted(() => vi.fn());
vi.mock('../../../mobile/share', () => ({ shareText: (...a) => shareText(...a) }));

// qrcode.react renders an <svg>; stub it so the test doesn't depend on QR internals.
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }) => <svg aria-label="QR code to open the live match" data-value={value} /> }));

const TOKEN = 'TOK123';

beforeEach(() => {
  shareText.mockReset();
  // Default: a working clipboard for the Copy-link button path.
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

describe('Kit share sheet', () => {
  it.each([['light', paletteHex], ['dark', paletteDarkHex]])('%s text pairs meet 4.5:1', (_theme, palette) => {
    for (const [fg, bg] of [
      ['ink', 'surface'], ['ink', 'surfaceWarm'], ['inkSoft', 'surface'],
      ['live', 'liveSoft'], ['danger', 'surface'],
      ['inverse', 'actionHi'], ['inverse', 'action'], ['inverse', 'actionStrong'],
    ]) expect(contrastRatio(palette[fg], palette[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  it('labels the dialog by its headline and keeps the canonical URL in the QR', () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Share the live score' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('QR code to open the live match')).toHaveAttribute('data-value', 'https://scoreeasy.app/live/TOK123');
    expect(screen.getByText('scoreeasy.app/live/TOK123')).toBeInTheDocument();
    expect(screen.getByText('Live · public')).toBeInTheDocument();
  });

  it('traps Tab at both ends and closes with Escape, Done, or the backdrop only', () => {
    const onClose = vi.fn();
    renderSheet({ onClose, onStopSharing: vi.fn() });
    const done = screen.getByRole('button', { name: 'Done' });
    const stop = screen.getByRole('button', { name: 'Stop sharing' });
    expect(done).toHaveFocus();
    fireEvent.keyDown(done, { key: 'Tab', shiftKey: true });
    expect(stop).toHaveFocus();
    fireEvent.keyDown(stop, { key: 'Tab' });
    expect(done).toHaveFocus();
    fireEvent.click(screen.getByRole('heading'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(done, { key: 'Escape' });
    fireEvent.click(done);
    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('closes and invokes the supplied Stop sharing action', () => {
    const onClose = vi.fn();
    const onStopSharing = vi.fn();
    renderSheet({ onClose, onStopSharing });
    fireEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onStopSharing).toHaveBeenCalledOnce();
  });

  it('keeps the copied flash for 1.6 seconds and resets it on re-copy', async () => {
    vi.useFakeTimers();
    renderSheet();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link' })));
    act(() => vi.advanceTimersByTime(1000));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copied ✓' })));
    act(() => vi.advanceTimersByTime(1599));
    expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderSheet(props = {}) {
  return render(
    <ShareLiveMatch token={TOKEN} teamA="Alpha" teamB="Beta" onClose={() => {}} {...props} />,
  );
}

describe('ShareLiveMatch (6fj)', () => {
  it('shows "Copied ✓" after the Copy link button copies to the clipboard', async () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeInTheDocument());
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith('https://scoreeasy.app/live/TOK123');
  });

  it('shows "Copied ✓" when share falls back to a SILENT clipboard copy (no OS sheet)', async () => {
    // shareText reports success via clipboard — previously this gave NO feedback.
    shareText.mockResolvedValue({ shared: true, method: 'clipboard' });
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeInTheDocument());
  });

  it('does NOT flash Copied for a real OS share (native / web-share)', async () => {
    shareText.mockResolvedValue({ shared: true, method: 'web-share' });
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));
    // Give the async handler a tick to settle, then assert no confirmation.
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Copied ✓' })).toBeNull();
  });

  it('does NOT flash Copied when the user cancels the web share sheet', async () => {
    shareText.mockResolvedValue({ shared: false, method: 'web-share-cancelled' });
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: 'Copied ✓' })).toBeNull();
  });

  it('falls back to copyLink (and confirms) when the OS share sheet is unavailable', async () => {
    shareText.mockResolvedValue({ shared: false, method: 'unsupported' });
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Share…' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeInTheDocument());
    expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('shows a copy-failed note when the clipboard API is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: undefined, configurable: true, writable: true });
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(screen.getByText(/Copy failed/i)).toBeInTheDocument());
  });
});
