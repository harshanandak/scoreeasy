import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const absolute = (file) => path.join(root, file);
const source = (name) => readFile(absolute(`scripts/app-icon/${name}.svg`), 'utf8');
const tile = await source('a-icon-512');
const maskable = await source('a-icon-maskable-512');
const fullBleed = tile.replaceAll(' rx="114"', '');
const foreground = maskable.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/<rect[^>]*\/>/g, '');
const android = 'android/app/src/main/res';
const ios = 'ios/App/App/Assets.xcassets';
const evidence = 'docs/plans/2026-10-22-app-icon';
const outputs = [];

async function write(file, data) {
  await mkdir(path.dirname(absolute(file)), { recursive: true });
  await writeFile(absolute(file), data);
}

async function png(file, svg, width, height = width, opaque = false) {
  let raster = sharp(Buffer.from(svg)).resize(width, height);
  if (opaque) raster = raster.flatten({ background: '#00662a' }).removeAlpha();
  await write(file, await raster.png().toBuffer());
  const metadata = await sharp(absolute(file)).metadata();
  assert.equal(metadata.width, width, file);
  assert.equal(metadata.height, height, file);
  if (opaque) assert.equal(metadata.hasAlpha, false, file);
  outputs.push({ file, width, height });
}

for (const size of [192, 512]) {
  await write(`public/icons/icon-${size}.svg`, tile.replace('width="512" height="512"', `width="${size}" height="${size}"`));
  await png(`public/icons/icon-${size}.png`, tile, size);
  await png(`public/icons/icon-${size}-maskable.png`, maskable, size, size, true);
}
for (const size of [16, 32]) {
  const favicon = await source(`a-favicon-${size}`);
  await write(`public/icons/favicon-${size}.svg`, favicon);
  await png(`public/icons/favicon-${size}.png`, favicon, size);
}
await write('public/icons/favicon.svg', await source('a-favicon-32'));
await png('public/icons/apple-touch-icon.png', fullBleed, 180, 180, true);

const round = fullBleed.replace('</defs>', '<clipPath id="round"><circle cx="256" cy="256" r="256"/></clipPath></defs>')
  .replace('</defs>', '</defs><g clip-path="url(#round)">').replace('</svg>', '</g></svg>');
for (const [density, launcher, adaptive] of [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
]) {
  await png(`${android}/mipmap-${density}/ic_launcher.png`, tile, launcher);
  await png(`${android}/mipmap-${density}/ic_launcher_round.png`, round, launcher);
  await png(`${android}/mipmap-${density}/ic_launcher_foreground.png`, foreground, adaptive);
}

// The approved maskable SVG maps the 32-unit mark to translate(128,128) scale(8).
// Keep the same paths and 2.6 stroke in the vector used by Android adaptive icons.
const circle = '<path android:pathData="M2.5,16a13.5,13.5 0,1 0,27 0a13.5,13.5 0,1 0,-27 0"';
const paths = [circle, ...[...maskable.matchAll(/<path d="([^"]+)"/g)].map((match) => `<path android:pathData="${match[1]}"`)];
const vector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512">
    <group android:translateX="128" android:translateY="128" android:scaleX="8" android:scaleY="8">
${paths.map((entry) => `        ${entry} android:fillColor="#00000000" android:strokeColor="#FFFFFF" android:strokeWidth="2.6" android:strokeLineCap="round" android:strokeLineJoin="round"/>`).join('\n')}
    </group>
</vector>
`;
await write(`${android}/drawable-v24/ic_launcher_foreground.xml`, vector);
await write(`${android}/drawable/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/ic_launcher_background"/>
</shape>
`);
await write(`${android}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#00662a</color>
</resources>
`);
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  await write(`${android}/mipmap-anydpi-v26/${name}.xml`, `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
`);
}
await png(`${ios}/AppIcon.appiconset/AppIcon-512@2x.png`, fullBleed, 1024, 1024, true);

function splash(width, height) {
  const size = Math.round(Math.min(width, height) / 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#fafafa"/><svg x="${(width - size) / 2}" y="${(height - size) / 2}" width="${size}" height="${size}" viewBox="0 0 512 512">${tile.replace(/<svg[^>]*>/, '').replace('</svg>', '')}</svg></svg>`;
}
// Preserve every platform's existing splash dimensions and asset-catalog mapping.
for (const directory of await readdir(absolute(android), { withFileTypes: true })) {
  if (!directory.isDirectory() || !directory.name.startsWith('drawable')) continue;
  const files = await readdir(absolute(`${android}/${directory.name}`));
  if (!files.includes('splash.png')) continue;
  const file = `${android}/${directory.name}/splash.png`;
  const { width, height } = await sharp(absolute(file)).metadata();
  await png(file, splash(width, height), width, height, true);
}
for (const file of (await readdir(absolute(`${ios}/Splash.imageset`))).filter((name) => name.endsWith('.png')).sort()) {
  await png(`${ios}/Splash.imageset/${file}`, splash(2732, 2732), 2732, 2732, true);
}

// Every generated platform PNG gets its own labeled cell, including duplicate sizes.
const columns = 4, cellWidth = 360, cellHeight = 232;
const sheetWidth = columns * cellWidth;
const sheetHeight = Math.ceil(outputs.length / columns) * cellHeight + 64;
const composite = [];
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const labels = ['<text x="24" y="36" font-size="22" font-weight="bold">Score Easy — approved hand-drawn ball / Go green</text>'];
for (const [index, output] of outputs.entries()) {
  const left = (index % columns) * cellWidth;
  const top = Math.floor(index / columns) * cellHeight + 64;
  const thumbnail = await sharp(absolute(output.file)).resize(156, 156, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const { width, height } = await sharp(thumbnail).metadata();
  composite.push({ input: thumbnail, left: left + Math.floor((cellWidth - width) / 2), top: top + Math.floor((164 - height) / 2) });
  const parts = output.file.split('/');
  const lines = [parts.slice(0, -2).join('/'), parts.slice(-2).join('/'), `${output.width} × ${output.height}`];
  for (const [line, text] of lines.entries()) labels.push(`<text x="${left + 12}" y="${top + 180 + line * 16}" font-size="11">${escape(text)}</text>`);
}
const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}"><g font-family="sans-serif" fill="#17231c">${labels.join('')}</g></svg>`;
composite.push({ input: Buffer.from(labelSvg), left: 0, top: 0 });
await write(`${evidence}/contact-sheet.png`, await sharp({ create: { width: sheetWidth, height: sheetHeight, channels: 3, background: '#e4ebe6' } }).composite(composite).png().toBuffer());
await write(`${evidence}/generated-files.json`, `${JSON.stringify(outputs, null, 2)}\n`);
console.log(`Generated and checked ${outputs.length} PNGs, Android vectors, web SVGs and contact-sheet.png.`);
