// Score Easy's game focus — the ONE place sport order and retired sports live.
//
// Source: docs/plans/2026-07-20-icp-games/adjusted-plan.md §A (ICP tiers +
// registry decisions). Every sport picker reads its order through
// getSportsList() / getSportsByCategory() in sportRegistry.js, which sort by
// these lists — never re-declare an order on a screen.
//
// Ids listed here but not (yet) registered are skipped by the registry helpers,
// so a sport lands in its planned slot the moment it is registered.

/** Tier-0 — the priority set, India-first order (plan §A). */
export const PRIORITY_SPORT_IDS = [
  'cricket',
  'kabaddi',
  'volleyball',
  'badminton',
  'football',
  'basketball',
  'throwball', // not registered yet — rules need sign-off (see the PR notes)
  'khokho', // not registered yet — needs a raid/innings engine
];

/** Kept-but-later — registered on their current engine, listed after Tier-0. */
export const LATER_SPORT_IDS = ['tennis', 'tabletennis', 'hockey'];

export const SPORT_ORDER = [...PRIORITY_SPORT_IDS, ...LATER_SPORT_IDS];

export const PRIORITY_GROUP_LABEL = 'Popular';
export const LATER_GROUP_LABEL = 'More sports';

/**
 * Deregistered sports (plan §A, "per user decision 1"). They can no longer be
 * started, but a device or Convex row may still hold their matches, so we keep
 * just enough to label and list that saved data read-only. Never delete this
 * data from here — any data drop is a separate, explicit migration.
 */
export const RETIRED_SPORTS = {
  pickleball: { id: 'pickleball', name: 'Pickleball', engine: 'sets', storageKey: 'se_pickleball' },
  squash: { id: 'squash', name: 'Squash', engine: 'sets', storageKey: 'se_squash' },
  rugby: { id: 'rugby', name: 'Rugby', engine: 'goals', storageKey: 'se_rugby' },
  futsal: { id: 'futsal', name: 'Futsal', engine: 'goals', storageKey: 'se_futsal' },
  handball: { id: 'handball', name: 'Handball', engine: 'goals', storageKey: 'se_handball' },
};
