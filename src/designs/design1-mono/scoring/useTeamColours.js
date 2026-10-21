import { useMemo } from 'react';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { motifMaskUrl } from '../../../lib/courtMotifs';

/**
 * CSS custom properties for a team-colour board: the engine's --team-{a,b}-* tokens plus the
 * sport's court drawing for each team half (--sport-motif-{a,b}). Spread onto the arena grid.
 * Invalid colours fall back to the default pair inside the engine.
 * @param {string | undefined} colourA team A (team 1) colour
 * @param {string | undefined} colourB team B (team 2) colour
 * @param {string} sportId registry id
 * @returns {Record<string, string>} stable for the same inputs
 */
export function useTeamColours(colourA, colourB, sportId) {
  return useMemo(() => {
    const style = teamColourVars(deriveTeamColours(colourA, colourB));
    const motifA = motifMaskUrl(sportId, 'a');
    const motifB = motifMaskUrl(sportId, 'b');
    if (motifA) style['--sport-motif-a'] = motifA;
    if (motifB) style['--sport-motif-b'] = motifB;
    return style;
  }, [colourA, colourB, sportId]);
}
