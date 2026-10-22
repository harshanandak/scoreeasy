// History screen model (Kit S4, plan 2026-10-22 §9 S4). Pure functions over the History entries
// MonoHistory already builds, so the month card, its legend and the month sections all count the
// same rows: the bar and the legend always sum to that month's list.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const UNDATED = 'undated';

function entryTime(entry) {
  const parsed = Date.parse(entry?.date || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** 'YYYY-MM' in local time, or UNDATED. */
export function monthKey(entry) {
  const time = entryTime(entry);
  if (time === null) return UNDATED;
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "October" for the current year, "October 2025" otherwise; "Undated" for entries without a date. */
export function monthLabel(key, now = Date.now()) {
  if (key === UNDATED) return 'Undated';
  const [year, month] = key.split('-').map(Number);
  const name = MONTHS[month - 1] || key;
  return year === new Date(now).getFullYear() ? name : `${name} ${year}`;
}

/** Entries grouped by month, keeping the order they arrive in (the list's sort order). */
export function groupByMonth(entries, now = Date.now()) {
  const groups = [];
  const byKey = new Map();
  for (const entry of entries) {
    const key = monthKey(entry);
    if (!byKey.has(key)) {
      const group = { key, label: monthLabel(key, now), entries: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).entries.push(entry);
  }
  return groups;
}

/** Per-sport counts for a set of entries, largest first (ties keep first-seen order). */
export function sportCounts(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const id = entry.sport || 'custom';
    if (!counts.has(id)) counts.set(id, { id, name: entry.sportName || 'Custom', count: 0 });
    counts.get(id).count += 1;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * The newest month in `entries` (by date, whatever the list's sort): its label, its total and its
 * per-sport split. Null when nothing is dated.
 */
export function latestMonthSummary(entries, now = Date.now()) {
  let latest = null;
  for (const entry of entries) {
    const time = entryTime(entry);
    if (time !== null && (latest === null || time > latest)) latest = time;
  }
  if (latest === null) return null;
  const newest = new Date(latest);
  const key = `${newest.getFullYear()}-${String(newest.getMonth() + 1).padStart(2, '0')}`;
  const inMonth = entries.filter((entry) => monthKey(entry) === key);
  return { key, label: monthLabel(key, now), total: inMonth.length, sports: sportCounts(inMonth) };
}

/** "25 - 22" -> "25–22", "164/6 vs 158/9" -> "164/6–158/9". Never changes a number. */
export function displayScore(score) {
  return String(score ?? '--').replace(/\s+(?:-|vs)\s+/gi, '–');
}

/** Which side of an entry won: 'a', 'b' or null (draws, ties and unresolved winners stay plain). */
export function winnerSide(entry) {
  const winner = entry?.winner;
  if (!winner || ['draw', 'tie'].includes(String(winner).toLowerCase())) return null;
  if (winner === entry.team1 && winner !== entry.team2) return 'a';
  if (winner === entry.team2 && winner !== entry.team1) return 'b';
  return null;
}
