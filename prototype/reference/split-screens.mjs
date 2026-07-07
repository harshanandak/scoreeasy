// Splits the HiFi mockup board (hifi-source.html) into per-screen HTML fragments.
// Each screen is an absolutely-positioned <div id="Ng" data-game="..."> on the canvas.
// Output: reference/screens/<id>-<slug>.html + reference/manifest.json + reference/global.css
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, 'hifi-source.html'), 'utf8');

// Global <style> blocks (design language: fonts, keyframes, shared rules)
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
writeFileSync(join(here, 'global.css'), styles.join('\n\n/* ---- next style block ---- */\n\n'));

// Script blocks (render helpers)
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
writeFileSync(join(here, 'global-script.js'), scripts.join('\n\n// ---- next script block ----\n\n'));

// Find each top-level screen div by id and balance its tags to slice the full subtree.
const ids = [...html.matchAll(/<div[^>]*\bid="(\d[a-z])"/g)].map(m => ({ id: m[1], start: m.index }));
function sliceBalanced(src, start) {
  let depth = 0, i = start;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(src))) {
    if (m[0][1] === '/') depth--; else if (!m[0].endsWith('/>')) depth++;
    if (depth === 0) return src.slice(start, m.index + m[0].length);
  }
  return null;
}

mkdirSync(join(here, 'screens'), { recursive: true });
const manifest = [];
for (const { id, start } of ids) {
  const frag = sliceBalanced(html, start);
  if (!frag) { console.error('UNBALANCED', id); continue; }
  const game = (frag.match(/data-game="([^"]+)"/) || [])[1] || 'generic';
  const label = (frag.match(/data-screen-label="([^"]+)"/) || [])[1] || id;
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const file = `${id}-${slug}.html`;
  writeFileSync(join(here, 'screens', file), frag);
  manifest.push({ id, game, label, file, bytes: frag.length });
  console.log(id, game, label, `${(frag.length / 1024).toFixed(1)}KB`);
}
writeFileSync(join(here, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('screens:', manifest.length, '| css blocks:', styles.length, '| scripts:', scripts.length);
