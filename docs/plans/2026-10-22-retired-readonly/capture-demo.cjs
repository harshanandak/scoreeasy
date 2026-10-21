// Run against this worktree's Vite server. Playwright stays outside app dependencies:
// SCOREEASY_PLAYWRIGHT points to its installed module; SCOREEASY_BROWSER to Chrome.
const { chromium } = require(process.env.SCOREEASY_PLAYWRIGHT || 'playwright');
const { strict: assert } = require('node:assert');
const path = require('node:path');

const base = process.env.SCOREEASY_DEMO_URL || 'http://127.0.0.1:5178';
const draftKey = 'se_quickmatch_draft_pickleball';
const draft = {
  sport: 'pickleball', phase: 'scoring', team1Name: 'Dinks', team2Name: 'Lobs',
  format: { type: 'single', target: 11 }, vScore1: 10, vScore2: 7,
  currentSet: 0, servingTeam: 2, sets: [],
  vScoreHistory: [{ team: 1, vScore1: 9, vScore2: 7 }], gScoreHistory: [],
  updatedAt: '2026-01-01T10:00:00.000Z',
};
const retiredTournament = [{ id: 'saved-cup', name: 'Pickleball Cup',
  format: { type: 'single', target: 11 },
  teams: [{ id: 'a', name: 'Dinks' }, { id: 'b', name: 'Lobs' }],
  matches: [{ id: 'final', team1Id: 'a', team2Id: 'b', score1: 11, score2: 7,
    status: 'completed', winner: 'a', completedAt: '2026-01-01T10:00:00.000Z' }],
}];

async function seededContext(browser, seed) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((values) => {
    if (!sessionStorage.getItem('retired-demo-seeded')) {
      localStorage.clear();
      localStorage.setItem('se_migrated', '1');
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem('retired-demo-seeded', '1');
    }
    window.retiredWrites = [];
    for (const operation of ['setItem', 'removeItem']) {
      const original = Storage.prototype[operation];
      Storage.prototype[operation] = function (key, ...args) {
        if (key in values) window.retiredWrites.push({ operation, key });
        return original.call(this, key, ...args);
      };
    }
  }, seed);
  return context;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SCOREEASY_BROWSER });
  try {
    const context = await seededContext(browser, { [draftKey]: draft });
    const page = await context.newPage();
    await page.goto(`${base}/pickleball/quick`);
    await page.getByRole('button', { name: 'View saved match' }).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'retired-deep-link.png') });
    await page.getByRole('button', { name: 'View saved match' }).click();
    await page.getByText('This sport is retired; scoring is off', { exact: true }).waitFor();
    assert.match(await page.locator('.mono-history-detail').innerText(), /10 - 7 - Unfinished/);
    assert.equal(await page.getByRole('button', { name: /Resume|Rematch|Undo|Delete/i }).count(), 0);
    await page.locator('.mono-history-detail summary').click();
    await page.locator('.mono-history-detail').evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(__dirname, 'retired-pickleball-readonly.png') });
    assert.deepEqual(await page.evaluate(() => window.retiredWrites), []);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), draftKey), JSON.stringify(draft));
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(__dirname, 'unfinished-retired-history.png') });
    await page.reload();
    await page.getByRole('button', { name: 'View details: Dinks vs Lobs' }).waitFor();
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), draftKey), JSON.stringify(draft));
    assert.deepEqual(await page.evaluate(() => window.retiredWrites), []);
    await context.close();

    const returningContext = await seededContext(browser, { se_pickleball: retiredTournament });
    const returningPage = await returningContext.newPage();
    await returningPage.goto(`${base}/`);
    await returningPage.waitForURL(`${base}/app`);
    await returningPage.getByRole('navigation', { name: 'App navigation', exact: true }).waitFor();
    await returningPage.screenshot({ path: path.join(__dirname, 'retired-only-device-home.png') });
    assert.deepEqual(await returningPage.evaluate(() => window.retiredWrites), []);
    assert.equal(await returningPage.evaluate(() => localStorage.getItem('se_pickleball')), JSON.stringify(retiredTournament));
    assert.equal(await returningPage.getByRole('button', { name: /Resume/i }).count(), 0);
    await returningContext.close();
    console.log('PASS: 390x844; old draft 10-7 readable; no scoring or storage writes; reload retained; retired-only / -> /app; 4 screenshots.');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
