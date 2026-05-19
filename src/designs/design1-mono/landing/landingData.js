export const sports = [
  'Volleyball', 'Cricket', 'Tennis', 'Football', 'Basketball', 'Badminton',
  'Hockey', 'Table Tennis', 'Golf', 'Pool', 'Chess', 'Rugby', 'Frisbee', 'Handball',
];

export const sportDetails = {
  Volleyball: { duration: '15-25 min', players: '2-12 players', rules: 'sets + rallies' },
  Cricket: { duration: 'T10/T20/Test', players: '2 teams', rules: 'overs + wickets' },
  Tennis: { duration: 'sets', players: '1v1 / 2v2', rules: 'deuce + advantage' },
  Football: { duration: 'halves', players: '2 teams', rules: 'goals + time' },
  Basketball: { duration: 'quarters', players: '2 teams', rules: 'period scoring' },
  Badminton: { duration: 'best of 3', players: '1v1 / 2v2', rules: 'rally points' },
  Hockey: { duration: 'periods', players: '2 teams', rules: 'goals + clock' },
  'Table Tennis': { duration: 'best of 5', players: '1v1 / 2v2', rules: '11-point games' },
  Golf: { duration: '9/18 holes', players: 'groups', rules: 'strokes + par' },
  Pool: { duration: 'racks', players: '1v1', rules: 'frames + wins' },
  Chess: { duration: 'timed', players: '1v1', rules: 'result + clock' },
  Rugby: { duration: 'halves', players: '2 teams', rules: 'tries + kicks' },
  Frisbee: { duration: 'points', players: '2 teams', rules: 'goal targets' },
  Handball: { duration: 'halves', players: '2 teams', rules: 'goals + time' },
};

export const features = [
  { title: 'Guest Scoring', desc: 'Start a match from the browser or app without signup, then save history locally.', tag: 'CORE', icon: 'Volleyball' },
  { title: 'Tournaments', desc: 'Round-robin and knockout brackets. Auto standings & point tables.', tag: 'ORGANIZE', icon: 'Chess' },
  { title: 'Live Scoring', desc: 'Real-time score entry with set tracking, deuce rules, and timers.', tag: 'TRACK', icon: 'Tennis' },
  { title: 'Statistics', desc: 'Win rates, match history, player performance across all sports.', tag: 'ANALYZE', icon: 'Basketball' },
  { title: 'Team Management', desc: 'Create teams, invite players, manage rosters across tournaments.', tag: 'MANAGE', icon: 'Football' },
  { title: '14 Sports', desc: 'Volleyball, cricket, tennis, football, and 10 more with sport-specific rules.', tag: 'PLAY', icon: 'Cricket' },
];

export const steps = [
  { num: '01', title: 'PICK SPORT', desc: 'Choose from 14 sports with pre-configured rules.', icon: 'Volleyball' },
  { num: '02', title: 'ADD TEAMS', desc: 'Name your teams or players. Set match format.', icon: 'Cricket' },
  { num: '03', title: 'SCORE LIVE', desc: 'Tap to score. Track sets, overs, or goals in real time.', icon: 'Tennis' },
];

export const tickerItems = ['14 SPORTS', 'NO SIGNUP START', 'LOCAL HISTORY', 'TOURNAMENTS', 'LIVE SCORING', 'FREE TO PLAY'];

export const proofStats = [
  { label: 'sports ready', value: '14', detail: 'Quick match and tournament paths for common game formats.' },
  { label: 'guest start', value: '0', detail: 'No account required before the first score tap.' },
  { label: 'local first', value: 'ON', detail: 'History and scoring continue when cloud auth is unavailable.' },
];

export const trustNotes = [
  'Interactive scoring preview uses real app sport states.',
  'Guest, offline, and sync paths are separated so scoring is never blocked by login.',
  'Mobile and Capacitor builds are checked before release PRs merge.',
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
