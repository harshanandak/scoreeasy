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
import { sportIdentityVars } from '../../lib/sportIdentity';
import { Chevron, EmptyHistoryArt, GoArrow, KitSection, SportBadge } from './kit/KitParts';
import './kit/history.css';
import './kit/stats.css';
import { PLAY_HUB_PATH } from '../../utils/appPaths';

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
    formResults: lastFive.map((winner) => (isDrawWinner(winner) ? 'Draw' : winner)),
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

const OVERVIEW = 'overview';
const QUICK = 'quick';

function BoltMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" />
    </svg>
  );
}

function CrossMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// The stats body, shell-free, so the merged History page (MonoHistory) hosts it
// under its own page shell + tab bar. There is no standalone /statistics route any
// more — /statistics and /stats redirect to /history — so this panel is the only
// entry point (the former default-export wrapper was unreachable and was removed).
export function MonoStatisticsPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(OVERVIEW);

  // The chip row scrolls sideways on a phone: keep the chosen chip in view (a By sport row can pick
  // one that sits off the right edge).
  useEffect(() => {
    const chip = document.getElementById(`tab-stats-${tab}`);
    if (typeof chip?.scrollIntoView === 'function') chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  const [sportsData, setSportsData] = useState({});
  const [quickMatches, setQuickMatches] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingClear, setPendingClear] = useState(null);
  const [statsStatus, setStatsStatus] = useState('');

  useEffect(() => {
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
  // Action-first Overview: with zero games the zero-value Performance/Records/Totals
  // grids are noise, so the empty state leads with a CTA instead (I-013).
  const hasAnyData = sportsWithData.length > 0 || quickMatches.length > 0;
  const hasQuickRecovery = pendingDelete?.deleted || pendingClear?.cleared;
  const tabs = [
    { id: OVERVIEW, label: 'Overview' },
    ...sportsWithData.map(d => ({ id: d.sport.id, label: d.sport.name, sportId: d.sport.id })),
    ...(quickMatches.length > 0 || hasQuickRecovery ? [{ id: QUICK, label: 'Quick' }] : []),
  ];
  const startQuickMatch = () => navigate(PLAY_HUB_PATH);
  const undo = pendingDelete?.deleted
    ? { label: 'Undo delete', onClick: undoDeleteQuickMatch }
    : pendingClear?.cleared ? { label: 'Undo clear', onClick: undoClearAllQuickMatches } : null;

  return (
    <div className="kit-stats">
      {/* A single category is no choice: the chips only appear once there is something to switch to. */}
      {tabs.length > 1 && (
        <div className="kit-chips" role="tablist" aria-label="Statistics categories">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-stats-${t.id}`}
              className="kit-fchip"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-stats-${t.id}`}
              style={t.sportId ? sportIdentityVars(t.sportId) : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.sportId && <i aria-hidden="true" />}
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === OVERVIEW && (
        <div id="tabpanel-stats-overview" role="tabpanel" aria-label="Overview">
          {!hasAnyData ? (
            /* Lead with the CTA — skip the zero-value stat grids entirely (I-013). */
            <StatsEmpty
              id="stats-empty-title"
              title="No stats yet"
              text="Finish a quick match or tournament to unlock win rates, streaks, and form."
              onStart={startQuickMatch}
              withArt
            />
          ) : (
            <>
              {/* Importance tiers: performance first, records second, library totals last. */}
              <KitSection title="Performance" />
              <div className="kit-insights">
                <InsightCard label="Top team" value={quickInsights.topTeam} />
                <InsightCard label="Current streak" value={quickInsights.streak} />
                <section className="kit-card kit-insight kit-insight-wide" aria-labelledby="stats-form-label">
                  <h3 id="stats-form-label">Last 5 form</h3>
                  {quickInsights.formResults.length > 0 ? (
                    <ul className="kit-form" aria-labelledby="stats-form-label">
                      {quickInsights.formResults.map((winner, index) => <li key={`${index}-${winner}`}>{winner}</li>)}
                    </ul>
                  ) : (
                    <p className="is-quiet">No form yet</p>
                  )}
                </section>
              </div>

              <KitSection title="Records" />
              <div className="kit-list">
                <StatRow label="Head-to-head" value={quickInsights.rivalry} />
                <StatRow label="Closest match" value={quickInsights.closest} />
                <StatRow label="Biggest win" value={quickInsights.biggest} />
              </div>

              <KitSection title="By sport" />
              <div className="kit-list">
                {sportsWithData.map(sportData => (
                  <button key={sportData.sport.id} type="button" className="kit-row" onClick={() => setTab(sportData.sport.id)}>
                    <SportBadge sportId={sportData.sport.id} />
                    <span className="kit-row-text">
                      <span className="kit-row-title">{sportData.sport.name}</span>
                      <span className="kit-row-sub">
                        {pluralize(sportData.tournaments, 'tournament')} &middot; {pluralize(sportData.matches, 'match', 'matches')}
                      </span>
                    </span>
                    <span className="kit-sport-row-end">{pluralize(sportData.teams.size, 'team')}<Chevron /></span>
                  </button>
                ))}
                {quickMatches.length > 0 && (
                  <button type="button" className="kit-row" onClick={() => setTab(QUICK)}>
                    <span className="kit-badge kit-quick-badge" aria-hidden="true"><BoltMark /></span>
                    <span className="kit-row-text">
                      <span className="kit-row-title">Quick matches</span>
                      <span className="kit-row-sub">{pluralize(quickMatches.length, 'match', 'matches')} played</span>
                    </span>
                    <span className="kit-sport-row-end"><Chevron /></span>
                  </button>
                )}
              </div>

              <KitSection title="Totals" />
              <div className="kit-stat-grid">
                <StatTile label="Tournaments" value={totalTournaments} />
                <StatTile label="Matches" value={totalMatches} />
                <StatTile label="Teams" value={totalTeams} />
              </div>
              <div className="kit-list" style={{ marginTop: 10 }}>
                <StatRow label="Most played sport" value={quickInsights.topSport} />
                <StatRow label="Draw rate" value={quickInsights.drawRate} />
                <StatRow label="Avg margin" value={quickInsights.averageMargin} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Dynamic sport tabs */}
      {sportsWithData.map(sportData => (
        tab === sportData.sport.id && (
          <div key={sportData.sport.id} id={`tabpanel-stats-${sportData.sport.id}`} role="tabpanel" aria-label={sportData.sport.name}>
            <KitSection title={sportData.sport.name} aside={<span>{pluralize(sportData.teams.size, 'team')}</span>} />
            <TeamStatsTable
              sportId={sportData.sport.id}
              sportName={sportData.sport.name}
              tournaments={sportData.tournamentsRaw}
              engine={sportData.sport.engine}
            />
          </div>
        )
      ))}

      {/* Quick Matches */}
      {tab === QUICK && (
        <div id="tabpanel-stats-quick" role="tabpanel" aria-label="Quick matches">
          {pendingDelete && !pendingDelete.deleted && (
            <div className="kit-card kit-confirm" style={{ marginTop: 18 }}>
              <p>Delete this quick stat?</p>
              <p>{getQuickMatchLabel(pendingDelete.match)} will be removed from Statistics and History.</p>
              <div className="kit-btnrow">
                <button type="button" className="se-ctl" style={{ flex: 1 }} onClick={() => setPendingDelete(null)}>Cancel</button>
                <button type="button" className="se-ctl kit-danger" style={{ flex: 1 }} onClick={completeDeleteQuickMatch}>Delete</button>
              </div>
            </div>
          )}

          {pendingClear && !pendingClear.cleared && (
            <div className="kit-card kit-confirm" style={{ marginTop: 18 }}>
              <p>Clear all quick stats?</p>
              <p>This removes quick matches from Statistics and History. You can undo before leaving this screen.</p>
              <div className="kit-btnrow">
                <button type="button" className="se-ctl" style={{ flex: 1 }} onClick={() => setPendingClear(null)}>Cancel</button>
                <button type="button" className="se-ctl kit-danger" style={{ flex: 1 }} onClick={completeClearAllQuickMatches}>Clear all</button>
              </div>
            </div>
          )}

          {quickMatches.length === 0 ? (
            <StatsEmpty
              id="stats-quick-empty-title"
              title="No quick matches yet"
              text="Score one match to unlock team form, streaks, and head-to-head stats."
              onStart={startQuickMatch}
            />
          ) : (
            <>
              <div className="kit-stat-grid" style={{ marginTop: 18 }}>
                <StatTile label="Quick matches" value={quickMatches.length} />
                <StatTile label="Quick teams" value={quickTeamRows.length} />
                <StatTile label="Draws" value={quickMatches.filter((match) => isDrawWinner(resolveWinner(match, getQuickScore(match)))).length} />
              </div>

              <KitSection title="Quick team form" aside={<span>Win rate and margin</span>} />
              <QuickTeamTable rows={quickTeamRows} />

              <KitSection title="Recent quick matches" />
              <div className="kit-list kit-recent">
                {quickMatches.map(qm => {
                  const score = formatQuickScore(qm);
                  return (
                    <div key={qm.id} className="kit-row">
                      <span className="kit-row-text">
                        <span className="kit-row-title">{qm.team1} vs {qm.team2}</span>
                        <span className="kit-row-sub">
                          {qm.winner} &middot; {new Date(qm.completedAt || qm.date || qm.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span className={`kit-row-score${score.length > 7 ? ' is-long' : ''}`}>{score}</span>
                      <button
                        type="button"
                        className="kit-icon-btn"
                        onClick={() => requestDeleteQuickMatch(qm)}
                        title="Delete this match"
                        aria-label={`Delete match ${qm.team1} vs ${qm.team2}, ${score}`}
                      >
                        <CrossMark />
                      </button>
                    </div>
                  );
                })}
              </div>

              {quickMatches.length > 1 && !pendingClear && (
                <div className="kit-stats-actions">
                  <button type="button" className="kit-quiet" onClick={requestClearAllQuickMatches}>Clear all quick stats</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {(statsStatus || undo) && (
        <div className="kit-toast">
          <span role="status" aria-live="polite">{statsStatus}</span>
          {undo && <button type="button" onClick={undo.onClick}>{undo.label}</button>}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="kit-card kit-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

StatTile.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function InsightCard({ label, value }) {
  return (
    <section className="kit-card kit-insight">
      <h3>{label}</h3>
      <p className={String(value).startsWith('No ') ? 'is-quiet' : undefined}>{value}</p>
    </section>
  );
}

InsightCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function StatRow({ label, value }) {
  return (
    <div className="kit-row kit-stat-row">
      <span className="kit-row-text">
        <span className="kit-row-sub">{label}</span>
        <span className="kit-row-title">{value}</span>
      </span>
    </div>
  );
}

StatRow.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

/* One team per row: name and win rate on top, a win-rate bar, then the labelled numbers. Rows are
   ARIA table rows (a visually hidden header row names every column) so the cells stay readable
   and the numbers never scroll off a 360px screen. DOM order is P W L ... Win%; the grid places
   Win% beside the name. */
function TeamTable({ label, columns, rows, sportId }) {
  return (
    <div
      className="kit-team-table"
      role="table"
      aria-label={label}
      style={{ ...(sportId ? sportIdentityVars(sportId) : {}), '--kit-team-cols': columns.length }}
    >
      <div className="kit-team-header" role="row">
        {['Team', ...columns.map((column) => column.header), 'Win rate'].map((header) => (
          <span key={header} role="columnheader">{header}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.name} className="kit-team-row" role="row">
          <span className="kit-team-name" role="rowheader">{row.name}</span>
          <span className="kit-win-bar" aria-hidden="true"><i style={{ width: `${row.winRate}%` }} /></span>
          {columns.map((column) => (
            <span key={column.header} className="kit-team-cell" role="cell" data-label={column.label}>
              <span className={`kit-num${column.tone ? ` ${column.tone(row)}` : ''}`}>{column.value(row)}</span>
            </span>
          ))}
          <span className="kit-team-win" role="cell" data-label="win rate">
            <span className="kit-num">{row.winRate}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const signTone = (value) => {
  if (Number(value) > 0) return 'kit-pos';
  if (Number(value) < 0) return 'kit-neg';
  return '';
};

TeamTable.propTypes = {
  label: PropTypes.string.isRequired,
  sportId: PropTypes.string,
  columns: PropTypes.arrayOf(PropTypes.shape({
    header: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    value: PropTypes.func.isRequired,
    tone: PropTypes.func,
  })).isRequired,
  rows: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    winRate: PropTypes.number,
  })).isRequired,
};

const QUICK_COLUMNS = [
  { header: 'Played', label: 'P', value: (row) => row.played },
  { header: 'Won', label: 'W', value: (row) => row.won },
  { header: 'Lost', label: 'L', value: (row) => row.lost },
  { header: 'Drawn', label: 'D', value: (row) => row.drawn },
  { header: 'Margin', label: '+/-', value: (row) => (row.margin > 0 ? `+${row.margin}` : row.margin), tone: (row) => signTone(row.margin) },
];

function QuickTeamTable({ rows }) {
  if (rows.length === 0) return null;
  return <TeamTable label="Quick match team form" columns={QUICK_COLUMNS} rows={rows} />;
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

/* The Kit empty card (History's, with the same scorebook doodle on the main one): a title, one
   line of why, and the one action. */
function StatsEmpty({ id, title, text, onStart, withArt = false }) {
  return (
    <section className="kit-card kit-empty" aria-labelledby={id}>
      {withArt && <EmptyHistoryArt />}
      <h2 id={id}>{title}</h2>
      <p>{text}</p>
      {onStart && (
        <div className="kit-btnstack">
          <button type="button" className="se-go" onClick={onStart}>
            Start quick match <GoArrow />
          </button>
        </div>
      )}
    </section>
  );
}

StatsEmpty.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  onStart: PropTypes.func,
  withArt: PropTypes.bool,
};

const SPORT_COLUMNS = [
  { header: 'Played', label: 'P', value: (row) => row.played },
  { header: 'Won', label: 'W', value: (row) => row.won },
  { header: 'Lost', label: 'L', value: (row) => row.lost },
  { header: 'For', label: 'For', value: (row) => row.pointsFor },
  { header: 'Against', label: 'Agst', value: (row) => row.pointsAgainst },
  { header: 'Avg margin', label: 'Avg', value: (row) => row.averageMargin, tone: (row) => signTone(row.averageMargin) },
];

function TeamStatsTable({ sportId, sportName, tournaments, engine }) {
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

  if (data.length === 0) {
    return (
      <section className="kit-card kit-empty" aria-labelledby="stats-sport-empty-title">
        <h2 id="stats-sport-empty-title">{`No ${sportName.toLowerCase()} data yet`}</h2>
        <p>Teams appear here once a tournament match is finished.</p>
      </section>
    );
  }

  const rows = data.map((row) => ({
    ...row,
    winRate: row.played > 0 ? Math.round((row.won / row.played) * 100) : 0,
  }));

  return <TeamTable label={`${sportName} team statistics`} columns={SPORT_COLUMNS} rows={rows} sportId={sportId} />;
}

TeamStatsTable.propTypes = {
  sportId: PropTypes.string,
  sportName: PropTypes.string,
  tournaments: PropTypes.array,
  engine: PropTypes.string,
};
