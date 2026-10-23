import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// package.json fields that change what gets installed. Scripts, metadata and
// tool config don't reach the Convex backend.
const INSTALL_FIELDS = [
  'dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies',
  'overrides', 'resolutions', 'patchedDependencies', 'trustedDependencies', 'workspaces',
];

export function packageInstallChanged(baseText, headText) {
  let base;
  let head;
  try {
    base = JSON.parse(baseText);
    head = JSON.parse(headText);
  } catch {
    return true; // Missing or unreadable on either side: assume it matters.
  }
  return INSTALL_FIELDS.some((field) => JSON.stringify(base?.[field] ?? null) !== JSON.stringify(head?.[field] ?? null));
}

export function choosePreviewBackend(paths, sharedUrl, packageJsonInstallChanged = true) {
  // bun.lock always counts: it pins the Convex CLI and transitive backend code.
  // package.json counts only when its install fields change.
  const backendChanged = paths.some((path) => path.startsWith('convex/') || path === 'bun.lock'
    || (path === 'package.json' && packageJsonInstallChanged));
  return backendChanged || !sharedUrl ? 'isolated' : 'shared';
}

function showFile(sha, path) {
  try {
    return execFileSync('git', ['show', `${sha}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function main() {
  const { PR_BASE_SHA: base, PR_HEAD_SHA: head, PREVIEW_VITE_CONVEX_URL: sharedUrl, GITHUB_OUTPUT: output } = process.env;
  if (!/^[a-f0-9]{40}$/.test(base ?? '') || !/^[a-f0-9]{40}$/.test(head ?? '')) {
    throw new Error('Expected PR base and head commit SHAs.');
  }
  // Full checkout history includes the merge base. No rename detection: moving
  // a function out of convex/ must still count as a backend deletion.
  const paths = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', `${base}...${head}`], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
  let installChanged = true;
  if (paths.includes('package.json')) {
    const mergeBase = execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim();
    installChanged = packageInstallChanged(showFile(mergeBase, 'package.json'), showFile(head, 'package.json'));
    if (!installChanged) console.log('::notice::package.json changed outside its dependency fields; it does not need an isolated backend.');
  }
  const mode = choosePreviewBackend(paths, sharedUrl, installChanged);
  if (!sharedUrl) console.log('::notice::PREVIEW_VITE_CONVEX_URL is unset; using the isolated per-PR backend fallback.');
  appendFileSync(output, `mode=${mode}\nlabel=${mode === 'shared' ? 'shared preview backend' : 'isolated per-PR backend'}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
