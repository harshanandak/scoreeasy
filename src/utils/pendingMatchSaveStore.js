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
    const read = ownerId ? store.index('ownerId').getAll(ownerId) : store.getAll();
    read.onsuccess = () => complete(read.result);
  });
}

export function matchSaveFingerprint(value) {
  const serialized = JSON.stringify(value, (key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map(name => [name, entry[name]])) : entry);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < serialized.length; index += 1) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(serialized.charCodeAt(index))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function fallbackCompletionMatches(a, b) {
  if (!a || !b) return false;
  if (a.completionId !== b.completionId) return false;
  if (a.quickCompletionFingerprint && b.quickCompletionFingerprint
    && a.quickCompletionFingerprint !== b.quickCompletionFingerprint) return false;
  return payloadFingerprint(a) === payloadFingerprint(b);
}

function payloadFingerprint(record) {
  if (record.payloadFingerprint) return record.payloadFingerprint;
  // Quick payload dates are generated during normalization, not completion identity.
  return matchSaveFingerprint(record.tournamentMatch ? record.payload : { ...record.payload, date: undefined });
}

export function storePendingSaveFallback(key, record) {
  const fingerprint = payloadFingerprint(record);
  const compact = {
    ownerId: record.ownerId, clientMatchId: record.clientMatchId || record.payload.clientMatchId,
    completionId: record.completionId, payloadFingerprint: fingerprint, state: 'synced',
    syncedAt: record.syncedAt || Date.now(), storageBackend: 'indexedDB', storageFailed: false,
    ...(record.quickCompletionFingerprint ? { quickCompletionFingerprint: record.quickCompletionFingerprint } : {}),
  };
  const marker = record.state === 'synced' ? compact : record;
  return transaction('readwrite', (store, complete) => {
    const read = store.get(key);
    read.onsuccess = () => {
      const previous = read.result;
      // A stale tab cannot overwrite acknowledgement of the same completion.
      if (previous?.state === 'synced' && fallbackCompletionMatches(previous, record)) {
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
