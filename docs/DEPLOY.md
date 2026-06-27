# Deployment

ScoreEasy has **two** deployable halves that must ship together:

1. **Frontend** — the Vite SPA served as a Cloudflare Worker (assets-only).
2. **Backend** — the Convex functions + schema (`convex/`).

> **The rule that keeps us out of trouble:** the backend deploys **before** the
> frontend, and the frontend is always built against the URL of the deployment it
> was just shipped to. CI does this automatically with `convex deploy --cmd` — so a
> frontend that calls `api.foo.bar` can never reach users before `foo.bar` exists on
> the backend it talks to.

## How it works (CI)

### Production — `.github/workflows/cloudflare-worker-production.yml`
On push to `master`:
1. type-check + full test suite
2. `convex deploy --cmd 'bun run build' --cmd-url-env-var-name VITE_CONVEX_URL`
   → deploys backend to the **production** Convex deployment, then builds the
   frontend with `VITE_CONVEX_URL` pointed at it.
3. `wrangler deploy` → uploads the Worker.

If the Convex deploy fails, the Worker is **not** uploaded (no half-deploy).

### Preview (per PR) — `.github/workflows/cloudflare-worker-preview.yml`
On every PR push:
1. type-check
2. `convex deploy --preview-create pr-<N> --cmd 'bun run build' …`
   → creates/updates an **isolated Convex preview deployment for that PR** (its own
   functions + schema), builds the frontend against it.
3. `wrangler versions upload --preview-alias pr-<N>` → preview URL in the sticky PR comment.

Each PR is isolated — no shared dev backend lagging the branch, so a PR's new
backend functions are always present on its preview.

## Required GitHub Actions secrets

Settings → Secrets and variables → Actions. Each workflow **skips green** (does not
fail) until its secrets exist, so this is safe to merge before they're set.

| Secret | Used by | Where to get it |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | both | Cloudflare dashboard → API Tokens (Workers deploy scope) |
| `CONVEX_DEPLOY_KEY` | production | Convex dashboard → **production** deployment → Settings → Deploy Keys → **Production** |
| `CONVEX_PREVIEW_DEPLOY_KEY` | preview | Convex dashboard → project Settings → **Preview Deploy Key** (requires a Convex plan with preview deployments) |
| `PRODUCTION_VITE_CLERK_PUBLISHABLE_KEY` | production | Clerk **production** instance (`pk_live_…`) |
| `PREVIEW_VITE_CLERK_PUBLISHABLE_KEY` | preview | Clerk **development** instance (`pk_test_…`) — Clerk prod keys can't run on `*.workers.dev` |
| `PRODUCTION_VITE_SENTRY_DSN` / `PREVIEW_VITE_SENTRY_DSN` | optional | Sentry project DSN |

`VITE_CONVEX_URL` is **not** a secret anymore — `convex deploy --cmd` injects it.

### Convex preview deployments need their env vars
Preview deployments are fresh backends, so set the **default environment variables
for preview deployments** in the Convex dashboard (at minimum the Clerk **dev**
`CLERK_JWT_ISSUER_DOMAIN`) so auth works on previews.

## Manual fallback / local
- **Local dev:** `npx convex dev` (watches + pushes to your dev deployment).
- **One-off prod deploy:** `npx convex deploy` from `master` (needs `CONVEX_DEPLOY_KEY`).

## Why this prevents the class of bug
`convex deploy` runs codegen + schema validation on every merge and PR, on the
critical path. A referenced-but-undeployed function, or an incompatible schema
migration, now **fails the deploy** instead of silently shipping a frontend that
calls a function the backend doesn't have.
