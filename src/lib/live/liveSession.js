// Per-match broadcast SESSION + one-time public CONSENT persistence.
//
// Design refs: §3.1 (localStorage authoritative), §3.4 (offline-first outbox),
// §7 (public-by-default + one-time consent). Kept tiny and pure so both the
// broadcast hook and the consent UI can share it without a React dependency.
//
// A "session" ties a local match (clientMatchId) to its live broadcast identity
// (Convex matchId + share token) and the monotonic broadcast `seq`. Persisting
// it means an app reload mid-match keeps mirroring to the SAME live match with a
// continuous clientEventId sequence — so the idempotent backend never
// double-counts and never forks a second live match (create is idempotent on
// owner+clientMatchId, §3.5).

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
 * @returns {{ matchId?: string, token?: string, seq?: number }|null}
 */
export function loadSession(clientMatchId) {
  if (!clientMatchId) return null;
  const session = loadData(sessionKey(clientMatchId), null);
  return session && typeof session === 'object' ? session : null;
}

/**
 * Persist (replace) the broadcast session for a local match.
 * @param {string} clientMatchId
 * @param {{ matchId?: string|null, token?: string|null, seq?: number }} session
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
// One-time public-broadcast consent (§7 public-by-default + opt-out, issue b0z)
// ---------------------------------------------------------------------------

// A single global flag: the user is shown the "scores are shared publicly"
// disclosure ONCE, then never again. Per-match opt-out is a separate control.
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
