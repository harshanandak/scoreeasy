import PropTypes from 'prop-types';
import { getSportById } from '../../../models/sportRegistry';
import { getTournamentMatchClientId } from '../../../utils/tournamentSync';
import { loadMatchSaveLocal } from '../../../utils/pendingMatchSaves';
import MatchSyncStatus from './MatchSyncStatus';

export default function TournamentMatchSyncStatus({ sport, tournament, match, compact = false }) {
  const config = getSportById(sport);
  if (!config || !tournament || !match) return null;
  const tournamentMatch = { storageKey: config.storageKey, tournamentId: tournament.id, matchId: match.id };
  const local = loadMatchSaveLocal({ tournamentMatch }) || match;
  if (local.status !== 'completed') return null;
  return <MatchSyncStatus compact={compact}
    clientMatchId={getTournamentMatchClientId({ sportId: sport, tournament, match })}
    tournamentMatch={tournamentMatch} />;
}

TournamentMatchSyncStatus.propTypes = {
  sport: PropTypes.string,
  tournament: PropTypes.object,
  match: PropTypes.object,
  compact: PropTypes.bool,
};
