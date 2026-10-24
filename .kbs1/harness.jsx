// Evidence harness (exploration s1): the real MonoQuickMatch + KabaddiRaidPad with local auth and
// Convex mocks. ?s=<scene>&theme=light|dark&h=<px>. Fixtures are played through the engine
// (fixture.js); the wall clock is frozen at the scene's moment so clocks are exact.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act } from 'react';
import MonoQuickMatch from '../src/designs/design1-mono/MonoQuickMatch';
import { scenes, SETUP } from './fixture.js';
import '../src/index.css';
import '../src/designs/design1-mono/mono.css';

const params = new URLSearchParams(window.__params ?? location.search);
const s = params.get('s') || 'rest';
document.documentElement.classList.toggle('dark', params.get('theme') === 'dark');
localStorage.clear();
localStorage.setItem('se_kabaddi_board', 'pad');

const REST = 1_800_000_000_000;
const sceneOf = { rest: 'rest', raid: 'raid', moment: 'raid', end: 'end', half: 'half', staged: 'rest' };
const { match, now } = scenes[sceneOf[s]](REST);
Date.now = () => now;
localStorage.setItem('se_quickmatch_draft_kabaddi_4101', JSON.stringify({
  phase: 'scoring', sport: 'kabaddi', team1Name: 'Royals', team2Name: 'Strikers', team1Color: SETUP.colours[0], team2Color: SETUP.colours[1],
  quickMatchId: 4101, format: SETUP.format, timerElapsed: 0, gScore1: 0, gScore2: 0, gScoreHistory: [], lastAction: '',
  kabaddi: match, updatedAt: new Date(now).toISOString(),
}));

function App() {
  return (
    <MemoryRouter initialEntries={['/kabaddi/quick?resume=4101']}>
      <div className="min-h-screen font-swiss" style={{ background: 'var(--se-color-canvas)', color: 'var(--se-color-ink-strong)' }}>
        <main id="main-content"><Routes><Route path="/:sport/quick" element={<MonoQuickMatch />} /></Routes></main>
      </div>
    </MemoryRouter>
  );
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
act(() => root.render(<App />));
for (const el of document.querySelectorAll('[role=status]')) if (el.textContent.startsWith('Resumed')) el.style.display = 'none';
const label = (b) => (b.getAttribute('aria-label') || b.textContent).trim();
const find = (name) => [...document.querySelectorAll('button')].find((b) => (typeof name === 'string' ? label(b) === name : name.test(label(b))));

const walks = {
  raid: ['2 touches'],
  moment: [/^Tackled/, /^Confirm/],
  staged: ['1 touch'],
};
const taps = [];
for (const step of walks[s] || []) {
  const b = find(step);
  if (!b) { console.log('MISSING', String(step)); break; }
  taps.push(label(b).slice(0, 40));
  act(() => b.click());
}
for (const a of document.getAnimations()) if (a.effect?.getTiming().iterations !== Infinity) a.finish();

function audit() {
  const H = Number(params.get('h')) || 844;
  const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); };
  const buttons = [...document.querySelectorAll('.sb button')].filter((b) => vis(b) && !b.closest('.sb-sheet-layer'));
  const small = buttons.filter((b) => !b.disabled).map((b) => ({ t: label(b).slice(0, 24), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) })).filter((b) => b.w < 48 || b.h < 48);
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const lum = (c) => { const v = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722; };
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    const layers = [];
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url')) return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = [255, 255, 255, 1];
    if (layers.length && layers.at(-1)[3] >= 1) base = layers.pop();
    for (const l of layers.reverse()) base = over(l, base);
    return base;
  };
  let min = 99; const fails = []; let gradients = 0;
  for (const el of document.querySelectorAll('.sb *')) {
    if (!vis(el) || el.closest('button:disabled') || el.closest('.sb-sheet-layer') || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const bg = bgOf(el);
    if (!bg) { gradients += 1; continue; }
    const r = ratio(over(rgba(getComputedStyle(el).color), bg), bg); min = Math.min(min, r);
    if (r < 4.5) fails.push({ t: el.textContent.trim().slice(0, 30), r: +r.toFixed(2) });
  }
  const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
  const keys = [...document.querySelectorAll('.rp-key')].map((k) => { const b = k.getBoundingClientRect(); return `${label(k).slice(0, 10)}:${Math.round(b.width)}x${Math.round(b.height)}@${Math.round(b.left)},${Math.round(b.top)}${k.disabled ? ' off' : ''}`; });
  const tape = rect('.rp-tape');
  return {
    s, taps, h: H, docH: document.documentElement.scrollHeight, scrolls: document.documentElement.scrollHeight > H + 1,
    strip: rect('.rp-strip'), tape, pad: rect('.rp-pad') || rect('.rp-summary'), bar: rect('.rp-bar'), undo: rect('.sb-bar'),
    padShare: tape ? +((H - tape[0]) / H).toFixed(2) : null,
    keys, small, minContrast: +min.toFixed(2), fails, gradientText: gradients,
  };
}
window.__audit = audit();
console.log('KBS1_AUDIT', JSON.stringify(window.__audit));
