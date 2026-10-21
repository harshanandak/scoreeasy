// App paths in one place, so a screen never hard-codes a sport or a route string.

/** Where every generic "start a match" lands: the Play hub, where the scorer picks the game. */
export const PLAY_HUB_PATH = '/play';

/** @param {string} sportId registry id, e.g. 'kabaddi' */
export const quickMatchPath = (sportId) => `/${sportId}/quick`;
