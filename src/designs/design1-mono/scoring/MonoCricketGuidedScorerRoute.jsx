import { useParams, useNavigate } from 'react-router-dom';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { getLimitedOversResult } from '../../../utils/cricketCalculations';
import { deriveInnings } from '../../../utils/cricketEngine';
import RouteRecoveryActions from '../components/RouteRecoveryActions';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer';

// C3/C4 Slice B — persistence bridge between the guided (delivery-sourced) scorer
// and the tournament localStorage store. Single-innings for this slice; two-innings
// orchestration + the innings break are C6b (out of scope here).

/**
 * PURE: fold a played engine innings into the legacy aggregate score shape the
 * tournament store expects. All-out honors lastManStands via the format
 * (mirrors getMaxWickets in cricketCalculations).
 * @param {object} innings - engine Innings (deliveries[] source of truth)
 * @param {object} fmt - migrateCricketFormat() output
 * @returns {{runs:number, wickets:number, balls:number, allOut:boolean}}
 */
export function mirrorAggregate(innings, fmt) {
  const der = deriveInnings(innings, fmt || {});
  const players = fmt?.players ?? fmt?.playersPerSide ?? innings?.playersPerSide ?? 11;
  const maxWickets = fmt?.lastManStands ? players : players - 1;
  return {
    runs: der.runs,
    wickets: der.wkts,
    balls: der.legalBalls,
    allOut: der.wkts >= maxWickets,
  };
}

// Resolve which team is batting for THIS single innings and the chase target (if
// this is innings 2). Innings 2 is inferred from an already-recorded first-innings
// aggregate; real innings orchestration lives in C6b.
function resolveBattingContext(match) {
  const battingOrder =
    Array.isArray(match.battingOrder) && match.battingOrder.length >= 2
      ? match.battingOrder
      : [match.team1Id, match.team2Id];
  const slotForTeam = (teamId) => (teamId === match.team1Id ? 'team1Score' : 'team2Score');

  const firstSlot = slotForTeam(battingOrder[0]);
  const firstScore = match[firstSlot];
  const isChase = !!(firstScore && firstScore.balls > 0);

  const battingTeamId = isChase ? battingOrder[1] : battingOrder[0];
  const battingSlot = slotForTeam(battingTeamId);
  const target = isChase ? (firstScore.runs || 0) + 1 : null;

  return { battingOrder, battingTeamId, battingSlot, isChase, target };
}

export default function MonoCricketGuidedScorerRoute() {
  const { sport, id, matchId } = useParams();
  const navigate = useNavigate();

  const sportConfig = getSportById(sport);
  const storageKey = sportConfig?.storageKey || 'se_cricket';
  const tournaments = loadSportTournaments(storageKey);
  const tournament = tournaments.find((t) => t.id === Number(id) || t.id === id);
  const match =
    tournament?.matches?.find((m) => m.id === matchId || m.id === Number(matchId)) ||
    (tournament?.knockoutMatches || []).find((m) => m.id === matchId || m.id === Number(matchId));

  if (!tournament || !match) {
    return (
      <RouteRecoveryActions
        eyebrow="Scorer recovery"
        title="Match not found"
        message="This scorer link does not match a saved tournament match on this device."
        sportId={sportConfig?.id}
      />
    );
  }

  const fmt = migrateCricketFormat(match.format || tournament?.knockoutConfig?.format || tournament?.format);
  const { battingSlot, target } = resolveBattingContext(match);

  // Opening lineup: use the match's named openers if present, else placeholders.
  // Real lineup selection is C6b — out of scope for this slice.
  const striker = match.striker ?? 'Batter 1';
  const nonStriker = match.nonStriker ?? 'Batter 2';
  const bowler = match.bowler ?? 'Bowler';

  const initialInnings = match.draftState?.guidedInnings ?? null;

  const navigateToTournament = () => navigate(`/${sport || 'cricket'}/tournament/${id}`);

  // Persist every committed ball: keep the raw engine innings in draftState AND
  // mirror the batting team's aggregate for legacy consumers (points table, cards).
  const handleStateChange = (innings) => {
    const updatedTournament = updateMatchInTournament(tournament, matchId, (m) => ({
      ...m,
      status: 'in-progress',
      [battingSlot]: mirrorAggregate(innings, fmt),
      draftState: {
        ...m.draftState,
        guidedInnings: innings,
        savedAt: new Date().toISOString(),
      },
    }));
    saveSportTournament(storageKey, updatedTournament);
  };

  // Innings/match end: write the final aggregate, resolve winner/winDesc, clear draft.
  // payload = { innings, ...deriveInnings, reason } from the scorer.
  const handleComplete = (payload) => {
    const finalInnings =
      payload?.innings ?? match.draftState?.guidedInnings ?? initialInnings ?? { deliveries: [] };
    const finalAgg = mirrorAggregate(finalInnings, fmt);

    const updatedTournament = updateMatchInTournament(tournament, matchId, (m) => {
      const completed = {
        ...m,
        status: 'completed',
        [battingSlot]: finalAgg,
        battingOrder:
          Array.isArray(m.battingOrder) && m.battingOrder.length >= 2
            ? m.battingOrder
            : [m.team1Id, m.team2Id],
        format: m.format,
      };
      let winner = null;
      if (completed.team1Score && completed.team2Score) {
        if (completed.team1Score.runs > completed.team2Score.runs) winner = m.team1Id;
        else if (completed.team2Score.runs > completed.team1Score.runs) winner = m.team2Id;
        else winner = 'tie';
      }
      return {
        ...completed,
        winner,
        winDesc: getLimitedOversResult(completed),
        draftState: undefined,
        completedAt: new Date().toISOString(),
      };
    });

    saveSportTournament(storageKey, updatedTournament);
    navigateToTournament();
  };

  return (
    <MonoCricketGuidedScorer
      format={fmt}
      striker={striker}
      nonStriker={nonStriker}
      bowler={bowler}
      target={target}
      initialInnings={initialInnings}
      onStateChange={handleStateChange}
      onComplete={handleComplete}
    />
  );
}
