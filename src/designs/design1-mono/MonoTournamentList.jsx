import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, deleteSportTournament, saveData } from '../../utils/storage';
import { MATCH_STORAGE_CHANGED } from '../../utils/accountStorage';
import { getSportById } from '../../models/sportRegistry';
import { getCricketFormat } from '../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../utils/formatMigration';
import { isTournamentMatchCompleted } from '../../utils/tournamentSync';
import BackArrow from './components/BackArrow';
import ConfirmActionPanel from './components/ConfirmActionPanel';
import { sportIdentity, sportIdentityVars } from '../../lib/sportIdentity';
import { EmptyHistoryArt, GoArrow, KitWash, SportBadge } from './kit/KitParts';
import './kit/tournament.css';

function getTeamName(tournament, teamId) {
  return tournament.teams?.find((team) => team.id === teamId)?.name || 'Team';
}

function getMatchTeamName(tournament, teamRef) {
  if (teamRef === null || teamRef === undefined) return 'Team';
  if (typeof teamRef === 'object') {
    if (teamRef.name) return teamRef.name;
    if (teamRef.id) return getTeamName(tournament, teamRef.id);
    return 'Team';
  }
  return tournament.teams?.find((team) => team.id === teamRef)?.name || String(teamRef);
}

function hasMatchTeams(match) {
  const team1 = match.team1Id ?? match.team1;
  const team2 = match.team2Id ?? match.team2;
  return team1 !== null && team1 !== undefined && team2 !== null && team2 !== undefined;
}

function getOpenMatches(tournament, sportConfig) {
  const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
  return allMatches.filter((match) => !isTournamentMatchCompleted(match, sportConfig.engine, match.format || tournament.format));
}

function getNextScorableMatch(tournament, sportConfig) {
  return getOpenMatches(tournament, sportConfig).find(hasMatchTeams);
}

export default function MonoTournamentList() {
  const navigate = useNavigate();
  const { sport } = useParams();
  const sportConfig = getSportById(sport);
  const [tournaments, setTournaments] = useState([]);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletedTournament, setDeletedTournament] = useState(null);

  useEffect(() => {
    if (!sportConfig) return;
    const reload = () => {
      const loaded = loadSportTournaments(sportConfig.storageKey);
      setTournaments(loaded.filter(t => t.mode === 'tournament' || !t.mode));
      setDeletedTournament(null);
    };
    reload();
    window.addEventListener(MATCH_STORAGE_CHANGED, reload);
    return () => window.removeEventListener(MATCH_STORAGE_CHANGED, reload);
  }, [sport, sportConfig]);

  const openTournament = (id) => {
    navigate(`/${sport}/tournament/${id}`);
  };

  const scoreTournamentMatch = (tournamentId, matchId) => {
    navigate(`/${sport}/tournament/${tournamentId}/match/${matchId}/score`);
  };

  const deleteTournament = (id) => {
    const snapshot = loadSportTournaments(sportConfig.storageKey);
    const tournament = snapshot.find(t => t.id === id);
    deleteSportTournament(sportConfig.storageKey, id);
    setTournaments(prev => prev.filter(t => t.id !== id));
    setPendingDeleteId(null);
    if (tournament) {
      setDeletedTournament({ tournament, snapshot, storageKey: sportConfig.storageKey });
    }
  };

  const undoDeleteTournament = () => {
    if (!deletedTournament) return;
    if (deletedTournament.storageKey !== sportConfig.storageKey) return;
    saveData(deletedTournament.storageKey, deletedTournament.snapshot);
    setTournaments(deletedTournament.snapshot.filter(t => t.mode === 'tournament' || !t.mode));
    setDeletedTournament(null);
  };

  if (!sportConfig) {
    return (
      <div className="kit-screen">
        <section className="kit-card kit-empty" aria-labelledby="tournament-sport-missing">
          <h2 id="tournament-sport-missing">Sport not found</h2>
        </section>
      </div>
    );
  }

  const sportLabel = sportConfig.name;
  const createTournament = () => navigate(`/${sport}/tournament/new`);

  return (
    <div className="kit-screen kit-tour" data-screen="tournaments" style={sportIdentityVars(sport)}>
      <KitWash from={sportIdentity(sport)?.tint} />

      {/* Header */}
      <nav aria-label="Breadcrumb">
        <button
          onClick={() => navigate('/app')}
          className="kit-back mono-hit"
          aria-label="Go back to home"
        >
          <BackArrow /> Home
        </button>
      </nav>

      <div className="kit-tour-titlerow">
        <SportBadge sportId={sport} />
        <h1 className="kit-tour-title">{sportLabel} Tournaments</h1>
      </div>

      {tournaments.length > 0 && (
        <div className="kit-btnstack" style={{ marginTop: 16 }}>
          <button type="button" onClick={createTournament} className="se-go">
            New {sportLabel} Tournament <GoArrow />
          </button>
        </div>
      )}

      {/* List */}
      {tournaments.length === 0 ? (
        <section className="kit-card kit-empty kit-tour-empty" aria-labelledby="tournaments-empty-title" style={{ marginTop: 18 }}>
          <EmptyHistoryArt />
          <h2 id="tournaments-empty-title">No tournaments yet</h2>
          <p>Build a match list, track standings, and resume the next game from one place.</p>
          <ol className="kit-list kit-steps kit-tour-steps-list">
            {['Name teams', 'Schedule is generated', 'Continue from this list'].map((label, index) => (
              <li key={label} className="kit-row">
                <span className="kit-step-num" aria-hidden="true">{index + 1}</span>
                <span className="kit-row-text"><span className="kit-row-title">{label}</span></span>
              </li>
            ))}
          </ol>
          <div className="kit-btnstack">
            <button type="button" onClick={createTournament} className="se-go">
              Create {sportLabel} Tournament <GoArrow />
            </button>
            <button
              type="button"
              onClick={() => navigate(`/${sport}/quick`, { state: { newMatch: true } })}
              className="se-ctl"
            >
              Score one quick match
            </button>
          </div>
        </section>
      ) : (
        <div className="kit-tcards" style={{ marginTop: 18 }}>
          {tournaments.map(t => {
            const allMatches = [...(t.matches || []), ...(t.knockoutMatches || [])];
            const matchCount = allMatches.length;
            const completedCount = allMatches.filter((m) =>
              isTournamentMatchCompleted(m, sportConfig.engine, m.format || t.format)
            ).length;
            const progress = matchCount > 0 ? Math.round((completedCount / matchCount) * 100) : 0;
            const openMatches = getOpenMatches(t, sportConfig);
            const nextMatch = getNextScorableMatch(t, sportConfig);
            let nextMatchLabel = 'All matches complete';
            if (nextMatch) {
              nextMatchLabel = `${getMatchTeamName(t, nextMatch.team1Id ?? nextMatch.team1)} vs ${getMatchTeamName(t, nextMatch.team2Id ?? nextMatch.team2)}`;
            } else if (openMatches.length > 0) {
              nextMatchLabel = 'Bracket waiting for teams';
            }
            let continueLabel = 'View results';
            if (nextMatch) {
              continueLabel = 'Score next match';
            } else if (openMatches.length > 0) {
              continueLabel = 'View bracket';
            }
            const isWaitingForTeams = !nextMatch && openMatches.length > 0;
            let nextState = 'is-done';
            if (nextMatch) nextState = '';
            else if (isWaitingForTeams) nextState = 'is-waiting';

            return (
              <article key={t.id} className="kit-card kit-tcard">
                <button
                  type="button"
                  className="kit-tcard-open"
                  onClick={() => openTournament(t.id)}
                  aria-label={`Open ${t.name} tournament, ${completedCount} of ${matchCount} matches completed`}
                >
                  <span className="kit-tcard-head">
                    <span className="kit-tcard-name">{t.name}</span>
                    <span className="kit-tcard-tags">
                      <span className="kit-chip is-live" role="status" aria-label={`${completedCount} of ${matchCount} matches completed`}>
                        {completedCount}/{matchCount}
                      </span>
                      {t.teams?.length === 2 && <span className="kit-chip">Head-to-head</span>}
                    </span>
                  </span>
                  <span className="kit-tcard-meta">
                    {t.teams?.length || 0} teams &middot;{' '}
                    {t.teams?.length === 2 && `${matchCount}-match series`}
                    {t.teams?.length >= 3 && `${matchCount} matches · Round-robin`}
                    {(() => {
                      // Cricket: show format preset name instead of raw overs
                      if (sportConfig.engine === 'custom-cricket' && t.format) {
                        const migrated = migrateCricketFormat(t.format);
                        const preset = getCricketFormat(migrated.preset);
                        if (preset) return ` · ${preset.name}`;
                        if (migrated.overs) return ` · ${migrated.overs} overs`;
                        return ' · Custom';
                      }
                      // Non-cricket: existing logic
                      if (t.format?.overs) return ` · ${t.format.overs} overs`;
                      if (t.format?.sets) return ` · Best of ${t.format.sets}`;
                      return '';
                    })()}
                  </span>
                  <span className="kit-brow-track" aria-hidden="true" style={{ display: 'block', '--kit-p': `${progress}%` }}><i /></span>
                  <span className={`kit-tcard-next ${nextState}`}>
                    {nextMatch ? `Next: ${nextMatchLabel}` : nextMatchLabel}
                  </span>
                </button>
                {pendingDeleteId === t.id ? (
                  <div className="kit-tcard-confirm">
                    <ConfirmActionPanel
                      message="Delete this tournament and its saved matches?"
                      confirmLabel="Delete"
                      confirmAriaLabel={`Confirm delete ${t.name} tournament`}
                      onConfirm={(e) => { e.stopPropagation(); deleteTournament(t.id); }}
                      onCancel={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}
                    />
                  </div>
                ) : (
                  <div className="kit-tcard-actions">
                    <button
                      type="button"
                      onClick={() => {
                        if (nextMatch) {
                          scoreTournamentMatch(t.id, nextMatch.id);
                          return;
                        }
                        openTournament(t.id);
                      }}
                      className="se-ctl"
                      aria-label={`${continueLabel} - ${t.name}`}
                    >
                      {continueLabel}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingDeleteId(t.id); }}
                      className="kit-quiet"
                      aria-label={`Delete ${t.name} tournament`}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {deletedTournament && (
        <div className="kit-toast">
          <span role="status" aria-live="polite">Deleted {deletedTournament.tournament.name}.</span>
          <button type="button" onClick={undoDeleteTournament}>Undo delete</button>
        </div>
      )}
    </div>
  );
}
