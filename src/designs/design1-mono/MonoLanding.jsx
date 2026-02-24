import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loadSportTournaments, loadData, saveData } from '../../utils/storage';
import { getSportsList, getSportById } from '../../models/sportRegistry';
import { useAuth } from '../../hooks/useAuth';
import { SignedIn, SignedOut } from '../../components/AuthButtons';

const QM_KEY = 'se_quickmatches';

export default function MonoLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState({ tournaments: 0, matches: 0, teams: 0 });
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);
  const [quickStartSports, setQuickStartSports] = useState([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    const allSports = getSportsList();
    let totalTournaments = 0;
    let totalMatches = 0;
    const allTeams = new Set();
    const active = [];
    const sportPlayCounts = {};

    allSports.forEach(sport => {
      const tournaments = loadSportTournaments(sport.storageKey);
      totalTournaments += tournaments.length;
      let sportMatches = 0;

      tournaments.forEach(t => {
        t.teams?.forEach(team => allTeams.add(team.name));
        const completed = t.matches?.filter(m =>
          sport.engine === 'custom-cricket'
            ? (m.status === 'completed' || m.team1Score)
            : (m.score1 !== null && m.score1 !== undefined)
        ).length || 0;
        const total = t.matches?.length || 0;
        totalMatches += completed;
        sportMatches += completed;

        if (total > 0 && completed < total) {
          active.push({ ...t, sport, completed, total });
        }
      });

      sportPlayCounts[sport.id] = sportMatches;
    });

    const qm = loadData(QM_KEY, []);
    qm.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Count quick matches per sport
    qm.forEach(m => {
      if (m.sport) {
        sportPlayCounts[m.sport] = (sportPlayCounts[m.sport] || 0) + 1;
      }
    });

    setStats({
      tournaments: totalTournaments,
      matches: totalMatches + qm.length,
      teams: allTeams.size,
    });
    setActiveTournaments(active);
    setRecentMatches(qm.slice(0, 5));

    // Smart sort: user favorites first, then most played, then alphabetical
    const favoriteIds = user?.favoriteGames || [];
    const sorted = [...allSports].sort((a, b) => {
      const isFavA = favoriteIds.includes(a.id) ? 1 : 0;
      const isFavB = favoriteIds.includes(b.id) ? 1 : 0;
      if (isFavB !== isFavA) return isFavB - isFavA;
      const countA = sportPlayCounts[a.id] || 0;
      const countB = sportPlayCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });
    setQuickStartSports(sorted.slice(0, 6));
  }, [user?.favoriteGames]);

  const hasData = stats.tournaments > 0 || stats.matches > 0;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

  const getScore = (qm) => {
    if (qm.team1Score) {
      return `${qm.team1Score.runs}/${qm.team1Score.wickets} vs ${qm.team2Score?.runs}/${qm.team2Score?.wickets}`;
    }
    return `${qm.score1} - ${qm.score2}`;
  };

  const deleteQuickMatch = (id) => {
    const all = loadData(QM_KEY, []);
    const updated = all.filter(m => m.id !== id);
    saveData(QM_KEY, updated);
    setRecentMatches(prev => prev.filter(m => m.id !== id));
    setStats(prev => ({ ...prev, matches: prev.matches - 1 }));
  };

  return (
    <div className={`min-h-screen mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>

      {/* ─── Nav ─── */}
      <nav className="px-6 py-5" aria-label="Main navigation">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight" style={{ color: '#111' }}>
              Score Easy
            </span>
          </div>
          <div className="flex items-center gap-4">
            {hasData && (
              <button
                onClick={() => navigate('/statistics')}
                className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                style={{ color: '#888' }}
              >
                Statistics
              </button>
            )}
            <button
              onClick={() => navigate('/history')}
              className="text-xs bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: '#888' }}
            >
              History
            </button>
            <SignedIn>
              <Link
                to="/users/search"
                className="text-xs font-swiss"
                style={{ color: '#888', textDecoration: 'none' }}
              >
                Find players
              </Link>
            </SignedIn>
            <SignedOut>
              <Link
                to="/login"
                className="text-xs font-swiss"
                style={{ color: '#0066ff', textDecoration: 'none' }}
              >
                Sign in
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                to="/profile"
                className="text-xs font-mono"
                style={{ color: '#111', textDecoration: 'none' }}
              >
                @{user?.username || '...'}
              </Link>
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* ─── Compact Hero ─── */}
      <section className="px-6 pt-6 pb-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1
            className="font-semibold tracking-tight leading-tight mb-5"
            style={{ color: '#111', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}
          >
            Score matches.<br />
            Track tournaments.<br />
            Know who won.
          </h1>

          <button
            onClick={() => navigate('/play')}
            className="mono-btn-primary"
            style={{ padding: '12px 32px', fontSize: '0.9375rem' }}
          >
            Start scoring
          </button>
        </div>
      </section>

      {/* ─── Stats Row ─── */}
      {hasData && (
        <section className="px-6 pb-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs uppercase tracking-widest font-normal mb-4" style={{ color: '#888' }}>
              Your activity
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="mono-card text-center" style={{ padding: '14px 8px' }}>
                <p className="text-xl font-bold font-mono" style={{ color: '#111', fontVariantNumeric: 'tabular-nums' }}>{stats.tournaments}</p>
                <p className="text-xs mt-1" style={{ color: '#888' }}>Tournament{stats.tournaments !== 1 ? 's' : ''}</p>
              </div>
              <div className="mono-card text-center" style={{ padding: '14px 8px' }}>
                <p className="text-xl font-bold font-mono" style={{ color: '#111', fontVariantNumeric: 'tabular-nums' }}>{stats.matches}</p>
                <p className="text-xs mt-1" style={{ color: '#888' }}>Match{stats.matches !== 1 ? 'es' : ''}</p>
              </div>
              <div className="mono-card text-center" style={{ padding: '14px 8px' }}>
                <p className="text-xl font-bold font-mono" style={{ color: '#111', fontVariantNumeric: 'tabular-nums' }}>{stats.teams}</p>
                <p className="text-xs mt-1" style={{ color: '#888' }}>Team{stats.teams !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {hasData && <hr className="mono-divider max-w-2xl mx-auto" />}

      {/* ─── Recent Matches ─── */}
      {recentMatches.length > 0 && (
        <section className="px-6 py-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs uppercase tracking-widest font-normal" style={{ color: '#888' }}>
                Recent matches
              </h2>
              <button
                onClick={() => navigate('/history')}
                className="text-xs bg-transparent border-none cursor-pointer font-swiss"
                style={{ color: '#0066ff' }}
              >
                View all
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {recentMatches.map(qm => {
                const sportConfig = getSportById(qm.sport);
                return (
                  <div key={qm.id} className="mono-card" style={{ padding: '12px 16px' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{sportConfig?.icon || ''}</span>
                          <span className="text-sm font-medium" style={{ color: '#111' }}>
                            {qm.team1} vs {qm.team2}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-bold" style={{ color: '#111', fontVariantNumeric: 'tabular-nums' }}>
                            {getScore(qm)}
                          </span>
                          <span className="text-xs" style={{ color: '#0066ff' }}>
                            {qm.winner === 'Draw' ? 'Draw' : qm.winner === 'Tie' ? 'Tied' : `${qm.winner} won`}
                          </span>
                          <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                            {formatDate(qm.date)}
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
                );
              })}
            </div>
          </div>
        </section>
      )}

      {recentMatches.length > 0 && <hr className="mono-divider max-w-2xl mx-auto" />}

      {/* ─── Active Tournaments ─── */}
      {activeTournaments.length > 0 && (
        <section className="px-6 py-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs uppercase tracking-widest font-normal mb-4" style={{ color: '#888' }}>
              Active tournaments
            </h2>

            <div className="flex flex-col gap-2">
              {activeTournaments.map(t => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/${t.sport.id}/tournament/${t.id}`)}
                  className="mono-card w-full text-left bg-transparent border-none cursor-pointer"
                  style={{ padding: '14px 16px', display: 'block', border: '1px solid #eee' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{t.sport.icon}</span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#111' }}>{t.name}</p>
                        <p className="text-xs" style={{ color: '#888' }}>
                          {t.teams?.length || 0} teams &middot; {t.sport.name}
                        </p>
                      </div>
                    </div>
                    <span className="mono-badge mono-badge-live">
                      {t.completed}/{t.total}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTournaments.length > 0 && <hr className="mono-divider max-w-2xl mx-auto" />}

      {/* ─── Quick Start ─── */}
      <section className="px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xs uppercase tracking-widest font-normal mb-4" style={{ color: '#888' }}>
            Quick start
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickStartSports.map(sport => (
              <div key={sport.id} className="mono-card" style={{ padding: 0 }}>
                <div style={{ padding: '16px 14px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl" aria-hidden="true">{sport.icon}</span>
                    <span className="text-sm font-semibold" style={{ color: '#111' }}>
                      {sport.name}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/${sport.id}/tournament`)}
                      className="mono-btn-primary flex-1"
                      style={{ padding: '8px 6px', fontSize: '0.75rem' }}
                    >
                      Tournament
                    </button>
                    <button
                      onClick={() => navigate(`/${sport.id}/quick`)}
                      className="mono-btn flex-1"
                      style={{ padding: '8px 6px', fontSize: '0.75rem' }}
                    >
                      Quick
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-4">
            <button
              onClick={() => navigate('/play')}
              className="text-xs bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: '#0066ff' }}
            >
              Browse all 14 sports &rarr;
            </button>
          </div>
        </div>
      </section>

      <hr className="mono-divider max-w-2xl mx-auto" />

      {/* ─── How it works (new users only) ─── */}
      {!hasData && (
        <section className="px-6 py-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs uppercase tracking-widest font-normal mb-8 text-center" style={{ color: '#888' }}>
              How it works
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <StepCard number="1" title="Pick a sport" desc="Choose from 14 sports. Select tournament mode or start a quick match." />
              <StepCard number="2" title="Set up teams" desc="Name your tournament, choose the format, and add 2 to 8 teams." />
              <StepCard number="3" title="Enter scores" desc="Tap any match to enter scores. Points table and standings update instantly." />
            </div>
          </div>
        </section>
      )}

      {!hasData && <hr className="mono-divider max-w-2xl mx-auto" />}

      {/* ─── Footer ─── */}
      <footer className="px-6 py-8" style={{ borderTop: hasData ? '1px solid #eee' : 'none' }}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-xs" style={{ color: '#bbb' }}>
            Score Easy
          </p>
          <p className="text-xs font-mono" style={{ color: '#ccc' }}>
            v2.0
          </p>
        </div>
      </footer>

    </div>
  );
}


/* ─── Sub-components ─── */

function StepCard({ number, title, desc }) {
  return (
    <div className="text-center sm:text-left">
      <div
        className="inline-flex items-center justify-center w-8 h-8 mb-3 font-mono text-sm font-bold"
        style={{
          color: '#0066ff',
          border: '1px solid #0066ff',
          borderRadius: '50%',
        }}
      >
        {number}
      </div>
      <h3 className="text-sm font-semibold mb-1" style={{ color: '#111' }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
        {desc}
      </p>
    </div>
  );
}
