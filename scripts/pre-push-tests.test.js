// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, linkSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const fixtures = [];
const gitLocalVariables = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
if (gitLocalVariables.status !== 0) throw new Error('Cannot identify Git repository-local environment variables');

function run(root, command, args, overrides = {}) {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  for (const [name, value] of Object.entries(overrides)) {
    const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase()) ?? name;
    env[key] = value;
  }
  // Hooks export repository-local Git state; foreign fixture repositories must
  // clear those variables as prescribed by githooks(5).
  for (const name of gitLocalVariables.stdout.trim().split('\n')) delete env[name.trim()];
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env,
    timeout: 40000,
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'scoreeasy-prepush-'));
  fixtures.push(root);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'src/test'), { recursive: true });
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'junction');
  writeFileSync(join(root, 'scripts/pre-push-tests.mjs'), readFileSync(join(repo, 'scripts/pre-push-tests.mjs')));
  writeFileSync(join(root, 'lefthook.yml'), readFileSync(join(repo, 'lefthook.yml')));
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: { test: 'vitest run --maxWorkers=1' } }));
  writeFileSync(join(root, 'vite.config.js'), `import { forceRerunTriggers } from './scripts/pre-push-tests.mjs';
export default { test: { globals: true, environment: 'node', forceRerunTriggers, setupFiles: './src/test/setup.js' } };\n`);
  writeFileSync(join(root, 'src/test/setup.js'), '// setup\n');
  writeFileSync(join(root, 'leaf.js'), 'export const value = 42;\n');
  writeFileSync(join(root, 'middle.js'), "export { value } from './leaf.js';\n");
  writeFileSync(join(root, 'leaf.test.js'), "import { value } from './middle.js'; it('uses the leaf', () => expect(value).toBe(42));\n");
  writeFileSync(join(root, 'unrelated.test.js'), "it('unrelated sentinel', () => expect(true).toBe(true));\n");
  for (const args of [
    ['init', '--quiet'], ['config', 'user.name', 'Hook fixture'],
    ['config', 'user.email', 'hook-fixture@example.invalid'], ['add', '.'],
    ['commit', '--quiet', '-m', 'fixture baseline'], ['update-ref', 'refs/remotes/origin/master', 'HEAD'],
  ]) {
    const result = run(root, 'git', args);
    expect(result.status, result.output).toBe(0);
  }
  return root;
}

function hook(root) {
  return run(root, process.execPath, [join(repo, 'node_modules/lefthook/bin/index.js'), 'run', 'pre-push', '--force', '--colors', 'off']);
}

afterEach(() => {
  // Every target is the exact directory returned by mkdtempSync above.
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('real pre-push hook selection', () => {
  it('ignores substituted git and bun executables at the front of PATH', () => {
    const root = fixture();
    const bun = run(root, 'bun', ['--print', 'process.execPath']);
    expect(bun.status, bun.output).toBe(0);
    const traps = join(root, 'traps');
    mkdirSync(traps);
    const suffix = process.platform === 'win32' ? '.exe' : '';
    copyFileSync(process.execPath, join(traps, `git${suffix}`));
    linkSync(join(traps, `git${suffix}`), join(traps, `bun${suffix}`));
    writeFileSync(join(root, 'leaf.js'), 'export const value = 42; // changed\n');
    const result = run(root, bun.output.trim(), ['scripts/pre-push-tests.mjs'], {
      PATH: [traps, process.env.PATH].join(delimiter),
    });
    expect(result.status, result.output).toBe(0);
    expect(result.output).toMatch(/Test Files\s+1 passed \(1\)/);
  }, 45000);

  it('isolates foreign repositories from exported hook Git state', () => {
    const parent = fixture();
    const priorDir = process.env.GIT_DIR;
    const priorImplicit = process.env.GIT_IMPLICIT_WORK_TREE;
    try {
      process.env.GIT_DIR = join(parent, '.git');
      process.env.GIT_IMPLICIT_WORK_TREE = '0';
      const child = fixture();
      const actual = statSync(run(child, 'git', ['rev-parse', '--show-toplevel']).output.trim());
      const expected = statSync(child);
      expect({ dev: actual.dev, ino: actual.ino }).toEqual({ dev: expected.dev, ino: expected.ino });
      expect(run(parent, 'git', ['rev-parse', '--is-bare-repository']).output.trim()).toBe('false');
    } finally {
      if (priorDir === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = priorDir;
      if (priorImplicit === undefined) delete process.env.GIT_IMPLICIT_WORK_TREE;
      else process.env.GIT_IMPLICIT_WORK_TREE = priorImplicit;
    }
  }, 45000);

  it('selects a transitive source test and supports detached HEAD', () => {
    const root = fixture();
    expect(run(root, 'git', ['checkout', '--detach', '--quiet']).status).toBe(0);
    writeFileSync(join(root, 'leaf.js'), 'export const value = 42; // changed\n');
    const result = hook(root);
    console.log(`EDITED SOURCE / DETACHED HEAD\n${result.output}`);
    expect(result.status).toBe(0);
    expect(result.output).toContain('Related tests since origin/master');
    expect(result.output).toMatch(/Test Files\s+1 passed \(1\)/);
  }, 45000);

  it('runs the full suite and fails for a deleted transitive import', () => {
    const root = fixture();
    rmSync(join(root, 'leaf.js'));
    const result = hook(root);
    console.log(`DELETED IMPORTED SOURCE\n${result.output}`);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('Full suite: tracked source deleted/renamed');
    expect(result.output).toMatch(/Test Files\s+1 failed \| 1 passed \(2\)/);
    expect(result.output).toContain('leaf.js');
  }, 45000);

  it('runs the full suite for a staged source rename', () => {
    const root = fixture();
    expect(run(root, 'git', ['mv', 'leaf.js', 'renamed.js']).status).toBe(0);
    writeFileSync(join(root, 'middle.js'), "export { value } from './renamed.js';\n");
    const result = hook(root);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('Full suite: tracked source deleted/renamed');
    expect(result.output).toMatch(/Test Files\s+2 passed \(2\)/);
  }, 45000);

  it.each(['package.json', 'bun.lock', 'vitest.config.js', 'src/test/setup.js', 'tsconfig.json'])('runs all tests for %s', (path) => {
    const root = fixture();
    const value = path === 'package.json' ? readFileSync(join(root, path), 'utf8') + '\n'
      : path === 'vitest.config.js' ? 'export default { test: { globals: true } };\n'
        : path === 'tsconfig.json' ? '{}' : '// changed\n';
    writeFileSync(join(root, path), value);
    const result = hook(root);
    if (path === 'vitest.config.js') console.log(`CONFIG REPLACEMENT (NO NATIVE TRIGGERS)\n${result.output}`);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('Full suite: test environment changed');
    if (path !== 'vitest.config.js') expect(result.output).toContain('via native forceRerunTriggers');
    expect(result.output).toMatch(/Test Files\s+2 passed \(2\)/);
  }, 45000);

  it('runs all tests when the Vite config is renamed', () => {
    const root = fixture();
    renameSync(join(root, 'vite.config.js'), join(root, 'vite.config.mjs'));
    const result = hook(root);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('Full suite:');
    expect(result.output).toMatch(/Test Files\s+2 passed \(2\)/);
  }, 45000);

  it('reports no related tests explicitly for docs-only edits', () => {
    const root = fixture();
    writeFileSync(join(root, 'README.md'), 'Docs only\n');
    const result = hook(root);
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain('No test files found, exiting with code 0');
  }, 45000);

  it('explains how to recover a missing base', () => {
    const root = fixture();
    expect(run(root, 'git', ['update-ref', '-d', 'refs/remotes/origin/master']).status).toBe(0);
    const result = hook(root);
    console.log(`MISSING BASE\n${result.output}`);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('Missing base origin/master');
    expect(result.output).toContain('git fetch origin master');
    expect(result.output).toContain('git fetch --unshallow origin');
    expect(result.output).not.toContain('vitest run');
  }, 45000);

  it('explains how to recover history with no common ancestor', () => {
    const root = fixture();
    const tree = run(root, 'git', ['rev-parse', 'HEAD^{tree}']).output.trim();
    const unrelated = run(root, 'git', ['commit-tree', tree, '-m', 'unrelated root']).output.trim();
    expect(run(root, 'git', ['update-ref', 'refs/remotes/origin/master', unrelated]).status).toBe(0);
    const result = hook(root);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('No common ancestor between HEAD and origin/master');
    expect(result.output).toContain('git fetch --unshallow origin');
    expect(result.output).not.toContain('vitest run');
  }, 45000);
});
