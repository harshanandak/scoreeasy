import { useEffect, useState } from 'react';
import { claimGuestMatchSaves, consumeGuestUploadNotice, unuploadedGuestTournamentResults } from '../utils/guestMatchUploads';
import { PENDING_SAVES_CHANGED } from '../utils/pendingMatchSaves';

export function useGuestMatchUploads(queue) {
  const ownerId = queue?.ownerId;
  const ready = queue?.ready;
  const [notice, setNotice] = useState(null);
  const [skipped, setSkipped] = useState(null);
  useEffect(() => {
    setNotice(null);
    if (!ready || !ownerId) return;
    let disposed = false;
    const acknowledged = () => {
      const count = consumeGuestUploadNotice(ownerId);
      if (count) setNotice(current => ({ ownerId, count: (current?.ownerId === ownerId ? current.count : 0) + count }));
    };
    const recover = async () => {
      await claimGuestMatchSaves(ownerId);
      if (disposed) return;
      setSkipped({ ownerId, labels: unuploadedGuestTournamentResults() });
      acknowledged();
    };
    const foreground = () => { if (document.visibilityState === 'visible') recover(); };
    window.addEventListener(PENDING_SAVES_CHANGED, acknowledged);
    window.addEventListener('storage', recover);
    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', foreground);
    recover();
    return () => {
      disposed = true;
      window.removeEventListener(PENDING_SAVES_CHANGED, acknowledged);
      window.removeEventListener('storage', recover);
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [ownerId, ready]);
  if (!ready) return '';
  return [notice?.ownerId === ownerId ? `${notice.count} ${notice.count === 1 ? 'match' : 'matches'} saved to your account` : '',
    skipped?.ownerId === ownerId && skipped.labels.length ? `Not uploaded (no unique match ID): ${skipped.labels.join(', ')}. These results remain on this device.` : ''].filter(Boolean).join('. ');
}
