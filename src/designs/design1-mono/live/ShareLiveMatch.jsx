import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { QRCodeSVG } from 'qrcode.react';
import { watchUrl } from '../../../lib/live/watchUrl';
import { shareText } from '../../../mobile/share';
import '../kit/sharelive.css';

// ShareLiveMatch (issue 6fj): a small sheet to hand a live match to spectators.
// QR (scan to open /live/:token), the canonical link (copy), and a system share
// sheet (native Share plugin → Web Share → clipboard, via src/mobile/share.js).
// No sign-in needed on the watch side; possession of the token IS the grant.

export default function ShareLiveMatch({ token, teamA, teamB, onClose, onStopSharing }) {
  const url = watchUrl(token);
  const [copied, setCopied] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const headingId = useId();
  const sheetRef = useRef(null);
  const doneRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    doneRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const handleKeyDown = (event) => {
    // Keep the scorer's options sheet underneath from handling this sheet's keys.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      event.stopPropagation();
      const buttons = sheetRef.current.querySelectorAll('button:not(:disabled)');
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

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

  return createPortal(
    <div
      className="kit-share-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="mono-sheet kit-share-sheet"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kit-share-grab" aria-hidden="true" />
        <div className="kit-share-livebar">
          <span className="kit-live-pill">Live · public</span>
          <button ref={doneRef} type="button" onClick={onClose} className="se-ctl">Done</button>
        </div>
        <h2 id={headingId}>Share the live score</h2>
        <p>Anyone with the link can watch. No sign-in needed.</p>

        <div className="kit-share-qr">
          <QRCodeSVG value={url} size={152} includeMargin={false} aria-label="QR code to open the live match" />
        </div>
        <div className="kit-share-link">
          <span>{url.replace(/^https?:\/\//, '')}</span>
          <button type="button" onClick={copyLink} className="se-ctl">
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
        {shareNote && (
          <p className="kit-live-error" role="status">{shareNote}</p>
        )}
        <div className="kit-live-stack">
          <button type="button" onClick={share} className="se-ctl">Share…</button>
        </div>
        {onStopSharing && (
          <button type="button" className="kit-share-danger" onClick={() => {
            onClose();
            onStopSharing();
          }}>Stop sharing</button>
        )}
      </div>
    </div>,
    document.body,
  );
}

ShareLiveMatch.propTypes = {
  token: PropTypes.string.isRequired,
  teamA: PropTypes.string,
  teamB: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onStopSharing: PropTypes.func,
};
