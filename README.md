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
