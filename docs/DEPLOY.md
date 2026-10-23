# Deployment

Score Easy ships a Vite frontend as a Cloudflare Worker and a Convex backend.
The Worker uploads only after the build and any required Convex deployment
succeed. Production always uses `convex deploy --cmd` to build against its
production backend URL. PR previews select a shared or isolated backend below.

## Production: `.github/workflows/cloudflare-worker-production.yml`

On push to `master`:

1. Type-check and run the full test suite.
2. `convex deploy --cmd 'bun run build' --cmd-url-env-var-name VITE_CONVEX_URL`
   builds the frontend with the production backend URL and deploys the backend.
3. `wrangler deploy` uploads the Worker only if the preceding steps succeed.

## PR previews: `.github/workflows/cloudflare-worker-preview.yml`

Same-repository, non-draft PRs run on open, push, reopen, and draft/readiness
changes. Drafts and forked PRs skip deployment. The workflow checks out the PR
head with full history and compares the PR base and head using
`git diff --name-only --no-renames -z <base>...<head>`.

- Changes under `convex/`, or any change to `package.json` or `bun.lock`, select
  an **isolated per-PR backend**. Either dependency file can change the Convex
  CLI, helpers, or transitive backend dependencies, so all such changes count.
  `convex deploy --preview-create "pr-<N>" --cmd 'bun run build'` supplies its URL
  as `VITE_CONVEX_URL`. As documented by [Convex](https://docs.convex.dev/production/multiple-deployments#using-preview-deployments),
  `--preview-create` deletes and recreates an existing preview with the same
  identifier, including its data. It does not preserve data across pushes.
- Other changes select the **shared preview backend** at repository variable
  `PREVIEW_VITE_CONVEX_URL`. The workflow runs `bun run build` with that URL and
  does not run `convex deploy`. The shared backend must already contain the
  functions/schema expected by the branch; CI does not update it.
- If `PREVIEW_VITE_CONVEX_URL` is unset, the workflow emits a `::notice::` and
  falls back to the existing isolated per-PR deployment path.

Both paths type-check before building, then run
`wrangler versions upload --preview-alias pr-<N>`. The sticky PR comment keeps
its Building / Ready / Failed updates and now names the selected backend.
The existing commit-status context and GitHub deployment reporting remain.
Previews use Clerk development keys because production keys cannot run on the
`*.workers.dev` preview origin.

## Preview cleanup: `.github/workflows/convex-preview-cleanup.yml`

On PR close, merged or unmerged, the cleanup workflow skips forks and runs the
cleanup script from the trusted default branch. It shares the PR preview's
concurrency group, without canceling an in-flight run, so cleanup waits for an
active preview build/upload. It checks the PR's current state through GitHub
before deleting, so an already reopened PR is retained.

The script lists only the configured project's deployments and selects cloud
deployments with `deploymentType: "preview"`, the matching `projectId`, and an
exact `previewIdentifier: "pr-<N>"`. It resolves the actual deployment `name`
from that response; `pr-<N>` is an identifier, not the name used by the delete
endpoint. Production, development, local, other-project, and non-PR previews
are excluded. PRs must be closed and have their head in this repository.

A missing `CONVEX_TEAM_ACCESS_TOKEN` emits a `::notice::` and skips successfully.
A missing/invalid project ID fails when the token is available. No matching
deployment (frontend-only PR or already expired) succeeds quietly. A delete
returning HTTP 404 also succeeds quietly. Other non-2xx responses fail with the
service, operation, and status, without printing credentials or response bodies.

### Clear the existing backlog

After this workflow reaches `master` and setup is complete:

1. Open **Actions → Convex Preview Cleanup → Run workflow** on `master`.
2. Leave **dry_run** checked (the default). The workflow lists project previews,
   checks each matching PR through GitHub, and prints only the closed-PR
   deployments it would delete. A dry run sends no delete requests.
3. Inspect the names and PR numbers in the log. Run again on `master` with
   **dry_run** unchecked to delete the selected closed-PR previews and their
   data. This re-lists deployments and re-checks PR state; it does not reuse the
   previous run's selection. Manual runs on other branches are skipped.

Every candidate PR's state is checked before any deletes begin. A GitHub API
error fails the run rather than treating a missing response as a closed PR.
The sweep leaves open PRs and unrelated previews alone; it is not scheduled.

### One-time setup for Harsha

In GitHub **Settings → Secrets and variables → Actions**:

- [ ] Create a Convex **team access token** in the Convex dashboard's Team
  Settings with authority to list this project's deployments and delete its
  previews. Add it as GitHub **secret** `CONVEX_TEAM_ACCESS_TOKEN`. This is
  separate from the preview deploy key. See [Convex team token authentication](https://docs.convex.dev/platform-apis/overview#managing-your-own-projects).
- [ ] Set repository **variable** `CONVEX_PROJECT_ID` to this Convex project's
  numeric ID (the same project as `CONVEX_PREVIEW_DEPLOY_KEY`). The Management
  API list endpoint requires this ID; a project slug or deployment name will
  not work. Convex documents obtaining project IDs through [List Projects](https://docs.convex.dev/management-api/list-projects)
  for the team; the team ID is available when creating the team token.
- [ ] Set repository **variable** `PREVIEW_VITE_CONVEX_URL` to the existing
  **development deployment URL** identified by the `VITE_CONVEX_URL` key in
  your local `.env.local`. Use the dev deployment paired with Clerk's
  development instance, with current backend code. Do not use the production
  URL or an expiring per-PR preview URL. The URL is public configuration, not
  a secret; no workflow reads your local environment file.
- [ ] Optionally shorten existing preview deployments' expiration in the
  Convex dashboard's deployment settings. Convex documents a five-day default
  on Free/Starter and fourteen days on higher plans, and allows changing an
  existing deployment's expiration. These workflows do not change retention.
  See [deployment expiration](https://docs.convex.dev/production/multiple-deployments#limits).
- [ ] Run the backlog sweep in dry-run mode, inspect it, then rerun with
  `dry_run` unchecked when ready to remove those previews.

### Verified Management API contract

Requests use `Authorization: Bearer <CONVEX_TEAM_ACCESS_TOKEN>` at
`https://api.convex.dev/v1`, per the [authorization docs](https://docs.convex.dev/management-api/overview#authorization).
The script uses:

- [`GET /v1/projects/{project_id}/list_deployments`](https://docs.convex.dev/management-api/list-deployments)
  to obtain the deployment array.
- [`POST /v1/deployments/{deployment_name}/delete`](https://docs.convex.dev/management-api/delete-deployment)
  to delete a selected preview and its data.

The response fields (`kind`, `deploymentType`, `projectId`, `previewIdentifier`,
`name`) are specified in Convex's official
[`PlatformDeploymentResponse` OpenAPI schema](https://github.com/get-convex/convex-backend/blob/main/npm-packages/@convex-dev/platform/management-openapi.json).

## Other GitHub Actions configuration

Deployment workflows skip when their required deployment credentials are absent.
Shared frontend builds do not require `CONVEX_PREVIEW_DEPLOY_KEY`; isolated
builds do. Cleanup uses only the team token and project ID above.

| Secret | Used by | Where to get it |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | production and preview | Cloudflare dashboard, API Tokens with Workers deploy scope |
| `CONVEX_DEPLOY_KEY` | production | Convex production deployment, Settings, Deploy Keys |
| `CONVEX_PREVIEW_DEPLOY_KEY` | isolated preview | Convex project Settings, Preview Deploy Key |
| `PRODUCTION_VITE_CLERK_PUBLISHABLE_KEY` | production | Clerk production instance (`pk_live_…`) |
| `PREVIEW_VITE_CLERK_PUBLISHABLE_KEY` | preview | Clerk development instance (`pk_test_…`) |
| `PRODUCTION_VITE_SENTRY_DSN` / `PREVIEW_VITE_SENTRY_DSN` | optional | Sentry project DSN |

The Clerk/Sentry frontend configuration can also be repository variables, as
shown in the workflows. Isolated previews need default environment variables
in the Convex dashboard, including Clerk's development `CLERK_JWT_ISSUER_DOMAIN`.
The shared backend needs the corresponding development auth configuration too.

## Local development

Use `bunx convex dev` to watch and push backend changes to your development
deployment. CI handles production deployments on merge to `master`.

## Build artifacts and evidence images

Android's `android-debug-builds` artifact is retained for 3 days on pull requests
and 14 days on master pushes or manual runs. The iOS simulator build log is
uploaded only after a failure and retained for 7 days. These settings apply to
new uploads; existing artifacts and Actions caches are unchanged.

Before committing PNG evidence, run `bun run evidence:compress <paths...>` with
files or directories, for example `bun run evidence:compress docs/plans/my-board`.
The script recursively quantises PNGs in place, preserves pixel dimensions, and
keeps the original when compression would not save bytes. Check the result for
legibility before committing.

CI's `verify` job rejects added or modified images under `docs/` larger than
250 KB (250,000 bytes), including renamed images. Untouched images are excluded.
The guard covers PNG, JPEG, WebP, GIF, AVIF, SVG, BMP, TIFF and ICO; the compression
script handles PNG only. For other formats, reduce or re-export the image.
Run the guard locally after committing with `bun run evidence:check origin/master`.
