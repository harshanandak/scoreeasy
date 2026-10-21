import { getSportsList } from '../../../models/sportRegistry';

// Landing sport cards = the registered sports, in focus order (src/models/sportFocus.js).
export const sports = getSportsList().map((sport) => sport.name);
const SPORT_COUNT = sports.length;

export const sportDetails = {
  Volleyball: { duration: '15-25 min', players: '2-12 players', rules: 'sets + rallies' },
  Cricket: { duration: 'T10/T20/Test', players: '2 teams', rules: 'overs + wickets' },
  Tennis: { duration: 'sets', players: '1v1 / 2v2', rules: 'deuce + advantage' },
  Football: { duration: 'halves', players: '2 teams', rules: 'goals + time' },
  Basketball: { duration: 'quarters', players: '2 teams', rules: 'period scoring' },
  Badminton: { duration: 'best of 3', players: '1v1 / 2v2', rules: 'rally points' },
  Hockey: { duration: 'periods', players: '2 teams', rules: 'goals + clock' },
  'Table Tennis': { duration: 'best of 5', players: '1v1 / 2v2', rules: '11-point games' },
  Kabaddi: { duration: 'raids', players: '7v7', rules: 'raids + tackles' },
};

export const features = [
  { title: 'Guest Scoring', desc: 'Start a match from the browser or app without signup, then save history locally.', tag: 'CORE', icon: 'Volleyball' },
  { title: 'Tournaments', desc: 'Round-robin and knockout brackets. Auto standings & point tables.', tag: 'ORGANIZE', icon: 'Chess' },
  { title: 'Live Scoring', desc: 'Real-time score entry with set tracking, deuce rules, and timers.', tag: 'TRACK', icon: 'Tennis' },
  { title: 'Statistics', desc: 'Win rates, match history, player performance across all sports.', tag: 'ANALYZE', icon: 'Basketball' },
  { title: 'Team Management', desc: 'Create teams, invite players, manage rosters across tournaments.', tag: 'MANAGE', icon: 'Football' },
  { title: `${SPORT_COUNT} Sports`, desc: `Cricket, kabaddi, volleyball, badminton, and ${SPORT_COUNT - 4} more with sport-specific rules.`, tag: 'PLAY', icon: 'Cricket' },
];

export const steps = [
  { num: '01', title: 'PICK SPORT', desc: `Choose from ${SPORT_COUNT} sports with pre-configured rules.`, icon: 'Volleyball' },
  { num: '02', title: 'ADD TEAMS', desc: 'Name your teams or players. Set match format.', icon: 'Cricket' },
  { num: '03', title: 'SCORE LIVE', desc: 'Tap to score. Track sets, overs, or goals in real time.', icon: 'Tennis' },
];

export const tickerItems = [`${SPORT_COUNT} SPORTS`, 'NO SIGNUP START', 'LOCAL HISTORY', 'TOURNAMENTS', 'LIVE SCORING', 'FREE TO PLAY'];

export const experienceStats = [
  { label: 'sports ready', value: String(SPORT_COUNT), detail: 'Cricket, kabaddi, volleyball, and the other ground and court games start from one picker.' },
  { label: 'guest mode', value: 'NOW', detail: 'No account required before the first score tap.' },
  { label: 'local first', value: 'ON', detail: 'History and scoring continue when cloud auth is unavailable.' },
];

export const trustNotes = [
  'Sport choices route into the same play setup used by the app.',
  'Guest, offline, and sync paths are separated so scoring is never blocked by login.',
  'Android, iOS, and web checks run before release PRs merge.',
];

export const heroScoreCards = [
  {
    sport: 'Volleyball', teamA: 'EAGLES', teamB: 'HAWKS',
    scoreA: '25', scoreB: '23', footer: 'SET 3 OF 5 \u2014 DEUCE',
  },
  {
    sport: 'Cricket', teamA: 'INDIA', teamB: 'AUSTRALIA',
    scoreA: '186', scoreB: '142', suffixA: '/4', suffixB: '/10',
    footer: '32.4 OVERS \u2014 2ND INNINGS',
  },
  {
    sport: 'Football', teamA: 'CITY', teamB: 'UNITED',
    scoreA: '2', scoreB: '1', footer: "73' \u2014 2ND HALF",
  },
  {
    sport: 'Tennis', teamA: 'PLAYER 1', teamB: 'PLAYER 2',
    scoreA: '6', scoreB: '4', footer: 'SET 2 \u2014 40-30',
  },
  {
    sport: 'Basketball', teamA: 'LAKERS', teamB: 'CELTICS',
    scoreA: '78', scoreB: '72', footer: 'Q3 \u2014 4:22 LEFT',
  },
  {
    sport: 'Badminton', teamA: 'CHEN', teamB: 'LEE',
    scoreA: '21', scoreB: '18', footer: 'GAME 2 OF 3',
  },
];
