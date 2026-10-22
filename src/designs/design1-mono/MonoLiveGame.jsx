import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameSession } from '../../hooks/useGameSession';
import { useTimer } from '../../hooks/useTimer';

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export default function MonoLiveGame() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    session,
    updateScore,
    undoLastScore,
    completeGame,
    pauseGame,
    resumeGame,
  } = useGameSession(id);
  const timer = useTimer();

  const [visible, setVisible] = useState(false);
  const timerStartedRef = useRef(false);
  const lastClickRef = useRef(0);

  // Fade in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Start timer when session loads
  useEffect(() => {
    if (session && session.status === 'active' && !timerStartedRef.current) {
      timer.start();
      timerStartedRef.current = true;
    }
  }, [session, timer]);

  // Pause/resume timer with game status
  useEffect(() => {
    if (!session) return;
    if (session.status === 'completed' || session.status === 'paused') {
      timer.pause();
    }
  }, [session, timer]);

  const handleScoreChange = useCallback(
    (participantId, delta) => {
      // Debounce rapid clicks
      const now = Date.now();
      if (now - lastClickRef.current < 150) return;
      lastClickRef.current = now;

      updateScore(participantId, delta);
    },
    [updateScore]
  );

  const handleUndo = useCallback(() => {
    if (!session) return;
    // Undo the last score change from any participant
    const allHistory = [];
    session.participants.forEach((p) => {
      const hist = session.scores[p.id]?.history || [];
      if (hist.length > 0) {
        allHistory.push({
          participantId: p.id,
          timestamp: hist[hist.length - 1].timestamp,
        });
      }
    });
    if (allHistory.length === 0) return;
    allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    undoLastScore(allHistory[0].participantId);
  }, [session, undoLastScore]);

  const handleComplete = useCallback(() => {
    if (!session) return;
    let highestScore = -1;
    let winnerId = null;
    session.participants.forEach((p) => {
      const score = session.scores[p.id]?.total ?? 0;
      if (score > highestScore) {
        highestScore = score;
        winnerId = p.id;
      }
    });
    completeGame(winnerId);
  }, [session, completeGame]);

  const handleTogglePause = useCallback(() => {
    if (!session) return;
    if (session.status === 'paused') {
      resumeGame();
      timer.start();
    } else {
      pauseGame();
      timer.pause();
    }
  }, [session, pauseGame, resumeGame, timer]);

  const handleBackToHome = useCallback(() => {
    navigate('/app');
  }, [navigate]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm font-swiss" style={{ color: '#888' }}>
          Loading...
        </p>
      </div>
    );
  }

  const participants = session.participants;
  const isCompleted = session.status === 'completed';

  // Status label
  const statusText =
    session.status === 'completed'
      ? 'Final'
      : session.status === 'paused'
      ? 'Paused'
      : 'Live';
  const statusBadgeClass =
    session.status === 'completed'
      ? 'mono-badge mono-badge-final'
      : session.status === 'paused'
      ? 'mono-badge mono-badge-paused'
      : 'mono-badge mono-badge-live';

  // Completed state
  if (isCompleted) {
    const winner = session.winner
      ? participants.find((p) => p.id === session.winner)
      : null;

    return (
      <div
        className={`min-h-screen flex items-center justify-center mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}
      >
        <div className="text-center">
          <span className={statusBadgeClass} style={{ marginBottom: '24px', display: 'inline-flex' }}>
            {statusText}
          </span>

          {/* Score display */}
          <div className="flex items-center justify-center gap-6 mt-6 mb-6">
            {participants.map((p, index) => (
              <React.Fragment key={p.id}>
                {index > 0 && (
                  <span
                    className="text-4xl font-light mono-score"
                    style={{ color: '#ddd' }}
                  >
                    :
                  </span>
                )}
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#888' }}>
                    {p.name}
                  </p>
                  <p
                    className="font-bold mono-score"
                    style={{ fontSize: '4rem', color: '#111', lineHeight: 1 }}
                  >
                    {session.scores[p.id]?.total ?? 0}
                  </p>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Winner */}
          {winner && (
            <div className="mt-8">
              <p className="text-2xl font-semibold" style={{ color: '#0066ff' }}>
                {winner.name}
              </p>
              <p className="text-sm mt-1" style={{ color: '#888' }}>
                wins
              </p>
            </div>
          )}

          {/* Timer */}
          <p className="text-xs font-mono mt-6" style={{ color: '#888' }}>
            {timer.formatted}
          </p>

          <button
            onClick={handleBackToHome}
            className="mono-btn mt-8"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Active / Paused game
  return (
    <div
      className={`min-h-screen flex flex-col mono-transition ${visible ? 'mono-visible' : 'mono-hidden'}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-6">
        <button
          onClick={handleBackToHome}
          className="text-xs bg-transparent border-none cursor-pointer font-swiss"
          style={{ color: '#888' }}
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono" style={{ color: '#888' }}>
            {timer.formatted}
          </span>
          <span className={statusBadgeClass}>{statusText}</span>
        </div>
      </div>

      {/* Game name */}
      <div className="text-center mt-4">
        <p className="text-xs" style={{ color: '#888' }}>{session.name}</p>
      </div>

      {/* Hero score area */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="flex items-center justify-center gap-8">
          {participants.map((participant, index) => (
            <React.Fragment key={participant.id}>
              {index > 0 && (
                <span
                  className="mono-score font-light"
                  style={{ fontSize: '5rem', color: '#ddd', lineHeight: 1 }}
                >
                  :
                </span>
              )}
              <div className="text-center">
                {/* Player name */}
                <p
                  className="text-xs uppercase tracking-widest mb-4"
                  style={{ color: '#888' }}
                >
                  {participant.name}
                </p>

                {/* Giant score */}
                <p
                  className="font-bold mono-score"
                  style={{
                    fontSize: 'clamp(4rem, 15vw, 10rem)',
                    color: '#111',
                    lineHeight: 1,
                  }}
                >
                  {session.scores[participant.id]?.total ?? 0}
                </p>

                {/* +/- buttons */}
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button
                    onClick={() =>
                      handleScoreChange(participant.id, -(session.pointIncrement || 1))
                    }
                    className="mono-score-btn"
                    style={{ touchAction: 'manipulation' }}
                  >
                    &minus;
                  </button>
                  <button
                    onClick={() =>
                      handleScoreChange(participant.id, session.pointIncrement || 1)
                    }
                    className="mono-score-btn"
                    style={{ touchAction: 'manipulation' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderTop: '1px solid #eee' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={handleUndo} className="mono-btn" style={{ fontSize: '0.8125rem' }}>
            Undo
          </button>
          <button onClick={handleTogglePause} className="mono-btn" style={{ fontSize: '0.8125rem' }}>
            {session.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        </div>
        <button onClick={handleComplete} className="mono-btn-primary" style={{ fontSize: '0.8125rem' }}>
          Complete
        </button>
      </div>
    </div>
  );
}
