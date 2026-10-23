// Match MonoWatchMatch's strict boundary: a match becomes stale AFTER 90 seconds.
export const STALE_MS = 90000;
export function liveStatus(lastEventAt, now = Date.now()) {
  return now - lastEventAt > STALE_MS ? 'Paused' : 'Live';
}
export function updateAge(lastEventAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - lastEventAt) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)} min ago`;
}
