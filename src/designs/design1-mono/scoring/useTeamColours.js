import { useMemo } from 'react';
import { deriveTeamColours, teamColourVars } from '../../../lib/teamColour';
import { motifMaskUrl } from '../../../lib/courtMotifs';
import { sportMarkMaskUrl } from '../../../lib/sportMarks';

/**
 * CSS custom properties for a team-colour board: the engine's --team-{a,b}-* tokens, the sport's
 * court drawing for each team half (--sport-motif-{a,b}, kept for the spectator page) and the
 * sport's ball-and-action mark (--sport-mark, the scorer's "show the game" silhouette).
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
    const mark = sportMarkMaskUrl(sportId);
    if (motifA) style['--sport-motif-a'] = motifA;
    if (motifB) style['--sport-motif-b'] = motifB;
    if (mark) style['--sport-mark'] = mark;
    return style;
  }, [colourA, colourB, sportId]);
}
