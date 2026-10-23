import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useGameHistory } from '../../hooks/useGameHistory';
import {
  clearCompletedQuickMatches,
  deleteQuickMatch as deleteStoredQuickMatch,
  loadCompletedQuickMatches,
  loadSportTournaments,
  replaceCompletedQuickMatches,
  saveData,
} from '../../utils/storage';
import { loadHistory } from '../../utils/universalStorage';
import { getSportById, getSportsList } from '../../models/sportRegistry';
import {
  getCompletedAt,
  getTournamentMatches,
  isTournamentMatchCompleted,
  normalizeNonTeamWinner,
} from '../../utils/tournamentSync';
import { shareText } from '../../mobile/share';
import { MonoStatisticsPanel } from './MonoStatistics';
import MonoSheet from './components/MonoSheet';
import { deriveTeamColours, normaliseHex, teamColourVars } from '../../lib/teamColour';
import { sportIdentity, sportIdentityVars } from '../../lib/sportIdentity';
import { Chevron, EmptyHistoryArt, FilterChip, GoArrow, KitSection, KitTop, KitWash, SportBadge } from './kit/KitParts';
import { displayScore, groupByMonth, latestMonthSummary, sportCounts, winnerSide } from './kit/historyModel';
import { relativeDay } from './kit/dates';
import './kit/history.css';
import InProgressMatches from './components/InProgressMatches';

const ANY_SPORT = 'all';
const RESULT_ALL = 'all';
const RESULT_DECIDED = 'decided';
const RESULT_DRAW = 'draw';
const RESULT_CLOSE = 'close';
const SORT_NEWEST = 'newest';
const SORT_OLDEST = 'oldest';
// After a delete, focus goes to the next row, or to the list heading when there is none.
const FOCUS_LIST_HEADING = 'list-heading';
const RESULT_LABELS = {
  [RESULT_DECIDED]: 'Decided',
  [RESULT_DRAW]: 'Draws',
  [RESULT_CLOSE]: 'Close',
};
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
  const [view, setView] = useState('matches');
  const [quickMatches, setQuickMatches] = useState([]);
  const [tournamentEntries, setTournamentEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState(ANY_SPORT);
  const [resultFilter, setResultFilter] = useState(RESULT_ALL);
  const [sortOrder, setSortOrder] = useState(SORT_NEWEST);
  const [showFilters, setShowFilters] = useState(false);
  const [pendingClear, setPendingClear] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [historyStatus, setHistoryStatus] = useState('');
  const [focusAfterDelete, setFocusAfterDelete] = useState(null);
  const rowRefs = useRef(new Map());
  const matchesPanelRef = useRef(null);

  // A plain status line ("Result copied.") clears itself; an undo stays until the next action.
  const undoOffered = Boolean(pendingDelete?.deleted || pendingClear?.cleared);
  useEffect(() => {
    if (!historyStatus || undoOffered) return undefined;
    const timer = setTimeout(() => setHistoryStatus(''), 4000);
    return () => clearTimeout(timer);
  }, [historyStatus, undoOffered]);

  useEffect(() => {
    const loadedQuick = loadCompletedQuickMatches();
    loadedQuick.sort((a, b) => toTimestamp(b.completedAt || b.date || b.createdAt) - toTimestamp(a.completedAt || a.date || a.createdAt));

    setQuickMatches(loadedQuick);
    setTournamentEntries(buildTournamentEntries());
  }, []);

  // The Stats panel mutates the SAME quick-match store (se_quickmatches) with its
  // own local copy, so re-read whenever the Matches tab is (re)entered — otherwise a
  // delete/clear performed under Stats leaves stale rows here until a remount.
  useEffect(() => {
    if (view !== 'matches') return;
    const loadedQuick = loadCompletedQuickMatches();
    loadedQuick.sort((a, b) => toTimestamp(b.completedAt || b.date || b.createdAt) - toTimestamp(a.completedAt || a.date || a.createdAt));
    setQuickMatches(loadedQuick);
  }, [view]);

  const quickEntries = useMemo(() => {
    return quickMatches.map((qm) => {
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
        sportName: getSportById(qm.sport)?.name || 'Custom',
        team1: qm.team1,
        team2: qm.team2,
        score,
        winner: normalizeNonTeamWinner(qm.winner),
        elapsedSeconds: qm.elapsedSeconds,
        date: qm.completedAt || qm.date || qm.createdAt,
        // The pair the scorer picked (kept locally since S1); only plain hex survives.
        colours: normaliseHex(qm.team1Color) && normaliseHex(qm.team2Color) ? [qm.team1Color, qm.team2Color] : null,
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

  // Sport chips: the sports already played, most played first, then every other registered sport
  // (re-picking a chip clears it, as before).
  const sportChips = useMemo(() => {
    const played = sportCounts(allEntries).map((item) => getSportById(item.id)).filter(Boolean);
    const playedIds = new Set(played.map((sport) => sport.id));
    return [...played, ...getSportsList().filter((sport) => !playedIds.has(sport.id))];
  }, [allEntries]);

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
    deleteStoredQuickMatch(id);
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
    const index = filteredEntries.findIndex((entry) => entry.id === pendingDelete.entry.id);
    const next = index >= 0 ? filteredEntries[index + 1] : null;
    setFocusAfterDelete(next ? next.id : FOCUS_LIST_HEADING);
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
    replaceCompletedQuickMatches(pendingDelete.quickSnapshot);
    setPendingDelete(null);
    setHistoryStatus('Quick match restored.');
  };

  const clearAllQuickMatches = () => {
    setQuickMatches([]);
    clearCompletedQuickMatches();
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
    replaceCompletedQuickMatches(pendingClear.quick);
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
      // As Home's Rematch: the saved pair goes along and quick setup validates it.
      state: entry.colours
        ? { teams: [entry.team1, entry.team2], colours: entry.colours }
        : { teams: [entry.team1, entry.team2] },
    });
  };

  // Runs after the sheet has closed, whose cleanup aims focus at the deleted (now unmounted) row.
  useEffect(() => {
    if (!focusAfterDelete || selectedEntry) return;
    const headings = matchesPanelRef.current?.querySelectorAll('.kit-sec h2, .kit-empty h2') ?? [];
    const target = rowRefs.current.get(focusAfterDelete) ?? headings[headings.length - 1];
    target?.focus();
    setFocusAfterDelete(null);
  }, [focusAfterDelete, selectedEntry]);

  const closeDetails = () => {
    setSelectedEntry(null);
    if (pendingDelete && !pendingDelete.deleted) setPendingDelete(null);
  };

  const summary = latestMonthSummary(filteredEntries);
  const groups = groupByMonth(filteredEntries);
  const typeOptions = [
    { value: 'all', label: 'All', count: totalCount },
    { value: 'quick', label: 'Quick', count: quickCount },
    { value: 'tournament', label: 'Tournaments', count: tournamentCount },
  ];
  const resultOptions = [
    { value: RESULT_ALL, label: 'All' },
    { value: RESULT_DECIDED, label: RESULT_LABELS[RESULT_DECIDED] },
    { value: RESULT_DRAW, label: RESULT_LABELS[RESULT_DRAW] },
    { value: RESULT_CLOSE, label: RESULT_LABELS[RESULT_CLOSE] },
  ];
  const sortOptions = [
    { value: SORT_NEWEST, label: 'Newest' },
    { value: SORT_OLDEST, label: 'Oldest' },
  ];
  const panelFilterCount = [filter !== 'all', resultFilter !== RESULT_ALL, sortOrder !== SORT_NEWEST].filter(Boolean).length;
  const undo = pendingDelete?.deleted
    ? { label: 'Undo delete', onClick: undoDeleteQuickMatch }
    : pendingClear?.cleared ? { label: 'Undo clear', onClick: undoClearMutableHistory } : null;

  return (
    <div className="kit-screen" data-screen="history">
      <KitWash from={sportIdentity('volleyball')?.tint} to={sportIdentity('cricket')?.tint} />
      <KitTop title="History" />

      {/* Two views over the same record data: the match list and the aggregate stats. */}
      <div className="kit-seg" role="tablist" aria-label="History and statistics views" style={{ '--kit-seg-cols': 2 }}>
        {[['matches', 'Matches'], ['stats', 'Stats']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-history-${id}`}
            aria-selected={view === id}
            aria-controls={`tabpanel-history-${id}`}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'stats' ? (
        <div id="tabpanel-history-stats" role="tabpanel" aria-labelledby="tab-history-stats" style={{ marginTop: 16 }}>
          <MonoStatisticsPanel />
        </div>
      ) : (
        <div id="tabpanel-history-matches" role="tabpanel" aria-labelledby="tab-history-matches" ref={matchesPanelRef}>
          <InProgressMatches />
          {totalCount === 0 ? (
            <section className="kit-card kit-empty" aria-labelledby="history-empty-title">
              <EmptyHistoryArt />
              <h2 id="history-empty-title" tabIndex={-1}>No match history yet</h2>
              <p>Completed quick matches and tournaments will appear here.</p>
              <div className="kit-btnstack">
                <button type="button" className="se-go" onClick={() => navigate('/play')}>
                  Choose a sport <GoArrow />
                </button>
              </div>
            </section>
          ) : (
            <>
              {summary && <MonthCard summary={summary} />}

              <div className="kit-chips" role="group" aria-label="Filter by sport" style={{ marginTop: 14 }}>
                <FilterChip label="All" pressed={sportFilter === ANY_SPORT} onClick={() => setSportFilter(ANY_SPORT)} />
                {sportChips.map((sport) => (
                  <FilterChip
                    key={sport.id}
                    label={sport.name}
                    sportId={sport.id}
                    pressed={sportFilter === sport.name}
                    onClick={() => setSportFilter(sportFilter === sport.name ? ANY_SPORT : sport.name)}
                  />
                ))}
              </div>

              <div className="kit-findbar">
                <label htmlFor="history-search" className="sr-only">Find match</label>
                <input
                  id="history-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="kit-search"
                  placeholder="Search matches"
                />
                <button
                  type="button"
                  className="se-ctl"
                  aria-expanded={showFilters}
                  aria-controls="history-filters"
                  onClick={() => setShowFilters((value) => !value)}
                >
                  {panelFilterCount > 0 ? `Filters · ${panelFilterCount}` : 'Filters'}
                </button>
              </div>

              {showFilters && (
                <div id="history-filters" className="kit-card kit-filter-panel">
                  <ChipGroup title="Match type" options={typeOptions} selected={filter} onPick={setFilter} />
                  <ChipGroup title="Result" options={resultOptions} selected={resultFilter} onPick={setResultFilter} />
                  <ChipGroup title="Sort" options={sortOptions} selected={sortOrder} onPick={setSortOrder} />
                </div>
              )}

              {hasActiveDiscoveryFilter && filteredEntries.length > 0 && (
                <div style={{ marginTop: 4, textAlign: 'right' }}>
                  <button type="button" className="kit-quiet kit-clear" onClick={resetDiscoveryFilters}>Clear filters</button>
                </div>
              )}

              {filteredEntries.length === 0 ? (
                <section className="kit-card kit-empty" aria-labelledby="history-none-title">
                  <h2 id="history-none-title" tabIndex={-1}>No matches found</h2>
                  <p>Try a different search, sport, result, or date filter.</p>
                  <div className="kit-btnstack">
                    <button type="button" className="se-ctl" onClick={resetDiscoveryFilters}>Clear filters</button>
                    <button type="button" className="se-ctl" onClick={() => navigate('/play')}>Choose a sport</button>
                  </div>
                </section>
              ) : (
                groups.map((group) => (
                  <section key={group.key} aria-labelledby={`history-month-${group.key}`}>
                    <KitSection
                      id={`history-month-${group.key}`}
                      focusable
                      title={group.label}
                      aside={<span>{group.entries.length === 1 ? '1 match' : `${group.entries.length} matches`}</span>}
                    />
                    <div className="kit-list">
                      {group.entries.map((entry) => (
                        <HistoryRow
                          key={entry.id}
                          entry={entry}
                          onOpen={() => setSelectedEntry(entry)}
                          buttonRef={(node) => {
                            if (node) rowRefs.current.set(entry.id, node);
                            else rowRefs.current.delete(entry.id);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}

              {clearableCount > 0 && (
                pendingClear && !pendingClear.cleared ? (
                  <div className="kit-card kit-confirm">
                    <p>Clear local history?</p>
                    <p>Saved tournaments stay. Older match records and quick matches can be restored before leaving this screen.</p>
                    <div className="kit-btnrow">
                      <button type="button" className="se-ctl" style={{ flex: 1 }} onClick={() => setPendingClear(null)}>Cancel</button>
                      <button type="button" className="se-ctl kit-danger" style={{ flex: 1 }} onClick={clearMutableHistory}>Clear</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <button type="button" className="kit-quiet" onClick={confirmClearMutableHistory}>Clear local history</button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      <MonoSheet open={Boolean(selectedEntry)} onClose={closeDetails} title="Match details">
        {selectedEntry && (
          <MatchDetails
            entry={selectedEntry}
            confirmingDelete={Boolean(pendingDelete && !pendingDelete.deleted && pendingDelete.entry.id === selectedEntry.id)}
            onRematch={selectedEntry.source === 'quick' && getSportById(selectedEntry.sport) ? () => rematchEntry(selectedEntry) : null}
            onShare={() => shareEntry(selectedEntry)}
            onDelete={selectedEntry.source === 'quick' ? () => confirmDeleteQuickMatch(selectedEntry) : null}
            onConfirmDelete={completeDeleteQuickMatch}
            onCancelDelete={() => setPendingDelete(null)}
            onClose={closeDetails}
          />
        )}
      </MonoSheet>

      {(historyStatus || undo) && (
        <div className="kit-toast">
          <span role="status" aria-live="polite">{historyStatus}</span>
          {undo && <button type="button" onClick={undo.onClick}>{undo.label}</button>}
        </div>
      )}
    </div>
  );
}

/* The month card: the newest month in the list, its total, and one stack bar whose segments and
   legend are the same per-sport counts as that month's rows below (they always sum to the list). */
function MonthCard({ summary }) {
  const sportsLabel = summary.sports.length === 1 ? '1 sport' : `${summary.sports.length} sports`;
  return (
    <section className="kit-card" aria-labelledby="history-month-card" style={{ marginTop: 14 }}>
      <div className="kit-month-head">
        <h2 id="history-month-card">{summary.label}</h2>
        <span>{sportsLabel}</span>
      </div>
      <p className="kit-month-total" style={{ margin: '4px 0 0' }}>
        <b>{summary.total}</b> {summary.total === 1 ? 'match scored' : 'matches scored'}
      </p>
      <div className="kit-stack" aria-hidden="true">
        {summary.sports.map((sport) => (
          <i key={sport.id} style={{ ...sportIdentityVars(sport.id), flex: sport.count }} />
        ))}
      </div>
      <ul className="kit-legend" aria-label={`${summary.label} by sport`}>
        {summary.sports.map((sport) => (
          <li key={sport.id} style={sportIdentityVars(sport.id)}>
            <i aria-hidden="true" />
            {sport.name} <b>{sport.count}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}
MonthCard.propTypes = {
  summary: PropTypes.shape({
    label: PropTypes.string.isRequired,
    total: PropTypes.number.isRequired,
    sports: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
    })).isRequired,
  }).isRequired,
};

function ChipGroup({ title, options, selected, onPick }) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="kit-chips kit-chips-wrap" role="group" aria-label={title}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            count={option.count}
            pressed={selected === option.value}
            onClick={() => onPick(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
ChipGroup.propTypes = {
  title: PropTypes.string.isRequired,
  selected: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    count: PropTypes.number,
  })).isRequired,
  onPick: PropTypes.func.isRequired,
};

function entryTitle(entry) {
  if (entry.isLegacy) return entry.tournamentName;
  const side = winnerSide(entry);
  return (
    <>
      {side === 'a' ? <strong>{entry.team1}</strong> : entry.team1} v {side === 'b' ? <strong>{entry.team2}</strong> : entry.team2}
    </>
  );
}

function entryLabel(entry) {
  return entry.isLegacy ? entry.tournamentName : `${entry.team1} vs ${entry.team2}`;
}

/* What a screen reader hears for a row: its visible content in reading order, then the action.
   "Royals 3–1 Strikers, Royals won, Volleyball, Yesterday. View details"; a draw names no winner. */
function rowLabel(entry, context, day) {
  const score = displayScore(entry.score);
  const title = entry.isLegacy ? `${entry.tournamentName} ${score}` : `${entry.team1} ${score} ${entry.team2}`;
  const result = normalizeNonTeamWinner(entry.winner) ? winnerLabel(entry.winner) : null;
  return `${[title, result, entry.sportName, context, day].filter(Boolean).join(', ')}. View details`;
}

/* A History row, the S1 Home row: the doodle badge, the winner bold (draws plain), the sport and
   day, the score in numerals. The whole row opens the match. */
function HistoryRow({ entry, onOpen, buttonRef = undefined }) {
  const score = displayScore(entry.score);
  const context = entry.source === 'quick' ? null : (entry.isLegacy ? entry.participants : entry.tournamentName);
  const day = relativeDay(toTimestamp(entry.date) || null);
  return (
    <button type="button" className="kit-row" ref={buttonRef} onClick={onOpen} aria-label={rowLabel(entry, context, day)}>
      <SportBadge sportId={entry.sport} />
      <span className="kit-row-text">
        <span className="kit-row-title">{entryTitle(entry)}</span>
        <span className="kit-row-sub">
          {[entry.sportName, context, day].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className={`kit-row-score${score.length > 7 ? ' is-long' : ''}`}>{score}</span>
      <Chevron />
    </button>
  );
}
HistoryRow.propTypes = {
  entry: PropTypes.object.isRequired,
  onOpen: PropTypes.func.isRequired,
  buttonRef: PropTypes.func,
};

/* The delete confirm replaces the details in the open sheet, so it takes focus itself (Cancel, the
   safe choice) instead of leaving it on the Delete button that just unmounted. */
function ConfirmDelete({ entry, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div className="kit-confirm" style={{ marginTop: 0 }}>
      <p>Delete this quick match?</p>
      <p>{entry.team1} vs {entry.team2} will be removed from History.</p>
      <div className="kit-btnrow">
        <button type="button" ref={cancelRef} className="se-ctl" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button type="button" className="se-ctl kit-danger" style={{ flex: 1 }} onClick={onConfirm}>Delete</button>
      </div>
    </div>
  );
}
ConfirmDelete.propTypes = {
  entry: PropTypes.object.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

function MatchDetails({ entry, confirmingDelete, onRematch, onShare, onDelete, onConfirmDelete, onCancelDelete, onClose }) {
  const side = winnerSide(entry);
  const colours = entry.colours ? teamColourVars(deriveTeamColours(entry.colours[0], entry.colours[1])) : null;
  const meta = [
    entry.sportName,
    entry.source === 'quick' ? 'Quick match' : 'Tournament',
    entry.isLegacy ? entry.participants : entry.tournamentName,
    formatDate(entry.date),
    entry.elapsedSeconds > 0 ? formatElapsed(entry.elapsedSeconds) : null,
  ].filter(Boolean).join(' · ');

  if (confirmingDelete) {
    return <ConfirmDelete entry={entry} onConfirm={onConfirmDelete} onCancel={onCancelDelete} />;
  }

  return (
    <div className="kit-detail" style={colours || undefined}>
      <p className="kit-detail-meta">{meta}</p>
      {entry.isLegacy ? (
        <p className="kit-row-title" style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>{entry.tournamentName}</p>
      ) : (
        <div className="kit-detail-teams" aria-label={entryLabel(entry)} role="group">
          {[['a', entry.team1], ['b', entry.team2]].map(([key, name]) => (
            <div key={key} className={`kit-detail-team${side === key ? ' is-winner' : ''}`}>
              {colours && <i className={`kit-last-bar kit-last-bar-${key}`} aria-hidden="true" />}
              <span>{name}</span>
            </div>
          ))}
        </div>
      )}
      <p className="kit-detail-result">
        {displayScore(entry.score)}
        <span className="kit-row-sub" style={{ display: 'inline', marginLeft: 10, fontFamily: 'var(--se-font-sans)' }}>{winnerLabel(entry.winner)}</span>
      </p>
      <div className="kit-btnstack">
        {onRematch && <button type="button" className="se-go" onClick={onRematch}>Rematch <GoArrow /></button>}
        <div className="kit-btnrow">
          <button type="button" className="se-ctl" style={{ flex: 1 }} onClick={onShare}>Share</button>
          {onDelete && (
            <button
              type="button"
              className="se-ctl kit-danger"
              style={{ flex: 1 }}
              aria-label={`Delete match ${entry.team1} vs ${entry.team2}`}
              onClick={onDelete}
            >
              Delete
            </button>
          )}
        </div>
        <button type="button" className="se-ctl" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
MatchDetails.propTypes = {
  entry: PropTypes.object.isRequired,
  confirmingDelete: PropTypes.bool.isRequired,
  onRematch: PropTypes.func,
  onShare: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  onConfirmDelete: PropTypes.func.isRequired,
  onCancelDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

