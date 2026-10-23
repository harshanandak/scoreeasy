import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Verified against the official Management API reference and its OpenAPI schema:
// https://docs.convex.dev/management-api/list-deployments
// https://docs.convex.dev/management-api/delete-deployment
// https://github.com/get-convex/convex-backend/blob/main/npm-packages/@convex-dev/platform/management-openapi.json
const convexApi = 'https://api.convex.dev/v1';
const githubApi = 'https://api.github.com';

export function previewCandidates(deployments, projectId) {
  if (!Array.isArray(deployments)) throw new Error('Invalid Convex deployment list: expected an array.');
  return deployments.flatMap((deployment) => {
    if (deployment?.kind !== 'cloud' || deployment.deploymentType !== 'preview' || deployment.projectId !== projectId) return [];
    if (typeof deployment.previewIdentifier !== 'string' || typeof deployment.name !== 'string') return [];
    const match = /^pr-([1-9]\d*)$/.exec(deployment.previewIdentifier);
    const prNumber = match && Number(match[1]);
    // The PR identifier is NOT the name accepted by the delete endpoint.
    if (!Number.isSafeInteger(prNumber) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(deployment.name)) return [];
    return [{ name: deployment.name, prNumber }];
  });
}

export async function runCleanup(config, { fetchImpl = fetch, log = console.log } = {}) {
  const { eventName, event, repository, teamToken, githubToken, dryRun = true } = config;
  if (!['pull_request', 'workflow_dispatch'].includes(eventName)) throw new Error('Unsupported cleanup event.');
  if (eventName === 'pull_request' && (event?.action !== 'closed' || event.pull_request?.head?.repo?.full_name !== repository)) return;
  if (!teamToken) {
    log('::notice::CONVEX_TEAM_ACCESS_TOKEN is not set; skipping Convex preview cleanup.');
    return;
  }
  const projectId = Number(config.projectId);
  if (!/^[1-9]\d*$/.test(String(config.projectId ?? '')) || !Number.isSafeInteger(projectId)) {
    throw new Error('Set the CONVEX_PROJECT_ID repository variable to the numeric Convex project ID.');
  }
  if (!githubToken || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('GitHub token and repository are required.');
  if (typeof dryRun !== 'boolean') throw new Error('dryRun must be a boolean.');

  async function request(service, path, { method = 'GET', missingOk = false } = {}) {
    let response;
    try {
      response = await fetchImpl(`${service === 'Convex' ? convexApi : githubApi}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: {
          Authorization: `Bearer ${service === 'Convex' ? teamToken : githubToken}`,
          Accept: 'application/json',
          ...(service === 'GitHub' ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}),
        },
      });
    } catch {
      // Do not echo exception text or HTTP response bodies that could contain credentials.
      throw new Error(`${service} request failed (${method} ${path}).`);
    }
    if (missingOk && response.status === 404) return null;
    if (!response.ok) throw new Error(`${service} ${method} ${path} failed: HTTP ${response.status}.`);
    if (method === 'POST') return true; // Delete success has no JSON response contract.
    try {
      return await response.json();
    } catch {
      throw new Error(`${service} ${method} ${path} returned invalid JSON.`);
    }
  }

  const deployments = await request('Convex', `/projects/${projectId}/list_deployments`);
  let candidates = previewCandidates(deployments, projectId);
  if (eventName === 'pull_request') {
    if (!Number.isSafeInteger(event.pull_request.number) || event.pull_request.number < 1) throw new Error('Invalid closing PR number.');
    candidates = candidates.filter(({ prNumber }) => prNumber === event.pull_request.number);
  }

  // Confirm all PR states before any deletion. An API/auth error fails closed.
  const closed = [];
  for (const candidate of candidates) {
    const pull = await request('GitHub', `/repos/${repository}/pulls/${candidate.prNumber}`);
    if (pull?.number !== candidate.prNumber || !['open', 'closed'].includes(pull.state) || pull.base?.repo?.full_name !== repository) {
      throw new Error(`Invalid GitHub PR response for #${candidate.prNumber}.`);
    }
    if (pull.state === 'closed' && pull.head?.repo?.full_name === repository) closed.push(candidate);
  }

  for (const { name, prNumber } of closed) {
    if (dryRun) log(`Would delete ${name} (PR #${prNumber}).`);
    else {
      const deleted = await request('Convex', `/deployments/${encodeURIComponent(name)}/delete`, { method: 'POST', missingOk: true });
      if (deleted) log(`Deleted ${name} (PR #${prNumber}).`);
    }
  }
  if (eventName === 'workflow_dispatch') log(`${dryRun ? 'Dry run' : 'Cleanup'}: ${closed.length} closed-PR preview(s) selected from ${candidates.length} PR preview(s).`);
}

async function main() {
  const env = process.env;
  if (env.CLEANUP_DRY_RUN !== undefined && !['true', 'false'].includes(env.CLEANUP_DRY_RUN)) throw new Error('CLEANUP_DRY_RUN must be true or false.');
  await runCleanup({
    eventName: env.GITHUB_EVENT_NAME,
    event: JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')),
    repository: env.GITHUB_REPOSITORY,
    projectId: env.CONVEX_PROJECT_ID,
    teamToken: env.CONVEX_TEAM_ACCESS_TOKEN,
    githubToken: env.GITHUB_TOKEN,
    dryRun: env.CLEANUP_DRY_RUN !== 'false',
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
