import { useEffect, useState } from 'react';
import { localMatchOwners, matchOwners, PENDING_SAVES_CHANGED } from '../utils/pendingMatchSaves';

export function useMatchOwners() {
  const [owners, setOwners] = useState(localMatchOwners);
  useEffect(() => {
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      setOwners(localMatchOwners());
      try {
        const result = await matchOwners();
        if (current === revision) setOwners(result);
      } catch { if (current === revision) setOwners(localMatchOwners()); }
    };
    const recover = () => { refresh().catch(() => setOwners(null)); };
    const events = [PENDING_SAVES_CHANGED, 'storage', 'focus'];
    events.forEach(event => window.addEventListener(event, recover));
    const foreground = () => { if (document.visibilityState === 'visible') recover(); };
    document.addEventListener('visibilitychange', foreground);
    recover();
    return () => {
      revision += 1;
      events.forEach(event => window.removeEventListener(event, recover));
      document.removeEventListener('visibilitychange', foreground);
    };
  }, []);
  return owners;
}
