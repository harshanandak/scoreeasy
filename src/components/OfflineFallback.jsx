import { useEffect, useState } from 'react';
import { loadData, loadSportTournaments } from '../utils/storage';
import { getSportsList } from '../models/sportRegistry';

const QUICK_KEY = 'se_quickmatches';

function readOfflineSnapshot() {
  const quick = loadData(QUICK_KEY, []);
  const tournamentCount = getSportsList().reduce((sum, sport) => {
    const tournaments = loadSportTournaments(sport.storageKey);
    return sum + tournaments.length;
  }, 0);

  return {
    quickCount: quick.length,
    tournamentCount,
    lastQuick: quick[0] || null,
  };
}

export default function OfflineFallback() {
  const [isOnline, setIsOnline] = useState(globalThis.navigator.onLine);
  const [snapshot, setSnapshot] = useState(() => readOfflineSnapshot());

  useEffect(() => {
    const refresh = () => {
      setIsOnline(globalThis.navigator.onLine);
      setSnapshot(readOfflineSnapshot());
    };

    globalThis.addEventListener('online', refresh);
    globalThis.addEventListener('offline', refresh);
    refresh();

    return () => {
      globalThis.removeEventListener('online', refresh);
      globalThis.removeEventListener('offline', refresh);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="mono-card"
      style={{
        margin: '8px auto 0',
        maxWidth: '640px',
        padding: '10px 12px',
        borderColor: '#f59e0b',
        color: '#92400e',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="text-xs uppercase tracking-widest" style={{ marginBottom: '4px' }}>
        Offline mode
      </p>
      <p className="text-sm" style={{ color: '#444' }}>
        Local data available: {snapshot.quickCount} quick matches and {snapshot.tournamentCount} tournaments.
        {snapshot.lastQuick ? ` Latest quick match: ${snapshot.lastQuick.team1} vs ${snapshot.lastQuick.team2}.` : ''}
      </p>
    </div>
  );
}
