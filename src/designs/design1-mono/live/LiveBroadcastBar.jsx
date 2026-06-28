import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import ShareLiveMatch from './ShareLiveMatch';
import { getConsent, setConsent } from '../../../lib/live/liveSession';
import { useAuth } from '../../../hooks/useAuth';

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
  // Bumped to force the one-shot effect to re-run after a FAILED go-live (a ref
  // reset alone doesn't schedule an effect, and onEnableChange(true) is a
  // same-value no-op when enabled was already true).
  const [retryNonce, setRetryNonce] = useState(0);
  const { cloudAuthAvailable, isAuthenticated, isUserReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Fire go-live exactly once per mount when broadcasting is on, consented, AND the
  // user is signed in (create is authed — never fire for a signed-out user).
  useEffect(() => {
    if (isAuthenticated && enabled && consent === 'accepted' && descriptor?.clientMatchId && !startedRef.current) {
      startedRef.current = true;
      void broadcast.goLive(descriptor);
    }
  }, [isAuthenticated, enabled, consent, descriptor, broadcast, retryNonce]);

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
      // setVisibility is NOT enabled-gated in the hook (visibility control works
      // whenever a match exists), so this runs even though `enabled` is still
      // false at this instant (onEnableChange(true) below is async).
      void broadcast.setVisibility('public');
    } else {
      // Never created (declined from the start) or a prior go-live FAILED:
      // re-arm + bump the nonce so the one-shot effect actually re-runs and
      // (re)creates the match (a bare ref reset would not schedule the effect).
      startedRef.current = false;
      setRetryNonce((n) => n + 1);
    }
    onEnableChange(true);
  };

  const stopSharing = () => {
    void broadcast.setVisibility('private');
    onEnableChange(false);
  };

  // No cloud backend (offline build) → broadcasting isn't possible; render nothing.
  if (!cloudAuthAvailable) return null;

  // Going live needs an account (create is an authed mutation). Rather than show a
  // control that fails silently, route a signed-out user to sign-in — but only once
  // auth has RESOLVED, so a logged-in user reloading doesn't flash "Sign in" before
  // their session hydrates.
  if (!isAuthenticated) {
    if (!isUserReady) return null;
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <div style={{ marginBottom: 12 }} role="region" aria-label="Live sharing">
        <button
          type="button"
          onClick={() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}
          className="mono-btn"
          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <span aria-hidden="true" style={{ color: '#dc2626' }}>●</span> Sign in to go live
        </button>
        <p style={{ margin: '6px 2px 0', fontSize: '0.75rem', color: 'var(--se-color-ink-muted)' }}>
          A free account lets you share the live scoreboard — your matches stay private until you go live.
        </p>
      </div>
    );
  }

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
  // A FAILED go-live lands here too (goLive rejects → error set, isLive stays false), so
  // surface broadcast.error instead of swallowing it — the "Go live & share" button below
  // doubles as the retry. The message is deliberately generic: Convex REDACTS error
  // messages in production (see useLiveBroadcast notes), so the raw message is unreliable.
  //
  // GATE on !broadcast.isLive: the hook shares ONE `error` across goLive/setVisibility/
  // finalize. A failed Stop (setVisibility('private') rejects) leaves isLive=true but
  // flips enabled=false, so it also lands in this bottom branch — without the gate we'd
  // mislabel a Stop/finalize failure as "Couldn't go live". `isLive` is true ONLY after a
  // successful goLive and cleared ONLY by reset() (which also clears error), so
  // isLive=false && error uniquely identifies a genuine go-live failure.
  const goLiveFailed = Boolean(broadcast.error) && !broadcast.isLive;
  return (
    <div style={{ marginBottom: 12 }} role="region" aria-label="Live sharing">
      {goLiveFailed && (
        <p
          role="alert"
          style={{ margin: '0 2px 8px', fontSize: '0.75rem', color: 'var(--destructive)' }}
        >
          Couldn’t go live — check your connection and try again.
        </p>
      )}
      <button
        type="button"
        onClick={goLiveNow}
        className="mono-btn-primary"
        style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <span aria-hidden="true">●</span> Go live &amp; share
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
    error: PropTypes.instanceOf(Error),
  }).isRequired,
  descriptor: PropTypes.shape({
    clientMatchId: PropTypes.string,
    teamA: PropTypes.shape({ name: PropTypes.string }),
    teamB: PropTypes.shape({ name: PropTypes.string }),
  }),
  enabled: PropTypes.bool.isRequired,
  onEnableChange: PropTypes.func.isRequired,
};
