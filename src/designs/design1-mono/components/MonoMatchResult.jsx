import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments } from '../../../utils/storage';
import { matchVerdict } from '../../../utils/matchVerdict';
import { useAuth } from '../../../hooks/useAuth';
import { triggerConfetti } from '../utils/confetti';
import RouteRecoveryActions from './RouteRecoveryActions';

// Respect the OS reduced-motion setting (test override wins). Governance §5:
// the celebratory motion + confetti are gated so nothing animates for users who
// asked it not to.
function useReducedMotion(override) {
  const [reduced, setReduced] = useState(() => {
    if (typeof override === 'boolean') return override;
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  });
  useEffect(() => {
    if (typeof override === 'boolean') { setReduced(override); return undefined; }
    const mq = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [override]);
  return reduced;
}

/**
 * Presentational FULL-TIME result screen. Pure: it takes a verdict (from
 * matchVerdict) plus navigation callbacks and renders the brutalist-shell /
 * soft-content celebratory result. No storage, router, or engine coupling — so
 * every state (win, draw, tie, abandoned) is directly testable.
 */
export function MonoMatchResultView({
  verdict,
  team1Name = 'Team 1',
  team2Name = 'Team 2',
  isSignedIn = false,
  scorecardReady = false,
  shareReady = false,
  reduceMotion,
  onDone,
  onRematch,
  onScorecard,
  onShare,
  onSignIn,
}) {
  const headingRef = useRef(null);
  const confettiFiredRef = useRef(false);
  const prefersReduced = useReducedMotion(reduceMotion);

  const v = verdict || {};
  const decided = Boolean(v.isDecided);
  const winnerIsTeam1 = v.winnerSide === 'team1';
  const winnerIsTeam2 = v.winnerSide === 'team2';
  const [n1, n2] = String(v.scoreLine || '').split('–').map((s) => s.trim());
  const lineScore = Array.isArray(v.lineScore) ? v.lineScore : [];
  const eyebrow = v.status === 'abandoned' ? 'No result' : 'Full time';

  // Focus moves to the result headline on mount (a11y): a screen reader lands on
  // the outcome, and keyboard focus is never left inside the completed scorer.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // One-shot celebration, deduped via a ref so re-renders never re-fire it, and
  // suppressed entirely under reduced motion / for non-decided results.
  useEffect(() => {
    if (prefersReduced || confettiFiredRef.current || !decided) return;
    confettiFiredRef.current = true;
    triggerConfetti();
  }, [prefersReduced, decided]);

  const teamClass = (isWinner) =>
    `mono-result-team${isWinner ? ' mono-result-team-winner' : ''}`;

  return (
    <section className="mono-result" role="region" aria-label="Match result">
      <div className={`mono-result-card${prefersReduced ? '' : ' mono-result-celebrate'}`}>
        <p className="mono-result-eyebrow">{eyebrow}</p>

        {decided && (
          <div className="mono-result-medallion" aria-hidden="true">🏆</div>
        )}

        <h1 className="mono-result-headline" tabIndex={-1} ref={headingRef}>
          {v.headline}
        </h1>

        {decided && v.winnerName && (
          <p className="mono-result-sub">{v.winnerName} take the match</p>
        )}

        <div className="mono-result-score">
          <span className="mono-result-score-num">{n1 ?? '0'}</span>
          <span className="mono-result-score-sep" aria-hidden="true">–</span>
          <span className="mono-result-score-num">{n2 ?? '0'}</span>
        </div>
        {v.detailLabel && <p className="mono-result-score-unit">{v.detailLabel}</p>}

        <div className="mono-result-teams">
          <div className={teamClass(winnerIsTeam1)}>{team1Name}</div>
          <div className={teamClass(winnerIsTeam2)}>{team2Name}</div>
        </div>

        {lineScore.length > 0 && (
          <p className="mono-result-line">{lineScore.join('   ·   ')}</p>
        )}

        {/* Spoken full-sentence summary for assistive tech. */}
        <p className="sr-only" role="status" aria-live="polite">{v.ariaSummary}</p>

        <div className="mono-result-actions">
          <button
            type="button"
            className="mono-result-cta mono-result-cta-primary"
            onClick={onDone}
          >
            Done
          </button>
          <button type="button" className="mono-result-cta" onClick={onRematch}>
            Rematch
          </button>
          <button
            type="button"
            className="mono-result-cta"
            disabled={!scorecardReady}
            aria-disabled={!scorecardReady}
            onClick={onScorecard}
          >
            Scorecard
          </button>
          <button
            type="button"
            className="mono-result-cta"
            disabled={!shareReady}
            aria-disabled={!shareReady}
            onClick={onShare}
          >
            Share
          </button>
          {!isSignedIn && (
            <button type="button" className="mono-result-signin" onClick={onSignIn}>
              Sign in to save
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

MonoMatchResultView.propTypes = {
  verdict: PropTypes.shape({
    status: PropTypes.string,
    isDecided: PropTypes.bool,
    isDraw: PropTypes.bool,
    winnerSide: PropTypes.string,
    winnerName: PropTypes.string,
    headline: PropTypes.string,
    scoreLine: PropTypes.string,
    detailLabel: PropTypes.string,
    lineScore: PropTypes.arrayOf(PropTypes.string),
    ariaSummary: PropTypes.string,
  }),
  team1Name: PropTypes.string,
  team2Name: PropTypes.string,
  isSignedIn: PropTypes.bool,
  scorecardReady: PropTypes.bool,
  shareReady: PropTypes.bool,
  reduceMotion: PropTypes.bool,
  onDone: PropTypes.func,
  onRematch: PropTypes.func,
  onScorecard: PropTypes.func,
  onShare: PropTypes.func,
  onSignIn: PropTypes.func,
};

/**
 * Route container: loads the completed match from local tournament storage,
 * builds the verdict (Sets engine — the reference wiring for this PR), and wires
 * the result CTAs to navigation. A missing/incomplete match falls back to a safe
 * recovery surface rather than a broken screen or a route back into the scorer.
 */
export default function MonoMatchResult() {
  const navigate = useNavigate();
  const { sport, id, matchId } = useParams();
  const { isAuthenticated } = useAuth();

  const config = getSportById(sport);
  const tournaments = config ? loadSportTournaments(config.storageKey) : [];
  const tournament = tournaments.find((t) => t.id === Number(id));
  const isMatchId = (m) => m.id === matchId || m.id === Number(matchId);
  const match = tournament
    ? [...(tournament.matches || []), ...(tournament.knockoutMatches || [])].find(isMatchId)
    : null;

  if (!config || !tournament || !match || match.status !== 'completed') {
    return (
      <RouteRecoveryActions
        eyebrow="Match result"
        title="Result unavailable"
        message="This match has no completed result to show on this device."
        sportId={config?.id}
      />
    );
  }

  const getTeamName = (teamId) =>
    tournament.teams.find((t) => t.id === teamId)?.name || 'Unknown';
  const team1Name = getTeamName(match.team1Id);
  const team2Name = getTeamName(match.team2Id);
  const winnerSide = match.winner === match.team1Id
    ? 'team1'
    : match.winner === match.team2Id
      ? 'team2'
      : 'none';

  const verdict = matchVerdict({
    kind: 'sets',
    team1: team1Name,
    team2: team2Name,
    winnerSide,
    status: 'completed',
    score1: match.setsWon1 ?? 0,
    score2: match.setsWon2 ?? 0,
    sets: match.sets,
  });

  return (
    <MonoMatchResultView
      verdict={verdict}
      team1Name={team1Name}
      team2Name={team2Name}
      isSignedIn={isAuthenticated}
      onDone={() => navigate(`/${sport}/tournament/${id}`, { replace: true })}
      onRematch={() => navigate(`/${sport}/quick`, { replace: true })}
      onScorecard={() => {}}
      onShare={() => {}}
      onSignIn={() => navigate('/login')}
    />
  );
}
