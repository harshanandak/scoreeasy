// Shared app paths. So far this holds the Play hub and the quick-match pattern; most screens
// still use route string literals, which the routing clean-up moves here step by step.

/** Where every generic "start a match" lands: the Play hub, where the scorer picks the game. */
export const PLAY_HUB_PATH = '/play';

/** @param {string} sportId registry id, e.g. 'kabaddi' */
export const quickMatchPath = (sportId) => `/${sportId}/quick`;
