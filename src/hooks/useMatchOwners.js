import { useEffect, useState } from 'react';
import { matchOwners, PENDING_SAVES_CHANGED } from '../utils/pendingMatchSaves';

export function useMatchOwners() {
  const [owners, setOwners] = useState(null);
  useEffect(() => {
    let revision = 0;
    const refresh = async () => {
      const current = ++revision;
      setOwners(null);
      try {
        const result = await matchOwners();
        if (current === revision) setOwners(result);
      } catch { /* Unknown ownership stays hidden; a later foreground/read can recover. */ }
    };
    const events = [PENDING_SAVES_CHANGED, 'storage', 'focus'];
    events.forEach(event => window.addEventListener(event, refresh));
    const foreground = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', foreground);
    refresh();
    return () => {
      revision += 1;
      events.forEach(event => window.removeEventListener(event, refresh));
      document.removeEventListener('visibilitychange', foreground);
    };
  }, []);
  return owners;
}
