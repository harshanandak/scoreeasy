import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameHistory } from '../../hooks/useGameHistory';
import { loadData, loadSportTournaments, saveData } from '../../utils/storage';
import { loadHistory } from '../../utils/universalStorage';
import { getSportById, getSportsList } from '../../models/sportRegistry';
import { getPriorityStartActions } from '../../utils/startActions';
import {
  getCompletedAt,
  getTournamentMatches,
  isTournamentMatchCompleted,
  normalizeNonTeamWinner,
} from '../../utils/tournamentSync';
import BackArrow from './components/BackArrow';
import SportIcon from './SportIcon';
import { shareText } from '../../mobile/share';

const QM_KEY = 'se_quickmatches';
const ANY_SPORT = 'all';
const RESULT_ALL = 'all';
const RESULT_DECIDED = 'decided';
const RESULT_DRAW = 'draw';
const RESULT_CLOSE = 'close';
const SORT_NEWEST = 'newest';
const SORT_OLDEST = 'oldest';
const priorityStartButtonStyle = { minHeight: 44, padding: '10px' };
const priorityStartSecondaryStyle = { ...priorityStartButtonStyle, background: '#fff' };

function toTimestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  const day = parsed.getDate().toString().padStart(2, '0');
  const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
  const year = parsed.getFullYear().toString().slice(-2);
  return `${day}.${month}.${year}`;
}

function formatElapsed(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function winnerLabel(winner) {
  const normalized = normalizeNonTeamWinner(winner);
  if (!normalized) return '--';
  if (normalized === 'Draw') return 'Draw';
  if (normalized === 'Tie') return 'Tied';
  return `${normalized} won`;
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getEntrySearchText(entry) {
  return [
    entry.team1,
    entry.team2,
    entry.tournamentName,
    entry.participants,
    entry.sportName,
    entry.score,
    winnerLabel(entry.winner),
    entry.source === 'quick' ? 'quick match' : 'tournament',
  ].filter(Boolean).join(' ').toLowerCase();
}

function isDrawLikeWinner(winner) {
  const normalized = normalizeNonTeamWinner(winner);
  return normalized === 'Draw' || normalized === 'Tie';
}

function getLeadingNumber(value) {
  const text = String(value || '').trim();
  let digits = '';

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char >= '0' && char <= '9') {
      digits += char;
      continue;
    }
    if (digits) break;
  }

  return digits ? Number(digits) : null;
}

function splitScoreSides(score) {
  const scoreText = String(score || '');
  const lowerScore = scoreText.toLowerCase();
  const vsIndex = lowerScore.indexOf(' vs ');
  if (vsIndex >= 0) {
    return [scoreText.slice(0, vsIndex), scoreText.slice(vsIndex + 4)];
  }

  const dashIndex = scoreText.indexOf(' - ');
  if (dashIndex >= 0) {
    return [scoreText.slice(0, dashIndex), scoreText.slice(dashIndex + 3)];
  }

  return [];
}

function getScoreMargin(score) {
  const scores = splitScoreSides(score)
    .map(getLeadingNumber)
    .filter(Number.isFinite);
  if (scores.length < 2) return null;
  return Math.abs(scores[0] - scores[1]);
}

function matchesResultFilter(entry, resultFilter) {
  if (resultFilter === RESULT_ALL) return true;
  if (resultFilter === RESULT_DRAW) return isDrawLikeWinner(entry.winner);
  if (resultFilter === RESULT_DECIDED) return Boolean(entry.winner) && !isDrawLikeWinner(entry.winner);
  if (resultFilter === RESULT_CLOSE) {
    const margin = getScoreMargin(entry.score);
    return !isDrawLikeWinner(entry.winner) && margin !== null && margin <= 2;
  }
  return true;
}

function buildEntryShareText(entry) {
  const title = entry.isLegacy ? entry.tournamentName : `${entry.team1} vs ${entry.team2}`;
  return `${title} - ${entry.score} - ${winnerLabel(entry.winner)}`;
}

function getShareStatusText(response) {
  if (!response || typeof response.shared !== 'boolean') return 'Could not share result.';
  if (!response.shared) return 'Share is not available on this device.';
  if (response.method === 'clipboard') return 'Result copied.';
  return 'Share sheet opened.';
}

function resolveTeamName(teams, ref, fallback = 'Unknown') {
  if (ref === null || ref === undefined) return fallback;
  const byId = teams.find((t) => t.id === ref)?.name;
  if (byId) return byId;
  if (typeof ref === 'number') return teams[ref]?.name || fallback;
  return String(ref);
}

function resolveTournamentWinner(match, team1Name, team2Name) {
  const winner = match?.winner;
  if (!winner) return null;
  if (winner === match.team1Id || winner === match.team1) return team1Name;
  if (winner === match.team2Id || winner === match.team2) return team2Name;
  return normalizeNonTeamWinner(winner);
}

function getSetsScore(match) {
  if (!Array.isArray(match.sets)) return null;
  const s1 = match.setsWon1 ?? match.sets.filter((s) => s.score1 > s.score2).length;
  const s2 = match.setsWon2 ?? match.sets.filter((s) => s.score2 > s.score1).length;
  return `${s1} - ${s2}`;
}

function getInningsTotals(match, team1Id, team2Id) {
  if (!Array.isArray(match.innings) || match.innings.length === 0) return null;
  const score1 = match.innings
    .filter((inn) => inn.teamId === team1Id)
    .reduce((sum, inn) => sum + (inn.runs || 0), 0);
  const score2 = match.innings
    .filter((inn) => inn.teamId === team2Id)
    .reduce((sum, inn) => sum + (inn.runs || 0), 0);
  return `${score1} - ${score2}`;
}

function matchScore(match, team1Id, team2Id) {
  const inningsTotals = getInningsTotals(match, team1Id, team2Id);
  if (inningsTotals) return inningsTotals;
  if (match.team1Score && match.team2Score) {
    return `${match.team1Score.runs}/${match.team1Score.wickets} vs ${match.team2Score.runs}/${match.team2Score.wickets}`;
  }
  const setsScore = getSetsScore(match);
  if (setsScore) return setsScore;
  if (typeof match.score1 === 'number' && typeof match.score2 === 'number') {
    return `${match.score1} - ${match.score2}`;
  }
  return '--';
}

function buildTournamentEntries() {
  const entries = [];
  const sports = getSportsList();

  sports.forEach((sport) => {
    const tournaments = loadSportTournaments(sport.storageKey);
    tournaments.forEach((tournament) => {
      const teams = tournament.teams || [];
      const matches = getTournamentMatches(tournament);

      matches.forEach((match) => {
        if (!isTournamentMatchCompleted(match, sport.engine, match.format || tournament.format)) return;

        const team1Ref = match.team1Id ?? match.team1;
        const team2Ref = match.team2Id ?? match.team2;
        const team1Name = resolveTeamName(teams, team1Ref, 'Team 1');
        const team2Name = resolveTeamName(teams, team2Ref, 'Team 2');

        entries.push({
          id: `tour-${sport.id}-${tournament.id}-${match.id}`,
          source: 'tournament',
          sport: sport.id,
          sportName: sport.name,
          tournamentName: tournament.name,
          team1: team1Name,
          team2: team2Name,
          score: matchScore(match, team1Ref, team2Ref),
          winner: resolveTournamentWinner(match, team1Name, team2Name),
          elapsedSeconds: match.elapsedSeconds,
          date: getCompletedAt(match) || tournament.createdAt,
        });
      });
    });
  });

  return entries.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
}

export default function MonoHistory() {
  const navigate = useNavigate();
  const { history, clearAll: clearLegacyHistory, refresh: refreshLegacyHistory } = useGameHistory();
  const [visible, setVisible] = useState(false);
  const [quickMatches, setQuickMatches] = useState([]);
  const [tournamentEntries, setTournamentEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState(ANY_SPORT);
  const [resultFilter, setResultFilter] = useState(RESULT_ALL);
  const [sortOrder, setSortOrder] = useState(SORT_NEWEST);
  const [pendingClear, setPendingClear] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [historyStatus, setHistoryStatus] = useState('');

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const loadedQuick = loadData(QM_KEY, []);
    loadedQuick.sort((a, b) => toTimestamp(b.completedAt || b.date || b.createdAt) - toTimestamp(a.completedAt || a.date || a.createdAt));

    setQuickMatches(loadedQuick);
    setTournamentEntries(buildTournamentEntries());
  }, []);

  const quickEntries = useMemo(() => {
    return quickMatches.map((qm) => {
      const sportConfig = getSportById(qm.sport);
      const inningsScore = Array.isArray(qm.innings) && qm.innings.length > 0
        ? `${qm.score1 ?? 0} - ${qm.score2 ?? 0}`
        : null;
      const score = inningsScore
        || (qm.team1Score && qm.team2Score
          ? `${qm.team1Score.runs}/${qm.team1Score.wickets} vs ${qm.team2Score.runs}/${qm.team2Score.wickets}`
          : `${qm.score1 ?? 0} - ${qm.score2 ?? 0}`);

      return {
        id: `quick-${qm.id}`,
        rawId: qm.id,
        source: 'quick',
        sport: qm.sport,
        sportName: sportConfig?.name || qm.sport,
        team1: qm.team1,
        team2: qm.team2,
        score,
        winner: normalizeNonTeamWinner(qm.winner),
        elapsedSeconds: qm.elapsedSeconds,
        date: qm.completedAt || qm.date || qm.createdAt,
      };
    });
  }, [quickMatches]);

  const legacyEntries = useMemo(() => {
    return [...history]
      .sort((a, b) => toTimestamp(b.completedAt) - toTimestamp(a.completedAt))
      .map((record) => {
        const participants = record.participants || [];
        const scores = participants.map((name) => record.finalScores?.[name] ?? 0).join(' - ');

        return {
          id: `legacy-${record.id}`,
          source: 'tournament',
          sportName: 'Custom',
          tournamentName: record.gameName,
          team1: participants[0] || 'Player 1',
          team2: participants[1] || 'Player 2',
          participants: participants.join(', '),
          score: scores || '--',
          winner: record.winner,
          date: record.completedAt,
          isLegacy: true,
        };
      });
  }, [history]);

  const allEntries = useMemo(() => {
    return [...quickEntries, ...tournamentEntries, ...legacyEntries]
      .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
  }, [quickEntries, tournamentEntries, legacyEntries]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchQuery);
    return allEntries
      .filter((entry) => filter === 'all' || entry.source === filter)
      .filter((entry) => sportFilter === ANY_SPORT || entry.sportName === sportFilter)
      .filter((entry) => matchesResultFilter(entry, resultFilter))
      .filter((entry) => !normalizedSearch || getEntrySearchText(entry).includes(normalizedSearch))
      .sort((a, b) => {
        const diff = toTimestamp(b.date) - toTimestamp(a.date);
        return sortOrder === SORT_NEWEST ? diff : -diff;
      });
  }, [allEntries, filter, resultFilter, searchQuery, sortOrder, sportFilter]);

  const sportOptions = useMemo(() => {
    return [...new Set(allEntries.map((entry) => entry.sportName).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [allEntries]);

  const hasActiveDiscoveryFilter = Boolean(normalizeSearchValue(searchQuery))
    || sportFilter !== ANY_SPORT
    || resultFilter !== RESULT_ALL
    || sortOrder !== SORT_NEWEST
    || filter !== 'all';

  const quickCount = quickEntries.length;
  const tournamentCount = tournamentEntries.length + legacyEntries.length;
  const totalCount = allEntries.length;
  const clearableCount = quickCount + legacyEntries.length;

  const resetDiscoveryFilters = () => {
    setFilter('all');
    setSearchQuery('');
    setSportFilter(ANY_SPORT);
    setResultFilter(RESULT_ALL);
    setSortOrder(SORT_NEWEST);
  };

  const deleteQuickMatch = (id) => {
    const updated = quickMatches.filter((qm) => qm.id !== id);
    setQuickMatches(updated);
    saveData(QM_KEY, updated);
  };

  const confirmDeleteQuickMatch = (entry) => {
    setPendingClear(null);
    setPendingDelete({
      entry,
      quickSnapshot: quickMatches,
      deleted: false,
    });
    setHistoryStatus('');
  };

  const completeDeleteQuickMatch = () => {
    if (!pendingDelete?.entry?.rawId) return;
    deleteQuickMatch(pendingDelete.entry.rawId);
    setSelectedEntry((current) => (current?.id === pendingDelete.entry.id ? null : current));
    setPendingDelete({
      ...pendingDelete,
      deleted: true,
    });
    setHistoryStatus('Quick match deleted.');
  };

  const undoDeleteQuickMatch = () => {
    if (!pendingDelete?.quickSnapshot) return;
    setQuickMatches(pendingDelete.quickSnapshot);
    saveData(QM_KEY, pendingDelete.quickSnapshot);
    setPendingDelete(null);
    setHistoryStatus('Quick match restored.');
  };

  const clearAllQuickMatches = () => {
    setQuickMatches([]);
    saveData(QM_KEY, []);
  };

  const confirmClearMutableHistory = () => {
    setPendingDelete(null);
    setPendingClear({
      cleared: false,
    });
  };

  const clearMutableHistory = () => {
    const snapshot = {
      quick: quickMatches,
      legacy: loadHistory(),
      cleared: true,
    };

    clearLegacyHistory();
    clearAllQuickMatches();
    setPendingClear(snapshot);
    setPendingDelete(null);
    setSelectedEntry(null);
    setHistoryStatus('Local history cleared.');
  };

  const undoClearMutableHistory = () => {
    if (!pendingClear) return;
    setQuickMatches(pendingClear.quick);
    saveData(QM_KEY, pendingClear.quick);
    saveData('gs_history', pendingClear.legacy);
    refreshLegacyHistory();
    setPendingClear(null);
    setHistoryStatus('History restored.');
  };

  const shareEntry = async (entry) => {
    try {
      const response = await shareText({
        title: 'Score Easy result',
        text: buildEntryShareText(entry),
        dialogTitle: 'Share match result',
      });
      setHistoryStatus(getShareStatusText(response));
    } catch {
      setHistoryStatus('Could not share result.');
    }
  };

  const rematchEntry = (entry) => {
    if (!entry?.sport) return;
    navigate(`/${entry.sport}/quick`, {
      state: {
        teams: [entry.team1, entry.team2],
      },
    });
  };

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        <nav className="flex items-center justify-between mb-6" aria-label="History navigation">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="bg-transparent border-none cursor-pointer font-swiss text-sm"
              style={{ color: '#888' }}
              aria-label="Go back to home"
            >
              <BackArrow />
            </button>
            <h1 className="text-xl font-semibold" style={{ color: '#111' }}>
              History
            </h1>
          </div>
          {clearableCount > 0 && (
            <button
              onClick={confirmClearMutableHistory}
            className="mono-btn font-swiss text-xs"
            style={{
              border: '1.5px solid #dc2626',
              color: '#dc2626',
                minHeight: 40,
                padding: '0 10px',
              }}
            >
              Clear local history
            </button>
          )}
        </nav>

        {historyStatus && (
          <div
            className="mono-card mono-status-card mb-4"
            role="status"
            aria-live="polite"
            style={{ padding: '10px 12px' }}
          >
            {historyStatus}
          </div>
        )}

        {pendingClear && !pendingClear.cleared && (
          <div className="mono-card mono-danger-card mb-4" style={{ padding: '14px 16px' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Clear local history?</p>
            <p className="text-xs mb-4" style={{ color: '#666' }}>
              Saved tournaments stay. Older match records and quick matches can be restored before leaving this screen.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="mono-btn flex-1"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => setPendingClear(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mono-btn flex-1"
                style={{ minHeight: 44, padding: '10px', borderColor: '#dc2626', color: '#dc2626' }}
                onClick={clearMutableHistory}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {pendingClear?.cleared && (
          <button
            type="button"
            className="mono-btn mb-4 w-full"
            style={{ minHeight: 44, padding: '10px' }}
            onClick={undoClearMutableHistory}
          >
            Undo clear
          </button>
        )}

        {pendingDelete && !pendingDelete.deleted && (
          <div className="mono-card mono-danger-card mb-4" style={{ padding: '14px 16px' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Delete this quick match?</p>
            <p className="text-xs mb-4" style={{ color: '#666' }}>
              {pendingDelete.entry.team1} vs {pendingDelete.entry.team2} will be removed from History.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="mono-btn flex-1"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mono-btn flex-1"
                style={{ minHeight: 44, padding: '10px', borderColor: '#dc2626', color: '#dc2626' }}
                onClick={completeDeleteQuickMatch}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {pendingDelete?.deleted && (
          <button
            type="button"
            className="mono-btn mb-4 w-full"
            style={{ minHeight: 44, padding: '10px' }}
            onClick={undoDeleteQuickMatch}
          >
            Undo delete
          </button>
        )}

        <div className="mono-tabs" role="tablist" aria-label="History filters">
          {[
            { id: 'all', label: 'All', count: totalCount },
            { id: 'quick', label: 'Quick', count: quickCount },
            { id: 'tournament', label: 'Tournament', count: tournamentCount },
          ].map((chip) => (
            <button
              key={chip.id}
              role="tab"
              aria-selected={filter === chip.id}
              className={filter === chip.id ? 'mono-tab mono-tab-active' : 'mono-tab'}
              style={{ fontSize: '0.75rem' }}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>

        <section className="mono-history-section mb-6">
          <label htmlFor="history-search" className="text-xs uppercase tracking-widest block mb-2" style={{ color: '#888' }}>
            Find match
          </label>
          <input
            id="history-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="mono-input w-full mb-3"
            style={{ minHeight: 44 }}
            placeholder="Search team, sport, winner, tournament..."
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs" style={{ color: '#666' }}>
              <span className="block mb-1">Sport</span>
              <select
                aria-label="Filter by sport"
                value={sportFilter}
                onChange={(event) => setSportFilter(event.target.value)}
                className="mono-input w-full"
                style={{ minHeight: 44 }}
              >
                <option value={ANY_SPORT}>All sports</option>
                {sportOptions.map((sportName) => (
                  <option key={sportName} value={sportName}>{sportName}</option>
                ))}
              </select>
            </label>

            <label className="text-xs" style={{ color: '#666' }}>
              <span className="block mb-1">Result</span>
              <select
                aria-label="Filter by result"
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value)}
                className="mono-input w-full"
                style={{ minHeight: 44 }}
              >
                <option value={RESULT_ALL}>All results</option>
                <option value={RESULT_DECIDED}>Decided</option>
                <option value={RESULT_DRAW}>Draws and ties</option>
                <option value={RESULT_CLOSE}>Close games</option>
              </select>
            </label>

            <label className="text-xs" style={{ color: '#666' }}>
              <span className="block mb-1">Date</span>
              <select
                aria-label="Sort by date"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="mono-input w-full"
                style={{ minHeight: 44 }}
              >
                <option value={SORT_NEWEST}>Newest first</option>
                <option value={SORT_OLDEST}>Oldest first</option>
              </select>
            </label>
          </div>

          {hasActiveDiscoveryFilter && filteredEntries.length > 0 && (
            <button
              type="button"
              className="mono-btn w-full mt-3"
              style={{ minHeight: 44, padding: '10px' }}
              onClick={resetDiscoveryFilters}
            >
              Clear filters
            </button>
          )}
        </section>

        {filteredEntries.length === 0 ? (
          <section className="mono-history-section text-center" style={{ padding: '28px 18px' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#111' }}>
              {totalCount === 0 ? 'No match history yet' : 'No matches found'}
            </p>
            <p className="text-xs mb-5" style={{ color: '#666' }}>
              {totalCount === 0
                ? 'Completed quick matches and tournaments will appear here.'
                : 'Try a different search, sport, result, or date filter.'}
            </p>
            {totalCount > 0 && (
              <button
                type="button"
                className="mono-btn w-full mb-2"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={resetDiscoveryFilters}
              >
                Clear filters
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {getPriorityStartActions().map((action) => (
                <button
                  key={action.sportId}
                  type="button"
                  className={action.primary ? 'mono-btn-primary' : 'mono-btn'}
                  style={action.primary ? priorityStartButtonStyle : priorityStartSecondaryStyle}
                  onClick={() => navigate(`/play?sport=${action.sportId}`)}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className="mono-btn flex-1"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => navigate('/volleyball/tournament/new')}
              >
                Tournament
              </button>
            </div>
          </section>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="mono-card mono-history-row" style={{ padding: '14px 0' }}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="flex-1 bg-transparent border-none text-left cursor-pointer"
                    style={{ padding: 0 }}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <SportIcon name={entry.sportName} size={18} color="#888" />
                      <span className="text-sm font-medium" style={{ color: '#111' }}>
                        {entry.isLegacy ? entry.tournamentName : `${entry.team1} vs ${entry.team2}`}
                      </span>
                    </div>

                    {entry.isLegacy && (
                      <p className="text-xs mb-1" style={{ color: '#888' }}>{entry.participants}</p>
                    )}

                    {!entry.isLegacy && entry.tournamentName && (
                      <p className="text-xs mb-1" style={{ color: '#888' }}>{entry.tournamentName}</p>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold" style={{ color: '#111' }}>
                        {entry.score}
                      </span>
                      <span className="text-xs" style={{ color: '#0066ff' }}>
                        {winnerLabel(entry.winner)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                        {formatDate(entry.date)}
                      </span>
                      {entry.elapsedSeconds > 0 && (
                        <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                          {formatElapsed(entry.elapsedSeconds)}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#bbb' }}>
                        {entry.sportName}
                      </span>
                      <span className="text-xs" style={{ color: '#bbb' }}>
                        {entry.source === 'quick' ? 'Quick' : 'Tournament'}
                      </span>
                    </div>
                    <span className="inline-block text-xs font-semibold mt-3" style={{ color: '#0066ff' }}>
                      View details
                    </span>
                  </button>

                  {entry.source === 'quick' && (
                    <button
                      onClick={() => {
                        confirmDeleteQuickMatch(entry);
                      }}
                      className="mono-icon-button text-sm"
                      style={{ color: '#888', minHeight: 40, minWidth: 40, padding: '2px 6px' }}
                      title="Delete this match"
                      aria-label={`Delete match ${entry.team1} vs ${entry.team2}`}
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedEntry && (
          <div className="mono-card mono-history-detail mt-6" style={{ padding: '16px' }}>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>Match details</p>
            <h2 className="text-lg font-semibold mb-1" style={{ color: '#111' }}>
              {selectedEntry.isLegacy ? selectedEntry.tournamentName : `${selectedEntry.team1} vs ${selectedEntry.team2}`}
            </h2>
            <p className="text-sm font-mono mb-4" style={{ color: '#111' }}>
              {selectedEntry.score} - {winnerLabel(selectedEntry.winner)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {selectedEntry.source === 'quick' && (
                <button
                  type="button"
                  className="mono-btn-primary"
                  style={{ minHeight: 44, padding: '10px' }}
                  onClick={() => rematchEntry(selectedEntry)}
                >
                  Rematch
                </button>
              )}
              <button
                type="button"
                className="mono-btn"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => shareEntry(selectedEntry)}
              >
                Share
              </button>
              <button
                type="button"
                className="mono-btn"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => setSelectedEntry(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

