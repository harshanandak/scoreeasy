import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_IMAGE_BYTES = 250_000;
const imagePath = /^docs\/.*\.(png|jpe?g|webp|gif|avif|svg|bmp|tiff?|ico)$/i;

export function selectOversizedImages(changedPaths, sizeOf) {
  return [...new Set(changedPaths)]
    .filter((path) => imagePath.test(path))
    .map((path) => ({ path, bytes: sizeOf(path) }))
    .filter(({ bytes }) => bytes > MAX_IMAGE_BYTES);
}

export function changedPathsSince(base, cwd = process.cwd()) {
  // NUL separators preserve spaces, Unicode, tabs and newlines in filenames.
  // Treat renames as delete/add so a renamed oversized image is checked too.
  return execFileSync('git', [
    'diff', '--name-only', '-z', '--no-renames', '--diff-filter=ACMT', base, 'HEAD', '--', 'docs/',
  ], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
}

export function checkEvidenceSize(base, cwd = process.cwd()) {
  if (!base) throw new Error('Usage: bun run evidence:check <base-ref>');
  const oversized = selectOversizedImages(changedPathsSince(base, cwd),
    (path) => statSync(resolve(cwd, path)).size);
  if (oversized.length) {
    for (const { path, bytes } of oversized) console.error(`${path}: ${bytes} bytes (limit ${MAX_IMAGE_BYTES})`);
    console.error('Compress evidence before committing: bun run evidence:compress <paths...>');
    return 1;
  }
  console.log(`Changed docs images are within ${MAX_IMAGE_BYTES} bytes each.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = checkEvidenceSize(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
