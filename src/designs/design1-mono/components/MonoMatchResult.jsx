import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments } from '../../../utils/storage';
import { matchVerdict } from '../../../utils/matchVerdict';
import { useAuth } from '../../../hooks/useAuth';
import KitFinish from '../kit/KitFinish';
import { finishFromVerdict } from '../kit/finishModel';
import RouteRecoveryActions from './RouteRecoveryActions';

/**
 * Presentational FULL-TIME result for a tournament match: the Kit Finish screen (plan 2026-10-22
 * §9 S3) built from a matchVerdict plus the stored sets. Pure: no storage, router or engine
 * coupling, so every state (win, draw, abandoned) is directly testable.
 */
export function MonoMatchResultView({
  verdict,
  team1Name = 'Team 1',
  team2Name = 'Team 2',
  sets,
  sportId,
  sportName,
  meta,
  team1Colour,
  team2Colour,
  isSignedIn = false,
  cloudAuthAvailable = true,
  scorecardReady = false,
  shareReady = false,
  reduceMotion,
  onDone,
  onRematch,
  onScorecard,
  onShare,
  onSignIn,
}) {
  const model = finishFromVerdict(verdict, { team1Name, team2Name, sets });
  return (
    <KitFinish
      model={model}
      sportId={sportId}
      sportName={sportName}
      meta={meta}
      team1Colour={team1Colour}
      team2Colour={team2Colour}
      reduceMotion={reduceMotion}
      onDone={onDone}
      primary={onRematch ? { label: 'Rematch', onClick: onRematch } : undefined}
      secondary={[
        { label: 'Share result', onClick: onShare, disabled: !shareReady },
        { label: 'Match details', onClick: onScorecard, disabled: !scorecardReady },
      ]}
      footer={
        // This match is already saved locally; signing in does NOT upload this completed guest
        // match (guest -> cloud sync is a separate M1 issue), so the CTA is an honest account
        // benefit, not a promise to save THIS match. Hidden in local/offline auth mode, where
        // there is no cloud to sign into.
        !isSignedIn && cloudAuthAvailable ? (
          <button type="button" className="kit-fin-signin" onClick={onSignIn}>Sign in</button>
        ) : null
      }
    />
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
  sets: PropTypes.arrayOf(PropTypes.object),
  sportId: PropTypes.string,
  sportName: PropTypes.string,
  meta: PropTypes.string,
  team1Colour: PropTypes.string,
  team2Colour: PropTypes.string,
  isSignedIn: PropTypes.bool,
  cloudAuthAvailable: PropTypes.bool,
  scorecardReady: PropTypes.bool,
  shareReady: PropTypes.bool,
  reduceMotion: PropTypes.bool,
  onDone: PropTypes.func,
  onRematch: PropTypes.func,
  onScorecard: PropTypes.func,
  onShare: PropTypes.func,
  onSignIn: PropTypes.func,
};

function formatMeta(format) {
  if (!format) return undefined;
  if (format.type === 'best-of' && format.sets) return `Best of ${format.sets}`;
  if (format.type === 'single') return 'Single set';
  return undefined;
}

/**
 * Route container: loads the completed match from local tournament storage, builds the verdict
 * (Sets engine — the reference wiring for this PR), and wires the result CTAs to navigation. A
 * missing/incomplete match falls back to a safe recovery surface rather than a broken screen or a
 * route back into the scorer. Tournament results never offer Rematch (PR #179).
 */
export default function MonoMatchResult() {
  const navigate = useNavigate();
  const { sport, id, matchId } = useParams();
  const { isAuthenticated, cloudAuthAvailable } = useAuth();

  const config = getSportById(sport);
  const tournaments = config ? loadSportTournaments(config.storageKey) : [];
  const tournament = tournaments.find((t) => t.id === Number(id) || t.id === id);
  const isMatchId = (m) => m.id === matchId || m.id === Number(matchId);
  const knockout = tournament ? (tournament.knockoutMatches || []).find(isMatchId) : null;
  const match = tournament ? ((tournament.matches || []).find(isMatchId) || knockout) : null;

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

  const teamOf = (teamId) => tournament.teams.find((t) => t.id === teamId);
  const team1Name = teamOf(match.team1Id)?.name || 'Unknown';
  const team2Name = teamOf(match.team2Id)?.name || 'Unknown';
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
    // Pass the persisted shape through untouched — matchVerdict derives the
    // sets-won tally from setsWon1/2, or counts sets[] for the tennis tournament
    // save which persists no tally at all. Collapsing to `?? 0` here rendered a
    // real result as "0–0".
    setsWon1: match.setsWon1,
    setsWon2: match.setsWon2,
    score1: match.score1,
    score2: match.score2,
    sets: match.sets,
  });
  const format = knockout && tournament.knockoutConfig?.format ? tournament.knockoutConfig.format : tournament.format;

  return (
    <MonoMatchResultView
      verdict={verdict}
      team1Name={team1Name}
      team2Name={team2Name}
      sets={match.sets}
      sportId={config.id}
      sportName={config.name}
      meta={formatMeta(format)}
      // Tournament teams carry no picked colour yet: the engine's default pair, as on Home.
      isSignedIn={isAuthenticated}
      cloudAuthAvailable={cloudAuthAvailable}
      onDone={() => navigate(`/${sport}/tournament/${id}`, { replace: true })}
      onScorecard={() => {}}
      onShare={() => {}}
      onSignIn={() => navigate('/login')}
    />
  );
}
