import { makeFormat } from './cricketEngine';

function freezeRules(format) {
  return Object.freeze({
    ...format,
    houseRules: Object.freeze({ ...format.houseRules }),
    powerplays: Object.freeze((format.powerplays || []).map(p => Object.freeze({ ...p }))),
  });
}

/** Resolve setup aliases once; the engine only consumes this versioned shape. */
export function resolveGuidedRules(setup = {}) {
  if (setup.rulesVersion != null) return freezeRules(setup);
  const format = makeFormat({
    name: setup.name ?? setup.preset ?? 'custom',
    oversPerInnings: setup.trackOvers === false ? null
      : setup.oversPerInnings !== undefined ? setup.oversPerInnings : setup.overs !== undefined ? setup.overs : 20,
    ballsPerOver: setup.ballsPerOver ?? 6,
    playersPerSide: setup.playersPerSide ?? setup.players ?? 11,
    maxOversPerBowler: setup.maxOversPerBowler ?? null,
    powerplays: setup.powerplays ?? setup.powerplay ?? [],
    freeHitOnNoBall: setup.freeHitOnNoBall ?? setup.freeHit ?? true,
    houseRules: {
      ...Object.fromEntries(['tennisBall', 'boxCricket', 'oneTipOneHand', 'noLBW', 'lastManStands',
        'singleBatterRuns', 'consecutiveOverAllowed'].filter(k => setup[k] !== undefined).map(k => [k, setup[k]])),
      ...setup.houseRules,
    },
  });
  return freezeRules({ ...format, rulesVersion: 1,
    maxLegalBalls: setup.trackOvers === false ? setup.maxBalls ?? null
      : format.oversPerInnings > 0 ? format.oversPerInnings * format.ballsPerOver : null });
}

/** In-flight saved matches retain the engine defaults/threshold they started with. */
export function guidedRulesForMatch(match, setup) {
  if (match.cricketRules) return resolveGuidedRules(match.cricketRules);
  const started = match.status === 'in-progress' || match.status === 'completed' || match.striker
    || (match.draftState?.phase && match.draftState.phase !== 'setup1')
    || [match.team1Score, match.team2Score].some(s => s?.balls > 0 || s?.runs > 0 || s?.wickets > 0);
  if (!started) return resolveGuidedRules(setup);
  const previous = makeFormat(setup);
  const players = match.draftState?.guidedInnings?.playersPerSide ?? previous.playersPerSide;
  return freezeRules({ ...previous, playersPerSide: players, rulesVersion: 0,
    maxLegalBalls: previous.oversPerInnings > 0 ? previous.oversPerInnings * previous.ballsPerOver : null });
}

export function guidedMaxWickets(format, innings) {
  const players = format.rulesVersion === 0 ? innings.playersPerSide || 11 : format.playersPerSide;
  return players - (format.rulesVersion !== 0 && format.houseRules?.lastManStands ? 0 : 1);
}

export function guidedCompletionReason(innings, derived, format) {
  if (innings.target != null && derived.runs >= innings.target) return 'chased';
  if (derived.wkts >= guidedMaxWickets(format, innings)) return 'allout';
  if (format.maxLegalBalls > 0 && derived.legalBalls >= format.maxLegalBalls) return 'overs';
  return null;
}
