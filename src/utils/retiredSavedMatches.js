import { getRetiredSportsList } from '../models/sportRegistry';
import { loadData } from './storage';
import { getCompletedAt, getTournamentMatches, isTournamentMatchCompleted } from './tournamentSync';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function teamName(teams, ref, fallback) {
  return teams.find((team) => team.id === ref)?.name
    || (typeof ref === 'number' ? teams[ref]?.name : ref)
    || fallback;
}

export function retiredScore(state, engine, format = state.format) {
  if (engine === 'sets') {
    const set = state.sets?.[state.currentSet ?? 0];
    if (format?.type === 'single') {
      return [state.vScore1 ?? state.score1 ?? set?.score1, state.vScore2 ?? state.score2 ?? set?.score2];
    }
    return [set?.score1 ?? state.vScore1 ?? state.score1, set?.score2 ?? state.vScore2 ?? state.score2];
  }
  return [state.gScore1 ?? state.score1, state.gScore2 ?? state.score2];
}

export function savedScoreLabel(scores) {
  return scores.map((score) => score ?? '—').join(' - ');
}

function isCompleted(match, sport, format) {
  // Only completed sets may contribute to a result; a lead in an unfinished
  // persisted set is not a set won. No retired rules engine is mounted here.
  const sets = asArray(match.sets).filter((set) => set.completed);
  return Boolean(match.winner || match.completedAt || match.endedAt)
    || isTournamentMatchCompleted({ ...match, sets }, sport.engine, format);
}

function entryFor(sport, state, fields) {
  return {
    sport: sport.id,
    sportName: sport.name,
    retired: true,
    engine: sport.engine,
    persistedState: state,
    score: savedScoreLabel(retiredScore(state, sport.engine, fields.format)),
    date: state.updatedAt || getCompletedAt(state),
    ...fields,
  };
}

// Retained saves are an archive: never use loaders that expire drafts or
// migrate/write formats, and never attach a resumable entryPath.
export function loadRetiredSavedMatches() {
  const sharedQuick = asArray(loadData('se_quickmatches', []));
  return getRetiredSportsList().flatMap((sport) => {
    const entries = [];
    const draft = loadData(`se_quickmatch_draft_${sport.id}`, null);
    if (draft?.phase === 'scoring') {
      entries.push(entryFor(sport, draft, {
        id: `retired-draft-${sport.id}`, source: 'quick', isUnfinished: true,
        team1: draft.team1Name || 'Team 1', team2: draft.team2Name || 'Team 2',
        format: draft.format,
      }));
    }
    for (const match of sharedQuick.filter((item) => item?.sport === sport.id)) {
      entries.push(entryFor(sport, { ...match, ...match.draftState }, {
        id: `quick-${match.id}`, source: 'quick',
        isUnfinished: !isCompleted(match, sport, match.format),
        team1: match.team1 || 'Team 1', team2: match.team2 || 'Team 2',
        format: match.format, winner: match.winner,
        date: getCompletedAt(match) || match.updatedAt,
      }));
    }
    for (const tournament of asArray(loadData(sport.storageKey, []))) {
      const teams = asArray(tournament?.teams);
      for (const match of getTournamentMatches(tournament)) {
        if (!match) continue;
        const team1Ref = match.team1Id ?? match.team1;
        const team2Ref = match.team2Id ?? match.team2;
        const team1 = teamName(teams, team1Ref, 'Team 1');
        const team2 = teamName(teams, team2Ref, 'Team 2');
        const winner = match.winner === undefined || match.winner === null
          ? null
          : match.winner === team1Ref ? team1 : match.winner === team2Ref ? team2 : match.winner;
        const knockoutFormat = asArray(tournament.knockoutMatches).includes(match) ? tournament.knockoutConfig?.format : null;
        const format = match.format || knockoutFormat || tournament.format;
        const completed = isCompleted(match, sport, format);
        entries.push(entryFor(sport, { ...match, ...match.draftState }, {
          id: `tour-${sport.id}-${tournament.id}-${match.id}`, source: 'tournament',
          tournamentId: tournament.id, matchId: match.id,
          tournamentName: tournament.name, team1, team2, winner, format,
          isUnfinished: !completed,
          date: getCompletedAt(match) || tournament.createdAt,
          ...(completed && sport.engine === 'sets' ? {
            score: `${match.setsWon1 ?? asArray(match.sets).filter((set) => set.score1 > set.score2).length} - ${match.setsWon2 ?? asArray(match.sets).filter((set) => set.score2 > set.score1).length}`,
          } : {}),
        }));
      }
    }
    return entries;
  });
}

export function retiredSavedHistoryPath(pathname) {
  const [sportId, kind, tournamentId, matchSegment, matchId] = pathname.split('/').filter(Boolean);
  const entries = loadRetiredSavedMatches().filter((entry) => entry.sport === sportId
    && (kind !== 'quick' || entry.source === 'quick')
    && (kind !== 'tournament' || (entry.source === 'tournament'
      && (!tournamentId || String(entry.tournamentId) === tournamentId)
      && (matchSegment !== 'match' || String(entry.matchId) === matchId))));
  if (!entries.length) return null;
  if (entries.length === 1) return `/history?saved=${encodeURIComponent(entries[0].id)}`;
  return `/history?sport=${encodeURIComponent(sportId)}`;
}
