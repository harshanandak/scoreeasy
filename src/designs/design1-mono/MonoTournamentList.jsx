import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, deleteSportTournament, saveData } from '../../utils/storage';
import { getSportById } from '../../models/sportRegistry';
import { getCricketFormat } from '../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../utils/formatMigration';
import { isTournamentMatchCompleted } from '../../utils/tournamentSync';
import BackArrow from './components/BackArrow';
import ConfirmActionPanel from './components/ConfirmActionPanel';

function getTeamName(tournament, teamId) {
  return tournament.teams?.find((team) => team.id === teamId)?.name || 'Team';
}

function getNextMatch(tournament, sportConfig) {
  const allMatches = [...(tournament.matches || []), ...(tournament.knockoutMatches || [])];
  return allMatches.find((match) => !isTournamentMatchCompleted(match, sportConfig.engine, match.format || tournament.format));
}

export default function MonoTournamentList() {
  const navigate = useNavigate();
  const { sport } = useParams();
  const sportConfig = getSportById(sport);
  const [tournaments, setTournaments] = useState([]);
  const [visible, setVisible] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletedTournament, setDeletedTournament] = useState(null);

  useEffect(() => {
    if (!sportConfig) return;
    const loaded = loadSportTournaments(sportConfig.storageKey);
    setTournaments(loaded.filter(t => t.mode === 'tournament' || !t.mode));
    setDeletedTournament(null);
    requestAnimationFrame(() => setVisible(true));
  }, [sport, sportConfig]);

  const openTournament = (id) => {
    navigate(`/${sport}/tournament/${id}`);
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
      <div className="min-h-screen px-6 py-10 flex items-center justify-center">
        <p style={{ color: '#888' }}>Sport not found</p>
      </div>
    );
  }

  const sportLabel = sportConfig.name;
  const sportIcon = sportConfig.icon;

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <nav className="flex items-center gap-2 mb-2" aria-label="Breadcrumb">
          <button
            onClick={() => navigate('/')}
            className="text-sm bg-transparent border-none cursor-pointer font-swiss flex items-center gap-1"
            style={{ color: '#888' }}
            aria-label="Go back to home"
          >
            <BackArrow /> Home
          </button>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
            <span aria-hidden="true">{sportIcon} </span>{sportLabel} Tournaments
          </h1>
        </div>

        {/* Create button */}
        <button
          onClick={() => navigate(`/${sport}/tournament/new`)}
          className="mono-btn-primary w-full mb-8"
          style={{ padding: '12px', fontSize: '0.9375rem' }}
        >
          New {sportLabel} Tournament
        </button>

        {deletedTournament && (
          <div className="mono-card mb-4" style={{ padding: '12px 14px', borderColor: '#0066ff' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#111' }}>
              Deleted {deletedTournament.tournament.name}.
            </p>
            <button
              type="button"
              className="mono-btn w-full"
              style={{ minHeight: 44, padding: '10px' }}
              onClick={undoDeleteTournament}
            >
              Undo delete
            </button>
          </div>
        )}

        {/* List */}
        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: '34vh' }}>
            <span className="text-4xl mb-4">{sportIcon}</span>
            <h2 className="text-base font-semibold mb-2" style={{ color: '#111' }}>No tournaments yet</h2>
            <p className="text-sm mb-5" style={{ color: '#666', maxWidth: 320 }}>
              Build a match list, track standings, and resume the next game from one place.
            </p>
            <div className="mono-card w-full mb-4 text-left" style={{ padding: '14px 16px', background: '#f8fafc' }}>
              {['Name teams', 'Schedule is generated', 'Continue from this list'].map((label, index) => (
                <div key={label} className="flex items-center gap-3 mb-2 last:mb-0">
                  <span
                    className="font-mono text-xs"
                    style={{
                      width: 24,
                      height: 24,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: index === 0 ? '#0066ff' : '#fff',
                      color: index === 0 ? '#fff' : '#666',
                      border: '1px solid #dbeafe',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-sm" style={{ color: '#333' }}>{label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate(`/${sport}/tournament/new`)}
              className="mono-btn-primary w-full mb-2"
              style={{ minHeight: 48, padding: '12px', fontSize: '0.9375rem' }}
            >
              Create {sportLabel} Tournament
            </button>
            <button
              onClick={() => navigate(`/${sport}/quick`)}
              className="mono-btn w-full"
              style={{ minHeight: 48, padding: '12px', fontSize: '0.9375rem' }}
            >
              Score one quick match
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tournaments.map(t => {
              const allMatches = [...(t.matches || []), ...(t.knockoutMatches || [])];
              const matchCount = allMatches.length;
              const completedCount = allMatches.filter((m) =>
                isTournamentMatchCompleted(m, sportConfig.engine, m.format || t.format)
              ).length;
              const progress = matchCount > 0 ? Math.round((completedCount / matchCount) * 100) : 0;
              const nextMatch = getNextMatch(t, sportConfig);
              const nextMatchLabel = nextMatch
                ? `${getTeamName(t, nextMatch.team1Id)} vs ${getTeamName(t, nextMatch.team2Id)}`
                : 'All matches complete';
              const continueLabel = nextMatch ? 'Continue next match' : 'View results';

              return (
                <div key={t.id} className="mono-card" style={{ padding: 0 }}>
                  <button
                    className="cursor-pointer w-full text-left bg-transparent border-none"
                    style={{ padding: '16px 20px', display: 'block' }}
                    onClick={() => openTournament(t.id)}
                    aria-label={`Open ${t.name} tournament, ${completedCount} of ${matchCount} matches completed`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium" style={{ color: '#111' }}>{t.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="mono-badge mono-badge-live" role="status" aria-label={`${completedCount} of ${matchCount} matches completed`}>
                          {completedCount}/{matchCount}
                        </span>
                        {t.teams?.length === 2 && (
                          <span className="text-xs px-2 py-1 rounded" style={{ background: '#f0f6ff', color: '#0066ff' }}>
                            Head-to-head
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs" style={{ color: '#888' }}>
                      {t.teams?.length || 0} teams &middot;{' '}
                      {t.teams?.length === 2 && `${matchCount}-match series`}
                      {t.teams?.length >= 3 && `${matchCount} matches \u00b7 Round-robin`}
                      {(() => {
                        // Cricket: show format preset name instead of raw overs
                        if (sportConfig.engine === 'custom-cricket' && t.format) {
                          const migrated = migrateCricketFormat(t.format);
                          const preset = getCricketFormat(migrated.preset);
                          if (preset) return ` \u00b7 ${preset.name}`;
                          if (migrated.overs) return ` \u00b7 ${migrated.overs} overs`;
                          return ' \u00b7 Custom';
                        }
                        // Non-cricket: existing logic
                        if (t.format?.overs) return ` \u00b7 ${t.format.overs} overs`;
                        if (t.format?.sets) return ` \u00b7 Best of ${t.format.sets}`;
                        return '';
                      })()}
                    </p>
                    <div className="mt-3" aria-hidden="true" style={{ height: 6, background: '#f1f5f9' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: '#0066ff' }} />
                    </div>
                    <p className="text-xs mt-2" style={{ color: nextMatch ? '#111' : '#15803d' }}>
                      {nextMatch ? `Next: ${nextMatchLabel}` : nextMatchLabel}
                    </p>
                  </button>
                  {pendingDeleteId === t.id ? (
                    <div
                      className="flex flex-col"
                      style={{ borderTop: '1px solid #fee2e2', padding: '12px 20px', background: '#fef2f2' }}
                    >
                      <ConfirmActionPanel
                        message="Delete this tournament and its saved matches?"
                        confirmLabel="Delete"
                        confirmAriaLabel={`Confirm delete ${t.name} tournament`}
                        onConfirm={(e) => { e.stopPropagation(); deleteTournament(t.id); }}
                        onCancel={(e) => { e.stopPropagation(); setPendingDeleteId(null); }}
                      />
                    </div>
                  ) : (
                    <div className="flex gap-2" style={{ borderTop: '1px solid #eee', padding: '10px 20px' }}>
                      <button
                        onClick={() => openTournament(t.id)}
                        className="mono-btn-primary flex-1"
                        style={{ minHeight: 44, padding: '10px 12px', fontSize: '0.875rem' }}
                        aria-label={`${continueLabel} - ${t.name}`}
                      >
                        {continueLabel}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPendingDeleteId(t.id); }}
                        className="mono-btn"
                        style={{ minHeight: 44, padding: '10px 12px', color: '#dc2626', borderColor: '#fecaca' }}
                        aria-label={`Delete ${t.name} tournament`}
                      >
                        Delete
                      </button>
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

