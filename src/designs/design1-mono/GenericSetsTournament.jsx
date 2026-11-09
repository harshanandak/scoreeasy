import TournamentMatchSyncStatus from './components/TournamentMatchSyncStatus';
import { isAbandoned, ABANDONED_LABEL } from '../../utils/matchOutcome';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, saveSportTournament } from '../../utils/storage';
import { calculateSetsStandings } from '../../utils/standingsCalculator';
import { getSportById } from '../../models/sportRegistry';
import { isGroupStageComplete, initializeKnockoutStage, updateKnockoutBracket, isTournamentComplete, getTournamentWinner } from '../../utils/knockoutManager';
import KnockoutMatchCard from './KnockoutMatchCard';
import TournamentNotFoundActions from './components/TournamentNotFoundActions';
import TournamentScoreClearActions from './components/TournamentScoreClearActions';
import useTournamentKnockoutDisplay from './hooks/useTournamentKnockoutDisplay';
import { useTournamentScoreClear } from './hooks/useTournamentScoreClear';
import { getKnockoutRoundGroups, getTournamentProgressCounts } from '../../utils/tournamentDisplay';
import { sportIdentity, sportIdentityVars } from '../../lib/sportIdentity';
import BackArrow from './components/BackArrow';
import { KitSection, KitWash } from './kit/KitParts';
import {
  ChampionCard, FixtureCard, FixtureTeam, SetChips, StandingsTable, TourProgress, TourTabs,
  marginTone, signedMargin,
} from './kit/TournamentParts';

// Full names for the hidden header row of the standings table, so each number has a spoken column.
const STANDINGS_HEADERS = {
  P: 'Played', W: 'Won', L: 'Lost', SW: 'Sets won', SL: 'Sets lost', GW: 'Games won', GL: 'Games lost',
  PF: 'Points for', PA: 'Points against', '+/-': 'Margin', Pts: 'Points',
};

export default function GenericSetsTournament() {
  const navigate = useNavigate();
  const { sport, id } = useParams();
  const sportConfig = getSportById(sport);

  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('matches');

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
        const setsToWin = m.format?.setsRules?.setsToWin
          ?? (formatType === 'single' ? 1 : Math.ceil((found.format?.sets || 3) / 2));
        const isComplete = t1SetsWon >= setsToWin || t2SetsWon >= setsToWin;
        if (isComplete && m.status !== 'completed') {
          needsRepair = true;
          return { ...m, status: 'completed', resultType: 'decided', winner: t1SetsWon > t2SetsWon ? m.team1Id : m.team2Id };
        }
        return m;
      });
      setTournament(needsRepair ? { ...found, matches: repairedMatches } : found);
    }
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

  const scoreClear = useTournamentScoreClear({ scoreKind: 'sets', setTournament, teams: tournament?.teams, tournament, tournamentScopeKey: `${sport}:${id}` });
  const knockoutDisplay = useTournamentKnockoutDisplay({ tournament, tab, setTab });

  if (!sportConfig) {
    return (
      <div className="kit-screen">
        <section className="kit-card kit-empty" aria-labelledby="tournament-sport-missing">
          <h2 id="tournament-sport-missing">Sport not found</h2>
        </section>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="kit-screen">
        <div className="kit-tour-lost" style={{ paddingTop: 48 }}>
          <TournamentNotFoundActions navigate={navigate} sport={sport} />
        </div>
      </div>
    );
  }

  const getTeamName = (teamId) => {
    const team = tournament.teams.find(t => t.id === teamId);
    return team?.name || 'Unknown';
  };

  const { completedMatches, totalMatches } = getTournamentProgressCounts(tournament);

  const { hasKnockouts, tabs, tournamentTypeLabel } = knockoutDisplay;
  const knockoutRoundGroups = getKnockoutRoundGroups(tournament.knockoutMatches);
  const tournamentDone = isTournamentComplete(tournament);
  const winner = getTournamentWinner(tournament);

  let statusClass = 'kit-chip is-live';
  let statusText = 'Live';
  if (tournamentDone) {
    statusClass = 'kit-chip is-done';
    statusText = 'Complete';
  } else if (tournament.phase === 'knockout') {
    statusClass = 'kit-chip is-warn';
    statusText = 'Knockout';
  }

  const knockoutCard = (match) => (
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
  );

  const hasKnockoutMatches = Boolean(tournament.knockoutMatches && tournament.knockoutMatches.length > 0);
  const standingsColumns = sportConfig.standingsColumns.map((label) => ({
    label,
    header: STANDINGS_HEADERS[label] || label,
    ...(label === '+/-' ? { tone: marginTone, format: signedMargin } : {}),
  }));
  const standingsRows = standings.map((team) => ({
    key: team.teamId,
    name: team.teamName,
    values: [
      team.played, team.won, team.lost, team.setsWon, team.setsLost,
      team.pointsFor, team.pointsAgainst, team.diff, team.matchPoints,
    ].slice(0, standingsColumns.length),
  }));

  const placeholderCard = (key, label) => (
    <FixtureCard key={key} label={label}>
      <div className="kit-last-teams">
        <FixtureTeam name="TBD" tbd />
        <FixtureTeam name="TBD" tbd />
      </div>
    </FixtureCard>
  );

  return (
    <div className="kit-screen kit-tour" data-screen="tournament" style={sportIdentityVars(sport)}>
      <KitWash from={sportIdentity(sport)?.tint} />

      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(`/${sport}/tournament`)}
        className="kit-back mono-hit-back"
      >
        <BackArrow />
        <span>Tournaments</span>
      </button>

      <header className="kit-tour-head">
        <div className="kit-tour-titlerow">
          <h1 className="kit-tour-title">{tournament.name}</h1>
          <span className={statusClass}>{statusText}</span>
        </div>
        <p className="kit-sub">
          {sportConfig.name} · {tournament.teams.length} teams · {tournamentTypeLabel}
        </p>
      </header>

      <TourProgress
        matches={tournament.matches}
        knockoutMatches={hasKnockouts && hasKnockoutMatches ? tournament.knockoutMatches : []}
        completed={completedMatches}
        total={totalMatches}
      />

      <TourTabs tabs={tabs} tab={tab} onChange={setTab} />

      {/* Matches Tab */}
      {tab === 'matches' && (
        <div className="kit-tour-panel">
          <div className="kit-fx-list">
            {tournament.matches.map((match, idx) => {
              const abandoned = isAbandoned(match);
              const hasScore = abandoned || (match.sets && match.sets.length > 0);
              let t1SetsWon = 0;
              let t2SetsWon = 0;
              if (hasScore) {
                (match.sets || []).forEach(set => {
                  if (!set.completed) return;
                  if (set.score1 > set.score2) t1SetsWon++;
                  else if (set.score2 > set.score1) t2SetsWon++;
                });
              }

              const isTeam1Winner = !abandoned && hasScore && t1SetsWon > t2SetsWon;
              const isTeam2Winner = !abandoned && hasScore && t2SetsWon > t1SetsWon;
              const matchWinner = abandoned ? null : t1SetsWon > t2SetsWon ? 'team1' : 'team2';

              let chips = null;
              if (hasScore && match.status === 'completed') {
                chips = <span className={abandoned ? 'kit-chip is-warn' : 'kit-chip is-done'}>{abandoned ? ABANDONED_LABEL : 'Completed'}</span>;
              } else if (hasScore) {
                chips = <span className="kit-chip is-live">In Progress</span>;
              }

              let actionLabel = 'Enter Score';
              if (match.status === 'in-progress') actionLabel = 'Resume Match';
              else if (hasScore) actionLabel = 'Edit Score';

              return (
                <FixtureCard
                  key={match.id}
                  label={`Match ${idx + 1}`}
                  chips={chips}
                  live={match.status === 'in-progress'}
                  end={hasScore && (
                    <button type="button" onClick={() => scoreClear.requestScoreClear(match)} className="kit-quiet kit-fx-clear">
                      Clear
                    </button>
                  )}
                >
                  <TournamentMatchSyncStatus compact sport={sport} tournament={tournament} match={match} />
                  <TournamentScoreClearActions matchId={match.id} scoreClear={scoreClear} />

                  <div className="kit-last-teams">
                    <FixtureTeam
                      name={getTeamName(match.team1Id)}
                      score={hasScore ? t1SetsWon : undefined}
                      winner={isTeam1Winner}
                      loser={isTeam2Winner}
                    />
                    <FixtureTeam
                      name={getTeamName(match.team2Id)}
                      score={hasScore ? t2SetsWon : undefined}
                      winner={isTeam2Winner}
                      loser={isTeam1Winner}
                    />
                  </div>

                  {hasScore && (
                    <SetChips sets={match.sets || []} abandoned={abandoned} matchWinner={matchWinner} />
                  )}

                  <button
                    type="button"
                    onClick={() => navigate(`/${sport}/tournament/${id}/match/${match.id}/score`)}
                    className="se-ctl"
                  >
                    {actionLabel}
                  </button>
                </FixtureCard>
              );
            })}
          </div>

          {/* Knockout matches in schedule */}
          {hasKnockouts && hasKnockoutMatches && (
            <>
              <KitSection title="Knockout stage" />
              <div className="kit-fx-list">
                {tournament.knockoutMatches.map(knockoutCard)}
              </div>
            </>
          )}

          {/* Show placeholder knockout schedule before group stage completes */}
          {hasKnockouts && !hasKnockoutMatches && (
            <>
              <KitSection title="Knockout stage" />
              <div className="kit-fx-list">
                {tournament.knockoutConfig.teamsAdvancing === 4 && (
                  <>
                    {placeholderCard('semi-1', 'Semi-final 1')}
                    {placeholderCard('semi-2', 'Semi-final 2')}
                  </>
                )}
                {placeholderCard('final', 'Final')}
                {tournament.knockoutConfig.thirdPlaceMatch && placeholderCard('third', '3rd Place')}
              </div>
            </>
          )}
        </div>
      )}

      {/* Standings Tab */}
      {tab === 'standings' && (
        <div className="kit-tour-panel">
          <StandingsTable label={`${tournament.name} standings`} columns={standingsColumns} rows={standingsRows} />
        </div>
      )}

      {/* Knockout Tab */}
      {tab === 'knockout' && hasKnockouts && (
        <div className="kit-tour-panel">
          {tournament.phase === 'group' && (
            <section className="kit-card kit-empty kit-tour-note" aria-label="Knockout stage">
              <p>Knockout stage begins after all group matches are completed</p>
              <p className="kit-fx-wait">{completedMatches}/{totalMatches} group matches done</p>
            </section>
          )}

          {tournament.phase === 'knockout' && tournament.knockoutMatches && (
            <>
              {knockoutRoundGroups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <KitSection title={group.label} />
                  <div className="kit-fx-list">{group.matches.map(knockoutCard)}</div>
                </section>
              ))}

              <section aria-label="Final">
                <KitSection title="Final" />
                <div className="kit-fx-list">
                  {tournament.knockoutMatches.filter(m => m.round === 'final').map(knockoutCard)}
                </div>
              </section>

              {tournament.knockoutConfig.thirdPlaceMatch && (
                <section aria-label="3rd Place">
                  <KitSection title="3rd Place" />
                  <div className="kit-fx-list">
                    {tournament.knockoutMatches.filter(m => m.round === 'third-place').map(knockoutCard)}
                  </div>
                </section>
              )}

              {tournamentDone && winner && <ChampionCard name={winner.name} />}
            </>
          )}
        </div>
      )}

      {/* Teams Tab */}
      {tab === 'teams' && (
        <div className="kit-tour-panel">
          <div className="kit-list kit-tour-list">
            {tournament.teams.map((team, idx) => (
              <div key={team.id} className="kit-row">
                <span className="kit-step-num" aria-hidden="true">{idx + 1}</span>
                <span className="kit-row-text">
                  <span className="kit-row-title">{team.name}</span>
                  {team.members && team.members.length > 0 && (
                    <ul className="kit-roster" aria-label={`${team.name} roster`}>
                      {team.members.filter(m => m.trim()).map((member, mIdx) => (
                        <li key={mIdx}>{member}</li>
                      ))}
                    </ul>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
