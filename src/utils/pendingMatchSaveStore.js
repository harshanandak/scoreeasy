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

export function storePendingSaveFallback(key, record) {
  return transaction('readwrite', (store, complete) => {
    const read = store.get(key);
    read.onsuccess = () => {
      const previous = read.result;
      // A stale tab cannot overwrite acknowledgement of the same completion.
      if (previous?.state === 'synced' && previous.completionId === record.completionId
        && (!record.completionId || JSON.stringify(previous.payload) === JSON.stringify(record.payload))) {
        complete(previous);
        return;
      }
      store.put(record, key);
      complete(record);
    };
  });
}
