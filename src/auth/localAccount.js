export const LAST_ACCOUNT = 'se_last_signed_in_account';

export function lastSignedInAccount() {
  try { return localStorage.getItem(LAST_ACCOUNT) || null; }
  catch { return null; }
}

export function rememberSignedInAccount(owner) {
  try {
    if (owner) localStorage.setItem(LAST_ACCOUNT, owner);
    else localStorage.removeItem(LAST_ACCOUNT);
  } catch { /* Account match writes still use their own namespace when storage is unavailable. */ }
}
