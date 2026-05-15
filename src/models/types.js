// Universal data model factories for the score tracker

let fallbackIdCounter = 0;
let fallbackRandomCounter = 0;

/**
 * Returns the platform crypto API when it is available.
 */
function getCrypto() {
  return globalThis.crypto ?? null;
}

/**
 * Picks an index using secure randomness when available.
 */
function randomIndex(max) {
  const cryptoApi = getCrypto();
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0] % max;
  }

  fallbackRandomCounter += 1;
  return fallbackRandomCounter % max;
}

/**
 * Creates a reusable scoring template definition.
 */
export function createGameTemplate({
  name,
  icon = '🎮',
  scoringType = 'cumulative',
  pointIncrement = 1,
  winCondition = { type: 'manual', target: null, mustWinBy: 0 },
  maxSets = null,
  playerMode = 'teams',
  isBuiltIn = false,
} = {}) {
  return {
    id: generateId(),
    name,
    icon,
    scoringType,       // 'cumulative' | 'sets' | 'rounds' | 'custom'
    pointIncrement,
    winCondition,      // { type: 'points'|'sets'|'rounds'|'manual', target: number|null, mustWinBy: number }
    maxSets,
    playerMode,        // 'teams' | 'players' | 'both'
    isBuiltIn,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a participant record with a generated ID and default display fields.
 */
export function createParticipant({ name, members = [], color = null, avatar = null } = {}) {
  const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  return {
    id: generateId(),
    name,
    members,
    color: color || colors[randomIndex(colors.length)],
    avatar: avatar || name.charAt(0).toUpperCase(),
  };
}

/**
 * Creates an active game session from a template and participant list.
 */
export function createGameSession({ templateId, templateName, templateIcon, name, participants = [] } = {}) {
  const scores = {};
  participants.forEach(p => {
    scores[p.id] = {
      total: 0,
      sets: [],
      history: [],
    };
  });

  return {
    id: generateId(),
    templateId,
    templateName: templateName || 'Custom Game',
    templateIcon: templateIcon || '🎮',
    name: name || `Game ${new Date().toLocaleDateString()}`,
    participants,
    scores,
    status: 'active',  // 'setup' | 'active' | 'paused' | 'completed'
    winner: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: '',
  };
}

/**
 * Converts a completed session into a compact history record.
 */
export function createHistoryRecord(session) {
  const finalScores = {};
  session.participants.forEach(p => {
    finalScores[p.name] = session.scores[p.id]?.total ?? 0;
  });

  return {
    id: generateId(),
    sessionId: session.id,
    templateId: session.templateId,
    templateName: session.templateName,
    templateIcon: session.templateIcon,
    gameName: session.name,
    participants: session.participants.map(p => p.name),
    participantColors: session.participants.map(p => p.color),
    winner: session.winner ? session.participants.find(p => p.id === session.winner)?.name : null,
    finalScores,
    completedAt: new Date().toISOString(),
    duration: session.startedAt
      ? Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      : 0,
  };
}

/**
 * Generates a stable local identifier without using predictable Math.random values.
 */
export function generateId() {
  const cryptoApi = getCrypto();
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(2);
    cryptoApi.getRandomValues(values);
    return `${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`;
  }

  fallbackIdCounter += 1;
  return `${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}
