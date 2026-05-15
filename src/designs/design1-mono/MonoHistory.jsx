import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameHistory } from '../../hooks/useGameHistory';
import { loadData, loadSportTournaments, saveData } from '../../utils/storage';
import { loadHistory } from '../../utils/universalStorage';
import { getSportById, getSportsList } from '../../models/sportRegistry';
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

function buildEntryShareText(entry) {
  const title = entry.isLegacy ? entry.tournamentName : `${entry.team1} vs ${entry.team2}`;
  return `${title} - ${entry.score} - ${winnerLabel(entry.winner)}`;
}

function getShareStatusText(response) {
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
  const [pendingClear, setPendingClear] = useState(null);
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
    if (filter === 'all') return allEntries;
    return allEntries.filter((entry) => entry.source === filter);
  }, [allEntries, filter]);

  const quickCount = quickEntries.length;
  const tournamentCount = tournamentEntries.length + legacyEntries.length;
  const totalCount = allEntries.length;
  const clearableCount = quickCount + legacyEntries.length;

  const deleteQuickMatch = (id) => {
    const updated = quickMatches.filter((qm) => qm.id !== id);
    setQuickMatches(updated);
    saveData(QM_KEY, updated);
  };

  const clearAllQuickMatches = () => {
    setQuickMatches([]);
    saveData(QM_KEY, []);
  };

  const confirmClearMutableHistory = () => {
    setPendingClear({
      quick: quickMatches,
      legacy: loadHistory(),
      cleared: false,
    });
  };

  const clearMutableHistory = () => {
    clearLegacyHistory();
    clearAllQuickMatches();
    setPendingClear((snapshot) => snapshot ? { ...snapshot, cleared: true } : null);
    setSelectedEntry(null);
    setHistoryStatus('Cleared quick and legacy history.');
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
    const response = await shareText({
      title: 'Score Easy result',
      text: buildEntryShareText(entry),
      dialogTitle: 'Share match result',
    });
    setHistoryStatus(getShareStatusText(response));
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
              className="bg-transparent cursor-pointer font-swiss text-xs"
              style={{
                border: '1.5px solid #dc2626',
                color: '#dc2626',
                minHeight: 40,
                padding: '0 10px',
              }}
            >
              Clear Quick + Legacy
            </button>
          )}
        </nav>

        {historyStatus && (
          <div className="mono-card mb-4" style={{ padding: '10px 12px', borderColor: '#0066ff', color: '#0066ff' }}>
            {historyStatus}
          </div>
        )}

        {pendingClear && !pendingClear.cleared && (
          <div className="mono-card mb-4" style={{ padding: '14px 16px', borderColor: '#dc2626' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Clear quick and legacy history?</p>
            <p className="text-xs mb-4" style={{ color: '#666' }}>
              Tournament history will stay. You can undo this before leaving the screen.
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

        <div className="flex gap-2 mb-6" role="tablist" aria-label="History filters">
          {[
            { id: 'all', label: 'All', count: totalCount },
            { id: 'quick', label: 'Quick', count: quickCount },
            { id: 'tournament', label: 'Tournament', count: tournamentCount },
          ].map((chip) => (
            <button
              key={chip.id}
              role="tab"
              aria-selected={filter === chip.id}
              className={filter === chip.id ? 'mono-btn-primary' : 'mono-btn'}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              onClick={() => setFilter(chip.id)}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="mono-card text-center" style={{ padding: '28px 18px' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#111' }}>No matches in this filter</p>
            <p className="text-xs mb-5" style={{ color: '#666' }}>
              Completed quick matches and tournaments will appear here.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="mono-btn-primary flex-1"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => navigate('/volleyball/quick')}
              >
                Start Match
              </button>
              <button
                type="button"
                className="mono-btn flex-1"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={() => navigate('/volleyball/tournament/new')}
              >
                Tournament
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="mono-card" style={{ padding: '14px 16px' }}>
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
                  </button>

                  {entry.source === 'quick' && (
                    <button
                      onClick={() => {
                        deleteQuickMatch(entry.rawId);
                        setHistoryStatus('Quick match deleted.');
                      }}
                      className="bg-transparent border-none cursor-pointer text-sm"
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
          <div className="mono-card mt-6" style={{ padding: '16px' }}>
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

