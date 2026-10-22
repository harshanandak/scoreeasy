// Day labels shared by Kit list rows (Home's Recent, History).
const DAY_MS = 864e5;

/** "Today", "Yesterday", a weekday inside the week, else "12 Oct". */
export function relativeDay(time, now = Date.now()) {
  if (time === null) return '';
  const startOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(now) - startOf(time)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(time).toLocaleDateString('en-GB', { weekday: 'short' });
  return new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
