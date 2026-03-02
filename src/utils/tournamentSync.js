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
  const fromId = teams.find((t) => t.id === id)?.name;
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
    if (set?.score1 > set?.score2) setsWon1++;
    else if (set?.score2 > set?.score1) setsWon2++;
  }
  return { setsWon1, setsWon2 };
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

export function isTournamentMatchCompleted(match, engine) {
  if (!match) return false;
  if (match.status === 'completed') return true;

  if (engine === 'custom-cricket') {
    if (Array.isArray(match.innings) && match.innings.length > 0) return true;
    return Boolean(match.team1Score || match.team2Score);
  }

  if (engine === 'sets') {
    if (Array.isArray(match.sets) && match.sets.some((s) => (s?.score1 ?? 0) > 0 || (s?.score2 ?? 0) > 0)) {
      return true;
    }
  }

  return typeof match.score1 === 'number' && typeof match.score2 === 'number';
}

export function getCompletedAt(match) {
  return match?.completedAt || match?.endedAt || match?.date || match?.savedAt || match?.createdAt || null;
}

export function getTournamentMatches(tournament) {
  return [...(tournament?.matches || []), ...(tournament?.knockoutMatches || [])];
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
  if (winner) {
    normalized.winner = winner;
  }
  if (match.matchRole) {
    normalized.matchRole = match.matchRole;
  }
  return normalized;
}
