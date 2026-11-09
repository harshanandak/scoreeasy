// What a cricket fixture card shows, worked out from the saved match exactly as the old hub did:
// the innings line per team (shared formatter), overs or balls faced, who won, and the result words.
// Presentation only: no points, NRR or tie-break maths lives here.
import { isAbandoned, ABANDONED_LABEL } from '../../../utils/matchOutcome';
import { ballsToOvers, getCricketFormat, getLimitedOversResult } from '../../../utils/cricketCalculations';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { cricketScorePair, formatCricketInnings } from '../../../utils/cricketScoreFormat';

/** Human-readable format name for a format object ("T20", "20 overs", "Custom"). */
export function getFormatLabel(format) {
  if (!format) return 'Cricket';
  const migrated = migrateCricketFormat(format);
  const preset = getCricketFormat(migrated.preset);
  if (preset) return preset.name;
  if (migrated.overs) return `${migrated.overs} overs`;
  return 'Custom';
}

const YET_TO_BAT = 'Yet to bat';

function oversDetail(score, useBalls) {
  return useBalls ? `${score.balls} balls` : `${ballsToOvers(score.balls)} ov`;
}

/**
 * @returns {{
 *   abandoned: boolean, complete: boolean, live: boolean,
 *   scores: [string|undefined, string|undefined], details: [string|undefined, string|undefined], wide: boolean,
 *   winner: 'team1'|'team2'|null, result: string
 * }}
 */
export function cricketFixtureView(match, fallbackFormat) {
  const complete = match.status === 'completed';
  const live = match.status === 'in-progress';
  const abandoned = isAbandoned(match);
  const isTest = Boolean(match.innings && match.innings.length > 0);
  const matchFormat = migrateCricketFormat(match.format || fallbackFormat);
  const useBalls = matchFormat.trackOvers === false;

  let scores = [undefined, undefined];
  let details = [undefined, undefined];
  if (isTest && (complete || live)) {
    scores = cricketScorePair(match).map((line) => (line === YET_TO_BAT ? undefined : line));
  } else if (complete && match.team1Score && match.team2Score) {
    scores = [match.team1Score, match.team2Score].map((score) => formatCricketInnings(score, { test: true }));
    details = [match.team1Score, match.team2Score].map((score) => oversDetail(score, useBalls));
  }

  let winner = null;
  let result = abandoned ? ABANDONED_LABEL : match.winDesc || '';
  if (complete && !abandoned) {
    if (match.winner) {
      if (match.winner === match.team1Id) winner = 'team1';
      else if (match.winner === match.team2Id) winner = 'team2';
      if (match.winner === 'draw') result = result || 'Match Drawn';
      if (match.winner === 'tie') result = result || 'Match Tied';
    } else if (match.team1Score && match.team2Score) {
      if (match.team1Score.runs > match.team2Score.runs) winner = 'team1';
      else if (match.team2Score.runs > match.team1Score.runs) winner = 'team2';
    }
    if (!result && match.team1Score && match.team2Score) result = getLimitedOversResult(match);
  }

  const wide = scores.some((score) => typeof score === 'string' && score.length > 8);
  return { abandoned, complete, live, scores, details, wide, winner, result: complete ? result : '' };
}
