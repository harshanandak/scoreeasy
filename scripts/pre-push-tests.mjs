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
const configFile = /(?:^|\/)(?:vite|vitest)\.config\.[^/]+$/;
const selectorFile = /(?:^|\/)scripts\/pre-push-tests\.mjs$/;
const environmentFiles = [
  /(?:^|\/)package\.json$/,
  /(?:^|\/)bun\.lock$/,
  configFile,
  /(?:^|\/)tsconfig[^/]*\.json$/,
  /(?:^|\/)src\/test\//,
  selectorFile,
];

export function parseNameStatus(output) {
  const fields = output.split('\0');
  const entries = [];
  for (let index = 0; fields[index];) {
    const status = fields[index++];
    const paths = [fields[index++]];
    if (/^[RC]/.test(status)) paths.push(fields[index++]);
    entries.push({ status, paths });
  }
  return entries;
}

export function choosePlan({ changes = [], baseOk, mergeBaseOk = true }) {
  if (!baseOk) {
    return { mode: 'blocked', message: `Missing base ${base}. ${recovery}` };
  }
  if (!mergeBaseOk) {
    return { mode: 'blocked', message: `No common ancestor between HEAD and ${base}. ${recovery}` };
  }
  const paths = changes.flatMap((entry) => entry.paths);
  const removed = changes.find((entry) => /^[DR]/.test(entry.status));
  const environment = paths.find((path) => environmentFiles.some((pattern) => pattern.test(path)));
  const replacesConfig = paths.some((path) => configFile.test(path) || selectorFile.test(path));
  // Missing imports disappear from Vitest's graph; a replacement config can also
  // omit forceRerunTriggers. Both cases must choose full mode before Vitest loads.
  const reason = removed
    ? `tracked file deleted/renamed (${removed.paths.join(' -> ')})`
    : environment && `test environment changed (${environment})`;
  return reason
    ? { mode: 'full', reason, nativeTriggers: !removed && !replacesConfig }
    : { mode: 'related' };
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot read Git changes. ${recovery}`);
  }
  return result.stdout;
}

function main() {
  const baseOk = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]).status === 0;
  const mergeBaseOk = baseOk && spawnSync('git', ['merge-base', 'HEAD', base]).status === 0;
  const changes = [];
  if (baseOk && mergeBaseOk) {
    for (const range of [`${base}...HEAD`, 'HEAD']) {
      changes.push(...parseNameStatus(git(['diff', '--name-status', '-z', '--find-renames', range])));
    }
    changes.push(...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')
      .filter(Boolean).map((path) => ({ status: '?', paths: [path] })));
  }
  const plan = choosePlan({ changes, baseOk, mergeBaseOk });
  if (plan.mode === 'blocked') {
    console.error(`[pre-push] ${plan.message}`);
    return 1;
  }
  const related = plan.mode === 'related';
  console.log(related
    ? `[pre-push] Related tests since ${base}; no related tests is an explicit success.`
    : `[pre-push] Full suite: ${plan.reason}${plan.nativeTriggers ? ' via native forceRerunTriggers' : ''}.`);
  // Concurrent worktrees share laptop RAM; bound the local worker pool.
  const args = ['run', 'test', '--maxWorkers=2'];
  if (related || plan.nativeTriggers) {
    args.push('--changed', base, related ? '--passWithNoTests' : '--passWithNoTests=false');
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
