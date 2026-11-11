/* The five animation cards on Home. Each card is a timeline of states: `times[i]` is when
   `states[i]` shows (ms from the start of the card's loop), and `loopMs` is when the loop is over.
   The cards are pure functions of one state, so the card components only draw and the clock
   (useTimeline) is the one place that moves time.

   Timing and copy are ported from compare/concepts/k1-rail.html (tap, undo, live, moments) and
   c4-paper-to-app.html (paper), then cut to about 8 s a card: the story and the copy are the same,
   the holds are shorter. `still` is the state shown under reduced motion: nothing plays, and it is
   the frame that says what the card is about. Every frame is something the app's own board would
   show: the tennis card never shows a letter as a score (after the game the points are back to 0-0
   and the game is counted), and an undone cricket ball leaves its slot empty, as the real over
   strip does (the app derives the strip from the balls that are left). */

/** Build a timeline from an opening state and [atMs, patch] events; patches merge in time order. */
export function buildTimeline(opening, events, loopMs, still) {
  const sorted = events
    .map(([at, patch], order) => ({ at, patch, order }))
    .sort((a, b) => a.at - b.at || a.order - b.order);
  const times = [0];
  const states = [opening];
  let state = opening;
  for (const { at, patch } of sorted) {
    state = { ...state, ...patch };
    if (at === times[times.length - 1]) states[states.length - 1] = state;
    else { times.push(at); states.push(state); }
  }
  return { times, states, loopMs, still: still ? { ...state, ...still } : states[0] };
}

/* A tap on a key: the key goes down at once, the answer lands 140 ms later, the key comes up at 360. */
const PRESS_DOWN_MS = 140;
const PRESS_UP_MS = 360;

// ---- tap: one tennis game, point by point ---------------------------------------------------
/* [hold ms, key tapped, call, rule, Asha's points, Meera's points, call is hot]. The last step is
   what the app's board does after the game: the points go back to 0-0 and the game is counted. */
const TAP_STEPS = [
  [900, null, 'Love all', 'New game. Tap whoever wins the point.', '0', '0'],
  [600, 'a', '15–0', 'Point to Asha.', '15', '0'],
  [600, 'b', '15 all', 'Point to Meera.', '15', '15'],
  [600, 'a', '30–15', 'Point to Asha.', '30', '15'],
  [600, 'b', '30 all', 'Point to Meera.', '30', '30'],
  [800, 'a', '40–30', 'Game point for Asha.', '40', '30'],
  [1100, 'b', 'Deuce', '40 all. From here it takes two points in a row.', '40', '40', true],
  [1100, 'a', 'Advantage', 'Advantage Asha. One point from the game.', 'AD', '40', true],
  [1800, 'a', 'Game Asha', 'Asha wins Game 1. Points go back to 0–0.', '0', '0', true],
];
const TAP_STILL_STEP = 6;

const tapView = (step) => ({
  call: step[2],
  rule: step[3],
  pa: step[4],
  pb: step[5],
  hot: Boolean(step[6]),
  ga: step[2] === 'Game Asha' ? '1' : '0',
  gb: '0',
});

function tapTimeline() {
  const events = [];
  let at = 0;
  TAP_STEPS.forEach((step, i) => {
    if (i > 0) events.push([at, { down: step[1] }], [at + PRESS_DOWN_MS, tapView(step)], [at + PRESS_UP_MS, { down: null }]);
    at += step[0];
  });
  return buildTimeline({ ...tapView(TAP_STEPS[0]), down: null }, events, at, { ...tapView(TAP_STEPS[TAP_STILL_STEP]), down: null });
}

// ---- undo: one cricket over, 1 4 (6 by mistake, undone) 2 0 1 4 = 12 ------------------------
const NO_BALLS = Array.from({ length: 6 }, () => ({ t: '', on: false }));

function undoTimeline() {
  const events = [];
  let balls = NO_BALLS;
  const put = (i, t) => { balls = balls.map((ball, k) => (k === i ? { t, on: t !== '' } : ball)); };
  const view = (num, status, cap, dir = 1) => ({ num: String(num), status, cap, dir, balls });
  put(0, '1'); events.push([900, view(1, 'A single', 'Ball one.')]);
  put(1, '4'); events.push([1600, view(5, 'Four', 'Ball two.')]);
  put(2, '6'); events.push([2400, view(11, 'Six', 'That was only two. Wrong key.')]);
  // Undo takes the ball out of the over, so its slot is empty again.
  put(2, '');
  events.push([3800, { down: true }], [3800 + PRESS_DOWN_MS, view(5, 'Undone', 'The six is gone. Back to 5.', -1)], [3800 + PRESS_UP_MS, { down: false }]);
  put(2, '2'); events.push([5000, view(7, 'Two', 'Ball three, scored right.')]);
  put(3, '0'); events.push([5700, view(7, 'Dot ball', 'Ball four.')]);
  put(4, '1'); events.push([6300, view(8, 'A single', 'Ball five.')]);
  put(5, '4'); events.push([6900, view(12, 'Over done', '12 off the over. Six legal balls.')]);
  const opening = { ...view(0, 'New over', 'Tap what each ball scored.'), balls: NO_BALLS, down: false };
  const stillBalls = NO_BALLS.map((ball, k) => (k === 0 ? { t: '1', on: true } : k === 1 ? { t: '4', on: true } : ball));
  return buildTimeline(opening, events, 8300, {
    num: '5', status: 'Undone', cap: 'A six tapped by mistake is gone. Back to 5.', dir: 1, balls: stillBalls, down: false,
  });
}

// ---- live: one short football match; goals 2 and 3 are scored with no signal ----------------
function liveTimeline() {
  const T = [0, 700, 1700, 2500, 3100, 3800, 4700, 6500];
  const opening = {
    na: '0', nb: '0', who: '', chip: 'New match', kind: '', on: false, off: false, link: 'show', p1: '', p2: '', y1: -8, down: false,
  };
  const events = [
    [T[1], { link: 'moving' }],
    [T[1] + 800, { nb: '0', who: 'Live', on: true, link: 'sent', chip: 'Sharing live', kind: 'live' }],
    // goal 1 reaches the friend's phone at once
    [T[2], { down: true, y1: 0 }], [T[2] + PRESS_DOWN_MS, { na: '1' }], [T[2] + 200, { p1: 'go' }], [T[2] + PRESS_UP_MS, { down: false }],
    [T[2] + 700, { p1: 'gone' }], [T[2] + 760, { nb: '1', y1: -8 }], [T[2] + 1000, { p1: '' }],
    // the signal drops; goals 2 and 3 are saved here and wait
    [T[3], { off: true }],
    [T[4], { down: true, chip: 'Saved here', kind: 'hold' }], [T[4] + PRESS_DOWN_MS, { na: '2' }], [T[4] + 200, { p1: 'wait' }], [T[4] + PRESS_UP_MS, { down: false }],
    [T[5], { down: true }], [T[5] + PRESS_DOWN_MS, { na: '3' }], [T[5] + 200, { p2: 'wait' }], [T[5] + PRESS_UP_MS, { down: false }],
    // the signal returns: both arrive
    [T[6], { off: false }],
    [T[6] + 400, { p1: 'go' }], [T[6] + 620, { p2: 'go' }], [T[6] + 900, { p1: 'gone' }], [T[6] + 1000, { nb: '3', chip: 'Both sent', kind: 'live' }],
    [T[6] + 1080, { p2: 'gone' }], [T[6] + 1200, { p1: '' }], [T[6] + 1400, { p2: '' }],
    [T[7], { chip: 'Full time', kind: '', who: 'Full time' }],
  ];
  return buildTimeline(opening, events, 7900, {
    na: '1', nb: '1', who: 'Live', chip: 'Sharing live', kind: 'live', on: true, off: false, link: '', p1: '', p2: '', down: false,
  });
}

// ---- moments: a stack of calls the app makes by itself, one per sport -----------------------
/* [sport id, call, line]. Kabaddi and table tennis lines match kabaddiRules.js and setsRules.js. */
export const MOMENTS = [
  ['tennis', 'Deuce', '40 all. Win by two points.'],
  ['cricket', 'Need 12 off 8', 'Chasing 176. Every ball counts.'],
  ['volleyball', 'Set point', '24–22. One more takes the set.'],
  ['badminton', '20 all', 'Now it takes a two-point lead.'],
  ['football', 'Half-time', 'City 1, United 0 at the break.'],
  ['tabletennis', '10 all', 'Serve changes every point now.'],
  ['kabaddi', 'All out', 'Two bonus points to the raiding side.'],
  ['basketball', 'Three-pointer', 'Lakers go up 78–72.'],
  ['hockey', 'Goal', 'Lions lead 3–2, last quarter.'],
];

export const MOMENT_TICK_MS = 1300;
const MOMENT_TICKS = 6;

/* Six cards take turns at the top. After `tick` steps the moment `j` sits `tick - j + 3` places down
   the stack: 0 is the newest (full), 3 is the oldest on show (faint), 4 fades out below, and -1 waits
   above. Moment `j` is drawn by card `j mod 6`, so a card that falls off the bottom (4) is the one
   that comes back in at the top (-1) with the next moment, unseen, as both ends are transparent. */
export const MOMENT_OPACITY = { '-1': 0, 0: 1, 1: 1, 2: 0.7, 3: 0.35, 4: 0 };

export function momentStack(tick) {
  return Array.from({ length: 6 }, (_, card) => {
    const j = tick - 1 + ((((card - (tick - 1)) % 6) + 6) % 6);
    return { card, moment: MOMENTS[((j % MOMENTS.length) + MOMENTS.length) % MOMENTS.length], slot: tick - j + 3 };
  });
}

function momentsTimeline() {
  const events = Array.from({ length: MOMENT_TICKS - 1 }, (_, i) => [(i + 1) * MOMENT_TICK_MS, { tick: i + 1 }]);
  return buildTimeline({ tick: 0 }, events, MOMENT_TICKS * MOMENT_TICK_MS);
}

// ---- paper: the handwritten scoresheet wipes into the app ----------------------------------
const PAPER_BEFORE = { need: 'Need 12 off 8', foot: 'Australia 164/6 · target 176' };
const PAPER_AFTER = { need: 'Need 6 off 7', foot: 'Australia 170/6 · target 176' };

function paperTimeline() {
  const opening = { mode: '', hit: false, left: false, ...PAPER_BEFORE };
  return buildTimeline(
    opening,
    [
      [2000, { mode: 'app' }],
      [4200, { hit: true, ...PAPER_AFTER }],
      [6600, { mode: 'exit', left: true }],
    ],
    8000,
    { mode: 'app', hit: false, left: false, ...PAPER_BEFORE },
  );
}

/* Order on the rail. `label` is the card's accessible name for the picture (the demo inside is
   hidden from assistive tech); `sportId` is the badge in the card head, none for moments. */
export const CARDS = [
  {
    id: 'tap', sportId: 'tennis', title: 'Tap. The rule answers.',
    label: 'A tennis game scored by taps. At 40 all the app calls deuce, then advantage, then game, and the points start again at 0–0.',
    timeline: tapTimeline(),
  },
  {
    id: 'undo', sportId: 'cricket', title: 'Wrong tap? Undo.',
    label: 'One cricket over. A six is tapped by mistake, Undo removes it, and the over ends on 12 runs.',
    timeline: undoTimeline(),
  },
  {
    id: 'live', sportId: 'football', title: 'Friends follow live.',
    label: "A live link reaches a friend's phone and each goal appears there. Two goals scored with no signal are saved and arrive when the signal returns.",
    timeline: liveTimeline(),
  },
  {
    id: 'moments', sportId: null, title: 'Nine sports. The rules built in.',
    label: 'Moments the app calls by itself: deuce in tennis, need 12 off 8 in cricket, set point in volleyball and more.',
    timeline: momentsTimeline(),
  },
  {
    id: 'paper', sportId: 'cricket', title: 'Paper, minus the sums.',
    label: 'A handwritten cricket scoresheet with a crossed-out sum turns into the app, which shows Need 12 off 8. One more tap, a six, and it reads Need 6 off 7.',
    timeline: paperTimeline(),
  },
];

/** The longest loop of a set of cards, in ms. */
export const longestLoop = (cards) => Math.max(...cards.map((card) => card.timeline.loopMs));
