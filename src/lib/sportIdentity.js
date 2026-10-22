// Sport identities (Kit, plan 2026-10-22 §3): each sport's colour is the identity everywhere a
// team colour isn't the hero: Play tiles, row badges, the history bars.
//
// The registry holds one source colour per sport (identityColour). It is never painted as is: it
// runs through the team-colour engine, so a tile's label clears 4.5:1 on every gradient stop, on
// the sheen and with the mark under it, exactly like a scorer key. Only engine output leaves here.
import { getSportById } from '../models/sportRegistry';
import { colourVars, deriveIdentityColour } from './teamColour';
import { sportMarkMaskUrl } from './sportMarks';

const cache = new Map();

/**
 * @param {string | undefined} sportId registry id
 * @returns {object | null} engine output for the sport's identity colour, null for unknown sports
 */
export function sportIdentity(sportId) {
  const sport = getSportById(sportId);
  if (!sport?.identityColour) return null;
  if (!cache.has(sport.id)) cache.set(sport.id, deriveIdentityColour(sport.identityColour));
  return cache.get(sport.id);
}

/**
 * CSS custom properties for a sport surface: --sport-{hi,core,lo,on,scrim,tint,line,motif} and
 * --sport-mark (the ball-and-action mask) when the sport has one.
 * @param {string | undefined} sportId registry id
 * @returns {Record<string, string>} empty for unknown sports
 */
export function sportIdentityVars(sportId) {
  const identity = sportIdentity(sportId);
  if (!identity) return {};
  const vars = colourVars(identity, '--sport');
  const mark = sportMarkMaskUrl(sportId);
  if (mark) vars['--sport-mark'] = mark;
  return vars;
}
