// k2 harness: the real KabaddiScorer on the shipped BoardShell, wall clock frozen so clocks read
// exactly. /.kbk2/index.html?s=<scene>&theme=light|dark. Scenes start from engine fixtures
// (fixture.js) and reach the captured screen by tapping the real buttons.
import { createRoot } from 'react-dom/client';
import { act, useState } from 'react';
import KabaddiScorer from '../src/designs/design1-mono/scoring/KabaddiScorerBoard';
import KabaddiOneTap from '../src/designs/design1-mono/scoring/KabaddiOneTapBoard';
import KabaddiRaid from '../src/designs/design1-mono/scoring/KabaddiRaidBoard';
import { useTeamColours } from '../src/designs/design1-mono/scoring/useTeamColours';
import { buildEnd, buildOpen, buildRest } from './fixture';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const params = new URLSearchParams(location.search);
const s = params.get('s') || 'rest';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
const NOW = 1_800_000_000_000;
Date.now = () => NOW;
// Time is frozen, so the board's 1 s clock tick has nothing to redraw; skip it to keep the page still.
window.setInterval = () => 0;

const r3 = params.get('v') === 'r3';
const r4 = params.get('v') === 'r4';
let OFF = 0; // r4: ms added to the frozen wall clock, so the raid clock ring can show a running raid
let bump = () => {};
const named = s.startsWith('names');
const open = /^(names-)?open/.test(s);
const match = s === 'end' ? buildEnd(NOW, { named }) : open ? buildOpen(NOW, { named }) : buildRest(NOW, { named });
const walks = {
  touched: ['Touched'],
  readback: ['Touched', '2'],
  super: ['Tackled', 'Confirm'],
  undo: ['Tackled', 'Confirm', 'Undo last action'],
  'names-touched': ['Touched', '#11', '#21'],
  'names-tackled': ['Tackled'],
  // round 3 (v=r3): one tap scores
  tap1: ['+1'],
  'open-bonus': ['Bonus'],
  'open-picker': ['3+'],
  'names-tap1': ['+1'],
  menu: ['Match options'],
  'super-r3': ['Tackled'],
  // round 4 (v=r4): Raid by, then one outcome. '@ms' moves the clock on.
  'open-running': ['Raid by Royals', '@9000'],
  dod: ['Raid by Royals', '@16000'],
  'open-touch': ['Raid by Royals', '+2'],
  'names-open-touch': ['Raid by Royals', '+2', '#9'],
  'open-tackled': ['Raid by Royals', 'Tackled'],
  'names-open-tackled': ['Raid by Royals', 'Tackled'],
  'super-r4': ['Raid by Royals', 'Tackled'],
  allout: ['Raid by Royals', '3+', '3'],
  'names-allout': ['Raid by Royals', '3+', '3'],
  'open-bonus-r4': ['Raid by Royals', 'Bonus'],
  'raid-undo': ['Raid by Royals', '@4000', 'Undo last action'],
};

function App() {
  const colourStyle = useTeamColours(undefined, undefined, 'kabaddi');
  const [, setN] = useState(0);
  bump = () => setN((n) => n + 1);
  return (
    <div className="min-h-screen font-swiss" style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink-strong)' }}>
      {r4
        ? <KabaddiRaid initialMatch={match} colourStyle={colourStyle} title="Royals v Strikers" subtitle="Kabaddi · 2 × 20 min halves"
          now={() => NOW + OFF} onFinish={() => {}} onDiscard={() => {}} />
        : r3
        ? <KabaddiOneTap initialMatch={match} colourStyle={colourStyle} title="Royals v Strikers" subtitle="Kabaddi · 2 × 20 min halves"
          nameWindowMs={null} onFinish={() => {}} onDiscard={() => {}} />
        : <KabaddiScorer initialMatch={match} colourStyle={colourStyle} title="Royals v Strikers" subtitle="Kabaddi · 2 × 20 min halves"
          onFinish={() => {}} onDiscard={() => {}} />}
    </div>
  );
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
act(() => root.render(<App />));
const find = (name) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').trim() === name || b.textContent.trim() === name);
for (const step of walks[s] || []) {
  if (step.startsWith('@')) { OFF += Number(step.slice(1)); act(() => bump()); continue; }
  const b = find(step);
  if (!b) { console.log('MISSING', step); break; }
  act(() => b.click());
}
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
// ?flash=1 holds the "off the court" caption on screen (it fades after 4 s); everything else settles.
setTimeout(() => {
  for (const a of document.getAnimations()) {
    if (a.animationName === 'ks-flash' && params.get('flash') === '1') { a.pause(); a.currentTime = 1500; } else a.finish();
  }
}, 50);

// Audit: enabled targets >= 48px, text contrast on its real background, page fits without scrolling.
window.__audit = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); };
  const small = [...document.querySelectorAll('.sb button')].filter((b) => !b.disabled && vis(b))
    .map((b) => ({ t: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 24), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
    .filter((b) => b.w < 48 || b.h < 48);
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3])).concat(1);
  const lum = (c) => { const v = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722; };
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    const layers = [];
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage !== 'none') return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    if (layers.length && layers.at(-1)[3] >= 1) base = layers.pop();
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  let min = 99; const fails = []; let gradientText = 0;
  for (const el of document.querySelectorAll('.sb *')) {
    if (!vis(el) || el.closest('button:disabled') || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const bg = bgOf(el);
    if (!bg) { gradientText += 1; continue; }
    const r = ratio(over(rgba(getComputedStyle(el).color), bg), bg); min = Math.min(min, r);
    if (r < 4.5) fails.push({ t: el.textContent.trim().slice(0, 30), r: +r.toFixed(2) });
  }
  return { s, w: innerWidth, h: innerHeight, scrolls: document.documentElement.scrollHeight > innerHeight + 1, docH: document.documentElement.scrollHeight,
    barBottom: Math.round(document.querySelector('.sb-bar').getBoundingClientRect().bottom), small, minContrast: +min.toFixed(2), fails, gradientText,
    line: document.querySelector('.kb-line, .ko-slot')?.textContent ?? '', last: document.querySelector('.kb-last, .ko-last')?.textContent ?? '' };
};
