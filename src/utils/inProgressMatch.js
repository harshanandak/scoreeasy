import { clearData, deleteQuickMatch, loadData, saveData } from './storage';
import { getSportById } from '../models/sportRegistry';

export function inProgressTimestamp(match) {
  const times = [match.updatedAt, match.savedAt, match.draftState?.savedAt, match.createdAt, match.date, match.startedAt]
    .filter(value => value !== undefined && value !== null)
    .map(value => new Date(value).getTime()).filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

export function inProgressSummary(match) {
  const state = match.draftState || match;
  const title = match.kind === 'tournament' ? match.name || 'Tournament'
    : `${match.team1Name || match.team1 || 'Team A'} v ${match.team2Name || match.team2 || 'Team B'}`;
  let score = '';
  let scoreParts = null;
  let detail = match.kind === 'tournament' ? 'Tournament' : 'Quick match';
  const scores = state.scores;
  if (match.sport === 'cricket' && scores) {
    const innings = state.innings || 1;
    const battingTeam = state.battingTeam || (innings === 2 ? 2 : 1);
    scoreParts = [1, 2].map(team => ({
      team: match[`team${team}Name`] || match[`team${team}`] || (team === 1 ? 'Team A' : 'Team B'),
      value: innings === 1 && team !== battingTeam ? 'yet to bat'
        : `${scores[`team${team}`]?.runs ?? 0}/${scores[`team${team}`]?.wickets ?? 0}`,
    }));
    score = scoreParts.map(part => `${part.team} ${part.value}`).join(' · ');
    detail = `Innings ${innings}${innings === 2 ? ` · Chasing ${(scores[battingTeam === 2 ? 'team1' : 'team2']?.runs ?? 0) + 1}` : ''}`;
  } else if (Array.isArray(state.innings) && state.innings.length) {
    const total = id => state.innings.filter(inn => inn.teamId === id).reduce((sum, inn) => sum + (inn.runs || 0), 0);
    score = `${total(match.team1Id || 'team1')}–${total(match.team2Id || 'team2')}`;
    detail = `Innings ${state.currentInningsIndex !== undefined ? state.currentInningsIndex + 1 : state.innings.length}`;
  } else if (match.team1Score) {
    score = `${match.team1Score.runs}/${match.team1Score.wickets}–${match.team2Score?.runs || 0}/${match.team2Score?.wickets || 0}`;
    detail = state.phase === 'break' ? 'Innings break' : `Innings ${state.innings || (['innings2', 'setup2'].includes(state.phase) ? 2 : 1)}`;
  } else if (Array.isArray(state.sets) && state.sets.length && (match.sport === 'tennis' || match.format?.type === 'best-of' || state.gScore1 === undefined && state.vScore1 === undefined)) {
    const index = state.currentSet ?? Math.max(0, state.sets.findIndex(set => !set.completed));
    const set = state.sets[index] || {};
    score = `${set.games1 ?? set.score1 ?? 0}–${set.games2 ?? set.score2 ?? 0}`;
    detail = `${getSportById(match.sport)?.config?.setLabel || 'Set'} ${index + 1}${match.sport === 'tennis' ? ' · Games' : ''}`;
  } else if (match.kind !== 'tournament') {
    const goals = getSportById(match.sport)?.engine === 'goals';
    score = `${(goals ? state.gScore1 : state.vScore1) ?? state.score1 ?? 0}–${(goals ? state.gScore2 : state.vScore2) ?? state.score2 ?? 0}`;
  }
  const timestamp = inProgressTimestamp(match);
  return { title, score, scoreParts, detail: match.tournamentName ? `${match.tournamentName} · ${detail === 'Quick match' ? 'Tournament match' : detail}` : detail, timestamp };
}

export function deleteInProgressMatch(match) {
  if (match.draftKey) return clearData(match.draftKey);
  if (match.kind === 'quick') return deleteQuickMatch(match.id);
  if (match.kind !== 'tournament-match') return false;
  const tournaments = loadData(match.storageKey, []);
  // Discard resets only this fixture, preserving the draw and the other matches.
  const reset = row => String(row.id) === String(match.id)
    ? { ...row, status: 'pending', draftState: undefined, sets: [], innings: [], score1: null, score2: null, team1Score: undefined, team2Score: undefined, winner: null, completedAt: undefined }
    : row;
  return saveData(match.storageKey, tournaments.map(tournament => String(tournament.id) !== String(match.tournamentId) ? tournament : {
    ...tournament, matches: tournament.matches?.map(reset), knockoutMatches: tournament.knockoutMatches?.map(reset),
  }));
}
