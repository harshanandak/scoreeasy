import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, saveSportTournament } from '../../utils/storage';
import { calculateSetsStandings } from '../../utils/standingsCalculator';
import { getSportById } from '../../models/sportRegistry';
import { isGroupStageComplete, initializeKnockoutStage, updateKnockoutBracket, isTournamentComplete, getTournamentWinner } from '../../utils/knockoutManager';
import KnockoutMatchCard from './KnockoutMatchCard';
import ConfirmActionPanel from './components/ConfirmActionPanel';
import TournamentNotFoundActions from './components/TournamentNotFoundActions';
import { useTournamentScoreClear } from './hooks/useTournamentScoreClear';

export default function GenericSetsTournament() {
  const navigate = useNavigate();
  const { sport, id } = useParams();
  const sportConfig = getSportById(sport);

  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('matches');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sportConfig) return;
    const tournaments = loadSportTournaments(sportConfig.storageKey);
    const found = tournaments.find(t => t.id === Number(id) || t.id === id);
    if (found) {
      // Repair matches with completed sets but wrong status (fixes single-set format bug)
      const formatType = found.format?.type || 'best-of';
      let needsRepair = false;
      const repairedMatches = found.matches.map(m => {
        if (!m.sets || m.sets.length === 0 || m.status === 'completed') return m;
        const completedSets = m.sets.filter(s => s.completed);
        if (completedSets.length === 0) return m;
        const t1SetsWon = completedSets.filter(s => s.score1 > s.score2).length;
        const t2SetsWon = completedSets.filter(s => s.score2 > s.score1).length;
        let isComplete;
        if (formatType === 'single') {
          isComplete = completedSets.length > 0;
        } else {
          const setsToWin = Math.ceil((found.format?.sets || 3) / 2);
          isComplete = t1SetsWon >= setsToWin || t2SetsWon >= setsToWin;
        }
        if (isComplete && m.status !== 'completed') {
          needsRepair = true;
          return { ...m, status: 'completed', winner: t1SetsWon > t2SetsWon ? m.team1Id : m.team2Id };
        }
        return m;
      });
      setTournament(needsRepair ? { ...found, matches: repairedMatches } : found);
    }
    requestAnimationFrame(() => setVisible(true));
  }, [id, sportConfig]);

  useEffect(() => {
    if (tournament && sportConfig) {
      saveSportTournament(sportConfig.storageKey, tournament);
    }
  }, [tournament, sportConfig]);

  // Calculate standings (must be before early returns to satisfy rules of hooks)
  const standings = useMemo(
    () => {
      if (!tournament || !sportConfig) return [];
      return calculateSetsStandings(tournament.teams, tournament.matches, sportConfig.config);
    },
    [tournament, sportConfig]
  );

  // Knockout phase transition: when all group matches complete, generate knockout matches
  useEffect(() => {
    if (!tournament || !tournament.knockoutConfig) return;
    if (tournament.phase !== 'group') return;
    if (!isGroupStageComplete(tournament.matches)) return;
    if (tournament.knockoutMatches && tournament.knockoutMatches.length > 0) return;

    const updated = initializeKnockoutStage(tournament, standings);
    if (updated !== tournament) {
      // Initialize knockout matches with sets-engine fields
      const initializedKO = updated.knockoutMatches.map(m => ({
        ...m,
        sets: [],
      }));
      setTournament({ ...updated, knockoutMatches: initializedKO });
    }
  }, [tournament, standings]);

  // Bracket seeding: after semi-finals complete, seed final and 3rd-place
  useEffect(() => {
    if (!tournament?.knockoutMatches?.length) return;
    const updated = updateKnockoutBracket(tournament.knockoutMatches);
    if (updated !== tournament.knockoutMatches) {
      setTournament(prev => ({ ...prev, knockoutMatches: updated }));
    }
  }, [tournament?.knockoutMatches]);

  const getTeamName = (teamId) => {
    const team = tournament?.teams?.find(t => t.id === teamId);
    return team?.name || 'Unknown';
  };

  const {
    cancelScoreClear,
    clearedScore,
    confirmScoreClear,
    pendingScoreClear,
    requestScoreClear,
    undoScoreClear,
  } = useTournamentScoreClear({
    clearMatchScore: (match) => ({ ...match, sets: [], status: 'pending', winner: null }),
    getTeamName,
    setTournament,
    tournament,
    tournamentScopeKey: `${sport}:${id}`,
  });

  if (!sportConfig) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <p style={{ color: '#888' }}>Sport not found</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <TournamentNotFoundActions navigate={navigate} sport={sport} />
      </div>
    );
  }

  const completedMatches = tournament.matches.filter(m =>
    m.sets && m.sets.length > 0 && m.status === 'completed'
  ).length;
  const totalMatches = tournament.matches.length;

  const hasKnockouts = tournament.winnerMode === 'knockouts';
  const tournamentDone = isTournamentComplete(tournament);
  const winner = getTournamentWinner(tournament);

  let badgeClass = 'mono-badge-live';
  let badgeText = 'Live';
  if (tournamentDone) {
    badgeClass = 'mono-badge-final';
    badgeText = 'Complete';
  } else if (tournament.phase === 'knockout') {
    badgeClass = 'mono-badge-paused';
    badgeText = 'Knockout';
  }

  const tabs = ['matches', 'standings'];
  if (hasKnockouts) tabs.push('knockout');
  tabs.push('teams');

  const deleteKnockoutScore = (matchId) => {
    const updatedKO = tournament.knockoutMatches.map(m => {
      if (m.id === matchId) {
        return { ...m, sets: [], status: 'pending', winner: null };
      }
      return m;
    });
    setTournament({ ...tournament, knockoutMatches: updatedKO });
  };

  return (
    <div className={`min-h-screen mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Back */}
        <button
          onClick={() => navigate(`/${sport}/tournament`)}
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
          {sportConfig.name} · {tournament.teams.length} teams · Round Robin{hasKnockouts ? ' + Knockouts' : ''}
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
              key={t}
              onClick={() => setTab(t)}
              className="bg-transparent border-none cursor-pointer font-swiss px-4 py-3 text-sm"
              style={{
                color: tab === t ? '#0066ff' : '#888',
                borderBottom: tab === t ? '2px solid #0066ff' : '2px solid transparent',
                fontWeight: tab === t ? 500 : 400,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Matches Tab */}
        {tab === 'matches' && (
          <div className="space-y-4">
            {tournament.matches.map((match, idx) => {
              const hasScore = match.sets && match.sets.length > 0;
              let t1SetsWon = 0;
              let t2SetsWon = 0;
              if (hasScore) {
                match.sets.forEach(set => {
                  if (set.score1 > set.score2) t1SetsWon++;
                  else if (set.score2 > set.score1) t2SetsWon++;
                });
              }

              // Determine winner and colors
              const isTeam1Winner = hasScore && t1SetsWon > t2SetsWon;
              const isTeam2Winner = hasScore && t2SetsWon > t1SetsWon;
              const team1Color = isTeam1Winner || !hasScore ? '#111' : '#888';
              const team2Color = isTeam2Winner || !hasScore ? '#111' : '#888';

              return (
                <div key={match.id} className="mono-card p-5">
                  {/* Header with match number and status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#aaa' }}>
                      Match {idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {hasScore && match.status === 'completed' && (
                        <span className="mono-badge mono-badge-final">
                          Completed
                        </span>
                      )}
                      {hasScore && match.status !== 'completed' && (
                        <span className="mono-badge mono-badge-live">
                          In Progress
                        </span>
                      )}
                      {hasScore && (
                        <button
                          onClick={() => requestScoreClear(match)}
                          className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                          style={{ color: '#dc2626' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {pendingScoreClear?.matchId === match.id && (
                    <ConfirmActionPanel
                      message={`Clear the saved score for ${pendingScoreClear.label}?`}
                      confirmLabel="Clear score"
                      confirmAriaLabel={`Confirm clear score for ${pendingScoreClear.label}`}
                      onConfirm={confirmScoreClear}
                      onCancel={cancelScoreClear}
                    />
                  )}

                  {clearedScore?.matchId === match.id && (
                    <button
                      type="button"
                      className="mono-btn mb-4 w-full"
                      style={{ minHeight: 44, padding: '10px' }}
                      onClick={undoScoreClear}
                    >
                      Undo clear score
                    </button>
                  )}

                  {/* Teams and scores */}
                  <div className="grid grid-cols-3 gap-6 items-center mb-5">
                    <div className="text-right">
                      <div className="text-base font-medium mb-1" style={{ color: team1Color }}>
                        {getTeamName(match.team1Id)}
                      </div>
                      {hasScore && (
                        <div className="text-3xl font-mono font-bold" style={{ color: team1Color }}>
                          {t1SetsWon}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium" style={{ color: '#bbb' }}>vs</div>
                    </div>
                    <div className="text-left">
                      <div className="text-base font-medium mb-1" style={{ color: team2Color }}>
                        {getTeamName(match.team2Id)}
                      </div>
                      {hasScore && (
                        <div className="text-3xl font-mono font-bold" style={{ color: team2Color }}>
                          {t2SetsWon}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Set scores */}
                  {hasScore && (
                    <div className="flex justify-center gap-2 flex-wrap mb-5 py-3" style={{ borderTop: '1px solid #f5f5f5', borderBottom: '1px solid #f5f5f5' }}>
                      {match.sets.map((set, i) => {
                        const setWinner = set.score1 > set.score2 ? 'team1' : 'team2';
                        const matchWinner = t1SetsWon > t2SetsWon ? 'team1' : 'team2';
                        const isMatchWinnerSet = setWinner === matchWinner;
                        return (
                          <span
                            key={`set-${set.score1}-${set.score2}-${i}`}
                            className="px-3 py-1.5 rounded font-mono"
                            style={{
                              background: isMatchWinnerSet ? '#dcfce7' : '#fee2e2',
                              color: '#111',
                              fontSize: '0.875rem'
                            }}
                          >
                            <span style={{ fontWeight: set.score1 > set.score2 ? '600' : 'normal' }}>{set.score1}</span>
                            <span style={{ color: '#ccc', margin: '0 4px', fontWeight: '300' }}>-</span>
                            <span style={{ fontWeight: set.score2 > set.score1 ? '600' : 'normal' }}>{set.score2}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Action button */}
                  <button
                    onClick={() => navigate(`/${sport}/tournament/${id}/match/${match.id}/score`)}
                    className={match.status === 'in-progress' ? 'mono-btn-primary w-full' : 'mono-btn w-full'}
                  >
                    {match.status === 'in-progress'
                      ? '▶ Resume Match'
                      : hasScore ? 'Edit Score' : 'Enter Score'}
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
                    sport={sport}
                    id={id}
                    navigate={navigate}
                    getTeamName={getTeamName}
                    engine="sets"
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

        {/* Standings Tab */}
        {tab === 'standings' && (
          <div className="mono-card p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs" style={{ color: '#888' }}>
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Team</th>
                  {sportConfig.standingsColumns.map(col => (
                    <th key={col} className="text-center py-2">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((team, idx) => (
                  <tr key={team.teamId} className="border-t" style={{ borderColor: '#eeeeee' }}>
                    <td className="py-3 font-mono text-xs" style={{ color: '#888' }}>{idx + 1}</td>
                    <td className="py-3 font-medium">{team.teamName}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.played}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.won}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.lost}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.setsWon}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.setsLost}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.pointsFor}</td>
                    <td className="py-3 text-center font-mono text-sm">{team.pointsAgainst}</td>
                    <td className="py-3 text-center font-mono text-sm font-bold"
                        style={{ color: team.diff >= 0 ? '#059669' : '#dc2626' }}>
                      {team.diff >= 0 ? '+' : ''}{team.diff}
                    </td>
                    <td className="py-3 text-center font-mono text-sm font-bold">{team.matchPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                {/* Semi-finals */}
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
                            sport={sport}
                            id={id}
                            navigate={navigate}
                            getTeamName={getTeamName}
                            engine="sets"
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* Final */}
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
                        sport={sport}
                        id={id}
                        navigate={navigate}
                        getTeamName={getTeamName}
                        engine="sets"
                      />
                    ))}
                </div>

                {/* 3rd Place */}
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
                          sport={sport}
                          id={id}
                          navigate={navigate}
                          getTeamName={getTeamName}
                          engine="sets"
                        />
                      ))}
                  </div>
                )}

                {/* Winner Banner */}
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

        {/* Teams Tab */}
        {tab === 'teams' && (
          <div className="space-y-3">
            {tournament.teams.map((team, idx) => (
              <div key={team.id} className="mono-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                       style={{ background: '#f5f5f5' }}>
                    {idx + 1}
                  </div>
                  <div className="font-medium">{team.name}</div>
                </div>

                {/* Show roster if exists */}
                {team.members && team.members.length > 0 && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: '#eee' }}>
                    <div className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                      Roster
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {team.members.filter(m => m.trim()).map((member, mIdx) => (
                        <span
                          key={mIdx}
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
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
