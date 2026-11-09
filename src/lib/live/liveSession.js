// Per-match broadcast session and remembered sharing-disclosure choice.
//
// Design refs: localStorage authority and the offline-first outbox. Sharing is
// private until explicitly requested per match. Kept tiny and pure so both the
// broadcast hook and the consent UI can share it without a React dependency.
//
// A "session" ties a local match (clientMatchId) to its live broadcast identity
// (Convex matchId + share token) and the monotonic broadcast `seq`. Persisting
// it lets an explicit re-share after reload reattach to the SAME live match and
// continue its clientEventId sequence without forking another live match.


import { loadData, saveData } from '../../utils/storage';
import { removeSessionItems } from './outbox';

// Per-clientMatchId session record key (se_ prefix per project convention).
const SESSION_PREFIX = 'se_live_session:';
const GENERATION_PREFIX = 'se_live_generation:';
export const LIVE_SESSIONS_CHANGED = 'se-live-sessions-changed';
const notify = () => globalThis.dispatchEvent?.(new Event(LIVE_SESSIONS_CHANGED));

export function liveClientMatchId(baseId) {
  const generation = loadData(`${GENERATION_PREFIX}${baseId}`, 0);
  return generation ? `${baseId}:generation:${generation}` : baseId;
}

export function liveSessions() {
  const sessions = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(SESSION_PREFIX)) continue;
      const clientMatchId = key.slice(SESSION_PREFIX.length);
      const session = loadSession(clientMatchId);
      if (session) sessions.push({ ...session, clientMatchId });
    }
  } catch { /* Retry on the next lifecycle event if storage is unavailable. */ }
  return sessions;
}

/** Intentional fixture clear retires the old server identity, including pending work. */
export function resetLiveGeneration(baseId) {
  const previous = liveClientMatchId(baseId);
  saveData(`${GENERATION_PREFIX}${baseId}`, loadData(`${GENERATION_PREFIX}${baseId}`, 0) + 1);
  removeSessionItems(previous);
  clearSession(previous);
}

/** Storage key for one match's broadcast session. */
export function sessionKey(clientMatchId) {
  return `${SESSION_PREFIX}${clientMatchId}`;
}

/**
 * Load the persisted broadcast session for a local match, or null.
 * @param {string} clientMatchId
 * @returns {{ matchId?: string, token?: string, seq?: number, finalizeIntent?: { resultType?: 'decided'|'abandoned', shared: true } }|null}
 */
export function loadSession(clientMatchId) {
  if (!clientMatchId) return null;
  const session = loadData(sessionKey(clientMatchId), null);
  return session && typeof session === 'object' ? session : null;
}

/**
 * Persist (replace) the broadcast session for a local match.
 * @param {string} clientMatchId
 * @param {{ matchId?: string|null, token?: string|null, seq?: number, finalizeIntent?: { resultType?: 'decided'|'abandoned', shared: true } }} session
 * @returns {boolean} success
 */
export function saveSession(clientMatchId, session) {
  if (!clientMatchId) return false;
  const saved = saveData(sessionKey(clientMatchId), session);
  notify();
  return saved;
}

/** Forget a match's broadcast session (e.g. after discard). */
export function clearSession(clientMatchId) {
  if (!clientMatchId) return false;
  const saved = saveData(sessionKey(clientMatchId), null);
  notify();
  return saved;
}

// ---------------------------------------------------------------------------
// Remembered public-sharing disclosure choice
// ---------------------------------------------------------------------------

// This global flag avoids repeating the disclosure; it never publishes a match.
// Each match still requires the scorer's explicit sharing action.
export const CONSENT_KEY = 'se_live_public_consent';

/** @returns {'accepted'|'declined'|null} */
export function getConsent() {
  const value = loadData(CONSENT_KEY, null);
  return value === 'accepted' || value === 'declined' ? value : null;
}

/** @param {'accepted'|'declined'} value */
export function setConsent(value) {
  return saveData(CONSENT_KEY, value);
}

/** True once the user has seen (accepted or declined) the disclosure. */
export function hasSeenConsent() {
  return getConsent() !== null;
}
