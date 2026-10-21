import PropTypes from 'prop-types';
import { retiredScore, savedScoreLabel } from '../../../utils/retiredSavedMatches';

export default function RetiredMatchState({ entry }) {
  const state = entry.persistedState;
  const sets = Array.isArray(state.sets) ? state.sets : [];
  const history = [entry.engine === 'sets' ? state.vScoreHistory : state.gScoreHistory, state.scoreHistory, state.history]
    .find((items) => Array.isArray(items) && items.length > 0) || [];
  const currentSet = state.currentSet;
  const period = state.currentPeriod ?? state.period;
  return (
    <div className="mb-4" style={{ color: 'var(--foreground)' }}>
      <p className="mono-card p-3 mb-3 font-semibold" role="status">This sport is retired; scoring is off</p>
      {entry.engine === 'sets' && <p>{typeof currentSet === 'number' ? `Set ${currentSet + 1}` : 'Saved sets'}</p>}
      {period !== undefined && <p>Period {period}</p>}
      {state.servingTeam && <p>Serving: {state.servingTeam === 1 ? entry.team1 : entry.team2}</p>}
      {sets.length > 0 && (
        <table className="w-full mb-3 text-sm">
          <caption className="text-left font-semibold">Saved sets</caption>
          <tbody>{sets.map((set, index) => (
            <tr key={index}>
              <th className="text-left font-normal" scope="row">Set {index + 1}{set.completed ? ' · Completed' : ' · Unfinished'}</th>
              <td className="text-right font-mono">{savedScoreLabel([set.score1, set.score2])}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {state.lastAction && <p>Last saved action: {state.lastAction}</p>}
      <details>
        <summary className="cursor-pointer py-3 font-semibold" style={{ minHeight: 44 }}>Saved score history ({history.length})</summary>
        {history.length ? (
          <ol className="font-mono text-sm">
            {history.map((snapshot, index) => (
              <li key={index}>{snapshot.team && snapshot.value !== undefined
                ? `${snapshot.team === 1 ? entry.team1 : entry.team2} +${snapshot.value}`
                : savedScoreLabel(retiredScore(snapshot, entry.engine, entry.format))}</li>
            ))}
          </ol>
        ) : <p>No score history was saved.</p>}
      </details>
    </div>
  );
}

RetiredMatchState.propTypes = {
  entry: PropTypes.shape({
    persistedState: PropTypes.object.isRequired,
    engine: PropTypes.string.isRequired,
    format: PropTypes.object,
    team1: PropTypes.string,
    team2: PropTypes.string,
  }).isRequired,
};
