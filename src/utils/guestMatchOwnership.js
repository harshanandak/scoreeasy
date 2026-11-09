const PREFIX = 'se_guest_match_claim:';
export const guestClaimKey = id => `${PREFIX}${encodeURIComponent(id)}`;

export function readGuestClaim(id) {
  try { return JSON.parse(localStorage.getItem(guestClaimKey(id))); }
  catch { return null; }
}

export function guestClaims(ownerId) {
  const claims = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const claim = JSON.parse(localStorage.getItem(key));
        if (claim.ownerId === ownerId) claims.push(claim);
      } catch { /* A damaged claim never authorizes an upload. */ }
    }
  } catch { /* Retry when device storage becomes readable. */ }
  return claims;
}

export function writeGuestClaim(claim) {
  try {
    const raw = localStorage.getItem(guestClaimKey(claim.clientMatchId));
    if (raw !== null && JSON.parse(raw)?.ownerId !== claim.ownerId) return false;
    localStorage.setItem(guestClaimKey(claim.clientMatchId), JSON.stringify(claim));
    return readGuestClaim(claim.clientMatchId)?.ownerId === claim.ownerId;
  }
  catch { return false; }
}

export async function acquireGuestClaim(claim) {
  if (globalThis.indexedDB) {
    const acquired = await new Promise((resolve, reject) => {
      const open = indexedDB.open('se-guest-match-claims', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('owners');
      open.onerror = () => reject(open.error);
      let blocked = false;
      open.onblocked = () => { blocked = true; reject(new Error('Guest claim storage is blocked')); };
      open.onsuccess = () => {
        const db = open.result;
        if (blocked) { db.close(); return; }
        try {
          const tx = db.transaction('owners', 'readwrite');
          const store = tx.objectStore('owners');
          const read = store.get(claim.clientMatchId);
          let granted = false;
          read.onsuccess = () => {
            granted = !read.result || read.result.ownerId === claim.ownerId;
            if (!read.result) store.add({ ownerId: claim.ownerId }, claim.clientMatchId);
          };
          tx.oncomplete = () => { db.close(); resolve(granted); };
          tx.onabort = () => { db.close(); reject(tx.error); };
        } catch (error) { db.close(); reject(error); }
      };
    });
    if (!acquired) return false;
  } else if (!navigator.locks?.request) return false;
  return writeGuestClaim(claim);
}
