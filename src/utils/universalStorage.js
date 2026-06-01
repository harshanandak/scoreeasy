// Universal storage layer for all 5 designs
import { saveData, loadData, clearData } from './storage';

const KEYS = {
  TEMPLATES: 'gs_templates',
  SESSIONS: 'gs_sessions',
  HISTORY: 'gs_history',
  PREFERENCES: 'gs_preferences',
};

// --- Templates ---
export function saveTemplate(template) {
  const templates = loadTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) templates[idx] = template;
  else templates.push(template);
  return saveData(KEYS.TEMPLATES, templates);
}

export function loadTemplates() {
  return loadData(KEYS.TEMPLATES, []);
}

export function deleteTemplate(id) {
  const templates = loadTemplates().filter(t => t.id !== id);
  return saveData(KEYS.TEMPLATES, templates);
}

// --- Sessions ---
export function saveSession(session) {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  return saveData(KEYS.SESSIONS, sessions);
}

export function loadSessions() {
  const sessions = loadData(KEYS.SESSIONS, []);
  return Array.isArray(sessions) ? sessions : [];
}

export function deleteSession(id) {
  const sessions = loadSessions().filter(s => s.id !== id);
  return saveData(KEYS.SESSIONS, sessions);
}

export function getActiveSessions() {
  return loadSessions().filter(s => s.status === 'active' || s.status === 'paused');
}

export function getCompletedSessions() {
  return loadSessions().filter(s => s.status === 'completed');
}

// --- History ---
export function saveHistory(record) {
  const history = loadHistory();
  history.unshift(record); // newest first
  return saveData(KEYS.HISTORY, history);
}

export function loadHistory() {
  return loadData(KEYS.HISTORY, []);
}

export function clearHistory() {
  return clearData(KEYS.HISTORY);
}

// --- Preferences ---
export function savePreferences(prefs) {
  return saveData(KEYS.PREFERENCES, prefs);
}

export function loadPreferences() {
  return loadData(KEYS.PREFERENCES, {});
}

// --- Statistics ---
export function getStats(templateId) {
  const history = loadHistory();
  const filtered = templateId ? history.filter(h => h.templateId === templateId) : history;

  const participantMap = {};
  filtered.forEach(record => {
    record.participants.forEach(name => {
      if (!participantMap[name]) {
        participantMap[name] = { name, played: 0, won: 0, lost: 0, totalPoints: 0 };
      }
      participantMap[name].played++;
      if (record.winner === name) participantMap[name].won++;
      else participantMap[name].lost++;
      participantMap[name].totalPoints += record.finalScores[name] || 0;
    });
  });

  return {
    totalGames: filtered.length,
    participants: Object.values(participantMap).sort((a, b) => b.won - a.won),
    recentGames: filtered.slice(0, 10),
    gameTypes: [...new Set(filtered.map(h => h.templateName))],
  };
}

export function getParticipantStats(name) {
  const history = loadHistory();
  const games = history.filter(h => h.participants.includes(name));

  return {
    name,
    totalGames: games.length,
    wins: games.filter(g => g.winner === name).length,
    losses: games.filter(g => g.winner && g.winner !== name).length,
    winRate: games.length > 0
      ? Math.round((games.filter(g => g.winner === name).length / games.length) * 100)
      : 0,
    gameTypes: [...new Set(games.map(g => g.templateName))],
    recentGames: games.slice(0, 5),
  };
}

export { KEYS };
