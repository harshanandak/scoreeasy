// The example match on the guest landing. Nothing here is a typed number: every score, set tally
// and status line is read from the same pure engines the scorers use (models/live/* for sets,
// tennis and goals; utils/cricketEngine; utils/kabaddiEngine), fed with a short scripted match.
// Sport rules live in those engines, so this file only scripts the play and formats the result.
import { appendPoint } from '../../../models/live/scoringEvents';
import { volleyballState } from '../../../models/live/volleyball';
import { tennisState, TENNIS_PRESETS } from '../../../models/live/tennis';
import { goalsState } from '../../../models/live/goals';
import { getSportById, getSportsList } from '../../../models/sportRegistry';
import { applyDelivery, createInnings, deriveChase, deriveInnings, makeDelivery, makeFormat } from '../../../utils/cricketEngine';
import { applyRaid, createKabaddiState, startHalf, teamTotal } from '../../../utils/kabaddiEngine';
import { PRESETS } from '../../../lib/teamColour';

/** One cell of a team's row: a set, period or point category. `won` marks a set the side took,
 *  `current` the set in play. */
/** @typedef {{ value: string, won?: boolean, current?: boolean }} DemoCell */
/** @typedef {{ name: string, score: string, meta?: string, cells?: DemoCell[], pips?: { on: number, total: number } }} DemoTeam */
/** `columns` heads each team's `cells`; `live` is the side serving, batting or raiding (an index into
 *  `teams`) and `liveLabel` says which; `callout` is a set, match or break point the engine reports;
 *  `foot` is a one-line situation (the chase in cricket). All read from the sport's engine.
 *  @typedef {{ sportId: string, kind: 'sets'|'tennis'|'goals'|'kabaddi'|'cricket', colours: [string, string],
 *    teams: [DemoTeam, DemoTeam], status: string, columns?: string[], live?: 0|1, liveLabel?: string,
 *    callout?: string, foot?: string }} Demo */

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

const SIDE_INDEX = { A: 0, B: 1 };
const POINT_STATE_LABELS = { setPoint: 'Set point', matchPoint: 'Match point' };

// ---- sets sports: volleyball, badminton, table tennis ------------------------------------

// `serves` appends the engine's own serve_change event for the side that won the last rally, the
// rally-scoring rule of volleyball and badminton. Table tennis alternates serve every two points,
// so it passes nothing and the card shows no server.
function setsDemo(sportId, { names, bestOf, sets, current, colours, serves = false }) {
  const sport = getSportById(sportId);
  const unit = sport.config.setLabel || 'Set';
  const letters = [...sets.flatMap(([a, b]) => rallies(a, b)), ...rallies(...current)];
  const points = pointEvents(letters);
  const lastScorer = letters.at(-1);
  const events = serves
    ? [...points, { seq: points.length + 1, type: 'serve_change', team: lastScorer, servingAfter: lastScorer, at: points.length }]
    : points;
  const state = volleyballState(events, {
    pointsPerSet: sport.config.pointsPerSet,
    deciderPoints: sport.config.deciderPoints,
    winBy: sport.config.winBy,
    bestOf,
  });
  const cells = (own, other) => state.completedSets.map((set) => ({ value: String(set[own]), won: set[own] > set[other] }));
  return {
    sportId,
    kind: 'sets',
    colours,
    status: `${unit} ${state.currentSet} of ${bestOf}`,
    columns: state.completedSets.map((_, i) => `${unit.charAt(0)}${i + 1}`),
    live: serves ? SIDE_INDEX[state.servingTeam] : undefined,
    liveLabel: 'Serving',
    callout: POINT_STATE_LABELS[state.pointState],
    teams: [
      { name: names[0], score: String(state.pointsA), meta: `${unit}s won ${state.setsA}`, cells: cells('a', 'b') },
      { name: names[1], score: String(state.pointsB), meta: `${unit}s won ${state.setsB}`, cells: cells('b', 'a') },
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
  const cells = (own, other, gamesKey) => [
    ...state.sets.map((set) => ({ value: String(set[own]), won: set[own] > set[other] })),
    { value: String(state.currentSet[gamesKey]), current: true },
  ];
  let callout;
  if (state.isMatchPoint) callout = 'Match point';
  else if (state.isSetPoint) callout = 'Set point';
  else if (state.isBreakPoint) callout = 'Break point';
  return {
    sportId: 'tennis',
    kind: 'tennis',
    colours: colourPair('Sky v Navy'),
    status: `Set ${state.sets.length + 1} · best of 3`,
    columns: Array.from({ length: state.sets.length + 1 }, (_, i) => `S${i + 1}`),
    live: SIDE_INDEX[state.server],
    liveLabel: 'Serving',
    callout,
    teams: [
      { name: 'Player 1', score: state.currentGame.labelA, meta: games('a'), cells: cells('a', 'b', 'gamesA') },
      { name: 'Player 2', score: state.currentGame.labelB, meta: games('b'), cells: cells('b', 'a', 'gamesB') },
    ],
  };
}

// ---- goals sports: football, basketball, hockey -------------------------------------------

function goalsDemo(sportId, { names, totals, values, spacing, periods, status, colours, shortLabels }) {
  const events = timedEvents(
    sideScores('A', totals[0], values[0], spacing[0]),
    sideScores('B', totals[1], values[1], spacing[1]),
  );
  const state = goalsState(events, { periods });
  const last = state.timeline.at(-1);
  // The engine's line score up to the period in play: the classic periods-by-side grid.
  const played = state.lineScore.periods.slice(0, (last?.periodIndex ?? 0) + 1);
  return {
    sportId,
    kind: 'goals',
    colours,
    status: status({ last, period: periods[last?.periodIndex ?? 0] }),
    columns: played.map((period, i) => shortLabels?.[i] ?? period.label),
    teams: [
      { name: names[0], score: String(state.totalA), cells: played.map((period) => ({ value: String(period.a) })) },
      { name: names[1], score: String(state.totalB), cells: played.map((period) => ({ value: String(period.b) })) },
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
  // The point categories a scorer sees. "Other" folds the rest (all-out, technical, defender out) so
  // the cells always add up to the total; it only shows once a side has one.
  const parts = (team) => [
    team.score.touch,
    team.score.bonus,
    team.score.tackleBase + team.score.superTackleExtra,
    team.score.allOut + team.score.technical + team.score.defenderOut,
  ];
  const labels = ['Touch', 'Bonus', 'Tackle', 'Other'];
  const shown = labels.map((_, i) => i < 3 || parts(a)[i] > 0 || parts(b)[i] > 0);
  const cells = (team) => parts(team).filter((_, i) => shown[i]).map((value) => ({ value: String(value) }));
  const side = (team, i) => ({
    name: team.name,
    score: String(teamTotal(team)),
    meta: `${state.mat[i].length} on the mat`,
    cells: cells(team),
    pips: { on: state.mat[i].length, total: state.rules.initialPlayers },
  });
  return {
    sportId: 'kabaddi',
    kind: 'kabaddi',
    colours,
    status: `Half ${state.half} · raid ${state.raidNumber}`,
    columns: labels.filter((_, i) => shown[i]),
    live: state.nextRaidTeam,
    liveLabel: 'Raids next',
    teams: [side(a, 0), side(b, 1)],
  };
}

// ---- cricket ------------------------------------------------------------------------------

// Runs off the bat per ball; `W` is a wicket (bowled). India's first innings is a full 20 overs
// (24 balls repeated five times); Australia's reply is 33 balls in, from the same script as before.
const INDIA_BALLS = Array.from({ length: 5 }, () => [
  1, 0, 4, 2, 1, 0, 1, 1, 6, 0, 2, 1, 0, 4, 1, 1, 0, 2, 1, 'W', 1, 2, 0, 4,
]).flat();
const AUSTRALIA_BALLS = [1, 0, 4, 2, 0, 1, 'W', 1, 1, 6, 0, 2, 4, 1, 0, 1, 'W', 2, 1, 0, 4, 1, 1, 0, 6, 2, 0, 1, 4, 1, 0, 2, 1];

function playInnings(balls, format, overrides) {
  let incoming = 3;
  return balls.reduce((current, ball) => {
    const wicket = ball === 'W';
    const delivery = makeDelivery(wicket
      ? { wicket: { type: 'bowled', out: current.striker, completedRuns: 0, incoming: `p${incoming}` } }
      : { batsmanRuns: ball });
    if (wicket) incoming += 1;
    return applyDelivery(current, delivery, format);
  }, createInnings(overrides));
}

function cricketDemo() {
  const format = makeFormat({ name: 'T20', oversPerInnings: 20 });
  const first = deriveInnings(playInnings(INDIA_BALLS, format, { battingTeam: 'A', bowlingTeam: 'B' }), format);
  const reply = playInnings(AUSTRALIA_BALLS, format, { battingTeam: 'B', bowlingTeam: 'A', target: first.runs + 1 });
  const second = deriveInnings(reply, format);
  const chase = deriveChase(reply, format);
  return {
    sportId: 'cricket',
    kind: 'cricket',
    colours: colourPair('Red v Blue'),
    status: `T20 · ${second.overs} of ${format.oversPerInnings} overs`,
    live: 1,
    liveLabel: 'Batting',
    foot: `Australia need ${chase.runsNeeded} off ${chase.ballsLeft} balls · required rate ${chase.RRR.toFixed(2)}`,
    teams: [
      { name: 'India', score: `${first.runs}/${first.wkts}`, meta: `${first.overs} overs` },
      { name: 'Australia', score: `${second.runs}/${second.wkts}`, meta: `${second.overs} overs` },
    ],
  };
}

// ---- public -------------------------------------------------------------------------------

const BUILDERS = {
  cricket: cricketDemo,
  kabaddi: kabaddiDemo,
  volleyball: () => setsDemo('volleyball', {
    names: ['Eagles', 'Hawks'], bestOf: 5, sets: [[25, 21], [23, 25]], current: [18, 16], colours: colourPair('Red v Blue'), serves: true,
  }),
  badminton: () => setsDemo('badminton', {
    names: ['Chen', 'Lee'], bestOf: 3, sets: [[21, 18]], current: [15, 12], colours: colourPair('Purple v Orange'), serves: true,
  }),
  football: () => goalsDemo('football', {
    names: ['City', 'United'],
    totals: [2, 1],
    values: [[1], [1]],
    spacing: [1900, 3000],
    periods: [{ label: '1st half', durationSec: 2700 }, { label: '2nd half', durationSec: 2700 }],
    status: ({ last, period }) => `${last?.minute ?? 0}' · ${period?.label ?? ''}`,
    shortLabels: ['1H', '2H'],
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
    // Field hockey (registry): four 15-minute quarters.
    periods: ['Q1', 'Q2', 'Q3', 'Q4'].map((label) => ({ label, durationSec: 900 })),
    status: ({ last, period }) => `${period?.label ?? 'Q1'} of 4 · ${last?.minute ?? 0}'`,
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
