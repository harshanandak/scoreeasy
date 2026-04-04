import type { AuthConfig } from "convex/server";

const convexEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;

const clerkFrontendApiUrl = convexEnv?.CLERK_FRONTEND_API_URL ?? "clerk.scoreeasy.app";

export default {
  providers: [
    {
      domain: clerkFrontendApiUrl,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
