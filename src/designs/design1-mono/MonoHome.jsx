import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveSessions } from '../../utils/universalStorage';
import { useGameHistory } from '../../hooks/useGameHistory';

export default function MonoHome() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [visible, setVisible] = useState(false);
  const { history } = useGameHistory();

  useEffect(() => {
    setSessions(getActiveSessions());
    // Trigger fade-in
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const recentHistory = history.slice(0, 3);

  return (
    <div
      className={`min-h-screen px-6 py-10 mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}
    >
      <div className="max-w-2xl mx-auto">
        {/* Nav bar */}
        <nav className="flex items-center justify-between mb-12">
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#111' }}>
            Score Easy
          </h1>
          <button
            onClick={() => navigate('/history')}
            className="text-sm bg-transparent border-none cursor-pointer font-swiss"
            style={{ color: '#888' }}
          >
            History
          </button>
        </nav>

        {/* Active Games */}
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: '40vh' }}>
            <p className="text-base mb-6" style={{ color: '#888' }}>
              No active games
            </p>
            <button
              onClick={() => navigate('/setup')}
              className="text-sm bg-transparent border-none cursor-pointer font-swiss"
              style={{ color: '#0066ff' }}
            >
              Start a game
            </button>
          </div>
        ) : (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs uppercase tracking-widest font-normal" style={{ color: '#888' }}>
                Active
              </h2>
              <button
                onClick={() => navigate('/setup')}
                className="mono-btn"
                style={{ padding: '6px 16px', fontSize: '0.8125rem', borderColor: '#0066ff', color: '#0066ff' }}
              >
                New Game
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {sessions.map((session) => {
                const participantNames = session.participants
                  .map((p) => p.name)
                  .join(' vs ');
                const scoreDisplay = session.participants
                  .map((p) => session.scores[p.id]?.total ?? 0)
                  .join(' : ');
                const statusLabel = session.status === 'paused' ? 'Paused' : 'Live';
                const badgeClass = session.status === 'paused' ? 'mono-badge mono-badge-paused' : 'mono-badge mono-badge-live';

                return (
                  <button
                    key={session.id}
                    onClick={() => navigate(`/game/${session.id}`)}
                    className="mono-card w-full text-left cursor-pointer font-swiss"
                    style={{ padding: '16px 20px', border: '1px solid #eee', background: '#fff' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: '#111' }}>
                        {session.name}
                      </span>
                      <span className={badgeClass}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#888' }}>
                        {participantNames}
                      </span>
                      <span
                        className="text-lg font-bold mono-score"
                        style={{ color: '#111' }}
                      >
                        {scoreDisplay}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent history */}
        {recentHistory.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xs uppercase tracking-widest font-normal mb-4" style={{ color: '#888' }}>
              Recent
            </h2>
            {recentHistory.map((record, index) => {
              const scores = record.participants
                .map((name) => record.finalScores[name] ?? 0)
                .join(' : ');

              return (
                <div key={record.id}>
                  {index > 0 && <hr className="mono-divider" />}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <span className="text-sm" style={{ color: '#111' }}>
                        {record.gameName}
                      </span>
                      <span className="text-xs ml-3" style={{ color: '#888' }}>
                        {record.participants.join(' vs ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono mono-score" style={{ color: '#111' }}>
                        {scores}
                      </span>
                      {record.winner && (
                        <span className="text-xs" style={{ color: '#0066ff' }}>
                          {record.winner}
                        </span>
                      )}
                    </div>
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
