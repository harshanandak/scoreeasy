// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { compressEvidence } from './compress-evidence.mjs';

it('compresses nested PNG fixtures once, preserves dimensions and skips larger results', async () => {
  const root = await mkdtemp(join(process.cwd(), 'node_modules/evidence-png-'));
  try {
    await mkdir(join(root, 'nested'));
    const path = join(root, 'nested', 'board.PNG');
    const original = await sharp({ create: { width: 390, height: 844, channels: 4,
      background: '#00662a' } }).png({ compressionLevel: 0 }).toBuffer();
    await writeFile(path, original);
    await writeFile(join(root, 'notes.txt'), 'leave unchanged');
    const first = await compressEvidence([root, path]);
    expect(first.files).toBe(1);
    expect(first.changed).toBe(1);
    expect(first.after).toBeLessThan(first.before);
    expect(await sharp(path).metadata()).toMatchObject({ width: 390, height: 844 });
    const compressed = await readFile(path);
    expect((await compressEvidence([root])).changed).toBe(0);
    expect(await readFile(path)).toEqual(compressed);
    expect(await readFile(join(root, 'notes.txt'), 'utf8')).toBe('leave unchanged');
    await expect(compressEvidence([])).rejects.toThrow('Usage:');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
