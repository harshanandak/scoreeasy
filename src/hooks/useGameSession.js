import { useState, useCallback, useEffect, useRef } from 'react';
import { createGameSession, createHistoryRecord } from '../models/types';
import { saveSession, deleteSession, loadSessions, saveHistory } from '../utils/universalStorage';

export function useGameSession(sessionId = null) {
  const [session, setSession] = useState(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Load existing session if ID provided
  useEffect(() => {
    if (sessionId) {
      const sessions = loadSessions();
      const found = sessions.find(s => s.id === sessionId);
      if (found && isMounted.current) setSession(found);
    }
  }, [sessionId]);

  // Auto-save on changes
  useEffect(() => {
    if (session && isMounted.current) {
      saveSession(session);
    }
  }, [session]);

  const startGame = useCallback(({ template, name, participants }) => {
    const newSession = createGameSession({
      templateId: template.id,
      templateName: template.name,
      templateIcon: template.icon,
      name,
      participants,
    });
    setSession(newSession);
    return newSession;
  }, []);

  const updateScore = useCallback((participantId, delta) => {
    setSession(prev => {
      if (!prev || prev.status === 'completed') return prev;
      const scores = { ...prev.scores };
      const participantScore = { ...scores[participantId] };
      const newTotal = Math.max(0, participantScore.total + delta);
      participantScore.total = newTotal;
      participantScore.history = [
        ...participantScore.history,
        { value: delta, timestamp: new Date().toISOString(), newTotal },
      ];
      scores[participantId] = participantScore;
      return { ...prev, scores };
    });
  }, []);

  const undoLastScore = useCallback((participantId) => {
    setSession(prev => {
      if (!prev) return prev;
      const scores = { ...prev.scores };
      const participantScore = { ...scores[participantId] };
      const history = [...participantScore.history];
      if (history.length === 0) return prev;
      const lastEntry = history.pop();
      participantScore.total = Math.max(0, participantScore.total - lastEntry.value);
      participantScore.history = history;
      scores[participantId] = participantScore;
      return { ...prev, scores };
    });
  }, []);

  const completeGame = useCallback((winnerId = null, onComplete = null) => {
    setSession(prev => {
      if (!prev) return prev;
      const completed = {
        ...prev,
        status: 'completed',
        winner: winnerId,
        completedAt: new Date().toISOString(),
      };
      const record = createHistoryRecord(completed);
      saveHistory(record);
      if (onComplete) onComplete(completed, record);
      return completed;
    });
  }, []);

  const pauseGame = useCallback(() => {
    setSession(prev => prev ? { ...prev, status: 'paused' } : prev);
  }, []);

  const resumeGame = useCallback(() => {
    setSession(prev => prev ? { ...prev, status: 'active' } : prev);
  }, []);

  const resetScores = useCallback(() => {
    setSession(prev => {
      if (!prev) return prev;
      const scores = {};
      prev.participants.forEach(p => {
        scores[p.id] = { total: 0, sets: [], history: [] };
      });
      return { ...prev, scores, status: 'active', winner: null, completedAt: null };
    });
  }, []);

  const removeGame = useCallback(() => {
    if (session) {
      deleteSession(session.id);
      setSession(null);
    }
  }, [session]);

  return {
    session,
    setSession,
    startGame,
    updateScore,
    undoLastScore,
    completeGame,
    pauseGame,
    resumeGame,
    resetScores,
    removeGame,
  };
}
