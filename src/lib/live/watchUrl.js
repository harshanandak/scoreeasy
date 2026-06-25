// Canonical public spectator URL for a live match share token.
//
// Always the production host (scoreeasy.app) so a link shared from a preview
// deploy or the native app still resolves to the real watch page (/live/:token,
// registered in design1-mono/index.jsx and bypassing the auth guard).

import { APP_LINK_HOST } from '../../mobile/deepLinks';

/**
 * @param {string} token share token from `live.create`
 * @returns {string} e.g. https://scoreeasy.app/live/ABCD...
 */
export function watchUrl(token) {
  return `https://${APP_LINK_HOST}/live/${token}`;
}
