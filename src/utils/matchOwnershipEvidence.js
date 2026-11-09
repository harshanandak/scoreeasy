const PREFIX = 'se_match_owner:';
const keyFor = id => `${PREFIX}${encodeURIComponent(id)}`;
const guestKey = id => `se_guest_match_origin:${encodeURIComponent(id)}`;

export function revokeGuestMatch(id) {
  try {
    localStorage.removeItem(guestKey(id));
    return true;
  } catch { return false; }
}

export function rememberMatchOwner(clientMatchId, ownerId) {
  try {
    const previous = JSON.parse(localStorage.getItem(keyFor(clientMatchId)));
    if (previous?.ownerId && previous.ownerId !== ownerId) return false;
    localStorage.setItem(ownerId === null ? guestKey(clientMatchId) : keyFor(clientMatchId), JSON.stringify({ clientMatchId, ownerId }));
    return true;
  } catch { return false; }
}

export function localOwnerEvidence() {
  const records = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(PREFIX) || key?.startsWith('se_guest_match_origin:')) records.push(JSON.parse(localStorage.getItem(key)));
  }
  return records;
}
