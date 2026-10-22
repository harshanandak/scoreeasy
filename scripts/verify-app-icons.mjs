import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');
const outputs = JSON.parse(await read('docs/plans/2026-10-22-app-icon/generated-files.json'));
for (const { file, width, height } of outputs) {
  const metadata = await sharp(path.join(root, file)).metadata();
  assert.equal(metadata.width, width, file);
  assert.equal(metadata.height, height, file);
  if (file.includes('/AppIcon.') || file.includes('-maskable.') || file.endsWith('apple-touch-icon.png') || file.includes('/splash')) {
    assert.equal(metadata.hasAlpha, false, `${file} must be opaque`);
  }
}
// Android keeps the white foreground within the central 66% circle, not just a square.
const { data, info } = await sharp(path.join(root, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let visiblePixels = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] === 0) continue;
    visiblePixels++;
    assert.ok(Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) <= info.width * 0.33, 'Adaptive mark exceeds the 66% safe zone');
  }
}
assert.ok(visiblePixels > 0, 'Adaptive foreground must not be blank');
const manifest = JSON.parse(await read('dist/manifest.webmanifest'));
let references = 0;
for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((shortcut) => shortcut.icons)]) {
  const file = path.join(root, 'dist', icon.src.replace(/^\//, ''));
  await access(file);
  if (icon.type === 'image/png') {
    const { width, height } = await sharp(file).metadata();
    assert.equal(icon.sizes, `${width}x${height}`, icon.src);
  }
  references++;
}
const html = await read('dist/index.html');
const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => tag).filter((tag) => /rel="(?:icon|apple-touch-icon)"/.test(tag));
assert.equal(links.length, 4, 'Expected 16/32 PNG, SVG and apple-touch-icon links');
for (const link of links) await access(path.join(root, 'dist', link.match(/href="([^"]+)"/)[1].replace(/^\//, '')));
console.log(`Verified ${outputs.length} PNG dimensions, opaque native/touch/maskable assets, Android 66% safe zone, ${references} built manifest icon references and ${links.length} favicon/touch links.`);
