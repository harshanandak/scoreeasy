const DATABASE = 'se-pending-match-saves';
const STORE = 'records';

function transaction(mode, action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    let abandoned = false;
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore(STORE);
      store.createIndex('ownerId', 'ownerId');
    };
    open.onerror = () => reject(open.error);
    open.onblocked = () => {
      abandoned = true;
      reject(new Error('Pending save storage is blocked'));
    };
    open.onsuccess = () => {
      const database = open.result;
      if (abandoned) { database.close(); return; }
      try {
        const tx = database.transaction(STORE, mode);
        let result;
        tx.oncomplete = () => { database.close(); resolve(result); };
        tx.onabort = () => { database.close(); reject(tx.error || new Error('Pending save storage aborted')); };
        action(tx.objectStore(STORE), (value) => { result = value; });
      } catch (error) {
        database.close();
        reject(error);
      }
    };
  });
}

export function loadPendingSaveFallback(ownerId) {
  return transaction('readonly', (store, complete) => {
    const read = store.index('ownerId').getAll(ownerId);
    read.onsuccess = () => complete(read.result);
  });
}

export async function fallbackCompletionMatches(a, b) {
  if (!a || !b) return false;
  if (a?.completionId !== b?.completionId) return false;
  return await payloadFingerprint(a) === await payloadFingerprint(b);
}

async function payloadFingerprint(record) {
  if (record.payloadFingerprint) return record.payloadFingerprint;
  const bytes = new TextEncoder().encode(JSON.stringify(record.payload));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function storePendingSaveFallback(key, record) {
  const fingerprint = await payloadFingerprint(record);
  const compact = {
    ownerId: record.ownerId, clientMatchId: record.clientMatchId || record.payload.clientMatchId,
    completionId: record.completionId, payloadFingerprint: fingerprint, state: 'synced',
    syncedAt: record.syncedAt || Date.now(), storageBackend: 'indexedDB', storageFailed: false,
  };
  const marker = record.state === 'synced' ? compact : record;
  return transaction('readwrite', (store, complete) => {
    const read = store.get(key);
    read.onsuccess = () => {
      const previous = read.result;
      // A stale tab cannot overwrite acknowledgement of the same completion.
      if (previous?.state === 'synced' && previous.completionId === record.completionId
        && (previous.payloadFingerprint === fingerprint || (previous.payload && JSON.stringify(previous.payload) === JSON.stringify(record.payload)))) {
        if (previous.payload) {
          store.put(compact, key);
          complete(compact);
          return;
        }
        complete(previous);
        return;
      }
      store.put(marker, key);
      complete(marker);
    };
  });
}
