import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import ShareLiveMatch from './ShareLiveMatch';
import { getConsent, setConsent } from '../../../lib/live/liveSession';

// LiveBroadcastBar (issue b0z): the operator-facing live control.
//
// Public-by-default with a ONE-TIME consent disclosure (§7): the first time a
// user could go live we explain that scores + team names become public to anyone
// with the link, and let them opt out. After that the choice is remembered
// globally (se_live_public_consent) and matches go live automatically — with a
// per-match "Stop sharing" to flip back to private at any point.
//
// It OWNS the go-live trigger (so screens stay thin): when broadcasting is
// enabled and consent is accepted, it fires `broadcast.goLive(descriptor)` once.
// The scorer just calls broadcast.point/undo/finalize at its existing handlers.

export default function LiveBroadcastBar({ broadcast, descriptor, enabled, onEnableChange }) {
  const [consent, setConsentState] = useState(() => getConsent());
  const [shareOpen, setShareOpen] = useState(false);
  const startedRef = useRef(false);

  // Fire go-live exactly once per mount when broadcasting is on and consented.
  useEffect(() => {
    if (enabled && consent === 'accepted' && descriptor?.clientMatchId && !startedRef.current) {
      startedRef.current = true;
      void broadcast.goLive(descriptor);
    }
  }, [enabled, consent, descriptor, broadcast]);

  const accept = () => {
    setConsent('accepted');
    setConsentState('accepted');
    onEnableChange(true);
  };

  const decline = () => {
    setConsent('declined');
    setConsentState('declined');
    onEnableChange(false);
  };

  const goLiveNow = () => {
    // Opt back in for this match (consent already seen).
    if (consent !== 'accepted') {
      setConsent('accepted');
      setConsentState('accepted');
    }
    if (broadcast.isLive) {
      // Already created — "Stop" only flipped us to private, so re-publish.
      // (Without this, startedRef has latched and the one-shot effect below
      // would never re-fire, leaving the match live-but-private = nobody sees it.)
      void broadcast.setVisibility('public');
    } else {
      // Never created (declined from the start) or a prior go-live failed:
      // re-arm the one-shot effect so it can (re)create the match.
      startedRef.current = false;
    }
    onEnableChange(true);
  };

  const stopSharing = () => {
    void broadcast.setVisibility('private');
    onEnableChange(false);
  };

  // First-ever decision: the one-time disclosure card.
  if (consent === null) {
    return (
      <div
        className="mono-card"
        style={{ padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
        role="region"
        aria-label="Live sharing"
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--se-color-ink)' }}>
          Share this match <strong>live</strong>? Scores and team names will be public to anyone with the link.
        </p>
        <div className="mono-quick-action-row">
          <button type="button" onClick={accept} className="mono-btn" style={{ flex: 1, color: 'var(--primary)' }}>
            Share live
          </button>
          <button type="button" onClick={decline} className="mono-btn" style={{ flex: 1 }}>
            Keep private
          </button>
        </div>
      </div>
    );
  }

  // Live: status pill + share + stop.
  if (enabled && broadcast.isLive) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
        role="region"
        aria-label="Live sharing"
      >
        <span className="mono-badge mono-badge-live" aria-label="Broadcasting live" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true">●</span> LIVE · public
        </span>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="mono-btn"
          disabled={!broadcast.token}
          style={{ marginLeft: 'auto' }}
        >
          Share
        </button>
        <button type="button" onClick={stopSharing} className="mono-btn">
          Stop
        </button>
        {shareOpen && broadcast.token && (
          <ShareLiveMatch
            token={broadcast.token}
            teamA={descriptor?.teamA?.name}
            teamB={descriptor?.teamB?.name}
            onClose={() => setShareOpen(false)}
          />
        )}
      </div>
    );
  }

  // Consent given but not currently broadcasting (declined, or stopped): offer to go live.
  return (
    <div style={{ marginBottom: 12 }} role="region" aria-label="Live sharing">
      <button type="button" onClick={goLiveNow} className="mono-btn" style={{ width: '100%' }}>
        Go live
      </button>
    </div>
  );
}

LiveBroadcastBar.propTypes = {
  broadcast: PropTypes.shape({
    goLive: PropTypes.func.isRequired,
    setVisibility: PropTypes.func.isRequired,
    isLive: PropTypes.bool,
    token: PropTypes.string,
  }).isRequired,
  descriptor: PropTypes.shape({
    clientMatchId: PropTypes.string,
    teamA: PropTypes.shape({ name: PropTypes.string }),
    teamB: PropTypes.shape({ name: PropTypes.string }),
  }),
  enabled: PropTypes.bool.isRequired,
  onEnableChange: PropTypes.func.isRequired,
};
