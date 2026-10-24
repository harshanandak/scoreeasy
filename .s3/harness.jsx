// Exploration s3 harness: the real MonoQuickMatch -> KabaddiSplitBoard with local auth/Convex mocks.
// ?s=<scene>&theme=light|dark. Every fixture is built by applying real raid events to a fresh
// engine state (no hand-typed scores or mats); the clock is frozen so screenshots are repeatable.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act } from 'react';
import MonoQuickMatch from '../src/designs/design1-mono/MonoQuickMatch';
import { applyRaid, startHalf, startRaid, teamTotal, timeUp } from '../src/utils/kabaddiEngine';
import { createKabaddiMatch } from '../src/utils/kabaddiQuickMatch';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const params = new URLSearchParams(window.__params ?? location.search);
const s = params.get('s') || 'rest';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
localStorage.clear();

// A frozen wall clock the harness advances by hand (the board reads Date.now()).
const NOW = 1_800_000_000_000;
let T = NOW;
Date.now = () => T;

const SETUP = { format: { mode: 'timed', timeLimit: 2400 }, names: ['Royals', 'Strikers'], colours: ['#d62828', '#1d4ed8'] };
const B = { bonusAwarded: true, bonusBeforeContact: true };
const ev = (c) => (c === 'E' ? { type: 'empty' } : c === 'K' ? { type: 'tackled' } : c.endsWith('b') ? { type: 'touch', count: +c[0], ...B } : { type: 'touch', count: +c });

// Half 1 (Royals raid first) and half 2 up to the brief's rest state: 24–21, mat 5–3, Royals on
// two empty raids (do or die), Strikers defending with 3 (super tackle on), an all out at raid 25.
const HALF1 = '1b K 2 1 K 2 1b E 2b K 1 1 K 2 1 E E K 2 1'.split(' ');
const HALF2 = '2 1 3 K 1 2b K 1 K E K E 2'.split(' ');
// The rest of half 2 after the super tackle (raid 34), to full time.
const AFTER = 'K 1 2 K E 1 1 K 1 2 K 1 1b K E 2 1 E 1'.split(' ');
const H2_START = NOW - 440_000; // 12:40 left at NOW
const H1_START = H2_START - 1_200_000 - 300_000;

let seq = 0;
function raid(state, c, atMs) {
  seq += 1;
  const started = startRaid(state, { id: `r${seq}`, atMs });
  return applyRaid(started, { id: `c${seq}`, raidId: `r${seq}`, expectedRevision: started.revision, ...ev(c) });
}
function restMatch() {
  const match = createKabaddiMatch(SETUP);
  let state = startHalf(match.state, { atMs: H1_START });
  HALF1.forEach((c, i) => { state = raid(state, c, H1_START + 20_000 + i * 55_000); });
  state = timeUp(state);
  state = startHalf(state, { atMs: H2_START });
  HALF2.forEach((c, i) => { state = raid(state, c, H2_START + 8_000 + i * 33_000); });
  return { ...match, state };
}
function endMatch() {
  const match = restMatch();
  let { state } = match;
  AFTER.forEach((c, i) => { state = raid(state, c, NOW + 5_000 + i * 39_000); });
  T = H2_START + 1_200_000 + 2_000;
  state = timeUp(state);
  return { ...match, state };
}

const scenes = { rest: restMatch, raid: restMatch, tackle: restMatch, moment: restMatch, end: endMatch, log: restMatch, undo: restMatch };
const kabaddi = scenes[s]();
console.log('S3_FIXTURE', s, kabaddi.state.teams.map(teamTotal).join('-'), kabaddi.state.mat.map((m) => m.length).join('-'), kabaddi.state.emptyStreak.join(','), kabaddi.state.phase);
localStorage.setItem('se_quickmatch_draft_kabaddi_4101', JSON.stringify({
  phase: 'scoring', sport: 'kabaddi', team1Name: 'Royals', team2Name: 'Strikers', team1Color: '#d62828', team2Color: '#1d4ed8',
  quickMatchId: 4101, format: SETUP.format, timerElapsed: 0, gScore1: 0, gScore2: 0, gScoreHistory: [], lastAction: '',
  kabaddi, updatedAt: new Date(T).toISOString(),
}));

function App() {
  return (
    <MemoryRouter initialEntries={['/kabaddi/quick?resume=4101']}>
      <div className="min-h-screen font-swiss" style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink-strong)' }}>
        <main id="main-content">
          <Routes><Route path="/:sport/quick" element={<MonoQuickMatch />} /></Routes>
        </main>
      </div>
    </MemoryRouter>
  );
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
act(() => root.render(<App />));
const hideToast = () => { for (const el of document.querySelectorAll('[role=status]')) if (el.textContent.startsWith('Resumed')) el.style.display = 'none'; };
hideToast();
const find = (name) => [...document.querySelectorAll('button')].find((b) => {
  const t = (b.getAttribute('aria-label') || b.textContent).trim();
  return typeof name === 'string' ? t === name : name.test(t);
});

// Taps (and seconds passing) that take a scene from its saved state to the captured screen.
const walks = {
  raid: [/^Raid by Royals/, 12_000, '2 touched'],
  tackle: [/^Raid by Royals/, 9_000, /^Tackled/],
  moment: [/^Raid by Royals/, 9_000, /^Tackled/, /^Confirm/],
  undo: [/^Raid by Royals/, 9_000, /^Tackled/, /^Confirm/, 'Undo last action'],
  log: ['Match options'],
};
for (const step of walks[s] || []) {
  if (typeof step === 'number') { T += step; act(() => root.render(<App />)); continue; }
  const b = find(step);
  if (!b) { console.log('MISSING', String(step)); break; }
  act(() => b.click());
}
hideToast();
for (const a of document.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) a.finish();
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
// let the board's 250 ms ticker pick up the advanced clock, then settle animations
setTimeout(() => {
  hideToast();
  for (const a of document.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) a.finish();
  window.__ready = true;
}, 600);

window.__audit = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); };
  const small = [...document.querySelectorAll('.sb button')].filter((b) => !b.disabled && vis(b))
    .map((b) => ({ t: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
    .filter((b) => b.w < 48 || b.h < 48);
  const bar = document.querySelector('.sb-bar');
  return { w: innerWidth, h: innerHeight, docH: document.documentElement.scrollHeight, barBottom: bar && Math.round(bar.getBoundingClientRect().bottom), small };
};

console.log('S3_AUDIT', s, JSON.stringify(window.__audit()));
