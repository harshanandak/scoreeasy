import PropTypes from 'prop-types';
import { usePendingMatchSaves } from '../../../hooks/usePendingMatchSaves';
import { loadQuickMatch } from '../../../utils/storage';
import './matchSyncStatus.css';

export default function MatchSyncStatus({ clientMatchId, quickMatchId, compact = false }) {
  const { ownerId, records, retry } = usePendingMatchSaves(undefined, false);
  if (!ownerId) return null;
  const pending = records.find((record) => record.payload.clientMatchId === clientMatchId);
  const local = loadQuickMatch(quickMatchId);
  if (!pending && (compact || local?.syncOwnerId !== ownerId || local?.sync?.status !== 'synced')) return null;
  const failed = pending?.state === 'failed';
  const waiting = pending && (navigator.onLine === false || pending.state === 'pending');
  const label = !pending ? 'Saved to your account' : failed && !waiting ? "Couldn't save" : waiting ? 'Waiting for connection' : 'Saving to your account…';
  return (
    <div className={`kit-sync-status${compact ? ' is-compact' : ''}`}>
      <span role="status">{label}{pending?.storageFailed ? '. Keep this screen open; device storage is full or unavailable.' : ''}</span>
      {pending && pending.state !== 'syncing' && (
        <button type="button" className="se-ctl" onClick={() => { void retry(clientMatchId); }}>Retry</button>
      )}
    </div>
  );
}
MatchSyncStatus.propTypes = {
  clientMatchId: PropTypes.string,
  quickMatchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compact: PropTypes.bool,
};
