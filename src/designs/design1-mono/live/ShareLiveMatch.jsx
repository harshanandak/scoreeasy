import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import { watchUrl } from '../../../lib/live/watchUrl';
import { shareText } from '../../../mobile/share';

// ShareLiveMatch (issue 6fj): a small sheet to hand a live match to spectators.
// QR (scan to open /live/:token), the canonical link (copy), and a system share
// sheet (native Share plugin → Web Share → clipboard, via src/mobile/share.js).
// No sign-in needed on the watch side; possession of the token IS the grant.

export default function ShareLiveMatch({ token, teamA, teamB, onClose }) {
  const url = watchUrl(token);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const title = teamA && teamB ? `${teamA} vs ${teamB} — live` : 'Live match';

  // Shared confirmation flash so BOTH the copy button and the share→clipboard
  // fallback surface "Copied ✓" identically. Hold the timer in a ref so rapid
  // re-copies clear the prior timeout (instead of stacking N timers that each
  // race to flip `copied` off), and so we can clean it up on unmount.
  const copyTimerRef = useRef(null);
  const flashCopied = () => {
    setShareNote('');
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null;
      setCopied(false);
    }, 1600);
  };

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const copyLink = async () => {
    try {
      // Guard explicitly: with optional chaining, a missing Clipboard API (non-secure
      // context / some native webviews) makes `?.writeText(url)` evaluate to undefined,
      // and `await undefined` resolves — so we'd flash "Copied ✓" without copying.
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error('clipboard-unavailable');
      await clipboard.writeText(url);
      flashCopied();
    } catch {
      setShareNote('Copy failed — long-press the link to copy.');
    }
  };

  const share = async () => {
    const res = await shareText({ title, text: `Watch ${title}`, url, dialogTitle: 'Share live match' });
    if (res.shared && res.method === 'clipboard') {
      // No OS share sheet — shareText silently copied to the clipboard. That path
      // gave NO feedback before; confirm it the same way the Copy button does so a
      // clipboard-only share isn't mistaken for a no-op.
      flashCopied();
    } else if (!res.shared && res.method !== 'web-share-cancelled') {
      // Fall back to copy if the OS share sheet was unavailable.
      await copyLink();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share live match"
      className="mono-sheet-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
      }}
      onClick={onClose}
    >
      <div
        className="mono-card"
        style={{
          background: 'var(--background)', width: '100%', maxWidth: 440,
          borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-swiss" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--se-color-ink-muted)' }}>
          Share live match
        </p>

        <div style={{ background: '#fff', padding: 12, borderRadius: 12 }}>
          <QRCodeSVG value={url} size={184} includeMargin={false} aria-label="QR code to open the live match" />
        </div>

        <p style={{ fontSize: '0.875rem', textAlign: 'center', color: 'var(--se-color-ink-muted)' }}>
          Anyone with this link can watch — no sign-in needed.
        </p>

        <code
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
            wordBreak: 'break-all', textAlign: 'center', color: 'var(--se-color-ink)',
            background: 'var(--muted)', padding: '8px 12px', borderRadius: 8, width: '100%',
          }}
        >
          {url}
        </code>

        <div className="mono-quick-action-row" style={{ width: '100%' }}>
          <button type="button" onClick={copyLink} className="mono-btn" style={{ flex: 1 }}>
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
          <button type="button" onClick={share} className="mono-btn" style={{ flex: 1, color: 'var(--primary)' }}>
            Share…
          </button>
        </div>

        {shareNote && (
          <p style={{ fontSize: '0.75rem', color: 'var(--destructive)' }}>{shareNote}</p>
        )}

        <button type="button" onClick={onClose} className="mono-btn" style={{ width: '100%' }}>
          Done
        </button>
      </div>
    </div>
  );
}

ShareLiveMatch.propTypes = {
  token: PropTypes.string.isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
