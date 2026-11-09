import TournamentMatchSyncStatus from './components/TournamentMatchSyncStatus';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, saveSportTournament } from '../../utils/storage';
import { calculateCricketPointsTable } from '../../utils/cricketCalculations';
import { getSportById } from '../../models/sportRegistry';
import { isGroupStageComplete, initializeKnockoutStage, updateKnockoutBracket, isTournamentComplete, getTournamentWinner } from '../../utils/knockoutManager';
import KnockoutMatchCard from './KnockoutMatchCard';
import TournamentNotFoundActions from './components/TournamentNotFoundActions';
import TournamentScoreClearActions from './components/TournamentScoreClearActions';
import { useTournamentScoreClear } from './hooks/useTournamentScoreClear';
import useTournamentKnockoutDisplay from './hooks/useTournamentKnockoutDisplay';
import { getKnockoutRoundGroups, getTournamentProgressCounts } from '../../utils/tournamentDisplay';
import { sportIdentity, sportIdentityVars } from '../../lib/sportIdentity';
import BackArrow from './components/BackArrow';
import { KitSection, KitWash } from './kit/KitParts';
import {
  ChampionCard, FixtureCard, FixtureResult, FixtureTeam, StandingsTable, TourProgress, TourTabs, marginTone,
} from './kit/TournamentParts';
import { cricketFixtureView, getFormatLabel } from './kit/cricketFixture';

// Points table columns. Points is last: the table shows the last column beside the team name, and
// every number has a spoken column name in the hidden header row.
const STANDINGS_COLUMNS = [
  { label: 'P', header: 'Played', value: (row) => row.played },
  { label: 'W', header: 'Won', value: (row) => row.won },
  { label: 'L', header: 'Lost', value: (row) => row.lost },
  { label: 'T', header: 'Tied', value: (row) => row.tied },
  // Net run rate keeps its sign and three decimals; the sign carries the meaning, colour only reinforces it.
  { label: 'NRR', header: 'Net run rate', value: (row) => row.nrr, tone: marginTone, format: (nrr) => `${nrr > 0 ? '+' : ''}${nrr.toFixed(3)}` },
  { label: 'Pts', header: 'Points', value: (row) => row.points },
];

export default function MonoCricketTournament() {
  const navigate = useNavigate();
  const { sport, id } = useParams();
  const sportId = sport || 'cricket';
  const sportConfig = getSportById(sportId);
  const storageKey = sportConfig?.storageKey || 'se_cricket';
  const [tournament, setTournament] = useState(null);
  const [tab, setTab] = useState('matches');

  useEffect(() => {
    const tournaments = loadSportTournaments(storageKey);
    const found = tournaments.find(t => t.id === Number(id) || t.id === id);
    if (found) setTournament(found);
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

  const scoreClear = useTournamentScoreClear({
    scoreKind: 'cricket', setTournament, teams: tournament?.teams, tournament,
    tournamentScopeKey: `${sportId}:${id}`,
  });
  const knockoutDisplay = useTournamentKnockoutDisplay({
    tournament,
    tab,
    setTab,
    labelOptions: { type: tournament?.type, totalMatches: tournament?.matches?.length ?? 0 },
  });

  if (!tournament) {
    return (
      <div className="kit-screen">
        <div className="kit-tour-lost" style={{ paddingTop: 48 }}>
          <TournamentNotFoundActions navigate={navigate} sport={sportId} />
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
  const metaLabel = [
    getFormatLabel(tournament.format),
    `${tournament.teams.length} teams`,
    tournamentTypeLabel,
  ].join(' · ');

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
      sport={sportId}
      id={id}
      navigate={navigate}
      getTeamName={getTeamName}
      engine="custom-cricket"
      scoreClear={scoreClear}
    />
  );

  const hasKnockoutMatches = Boolean(tournament.knockoutMatches && tournament.knockoutMatches.length > 0);
  const standingsRows = pointsTable.map((row) => ({
    key: row.teamId,
    name: row.teamName,
    values: STANDINGS_COLUMNS.map((column) => column.value(row)),
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
    <div className="kit-screen kit-tour" data-screen="tournament" style={sportIdentityVars(sportId)}>
      <KitWash from={sportIdentity(sportId)?.tint} />

      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(`/${sportId}/tournament`)}
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
        <p className="kit-sub">{metaLabel}</p>
      </header>

      <TourProgress
        matches={tournament.matches}
        knockoutMatches={hasKnockouts && hasKnockoutMatches ? tournament.knockoutMatches : []}
        completed={completedMatches}
        total={totalMatches}
      />

      <TourTabs tabs={tabs} tab={tab} onChange={setTab} />

      {/* Matches */}
      {tab === 'matches' && (
        <div className="kit-tour-panel">
          <div className="kit-fx-list">
            {tournament.matches.map((match, idx) => {
              const view = cricketFixtureView(match, tournament.format);
              const formatLabel = getFormatLabel(match.format || tournament.format);

              let chips = null;
              if (view.live) {
                chips = <span className="kit-chip is-live">In Progress</span>;
              } else if (view.complete) {
                chips = <span className={view.abandoned ? 'kit-chip is-warn' : 'kit-chip is-done'}>{view.abandoned ? 'No result' : 'Completed'}</span>;
              }

              let actionLabel = 'Enter Score';
              if (view.live) actionLabel = 'Resume Match';
              else if (view.complete) actionLabel = 'Edit Score';

              return (
                <FixtureCard
                  key={match.id}
                  label={formatLabel ? `Match ${idx + 1} · ${formatLabel}` : `Match ${idx + 1}`}
                  chips={chips}
                  live={view.live}
                  end={view.complete && (
                    <button type="button" onClick={() => scoreClear.requestScoreClear(match)} className="kit-quiet kit-fx-clear">
                      Clear
                    </button>
                  )}
                >
                  <TournamentMatchSyncStatus compact sport={sportId} tournament={tournament} match={match} />
                  <TournamentScoreClearActions matchId={match.id} scoreClear={scoreClear} showUndo={false} />

                  <div className="kit-last-teams">
                    <FixtureTeam
                      name={getTeamName(match.team1Id)}
                      score={view.scores[0]}
                      detail={view.details[0]}
                      wide={view.wide}
                      winner={view.winner === 'team1'}
                      loser={view.winner === 'team2'}
                    />
                    <FixtureTeam
                      name={getTeamName(match.team2Id)}
                      score={view.scores[1]}
                      detail={view.details[1]}
                      wide={view.wide}
                      winner={view.winner === 'team2'}
                      loser={view.winner === 'team1'}
                    />
                  </div>

                  {view.result && <FixtureResult tone={view.abandoned ? 'warn' : undefined}>{view.result}</FixtureResult>}

                  <button
                    type="button"
                    onClick={() => navigate(`/${sportId}/tournament/${id}/match/${match.id}/score`)}
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

      {/* Standings */}
      {tab === 'standings' && (
        <div className="kit-tour-panel">
          <StandingsTable label={`${tournament.name} points table`} columns={STANDINGS_COLUMNS} rows={standingsRows} />
          <p className="kit-fx-wait kit-nrr-note">
            NRR = (runs scored / overs) - (runs conceded / overs). All-out teams count full overs.
          </p>
        </div>
      )}

      {/* Knockout */}
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

      {/* Teams */}
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
      {scoreClear.clearedScore && (
        <div className="kit-toast">
          <span role="status" aria-live="polite">Cleared the saved score for {scoreClear.clearedScore.label}.</span>
          <button type="button" onClick={scoreClear.undoScoreClear}>Undo clear score</button>
        </div>
      )}
    </div>
  );
}
