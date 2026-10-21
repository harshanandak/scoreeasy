// Route sweep (routing audit, docs/plans/2026-10-21-routing-audit.md).
//
// Drives headless Chrome over the DevTools protocol at a phone viewport
// (390x844), visits every route as a guest in a fresh browser context, and
// records the final URL, visible heading, page text, bottom-nav and dialog
// state, and console errors. Cases can seed localStorage and run click / Back
// steps, which is how the Back-stack findings were reproduced.
//
// Usage (dev server must already be running):
//   bunx vite --port 5193 --strictPort
//   node scripts/route-sweep.mjs out.json
// Env: BASE (default http://localhost:5193), CHROME (path to chrome.exe),
//      ONLY (regex on case label), SETTLE_MS, CONCURRENCY, SHOTS (screenshot dir).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:5193';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9339;
const SETTLE_MS = Number(process.env.SETTLE_MS || 6500);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const OUT = process.argv[2] || 'results.json';
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const now = Date.now();
const iso = new Date(now).toISOString();
const TENNIS_ID = 1761000000000;
const blankSet = { games1: 0, games2: 0, points1: 0, points2: 0, isDeuce: false, advantage: null, isTiebreak: false, tiebreakPoints1: 0, tiebreakPoints2: 0, completed: false };
const wonSet = { ...blankSet, games1: 6, games2: 0, completed: true };

const seeds = {
  resumeCatalog: {
    [`se_tennis_quick_draft_${TENNIS_ID}`]: { id: TENNIS_ID, sport: 'tennis', team1Name: 'Ana', team2Name: 'Bea', format: { sets: 3 }, status: 'in-progress', updatedAt: iso },
    se_quickmatch_draft_volleyball: { phase: 'scoring', sport: 'volleyball', team1Name: 'Sharks', team2Name: 'Jets', vScore1: 12, vScore2: 9, sets: [{ score1: 12, score2: 9, completed: false }], currentSet: 0, updatedAt: iso },
    se_quickmatches: [{ id: 123, sport: 'cricket', team1: 'Red', team2: 'Blue', team1Id: 'team1', team2Id: 'team2', format: { totalInnings: 4 }, innings: [], status: 'in-progress', updatedAt: iso }],
    se_football: [100, 101, 102].map((id) => ({ id, name: `Sunday League ${id}`, type: 'round-robin', mode: 'tournament', phase: 'group', format: {}, createdAt: iso, winnerMode: 'table-topper', knockoutMatches: [], teams: [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }], matches: [{ id: 'm1', team1Id: 't1', team2Id: 't2', status: 'pending' }] })),
  },
  tennisDraft: {
    [`se_tennis_quick_draft_${TENNIS_ID}`]: { id: TENNIS_ID, sport: 'tennis', team1: 'Ana', team2: 'Bea', team1Name: 'Ana', team2Name: 'Bea', format: { sets: 3 }, status: 'in-progress', sets: null, date: iso, createdAt: iso, updatedAt: iso },
  },
  tennisDraftWon: {
    [`se_tennis_quick_draft_${TENNIS_ID}`]: { id: TENNIS_ID, sport: 'tennis', team1: 'Ana', team2: 'Bea', team1Name: 'Ana', team2Name: 'Bea', format: { sets: 3 }, status: 'in-progress', sets: null, date: iso, createdAt: iso, updatedAt: iso, draftState: { currentSet: 2, sets: [wonSet, wonSet, blankSet], history: [], savedAt: iso } },
  },
  twoDrafts: {
    [`se_tennis_quick_draft_${TENNIS_ID}`]: { id: TENNIS_ID, sport: 'tennis', team1: 'Ana', team2: 'Bea', team1Name: 'Ana', team2Name: 'Bea', format: { sets: 3 }, status: 'in-progress', sets: null, date: iso, createdAt: iso, updatedAt: iso },
    se_quickmatch_draft_volleyball: { phase: 'scoring', sport: 'volleyball', team1Name: 'Sharks', team2Name: 'Jets', vScore1: 12, vScore2: 9, updatedAt: iso, savedAt: iso },
  },
  football: {
    se_football: [{ id: 100, name: 'Sunday League', type: 'round-robin', mode: 'tournament', phase: 'group', format: {}, createdAt: iso, winnerMode: 'table-topper', knockoutConfig: null, knockoutMatches: [], teams: [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }], matches: [{ id: 'm1', team1Id: 't1', team2Id: 't2', score1: null, score2: null, status: 'pending' }] }],
  },
  volleyballDone: {
    se_volleyball: [{ id: 200, name: 'Beach Cup', type: 'round-robin', mode: 'tournament', phase: 'group', format: { sets: 3, pointsPerSet: 25 }, createdAt: iso, winnerMode: 'table-topper', knockoutConfig: null, knockoutMatches: [], teams: [{ id: 't1', name: 'Sharks' }, { id: 't2', name: 'Jets' }], matches: [{ id: 'm1', team1Id: 't1', team2Id: 't2', status: 'completed', winner: 't1', setsWon1: 2, setsWon2: 0, sets: [{ score1: 25, score2: 20, completed: true }, { score1: 25, score2: 18, completed: true }], completedAt: iso }] }],
  },
  stringIdFootball: {
    se_football: [{ id: 'fx', name: 'Imported League', type: 'round-robin', mode: 'tournament', phase: 'group', format: {}, createdAt: iso, winnerMode: 'table-topper', knockoutConfig: null, knockoutMatches: [], teams: [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }], matches: [{ id: 'm1', team1Id: 't1', team2Id: 't2', score1: null, score2: null, status: 'pending' }] }],
  },
  legacySession: {
    gs_sessions: [{ id: 'sess-1', name: 'Volleyball Session', status: 'active', participants: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], scores: { p1: { total: 3 }, p2: { total: 1 } }, createdAt: iso }],
  },
  browseMode: { se_play_mode: 'browse' },
  volleyDraftOnly: { se_quickmatch_draft_volleyball: { phase: 'scoring', sport: 'volleyball', team1Name: 'Sharks', team2Name: 'Jets', vScore1: 12, vScore2: 9, updatedAt: iso, savedAt: iso } },
};

// [label, path, seedName?, steps?]
const cases = [
  ['RA3 all resumable matches on Home', '/', 'resumeCatalog'],
  ['RA3 resume tennis from Home', '/app', 'resumeCatalog', [
    { click: 'button', aria: 'Resume Tennis: Ana vs Bea' }, { wait: 5000 }, { reload: true }, { wait: 5000 },
  ]],
  ['RA3 resume cricket Test from Home', '/app', 'resumeCatalog', [
    { click: 'button', aria: 'Resume Cricket: Red vs Blue' }, { wait: 5000 }, { reload: true }, { wait: 5000 },
  ]],
  ['RA3 resume third tournament from Home', '/app', 'resumeCatalog', [
    { click: 'button', aria: 'Resume Football: Sunday League 102' }, { wait: 5000 },
  ]],
  ['RA3 resume volleyball from Home', '/app', 'resumeCatalog', [
    { click: 'button', aria: 'Resume Volleyball: Sharks vs Jets' }, { wait: 5000 }, { reload: true }, { wait: 5000 },
  ]],
  // App shell + public
  ['root resolver', '/'],
  ['marketing', '/marketing'],
  ['app dashboard', '/app'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['contact', '/contact'],
  ['login', '/login'],
  ['login returnTo', '/login?returnTo=%2Fhistory'],
  ['login evil returnTo', '/login?returnTo=%2F%2Fevil.example'],
  ['signin alias', '/signin?returnTo=%2Fhistory'],
  ['sign-in alias', '/sign-in'],
  ['signup', '/signup'],
  ['sso-callback', '/sso-callback'],
  ['onboarding (guest)', '/onboarding'],
  ['profile (guest)', '/profile'],
  ['profile/:username bad', '/profile/no-such-user-xyz'],
  ['users/search (guest)', '/users/search'],
  ['play', '/play'],
  ['play ?sport=cricket', '/play?sport=cricket'],
  ['play ?sport=cricket browse', '/play?sport=cricket', 'browseMode'],
  ['play ?sport=bogus', '/play?sport=bogus'],
  ['history', '/history'],
  // Legacy
  ['legacy dashboard', '/dashboard'],
  ['legacy quick-match', '/quick-match'],
  ['legacy quick-match tennis', '/quick-match?sport=tennis'],
  ['legacy quick-match bogus', '/quick-match?sport=bogus'],
  ['legacy tournament', '/tournament'],
  ['legacy tournament football', '/tournament?sport=football'],
  ['legacy stats', '/stats'],
  ['legacy statistics', '/statistics'],
  ['legacy game/:id unknown', '/game/123'],
  ['legacy game/:id tennis draft', `/game/${TENNIS_ID}`, 'tennisDraft'],
  // Spectator
  ['live bad token', '/live/not-a-real-token'],
  ['live empty token', '/live/'],
  ['live kiosk bad token', '/live/zzz?kiosk=1'],
  // Dead / unrouted links found in source
  ['dead /setup', '/setup'],
  ['dead /showcase/landing-designs', '/showcase/landing-designs'],
  ['showcase match-card (dev only)', '/showcase/match-card'],
  ['unknown path', '/this/does/not/exist'],
  // Sport quick
  ['volleyball quick', '/volleyball/quick'],
  ['tennis quick', '/tennis/quick'],
  ['cricket quick', '/cricket/quick'],
  ['football quick', '/football/quick'],
  ['pickleball quick (to deregister)', '/pickleball/quick'],
  ['bogus sport quick', '/madeupsport/quick'],
  ['uppercase sport', '/Volleyball/quick'],
  ['sport root only', '/volleyball'],
  ['quick trailing slash', '/volleyball/quick/'],
  // Sport tournament
  ['volleyball tournaments', '/volleyball/tournament'],
  ['volleyball tournament new', '/volleyball/tournament/new'],
  ['volleyball tournament bad id', '/volleyball/tournament/999'],
  ['volleyball tournament non-numeric id', '/volleyball/tournament/abc'],
  ['scorer bad ids', '/volleyball/tournament/999/match/1/score'],
  ['result bad ids', '/volleyball/tournament/999/match/1/result'],
  ['bogus sport tournament', '/madeupsport/tournament'],
  ['bogus sport tournament id', '/madeupsport/tournament/1'],
  ['tournament match (no /score)', '/volleyball/tournament/999/match/1'],
  // Cricket test / tennis live
  ['cricket test bad id', '/cricket/quick/test-match/999'],
  ['cricket test legacy', '/cricket/quick/test/999'],
  ['cricket test on volleyball', '/volleyball/quick/test-match/1'],
  ['tennis live bad id', '/tennis/quick/live/999'],
  ['tennis live good id', `/tennis/quick/live/${TENNIS_ID}`, 'tennisDraft'],
  ['tennis live on volleyball', '/volleyball/quick/live/1'],
  ['legacy tennis live', '/tennis/live/999'],
  ['legacy live on volleyball', '/volleyball/live/1'],
  // Seeded realistic
  ['root with one tennis draft', '/', 'tennisDraft'],
  ['root with two drafts', '/', 'twoDrafts'],
  ['app with two drafts', '/app', 'twoDrafts'],
  ['football tournament good', '/football/tournament/100', 'football'],
  ['football scorer good', '/football/tournament/100/match/m1/score', 'football'],
  ['football scorer bad match', '/football/tournament/100/match/zzz/score', 'football'],
  ['football result (not completed)', '/football/tournament/100/match/m1/result', 'football'],
  ['volleyball result completed', '/volleyball/tournament/200/match/m1/result', 'volleyballDone'],
  ['football tournament under wrong sport', '/basketball/tournament/100', 'football'],
  ['app with legacy session', '/app', 'legacySession'],
  // Flows (steps run after first settle)
  ['FLOW legacy session card -> /game/:id', '/app', 'legacySession', [
    { click: 'button', text: 'Resume' }, { wait: 4000 },
  ]],
  ['FLOW Back from untouched quick setup', '/app', 'browseMode', [
    { click: 'button', aria: 'Play' }, { wait: 3500 },
    { click: 'button', aria: 'Quick match: Volleyball' }, { wait: 3500 },
    { snap: 'on setup' },
    { back: true }, { wait: 1500 },
  ]],
  ['FLOW tennis quick Finish -> Back', '/app', 'tennisDraftWon', [
    { goto: `/tennis/quick/live/${TENNIS_ID}` }, { wait: 5000 },
    { snap: 'scorer (won)' },
    { click: 'button', text: 'Finish' }, { wait: 3000 },
    { snap: 'after Finish' },
    { back: true }, { wait: 3000 },
  ]],
  ['FLOW football Finish -> Back', '/football/tournament/100', 'football', [
    { click: 'button', text: 'Enter Score' }, { wait: 4000 },
    { snap: 'scorer' },
    { click: 'button', text: 'Finish' }, { wait: 2500 },
    { snap: 'after Finish' },
    { back: true }, { wait: 3000 },
  ]],
  ['FLOW result Done -> Back', '/volleyball/tournament/200', 'volleyballDone', [
    { goto: '/volleyball/tournament/200/match/m1/result' }, { wait: 4000 },
    { snap: 'result' },
    { back: true }, { wait: 3000 },
  ]],
  ['FLOW2 in-app back arrow on untouched quick setup', '/app', 'browseMode', [
    { click: 'button', aria: 'Play' }, { wait: 3500 },
    { click: 'button', aria: 'Quick match: Volleyball' }, { wait: 3500 },
    { click: 'button', aria: 'Go back' }, { wait: 1500 },
  ]],
  ['FLOW2 cricket test bad id is a dead end', '/app', null, [
    { goto: '/cricket/quick/test-match/999' }, { wait: 6000 },
    { snap: 'test scorer' },
    { back: true }, { wait: 1500 },
  ]],
  ['FLOW2 string tournament id scorer', '/football/tournament/fx', 'stringIdFootball', [
    { snap: 'tournament page' },
    { click: 'button', text: 'Enter Score' }, { wait: 5000 },
  ]],
  ['FLOW2 crash panel survives in-app navigation', '/live/not-a-real-token', null, [
    { snap: 'crashed' },
    { eval: "history.pushState({}, '', '/history'); dispatchEvent(new PopStateEvent('popstate'));" }, { wait: 3000 },
  ]],
  ['FLOW2 profile not-found Back on deep link', '/profile/no-such-user-xyz', null, [
    { click: 'button', text: 'Back' }, { wait: 2000 },
  ]],
  ['PROTO constructor quick', '/constructor/quick'],
  ['PROTO toString tournament', '/toString/tournament'],
  ['PROTO constructor tournament id', '/constructor/tournament/1'],
  ['FLOW3 Home on 404 with one draft', '/this/does/not/exist', 'tennisDraft', [
    { click: 'button', aria: 'Home' }, { wait: 4000 },
  ]],
  ['FLOW3 tournament list Home with one draft', '/volleyball/tournament', 'tennisDraft', [
    { click: 'button', text: 'Home' }, { wait: 4000 },
  ]],
  ['FLOW2 bottom-nav Home with one volleyball draft', '/play', 'volleyDraftOnly', [
    { click: 'button', aria: 'Home' }, { wait: 4000 },
  ]],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'se-audit-'));
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--window-size=390,844', '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });

  let version;
  for (let i = 0; i < 50; i += 1) {
    try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(200); }
  }
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map(); // sessionId -> fn
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
    } else if (msg.sessionId && listeners.has(msg.sessionId)) {
      listeners.get(msg.sessionId)(msg);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const SNAP = `(() => {
    const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const h = [...document.querySelectorAll('h1,h2')].find((el) => vis(el) && el.textContent.trim() && !el.classList.contains('sr-only'))
      || document.querySelector('h1');
    const main = document.querySelector('main') || document.body;
    const dialog = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].find(vis);
    return {
      url: location.pathname + location.search + location.hash,
      heading: h ? h.textContent.replace(/\\s+/g, ' ').trim().slice(0, 80) : '',
      text: (main.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 160),
      bottomNav: vis(document.querySelector('.global-bottom-nav')),
      dialog: dialog ? dialog.innerText.replace(/\\s+/g, ' ').trim().slice(0, 90) : '',
      historyLength: history.length,
      stuckLoading: /^(Loading\\.\\.\\.|Loading…)$/.test((main.innerText || '').trim()),
      resumeActions: [...document.querySelectorAll('button[aria-label^="Resume "]')].map((el) => ({ label: el.getAttribute('aria-label'), height: el.getBoundingClientRect().height })),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    };
  })()`;

  async function runCase([label, path, seedName, steps]) {
    const { browserContextId } = await send('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const errors = [];
    listeners.set(sessionId, (msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push(`exception: ${(d.exception?.description || d.text || '').split('\n')[0].slice(0, 160)}`);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 160)}`);
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        errors.push(`log: ${msg.params.entry.text.split('\n')[0].slice(0, 120)} ${msg.params.entry.url || ''}`.trim());
      }
    });
    await send('Runtime.enable', {}, sessionId);
    await send('Log.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
    if (seedName) {
      const seed = seeds[seedName];
      const script = `if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded','1'); ${Object.entries(seed).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(typeof v === 'string' ? v : JSON.stringify(v))});`).join(' ')} }`;
      await send('Page.addScriptToEvaluateOnNewDocument', { source: script }, sessionId);
    }
    await send('Page.navigate', { url: BASE + path }, sessionId);
    await sleep(SETTLE_MS);
    const evalSnap = async () => (await send('Runtime.evaluate', { expression: SNAP, returnByValue: true }, sessionId)).result.value;
    const result = { label, path, seed: seedName || '', ...(await evalSnap()), snaps: [] };
    if (steps) {
      for (const step of steps) {
        if (step.wait) await sleep(step.wait);
        else if (step.back) await send('Runtime.evaluate', { expression: 'history.back()' }, sessionId);
        else if (step.reload) await send('Page.reload', {}, sessionId);
        else if (step.goto) { await send('Page.navigate', { url: BASE + step.goto }, sessionId); }
        else if (step.eval) await send('Runtime.evaluate', { expression: step.eval }, sessionId);
        else if (step.snap) result.snaps.push({ at: step.snap, ...(await evalSnap()) });
        else if (step.click) {
          const expr = `(() => { const els = [...document.querySelectorAll(${JSON.stringify(step.click)})];
            const el = els.find((e) => e.getClientRects().length && (${JSON.stringify(step.aria || '')} ? e.getAttribute('aria-label') === ${JSON.stringify(step.aria || '')} || e.textContent.trim() === ${JSON.stringify(step.aria || '')} : e.textContent.includes(${JSON.stringify(step.text || '')})));
            if (!el) return 'NOT FOUND'; el.click(); return 'clicked'; })()`;
          const r = (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;
          result.snaps.push({ at: `click ${step.aria || step.text}: ${r}` });
        }
      }
      const final = await evalSnap();
      result.final = final;
    }
    result.errors = [...new Set(errors)].slice(0, 6);
    if (process.env.SHOTS) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      writeFileSync(join(process.env.SHOTS, `${label.replace(/[^a-z0-9]+/gi, '_')}.png`), Buffer.from(data, 'base64'));
    }
    listeners.delete(sessionId);
    await send('Target.closeTarget', { targetId });
    await send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
    return result;
  }

  const queue = cases.filter((c) => !ONLY || ONLY.test(c[0]));
  const results = [];
  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      try {
        const r = await runCase(c);
        results.push(r);
        console.log(`${r.label} | ${r.path} -> ${r.final ? r.final.url : r.url} | ${r.final ? r.final.heading : r.heading} | err=${r.errors.length}`);
      } catch (e) {
        results.push({ label: c[0], path: c[1], error: String(e) });
        console.log(`${c[0]} FAILED ${e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const order = new Map(cases.map((c, i) => [c[0], i]));
  results.sort((a, b) => order.get(a.label) - order.get(b.label));
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
