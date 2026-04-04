# Deployment Guide

Score Easy is deployed as a static Vite app with Clerk authentication, Convex data access, and optional Sentry error reporting.

## Required Environment Variables

Set these in your deployment provider and in `.env.local` for local development:

- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CONVEX_URL`
- Optional: `VITE_SENTRY_DSN`

The app will fail to boot if the Clerk key is missing, and it will not connect to Convex without `VITE_CONVEX_URL`.

## Local Verification

```bash
bun install
bun run build
bun run preview
bun run test
bun run lint
bun run type-check
```

Use the preview server to confirm the built app loads correctly before deploying.

## Vercel

Recommended Vercel settings:

- Build command: `bun run build`
- Install command: `bun install`
- Output directory: `dist`
- Dev command: `bun run dev`

If you are configuring Vercel manually, add the environment variables above in Project Settings before the first deployment.

## CI

The repository includes `.github/workflows/ci.yml`, which runs:

- `bun install --frozen-lockfile`
- `bun run build`
- `bun run test`
- `bun run lint`
- `bun run type-check`

## PWA Assets

The app includes generated SVG icons at:

- `/public/icons/icon-192.svg`
- `/public/icons/icon-512.svg`

Those assets are bundled into the production build and should be present in any deployed static host.

## Operational Notes

- Sentry is optional and only initializes when `VITE_SENTRY_DSN` is set.
- The app depends on Clerk + Convex working together at runtime.
- If you change environment variables, rebuild and redeploy so the new values are baked into the client bundle.
