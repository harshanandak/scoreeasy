# Coding Standards

Read at review time (the `code-review` skill loads this file) and before writing anything under `convex/`.
Consolidated from 15 always-loaded rule files that used to sit in `.claude/rules/`.

**Review feedback is advisory** except four classes that must be fixed in the active PR: secrets, injection, a broken build, and **documentation that asserts something the code does not do**. Anything else worth doing becomes a follow-up issue, not more commits on this branch. (Pre-user shipping regime, decided 2026-08-16. The reviewer-bot policy is versioned in `.coderabbit.yaml`; its request-changes workflow is disabled so this advisory rule remains authoritative.)

Sonar and other scanners are graded on the same four classes, not on their own severity labels: a Blocker that is a real build break or injection gets fixed here, a Blocker that is an advisory code-quality finding gets filed. Severity says how much it matters, not who fixes it when.

## Convex functions

**Validators (target).** Every public `query` / `mutation` / `action` should declare `args` and `returns` validators. `internal*` functions should declare them too — internal only means "not reachable from the client", not "unvalidated". All current public functions declare `args`, but `returns` is still missing from:

- `convex/live.ts`: `create`, `scorePoint`, `undo`, `setVisibility`, `pause`, `finalize`.
- `convex/matches.ts`: `save`, `getByUser`, `getUserStats`, `getRecent`, `getPublicUserStatsByUsername`, `getPublicRecentByUsername`.
- `convex/teams.ts`: `search`.
- `convex/users.ts`: `store`, `claimUsername`, `checkUsername`, `search`, `getByUsername`, `completeOnboarding`, `getCurrent`, `getMe`.

The mutation gaps are tracked in Forge task `ed01415e-cf7a-487f-98ad-d6d25b8713b6` ("Add returns validators to public Convex mutations missing them"). The query gaps remain targets; this task covers mutations only.

```ts
export const get = query({
  args: { matchId: v.id("matches") },
  returns: v.union(v.object({ _id: v.id("matches"), name: v.string() }), v.null()),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Auth on scorer-only data (target).** Use the auth wrapper, or check `ctx.auth.getUserIdentity()` before reading private data; throw if null. Ownership is a second check — being logged in is not being allowed. Public profile/search/stat queries currently allow unauthenticated reads; their match-data exposure needs a privacy decision, tracked in the SA-16 issue linked from `AGENTS.md`. Live spectator reads apply visibility and moderation gates. The public `live.report` mutation also accepts signed-out reports.

**Wrap auth in a custom function, do not repeat it.** Convex has no row-level security; the custom-function wrapper (`convex-helpers` `customQuery` / `customMutation`) is the substitute. A wrapper that injects `ctx.user` is how a rule gets enforced repo-wide instead of per-handler. Use it for basic auth, role checks, and tenant scoping.

**Thin wrappers.** `query`/`mutation`/`action` handle args and call plain TypeScript functions holding the business logic. Logic that lives in a handler cannot be reused or unit-tested.

**Await every promise.** `ctx.db.insert`, `ctx.db.patch`, `ctx.scheduler.runAfter` and friends all return promises; a floating one silently drops the write.

**Schedule internal functions only.** `ctx.scheduler.*` and `ctx.run*` take `internal.*` references. Scheduling an `api.*` function exposes an unauthenticated path into the work.

## Convex queries and data

**Index, don't `.filter()`.** Use `.withIndex()`; where the result set is provably small, collect and filter in TypeScript. `.filter()` on the database scans.

**Paginate anything that can grow.** `.collect()` is for bounded sets only — rule of thumb, 100+ possible items means `paginate()` with cursors. Unbounded `.collect()` is the classic Convex production failure.

**No `Date.now()` / `new Date()` inside a query.** It breaks caching and reactivity. Pass the time in as an argument, model expiry as a status field flipped by a scheduled mutation, or bucket to a coarse granularity.

**Flat, relational schema.** Documents reference each other by `v.id(...)`, they do not nest each other. Arrays are fine for small fixed-size value lists, not for growing collections. Every relationship gets an index.

## Errors

Throw for exceptional cases (unauthenticated, not authorized, invariant broken). Return `null` for expected absence (record not found). Error messages name the thing and the condition — `"Match abc123 not found"`, not `"Error"`. Do not leak internal identifiers or stack detail into messages the client renders.

## Node APIs in actions

Node built-ins (`crypto`, `Buffer`, most third-party SDKs) require an action file starting with `"use node"`. A `"use node"` file cannot contain queries or mutations — split it: `foo.ts` for queries/mutations, `fooNode.ts` for the action.

## Components

Reach for a Convex component when a feature is self-contained and reusable with its own tables (rate limiting, crons, aggregates). Do not reach for one to organise ordinary app code — plain modules are the default.

## TypeScript

Prefer generated types (`Doc<"matches">`, `Id<"matches">`, `api`/`internal` references) over hand-written shapes. Avoid `any`; where a type is genuinely unknown use `unknown` and narrow.

Note the actual repo state: `tsconfig.json` has `strict: true` and `checkJs: false`, and `src/` uses JSX/JS rather than TypeScript. `bun run type-check` checks the included TypeScript under `convex/`; it does not type-check JS/JSX. Turning `checkJs` on is a separate decision. Run `bunx tsc --noEmit -p tsconfig.json --checkJs true` for current JavaScript diagnostics rather than relying on a stored error count.

## Lint

`bun run lint` runs ESLint over the repo. `eslint-plugin-react-hooks` is registered for `**/*.{js,jsx}`, but no React Hooks rules are enabled. `@convex-dev/eslint-plugin` rules apply to `convex/**/*.ts` (parsed by `@typescript-eslint/parser`).

Machine-enforced as errors: `no-old-registered-function-syntax`, `require-args-validator`, `no-schema-import-cycle`. Warnings: `no-filter-in-query`, `no-top-of-hour-crons`, and `explicit-table-ids`. Explicit table IDs are still missing in several source and test files; run `bunx eslint convex` for the current list. Other standards in this file are review targets, not additional lint rules.
