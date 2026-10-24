// Home v2 model (2026-10-24): what Home counts and lists, as pure functions over the stored records,
// so the count line, Recent and Quick start agree with History about which matches are finished.
import { selectCompletedQuickMatches } from '../../../utils/storage';
import { getSportById, getSportsList } from '../../../models/sportRegistry';

export function matchTime(qm) {
  const time = new Date(qm.completedAt || qm.date || qm.createdAt).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Finished quick matches (History's rule, without writing the store back), newest first. */
export function finishedNewestFirst(stored) {
  const finished = selectCompletedQuickMatches(stored);
  return finished.sort((a, b) => (matchTime(b) ?? 0) - (matchTime(a) ?? 0));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The line under the greeting. It counts what it says: finished matches. With none finished it says
 * how many are in progress instead of "0 matches scored"; with nothing at all it says nothing.
 */
export function homeCountLine({ finishedCount, weekCount, inProgressCount }) {
  if (weekCount > 0) return `${plural(weekCount, 'match', 'matches')} scored this week`;
  if (finishedCount > 0) return `${plural(finishedCount, 'match', 'matches')} scored so far`;
  if (inProgressCount > 0) return `${plural(inProgressCount, 'match', 'matches')} in progress`;
  return null;
}

/** Quick-start tiles: real favourites; else sports recently finished, then the ones in progress. */
export function quickStartSports({ favoriteIds = [], finished = [], inProgress = [] }) {
  const favourites = getSportsList().filter((sp) => favoriteIds.includes(sp.id));
  if (favourites.length > 0) return { sports: favourites.slice(0, 6), label: 'Your favourites' };
  const played = [...new Set([...finished, ...inProgress].map((qm) => qm.sport).filter(Boolean))]
    .map((id) => getSportById(id))
    .filter(Boolean);
  return { sports: played.slice(0, 6), label: 'Recently played' };
}
