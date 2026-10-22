// Central registry for the 9 registered sports
// Each sport defines its engine type, scoring config, and UI settings.
// Display order and tier grouping live in ./sportFocus.js
// (ICP plan: docs/plans/2026-07-20-icp-games/adjusted-plan.md §A).

import {
  LATER_GROUP_LABEL,
  LATER_SPORT_IDS,
  PRIORITY_GROUP_LABEL,
  PRIORITY_SPORT_IDS,
  SPORT_ORDER,
} from './sportFocus';

export const SPORT_REGISTRY = {
  // === SETS-BASED SPORTS (4) ===
  volleyball: {
    id: 'volleyball',
    name: 'Volleyball',
    icon: '🏐',
    engine: 'sets',
    teamColour: true, // Direction E team-colour board
    desc: 'Sets, rally scoring, deuce',
    storageKey: 'se_volleyball',
    config: {
      pointsPerSet: 25,
      deciderPoints: 15,
      winBy: 2,
      setFormats: [
        { label: 'Single set', sets: 1, points: [10, 15, 21, 25] },
        { label: 'Best of 3', sets: 3 },
        { label: 'Best of 5', sets: 5 },
      ],
      defaultSetFormat: 2, // Best of 5
      scoringModes: ['rally', 'side-out'],
      defaultScoringMode: 'rally',
      serviceRotation: null, // No auto service tracking for volleyball
    },
    standingsColumns: ['P', 'W', 'L', 'SW', 'SL', 'PF', 'PA', '+/-', 'Pts'],
    features: [
      'Rally point scoring',
      'First to 25 (15 in decider)',
      'Win by 2 at deuce',
      'Best of 3 or 5 sets',
    ],
  },

  badminton: {
    id: 'badminton',
    name: 'Badminton',
    icon: '🏸',
    engine: 'sets',
    desc: 'Rally points, best of 3',
    storageKey: 'se_badminton',
    config: {
      pointsPerSet: 21,
      deciderPoints: 21,
      winBy: 2,
      maxPoints: 30, // Cap at 30
      setFormats: [
        { label: 'Single game', sets: 1, points: [11, 15, 21] },
        { label: 'Best of 3', sets: 3 },
      ],
      defaultSetFormat: 1, // Best of 3
      serviceRotation: 1, // Service changes every point
    },
    standingsColumns: ['P', 'W', 'L', 'GW', 'GL', 'PF', 'PA', '+/-', 'Pts'],
    features: [
      'Rally point scoring',
      'Best of 3 games to 21',
      'Win by 2 (cap at 30)',
      'Auto service rotation',
    ],
  },

  tabletennis: {
    id: 'tabletennis',
    name: 'Table Tennis',
    icon: '🏓',
    engine: 'sets',
    desc: 'Best of 5/7, 11 points',
    storageKey: 'se_tabletennis',
    config: {
      pointsPerSet: 11,
      deciderPoints: 11,
      winBy: 2,
      setFormats: [
        { label: 'Single game', sets: 1, points: [7, 11, 21] },
        { label: 'Best of 5', sets: 5 },
        { label: 'Best of 7', sets: 7 },
      ],
      defaultSetFormat: 1, // Best of 5
      serviceRotation: 2, // Service changes every 2 points
    },
    standingsColumns: ['P', 'W', 'L', 'GW', 'GL', 'PF', 'PA', '+/-', 'Pts'],
    features: [
      'Best of 5 or 7 games',
      '11 points per game',
      'Win by 2 at deuce',
      'Service every 2 points',
    ],
  },

  tennis: {
    id: 'tennis',
    name: 'Tennis',
    icon: '🎾',
    engine: 'sets',
    desc: 'Sets, games, tiebreaks',
    storageKey: 'se_tennis',
    config: {
      pointsPerSet: 6, // Games to win a set
      deciderPoints: 6,
      winBy: 2,
      tiebreakAt: 6, // Tiebreak at 6-6
      tiebreakPoints: 7, // Tiebreak to 7
      setFormats: [
        { label: 'Single set', sets: 1, points: [4, 6] },
        { label: 'Best of 3', sets: 3 },
        { label: 'Best of 5', sets: 5 },
      ],
      defaultSetFormat: 1, // Best of 3
      scoringLabel: 'games', // Display "games" not "points"
      serviceRotation: null, // Manual service change in tennis
    },
    standingsColumns: ['P', 'W', 'L', 'SW', 'SL', 'GW', 'GL', '+/-', 'Pts'],
    features: [
      'Best of 3 or 5 sets',
      'Games to 6 per set',
      'Tiebreak at 6-6',
      'Singles or doubles',
    ],
  },

  // === GOALS-BASED SPORTS (4) ===
  football: {
    id: 'football',
    name: 'Football',
    icon: '⚽',
    engine: 'goals',
    desc: 'Goals, draws, goal difference',
    storageKey: 'se_football',
    config: {
      scoringUnit: 'goal',
      pointIncrement: 1,
      drawAllowed: true,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      quickButtons: null,
      // Real: 2×45 min = 90 min
      timePresets: [
        { label: '10 min', value: 600 },
        { label: '45 min (Half)', value: 2700 },
        { label: '90 min (Full)', value: 5400 },
      ],
      pointPresets: [3, 5, 7, 10],
    },
    standingsColumns: ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'],
    features: [
      '3 points for a win',
      'Draws allowed',
      'Goal difference ranking',
      'Tournament mode',
    ],
  },

  basketball: {
    id: 'basketball',
    name: 'Basketball',
    icon: '🏀',
    engine: 'goals',
    desc: 'Points, no draws',
    storageKey: 'se_basketball',
    config: {
      scoringUnit: 'point',
      pointIncrement: 1,
      drawAllowed: false,
      winPoints: 2,
      lossPoints: 0,
      quickButtons: [
        { label: '+1', value: 1 },
        { label: '+2', value: 2 },
        { label: '+3', value: 3 },
      ],
      // Real: 4×12 min (NBA) = 48 min, 4×10 min (FIBA) = 40 min
      timePresets: [
        { label: '10 min (Qtr)', value: 600 },
        { label: '24 min (Half)', value: 1440 },
        { label: '40 min (FIBA)', value: 2400 },
        { label: '48 min (NBA)', value: 2880 },
      ],
      pointPresets: [11, 15, 21, 30],
    },
    standingsColumns: ['P', 'W', 'L', 'PF', 'PA', '+/-', 'Pts'],
    features: [
      '1/2/3 point scoring',
      'No draws (OT)',
      'Point differential',
      'Quarter tracking',
    ],
  },

  hockey: {
    id: 'hockey',
    name: 'Hockey',
    icon: '🏑',
    engine: 'goals',
    desc: 'Goals, GD standings',
    storageKey: 'se_hockey',
    config: {
      scoringUnit: 'goal',
      pointIncrement: 1,
      drawAllowed: true,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      quickButtons: null,
      // Real: 4×15 min = 60 min
      timePresets: [
        { label: '15 min (Qtr)', value: 900 },
        { label: '30 min (Half)', value: 1800 },
        { label: '60 min (Full)', value: 3600 },
      ],
      pointPresets: [3, 5, 7, 10],
    },
    standingsColumns: ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'],
    features: [
      '3 points for a win',
      'Draws allowed',
      'Goal difference ranking',
      'Field hockey rules',
    ],
  },

  kabaddi: {
    id: 'kabaddi',
    name: 'Kabaddi',
    icon: '🤼',
    engine: 'goals',
    desc: 'Raids, tackles, all-out',
    storageKey: 'se_kabaddi',
    config: {
      scoringUnit: 'point',
      pointIncrement: 1,
      drawAllowed: true,
      winPoints: 2,
      lossPoints: 0,
      quickButtons: [
        { label: '+1', value: 1 },
        { label: 'Super Tackle (+2)', value: 2 },
        { label: 'All Out (+2)', value: 2 },
      ],
      maxPlayers: 7,
      // Real: 2×20 min = 40 min (Pro Kabaddi League)
      timePresets: [
        { label: '10 min', value: 600 },
        { label: '20 min (Half)', value: 1200 },
        { label: '40 min (Full)', value: 2400 },
      ],
      pointPresets: [20, 30, 40, 50],
    },
    standingsColumns: ['P', 'W', 'D', 'L', 'SF', 'SA', 'SD', 'Pts'],
    features: [
      'Raid & tackle points',
      'Super tackle bonus',
      'All-out bonus (2pts)',
      'Time-based (2x20 min)',
    ],
  },

  // === CUSTOM (1) ===
  cricket: {
    id: 'cricket',
    name: 'Cricket',
    icon: '🏏',
    engine: 'custom-cricket',
    desc: 'Overs, wickets, NRR',
    storageKey: 'se_cricket',
    config: {
      scoringUnit: 'run',
      pointIncrement: 1,
      drawAllowed: false,
      winPoints: 2,
      lossPoints: 0,
      quickButtons: [
        { label: '0', value: 0 },
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
        { label: '4', value: 4 },
        { label: '6', value: 6 },
        { label: 'W', value: 0, isWicket: true },
      ],
    },
    standingsColumns: ['P', 'W', 'L', 'NR', 'NRR', 'Pts'],
    features: [
      'T20, T10, ODI, Test, Gully formats',
      'Powerplay & free-hit indicators',
      'Ball-by-ball scoring',
      'NRR points table',
      'Declaration & follow-on (Test)',
    ],
  },
};

// Helper functions

const orderIndex = (id) => {
  const index = SPORT_ORDER.indexOf(id);
  return index === -1 ? SPORT_ORDER.length : index;
};

const pickRegistered = (ids) => ids.map((id) => SPORT_REGISTRY[id]).filter(Boolean);

/** Every registered sport in focus order (sportFocus.js) — what all pickers show. */
export const getSportsList = () =>
  Object.values(SPORT_REGISTRY).sort((a, b) => orderIndex(a.id) - orderIndex(b.id));

export const getSetsSports = () => getSportsList().filter((s) => s.engine === 'sets');

export const getGoalsSports = () => getSportsList().filter((s) => s.engine === 'goals');

export const getSportById = (id) =>
  (typeof id === 'string' && Object.prototype.hasOwnProperty.call(SPORT_REGISTRY, id) ? SPORT_REGISTRY[id] : null);

// Direction E team colour is rolled out one sport at a time: a sport opts in with
// `teamColour: true` on its own registry entry, and its boards switch to the team-colour arena.
export const isTeamColourSport = (id, registry = SPORT_REGISTRY) =>
  Object.prototype.hasOwnProperty.call(registry, id) && registry[id].teamColour === true;

/** Pickers group by focus tier: Tier-0 ("Popular") first, then the kept-later sports. */
export const getSportsByCategory = () => ({
  [PRIORITY_GROUP_LABEL]: pickRegistered(PRIORITY_SPORT_IDS),
  [LATER_GROUP_LABEL]: pickRegistered(LATER_SPORT_IDS),
});
