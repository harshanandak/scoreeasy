// Uses the real claim/queue/notice code with a local fake server acknowledgement.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGuestMatchUploads } from '/src/hooks/useGuestMatchUploads';
import { attemptMatchSave, isSaveInFlight, pendingMatchSaves, PENDING_SAVES_CHANGED } from '/src/utils/pendingMatchSaves';
import { saveQuickMatch } from '/src/utils/storage';
import { KitTop } from '/src/designs/design1-mono/kit/KitParts';
import GuestUploadNotice from '/src/components/GuestUploadNotice';
import '/src/index.css';
import '/src/designs/design1-mono/mono.css';

// The disposable evidence origin owns these fixture ids. No auth or cloud connection.
for (const id of ['guest-demo-1', 'guest-demo-2']) {
  const clientMatchId = encodeURIComponent(`quick:football:${id}`);
  localStorage.removeItem(`se_guest_match_claim:${clientMatchId}`);
  for (const owner of ['Account X', 'Account Y']) localStorage.removeItem(`se_pending_match:${encodeURIComponent(owner)}:${clientMatchId}`);
  saveQuickMatch({ id, sport: 'football', team1: 'North FC', team2: 'South FC', score1: 2, score2: 1, winner: 'North FC', status: 'completed', completedAt: '2026-11-08T12:00:00Z' });
}
function Showcase() {
  const [ownerId, setOwner] = useState(null);
  const notice = useGuestMatchUploads({ ownerId, ready: Boolean(ownerId) });
  useEffect(() => {
    const drain = () => { if (ownerId) for (const record of pendingMatchSaves(ownerId)) {
      if (!isSaveInFlight(record)) void attemptMatchSave(record, async () => 'mock-server-ack');
    } };
    window.addEventListener(PENDING_SAVES_CHANGED, drain);
    drain();
    return () => window.removeEventListener(PENDING_SAVES_CHANGED, drain);
  }, [ownerId]);
  return <main className="mono-app kit-screen" style={{ maxWidth: 672, margin: 'auto' }}>
    <p style={{ fontSize: 12 }}>Evidence showcase · mock sign-in and server</p>
    <KitTop title="Your match history" />
    <section className="kit-card" style={{ padding: 20, marginTop: 20 }}>
      <h2>{ownerId ? `Signed in as ${ownerId}` : 'Scoring as a guest'}</h2>
      <p>Two finished matches are saved on this device.</p>
      <p>North FC 2–1 South FC · Football</p>
      <div className="kit-btnstack">
        <button className="se-ctl" onClick={() => setOwner('Account X')}>Sign in as Account X (mock)</button>
        <button className="se-ctl" onClick={() => setOwner('Account Y')}>Switch to Account Y (mock)</button>
        <button className="se-ctl" onClick={() => setOwner(null)}>Sign out</button>
      </div>
    </section>
    <GuestUploadNotice message={notice} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Showcase />);
