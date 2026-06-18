# Score Easy

Score Easy is a Vite + React sports scoring app that now ships with Clerk authentication, Convex persistence, and optional Sentry error reporting.

## Requirements

- [Bun](https://bun.sh/) 1.x
- A Clerk publishable key
- A Convex deployment URL
- Optional: Sentry DSN

## Environment Variables

Create a `.env.local` file at the repository root:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
VITE_SENTRY_DSN=https://...
```

`VITE_SENTRY_DSN` is optional. The app will start without it.

For Vercel Preview deployments, use the Clerk development application and a
development Convex deployment. The Clerk development issuer currently used for
Preview auth is:

```bash
CLERK_JWT_ISSUER_DOMAIN=https://elegant-seahorse-53.clerk.accounts.dev
```

Set that value on the Convex deployment, not as a Vite client variable. The
Clerk JWT template must be named exactly `convex`.

## Scripts

- `bun run dev` - start the local dev server
- `bun run build` - create a production build
- `bun run preview` - preview the production build locally
- `bun run test` - run the Vitest suite once
- `bun run lint` - run ESLint across the repo
- `bun run type-check` - run TypeScript validation over the JS/JSX sources

## Setup

```bash
bun install
bun run dev
```

## Deployment

The app is configured for Vercel-style static hosting.

Required production environment variables:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- Optional: `VITE_SENTRY_DSN`

Use a `pk_live_...` Clerk key only for `scoreeasy.app` production. Use a
`pk_test_...` Clerk key for Vercel Preview URLs.

Before shipping, run:

```bash
bun run build
bun run test
bun run lint
bun run type-check
```

## Notes

- Auth flows depend on Clerk and Convex being configured together.
- Sentry is only initialized when `VITE_SENTRY_DSN` is present.
- PWA icons live under `public/icons` and are copied into the build output.
