// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { previewCandidates, runCleanup } from './convex-preview-cleanup.mjs';
import { choosePreviewBackend, packageInstallChanged } from './preview-backend.mjs';

const deployment = (overrides = {}) => ({
  kind: 'cloud', name: 'happy-otter-123', deploymentType: 'preview',
  projectId: 42, previewIdentifier: 'pr-17', reference: 'preview/pr-17',
  ...overrides,
});
const pull = (overrides = {}) => ({
  number: 17, state: 'closed',
  base: { repo: { full_name: 'owner/repo' } },
  head: { repo: { full_name: 'owner/repo' } },
  ...overrides,
});
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const config = (overrides = {}) => ({
  eventName: 'workflow_dispatch', repository: 'owner/repo', projectId: '42',
  teamToken: 'fixture-convex', githubToken: 'fixture-github', dryRun: true,
  ...overrides,
});
const closeEvent = {
  action: 'closed', pull_request: pull(),
};
const harness = (...responses) => ({
  fetchImpl: vi.fn(async () => {
    if (!responses.length) throw new Error('Unexpected network request');
    return responses.shift();
  }),
  log: vi.fn(),
});

describe('preview backend selection', () => {
  it.each(['src/Board.jsx', 'docs/DEPLOY.md', '.github/workflows/ci.yml'])('shares the backend for %s', (path) => {
    expect(choosePreviewBackend([path], 'https://shared.convex.cloud')).toBe('shared');
  });
  it.each(['convex/schema.ts', 'convex/nested/function.ts', 'package.json', 'bun.lock'])('isolates %s even when a shared URL exists', (path) => {
    expect(choosePreviewBackend([path], 'https://shared.convex.cloud')).toBe('isolated');
  });
  it('falls back to isolated when the variable is unset', () => {
    expect(choosePreviewBackend(['src/Board.jsx'], '')).toBe('isolated');
  });
  it('handles an empty diff and unusual frontend filenames', () => {
    expect(choosePreviewBackend([], 'https://shared.convex.cloud')).toBe('shared');
    expect(choosePreviewBackend(['src/convex/a\nb.js'], 'https://shared.convex.cloud')).toBe('shared');
  });
  it('shares the backend when package.json changed outside its install fields', () => {
    expect(choosePreviewBackend(['package.json', 'scripts/x.mjs'], 'https://shared.convex.cloud', false)).toBe('shared');
    expect(choosePreviewBackend(['package.json', 'bun.lock'], 'https://shared.convex.cloud', false)).toBe('isolated');
    expect(choosePreviewBackend(['package.json', 'convex/a.ts'], 'https://shared.convex.cloud', false)).toBe('isolated');
    expect(choosePreviewBackend(['package.json'], '', false)).toBe('isolated');
  });
});

describe('package.json install-field changes', () => {
  const pkg = (overrides = {}) => JSON.stringify({
    name: 'scoreeasy', scripts: { test: 'vitest run' },
    dependencies: { convex: '^1.20.0', react: '^18.3.1' }, devDependencies: { vitest: '^3.0.0' },
    ...overrides,
  }, null, 2);
  it('ignores scripts, metadata and formatting', () => {
    expect(packageInstallChanged(pkg(), pkg({ scripts: { test: 'vitest run', 'evidence:check': 'node x.mjs' } }))).toBe(false);
    expect(packageInstallChanged(pkg(), pkg({ version: '2.0.0', description: 'x' }))).toBe(false);
    expect(packageInstallChanged(pkg(), JSON.stringify(JSON.parse(pkg())))).toBe(false);
  });
  it.each([
    ['a dependency bump', { dependencies: { convex: '^1.21.0', react: '^18.3.1' } }],
    ['a new devDependency', { devDependencies: { vitest: '^3.0.0', sharp: '^0.33.0' } }],
    ['overrides', { overrides: { esbuild: '0.25.0' } }],
    ['trustedDependencies', { trustedDependencies: ['sharp'] }],
    ['workspaces', { workspaces: ['packages/*'] }],
  ])('counts %s', (_label, overrides) => {
    expect(packageInstallChanged(pkg(), pkg(overrides))).toBe(true);
  });
  it('counts an added or unreadable package.json as changed', () => {
    expect(packageInstallChanged('', pkg())).toBe(true);
    expect(packageInstallChanged(pkg(), '{ not json')).toBe(true);
  });
});

describe('preview deployment selection', () => {
  it('resolves the actual deployment name using its PR identifier', () => {
    expect(previewCandidates([deployment()], 42)).toEqual([{ name: 'happy-otter-123', prNumber: 17 }]);
  });
  it.each([
    { deploymentType: 'prod' }, { deploymentType: 'dev' }, { kind: 'local' },
    { projectId: 99 }, { previewIdentifier: null }, { previewIdentifier: undefined },
    { previewIdentifier: 'branch-pr-17' }, { previewIdentifier: 'pr-17-other' },
    { previewIdentifier: 'pr-017' }, { previewIdentifier: 'pr-0' },
    { previewIdentifier: 'pr-9007199254740992' }, { name: '../production' },
    { name: '' }, { name: 123 }, { previewIdentifier: { value: 'pr-17' } },
  ])('excludes an unsafe or unrelated deployment %j', (overrides) => {
    expect(previewCandidates([deployment(overrides)], 42)).toEqual([]);
  });
  it('does not infer a PR from the deployment name or an arbitrary reference', () => {
    expect(previewCandidates([deployment({ name: 'pr-17', previewIdentifier: null })], 42)).toEqual([]);
  });
  it('fails closed on an unexpected list response', () => {
    expect(() => previewCandidates({ deployments: [] }, 42)).toThrow('expected an array');
  });
});

describe('cleanup HTTP orchestration (all requests mocked)', () => {
  it('defaults to dry run and only considers closed same-repository PRs', async () => {
    const io = harness(
      json([deployment(), deployment({ name: 'open-otter-124', previewIdentifier: 'pr-18' }),
        deployment({ name: 'fork-otter-125', previewIdentifier: 'pr-19' }),
        deployment({ deploymentType: 'prod' })]),
      json(pull()), json(pull({ number: 18, state: 'open' })),
      json(pull({ number: 19, head: { repo: { full_name: 'fork/repo' } } })),
    );
    await runCleanup(config({ dryRun: undefined }), io);
    expect(io.fetchImpl).toHaveBeenCalledTimes(4);
    expect(io.fetchImpl.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
    expect(io.log).toHaveBeenCalledWith('Would delete happy-otter-123 (PR #17).');
    expect(io.log).not.toHaveBeenCalledWith(expect.stringContaining('Would delete open-otter'));
    expect(io.fetchImpl.mock.calls[0][0]).toBe('https://api.convex.dev/v1/projects/42/list_deployments');
    expect(io.fetchImpl.mock.calls[1][0]).toBe('https://api.github.com/repos/owner/repo/pulls/17');
    expect(io.fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-convex');
    expect(io.fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer fixture-github');
  });
  it('deletes by the returned name and accepts an empty success body', async () => {
    const io = harness(json([deployment()]), json(pull()), new Response(null, { status: 200 }));
    await runCleanup(config({ dryRun: false }), io);
    expect(io.fetchImpl.mock.calls[2][0]).toBe('https://api.convex.dev/v1/deployments/happy-otter-123/delete');
    expect(io.fetchImpl.mock.calls[2][1].method).toBe('POST');
  });
  it.each([true, false])('close cleanup only deletes the closing PR (merged=%s)', async (merged) => {
    const io = harness(json([deployment(), deployment({ name: 'other-otter-124', previewIdentifier: 'pr-18' })]), json(pull()), new Response(null, { status: 200 }));
    await runCleanup(config({ eventName: 'pull_request', event: { ...closeEvent, pull_request: pull({ merged }) }, dryRun: false }), io);
    expect(io.fetchImpl).toHaveBeenCalledTimes(3);
  });
  it('skips fork close events before making any requests', async () => {
    const io = harness();
    await runCleanup(config({ eventName: 'pull_request', event: { action: 'closed', pull_request: pull({ head: { repo: { full_name: 'fork/repo' } } }) } }), io);
    expect(io.fetchImpl).not.toHaveBeenCalled();
  });
  it('does not delete a PR reopened after the close event', async () => {
    const io = harness(json([deployment()]), json(pull({ state: 'open' })));
    await runCleanup(config({ eventName: 'pull_request', event: closeEvent, dryRun: false }), io);
    expect(io.fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('succeeds quietly when the closing PR has no deployment', async () => {
    const io = harness(json([]));
    await runCleanup(config({ eventName: 'pull_request', event: closeEvent, dryRun: false }), io);
    expect(io.log).not.toHaveBeenCalled();
  });
  it('succeeds quietly if the deployment expires before deletion', async () => {
    const io = harness(json([deployment()]), json(pull()), json({ code: 'NotFound' }, 404));
    await runCleanup(config({ eventName: 'pull_request', event: closeEvent, dryRun: false }), io);
    expect(io.log).not.toHaveBeenCalled();
  });
  it('notices a missing team token and makes no requests', async () => {
    const io = harness();
    await runCleanup(config({ teamToken: '' }), io);
    expect(io.log).toHaveBeenCalledWith(expect.stringContaining('::notice::CONVEX_TEAM_ACCESS_TOKEN'));
    expect(io.fetchImpl).not.toHaveBeenCalled();
  });
  it('requires an explicit project ID when a team token is available', async () => {
    const io = harness();
    await expect(runCleanup(config({ projectId: '' }), io)).rejects.toThrow('CONVEX_PROJECT_ID');
    expect(io.fetchImpl).not.toHaveBeenCalled();
  });
  it.each([401, 403, 404, 429, 500])('fails clearly on list HTTP %s without leaking the response body', async (status) => {
    const io = harness(json({ message: 'sensitive response' }, status));
    await expect(runCleanup(config(), io)).rejects.toThrow(`HTTP ${status}`);
    expect(io.log).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500])('fails on delete HTTP %s', async (status) => {
    const io = harness(json([deployment()]), json(pull()), json({}, status));
    await expect(runCleanup(config({ dryRun: false }), io)).rejects.toThrow(`HTTP ${status}`);
  });
  it('does not delete anything if GitHub cannot confirm every candidate PR state', async () => {
    const io = harness(json([deployment(), deployment({ name: 'other-otter-124', previewIdentifier: 'pr-18' })]), json(pull()), json({}, 404));
    await expect(runCleanup(config({ dryRun: false }), io)).rejects.toThrow('GitHub');
    expect(io.fetchImpl.mock.calls.every(([, options]) => options.method === 'GET')).toBe(true);
  });
  it.each([{}, { state: 'unknown', number: 17 }, pull({ number: 99 })])('fails closed on malformed GitHub responses %j', async (response) => {
    const io = harness(json([deployment()]), json(response));
    await expect(runCleanup(config({ dryRun: false }), io)).rejects.toThrow('GitHub PR response');
  });
  it('rejects unexpected trigger events without requests', async () => {
    const io = harness();
    await expect(runCleanup(config({ eventName: 'push' }), io)).rejects.toThrow('event');
    expect(io.fetchImpl).not.toHaveBeenCalled();
  });
  it('sanitizes network failures instead of printing credentials', async () => {
    const io = { fetchImpl: vi.fn().mockRejectedValue(new Error('Bearer sensitive')), log: vi.fn() };
    await expect(runCleanup(config(), io)).rejects.toThrow('Convex request failed');
    expect(io.log).not.toHaveBeenCalled();
  });
});
