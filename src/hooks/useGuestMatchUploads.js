import { useEffect, useState } from 'react';
import { claimGuestMatchSaves, consumeGuestUploadNotice } from '../utils/guestMatchUploads';
import { PENDING_SAVES_CHANGED } from '../utils/pendingMatchSaves';

export function useGuestMatchUploads(queue) {
  const ownerId = queue?.ownerId;
  const ready = queue?.ready;
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    setNotice(null);
    if (!ready || !ownerId) return;
    const acknowledged = () => {
      const count = consumeGuestUploadNotice(ownerId);
      if (count) setNotice(current => ({ ownerId, count: (current?.ownerId === ownerId ? current.count : 0) + count }));
    };
    const recover = () => { claimGuestMatchSaves(ownerId); acknowledged(); };
    const foreground = () => { if (document.visibilityState === 'visible') recover(); };
    window.addEventListener(PENDING_SAVES_CHANGED, acknowledged);
    window.addEventListener('storage', recover);
    window.addEventListener('online', recover);
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', foreground);
    recover();
    return () => {
      window.removeEventListener(PENDING_SAVES_CHANGED, acknowledged);
      window.removeEventListener('storage', recover);
      window.removeEventListener('online', recover);
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [ownerId, ready]);
  return ready && notice?.ownerId === ownerId ? `${notice.count} ${notice.count === 1 ? 'match' : 'matches'} saved to your account` : '';
}
