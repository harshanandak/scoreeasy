import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameHistory } from '../../hooks/useGameHistory';
import { loadData, saveData } from '../../utils/storage';
import { getSportById } from '../../models/sportRegistry';

const QM_KEY = 'se_quickmatches';

export default function MonoHistory() {
  const navigate = useNavigate();
  const { history, clearAll: clearGeneric } = useGameHistory();
  const [visible, setVisible] = useState(false);
  const [quickMatches, setQuickMatches] = useState([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const loaded = loadData(QM_KEY, []);
    loaded.sort((a, b) => new Date(b.date) - new Date(a.date));
    setQuickMatches(loaded);
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

  const formatElapsed = (secs) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const deleteQuickMatch = (id) => {
    const updated = quickMatches.filter(qm => qm.id !== id);
    setQuickMatches(updated);
    saveData(QM_KEY, updated);
  };

  const clearAllQuickMatches = () => {
    setQuickMatches([]);
    saveData(QM_KEY, []);
  };

  const clearEverything = () => {
    clearGeneric();
    clearAllQuickMatches();
  };

  const totalCount = history.length + quickMatches.length;

  const getScore = (qm) => {
    if (qm.team1Score) {
      return `${qm.team1Score.runs}/${qm.team1Score.wickets} vs ${qm.team2Score?.runs}/${qm.team2Score?.wickets}`;
    }
    return `${qm.score1} - ${qm.score2}`;
  };

  return (
    <div className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <nav className="flex items-center justify-between mb-10" aria-label="History navigation">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="bg-transparent border-none cursor-pointer font-swiss text-sm"
              style={{ color: '#888' }}
              aria-label="Go back to home"
            >
              &larr;
            </button>
            <h1 className="text-xl font-semibold" style={{ color: '#111' }}>
              History
            </h1>
          </div>
          {totalCount > 0 && (
            <button
              onClick={clearEverything}
              className="bg-transparent border-none cursor-pointer font-swiss text-sm"
              style={{ color: '#dc2626' }}
            >
              Clear All
            </button>
          )}
        </nav>

        {/* Empty state */}
        {totalCount === 0 ? (
          <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
            <p className="text-sm" style={{ color: '#888' }}>
              No games played yet
            </p>
          </div>
        ) : (
          <>
            {/* Quick Matches */}
            {quickMatches.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs uppercase tracking-widest font-normal" style={{ color: '#888' }}>
                    Quick matches ({quickMatches.length})
                  </h2>
                  {quickMatches.length > 1 && (
                    <button
                      onClick={clearAllQuickMatches}
                      className="bg-transparent border-none cursor-pointer font-swiss text-xs"
                      style={{ color: '#dc2626' }}
                    >
                      Clear quick matches
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {quickMatches.map(qm => {
                    const sportConfig = getSportById(qm.sport);
                    return (
                      <div key={qm.id} className="mono-card" style={{ padding: '14px 16px' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">{sportConfig?.icon || ''}</span>
                              <span className="text-sm font-medium" style={{ color: '#111' }}>
                                {qm.team1} vs {qm.team2}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono font-bold" style={{ color: '#111' }}>
                                {getScore(qm)}
                              </span>
                              <span className="text-xs" style={{ color: '#0066ff' }}>
                                {qm.winner === 'Draw' ? 'Draw' : qm.winner === 'Tie' ? 'Tied' : `${qm.winner} won`}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                                {formatDate(qm.date)}
                              </span>
                              {qm.elapsedSeconds > 0 && (
                                <span className="text-xs font-mono" style={{ color: '#bbb' }}>
                                  {formatElapsed(qm.elapsedSeconds)}
                                </span>
                              )}
                              <span className="text-xs" style={{ color: '#bbb' }}>
                                {sportConfig?.name || qm.sport}
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
            )}

            {/* Generic Games (old system) */}
            {history.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-widest font-normal mb-4" style={{ color: '#888' }}>
                  Custom games ({history.length})
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <caption className="sr-only">Game history</caption>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th scope="col" className="text-xs uppercase tracking-widest font-normal text-left py-3" style={{ color: '#888', width: '72px' }}>Date</th>
                      <th scope="col" className="text-xs uppercase tracking-widest font-normal text-left py-3" style={{ color: '#888' }}>Game</th>
                      <th scope="col" className="text-xs uppercase tracking-widest font-normal text-left py-3" style={{ color: '#888' }}>Players</th>
                      <th scope="col" className="text-xs uppercase tracking-widest font-normal text-left py-3" style={{ color: '#888', width: '80px' }}>Score</th>
                      <th scope="col" className="text-xs uppercase tracking-widest font-normal text-left py-3" style={{ color: '#888', width: '80px' }}>Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).map((record) => {
                      const scores = record.participants
                        .map((name) => record.finalScores[name] ?? 0)
                        .join(' : ');

                      return (
                        <tr key={record.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td className="text-sm font-mono py-3" style={{ color: '#111' }}>{formatDate(record.completedAt)}</td>
                          <td className="text-sm py-3" style={{ color: '#111' }}>{record.gameName}</td>
                          <td className="text-sm py-3" style={{ color: '#888' }}>{record.participants.join(', ')}</td>
                          <td className="text-sm font-mono mono-score py-3" style={{ color: '#111' }}>{scores}</td>
                          <td className="text-sm py-3" style={{ color: record.winner ? '#0066ff' : '#888' }}>{record.winner || '--'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
