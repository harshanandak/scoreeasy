import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSportById } from '../../../models/sportRegistry';
import { loadSportTournaments, saveSportTournament } from '../../../utils/storage';
import { updateMatchInTournament } from '../../../utils/knockoutManager';
import { migrateCricketFormat } from '../../../utils/formatMigration';
import { getLimitedOversResult } from '../../../utils/cricketCalculations';
import { deriveInnings } from '../../../utils/cricketEngine';
import RouteRecoveryActions from '../components/RouteRecoveryActions';
import MonoCricketGuidedScorer from './MonoCricketGuidedScorer';
import MonoCricketInningsSetup from './MonoCricketInningsSetup';

// C6b — two-innings orchestrator for the Guided cricket scorer. A phase state
// machine drives an opening-lineup step, innings 1, an innings break (target +
// second-innings lineup), innings 2, and completion. The single-innings
// persistence bridge (aggregate mirror + guidedInnings draft) still runs inside
// each innings; the phase is persisted so a refresh resumes where it left off.

// ---- pure phase / target / winner helpers (unit-tested) ----

const PHASE_ORDER = ['setup1', 'innings1', 'break', 'innings2', 'done'];

/** PURE: the phase that follows `current` in the two-innings flow. */
export function nextPhase(current) {
  const i = PHASE_ORDER.indexOf(current);
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : 'done';
}

/** PURE: chase target from an innings-1 total (runs + 1). */
export function computeTarget(innings1Runs) {
  return (Number(innings1Runs) || 0) + 1;
}

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

/**
 * PURE: resolve winner + description for a completed limited-overs match from its
 * two aggregate scores. `winner` is a team id or 'tie'; `winDesc` comes from
 * getLimitedOversResult (won by runs when defending, by wickets when chasing).
 * @param {object} match - { team1Id, team2Id, team1Score, team2Score, battingOrder?, format? }
 * @returns {{winner: (string|null), winDesc: string}}
 */
export function resolveWinner(match) {
  const { team1Score, team2Score } = match;
  let winner = null;
  if (team1Score && team2Score) {
    if (team1Score.runs > team2Score.runs) winner = match.team1Id;
    else if (team2Score.runs > team1Score.runs) winner = match.team2Id;
    else winner = 'tie';
  }
  const winDesc = getLimitedOversResult({ ...match, winner, status: 'completed' });
  return { winner, winDesc };
}

// ---- helpers ----

const now = () => new Date().toISOString();

// Batting order for the match; defaults to [team1, team2] when unset.
function battingOrderOf(match) {
  return Array.isArray(match.battingOrder) && match.battingOrder.length >= 2
    ? match.battingOrder
    : [match.team1Id, match.team2Id];
}

// The legacy aggregate slot for a team id.
function slotForTeam(match, teamId) {
  return teamId === match.team1Id ? 'team1Score' : 'team2Score';
}

// Squad ([{id,name}]) for a team from its roster members; empty -> free-text.
function teamSquad(tournament, teamId) {
  const team = (tournament?.teams || []).find((t) => t.id === teamId);
  const members = Array.isArray(team?.members) ? team.members : [];
  return members
    .filter((m) => m && String(m).trim())
    .map((m) => ({ id: m, name: m }));
}

function teamName(tournament, teamId) {
  const team = (tournament?.teams || []).find((t) => t.id === teamId);
  return team?.name ?? teamId;
}

// Initial phase on mount: an explicit draft phase wins; else a legacy seeded
// match (named openers, no draft) skips straight into innings 1; else lineup.
function initialPhase(match) {
  if (match?.draftState?.phase) return match.draftState.phase;
  if (match?.striker && match?.nonStriker && match?.bowler) return 'innings1';
  return 'setup1';
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

  const [phase, setPhase] = useState(() => initialPhase(match));

  const navigateToTournament = () => navigate(`/${sport || 'cricket'}/tournament/${id}`);

  // A completed match is never re-scored — bounce back to the tournament.
  useEffect(() => {
    if (match && match.status === 'completed') navigateToTournament();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.status]);

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

  const fmt = migrateCricketFormat(
    match.format || tournament?.knockoutConfig?.format || tournament?.format
  );
  const battingOrder = battingOrderOf(match);
  const draft = match.draftState || {};
  const target = draft.target ?? null;

  // Which teams bat/bowl this phase (innings 2 swaps them).
  const secondInnings = phase === 'break' || phase === 'innings2';
  const battingTeamId = secondInnings ? battingOrder[1] : battingOrder[0];
  const bowlingTeamId = secondInnings ? battingOrder[0] : battingOrder[1];
  const battingSlot = slotForTeam(match, battingTeamId);

  const persist = (updater) =>
    saveSportTournament(storageKey, updateMatchInTournament(tournament, matchId, updater));

  // ---- transitions ----

  // Opening lineup confirmed -> begin innings 1.
  const onConfirmSetup1 = ({ striker, nonStriker, bowler }) => {
    persist((m) => ({
      ...m,
      status: 'in-progress',
      battingOrder,
      draftState: {
        ...m.draftState,
        phase: 'innings1',
        openers1: { striker, nonStriker, bowler },
        guidedInnings: null,
        savedAt: now(),
      },
    }));
    setPhase('innings1');
  };

  // Innings 2 lineup confirmed -> begin the chase.
  const onConfirmSetup2 = ({ striker, nonStriker, bowler }) => {
    persist((m) => ({
      ...m,
      status: 'in-progress',
      draftState: {
        ...m.draftState,
        phase: 'innings2',
        openers2: { striker, nonStriker, bowler },
        guidedInnings: null,
        savedAt: now(),
      },
    }));
    setPhase('innings2');
  };

  // Live persistence for the current innings: mirror the batting aggregate and
  // keep the raw engine innings in the draft (single-innings bridge, per phase).
  const handleStateChange = (innings) => {
    persist((m) => ({
      ...m,
      status: 'in-progress',
      [battingSlot]: mirrorAggregate(innings, fmt),
      draftState: {
        ...m.draftState,
        phase,
        guidedInnings: innings,
        savedAt: now(),
      },
    }));
  };

  // Innings 1 ended -> freeze its aggregate, set the target, go to the break.
  const handleComplete1 = (payload) => {
    const finalInnings = payload?.innings ?? draft.guidedInnings ?? { deliveries: [] };
    const agg = mirrorAggregate(finalInnings, fmt);
    const nextTarget = computeTarget(agg.runs);
    persist((m) => ({
      ...m,
      status: 'in-progress',
      battingOrder,
      [slotForTeam(m, battingOrder[0])]: agg,
      draftState: {
        ...m.draftState,
        phase: 'break',
        innings1: finalInnings,
        guidedInnings: null,
        target: nextTarget,
        savedAt: now(),
      },
    }));
    setPhase('break');
  };

  // Innings 2 ended -> finalize the match, resolve winner, clear the draft.
  const handleComplete2 = (payload) => {
    const finalInnings = payload?.innings ?? draft.guidedInnings ?? { deliveries: [] };
    const agg = mirrorAggregate(finalInnings, fmt);
    const updated = updateMatchInTournament(tournament, matchId, (m) => {
      const completed = {
        ...m,
        status: 'completed',
        battingOrder,
        [slotForTeam(m, battingOrder[1])]: agg,
        format: m.format,
      };
      const { winner, winDesc } = resolveWinner(completed);
      return {
        ...completed,
        winner,
        winDesc,
        draftState: undefined,
        completedAt: now(),
      };
    });
    saveSportTournament(storageKey, updated);
    navigateToTournament();
  };

  // ---- render by phase ----

  if (phase === 'setup1') {
    return (
      <MonoCricketInningsSetup
        title="Opening lineup"
        subtitle={`${teamName(tournament, battingOrder[0])} to bat first`}
        battingSquad={teamSquad(tournament, battingOrder[0])}
        bowlingSquad={teamSquad(tournament, battingOrder[1])}
        onConfirm={onConfirmSetup1}
      />
    );
  }

  if (phase === 'break') {
    const chasingName = teamName(tournament, battingOrder[1]);
    return (
      <div className="mono-break-screen">
        <style>{BREAK_STYLES}</style>
        <div className="mono-break-shell">
          <div className="mono-break-banner" data-testid="innings-break">
            <span className="mono-break-tag">Innings break</span>
            <p className="mono-break-line">
              <b>{chasingName}</b> need <b className="mono-break-target">{target}</b> to win
            </p>
          </div>
        </div>
        <MonoCricketInningsSetup
          title="Innings 2 lineup"
          subtitle={`${chasingName} chasing ${target}`}
          battingSquad={teamSquad(tournament, battingOrder[1])}
          bowlingSquad={teamSquad(tournament, battingOrder[0])}
          onConfirm={onConfirmSetup2}
        />
      </div>
    );
  }

  if (phase === 'innings1' || phase === 'innings2') {
    const isInn2 = phase === 'innings2';
    const openers = isInn2
      ? draft.openers2 ?? {}
      : draft.openers1 ??
        (match.striker
          ? { striker: match.striker, nonStriker: match.nonStriker, bowler: match.bowler }
          : {});
    return (
      <MonoCricketGuidedScorer
        key={phase}
        format={fmt}
        striker={openers.striker ?? 'Batter 1'}
        nonStriker={openers.nonStriker ?? 'Batter 2'}
        bowler={openers.bowler ?? 'Bowler'}
        target={isInn2 ? target : null}
        initialInnings={draft.guidedInnings ?? null}
        squad={{
          batting: teamSquad(tournament, battingTeamId),
          bowling: teamSquad(tournament, bowlingTeamId),
        }}
        onStateChange={handleStateChange}
        onComplete={isInn2 ? handleComplete2 : handleComplete1}
      />
    );
  }

  // phase === 'done' (or unexpected): the completed-match effect navigates away.
  return null;
}

const BREAK_STYLES = `
.mono-break-screen { min-height: 100dvh; padding: 16px 14px 0; }
.mono-break-shell { max-width: 390px; margin: 0 auto; }
.mono-break-banner { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--se-color-line); border-radius: 14px; background: var(--se-color-ink); color: var(--se-color-inverse); padding: 16px 16px; }
.mono-break-tag { font-family: var(--se-font-mono); font-size: 0.625rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: color-mix(in oklch, var(--se-color-inverse) 62%, transparent); }
.mono-break-line { margin: 0; font-family: var(--se-font-sans); font-size: 1.0625rem; font-weight: 600; }
.mono-break-line b { font-weight: 800; }
.mono-break-target { color: var(--primary); font-family: var(--se-font-mono); }
`;
