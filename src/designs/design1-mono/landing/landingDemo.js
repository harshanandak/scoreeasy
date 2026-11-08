// The example match on the guest landing. Nothing here is a typed number: every score, set tally
// and status line is read from the same pure engines the scorers use (models/live/* for sets,
// tennis and goals; utils/cricketEngine; utils/kabaddiEngine), fed with a short scripted match.
// Sport rules live in those engines, so this file only scripts the play and formats the result.
import { appendPoint } from '../../../models/live/scoringEvents';
import { volleyballState } from '../../../models/live/volleyball';
import { tennisState, TENNIS_PRESETS } from '../../../models/live/tennis';
import { goalsState } from '../../../models/live/goals';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { applyDelivery, createInnings, deriveInnings, makeDelivery, makeFormat } from '../../../utils/cricketEngine';
import { applyRaid, createKabaddiState, startHalf, teamTotal } from '../../../utils/kabaddiEngine';
import { PRESETS } from '../../../lib/teamColour';

/** @typedef {{ name: string, score: string, meta?: string }} DemoTeam */
/** @typedef {{ sportId: string, colours: [string, string], teams: [DemoTeam, DemoTeam], status: string }} Demo */

/** The sports the landing can show: the registered ones, in focus order. */
export const DEMO_SPORT_IDS = getSportsList().map((sport) => sport.id);

// ---- scripting helpers ------------------------------------------------------------------

/** Team letters for one finished or running set: alternate to the lower score, then the leader. */
function rallies(a, b) {
  const both = Math.min(a, b);
  const out = [];
  for (let i = 0; i < both; i += 1) out.push('A', 'B');
  const leader = a >= b ? 'A' : 'B';
  for (let i = 0; i < Math.abs(a - b); i += 1) out.push(leader);
  return out;
}

/** Fold a list of scoring team letters into an engine event stream, one second apart. */
function pointEvents(teams) {
  return teams.reduce((events, team, i) => appendPoint(events, { team, value: 1, at: i }), []);
}

/** Scoring events for one side so its values sum to `total`, cycling through `values`. */
function sideScores(team, total, values, spacing) {
  const out = [];
  let left = total;
  for (let i = 0; left > 0; i += 1) {
    const value = Math.min(values[i % values.length], left);
    out.push({ team, value, at: Math.round((i + 1) * spacing) });
    left -= value;
  }
  return out;
}

/** Two sides' scoring (goals, baskets) merged into one clock-ordered event stream. */
function timedEvents(...sides) {
  return sides
    .flat()
    .sort((x, y) => x.at - y.at || (x.team < y.team ? -1 : 1))
    .reduce((events, input) => appendPoint(events, input), []);
}

const colourPair = (name) => PRESETS[name];

// ---- sets sports: volleyball, badminton, table tennis ------------------------------------

function setsDemo(sportId, { names, bestOf, sets, current, colours }) {
  const sport = getSportById(sportId);
  const unit = sport.config.setLabel || 'Set';
  const teams = [...sets.flatMap(([a, b]) => rallies(a, b)), ...rallies(...current)];
  const state = volleyballState(pointEvents(teams), {
    pointsPerSet: sport.config.pointsPerSet,
    deciderPoints: sport.config.deciderPoints,
    winBy: sport.config.winBy,
    bestOf,
  });
  return {
    sportId,
    colours,
    status: `${unit} ${state.currentSet} of ${bestOf}`,
    teams: [
      { name: names[0], score: String(state.pointsA), meta: `${unit}s won ${state.setsA}` },
      { name: names[1], score: String(state.pointsB), meta: `${unit}s won ${state.setsB}` },
    ],
  };
}

// ---- tennis -------------------------------------------------------------------------------

/** Point letters for a game won by `winner` to love, 15 or 30 (`loserPoints`). */
function tennisGame(winner, loserPoints = 0) {
  const loser = winner === 'A' ? 'B' : 'A';
  return [...Array.from({ length: loserPoints }, () => loser), ...Array.from({ length: 4 }, () => winner)];
}

function tennisDemo() {
  const gameWinners = ['A', 'B', 'A', 'A', 'B', 'A', 'B', 'A', 'A']; // set 1: 6-3 to A
  const secondSet = ['B', 'A', 'B', 'A', 'A']; // set 2 so far: A 3, B 2
  const points = [
    ...gameWinners.flatMap((winner, i) => tennisGame(winner, i % 3)),
    ...secondSet.flatMap((winner, i) => tennisGame(winner, i % 2)),
    'A', 'A', 'B', // the game in play: A 30, B 15
  ];
  const state = tennisState(pointEvents(points), TENNIS_PRESETS.standard);
  const games = (side) => [...state.sets.map((set) => set[side]), state.currentSet[side === 'a' ? 'gamesA' : 'gamesB']].join(' · ');
  return {
    sportId: 'tennis',
    colours: colourPair('Sky v Navy'),
    status: `Set ${state.sets.length + 1} · best of 3`,
    teams: [
      { name: 'Player 1', score: state.currentGame.labelA, meta: games('a') },
      { name: 'Player 2', score: state.currentGame.labelB, meta: games('b') },
    ],
  };
}

// ---- goals sports: football, basketball, hockey -------------------------------------------

function goalsDemo(sportId, { names, totals, values, spacing, periods, status, colours }) {
  const events = timedEvents(
    sideScores('A', totals[0], values[0], spacing[0]),
    sideScores('B', totals[1], values[1], spacing[1]),
  );
  const state = goalsState(events, { periods });
  const last = state.timeline.at(-1);
  return {
    sportId,
    colours,
    status: status({ last, period: periods[last?.periodIndex ?? 0] }),
    teams: [
      { name: names[0], score: String(state.totalA) },
      { name: names[1], score: String(state.totalB) },
    ],
  };
}

// ---- kabaddi ------------------------------------------------------------------------------

// One raid ruling per entry; raiding sides alternate, starting with team A.
const KABADDI_RAIDS = [
  ['touch', 2], ['touch', 1], ['tackled'], ['touch', 2], ['touch', 1], ['tackled'],
  ['touch', 3], ['touch', 1], ['touch', 2], ['tackled'], ['touch', 1], ['touch', 2],
];

function kabaddiDemo() {
  const colours = colourPair('Purple v Orange');
  const start = startHalf(createKabaddiState({ names: ['Tigers', 'Bulls'], colours }));
  const state = KABADDI_RAIDS.reduce((current, [type, count], i) => applyRaid(current, {
    id: `landing-raid-${i + 1}`,
    type,
    ...(count ? { count } : {}),
  }), start);
  const [a, b] = state.teams;
  return {
    sportId: 'kabaddi',
    colours,
    status: `Half ${state.half} · raid ${state.raidNumber}`,
    teams: [
      { name: a.name, score: String(teamTotal(a)), meta: `${state.mat[0].length} on the mat` },
      { name: b.name, score: String(teamTotal(b)), meta: `${state.mat[1].length} on the mat` },
    ],
  };
}

// ---- cricket ------------------------------------------------------------------------------

// Runs off the bat per ball for India's innings so far; `W` is a wicket (bowled).
const CRICKET_BALLS = [1, 0, 4, 2, 0, 1, 'W', 1, 1, 6, 0, 2, 4, 1, 0, 1, 'W', 2, 1, 0, 4, 1, 1, 0, 6, 2, 0, 1, 4, 1, 0, 2, 1];

function cricketDemo() {
  const format = makeFormat({ name: 'T20', oversPerInnings: 20 });
  let incoming = 3;
  const innings = CRICKET_BALLS.reduce((current, ball) => {
    const wicket = ball === 'W';
    const delivery = makeDelivery(wicket
      ? { wicket: { type: 'bowled', out: current.striker, completedRuns: 0, incoming: `p${incoming}` } }
      : { batsmanRuns: ball });
    if (wicket) incoming += 1;
    return applyDelivery(current, delivery, format);
  }, createInnings({ battingTeam: 'A', bowlingTeam: 'B' }));
  const totals = deriveInnings(innings, format);
  return {
    sportId: 'cricket',
    colours: colourPair('Red v Blue'),
    status: `T20 · ${totals.overs} of ${format.oversPerInnings} overs`,
    teams: [
      { name: 'India', score: `${totals.runs}/${totals.wkts}`, meta: `${totals.overs} overs` },
      { name: 'Australia', score: '–', meta: 'To bat' },
    ],
  };
}

// ---- public -------------------------------------------------------------------------------

const BUILDERS = {
  cricket: cricketDemo,
  kabaddi: kabaddiDemo,
  volleyball: () => setsDemo('volleyball', {
    names: ['Eagles', 'Hawks'], bestOf: 5, sets: [[25, 21], [23, 25]], current: [18, 16], colours: colourPair('Red v Blue'),
  }),
  badminton: () => setsDemo('badminton', {
    names: ['Chen', 'Lee'], bestOf: 3, sets: [[21, 18]], current: [15, 12], colours: colourPair('Purple v Orange'),
  }),
  football: () => goalsDemo('football', {
    names: ['City', 'United'],
    totals: [2, 1],
    values: [[1], [1]],
    spacing: [1900, 3000],
    periods: [{ label: '1st half', durationSec: 2700 }, { label: '2nd half', durationSec: 2700 }],
    status: ({ last, period }) => `${last?.minute ?? 0}' · ${period?.label ?? ''}`,
    colours: colourPair('Sky v Navy'),
  }),
  basketball: () => goalsDemo('basketball', {
    names: ['Lakers', 'Celtics'],
    totals: [78, 72],
    values: [[2, 3, 2, 2, 1], [2, 2, 3, 2, 1]],
    spacing: [42, 44],
    periods: ['Q1', 'Q2', 'Q3', 'Q4'].map((label) => ({ label, durationSec: 600 })),
    status: ({ period }) => `${period?.label ?? 'Q1'} of 4`,
    colours: colourPair('Yellow v White'),
  }),
  tennis: tennisDemo,
  tabletennis: () => setsDemo('tabletennis', {
    names: ['Mei', 'Sam'], bestOf: 5, sets: [[11, 7], [9, 11]], current: [8, 6], colours: colourPair('Black v Green'),
  }),
  hockey: () => goalsDemo('hockey', {
    names: ['Lions', 'Wolves'],
    totals: [3, 2],
    values: [[1], [1]],
    spacing: [900, 1100],
    periods: ['P1', 'P2', 'P3'].map((label) => ({ label, durationSec: 1200 })),
    status: ({ last, period }) => `${period?.label ?? 'P1'} of 3 · ${last?.minute ?? 0}'`,
    colours: colourPair('Red v Maroon'),
  }),
};

const cache = new Map();

/**
 * The example match for one sport, derived from that sport's engine.
 * @param {string} sportId registry id
 * @returns {Demo}
 */
export function buildDemo(sportId) {
  if (!cache.has(sportId)) {
    const build = BUILDERS[sportId];
    if (!build) throw new Error(`No landing demo for sport: ${sportId}`);
    cache.set(sportId, build());
  }
  return cache.get(sportId);
}
