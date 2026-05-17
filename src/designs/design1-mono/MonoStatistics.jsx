import PropTypes from 'prop-types';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadData, saveData } from '../../utils/storage';
import { getSportsList } from '../../models/sportRegistry';
import { isTournamentMatchCompleted } from '../../utils/tournamentSync';
import BackArrow from './components/BackArrow';
import SportIcon from './SportIcon';

const QM_KEY = 'se_quickmatches';

function getMatchDate(match) {
  return new Date(match.completedAt || match.date || match.createdAt || 0);
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

function buildQuickInsights(matches) {
  const sorted = [...matches].sort((a, b) => getMatchDate(b) - getMatchDate(a));
  const teamWins = {};
  const sportCounts = {};
  let closest = null;
  let biggest = null;

  sorted.forEach((match) => {
    const score = getQuickScore(match);
    const margin = Math.abs(score.score1 - score.score2);
    const winner = resolveWinner(match, score);
    const sport = match.sport || match.sportName || 'Quick';

    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    if (winner !== 'Draw') teamWins[winner] = (teamWins[winner] || 0) + 1;

    const label = `${match.team1} vs ${match.team2}`;
    if (!closest || margin < closest.margin) closest = { label, margin };
    if (!biggest || margin > biggest.margin) biggest = { label, margin, winner };
  });

  const topTeam = Object.entries(teamWins).sort((a, b) => b[1] - a[1])[0];
  const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0];
  const lastFive = sorted.slice(0, 5).map((match) => {
    const score = getQuickScore(match);
    return resolveWinner(match, score) === 'Draw' ? 'D' : 'W';
  });
  const latestWinner = sorted.length > 0 ? resolveWinner(sorted[0], getQuickScore(sorted[0])) : null;
  const streakBreak = latestWinner && latestWinner !== 'Draw'
    ? sorted.findIndex((match) => resolveWinner(match, getQuickScore(match)) !== latestWinner)
    : 0;
  const currentStreak = streakBreak === -1 ? sorted.length : streakBreak;

  return {
    topTeam: topTeam ? `${topTeam[0]} (${topTeam[1]}W)` : 'No winner yet',
    form: lastFive.length > 0 ? lastFive.join(' ') : 'No form yet',
    streak: currentStreak > 0 ? `${latestWinner} W${currentStreak === -1 ? sorted.length : currentStreak}` : 'No active streak',
    closest: closest ? `${closest.label} (${closest.margin})` : 'No close games yet',
    biggest: biggest ? `${biggest.winner} by ${biggest.margin}` : 'No big wins yet',
    topSport: topSport ? `${topSport[0]} (${topSport[1]})` : 'No sport yet',
  };
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

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const qm = loadData(QM_KEY, []);
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
    saveData(QM_KEY, updated);
  };

  const clearAllQuickMatches = () => {
    setQuickMatches([]);
    saveData(QM_KEY, []);
  };

  // Calculate totals
  const totalTournaments = Object.values(sportsData).reduce((sum, d) => sum + d.tournaments, 0);
  const totalMatches = Object.values(sportsData).reduce((sum, d) => sum + d.matches, 0) + quickMatches.length;
  const allTeams = new Set();
  Object.values(sportsData).forEach(d => d.teams.forEach(t => allTeams.add(t)));
  const totalTeams = allTeams.size;
  const quickInsights = buildQuickInsights(quickMatches);

  // Build tabs dynamically - only show sports with data
  const sportsWithData = Object.values(sportsData).filter(d => d.tournaments > 0);
  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...sportsWithData.map(d => ({ id: d.sport.id, label: d.sport.name })),
    ...(quickMatches.length > 0 ? [{ id: 'quick', label: 'Quick' }] : []),
  ];

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        <nav className="flex items-center gap-2 mb-2" aria-label="Breadcrumb">
          <button onClick={() => navigate('/')} className="text-sm bg-transparent border-none cursor-pointer font-swiss flex items-center gap-1" style={{ color: '#888' }} aria-label="Go back to home">
            <BackArrow /> Home
          </button>
        </nav>

        <h1 className="text-xl font-semibold tracking-tight mb-8" style={{ color: '#111' }}>
          Statistics
        </h1>

        {/* Tabs */}
        <div className="flex gap-0 mb-8" style={{ borderBottom: '1px solid #eee' }} role="tablist" aria-label="Statistics categories">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`tabpanel-stats-${t.id}`}
              className="bg-transparent border-none cursor-pointer font-swiss px-4 py-3 text-sm"
              style={{
                color: tab === t.id ? '#0066ff' : '#888',
                borderBottom: tab === t.id ? '2px solid #0066ff' : '2px solid transparent',
                fontWeight: tab === t.id ? 500 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div id="tabpanel-stats-overview" role="tabpanel" aria-label="Overview">
            <div className="grid grid-cols-3 gap-3 mb-8">
              <StatCard label="Tournaments" value={totalTournaments} />
              <StatCard label="Matches" value={totalMatches} />
              <StatCard label="Teams" value={totalTeams} />
            </div>

            <div className="grid gap-3 mb-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              <InsightCard label="Top team" value={quickInsights.topTeam} />
              <InsightCard label="Last 5 form" value={quickInsights.form} />
              <InsightCard label="Current streak" value={quickInsights.streak} />
              <InsightCard label="Closest match" value={quickInsights.closest} />
              <InsightCard label="Biggest win" value={quickInsights.biggest} />
              <InsightCard label="Most played sport" value={quickInsights.topSport} />
            </div>

            <hr className="mono-divider mb-6" />

            <div className="flex flex-col gap-3">
              {/* Show all sports with data */}
              {sportsWithData.map(sportData => (
                <div key={sportData.sport.id} className="mono-card flex items-center justify-between" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <SportIcon name={sportData.sport.name} size={24} color="#111" />
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111' }}>{sportData.sport.name}</p>
                      <p className="text-xs" style={{ color: '#888' }}>
                        {sportData.tournaments} tournament{sportData.tournaments > 1 ? 's' : ''} &middot; {sportData.matches} match{sportData.matches !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-sm" style={{ color: '#888' }}>
                    {sportData.teams.size} team{sportData.teams.size !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}

              {/* Quick matches */}
              {quickMatches.length > 0 && (
                <div className="mono-card flex items-center justify-between" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚡</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111' }}>Quick Matches</p>
                      <p className="text-xs" style={{ color: '#888' }}>
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
            {quickMatches.length === 0 ? (
              <EmptyState icon={'\u26A1'} label="No quick matches yet" />
            ) : (
              <>
                {quickMatches.length > 1 && (
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={clearAllQuickMatches}
                      className="bg-transparent border-none cursor-pointer font-swiss text-xs"
                      style={{ color: '#dc2626' }}
                    >
                      Clear all
                    </button>
                  </div>
                )}
                <div className="flex flex-col gap-2">
          {quickMatches.map(qm => (
                    <div key={qm.id} className="mono-card" style={{ padding: '12px 16px' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: '#111' }}>
                              {qm.team1} vs {qm.team2}
                            </span>
                            <span className="text-xs font-mono" style={{ color: '#888' }}>
                              {qm.score1 !== undefined
                                ? `${qm.score1}-${qm.score2}`
                                : Array.isArray(qm.innings) && qm.innings.length > 0
                                  ? `${qm.score1 ?? 0}-${qm.score2 ?? 0}`
                                  : `${qm.team1Score?.runs}/${qm.team1Score?.wickets} vs ${qm.team2Score?.runs}/${qm.team2Score?.wickets}`
                              }
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs" style={{ color: '#0066ff' }}>{qm.winner}</span>
                            <span className="text-xs" style={{ color: '#bbb' }}>
                              {new Date(qm.completedAt || qm.date || qm.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteQuickMatch(qm.id)}
                          className="bg-transparent border-none cursor-pointer text-sm"
                          style={{ color: '#bbb', padding: '2px 6px' }}
                          title="Delete this match"
                          aria-label={`Delete match ${qm.team1} vs ${qm.team2}`}
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
    <div className="mono-card text-center" style={{ padding: '16px 12px' }}>
      <p className="text-2xl font-bold font-mono mono-score" style={{ color: '#111' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: '#888' }}>{label}</p>
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function InsightCard({ label, value }) {
  return (
    <div className="mono-card" style={{ padding: '14px 16px', minHeight: 82 }}>
      <p className="text-xs uppercase mb-2" style={{ color: '#888', letterSpacing: '0.08em' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: '#111', lineHeight: 1.35 }}>{value}</p>
    </div>
  );
}

InsightCard.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function EmptyState({ icon, label, primaryAction, secondaryAction }) {
  const isEmoji = icon && icon.length <= 2;
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '20vh' }}>
      {isEmoji ? (
        <span className="text-4xl mb-3">{icon}</span>
      ) : (
        <div className="mb-3"><SportIcon name={icon} size={36} color="#bbb" /></div>
      )}
      <p className="text-sm mb-4" style={{ color: '#888', maxWidth: 340 }}>{label}</p>
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
    <div className="mono-card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <caption className="sr-only">{sportName} team statistics</caption>
        <thead>
          <tr style={{ borderBottom: '1px solid #eee' }}>
            <th scope="col" className="text-left font-normal" style={{ color: '#888', padding: '12px 16px' }}>Team</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 8px' }}>P</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 8px' }}>W</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 8px' }}>L</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 8px' }}>For</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 8px' }}>Agst</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 8px' }}>Avg</th>
            <th scope="col" className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 16px' }}>Win%</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.name} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td scope="row" className="font-medium" style={{ color: '#111', padding: '12px 16px' }}>{row.name}</td>
              <td className="text-center font-mono" style={{ color: '#888', padding: '12px 8px' }}>{row.played}</td>
              <td className="text-center font-mono" style={{ color: '#111', padding: '12px 8px' }}>{row.won}</td>
              <td className="text-center font-mono" style={{ color: '#888', padding: '12px 8px' }}>{row.lost}</td>
              <td className="text-center font-mono" style={{ color: '#111', padding: '12px 8px' }}>{row.pointsFor}</td>
              <td className="text-center font-mono" style={{ color: '#888', padding: '12px 8px' }}>{row.pointsAgainst}</td>
              <td className="text-center font-mono" style={{ color: row.averageMargin >= 0 ? '#0066ff' : '#dc2626', padding: '12px 8px' }}>{row.averageMargin}</td>
              <td className="text-center font-mono" style={{ color: '#0066ff', padding: '12px 16px' }}>
                {row.played > 0 ? Math.round((row.won / row.played) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

TeamStatsTable.propTypes = {
  sportName: PropTypes.string,
  sportIcon: PropTypes.string,
  tournaments: PropTypes.array,
  engine: PropTypes.string,
};

