// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { changedPathsSince, checkEvidenceSize, selectOversizedImages } from './check-evidence-size.mjs';

const fixtures = {
  'docs/plans/new board.png': 250_001,
  'docs/plans/modified.PNG': 500_000,
  'docs/plans/at-limit.webp': 250_000,
  'docs/plans/small.jpg': 100,
  'docs/plans/untouched.png': 900_000,
  'docs/plans/renamed 日本語.svg': 300_000,
  'docs/plans/notes.md': 500_000,
  'public/large.png': 500_000,
  'docs-backup/large.png': 500_000,
};

describe('changed evidence image selection', () => {
  it('checks only changed docs images and enforces a strict 250 KB boundary', () => {
    const paths = Object.keys(fixtures).filter((path) => !path.includes('untouched'));
    expect(selectOversizedImages(paths, (path) => fixtures[path])).toEqual([
      { path: 'docs/plans/new board.png', bytes: 250_001 },
      { path: 'docs/plans/modified.PNG', bytes: 500_000 },
      { path: 'docs/plans/renamed 日本語.svg', bytes: 300_000 },
    ]);
  });

  it('does not inspect untouched images, deleted paths or non-images', () => {
    expect(selectOversizedImages(['docs/notes.md', 'public/large.png'], () => {
      throw new Error('must not stat unrelated files');
    })).toEqual([]);
    expect(selectOversizedImages([], () => { throw new Error('must not stat deleted files'); })).toEqual([]);
  });

  it('checks each path once and supports every documented image extension', () => {
    const paths = ['jpeg', 'gif', 'avif', 'bmp', 'tif', 'tiff', 'ico'].map((ext) => `docs/image.${ext}`);
    expect(selectOversizedImages([...paths, paths[0]], () => 250_001)).toHaveLength(paths.length);
  });

  it('selects real Git additions, modifications and rename destinations, excluding deletions and untouched files', () => {
    // Hooks export repository paths; the fixture must own its Git directory.
    const localGitEnv = execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
    for (const name of localGitEnv.trim().split('\n')) vi.stubEnv(name.trim(), undefined);
    const cwd = mkdtempSync(join(process.cwd(), 'node_modules/evidence-git-'));
    const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    const write = (name, bytes) => writeFileSync(join(cwd, 'docs', name), Buffer.alloc(bytes));
    try {
      git('init', '--quiet');
      git('config', 'user.name', 'Evidence fixture');
      git('config', 'user.email', 'fixture@example.invalid');
      mkdirSync(join(cwd, 'docs'));
      for (const name of ['untouched.png', 'modified.png', 'deleted.png', 'old.png']) write(name, 300_000);
      git('add', '.');
      git('commit', '--quiet', '-m', 'fixture base');
      const base = git('rev-parse', 'HEAD');
      write('modified.png', 300_001);
      write('added space 日本語.png', 250_001);
      write('at-limit.png', 250_000);
      unlinkSync(join(cwd, 'docs/deleted.png'));
      renameSync(join(cwd, 'docs/old.png'), join(cwd, 'docs/renamed.png'));
      git('add', '.');
      git('commit', '--quiet', '-m', 'fixture changes');
      expect(changedPathsSince(base, cwd).sort()).toEqual([
        'docs/added space 日本語.png', 'docs/at-limit.png', 'docs/modified.png', 'docs/renamed.png',
      ]);
      expect(checkEvidenceSize(base, cwd)).toBe(1);
      expect(checkEvidenceSize('HEAD', cwd)).toBe(0);
      expect(() => changedPathsSince('missing-ref', cwd)).toThrow();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      vi.unstubAllEnvs();
    }
  });
});
