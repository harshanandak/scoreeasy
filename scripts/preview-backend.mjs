import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function choosePreviewBackend(paths, sharedUrl) {
  // Either dependency file can change Convex tooling or transitive backend code.
  const backendChanged = paths.some((path) => path.startsWith('convex/') || path === 'package.json' || path === 'bun.lock');
  return backendChanged || !sharedUrl ? 'isolated' : 'shared';
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
  const mode = choosePreviewBackend(paths, sharedUrl);
  if (!sharedUrl) console.log('::notice::PREVIEW_VITE_CONVEX_URL is unset; using the isolated per-PR backend fallback.');
  appendFileSync(output, `mode=${mode}\nlabel=${mode === 'shared' ? 'shared preview backend' : 'isolated per-PR backend'}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
