import type { AuthConfig } from "convex/server";

const convexEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

const DEFAULT_CLERK_JWT_ISSUER_DOMAIN = "https://clerk.scoreeasy.app";

function stripTrailingSlashes(value: string) {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

function normalizeIssuerDomain(domain: string | undefined) {
  const trimmed = domain?.trim();
  if (!trimmed) {
    return DEFAULT_CLERK_JWT_ISSUER_DOMAIN;
  }

  const withoutTrailingSlashes = stripTrailingSlashes(trimmed);
  const issuer = withoutTrailingSlashes.slice(0, 7).toLowerCase() === "http://"
    ? `https://${withoutTrailingSlashes.slice(7)}`
    : withoutTrailingSlashes;

  if (issuer.slice(0, 8).toLowerCase() === "https://") {
    return issuer;
  }

  return `https://${issuer}`;
}

const clerkJwtIssuerEnv = convexEnv?.CLERK_JWT_ISSUER_DOMAIN?.trim();
const issuerSource = clerkJwtIssuerEnv || convexEnv?.CLERK_FRONTEND_API_URL;
const clerkJwtIssuerDomain = normalizeIssuerDomain(
  issuerSource,
);

export default {
  providers: [
    {
      domain: clerkJwtIssuerDomain,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
