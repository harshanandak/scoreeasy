import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSportTournaments, loadData } from '../../utils/storage';
import { getActiveSessions } from '../../utils/universalStorage';
import { getSportsList } from '../../models/sportRegistry';
import NewUserFlow from './NewUserFlow';
import MonoSportHome from './MonoSportHome';

const MONO = 'var(--font-mono)';
const PLAY_MODE_KEY = 'se_play_mode';
const QM_KEY = 'se_quickmatches';

/* Design-system tokens — single source of truth lives in index.css */
const t = {
  text: 'var(--foreground)',
  muted: 'var(--muted-foreground)',
  surface: 'var(--card)',
  border: 'var(--border)',
  green: 'var(--primary)',
  inverse: 'var(--primary-foreground)',
};

/* Does this device already hold any saved play data?
   Mirrors the dashboard's "new user" signal: matches, tournaments, or active sessions. */
function hasAnyPlayData() {
  if (getActiveSessions().length > 0) return true;
  if (loadData(QM_KEY, []).length > 0) return true;
  return getSportsList().some((sport) => loadSportTournaments(sport.storageKey).length > 0);
}

function readInitialMode() {
  const saved = globalThis.localStorage?.getItem(PLAY_MODE_KEY);
  if (saved === 'guided' || saved === 'browse') return saved;
  return hasAnyPlayData() ? 'browse' : 'guided';
}

const MODES = [
  { id: 'guided', label: 'Guided' },
  { id: 'browse', label: 'Browse' },
];

export default function MonoPlayHub() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(readInitialMode);

  useEffect(() => {
    globalThis.localStorage?.setItem(PLAY_MODE_KEY, mode);
  }, [mode]);

  return (
    <div>
      <div className="play-hub-toggle-shell">
        <div
          className="play-hub-toggle"
          role="tablist"
          aria-label="Play mode"
          style={{ display: 'inline-flex', gap: 4, border: `1px solid ${t.border}`, borderRadius: 'var(--radius)', background: t.surface, padding: 4 }}
        >
          {MODES.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMode(m.id)}
                style={{
                  border: 'none',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  cursor: 'pointer',
                  fontFamily: MONO,
                  fontSize: '0.625rem',
                  fontWeight: isActive ? 800 : 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  minHeight: 36,
                  padding: '8px 18px',
                  background: isActive ? t.green : 'transparent',
                  color: isActive ? t.inverse : t.muted,
                  transition: 'background 150ms ease, color 150ms ease',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'guided' ? <NewUserFlow navigate={navigate} /> : <MonoSportHome />}

      <style>{`
        .play-hub-toggle-shell {
          display: flex;
          justify-content: center;
          padding: 24px 16px 0;
        }
      `}</style>
    </div>
  );
}
