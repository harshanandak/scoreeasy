import { normalizeMatchForConvex } from './normalizeMatch';

function normalizeToken(value) {
  if (typeof value !== 'string') return value;
  const lower = value.trim().toLowerCase();
  if (lower === 'draw') return 'Draw';
  if (lower === 'tie') return 'Tie';
  return value;
}

function getTeamNameFromId(teams, id, fallback) {
  if (id === null || id === undefined) return fallback || 'Unknown';
  const fromId = teams.find((team) => team.id === id)?.name;
  if (fromId) return fromId;
  if (typeof id === 'number') return teams[id]?.name || fallback || `Team ${id + 1}`;
  return fallback || String(id);
}

function resolveWinnerLabel(match, teams, team1Name, team2Name) {
  const winner = match?.winner;
  if (!winner) return undefined;

  if (winner === match.team1Id || winner === match.team1) return team1Name;
  if (winner === match.team2Id || winner === match.team2) return team2Name;
  if (winner === team1Name || winner === team2Name) return winner;

  return normalizeToken(winner);
}

function computeSetsWon(sets = []) {
  let setsWon1 = 0;
  let setsWon2 = 0;
  for (const set of sets) {
    if (set?.score1 > set?.score2) setsWon1 += 1;
    else if (set?.score2 > set?.score1) setsWon2 += 1;
  }
  return { setsWon1, setsWon2 };
}

function getSetsFormat(match, fallbackFormat) {
  return match?.format || fallbackFormat || null;
}

function isCompletedSetsMatch(match, format) {
  if (!Array.isArray(match?.sets) || match.sets.length === 0) {
    return false;
  }

  if (match.winner) {
    return true;
  }

  const { setsWon1, setsWon2 } = computeSetsWon(match.sets);
  const effectiveFormat = getSetsFormat(match, format);

  if (effectiveFormat?.type === 'single') {
    return match.sets.some((set) => set?.completed === true);
  }

  const setsToWin = Math.ceil((effectiveFormat?.sets || 3) / 2);
  return setsWon1 >= setsToWin || setsWon2 >= setsToWin;
}

function isCompletedCricketMatch(match) {
  if (match?.winner || match?.winDesc) {
    return true;
  }

  if (Array.isArray(match?.innings) && match.innings.length > 0) {
    return Boolean(match?.status === 'completed');
  }

  return Boolean(match?.team1Score && match?.team2Score && match?.status === 'completed');
}

function isCompletedGoalsMatch(match) {
  if (match?.winner) {
    return true;
  }

  return Boolean(
    match?.status === 'completed' &&
      typeof match?.score1 === 'number' &&
      typeof match?.score2 === 'number'
  );
}

function toTimestamp(dateValue) {
  if (typeof dateValue === 'number' && Number.isFinite(dateValue)) return dateValue;
  if (!dateValue) return Date.now();
  const parsed = Date.parse(dateValue);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function normalizeNonTeamWinner(winner) {
  return normalizeToken(winner);
}

export function isTournamentMatchCompleted(match, engine, format = null) {
  if (!match) return false;
  if (match.status === 'completed') return true;

  if (engine === 'custom-cricket') {
    return isCompletedCricketMatch(match);
  }

  if (engine === 'sets') {
    return isCompletedSetsMatch(match, format);
  }

  return isCompletedGoalsMatch(match);
}

export function getCompletedAt(match) {
  return match?.completedAt || match?.endedAt || match?.date || match?.savedAt || match?.createdAt || null;
}

export function getTournamentMatches(tournament) {
  return [...(tournament?.matches || []), ...(tournament?.knockoutMatches || [])];
}

export function getTournamentMatchClientId({ sportId, tournament, match }) {
  return `tournament:${sportId}:${tournament?.id ?? 'unknown'}:${match?.id ?? 'unknown'}`;
}

export function buildTournamentConvexPayload({ sportId, tournament, match }) {
  const teams = tournament?.teams || [];
  const team1Name = getTeamNameFromId(teams, match.team1Id ?? match.team1, match.team1);
  const team2Name = getTeamNameFromId(teams, match.team2Id ?? match.team2, match.team2);
  const winner = resolveWinnerLabel(match, teams, team1Name, team2Name);

  let resultShape = {
    team1: team1Name,
    team2: team2Name,
    winner,
    format: match.format || tournament?.format,
    elapsedSeconds: match.elapsedSeconds,
  };

  if (Array.isArray(match.innings) && match.innings.length > 0) {
    resultShape = {
      ...resultShape,
      innings: match.innings,
      winDesc: match.winDesc,
    };
  } else if (match.team1Score && match.team2Score) {
    resultShape = {
      ...resultShape,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
    };
  } else if (Array.isArray(match.sets) && match.sets.length > 0) {
    const { setsWon1, setsWon2 } = computeSetsWon(match.sets);
    resultShape = {
      ...resultShape,
      sets: match.sets,
      setsWon1: match.setsWon1 ?? setsWon1,
      setsWon2: match.setsWon2 ?? setsWon2,
    };
  } else if (typeof match.score1 === 'number' && typeof match.score2 === 'number') {
    resultShape = {
      ...resultShape,
      score1: match.score1,
      score2: match.score2,
    };
  } else {
    resultShape = {
      ...resultShape,
      score1: 0,
      score2: 0,
    };
  }

  const normalized = normalizeMatchForConvex(resultShape, sportId);
  normalized.date = toTimestamp(getCompletedAt(match));
  normalized.clientMatchId = getTournamentMatchClientId({ sportId, tournament, match });

  if (winner) {
    normalized.winner = winner;
  }
  if (match.matchRole) {
    normalized.matchRole = match.matchRole;
  }

  return normalized;
}
