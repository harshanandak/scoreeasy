import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import ShareLiveMatch from './ShareLiveMatch';
import { getConsent, setConsent } from '../../../lib/live/liveSession';
import { useAuth } from '../../../hooks/useAuth';
import '../kit/sharelive.css';

// LiveBroadcastBar (issue b0z): the operator-facing live control.
//
// The disclosure choice is remembered, but publishing always needs a tap for this
// match. The scorer's enabled flag alone never grants consent for a new match.

export default function LiveBroadcastBar({ broadcast, descriptor, enabled, onEnableChange }) {
  const [consent, setConsentState] = useState(() => getConsent());
  const [shareOpen, setShareOpen] = useState(false);
  const [requestedMatchId, setRequestedMatchId] = useState(null);
  const descriptorRef = useRef(descriptor);
  descriptorRef.current = descriptor;
  const startedRef = useRef(false);
  // Bumped to force the one-shot effect to re-run after a FAILED go-live (a ref
  // reset alone doesn't schedule an effect, and onEnableChange(true) is a
  // same-value no-op when enabled was already true).
  const [retryNonce, setRetryNonce] = useState(0);
  const { cloudAuthAvailable, isAuthenticated, isUserReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sharing = broadcast.isShared ?? (enabled && broadcast.isLive);

  useEffect(() => {
    if (!isAuthenticated || !descriptor?.clientMatchId || !broadcast.restore) return undefined;
    let canceled = false;
    void broadcast.restore({ clientMatchId: descriptor.clientMatchId, getSnapshot: () => descriptorRef.current?.snapshot }).then((session) => {
      if (!canceled && session) onEnableChange(Boolean(session.isShared));
    });
    return () => { canceled = true; };
  }, [isAuthenticated, descriptor?.clientMatchId, broadcast.restore]);

  // Fire go-live exactly once per mount when broadcasting is on, consented, AND the
  // user is signed in (create is authed — never fire for a signed-out user).
  useEffect(() => {
    if (isAuthenticated && enabled && consent === 'accepted' && descriptor?.clientMatchId && requestedMatchId === descriptor.clientMatchId && !startedRef.current) {
      startedRef.current = true;
      void broadcast.goLive({ ...descriptor, getSnapshot: () => descriptorRef.current?.snapshot });
    }
  }, [isAuthenticated, enabled, consent, descriptor, broadcast, retryNonce, requestedMatchId]);

  const accept = () => {
    setRequestedMatchId(descriptor?.clientMatchId);
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
    setRequestedMatchId(descriptor?.clientMatchId);
    // Opt back in for this match (consent already seen).
    if (consent !== 'accepted') {
      setConsent('accepted');
      setConsentState('accepted');
    }
    // First share and re-share both sync the current local score before publishing.
    startedRef.current = false;
    setRetryNonce((n) => n + 1);
    onEnableChange(true);
  };

  const stopSharing = async () => {
    const result = await broadcast.setVisibility('private');
    if (result?.ok) {
      setRequestedMatchId(null);
      onEnableChange(false);
    }
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
      <div className="kit-live-offer" role="region" aria-label="Live sharing">
        <button
          type="button"
          onClick={() => navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`)}
          className="se-ctl kit-live-full"
        >
          Sign in to go live
        </button>
        <p className="kit-live-note">
          A free account lets you share the live scoreboard — your matches stay private until you go live.
        </p>
      </div>
    );
  }

  // First-ever decision: the one-time disclosure card.
  if (consent === null && !sharing) {
    return (
      <div
        className="kit-live-offer kit-live-consent"
        role="region"
        aria-label="Live sharing"
      >
        <h2>Share this match live?</h2>
        <p>Scores and team names will be public to anyone with the link.</p>
        <div className="kit-live-stack">
          <button type="button" onClick={accept} className="se-go">
            Share live <span aria-hidden="true">→</span>
          </button>
          <button type="button" onClick={decline} className="se-ctl">
            Keep private
          </button>
        </div>
      </div>
    );
  }

  // Live: status pill + share + stop.
  if (sharing) {
    return (
      <div
        className="kit-live-bar"
        role="region"
        aria-label="Live sharing"
      >
        <span className="kit-live-pill">
          Live · public
        </span>
        {broadcast.error && <p role="alert">Couldn’t change sharing — check your connection and try again.</p>}
        <button
          type="button"
          onClick={(event) => {
            event.currentTarget.focus();
            setShareOpen(true);
          }}
          className="se-ctl kit-live-share"
          disabled={!broadcast.token}
        >
          Share
        </button>
        <button type="button" onClick={stopSharing} className="se-ctl">
          Stop
        </button>
        {shareOpen && broadcast.token && (
          <ShareLiveMatch
            token={broadcast.token}
            teamA={descriptor?.teamA?.name}
            teamB={descriptor?.teamB?.name}
            onClose={() => setShareOpen(false)}
            onStopSharing={stopSharing}
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
  // Stop failures stay in the public bar above; only failed creation belongs here.
  const goLiveFailed = Boolean(broadcast.error) && !broadcast.isLive;
  return (
    <div className="kit-live-offer" role="region" aria-label="Live sharing">
      {goLiveFailed && (
        <p
          role="alert"
          className="kit-live-error"
        >
          Couldn’t go live — check your connection and try again.
        </p>
      )}
      <button
        type="button"
        onClick={goLiveNow}
        className="se-go"
      >
        Go live &amp; share <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

LiveBroadcastBar.propTypes = {
  broadcast: PropTypes.shape({
    goLive: PropTypes.func.isRequired,
    setVisibility: PropTypes.func.isRequired,
    isLive: PropTypes.bool,
    isShared: PropTypes.bool,
    restore: PropTypes.func,
    token: PropTypes.string,
    error: PropTypes.instanceOf(Error),
  }).isRequired,
  descriptor: PropTypes.shape({
    clientMatchId: PropTypes.string,
    snapshot: PropTypes.object,
    teamA: PropTypes.shape({ name: PropTypes.string }),
    teamB: PropTypes.shape({ name: PropTypes.string }),
  }),
  enabled: PropTypes.bool.isRequired,
  onEnableChange: PropTypes.func.isRequired,
};
