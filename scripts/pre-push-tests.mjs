import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
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
const sourceFile = /^(?:src|convex|scripts)\/|\.(?:[cm]?[jt]sx?|css|html)$/i;
const gitExecutable = (process.platform === 'win32'
  ? ['C:/Program Files/Git/cmd/git.exe', 'C:/Program Files (x86)/Git/cmd/git.exe']
  : ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git']
).find((path) => existsSync(path));

function git(args) {
  const result = spawnSync(gitExecutable, args, { encoding: 'utf8' });
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

function testEnvironment() {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  // Vitest also invokes Git internally when resolving --changed.
  env[pathKey] = [dirname(gitExecutable), dirname(process.execPath), env[pathKey]].filter(Boolean).join(delimiter);
  return env;
}

function main() {
  if (!gitExecutable) {
    console.error('[pre-push] Git not found in a standard installation directory. Install Git in Program Files on Windows, or /usr/bin, /usr/local/bin or /opt/homebrew/bin on Unix.');
    return 1;
  }
  const ref = spawnSync(gitExecutable, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (ref.error || ref.status !== 0) {
    console.error(`[pre-push] Missing base ${base}. ${recovery}`);
    return 1;
  }
  const ancestor = spawnSync(gitExecutable, ['merge-base', 'HEAD', base]);
  if (ancestor.error || ancestor.status !== 0) {
    console.error(`[pre-push] No common ancestor between HEAD and ${base}. ${recovery}`);
    return 1;
  }

  const entries = [...changes([`${base}...HEAD`]), ...changes(['HEAD'])];
  const paths = entries.flatMap((entry) => entry.paths);
  paths.push(...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean));
  const removed = entries.find((entry) => /^[DR]/.test(entry.status) && entry.paths.some((path) => sourceFile.test(path)));
  const environment = paths.find((path) => environmentFiles.some((pattern) => pattern.test(path)));
  const replacesConfig = paths.some((path) => configFile.test(path) || selectorFile.test(path));
  // Missing imports disappear from Vitest's graph; a replacement config can also
  // omit forceRerunTriggers. Both cases must choose full mode before Vitest loads.
  const reason = removed
    ? `tracked source deleted/renamed (${removed.paths.join(' -> ')})`
    : environment && `test environment changed (${environment})`;
  const args = ['run', 'test'];
  if (reason) {
    console.log(`[pre-push] Full suite: ${reason}${!removed && !replacesConfig ? ' via native forceRerunTriggers' : ''}.`);
  } else {
    console.log(`[pre-push] Related tests since ${base}; no related tests is an explicit success.`);
  }
  if (!removed && !replacesConfig) {
    args.push('--changed', base, environment ? '--passWithNoTests=false' : '--passWithNoTests');
  }
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: testEnvironment() });
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
