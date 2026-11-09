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
  try { localStorage.setItem(guestClaimKey(claim.clientMatchId), JSON.stringify(claim)); return true; }
  catch { return false; }
}
