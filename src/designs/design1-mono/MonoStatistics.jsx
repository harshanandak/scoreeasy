import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadData, saveData } from '../../utils/storage';
import { getSportsList } from '../../models/sportRegistry';

const QM_KEY = 'se_quickmatches';

export default function MonoStatistics() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState('overview');
  const [sportsData, setSportsData] = useState({});
  const [quickMatches, setQuickMatches] = useState([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const qm = loadData(QM_KEY, []);
    qm.sort((a, b) => new Date(b.date) - new Date(a.date));
    setQuickMatches(qm);

    // Load stats for ALL sports
    const allSports = getSportsList();
    const dataMap = {};

    allSports.forEach(sport => {
      const tournaments = loadSportTournaments(sport.storageKey);
      let matches = 0;
      const teams = new Set();

      tournaments.forEach(t => {
        // Count matches based on sport type
        if (sport.engine === 'custom-cricket') {
          matches += t.matches?.filter(m => m.status === 'completed' || m.team1Score).length || 0;
        } else {
          matches += t.matches?.filter(m => m.score1 !== null && m.score1 !== undefined).length || 0;
        }
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
          <button onClick={() => navigate('/')} className="text-sm bg-transparent border-none cursor-pointer font-swiss" style={{ color: '#888' }} aria-label="Go back to home">
            &larr; Home
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

            <hr className="mono-divider mb-6" />

            <div className="flex flex-col gap-3">
              {/* Show all sports with data */}
              {sportsWithData.map(sportData => (
                <div key={sportData.sport.id} className="mono-card flex items-center justify-between" style={{ padding: '16px 20px' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{sportData.sport.icon}</span>
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
                <EmptyState icon="📊" label="No game data yet. Start playing to see statistics!" />
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
                sportIcon={sportData.sport.icon}
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
                                : `${qm.team1Score?.runs}/${qm.team1Score?.wickets} vs ${qm.team2Score?.runs}/${qm.team2Score?.wickets}`
                              }
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs" style={{ color: '#0066ff' }}>{qm.winner}</span>
                            <span className="text-xs" style={{ color: '#bbb' }}>
                              {new Date(qm.date).toLocaleDateString()}
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

function EmptyState({ icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '20vh' }}>
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm" style={{ color: '#888' }}>{label}</p>
    </div>
  );
}

function TeamStatsTable({ sportId, sportName, sportIcon, tournaments, engine }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    const teamMap = {};

    tournaments.forEach(t => {
      t.teams?.forEach(team => {
        if (!teamMap[team.name]) {
          teamMap[team.name] = { name: team.name, played: 0, won: 0, lost: 0 };
        }
      });

      t.matches?.forEach(match => {
        if (engine === 'custom-cricket') {
          // Cricket scoring
          if (match.status !== 'completed' && !match.team1Score) return;
          const t1 = t.teams?.find(te => te.id === match.team1Id)?.name;
          const t2 = t.teams?.find(te => te.id === match.team2Id)?.name;
          if (!t1 || !t2 || !teamMap[t1] || !teamMap[t2]) return;

          teamMap[t1].played++;
          teamMap[t2].played++;

          const s1 = match.team1Score?.runs || 0;
          const s2 = match.team2Score?.runs || 0;
          if (s1 > s2) { teamMap[t1].won++; teamMap[t2].lost++; }
          else if (s2 > s1) { teamMap[t2].won++; teamMap[t1].lost++; }
        } else {
          // Sets/Goals scoring
          if (match.score1 === null || match.score1 === undefined) return;
          const idx1 = match.team1Id ?? match.team1;
          const idx2 = match.team2Id ?? match.team2;
          const t1 = typeof idx1 === 'number' ? t.teams?.[idx1]?.name : t.teams?.find(te => te.id === idx1)?.name;
          const t2 = typeof idx2 === 'number' ? t.teams?.[idx2]?.name : t.teams?.find(te => te.id === idx2)?.name;
          if (!t1 || !t2 || !teamMap[t1] || !teamMap[t2]) return;

          teamMap[t1].played++;
          teamMap[t2].played++;
          if (match.score1 > match.score2) { teamMap[t1].won++; teamMap[t2].lost++; }
          else { teamMap[t2].won++; teamMap[t1].lost++; }
        }
      });
    });

    setData(Object.values(teamMap).sort((a, b) => b.won - a.won));
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
