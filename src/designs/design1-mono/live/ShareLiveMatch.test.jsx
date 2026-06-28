import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareLiveMatch from './ShareLiveMatch';

// shareText (src/mobile/share.js) is the system-share helper: native → Web Share
// → clipboard. We mock it per-test to drive ShareLiveMatch's confirmation flow.
const shareText = vi.hoisted(() => vi.fn());
vi.mock('../../../mobile/share', () => ({ shareText: (...a) => shareText(...a) }));

// qrcode.react renders an <svg>; stub it so the test doesn't depend on QR internals.
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => null }));

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
