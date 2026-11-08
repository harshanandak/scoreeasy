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

// Per-clientMatchId session record key (se_ prefix per project convention).
const SESSION_PREFIX = 'se_live_session:';

/** Storage key for one match's broadcast session. */
export function sessionKey(clientMatchId) {
  return `${SESSION_PREFIX}${clientMatchId}`;
}

/**
 * Load the persisted broadcast session for a local match, or null.
 * @param {string} clientMatchId
 * @returns {{ matchId?: string, token?: string, seq?: number, finalizeIntent?: { resultType?: 'decided'|'abandoned' } }|null}
 */
export function loadSession(clientMatchId) {
  if (!clientMatchId) return null;
  const session = loadData(sessionKey(clientMatchId), null);
  return session && typeof session === 'object' ? session : null;
}

/**
 * Persist (replace) the broadcast session for a local match.
 * @param {string} clientMatchId
 * @param {{ matchId?: string|null, token?: string|null, seq?: number, finalizeIntent?: { resultType?: 'decided'|'abandoned' } }} session
 * @returns {boolean} success
 */
export function saveSession(clientMatchId, session) {
  if (!clientMatchId) return false;
  return saveData(sessionKey(clientMatchId), session);
}

/** Forget a match's broadcast session (e.g. after discard). */
export function clearSession(clientMatchId) {
  if (!clientMatchId) return false;
  return saveData(sessionKey(clientMatchId), null);
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
