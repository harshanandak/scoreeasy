import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

async function collectPngs(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) return [];
  if (info.isDirectory()) {
    const children = await readdir(path);
    return (await Promise.all(children.sort().map((name) => collectPngs(join(path, name))))).flat();
  }
  return info.isFile() && /\.png$/i.test(path) ? [path] : [];
}

export async function compressEvidence(paths) {
  if (!paths.length) throw new Error('Usage: bun run evidence:compress <files-or-directories...>');
  const files = [...new Set((await Promise.all(paths.map((path) => collectPngs(resolve(path))))).flat())];
  let before = 0;
  let after = 0;
  let changed = 0;
  for (const path of files) {
    const original = await readFile(path);
    const metadata = await sharp(original).metadata();
    if (metadata.pages > 1) throw new Error(`Animated PNG is unsupported: ${path}`);
    const result = await sharp(original)
      .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9 }).toBuffer();
    const compressedMetadata = await sharp(result).metadata();
    if (metadata.width !== compressedMetadata.width || metadata.height !== compressedMetadata.height) {
      throw new Error(`Dimensions changed: ${path}`);
    }
    const smaller = result.length < original.length;
    if (smaller) {
      await writeFile(path, result);
      changed += 1;
    }
    before += original.length;
    after += smaller ? result.length : original.length;
    console.log(`${path}: ${original.length} -> ${smaller ? result.length : original.length} bytes${smaller ? '' : ' (skipped)'}`);
  }
  console.log(`Total: ${files.length} PNGs, ${changed} compressed; ${before} -> ${after} bytes (${(before / 1e6).toFixed(2)} -> ${(after / 1e6).toFixed(2)} MB).`);
  return { files: files.length, changed, before, after };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  compressEvidence(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
