import PropTypes from 'prop-types';
import { usePendingMatchSaves } from '../../../hooks/usePendingMatchSaves';
import { loadQuickMatch } from '../../../utils/storage';
import { isMatchSaveConfirmed } from '../../../utils/pendingMatchSaves';
import './matchSyncStatus.css';

export default function MatchSyncStatus({ clientMatchId, quickMatchId, compact = false }) {
  const { ownerId, records, retry } = usePendingMatchSaves(undefined, false);
  if (!ownerId) return null;
  const local = loadQuickMatch(quickMatchId);
  const identity = local?.clientMatchId || clientMatchId;
  const pending = records.find((record) => record.payload.clientMatchId === identity);
  const saved = isMatchSaveConfirmed(ownerId, identity) || (local?.clientMatchId === identity && local?.syncOwnerId === ownerId && local?.sync?.status === 'synced');
  if (!pending && (compact || !saved)) return null;
  const failed = pending?.state === 'failed';
  const waiting = pending && !pending.terminal && (navigator.onLine === false || pending.state === 'pending');
  const label = !pending ? 'Saved to your account' : failed && !waiting ? "Couldn't save" : waiting ? 'Waiting for connection' : 'Saving to your account…';
  return (
    <div className={`kit-sync-status${compact ? ' is-compact' : ''}`}>
      <span role="status">{label}{pending?.storageFailed ? '. Keep this screen open; device storage is full or unavailable.' : ''}</span>
      {pending && pending.state !== 'syncing' && (
        <button type="button" className="se-ctl" onClick={() => { void retry(identity); }}>Retry</button>
      )}
    </div>
  );
}
MatchSyncStatus.propTypes = {
  clientMatchId: PropTypes.string,
  quickMatchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compact: PropTypes.bool,
};
