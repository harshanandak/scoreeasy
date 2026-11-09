// Disposable, mocked account evidence. No Clerk session or Convex writes.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '/src/auth/AuthContext';
import { HistoryContent } from '/src/designs/design1-mono/MonoHistory';
import { getSportsList } from '/src/models/sportRegistry';
import '/src/index.css';
import '/src/designs/design1-mono/mono.css';

const state = new URLSearchParams(location.search).get('state') || 'guest';
const guest = state === 'guest';
Object.defineProperty(navigator, 'onLine', { configurable: true, value: state !== 'offline' });
const keys = ['se_quickmatches', 'gs_history', ...getSportsList().map(sport => sport.storageKey)];
for (const key of keys) {
  const backup = `history-evidence-backup:${key}`;
  if (sessionStorage.getItem(backup) === null) sessionStorage.setItem(backup, JSON.stringify(localStorage.getItem(key)));
  localStorage.setItem(key, '[]');
}
localStorage.setItem('se_quickmatches', JSON.stringify([{ id: 'demo-local', sport: 'football', team1: 'North FC', team2: 'South FC', score1: 2, score2: 1, winner: 'North FC', status: 'completed', completedAt: '2026-11-08T12:00:00Z' }]));
const cloudMatches = guest || state === 'loading' ? [] : [{ _id: 'demo-cloud', operatedBy: 'demo-user', clientMatchId: 'quick:volleyball:demo-cloud', sport: 'volleyball', team1: 'Falcons', team2: 'Hawks', score1: 3, score2: 1, winner: 'Falcons', date: Date.parse('2026-11-09T08:00:00Z') }];
createRoot(document.getElementById('root')).render(
  <AuthContext.Provider value={{ isAuthenticated: !guest, user: guest ? null : { _id: 'demo-user' } }}>
    <MemoryRouter><main className="mono-app" style={{ maxWidth: 672, margin: 'auto' }}>
      <p style={{ padding: '8px 16px', margin: 0, fontSize: 12 }}>Evidence showcase · {guest ? 'signed out' : 'mock account'} · {state}</p>
      <HistoryContent ownerId={guest ? null : 'demo-user'} userId={guest ? null : 'demo-user'} cloudMatches={cloudMatches} cloudStatus={state === 'loading' ? 'LoadingFirstPage' : 'Exhausted'} />
    </main></MemoryRouter>
  </AuthContext.Provider>,
);
window.restoreHistoryEvidence = () => keys.forEach(key => {
  const value = JSON.parse(sessionStorage.getItem(`history-evidence-backup:${key}`));
  if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
});
