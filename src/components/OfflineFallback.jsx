import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { loadData, loadSportTournaments } from '../utils/storage';
import { getSportsList } from '../models/sportRegistry';

const QUICK_KEY = 'se_quickmatches';

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

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

export default function OfflineFallback({ onNavigate = null }) {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(globalThis.navigator.onLine);
  const [snapshot, setSnapshot] = useState(() => readOfflineSnapshot());

  const handleNavigate = (path) => {
    if (onNavigate) {
      onNavigate(path);
      return;
    }

    navigate(path);
  };

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
        padding: '12px',
        borderColor: '#f59e0b',
        color: '#92400e',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="text-xs uppercase tracking-widest" style={{ marginBottom: '4px' }}>
        Offline mode
      </p>
      <p className="text-sm" style={{ color: '#444', marginBottom: '10px' }}>
        Scoring stays available locally. Cloud sync and sign-in will resume when the connection is back.
        {' '}Saved on this device: {snapshot.quickCount} quick {pluralize(snapshot.quickCount, 'match', 'matches')} and {snapshot.tournamentCount} {pluralize(snapshot.tournamentCount, 'tournament', 'tournaments')}.
        {snapshot.lastQuick ? ` Latest quick match: ${snapshot.lastQuick.team1} vs ${snapshot.lastQuick.team2}.` : ''}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="mono-btn-primary" style={{ minHeight: 40, padding: '8px 12px' }} onClick={() => handleNavigate('/volleyball/quick')}>
          Start quick match
        </button>
        <button type="button" className="mono-btn" style={{ minHeight: 40, padding: '8px 12px' }} onClick={() => handleNavigate('/history')}>
          View saved matches
        </button>
      </div>
    </div>
  );
}

OfflineFallback.propTypes = {
  onNavigate: PropTypes.func,
};
