import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadSportTournaments, deleteSportTournament } from '../../utils/storage';
import { getSportById } from '../../models/sportRegistry';
import { getCricketFormat } from '../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../utils/formatMigration';
import { isTournamentMatchCompleted } from '../../utils/tournamentSync';
import BackArrow from './components/BackArrow';

export default function MonoTournamentList() {
  const navigate = useNavigate();
  const { sport } = useParams();
  const sportConfig = getSportById(sport);
  const [tournaments, setTournaments] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sportConfig) return;
    const loaded = loadSportTournaments(sportConfig.storageKey);
    setTournaments(loaded.filter(t => t.mode === 'tournament' || !t.mode));
    requestAnimationFrame(() => setVisible(true));
  }, [sport, sportConfig]);

  const deleteTournament = (id) => {
    if (!confirm('Delete this tournament?')) return;
    deleteSportTournament(sportConfig.storageKey, id);
    setTournaments(prev => prev.filter(t => t.id !== id));
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
          + New Tournament
        </button>

        {/* List */}
        {tournaments.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: '30vh' }}>
            <span className="text-4xl mb-4">{sportIcon}</span>
            <p className="text-sm" style={{ color: '#888' }}>No tournaments yet</p>
            <p className="text-xs mt-1" style={{ color: '#bbb' }}>Create one to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tournaments.map(t => {
              const allMatches = [...(t.matches || []), ...(t.knockoutMatches || [])];
              const matchCount = allMatches.length;
              const completedCount = allMatches.filter((m) =>
                isTournamentMatchCompleted(m, sportConfig.engine, m.format || t.format)
              ).length;

              return (
                <div key={t.id} className="mono-card" style={{ padding: 0 }}>
                  <button
                    className="cursor-pointer w-full text-left bg-transparent border-none"
                    style={{ padding: '16px 20px', display: 'block' }}
                    onClick={() => navigate(`/${sport}/tournament/${t.id}`)}
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
                  </button>
                  <div style={{ borderTop: '1px solid #eee', padding: '8px 20px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTournament(t.id); }}
                      className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                      style={{ color: '#dc2626' }}
                      aria-label={`Delete ${t.name} tournament`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

