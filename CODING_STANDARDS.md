# Coding Standards

Read at review time (the `code-review` skill loads this file) and before writing anything under `convex/`.
Consolidated from 15 always-loaded rule files that used to sit in `.claude/rules/`.

**Review feedback is advisory** except secrets, injection, and a broken build — and it never expands the PR. Anything else worth doing becomes a follow-up issue, not more commits on this branch. (Pre-user shipping regime, decided 2026-08-16. This repo has no reviewer-bot config file; the rule lives here.)

## Convex functions

**Validators.** Every public `query` / `mutation` / `action` declares `args` and `returns` validators. `internal*` functions declare them too — internal only means "not reachable from the client", not "unvalidated".

```ts
export const get = query({
  args: { matchId: v.id("matches") },
  returns: v.union(v.object({ _id: v.id("matches"), name: v.string() }), v.null()),
  handler: async (ctx, args) => { /* ... */ },
});
```

**Auth on every public function that touches user data.** `const identity = await ctx.auth.getUserIdentity()` first; throw if null. Ownership is a second check — being logged in is not being allowed.

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

Note the actual repo state: `tsconfig.json` has `strict: true` and `checkJs: false`, and `src/` is JSX/JS with zero `.ts` files. Because `checkJs` is off, `strict` only governs the TypeScript under `convex/` — it costs zero errors there and must stay green. Turning `checkJs` on is a separate decision: it currently surfaces 1114 errors across 55 JS files, so do not assume JS is type-checked.

## Lint

`bun run lint` runs ESLint with `eslint-plugin-react-hooks` over `**/*.{js,jsx}`, plus `@convex-dev/eslint-plugin` over `convex/**/*.ts` (parsed by `@typescript-eslint/parser`).

Machine-enforced as errors: `no-old-registered-function-syntax`, `require-args-validator`, `no-schema-import-cycle`. Warnings: `no-filter-in-query`, `no-top-of-hour-crons`, and `explicit-table-ids` (a warning only until the 5 existing `db.get`/`db.patch` call sites in `matches.ts` and `users.ts` pass an explicit table name). Everything else in this file is enforced by review.
