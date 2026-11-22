
var PALETTES = {"default":{"src":["#d62828","#1d4ed8"],"vars":{"--team-a-hi":"#d32928","--team-a-core":"#bb0012","--team-a-lo":"#890600","--team-a-on":"#ffffff","--team-a-scrim":"rgba(0, 0, 0, 0.3)","--team-a-tint":"#ffe6e3","--team-a-line":"#c7423b","--team-a-motif":"rgba(0, 0, 0, 0.17)","--team-b-hi":"#2f61e3","--team-b-core":"#1d4ccc","--team-b-lo":"#182aa4","--team-b-on":"#ffffff","--team-b-scrim":"rgba(0, 0, 0, 0.31)","--team-b-tint":"#e4edff","--team-b-line":"#2d57be","--team-b-motif":"rgba(0, 0, 0, 0.17)","--team-a-veil22":"rgba(0,0,0,.22)","--team-a-veil12":"rgba(0,0,0,.12)","--team-a-band":"deep","--team-b-veil22":"rgba(0,0,0,.22)","--team-b-veil12":"rgba(0,0,0,.12)","--team-b-band":"deep"},"raw":{"A":{"hi":"#d32928","core":"#bb0012","lo":"#890600","on":"#ffffff","veil":"#000000","band":"deep","sheen":"#d63837"},"B":{"hi":"#2f61e3","core":"#1d4ccc","lo":"#182aa4","on":"#ffffff","veil":"#000000","band":"deep","sheen":"#3e6ce5"}}},"light":{"src":["#facc15","#ffffff"],"vars":{"--team-a-hi":"#ffdd73","--team-a-core":"#facc15","--team-a-lo":"#e2bf17","--team-a-on":"#0b0b0d","--team-a-scrim":"rgba(255, 255, 255, 0)","--team-a-tint":"#f8edcb","--team-a-line":"#a58500","--team-a-motif":"rgba(11, 11, 13, 0.11)","--team-b-hi":"#ededed","--team-b-core":"#dedede","--team-b-lo":"#cecece","--team-b-on":"#0b0b0d","--team-b-scrim":"rgba(255, 255, 255, 0)","--team-b-tint":"#ededed","--team-b-line":"#898989","--team-b-motif":"rgba(11, 11, 13, 0.11)","--team-a-veil22":"rgba(255,255,255,.22)","--team-a-veil12":"rgba(255,255,255,.12)","--team-a-band":"bright","--team-b-veil22":"rgba(255,255,255,.22)","--team-b-veil12":"rgba(255,255,255,.12)","--team-b-band":"bright"},"raw":{"A":{"hi":"#ffdd73","core":"#facc15","lo":"#e2bf17","on":"#0b0b0d","veil":"#ffffff","band":"bright","sheen":"#ffdf7d"},"B":{"hi":"#ededed","core":"#dedede","lo":"#cecece","on":"#0b0b0d","veil":"#ffffff","band":"bright","sheen":"#eeeeee"}}}};
/* Score Easy board redesign: shared core. Plain script, no imports.
   Used twice: node (sheet generator, via require) and inlined into prototype.html.
   Needs a global PALETTES (see palettes.json) for CSS_KITS. */

/* =====================================================================
   1. RULES: one entry per sport. Everything sport-specific lives here.
   ===================================================================== */
const RULES = {
  vb: {
    id: 'vb', name: 'Volleyball', unit: 'Set', title: 'Volleyball',
    names: ['Chennai Challengers', 'Mumbai Mavericks'], init: ['C', 'M'],
    target: 25, decider: 15, cap: null, winBy: 2,
    ruleLine: 'First to 25, win by 2. Deciding set to 15.',
    setupNote: 'Rally scoring: the team that wins the rally serves next.',
    hasLet: false,
    // who serves right now (rally scoring: the last rally winner)
    serve(st) { const who = st.last || st.first; return { who, main: 'SERVING', sub: '' }; },
    // anything that must pause play after a point (st already holds the new score)
    mid(st) {
      if (isDeciding(st) && Math.max(st.a, st.b) === 8 && !st.fired.sw8)
        return { key: 'sw8', kind: 'swap', title: 'Teams change ends', detail: 'Deciding set: a team reached 8.' };
      return null;
    },
    // First server of the next set. Ordinary sets are locked: the team that did not serve first last set.
    // Only the deciding set has a new toss, so only there is the choice free.
    nextFirst(st, winner) {
      if (st.g + 1 === 2 * st.toWin - 2) return { srv: null, fixed: false, why: 'Deciding set: new toss. Tap the team that serves first' };
      return { srv: opp(st.first), fixed: true, why: 'The team that did not serve first last set serves first' };
    },
  },
  bd: {
    id: 'bd', name: 'Badminton', unit: 'Game', title: 'Badminton singles',
    names: ['A. Sharma', 'R. Verma'], init: ['S', 'V'],
    target: 21, decider: null, cap: 30, winBy: 2,
    ruleLine: 'First to 21, win by 2, cap 30.',
    setupNote: 'The rally winner serves next. Serve is from the right court on an even score, the left court on an odd one.',
    hasLet: true,
    serve(st) {
      const who = st.last || st.first;
      const mine = who === 'A' ? st.a : st.b;
      return { who, main: 'SERVING', sub: mine % 2 === 0 ? 'RIGHT COURT' : 'LEFT COURT', court: mine % 2 === 0 ? 'right' : 'left' };
    },
    mid(st) {
      if (Math.max(st.a, st.b) === 11 && !st.fired.i11) {
        if (isDeciding(st)) return { key: 'i11', kind: 'swap', interval: 60, title: 'Interval, then teams change ends', detail: 'Deciding game: a side reached 11. 60 second interval.' };
        return { key: 'i11', kind: 'interval', interval: 60, title: '60 second interval', detail: 'A side reached 11.' };
      }
      return null;
    },
    nextFirst(st, winner) { return { srv: winner, fixed: true, why: 'The winner of the last game serves first' }; },
  },
  tt: {
    id: 'tt', name: 'Table tennis', unit: 'Game', title: 'Table tennis singles',
    names: ['Venkat Subramanian', 'Dev Patel'], init: ['V', 'D'],
    target: 11, decider: null, cap: null, winBy: 2,
    ruleLine: 'First to 11, win by 2.',
    setupNote: 'Two serves each, then one each from 10-10. The first server alternates every game.',
    hasLet: true,
    serve(st) {
      const n = st.a + st.b;
      const idx = n >= 20 ? n % 2 : Math.floor(n / 2) % 2;       // from 10-10 the serve changes every point
      const who = idx === 0 ? st.first : opp(st.first);
      return n >= 20 ? { who, main: 'SERVING', sub: 'EACH POINT', each: true } : { who, main: 'SERVING', sub: `${(n % 2) + 1} OF 2`, n: (n % 2) + 1, per: 2 };
    },
    mid(st) {
      if (isDeciding(st) && Math.max(st.a, st.b) === 5 && !st.fired.sw5)
        return { key: 'sw5', kind: 'swap', title: 'Teams change ends', detail: 'Last game: a player reached 5.' };
      return null;
    },
    nextFirst(st, winner) { return { srv: opp(st.first), fixed: true, why: 'The first server alternates each game' }; },
  },
};

/* =====================================================================
   2. ENGINE: the match is an event log; every screen is derived from it.
      Undo = drop the last event and replay. Nothing else is stored.
   ===================================================================== */
const opp = (t) => (t === 'A' ? 'B' : 'A');
const nameOf = (st, t) => RULES[st.sport].names[t === 'A' ? 0 : 1];
const isDeciding = (st) => st.g === 2 * st.toWin - 2;
const targetOf = (st) => { const R = RULES[st.sport]; return isDeciding(st) && R.decider ? R.decider : R.target; };

function winnerOf(st, a, b) {
  const R = RULES[st.sport], t = targetOf(st), hi = Math.max(a, b), lo = Math.min(a, b);
  if (R.cap && hi >= R.cap) return a > b ? 'A' : 'B';
  if (hi >= t && hi - lo >= R.winBy) return a > b ? 'A' : 'B';
  return null;
}

function newMatch(sport, bo) {
  return { sport, bo, toWin: Math.ceil(bo / 2), phase: 'first', g: 0, a: 0, b: 0, games: [], wins: { A: 0, B: 0 },
    left: 'A', first: null, last: null, fired: {}, pts: [], all: [], between: null, prompt: null, winner: null, ev: [] };
}

function reduce(s0, ev) {
  const st = JSON.parse(JSON.stringify(s0)); const R = RULES[st.sport];
  st.ev.push(ev);
  switch (ev.k) {
    case 'first': st.first = ev.who; st.last = null; st.phase = 'play'; break;
    case 'pt': {
      if (ev.who === 'A') st.a++; else st.b++;
      st.pts.push(ev.who); st.all.push(ev.who); st.last = ev.who;
      const w = winnerOf(st, st.a, st.b);
      if (w) {
        st.games.push([st.a, st.b]); st.wins[w]++;
        if (st.wins[w] === st.toWin) { st.phase = 'over'; st.winner = w; }
        else { const nf = R.nextFirst(st, w); st.phase = 'between'; st.between = { swap: null, srv: nf.srv, fixed: nf.fixed, why: nf.why, winner: w }; }
      } else {
        const p = R.mid(st);
        if (p) { st.fired[p.key] = true; st.prompt = p; st.phase = p.kind === 'interval' ? 'interval' : 'change'; }
      }
      break;
    }
    case 'swap': if (ev.swap) st.left = opp(st.left); st.phase = 'play'; st.prompt = null; break;
    case 'resume': st.phase = 'play'; st.prompt = null; break;
    // bar button "Swap ends": flip left and right in the middle of play. Score, serve and phase do not change.
    case 'flip': st.left = opp(st.left); break;
    case 'side': st.between.swap = ev.swap; break;
    case 'srv': st.between.srv = ev.who; break;
    case 'start':
      if (st.between.swap) st.left = opp(st.left);
      st.g++; st.first = st.between.srv; st.a = 0; st.b = 0; st.pts = []; st.fired = {}; st.last = null;
      st.between = null; st.phase = 'play'; break;
    default: break;
  }
  return st;
}

function replay(sport, bo, events) { return events.reduce(reduce, newMatch(sport, bo)); }

// Is this event legal right now? The UI only ever dispatches legal events.
function valid(st, ev) {
  switch (ev.k) {
    case 'first': return st.phase === 'first';
    case 'pt': return st.phase === 'play';
    case 'swap': return st.phase === 'change';
    case 'resume': return st.phase === 'interval';
    case 'flip': return st.phase === 'play';
    case 'side': return st.phase === 'between' && st.between.swap !== ev.swap;
    case 'srv': return st.phase === 'between' && !st.between.fixed && st.between.srv !== ev.who;
    case 'start': return st.phase === 'between' && st.between.swap !== null && !!st.between.srv;
    default: return false;
  }
}

// Does t win the game if it scores next? (set point / game point / sudden point)
const wouldWin = (st, t) => winnerOf(st, st.a + (t === 'A' ? 1 : 0), st.b + (t === 'B' ? 1 : 0)) === t;

function flagOf(st) {
  if (!['play', 'change', 'interval'].includes(st.phase)) return null;
  const R = RULES[st.sport], ca = wouldWin(st, 'A'), cb = wouldWin(st, 'B');
  if (ca && cb) return { text: 'SUDDEN POINT', team: null, tone: 'gold' };
  const t = ca ? 'A' : cb ? 'B' : null;
  if (t) return { text: st.wins[t] + 1 === st.toWin ? 'MATCH POINT' : `${R.unit.toUpperCase()} POINT`, team: t, tone: 'gold' };
  if (st.a === st.b && st.a >= targetOf(st) - 1) return { text: 'DEUCE', team: null, tone: 'ink' };
  return null;
}

// What tapping t really does: shown under "+1". Empty when nothing needs saying.
function nextHint(st, t) {
  const R = RULES[st.sport], a = st.a + (t === 'A' ? 1 : 0), b = st.b + (t === 'B' ? 1 : 0);
  const mine = t === 'A' ? a : b, theirs = t === 'A' ? b : a;
  if (winnerOf(st, a, b) === t) return st.wins[t] + 1 === st.toWin ? 'wins the match' : `wins the ${R.unit.toLowerCase()}`;
  const f = flagOf({ ...st, a, b, phase: 'play' });
  if (!f) return '';
  if (f.text === 'DEUCE') return `${mine}–${theirs} deuce`;
  if (f.team === t) return `${mine}–${theirs} ${f.text.toLowerCase()}`;
  if (f.team === null) return `${mine}–${theirs} ${f.text.toLowerCase()}`;
  return '';
}

const leftScore = (st) => (st.left === 'A' ? [st.a, st.b] : [st.b, st.a]);

function undoInfo(st) {
  if (!st.ev.length) return null;
  const e = st.ev[st.ev.length - 1], R = RULES[st.sport];
  if (e.k === 'pt') {
    if (st.phase === 'between' || st.phase === 'over') { const g0 = st.games[st.games.length - 1], gm = e.who === 'A' ? g0 : [g0[1], g0[0]]; return { sub: `ends the ${R.unit.toLowerCase()} ${gm[0]}–${gm[1]}`, team: e.who }; }
    const [l, r] = leftScore(st); return { sub: `last point ${l}–${r}`, team: e.who };
  }
  const t = { swap: 'screen choice', flip: 'screen sides', resume: 'interval', side: 'screen choice', srv: 'first server', start: `start of ${R.unit.toLowerCase()} ${st.g + 1}`, first: 'first server' };
  return { sub: t[e.k] || e.k, team: null };
}

/* Scripted states for the sheets and ?state= (token list; see run()). */
function rng(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }
// Play points from the current game score to (a, b) in a random but legal order.
// The last point goes to lastWho. Prompts that open on the way are answered (swap) unless it is the last point.
function fill(st, a, b, lastWho, seed) {
  const needA = a - st.a, needB = b - st.b;
  for (let tr = 0; tr < 400; tr++) {
    const r = rng(seed * 977 + tr), pool = [...'A'.repeat(needA), ...'B'.repeat(needB)];
    const li = pool.lastIndexOf(lastWho); if (li < 0) return null; pool.splice(li, 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    pool.push(lastWho);
    let s = st, ok = true;
    for (let i = 0; i < pool.length && ok; i++) {
      if (s.phase !== 'play') { ok = false; break; }
      s = reduce(s, { k: 'pt', who: pool[i] });
      const last = i === pool.length - 1;
      if (!last && s.phase === 'change') s = reduce(s, { k: 'swap', swap: true });
      else if (!last && s.phase === 'interval') s = reduce(s, { k: 'resume' });
      else if (!last && s.phase !== 'play') ok = false;
    }
    if (ok && s.a === a && s.b === b) return s;
  }
  throw new Error(`fill failed ${a}-${b} from ${st.a}-${st.b}`);
}
// Finish game with a score, then resolve the break: swap sides (S), keep (K), start.
function endGame(st, a, b, seed, side = true) {
  const w = a > b ? 'A' : 'B';
  let s = fill(st, a, b, w, seed);
  s = reduce(s, { k: 'side', swap: side });
  if (!s.between.srv) s = reduce(s, { k: 'srv', who: opp(s.first) });
  return reduce(s, { k: 'start' });
}
const toBreak = (st, a, b, seed) => fill(st, a, b, a > b ? 'A' : 'B', seed);

const SCRIPTS = {
  vb: {
    first: () => newMatch('vb', 5),
    mid: () => fill(endGame(reduce(newMatch('vb', 5), { k: 'first', who: 'A' }), 25, 21, 1), 18, 16, 'A', 2),
    point: () => fill(endGame(reduce(newMatch('vb', 5), { k: 'first', who: 'A' }), 25, 21, 1), 24, 22, 'A', 3),
    change: () => { let s = reduce(newMatch('vb', 5), { k: 'first', who: 'A' }); s = endGame(s, 25, 21, 1); s = endGame(s, 23, 25, 2); s = endGame(s, 25, 19, 3); s = endGame(s, 21, 25, 4, true); return fill(s, 8, 6, 'A', 5); },
    between: () => toBreak(endGame(reduce(newMatch('vb', 5), { k: 'first', who: 'A' }), 25, 21, 1), 25, 22, 2),
    over: () => { let s = reduce(newMatch('vb', 5), { k: 'first', who: 'A' }); s = endGame(s, 25, 21, 1); s = endGame(s, 23, 25, 2); s = endGame(s, 25, 19, 3); return toBreak(s, 25, 20, 4); },
  },
  bd: {
    first: () => newMatch('bd', 3),
    mid: () => fill(endGame(reduce(newMatch('bd', 3), { k: 'first', who: 'A' }), 21, 17, 5), 17, 15, 'A', 6),
    point: () => fill(endGame(reduce(newMatch('bd', 3), { k: 'first', who: 'A' }), 21, 17, 5), 20, 20, 'B', 7),
    change: () => fill(endGame(endGame(reduce(newMatch('bd', 3), { k: 'first', who: 'A' }), 21, 17, 5), 18, 21, 6), 11, 8, 'A', 8),
    between: () => toBreak(reduce(newMatch('bd', 3), { k: 'first', who: 'A' }), 21, 17, 5),
    over: () => toBreak(endGame(reduce(newMatch('bd', 3), { k: 'first', who: 'A' }), 21, 17, 5), 21, 18, 6),
  },
  tt: {
    first: () => newMatch('tt', 5),
    mid: () => fill(endGame(reduce(newMatch('tt', 5), { k: 'first', who: 'A' }), 11, 8, 9), 7, 5, 'B', 10),
    point: () => { let s = reduce(newMatch('tt', 5), { k: 'first', who: 'A' }); s = endGame(s, 11, 8, 9); s = endGame(s, 7, 11, 10); s = endGame(s, 11, 6, 11); return fill(s, 10, 10, 'A', 12); },
    change: () => { let s = reduce(newMatch('tt', 5), { k: 'first', who: 'A' }); s = endGame(s, 11, 8, 9); s = endGame(s, 7, 11, 10); s = endGame(s, 11, 6, 11); s = endGame(s, 9, 11, 12); return fill(s, 5, 3, 'A', 13); },
    between: () => toBreak(endGame(reduce(newMatch('tt', 5), { k: 'first', who: 'A' }), 11, 8, 9), 11, 7, 10),
    over: () => { let s = reduce(newMatch('tt', 5), { k: 'first', who: 'A' }); s = endGame(s, 11, 8, 9); s = endGame(s, 7, 11, 10); s = endGame(s, 11, 6, 11); return toBreak(s, 11, 9, 12); },
  },
};
SCRIPTS.vb.deuce = () => fill(endGame(reduce(newMatch('vb', 5), { k: 'first', who: 'A' }), 25, 21, 1), 24, 24, 'B', 14);
// Volleyball 2-2 in sets: the deciding set has a new toss, the one place the first server is a free choice.
SCRIPTS.vb.decider = () => { let s = reduce(newMatch('vb', 5), { k: 'first', who: 'A' }); s = endGame(s, 25, 21, 1); s = endGame(s, 23, 25, 2); s = endGame(s, 25, 19, 3); return toBreak(s, 21, 25, 4); };
SCRIPTS.bd.deuce = SCRIPTS.bd.point;
SCRIPTS.tt.deuce = SCRIPTS.tt.point;
const STATE_KEYS = ['first', 'mid', 'point', 'change', 'between', 'over'];
