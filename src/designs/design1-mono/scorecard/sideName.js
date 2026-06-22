// Maps a scorecard selector's `'A' | 'B' | null` side token to a display name.
//
// The scorecard.js selectors are sport-agnostic and only ever speak in sides
// (`'A'`/`'B'`) — they never carry team names. Components therefore receive the
// human labels as static props and resolve them here. This keeps the rule
// intact: every *derived* stat (leader side, margin, totals, run length) still
// comes solely from the selectors; names are presentation labels, not data.

export const DEFAULT_TEAM_A = 'Team A';
export const DEFAULT_TEAM_B = 'Team B';

/**
 * Resolves a side token to its display name. Returns `null` for a `null` side
 * (tie / empty stream) so callers can render an explicit "tied" path.
 *
 * @param {'A'|'B'|null|undefined} side
 * @param {string} teamA
 * @param {string} teamB
 * @returns {string|null}
 */
export function sideName(side, teamA = DEFAULT_TEAM_A, teamB = DEFAULT_TEAM_B) {
  if (side === 'A') return teamA;
  if (side === 'B') return teamB;
  return null;
}
