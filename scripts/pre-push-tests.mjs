import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const forceRerunTriggers = [
  '**/package.json',
  '**/bun.lock',
  '**/vite.config.*',
  '**/vitest.config.*',
  '**/tsconfig*.json',
  '**/src/test/**',
  '**/scripts/pre-push-tests.mjs',
];

const base = 'origin/master';
const recovery = 'Run `git fetch origin master`. For a shallow clone, also run `git fetch --unshallow origin`, then retry.';
const environmentFile = /(?:^|\/)(?:package\.json|bun\.lock|(?:vite|vitest)\.config\.[^/]+|tsconfig[^/]*\.json)$|(?:^|\/)src\/test\/|(?:^|\/)scripts\/pre-push-tests\.mjs$/;
const sourceFile = /^(?:src|convex|scripts)\/|\.(?:[cm]?[jt]sx?|css|html)$/i;

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot read Git changes. ${recovery}`);
  }
  return result.stdout;
}

function changes(args) {
  const fields = git(['diff', '--name-status', '-z', '--find-renames', ...args]).split('\0');
  const entries = [];
  for (let index = 0; fields[index];) {
    const status = fields[index++];
    const paths = [fields[index++]];
    if (/^[RC]/.test(status)) paths.push(fields[index++]);
    entries.push({ status, paths });
  }
  return entries;
}

function main() {
  const ref = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (ref.error || ref.status !== 0) {
    console.error(`[pre-push] Missing base ${base}. ${recovery}`);
    return 1;
  }
  const ancestor = spawnSync('git', ['merge-base', 'HEAD', base]);
  if (ancestor.error || ancestor.status !== 0) {
    console.error(`[pre-push] No common ancestor between HEAD and ${base}. ${recovery}`);
    return 1;
  }

  const entries = [...changes([`${base}...HEAD`]), ...changes(['HEAD'])];
  const paths = entries.flatMap((entry) => entry.paths);
  paths.push(...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean));
  const removed = entries.find((entry) => /^[DR]/.test(entry.status) && entry.paths.some((path) => sourceFile.test(path)));
  const environment = paths.find((path) => environmentFile.test(path));
  // Missing imports disappear from Vitest's graph; a replacement config can also
  // omit forceRerunTriggers. Both cases must choose full mode before Vitest loads.
  const reason = removed
    ? `tracked source deleted/renamed (${removed.paths.join(' -> ')})`
    : environment && `test environment changed (${environment})`;
  const args = ['run', 'test'];
  if (reason) {
    console.log(`[pre-push] Full suite: ${reason}.`);
  } else {
    console.log(`[pre-push] Related tests since ${base}; no related tests is an explicit success.`);
    args.push('--changed', base, '--passWithNoTests');
  }
  const result = spawnSync('bun', args, { stdio: 'inherit' });
  if (result.error) console.error(`[pre-push] Cannot start tests: ${result.error.message}`);
  return result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`[pre-push] ${error.message}`);
    process.exitCode = 1;
  }
}
