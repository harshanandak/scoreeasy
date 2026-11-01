// k2 harness: the real KabaddiScorer on the shipped BoardShell, wall clock frozen so clocks read
// exactly. /.kbk2/index.html?s=<scene>&theme=light|dark. Scenes start from engine fixtures
// (fixture.js) and reach the captured screen by tapping the real buttons.
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import KabaddiScorer from '../src/designs/design1-mono/scoring/KabaddiScorerBoard';
import { useTeamColours } from '../src/designs/design1-mono/scoring/useTeamColours';
import { buildEnd, buildRest } from './fixture';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const params = new URLSearchParams(location.search);
const s = params.get('s') || 'rest';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
const NOW = 1_800_000_000_000;
Date.now = () => NOW;
// Time is frozen, so the board's 1 s clock tick has nothing to redraw; skip it to keep the page still.
window.setInterval = () => 0;

const named = s.startsWith('names');
const match = s === 'end' ? buildEnd(NOW, { named }) : buildRest(NOW, { named });
const walks = {
  touched: ['Touched'],
  readback: ['Touched', '2'],
  super: ['Tackled', 'Confirm'],
  undo: ['Tackled', 'Confirm', 'Undo last action'],
  'names-touched': ['Touched', '#11', '#21'],
  'names-tackled': ['Tackled'],
};

function App() {
  const colourStyle = useTeamColours(undefined, undefined, 'kabaddi');
  return (
    <div className="min-h-screen font-swiss" style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink-strong)' }}>
      <KabaddiScorer initialMatch={match} colourStyle={colourStyle} title="Royals v Strikers" subtitle="Kabaddi · 2 × 20 min halves"
        onFinish={() => {}} onDiscard={() => {}} />
    </div>
  );
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
act(() => root.render(<App />));
const find = (name) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').trim() === name || b.textContent.trim() === name);
for (const step of walks[s] || []) {
  const b = find(step);
  if (!b) { console.log('MISSING', step); break; }
  act(() => b.click());
}
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
setTimeout(() => { for (const a of document.getAnimations()) a.finish(); }, 50);

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
    line: document.querySelector('.kb-line').textContent };
};
