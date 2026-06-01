import type { AuthConfig } from "convex/server";

const convexEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

const DEFAULT_CLERK_JWT_ISSUER_DOMAIN = "https://clerk.scoreeasy.app";

function normalizeIssuerDomain(domain: string | undefined) {
  const trimmed = domain?.trim();
  if (!trimmed) {
    return DEFAULT_CLERK_JWT_ISSUER_DOMAIN;
  }

  const issuer = trimmed.replace(/\/+$/, '').replace(/^http:\/\//i, "https://");

  if (/^https:\/\//i.test(issuer)) {
    return issuer;
  }

  return `https://${issuer}`;
}

const clerkJwtIssuerEnv = convexEnv?.CLERK_JWT_ISSUER_DOMAIN?.trim();
const clerkJwtIssuerDomain = normalizeIssuerDomain(
  clerkJwtIssuerEnv ? clerkJwtIssuerEnv : convexEnv?.CLERK_FRONTEND_API_URL,
);

export default {
  providers: [
    {
      domain: clerkJwtIssuerDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
