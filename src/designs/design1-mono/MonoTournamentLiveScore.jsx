import { useParams } from 'react-router-dom';
import { getSportById } from '../../models/sportRegistry';
import { loadSportTournaments } from '../../utils/storage';
import { migrateCricketFormat } from '../../utils/formatMigration';
import ErrorBoundary from '../../components/ErrorBoundary';
import MonoSetsLiveScore from './scoring/MonoSetsLiveScore';
import MonoGoalsLiveScore from './scoring/MonoGoalsLiveScore';
import MonoCricketLiveScore from './scoring/MonoCricketLiveScore';
import MonoCricketTestLiveScore from './scoring/MonoCricketTestLiveScore';
import MonoTennisLiveScore from './scoring/MonoTennisLiveScore';
import RouteRecoveryActions from './components/RouteRecoveryActions';

export default function MonoTournamentLiveScore() {
  const { sport, id, matchId } = useParams();
  const sportConfig = getSportById(sport);
  const storageKey = sportConfig?.storageKey || (sport === 'cricket' ? 'se_cricket' : null);
  const tournaments = storageKey ? loadSportTournaments(storageKey) : [];
  const tournament = tournaments.find((t) => t.id === Number(id) || t.id === id);
  const match = tournament?.matches?.find((m) => m.id === matchId || m.id === Number(matchId))
    || (tournament?.knockoutMatches || []).find((m) => m.id === matchId || m.id === Number(matchId));

  let scorer = null;

  if (!sportConfig || !tournament || !match) {
    return (
      <RouteRecoveryActions
        eyebrow="Scorer recovery"
        title="Match not found"
        message="This scorer link does not match a saved tournament match on this device."
        sportId={sportConfig?.id}
      />
    );
  }

  // Cricket: check match-level format to pick scorer
  if (sport === 'cricket' || getSportById(sport)?.engine === 'custom-cricket') {
    const format = migrateCricketFormat(match?.format || tournament?.knockoutConfig?.format || tournament?.format);

    scorer = format?.totalInnings === 4
      ? <MonoCricketTestLiveScore />
      : <MonoCricketLiveScore />;
  } else if (sport === 'tennis') {
    scorer = <MonoTennisLiveScore />;
  } else {
    if (sportConfig.engine === 'sets') {
      scorer = <MonoSetsLiveScore />;
    } else if (sportConfig.engine === 'goals') {
      scorer = <MonoGoalsLiveScore />;
    } else {
      return (
        <div className="min-h-screen px-6 py-10 flex items-center justify-center">
          <p style={{ color: '#888' }}>Live scoring for {sportConfig?.name || sport} coming soon...</p>
        </div>
      );
    }
  }

  return (
    <ErrorBoundary
      title="Scoring screen crashed"
      message="This match scorer failed to render. Reload to recover your draft state."
    >
      {scorer}
    </ErrorBoundary>
  );
}
