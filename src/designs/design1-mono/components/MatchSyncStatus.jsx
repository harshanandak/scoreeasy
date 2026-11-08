import PropTypes from 'prop-types';
import { matchSaveOwner, usePendingMatchSaveStatus } from '../../../hooks/usePendingMatchSaves';
import { useAuth } from '../../../hooks/useAuth';
import { isMatchSaveConfirmed, loadMatchSaveLocal, tournamentCompletionId } from '../../../utils/pendingMatchSaves';
import './matchSyncStatus.css';

export default function MatchSyncStatus(props) {
  const auth = useAuth();
  if (!matchSaveOwner(auth)) return null;
  return <AccountMatchSyncStatus {...props} />;
}

function AccountMatchSyncStatus({ clientMatchId, quickMatchId, tournamentMatch, compact = false }) {
  const { ownerId, records, retry } = usePendingMatchSaveStatus();
  if (!ownerId) return null;
  const local = loadMatchSaveLocal({ quickMatchId, tournamentMatch });
  const identity = local?.clientMatchId || clientMatchId;
  const completionId = tournamentMatch ? tournamentCompletionId(local) : undefined;
  const saved = isMatchSaveConfirmed(ownerId, identity, completionId) || (local?.clientMatchId === identity && local?.syncOwnerId === ownerId && local?.sync?.status === 'synced'
    && (!tournamentMatch || !local.sync.completionId || local.sync.completionId === completionId));
  const pending = saved ? undefined : records.find((record) => record.payload.clientMatchId === identity);
  if (!pending && (compact || !saved)) return null;
  const failed = pending?.state === 'failed';
  const waiting = pending && !pending.terminal && (navigator.onLine === false || pending.state === 'pending');
  const label = !pending ? 'Saved to your account' : failed && !waiting ? "Couldn't save" : waiting ? 'Waiting for connection' : 'Saving to your account…';
  return (
    <div className={`kit-sync-status${compact ? ' is-compact' : ''}`}>
      <span role="status">{label}{pending?.priorCompletionSaved ? '. A previous result for this fixture is already saved to your account; this replay is local only.' : ''}{pending?.storageFailed ? '. Keep this screen open; device storage is full or unavailable. Pending save is kept only for this session and will be lost on refresh.' : ''}</span>
      {pending && pending.state !== 'syncing' && !pending.priorCompletionSaved && (
        <button type="button" className="se-ctl" onClick={() => { void retry(identity); }}>Retry</button>
      )}
    </div>
  );
}
MatchSyncStatus.propTypes = {
  clientMatchId: PropTypes.string,
  quickMatchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tournamentMatch: PropTypes.shape({
    storageKey: PropTypes.string.isRequired,
    tournamentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    matchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }),
  compact: PropTypes.bool,
};
