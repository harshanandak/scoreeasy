import PropTypes from 'prop-types';
import ConfirmActionPanel from './ConfirmActionPanel';

export default function TournamentScoreClearActions({ matchId, scoreClear }) {
  const pendingScoreClear = scoreClear.pendingScoreClear?.matchId === matchId
    ? scoreClear.pendingScoreClear
    : null;
  const canUndoClear = scoreClear.clearedScore?.matchId === matchId;

  return (
    <>
      {pendingScoreClear && (
        <ConfirmActionPanel
          message={`Clear the saved score for ${pendingScoreClear.label}?`}
          confirmLabel="Clear score"
          confirmAriaLabel={`Confirm clear score for ${pendingScoreClear.label}`}
          onConfirm={scoreClear.confirmScoreClear}
          onCancel={scoreClear.cancelScoreClear}
        />
      )}

      {canUndoClear && (
        <button
          type="button"
          className="mono-btn mb-4 w-full"
          style={{ minHeight: 44, padding: '10px' }}
          onClick={scoreClear.undoScoreClear}
        >
          Undo clear score
        </button>
      )}
    </>
  );
}

TournamentScoreClearActions.propTypes = {
  matchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  scoreClear: PropTypes.shape({
    cancelScoreClear: PropTypes.func.isRequired,
    clearedScore: PropTypes.shape({
      matchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    }),
    confirmScoreClear: PropTypes.func.isRequired,
    pendingScoreClear: PropTypes.shape({
      label: PropTypes.string.isRequired,
      matchId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    }),
    undoScoreClear: PropTypes.func.isRequired,
  }).isRequired,
};
