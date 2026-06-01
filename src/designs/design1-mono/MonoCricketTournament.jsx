import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, saveSportTournament } from '../../utils/storage';
import { ballsToOvers, calculateCricketPointsTable, getCricketFormat, getLimitedOversResult } from '../../utils/cricketCalculations';
import { getSportById } from '../../models/sportRegistry';
import { migrateCricketFormat } from '../../utils/formatMigration';
import { isGroupStageComplete, initializeKnockoutStage, updateKnockoutBracket, isTournamentComplete, getTournamentWinner } from '../../utils/knockoutManager';
import KnockoutMatchCard from './KnockoutMatchCard';
import TournamentNotFoundActions from './components/TournamentNotFoundActions';
import useTournamentKnockoutDisplay from './hooks/useTournamentKnockoutDisplay';
import { getTournamentProgressCounts } from '../../utils/tournamentDisplay';

// Get human-readable format label from format object
function getFormatLabel(format) {
  if (!format) return 'Cricket';
  const migrated = migrateCricketFormat(format);
  const preset = getCricketFormat(migrated.preset);
  if (preset) return preset.name;
  if (migrated.overs) return `${migrated.overs} overs`;
  return 'Custom';
}

// Format innings display for test matches (e.g. "243/all & 187/6d")
function formatInningsLine(innings, teamId) {
  if (!innings) return null;
  const teamInnings = innings.filter(i => i.teamId === teamId);
  return teamInnings.map((inn) => {
    const wicketDisplay = inn.allOut ? 'all' : inn.wickets || 0;
    const declaredSuffix = inn.declared ? 'd' : '';
    return `${inn.runs}/${wicketDisplay}${declaredSuffix}`;
  }).join(' & ');
}

// Get NRR color
function getNrrColor(nrr) {
  if (nrr > 0) return '#16a34a';
  if (nrr < 0) return '#dc2626';
  return '#888';
}

// Render completed test match scores
function renderTestComplete(match, t1Name, t2Name, t1Wins, t2Wins, winDesc) {
  return (
    <div>
      <div className="flex items-center">
        <div className="flex-1 text-right">
          <p className="text-sm font-medium" style={{ color: t1Wins ? '#111' : '#888' }}>
            {t1Wins && <span style={{ color: '#0066ff', marginRight: 4 }}>★</span>}
            {t1Name}
          </p>
          <p className="text-sm font-bold font-mono mono-score" style={{ color: t1Wins ? '#111' : '#888' }}>
            {formatInningsLine(match.innings, match.team1Id)}
          </p>
        </div>
        <div className="mx-4 text-xs" style={{ color: '#ccc' }}>vs</div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: t2Wins ? '#111' : '#888' }}>
            {t2Wins && <span style={{ color: '#0066ff', marginRight: 4 }}>★</span>}
            {t2Name}
          </p>
          <p className="text-sm font-bold font-mono mono-score" style={{ color: t2Wins ? '#111' : '#888' }}>
            {formatInningsLine(match.innings, match.team2Id)}
          </p>
        </div>
      </div>
      {winDesc && (
        <p className="text-xs text-center mt-2" style={{ color: '#0066ff' }}>{winDesc}</p>
      )}
    </div>
  );
}

// Render completed limited-overs scores
function renderLimitedComplete(match, t1Name, t2Name, t1Wins, t2Wins, winDesc, matchFormat) {
  const useBalls = matchFormat.trackOvers === false;
  return (
    <div>
      <div className="flex items-center">
        <div className="flex-1 text-right">
          <p className="text-sm font-medium" style={{ color: t1Wins ? '#111' : '#888' }}>
            {t1Wins && <span style={{ color: '#0066ff', marginRight: 4 }}>★</span>}
            {t1Name}
          </p>
          <p className="text-lg font-bold font-mono mono-score" style={{ color: t1Wins ? '#111' : '#888' }}>
            {match.team1Score.runs}/{match.team1Score.allOut ? 'all' : match.team1Score.wickets || 0}
          </p>
          <p className="text-xs font-mono" style={{ color: '#bbb' }}>
            {useBalls ? `${match.team1Score.balls} balls` : `${ballsToOvers(match.team1Score.balls)} ov`}
          </p>
        </div>
        <div className="mx-4 text-xs" style={{ color: '#ccc' }}>vs</div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: t2Wins ? '#111' : '#888' }}>
            {t2Wins && <span style={{ color: '#0066ff', marginRight: 4 }}>★</span>}
            {t2Name}
          </p>
          <p className="text-lg font-bold font-mono mono-score" style={{ color: t2Wins ? '#111' : '#888' }}>
            {match.team2Score.runs}/{match.team2Score.allOut ? 'all' : match.team2Score.wickets || 0}
          </p>
          <p className="text-xs font-mono" style={{ color: '#bbb' }}>
            {useBalls ? `${match.team2Score.balls} balls` : `${ballsToOvers(match.team2Score.balls)} ov`}
          </p>
        </div>
      </div>
      {winDesc && (
        <p className="text-xs text-center mt-2" style={{ color: '#0066ff' }}>{winDesc}</p>
      )}
    </div>
  );
}

// Render in-progress test match
function renderTestLive(match, t1Name, t2Name) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: '#111' }}>{t1Name}</span>
        <span className="text-xs" style={{ color: '#ccc' }}>vs</span>
        <span className="text-sm font-medium" style={{ color: '#111' }}>{t2Name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono" style={{ color: '#888' }}>
          {formatInningsLine(match.innings, match.team1Id) || '—'}
        </span>
        <span className="text-xs font-medium" style={{ color: '#0066ff' }}>▶ Resume</span>
        <span className="text-xs font-mono" style={{ color: '#888' }}>
          {formatInningsLine(match.innings, match.team2Id) || '—'}
        </span>
      </div>
    </div>
  );
}

// Render pending or in-progress limited-overs match
function renderPending(t1Name, t2Name, isLive) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: '#111' }}>{t1Name}</span>
      {isLive ? (
        <span className="text-xs font-medium" style={{ color: '#0066ff' }}>▶ Resume</span>
      ) : (
        <span className="text-xs" style={{ color: '#ccc' }}>vs</span>
      )}
      <span className="text-sm" style={{ color: '#111' }}>{t2Name}</span>
    </div>
  );
}

// Dispatcher: pick the right render function for a match card
function renderMatchCard(ctx) {
  const { match, t1Name, t2Name, t1Wins, t2Wins, winDesc, matchFormat, isLive, isComplete, isTestMatch } = ctx;
  if (isComplete && isTestMatch) return renderTestComplete(match, t1Name, t2Name, t1Wins, t2Wins, winDesc);
  if (isComplete && match.team1Score && match.team2Score) return renderLimitedComplete(match, t1Name, t2Name, t1Wins, t2Wins, winDesc, matchFormat);
  if (isLive && isTestMatch) return renderTestLive(match, t1Name, t2Name);
  return renderPending(t1Name, t2Name, isLive);
}

export default function MonoCricketTournament() {
  const navigate = useNavigate();
  const { sport, id } = useParams();
  const sportConfig = getSportById(sport || 'cricket');
  const storageKey = sportConfig?.storageKey || 'se_cricket';
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('matches');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const tournaments = loadSportTournaments(storageKey);
    const found = tournaments.find(t => t.id === Number(id) || t.id === id);
    if (found) setTournament(found);
    requestAnimationFrame(() => setVisible(true));
  }, [id, storageKey]);

  useEffect(() => {
    if (tournament) saveSportTournament(storageKey, tournament);
  }, [tournament, storageKey]);

  // Memoize points table (must be before early returns to satisfy rules of hooks)
  const pointsTable = useMemo(
    () => {
      if (!tournament) return [];
      return calculateCricketPointsTable(tournament.teams, tournament.matches);
    },
    [tournament]
  );

  // Knockout phase transition
  useEffect(() => {
    if (!tournament || !tournament.knockoutConfig) return;
    if (tournament.phase !== 'group') return;
    if (!isGroupStageComplete(tournament.matches)) return;
    if (tournament.knockoutMatches && tournament.knockoutMatches.length > 0) return;

    const updated = initializeKnockoutStage(tournament, pointsTable);
    if (updated !== tournament) {
      const initializedKO = updated.knockoutMatches.map(m => ({
        ...m,
        team1Score: null,
        team2Score: null,
      }));
      setTournament({ ...updated, knockoutMatches: initializedKO });
    }
  }, [tournament, pointsTable]);

  // Bracket seeding
  useEffect(() => {
    if (!tournament?.knockoutMatches?.length) return;
    const updated = updateKnockoutBracket(tournament.knockoutMatches);
    if (updated !== tournament.knockoutMatches) {
      setTournament(prev => ({ ...prev, knockoutMatches: updated }));
    }
  }, [tournament?.knockoutMatches]);

  const knockoutDisplay = useTournamentKnockoutDisplay({
    tournament,
    tab,
    setTab,
    baseTabs: [
      { id: 'matches', label: 'Matches' },
      { id: 'table', label: 'Points Table' },
    ],
    knockoutTab: { id: 'knockout', label: 'Knockout' },
    trailingTabs: [{ id: 'teams', label: 'Teams' }],
    labelOptions: { type: tournament?.type, totalMatches: tournament?.matches?.length ?? 0 },
  });

  if (!tournament) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <TournamentNotFoundActions navigate={navigate} sport={sport || 'cricket'} />
      </div>
    );
  }

  const getTeamName = (teamId) => {
    const team = tournament.teams.find(t => t.id === teamId);
    return team?.name || 'Unknown';
  };

  const { completedMatches, totalMatches } = getTournamentProgressCounts(tournament);

  const clearScore = (matchId) => {
    setTournament(prev => ({
      ...prev,
      matches: prev.matches.map((m) => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          team1Score: null,
          team2Score: null,
          innings: null,
          winner: null,
          winDesc: null,
          followOnEnforced: false,
          superOver: null,
          draftState: null,
          status: 'pending',
        };
      }),
    }));
  };

  const { hasKnockouts, tabs, tournamentTypeLabel } = knockoutDisplay;
  const tournamentDone = isTournamentComplete(tournament);
  const winner = getTournamentWinner(tournament);
  const metaLabel = [
    getFormatLabel(tournament.format),
    `${tournament.teams.length} teams`,
    tournamentTypeLabel,
  ].join(' · ');

  let badgeClass = 'mono-badge-live';
  let badgeText = 'Live';
  if (tournamentDone) {
    badgeClass = 'mono-badge-final';
    badgeText = 'Complete';
  } else if (tournament.phase === 'knockout') {
    badgeClass = 'mono-badge-paused';
    badgeText = 'Knockout';
  }

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate(`/${sport || 'cricket'}/tournament`)}
          className="flex items-center gap-1 text-sm mb-6"
          style={{ color: '#888' }}
        >
          <span>←</span>
          <span>Tournaments</span>
        </button>

        {/* Title row */}
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
            {tournament.name}
          </h1>
          <span className={`mono-badge ${badgeClass}`}>
            {badgeText}
          </span>
        </div>

        {/* Meta */}
        <p className="text-xs mb-5" style={{ color: '#888' }}>
          {metaLabel}
        </p>

        {/* Match progress segments */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-1">
            {tournament.matches.map((m) => (
              <div
                key={m.id}
                title={`Match: ${getTeamName(m.team1Id)} vs ${getTeamName(m.team2Id)}`}
                style={{
                  width: 18, height: 6,
                  background: (m.status === 'completed' || m.status === 'in-progress') ? '#0066ff' : '#e5e5e5',
                  opacity: m.status === 'in-progress' ? 0.4 : 1,
                  transition: 'background 0.2s ease, opacity 0.2s ease',
                }}
              />
            ))}
          </div>
          <span className="text-xs font-mono" style={{ color: '#888' }}>{completedMatches}/{totalMatches}</span>
          {hasKnockouts && tournament.knockoutMatches && tournament.knockoutMatches.length > 0 && (
            <>
              <div style={{ width: 1, height: 10, background: '#ddd' }} />
              <div className="flex items-center gap-1">
                {tournament.knockoutMatches.map((m) => (
                  <div
                    key={m.id}
                    title={m.label}
                    style={{
                      width: 18, height: 6,
                      background: m.status === 'completed' ? '#0066ff' : m.status === 'in-progress' ? '#0066ff' : '#e5e5e5',
                      opacity: m.status === 'completed' ? 1 : m.status === 'in-progress' ? 0.4 : 1,
                      transition: 'background 0.2s ease, opacity 0.2s ease',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-6" style={{ borderBottom: '1px solid #eee' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
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

        {/* Matches */}
        {tab === 'matches' && (
          <div className="flex flex-col gap-3">
            {tournament.matches.map((match, idx) => {
              const isComplete = match.status === 'completed';
              const isLive = match.status === 'in-progress';
              const t1Name = getTeamName(match.team1Id);
              const t2Name = getTeamName(match.team2Id);
              const isTestMatch = match.innings && match.innings.length > 0;
              const matchFormat = migrateCricketFormat(match.format || tournament.format);
              const formatLabel = getFormatLabel(match.format || tournament.format);

              // Determine winner
              let t1Wins = false;
              let t2Wins = false;
              let winDesc = match.winDesc || '';

              if (isComplete) {
                if (match.winner) {
                  t1Wins = match.winner === match.team1Id;
                  t2Wins = match.winner === match.team2Id;
                  if (match.winner === 'draw') winDesc = winDesc || 'Match Drawn';
                  if (match.winner === 'tie') winDesc = winDesc || 'Match Tied';
                } else if (match.team1Score && match.team2Score) {
                  t1Wins = match.team1Score.runs > match.team2Score.runs;
                  t2Wins = match.team2Score.runs > match.team1Score.runs;
                }
                if (!winDesc && match.team1Score && match.team2Score) {
                  winDesc = getLimitedOversResult(match);
                }
              }

              return (
                <div key={match.id} className="mono-card" style={{ padding: 0 }}>
                  {/* Match header */}
                  <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid #eee' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                        Match {idx + 1}
                      </span>
                      {formatLabel && (
                        <span className="mono-badge" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                          {formatLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isLive && (
                        <span className="mono-badge mono-badge-live" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                          Live
                        </span>
                      )}
                      {isComplete && (
                        <>
                          <span className="mono-badge mono-badge-final" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                            Completed
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearScore(match.id);
                            }}
                            className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                            style={{ color: '#dc2626' }}
                          >
                            Clear
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Match card - clickable */}
                  <button
                    onClick={() => navigate(`/${sport || 'cricket'}/tournament/${id}/match/${match.id}/score`)}
                    className="cursor-pointer w-full text-left bg-transparent border-none"
                    style={{
                      padding: '16px 20px',
                      background: isLive ? '#f0f6ff' : 'transparent',
                    }}
                  >
                    {renderMatchCard({ match, t1Name, t2Name, t1Wins, t2Wins, winDesc, matchFormat, isLive, isComplete, isTestMatch })}
                  </button>
                </div>
              );
            })}

            {/* Knockout matches in schedule */}
            {hasKnockouts && tournament.knockoutMatches && tournament.knockoutMatches.length > 0 && (
              <>
                <hr className="mono-divider" style={{ margin: '24px 0' }} />
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                  Knockout Stage
                </p>
                {tournament.knockoutMatches.map(match => (
                  <KnockoutMatchCard
                    key={match.id}
                    match={match}
                    tournament={tournament}
                    sport={sport || 'cricket'}
                    id={id}
                    navigate={navigate}
                    getTeamName={getTeamName}
                    engine="custom-cricket"
                  />
                ))}
              </>
            )}

            {/* Show placeholder knockout schedule before group stage completes */}
            {hasKnockouts && (!tournament.knockoutMatches || tournament.knockoutMatches.length === 0) && (
              <>
                <hr className="mono-divider" style={{ margin: '24px 0' }} />
                <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                  Knockout Stage
                </p>
                {tournament.knockoutConfig.teamsAdvancing === 4 && (
                  <>
                    <div className="mono-card p-5 mb-3">
                      <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#aaa' }}>Semi-final 1</div>
                      <div className="grid grid-cols-3 gap-6 items-center">
                        <div className="text-right text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                        <div className="text-center text-xs" style={{ color: '#bbb' }}>vs</div>
                        <div className="text-left text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                      </div>
                    </div>
                    <div className="mono-card p-5 mb-3">
                      <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#aaa' }}>Semi-final 2</div>
                      <div className="grid grid-cols-3 gap-6 items-center">
                        <div className="text-right text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                        <div className="text-center text-xs" style={{ color: '#bbb' }}>vs</div>
                        <div className="text-left text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                      </div>
                    </div>
                  </>
                )}
                <div className="mono-card p-5 mb-3">
                  <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#aaa' }}>Final</div>
                  <div className="grid grid-cols-3 gap-6 items-center">
                    <div className="text-right text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                    <div className="text-center text-xs" style={{ color: '#bbb' }}>vs</div>
                    <div className="text-left text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                  </div>
                </div>
                {tournament.knockoutConfig.thirdPlaceMatch && (
                  <div className="mono-card p-5">
                    <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#aaa' }}>3rd Place</div>
                    <div className="grid grid-cols-3 gap-6 items-center">
                      <div className="text-right text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                      <div className="text-center text-xs" style={{ color: '#bbb' }}>vs</div>
                      <div className="text-left text-base font-medium" style={{ color: '#ccc' }}>TBD</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Points Table */}
        {tab === 'table' && (
          <div className="mono-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <th className="text-left font-normal" style={{ color: '#888', padding: '12px 12px 12px 16px' }}>#</th>
                    <th className="text-left font-normal" style={{ color: '#888', padding: '12px 8px' }}>Team</th>
                    <th className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 6px' }}>P</th>
                    <th className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 6px' }}>W</th>
                    <th className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 6px' }}>L</th>
                    <th className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 6px' }}>T</th>
                    <th className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 6px' }}>Pts</th>
                    <th className="text-center font-normal font-mono" style={{ color: '#888', padding: '12px 16px 12px 6px' }}>NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsTable.map((row, idx) => (
                    <tr key={row.teamId} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td className="font-mono" style={{ color: '#bbb', padding: '12px 12px 12px 16px' }}>{idx + 1}</td>
                      <td className="font-medium" style={{ color: '#111', padding: '12px 8px' }}>{row.teamName}</td>
                      <td className="text-center font-mono" style={{ color: '#888', padding: '12px 6px' }}>{row.played}</td>
                      <td className="text-center font-mono font-medium" style={{ color: '#111', padding: '12px 6px' }}>{row.won}</td>
                      <td className="text-center font-mono" style={{ color: '#888', padding: '12px 6px' }}>{row.lost}</td>
                      <td className="text-center font-mono" style={{ color: '#888', padding: '12px 6px' }}>{row.tied}</td>
                      <td className="text-center font-mono font-bold" style={{ color: '#0066ff', padding: '12px 6px' }}>{row.points}</td>
                      <td className="text-center font-mono" style={{
                        color: getNrrColor(row.nrr),
                        padding: '12px 16px 12px 6px',
                      }}>
                        {row.nrr > 0 ? '+' : ''}{row.nrr.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* NRR Formula */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #eee', background: '#fafafa' }}>
              <p className="text-xs" style={{ color: '#888' }}>
                NRR = (Runs Scored / Overs) - (Runs Conceded / Overs). All-out teams count full overs.
              </p>
            </div>
          </div>
        )}

        {/* Knockout Tab */}
        {tab === 'knockout' && hasKnockouts && (
          <div>
            {tournament.phase === 'group' && (
              <div className="mono-card p-5 mb-6 text-center">
                <p className="text-sm" style={{ color: '#888' }}>
                  Knockout stage begins after all group matches are completed
                </p>
                <p className="text-xs mt-2 font-mono" style={{ color: '#bbb' }}>
                  {completedMatches}/{totalMatches} group matches done
                </p>
              </div>
            )}

            {tournament.phase === 'knockout' && tournament.knockoutMatches && (
              <div className="space-y-6">
                {tournament.knockoutConfig.teamsAdvancing === 4 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-normal mb-3" style={{ color: '#888' }}>
                      Semi-finals
                    </h3>
                    <div className="space-y-3">
                      {tournament.knockoutMatches
                        .filter(m => m.round.startsWith('semi'))
                        .map(match => (
                          <KnockoutMatchCard
                            key={match.id}
                            match={match}
                            tournament={tournament}
                            sport={sport || 'cricket'}
                            id={id}
                            navigate={navigate}
                            getTeamName={getTeamName}
                            engine="custom-cricket"
                          />
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs uppercase tracking-widest font-normal mb-3" style={{ color: '#888' }}>
                    Final
                  </h3>
                  {tournament.knockoutMatches
                    .filter(m => m.round === 'final')
                    .map(match => (
                      <KnockoutMatchCard
                        key={match.id}
                        match={match}
                        tournament={tournament}
                        sport={sport || 'cricket'}
                        id={id}
                        navigate={navigate}
                        getTeamName={getTeamName}
                        engine="custom-cricket"
                      />
                    ))}
                </div>

                {tournament.knockoutConfig.thirdPlaceMatch && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-normal mb-3" style={{ color: '#888' }}>
                      3rd Place
                    </h3>
                    {tournament.knockoutMatches
                      .filter(m => m.round === 'third-place')
                      .map(match => (
                        <KnockoutMatchCard
                          key={match.id}
                          match={match}
                          tournament={tournament}
                          sport={sport || 'cricket'}
                          id={id}
                          navigate={navigate}
                          getTeamName={getTeamName}
                          engine="custom-cricket"
                        />
                      ))}
                  </div>
                )}

                {tournamentDone && winner && (
                  <div className="mono-card p-6 text-center" style={{ borderColor: '#0066ff' }}>
                    <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                      Champion
                    </p>
                    <p className="text-xl font-bold" style={{ color: '#111' }}>
                      {winner.name}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Teams */}
        {tab === 'teams' && (
          <div className="flex flex-col gap-3">
            {tournament.teams.map((team) => {
              const row = pointsTable.find(r => r.teamId === team.id);
              return (
                <div key={team.id} className="mono-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-medium" style={{ color: '#111' }}>{team.name}</h3>
                    </div>
                    {row && (
                      <div className="text-right">
                        <span className="text-sm font-mono font-bold" style={{ color: '#0066ff' }}>
                          {row.points} pts
                        </span>
                        <p className="text-xs font-mono" style={{ color: '#888' }}>
                          {row.won}W {row.lost}L
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Show roster if exists */}
                  {team.members && team.members.length > 0 && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: '#eee' }}>
                      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                        Roster
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {team.members.filter(m => m.trim()).map((member) => (
                          <span
                            key={member}
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: '#f5f5f5', color: '#888' }}
                          >
                            {member}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
