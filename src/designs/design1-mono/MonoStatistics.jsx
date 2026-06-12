import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearCompletedQuickMatches,
  deleteQuickMatch as deleteStoredQuickMatch,
  loadCompletedQuickMatches,
  loadSportTournaments,
  replaceCompletedQuickMatches,
} from '../../utils/storage';
import { getSportsList } from '../../models/sportRegistry';
import { isTournamentMatchCompleted } from '../../utils/tournamentSync';
import BackArrow from './components/BackArrow';
import SportIcon from './SportIcon';

function getMatchDate(match) {
  return new Date(match.completedAt || match.date || match.createdAt || 0);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatSportName(value) {
  if (!value) return 'Quick';
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getQuickScore(match) {
  if (typeof match.score1 === 'number' && typeof match.score2 === 'number') {
    return { score1: match.score1, score2: match.score2 };
  }

  if (Array.isArray(match.sets) && match.sets.length > 0) {
    return {
      score1: match.setsWon1 ?? match.sets.filter((set) => set.score1 > set.score2).length,
      score2: match.setsWon2 ?? match.sets.filter((set) => set.score2 > set.score1).length,
    };
  }

  if (match.team1Score || match.team2Score) {
    return {
      score1: match.team1Score?.runs ?? 0,
      score2: match.team2Score?.runs ?? 0,
    };
  }

  return { score1: 0, score2: 0 };
}

function resolveWinner(match, score) {
  const winnerText = String(match.winner || '').toLowerCase();
  const team1 = String(match.team1 || '').toLowerCase();
  const team2 = String(match.team2 || '').toLowerCase();

  if (team1 && winnerText.includes(team1)) return match.team1;
  if (team2 && winnerText.includes(team2)) return match.team2;
  if (score.score1 > score.score2) return match.team1;
  if (score.score2 > score.score1) return match.team2;
  return 'Draw';
}

function isDrawWinner(winner) {
  return winner === 'Draw' || winner === 'Tie';
}

function getQuickMatchLabel(match) {
  return `${match.team1 || 'Team A'} vs ${match.team2 || 'Team B'}`;
}

function getPairKey(team1, team2) {
  return [team1 || 'Team A', team2 || 'Team B']
    .sort((a, b) => String(a).localeCompare(String(b)))
    .join(' vs ');
}

function ensureQuickTeam(teamMap, teamName) {
  if (!teamMap[teamName]) {
    teamMap[teamName] = {
      name: teamName,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };
  }
  return teamMap[teamName];
}

function buildQuickTeamRows(matches) {
  const teamMap = {};

  matches.forEach((match) => {
    const team1 = match.team1 || 'Team A';
    const team2 = match.team2 || 'Team B';
    const score = getQuickScore(match);
    const winner = resolveWinner(match, score);
    const team1Row = ensureQuickTeam(teamMap, team1);
    const team2Row = ensureQuickTeam(teamMap, team2);

    team1Row.played++;
    team2Row.played++;
    team1Row.pointsFor += score.score1;
    team1Row.pointsAgainst += score.score2;
    team2Row.pointsFor += score.score2;
    team2Row.pointsAgainst += score.score1;

    if (isDrawWinner(winner)) {
      team1Row.drawn++;
      team2Row.drawn++;
    } else if (winner === team1) {
      team1Row.won++;
      team2Row.lost++;
    } else if (winner === team2) {
      team2Row.won++;
      team1Row.lost++;
    }
  });

  return Object.values(teamMap)
    .map((row) => ({
      ...row,
      margin: row.pointsFor - row.pointsAgainst,
      winRate: row.played > 0 ? Math.round((row.won / row.played) * 100) : 0,
    }))
    .sort((a, b) => b.won - a.won || b.winRate - a.winRate || b.margin - a.margin || a.name.localeCompare(b.name));
}

function buildQuickInsights(matches) {
  const sorted = [...matches].sort((a, b) => getMatchDate(b) - getMatchDate(a));
  const teamRows = buildQuickTeamRows(sorted);
  const sportCounts = {};
  const pairCounts = {};
  let closest = null;
  let biggest = null;
  let draws = 0;
  let totalMargin = 0;

  sorted.forEach((match) => {
    const score = getQuickScore(match);
    const margin = Math.abs(score.score1 - score.score2);
    const winner = resolveWinner(match, score);
    const sport = formatSportName(match.sportName || match.sport || 'Quick');
    const label = getQuickMatchLabel(match);
    const pairKey = getPairKey(match.team1, match.team2);

    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
    if (isDrawWinner(winner)) draws++;
    totalMargin += margin;

    if (!closest || margin < closest.margin) closest = { label, margin };
    if (!biggest || margin > biggest.margin) {
      biggest = {
        label,
        margin,
        winner,
        loser: winner === match.team1 ? match.team2 : match.team1,
      };
    }
  });

  const topTeam = teamRows.find((row) => row.won > 0);
  const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0];
  const topPair = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0];
  const lastFive = sorted.slice(0, 5).map((match) => resolveWinner(match, getQuickScore(match)));
  const latestWinner = sorted.length > 0 ? resolveWinner(sorted[0], getQuickScore(sorted[0])) : null;
  const streakBreak = latestWinner && latestWinner !== 'Draw'
    ? sorted.findIndex((match) => resolveWinner(match, getQuickScore(match)) !== latestWinner)
    : 0;
  const currentStreak = streakBreak === -1 ? sorted.length : streakBreak;
  const averageMargin = sorted.length > 0 ? (totalMargin / sorted.length).toFixed(1) : '0.0';

  return {
    topTeam: topTeam ? `${topTeam.name} ${topTeam.won}W / ${topTeam.winRate}%` : 'No winner yet',
    form: lastFive.length > 0 ? lastFive.map((winner) => (isDrawWinner(winner) ? 'Draw' : winner)).join(' -> ') : 'No form yet',
    streak: currentStreak > 0 ? `${latestWinner} W${currentStreak}` : 'No active streak',
    closest: closest ? `${closest.label} ${closest.margin === 0 ? 'draw' : `by ${closest.margin}`}` : 'No close games yet',
    biggest: biggest && biggest.margin > 0 ? `${biggest.winner} over ${biggest.loser} by ${biggest.margin}` : 'No big wins yet',
    topSport: topSport ? `${topSport[0]} (${pluralize(topSport[1], 'match', 'matches')})` : 'No sport yet',
    rivalry: topPair ? `${topPair[0]} (${pluralize(topPair[1], 'match', 'matches')})` : 'No head-to-head yet',
    drawRate: sorted.length > 0 ? `${draws} of ${pluralize(sorted.length, 'match', 'matches')}` : 'No draws yet',
    averageMargin: `${averageMargin} avg margin`,
  };
}

function formatQuickScore(match) {
  const score = getQuickScore(match);
  if (match.team1Score || match.team2Score) {
    return `${match.team1Score?.runs ?? score.score1}/${match.team1Score?.wickets ?? 0} vs ${match.team2Score?.runs ?? score.score2}/${match.team2Score?.wickets ?? 0}`;
  }
  return `${score.score1}-${score.score2}`;
}

function recordTeamResult(teamMap, team1, team2, score1, score2) {
  teamMap[team1].played++;
  teamMap[team2].played++;
  teamMap[team1].pointsFor += score1;
  teamMap[team1].pointsAgainst += score2;
  teamMap[team2].pointsFor += score2;
  teamMap[team2].pointsAgainst += score1;

  if (score1 > score2) {
    teamMap[team1].won++;
    teamMap[team2].lost++;
  } else if (score2 > score1) {
    teamMap[team2].won++;
    teamMap[team1].lost++;
  }
}

export default function MonoStatistics() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState('overview');
  const [sportsData, setSportsData] = useState({});
  const [quickMatches, setQuickMatches] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingClear, setPendingClear] = useState(null);
  const [statsStatus, setStatsStatus] = useState('');

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const qm = loadCompletedQuickMatches();
    qm.sort((a, b) => new Date(b.completedAt || b.date || b.createdAt) - new Date(a.completedAt || a.date || a.createdAt));
    setQuickMatches(qm);

    // Load stats for ALL sports
    const allSports = getSportsList();
    const dataMap = {};

    allSports.forEach(sport => {
      const tournaments = loadSportTournaments(sport.storageKey);
      let matches = 0;
      const teams = new Set();

      tournaments.forEach(t => {
        const allMatches = [...(t.matches || []), ...(t.knockoutMatches || [])];
        matches += allMatches.filter((m) => isTournamentMatchCompleted(m, sport.engine, m.format || t.format)).length;
        t.teams?.forEach(team => teams.add(team.name));
      });

      dataMap[sport.id] = {
        sport,
        tournaments: tournaments.length,
        matches,
        teams,
        tournamentsRaw: tournaments,
      };
    });

    setSportsData(dataMap);
  }, []);

  const deleteQuickMatch = (id) => {
    const updated = quickMatches.filter(qm => qm.id !== id);
    setQuickMatches(updated);
    deleteStoredQuickMatch(id);
  };

  const requestDeleteQuickMatch = (match) => {
    setPendingClear(null);
    setPendingDelete({
      match,
      quickSnapshot: quickMatches,
      deleted: false,
    });
    setStatsStatus('');
  };

  const completeDeleteQuickMatch = () => {
    if (!pendingDelete?.match?.id) return;
    deleteQuickMatch(pendingDelete.match.id);
    setPendingDelete({
      ...pendingDelete,
      deleted: true,
    });
    setStatsStatus('Quick stat deleted.');
  };

  const undoDeleteQuickMatch = () => {
    if (!pendingDelete?.quickSnapshot) return;
    setQuickMatches(pendingDelete.quickSnapshot);
    replaceCompletedQuickMatches(pendingDelete.quickSnapshot);
    setPendingDelete(null);
    setStatsStatus('Quick stat restored.');
  };

  const requestClearAllQuickMatches = () => {
    setPendingDelete(null);
    setPendingClear({
      quickSnapshot: quickMatches,
      cleared: false,
    });
    setStatsStatus('');
  };

  const clearAllQuickMatches = () => {
    setQuickMatches([]);
    clearCompletedQuickMatches();
  };

  const completeClearAllQuickMatches = () => {
    if (!pendingClear?.quickSnapshot) return;
    clearAllQuickMatches();
    setPendingClear({
      ...pendingClear,
      cleared: true,
    });
    setStatsStatus('Quick stats cleared.');
  };

  const undoClearAllQuickMatches = () => {
    if (!pendingClear?.quickSnapshot) return;
    setQuickMatches(pendingClear.quickSnapshot);
    replaceCompletedQuickMatches(pendingClear.quickSnapshot);
    setPendingClear(null);
    setStatsStatus('Quick stats restored.');
  };

  // Calculate totals
  const totalTournaments = Object.values(sportsData).reduce((sum, d) => sum + d.tournaments, 0);
  const totalMatches = Object.values(sportsData).reduce((sum, d) => sum + d.matches, 0) + quickMatches.length;
  const allTeams = new Set();
  Object.values(sportsData).forEach(d => d.teams.forEach(t => allTeams.add(t)));
  const quickTeamRows = buildQuickTeamRows(quickMatches);
  quickTeamRows.forEach((row) => allTeams.add(row.name));
  const totalTeams = allTeams.size;
  const quickInsights = buildQuickInsights(quickMatches);

  // Build tabs dynamically - only show sports with data
  const sportsWithData = Object.values(sportsData).filter(d => d.tournaments > 0);
  const hasQuickRecovery = pendingDelete?.deleted || pendingClear?.cleared;
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...sportsWithData.map(d => ({ id: d.sport.id, label: d.sport.name })),
    ...(quickMatches.length > 0 || hasQuickRecovery ? [{ id: 'quick', label: 'Quick' }] : []),
  ];

  return (
    <div className={`min-h-screen px-4 sm:px-6 py-8 sm:py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="mono-page-shell">
        <nav className="flex items-center gap-2 mb-2" aria-label="Breadcrumb">
          <button onClick={() => navigate('/')} className="text-sm bg-transparent border-none cursor-pointer font-swiss flex items-center gap-1 mono-muted-text" aria-label="Go back to home">
            <BackArrow /> Home
          </button>
        </nav>

        <h1 className="mono-page-header text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
          Statistics
        </h1>

        {/* Tabs */}
        <div className="mono-tabs" role="tablist" aria-label="Statistics categories">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-stats-${t.id}`}
              className={tab === t.id ? 'mono-tab mono-tab-active' : 'mono-tab'}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div id="tabpanel-stats-overview" role="tabpanel" aria-label="Overview">
            {/* Importance tiers: performance first, records second, library totals last. */}
            <p className="font-mono" style={{ margin: '0 0 8px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Performance</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <InsightCard label="Top team" value={quickInsights.topTeam} />
              <InsightCard label="Last 5 form" value={quickInsights.form} />
              <InsightCard label="Current streak" value={quickInsights.streak} />
            </div>

            <p className="font-mono" style={{ margin: '0 0 8px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Records</p>
            <div className="mono-stat-insight-grid grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <InsightCard label="Head-to-head" value={quickInsights.rivalry} />
              <InsightCard label="Closest match" value={quickInsights.closest} />
              <InsightCard label="Biggest win" value={quickInsights.biggest} />
            </div>

            <p className="font-mono" style={{ margin: '0 0 8px', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>Totals</p>
            <div className="mono-stat-insight-grid grid gap-3 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
              <StatCard label="Tournaments" value={totalTournaments} />
              <StatCard label="Matches" value={totalMatches} />
              <StatCard label="Teams" value={totalTeams} />
              <InsightCard label="Most played sport" value={quickInsights.topSport} />
              <InsightCard label="Draw rate" value={quickInsights.drawRate} />
              <InsightCard label="Avg margin" value={quickInsights.averageMargin} />
            </div>

            <hr className="mono-divider mb-6" />

            <div className="mono-stat-list flex flex-col">
              {/* Show all sports with data */}
              {sportsWithData.map(sportData => (
                <div key={sportData.sport.id} className="mono-stat-card mono-stat-row flex items-center justify-between" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <SportIcon name={sportData.sport.name} size={24} color="var(--se-color-action)" />
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111' }}>{sportData.sport.name}</p>
                      <p className="text-xs mono-muted-text">
                        {sportData.tournaments} tournament{sportData.tournaments > 1 ? 's' : ''} &middot; {sportData.matches} match{sportData.matches !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-sm mono-muted-text">
                    {sportData.teams.size} team{sportData.teams.size !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}

              {/* Quick matches */}
              {quickMatches.length > 0 && (
                <div className="mono-stat-card mono-stat-row flex items-center justify-between" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-mono mono-action-text" aria-hidden="true">Q</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111' }}>Quick Matches</p>
                      <p className="text-xs mono-muted-text">
                        {quickMatches.length} match{quickMatches.length !== 1 ? 'es' : ''} played
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state if no data at all */}
              {sportsWithData.length === 0 && quickMatches.length === 0 && (
                <EmptyState
                  icon="📊"
                  label="No game data yet. Finish a quick match or tournament to unlock win rates, streaks, and form."
                  primaryAction={{ label: 'Start quick match', onClick: () => navigate('/volleyball/quick') }}
                  secondaryAction={{ label: 'Create tournament', onClick: () => navigate('/volleyball/tournament/new') }}
                />
              )}
            </div>
          </div>
        )}

        {/* Dynamic sport tabs */}
        {sportsWithData.map(sportData => (
          tab === sportData.sport.id && (
            <div key={sportData.sport.id} id={`tabpanel-stats-${sportData.sport.id}`} role="tabpanel" aria-label={sportData.sport.name}>
              <TeamStatsTable
                sportId={sportData.sport.id}
                sportName={sportData.sport.name}
                sportIcon={sportData.sport.name}
                tournaments={sportData.tournamentsRaw}
                engine={sportData.sport.engine}
              />
            </div>
          )
        ))}

        {/* Quick Matches */}
        {tab === 'quick' && (
          <div id="tabpanel-stats-quick" role="tabpanel" aria-label="Quick matches">
            {statsStatus && (
              <div
                className="mono-card mono-status-card mb-4"
                role="status"
                aria-live="polite"
                style={{ padding: '10px 12px' }}
              >
                {statsStatus}
              </div>
            )}

            {pendingDelete && !pendingDelete.deleted && (
              <div className="mono-card mono-danger-card mb-4" style={{ padding: '14px 16px' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Delete this quick stat?</p>
                <p className="text-xs mb-4 mono-muted-text">
                  {getQuickMatchLabel(pendingDelete.match)} will be removed from Statistics and History.
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
                    className="mono-btn-primary mono-btn-danger flex-1"
                    style={{ minHeight: 44, padding: '10px' }}
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

            {pendingClear && !pendingClear.cleared && (
              <div className="mono-card mono-danger-card mb-4" style={{ padding: '14px 16px' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#111' }}>Clear all quick stats?</p>
                <p className="text-xs mb-4 mono-muted-text">
                  This removes quick matches from Statistics and History. You can undo before leaving this screen.
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
                    className="mono-btn-primary mono-btn-danger flex-1"
                    style={{ minHeight: 44, padding: '10px' }}
                    onClick={completeClearAllQuickMatches}
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {pendingClear?.cleared && (
              <button
                type="button"
                className="mono-btn mb-4 w-full"
                style={{ minHeight: 44, padding: '10px' }}
                onClick={undoClearAllQuickMatches}
              >
                Undo clear
              </button>
            )}

            {quickMatches.length === 0 ? (
              <EmptyState
                icon={'\u26A1'}
                label="No quick matches yet. Score one match to unlock team form, streaks, and head-to-head stats."
                primaryAction={{ label: 'Start quick match', onClick: () => navigate('/volleyball/quick') }}
                secondaryAction={{ label: 'View history', onClick: () => navigate('/history') }}
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <StatCard label="Quick matches" value={quickMatches.length} />
                  <StatCard label="Quick teams" value={quickTeamRows.length} />
                  <StatCard label="Draws" value={quickMatches.filter((match) => isDrawWinner(resolveWinner(match, getQuickScore(match)))).length} />
                </div>

                <div className="mono-table-panel mono-stat-panel mb-6" style={{ padding: 0 }}>
                  <div className="flex items-center justify-between gap-3" style={{ padding: '14px 16px', borderBottom: '1px solid #eee' }}>
                    <h2 className="text-sm font-semibold" style={{ color: '#111', margin: 0 }}>Quick team form</h2>
                    <span className="text-xs mono-muted-text">Win rate and margin</span>
                  </div>
                  <QuickTeamTable rows={quickTeamRows} />
                </div>

                {quickMatches.length > 1 && (
                  <div className="flex justify-end mb-3">
                    <button
                      type="button"
                      onClick={requestClearAllQuickMatches}
                      className="mono-btn mono-btn-danger font-swiss text-xs"
                      style={{
                        minHeight: 40,
                        padding: '0 12px',
                      }}
                    >
                      Clear all quick stats
                    </button>
                  </div>
                )}
                <h2 className="text-sm font-semibold mb-3" style={{ color: '#111' }}>Recent quick matches</h2>
                <div className="mono-stat-list flex flex-col">
                  {quickMatches.map(qm => (
                    <div key={qm.id} className="mono-stat-card mono-stat-row" style={{ padding: '12px 16px' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#111' }}>
                              {qm.team1} vs {qm.team2}
                            </span>
                            <span className="text-xs font-mono mono-muted-text">
                              {formatQuickScore(qm)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs mono-action-text">{qm.winner}</span>
                            <span className="text-xs mono-subtle-text">
                              {new Date(qm.completedAt || qm.date || qm.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestDeleteQuickMatch(qm)}
                          className="bg-transparent border-none cursor-pointer text-sm"
                          style={{ color: 'var(--se-color-ink-muted)', minHeight: 40, minWidth: 40, padding: '2px 6px' }}
                          title="Delete this match"
                          aria-label={`Delete match ${qm.team1} vs ${qm.team2}, ${formatQuickScore(qm)}`}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="mono-stat-strip mono-stat-card mono-stat-number-card text-center" style={{ padding: '16px 12px' }}>
      <p className="text-2xl font-bold font-mono mono-score" style={{ color: '#111' }}>{value}</p>
      <p className="text-xs mt-1 mono-muted-text">{label}</p>
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function InsightCard({ label, value }) {
  return (
    <div className="mono-stat-strip mono-stat-card" style={{ padding: '14px 16px', minHeight: 82 }}>
      <p className="text-xs uppercase mb-2 mono-muted-text" style={{ letterSpacing: '0.08em' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: '#111', lineHeight: 1.35 }}>{value}</p>
    </div>
  );
}

InsightCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function QuickTeamTable({ rows }) {
  if (rows.length === 0) return null;

  return (
    <div className="mono-table-scroll">
      <table className="mono-data-table">
        <caption className="sr-only">Quick match team form</caption>
        <thead>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <th scope="col" className="text-left" style={{ padding: '10px 12px' }}>Team</th>
            <th scope="col" className="text-center font-mono" style={{ padding: '10px 6px' }}>P</th>
            <th scope="col" className="text-center font-mono" style={{ padding: '10px 6px' }}>W</th>
            <th scope="col" className="text-center font-mono" style={{ padding: '10px 6px' }}>L</th>
            <th scope="col" className="text-center font-mono" style={{ padding: '10px 6px' }}>D</th>
            <th scope="col" className="text-center font-mono" style={{ padding: '10px 6px' }}>+/-</th>
            <th scope="col" className="text-center font-mono" style={{ padding: '10px 12px' }}>Win%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <th scope="row" className="font-medium mono-table-primary text-left" style={{ padding: '10px 12px' }}>{row.name}</th>
              <td className="text-center font-mono" style={{ padding: '10px 6px' }}>{row.played}</td>
              <td className="text-center font-mono mono-table-primary" style={{ padding: '10px 6px' }}>{row.won}</td>
              <td className="text-center font-mono" style={{ padding: '10px 6px' }}>{row.lost}</td>
              <td className="text-center font-mono" style={{ padding: '10px 6px' }}>{row.drawn}</td>
              <td className={`text-center font-mono ${row.margin > 0 ? 'mono-table-action' : row.margin < 0 ? 'mono-table-danger' : ''}`} style={{ padding: '10px 6px' }}>
                {row.margin > 0 ? `+${row.margin}` : row.margin}
              </td>
              <td className="text-center font-mono mono-table-action" style={{ padding: '10px 12px' }}>{row.winRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

QuickTeamTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    played: PropTypes.number,
    won: PropTypes.number,
    lost: PropTypes.number,
    drawn: PropTypes.number,
    margin: PropTypes.number,
    winRate: PropTypes.number,
  })),
};

function EmptyState({ icon, label, primaryAction, secondaryAction }) {
  const isEmoji = icon && icon.length <= 2;
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '20vh' }}>
      {isEmoji ? (
        <span className="text-4xl mb-3">{icon}</span>
      ) : (
        <div className="mb-3"><SportIcon name={icon} size={36} color="var(--se-color-ink-muted)" /></div>
      )}
      <p className="text-sm mb-4 mono-muted-text" style={{ maxWidth: 340 }}>{label}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {primaryAction && (
            <button
              type="button"
              className="mono-btn-primary"
              style={{ minHeight: 44, padding: '10px 16px' }}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              className="mono-btn"
              style={{ minHeight: 44, padding: '10px 16px' }}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.string,
  label: PropTypes.string,
  primaryAction: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
  secondaryAction: PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
  }),
};

function TeamStatsTable({ sportName, sportIcon, tournaments, engine }) { // sportId intentionally omitted — unused param removed (S1854)
  const [data, setData] = useState([]);

  useEffect(() => {
    const teamMap = {};

    tournaments.forEach(t => {
      t.teams?.forEach(team => {
        if (!teamMap[team.name]) {
          teamMap[team.name] = {
            name: team.name,
            played: 0,
            won: 0,
            lost: 0,
            pointsFor: 0,
            pointsAgainst: 0,
          };
        }
      });

      const allMatches = [...(t.matches || []), ...(t.knockoutMatches || [])];
      allMatches.forEach(match => {
        if (engine === 'custom-cricket') {
          // Cricket scoring
          if (!isTournamentMatchCompleted(match, engine, match.format || t.format)) return;
          const t1 = t.teams?.find(te => te.id === match.team1Id)?.name;
          const t2 = t.teams?.find(te => te.id === match.team2Id)?.name;
          if (!t1 || !t2 || !teamMap[t1] || !teamMap[t2]) return;

          teamMap[t1].played++;
          teamMap[t2].played++;

          const s1 = typeof match.score1 === 'number'
            ? match.score1
            : (match.team1Score?.runs || 0);
          const s2 = typeof match.score2 === 'number'
            ? match.score2
            : (match.team2Score?.runs || 0);
          recordTeamResult(teamMap, t1, t2, s1, s2);
        } else {
          // Sets/Goals scoring
          if (!isTournamentMatchCompleted(match, engine, match.format || t.format)) return;
          const idx1 = match.team1Id ?? match.team1;
          const idx2 = match.team2Id ?? match.team2;
          const t1 = typeof idx1 === 'number' ? t.teams?.[idx1]?.name : t.teams?.find(te => te.id === idx1)?.name;
          const t2 = typeof idx2 === 'number' ? t.teams?.[idx2]?.name : t.teams?.find(te => te.id === idx2)?.name;
          if (!t1 || !t2 || !teamMap[t1] || !teamMap[t2]) return;

          teamMap[t1].played++;
          teamMap[t2].played++;
          if (Array.isArray(match.sets) && match.sets.length > 0) {
            const sets1 = match.setsWon1 ?? match.sets.filter((s) => s.score1 > s.score2).length;
            const sets2 = match.setsWon2 ?? match.sets.filter((s) => s.score2 > s.score1).length;
            recordTeamResult(teamMap, t1, t2, sets1, sets2);
          } else if (typeof match.score1 === 'number' && typeof match.score2 === 'number') {
            recordTeamResult(teamMap, t1, t2, match.score1, match.score2);
          }
        }
      });
    });

    setData(Object.values(teamMap)
      .map((row) => ({
        ...row,
        averageMargin: row.played > 0
          ? ((row.pointsFor - row.pointsAgainst) / row.played).toFixed(1)
          : '0.0',
      }))
      .sort((a, b) => b.won - a.won || b.pointsFor - a.pointsFor));
  }, [tournaments, engine]);

  if (data.length === 0) return <EmptyState icon={sportIcon} label={`No ${sportName.toLowerCase()} data yet`} />;

  return (
    <div className="mono-table-panel mono-stat-panel" style={{ padding: 0 }}>
      <div className="mono-table-scroll">
        <table className="mono-data-table">
          <caption className="sr-only">{sportName} team statistics</caption>
          <thead>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th scope="col" className="text-left" style={{ padding: '12px 16px' }}>Team</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 8px' }}>P</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 8px' }}>W</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 8px' }}>L</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 8px' }}>For</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 8px' }}>Agst</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 8px' }}>Avg</th>
              <th scope="col" className="text-center font-mono" style={{ padding: '12px 16px' }}>Win%</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.name} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <th scope="row" className="font-medium mono-table-primary text-left" style={{ padding: '12px 16px' }}>{row.name}</th>
                <td className="text-center font-mono" style={{ padding: '12px 8px' }}>{row.played}</td>
                <td className="text-center font-mono mono-table-primary" style={{ padding: '12px 8px' }}>{row.won}</td>
                <td className="text-center font-mono" style={{ padding: '12px 8px' }}>{row.lost}</td>
                <td className="text-center font-mono mono-table-primary" style={{ padding: '12px 8px' }}>{row.pointsFor}</td>
                <td className="text-center font-mono" style={{ padding: '12px 8px' }}>{row.pointsAgainst}</td>
                <td className={`text-center font-mono ${Number(row.averageMargin) > 0 ? 'mono-table-action' : Number(row.averageMargin) < 0 ? 'mono-table-danger' : ''}`} style={{ padding: '12px 8px' }}>{row.averageMargin}</td>
                <td className="text-center font-mono mono-table-action" style={{ padding: '12px 16px' }}>
                  {row.played > 0 ? Math.round((row.won / row.played) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

TeamStatsTable.propTypes = {
  sportName: PropTypes.string,
  sportIcon: PropTypes.string,
  tournaments: PropTypes.array,
  engine: PropTypes.string,
};

