import { getSportById } from '../models/sportRegistry';

export const PRIORITY_START_SPORT_IDS = ['cricket', 'football', 'volleyball'];

export function getSportStartLabel(sportOrId, fallback = 'Start Match') {
  const sport = typeof sportOrId === 'string' ? getSportById(sportOrId) : sportOrId;
  if (!sport?.name) return fallback;
  return `Start ${sport.name}`;
}

/**
 * Quick setup's one Go names the outcome in sentence case (Kit S2): "Start volleyball".
 * @param {object | string} sportOrId registry entry or id
 * @param {string} [fallback]
 */
export function getSetupStartLabel(sportOrId, fallback = 'Start match') {
  const sport = typeof sportOrId === 'string' ? getSportById(sportOrId) : sportOrId;
  if (!sport?.name) return fallback;
  return `Start ${sport.name.toLowerCase()}`;
}

export function getPriorityStartActions() {
  return PRIORITY_START_SPORT_IDS
    .map((sportId, index) => {
      const sport = getSportById(sportId);
      if (!sport) return null;
      return {
        label: getSportStartLabel(sport),
        primary: index === 0,
        sportId,
      };
    })
    .filter(Boolean);
}
