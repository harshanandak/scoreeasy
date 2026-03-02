// Central registry for all 14 sports
// Each sport defines its engine type, scoring config, and UI settings

export const SPORT_REGISTRY = {
  // === SETS-BASED SPORTS (6) ===
  volleyball: {
    id: 'volleyball',
    name: 'Volleyball',
    icon: '🏐',
    engine: 'sets',
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

  pickleball: {
    id: 'pickleball',
    name: 'Pickleball',
    icon: '🏓',
    engine: 'sets',
    desc: 'Rally scoring, fastest growing',
    storageKey: 'se_pickleball',
    config: {
      pointsPerSet: 11,
      deciderPoints: 11,
      winBy: 2,
      setFormats: [
        { label: 'Single game', sets: 1, points: [9, 11, 15] },
        { label: 'Best of 3', sets: 3 },
      ],
      defaultSetFormat: 1, // Best of 3
      scoringModes: ['rally', 'side-out'],
      defaultScoringMode: 'rally',
      serviceRotation: 1, // Rally scoring, service changes every point
    },
    standingsColumns: ['P', 'W', 'L', 'GW', 'GL', 'PF', 'PA', '+/-', 'Pts'],
    features: [
      'Rally point scoring',
      'Best of 3 games to 11',
      'Win by 2 at deuce',
      'Fastest growing sport',
    ],
  },

  squash: {
    id: 'squash',
    name: 'Squash',
    icon: '🎾',
    engine: 'sets',
    desc: 'PAR scoring, best of 3/5',
    storageKey: 'se_squash',
    config: {
      pointsPerSet: 11,
      deciderPoints: 11,
      winBy: 2,
      setFormats: [
        { label: 'Best of 3', sets: 3 },
        { label: 'Best of 5', sets: 5 },
      ],
      defaultSetFormat: 0, // Best of 3
      serviceRotation: null,
    },
    standingsColumns: ['P', 'W', 'L', 'GW', 'GL', 'PF', 'PA', '+/-', 'Pts'],
    features: [
      'Point-a-rally scoring',
      'Best of 3 or 5 games',
      'Win by 2 at deuce',
      'Indoor court sport',
    ],
  },

  // === GOALS-BASED SPORTS (7) ===
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

  handball: {
    id: 'handball',
    name: 'Handball',
    icon: '🤾',
    engine: 'goals',
    desc: 'Fast-paced goals',
    storageKey: 'se_handball',
    config: {
      scoringUnit: 'goal',
      pointIncrement: 1,
      drawAllowed: true,
      winPoints: 2,
      drawPoints: 1,
      lossPoints: 0,
      quickButtons: null,
      // Real: 2×30 min = 60 min
      timePresets: [
        { label: '10 min', value: 600 },
        { label: '30 min (Half)', value: 1800 },
        { label: '60 min (Full)', value: 3600 },
      ],
      pointPresets: [10, 15, 20, 25],
    },
    standingsColumns: ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'],
    features: [
      'High-scoring matches',
      'Draws allowed',
      'Goal difference ranking',
      '2 halves format',
    ],
  },

  futsal: {
    id: 'futsal',
    name: 'Futsal',
    icon: '⚽',
    engine: 'goals',
    desc: 'Indoor football, 5v5',
    storageKey: 'se_futsal',
    config: {
      scoringUnit: 'goal',
      pointIncrement: 1,
      drawAllowed: true,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      quickButtons: null,
      // Real: 2×20 min = 40 min
      timePresets: [
        { label: '10 min', value: 600 },
        { label: '20 min (Half)', value: 1200 },
        { label: '40 min (Full)', value: 2400 },
      ],
      pointPresets: [5, 7, 10, 15],
    },
    standingsColumns: ['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'],
    features: [
      'Indoor 5v5',
      '3 points for a win',
      'Goal difference',
      'Fast-paced matches',
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

  rugby: {
    id: 'rugby',
    name: 'Rugby',
    icon: '🏉',
    engine: 'goals',
    desc: 'Try, conversion, penalty, drop',
    storageKey: 'se_rugby',
    config: {
      scoringUnit: 'point',
      pointIncrement: 1,
      drawAllowed: true,
      winPoints: 4,
      drawPoints: 2,
      lossPoints: 0,
      quickButtons: [
        { label: 'Penalty (3)', value: 3 },
        { label: 'Try (5)', value: 5 },
        { label: 'Try+Conv (7)', value: 7 },
        { label: 'Drop (3)', value: 3 },
      ],
      bonusPoints: true,
      // Real: 2×40 min = 80 min (Rugby Union)
      timePresets: [
        { label: '20 min', value: 1200 },
        { label: '40 min (Half)', value: 2400 },
        { label: '80 min (Full)', value: 4800 },
      ],
      pointPresets: [21, 30, 40, 50],
    },
    standingsColumns: ['P', 'W', 'D', 'L', 'PF', 'PA', '+/-', 'BP', 'Pts'],
    features: [
      'Try (5) + Conversion (2)',
      'Penalty goal (3)',
      'Bonus point system',
      'Drop goal (3)',
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
export const getSportsList = () => Object.values(SPORT_REGISTRY);

export const getSetsSports = () => getSportsList().filter((s) => s.engine === 'sets');

export const getGoalsSports = () => getSportsList().filter((s) => s.engine === 'goals');

export const getSportById = (id) => SPORT_REGISTRY[id] || null;

export const getSportsByCategory = () => ({
  'Racquet Sports': [
    SPORT_REGISTRY.badminton,
    SPORT_REGISTRY.tabletennis,
    SPORT_REGISTRY.tennis,
    SPORT_REGISTRY.pickleball,
    SPORT_REGISTRY.squash,
  ],
  'Team Sports': [
    SPORT_REGISTRY.football,
    SPORT_REGISTRY.basketball,
    SPORT_REGISTRY.hockey,
    SPORT_REGISTRY.handball,
    SPORT_REGISTRY.futsal,
  ],
  'Contact Sports': [SPORT_REGISTRY.kabaddi, SPORT_REGISTRY.rugby],
  'Net Sports': [SPORT_REGISTRY.volleyball],
  'Cricket': [SPORT_REGISTRY.cricket],
});
