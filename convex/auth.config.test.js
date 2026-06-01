import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  CLERK_FRONTEND_API_URL: process.env.CLERK_FRONTEND_API_URL,
  CLERK_JWT_ISSUER_DOMAIN: process.env.CLERK_JWT_ISSUER_DOMAIN,
};

async function loadAuthConfig(env) {
  vi.resetModules();

  delete process.env.CLERK_FRONTEND_API_URL;
  delete process.env.CLERK_JWT_ISSUER_DOMAIN;
  Object.assign(process.env, env);

  return import('./auth.config.ts');
}

afterEach(() => {
  vi.resetModules();

  if (ORIGINAL_ENV.CLERK_FRONTEND_API_URL === undefined) {
    delete process.env.CLERK_FRONTEND_API_URL;
  } else {
    process.env.CLERK_FRONTEND_API_URL = ORIGINAL_ENV.CLERK_FRONTEND_API_URL;
  }

  if (ORIGINAL_ENV.CLERK_JWT_ISSUER_DOMAIN === undefined) {
    delete process.env.CLERK_JWT_ISSUER_DOMAIN;
  } else {
    process.env.CLERK_JWT_ISSUER_DOMAIN = ORIGINAL_ENV.CLERK_JWT_ISSUER_DOMAIN;
  }
});

describe('Convex Clerk auth config', () => {
  it('uses the Clerk JWT issuer domain with the Convex audience', async () => {
    const { default: authConfig } = await loadAuthConfig({
      CLERK_JWT_ISSUER_DOMAIN: 'scoreeasy.accounts.dev',
    });

    expect(authConfig.providers).toEqual([
      {
        domain: 'https://scoreeasy.accounts.dev',
        applicationID: 'convex',
      },
    ]);
  });

  it('falls back to the frontend API URL when the issuer env is blank', async () => {
    const { default: authConfig } = await loadAuthConfig({
      CLERK_JWT_ISSUER_DOMAIN: '   ',
      CLERK_FRONTEND_API_URL: 'https://clerk.scoreeasy.test',
    });

    expect(authConfig.providers[0].domain).toBe('https://clerk.scoreeasy.test');
  });

  it('canonicalizes configured issuer URLs to HTTPS without trailing slashes', async () => {
    const insecureIssuer = `http${'://'}scoreeasy.accounts.dev/`;
    const { default: authConfig } = await loadAuthConfig({
      CLERK_JWT_ISSUER_DOMAIN: insecureIssuer,
    });

    expect(authConfig.providers[0].domain).toBe('https://scoreeasy.accounts.dev');
  });

  it('uses the production issuer fallback when Clerk env is unavailable', async () => {
    const { default: authConfig } = await loadAuthConfig({});

    expect(authConfig.providers[0].domain).toBe('https://clerk.scoreeasy.app');
  });
});
