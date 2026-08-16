# Score Easy — agent instructions

Score Easy is a universal sports scorecard app: you pick a game (volleyball, cricket, tennis, badminton), set up the board, and score a live match on a phone or in a browser. It is a Vite + React 18 SPA in plain JS/JSX, with Convex for persistence and live sync, Clerk for auth, and Capacitor wrapping it as Android and iOS apps. Think Cricbuzz's scorecard without the media business, or a digital version of the paper scoresheet a club scorer fills in courtside.

Everything below is a good default. Where a task genuinely needs otherwise, do the better thing and say in your report which default you overrode and why.

## What we can never compromise on

Reject your own diff if it breaks one of these.

- **The scorer never loses a point.** A tap that scores must survive a refresh, a backgrounded app, and a flaky court wifi connection. Optimistic UI is fine; silently dropping the write is not.
- **The board stays truthful.** Score, serve, set/innings state and undo history must agree with each other on every screen. A display that disagrees with the rules of the game is a P0, however pretty it is.
- **One-handed, courtside, in sunlight.** Touch targets stay thumb-sized and contrast stays legible outdoors. A layout that only works on a desktop viewport is not done.
- **A match is private to its scorer until shared.** Every Convex function touching match or user data checks identity before it reads.
- **Sport rules live in one place per sport.** Scoring logic belongs in the sport module, not sprinkled through components.

## Glossary

- **you** — the agent doing the work.
- **Harsha** — the human; sole developer and product owner.
- **user / scorer** — the person scoring a live match on their phone. Not a developer, often standing at the side of a court.
- **board** — the scoring surface for one match; its layout is sport-specific (a *dialect*).
- **match** — one scored game, persisted in Convex.
- **prototype/** — standalone HTML design explorations, not shipped app code. Changes there never touch `src/`.

## Ways to hurt yourself here

1. **Using npm.** This repo is on **bun** (`bun.lock`). `npm install` rewrites the lockfile and the dependency tree.
2. **Running `npx convex deploy`.** That targets production. Development is `npx convex dev` — always.
3. **Writing TypeScript into `src/`.** `src/` is 173 JS/JSX files and zero `.ts`. `tsconfig.json` sets `checkJs: false`, so the JS you write is not type-checked — but it also sets `strict: true` and includes `src/**/*.ts(x)`, so a `.tsx` file you add *is* checked, strictly. Either way it breaks the plain-JS convention; don't add one.
4. **Editing `prototype/` when asked to change the app**, or the reverse. They are separate surfaces.
5. **Assuming the folder name.** This directory is `Downloads/Volleyball`; the project is Score Easy and volleyball is one sport among several.
6. **Treating `convex/` like ordinary code.** It has non-obvious rules — read `CODING_STANDARDS.md` before writing anything under `convex/`.
7. **Leaving work stranded locally.** Config and code both need pushing; a session that ends unpushed loses the work.

## Runbook

```bash
bun install
bun run dev          # vite, port 5173
npx convex dev       # backend, never `convex deploy`
bun run test         # vitest run
bun run lint
bun run type-check
bun run mobile:android   # vite build && cap sync android
```

Env vars, Clerk/Convex pairing and deployment live in `README.md` and `DEPLOYMENT.md` — read those rather than guessing key names.

## Standards and workflow

- **Code standards** — `CODING_STANDARDS.md`, read before writing `convex/` code and at review time.
- **Feature workflow** — the `forge-workflow` skill (7-stage, TDD-first) plus the slash commands in `.claude/commands/`.
- **Issue tracking** — `bd` (beads). `bd prime` for the command reference; `bd ready` to find work. Use it instead of TodoWrite or markdown TODO lists, and `bd remember` instead of MEMORY.md files.

## Shipping regime (pre-user)

Score Easy has no users yet, so a feature PR is reviewed as a feature, not as a diff.

- The merge artifact is a **demo** — a recording or screenshots of the board on a phone viewport — plus the plan's acceptance checklist walked out loud, plus a description that leads with the problem. Line-level correctness belongs to the agent loop inside the PR.
- **Completeness gates the merge, size does not.** Every state and transition the plan named (including undo and the reverse path) gets walked before ship.
- **Bot and review feedback is advisory** except secrets, injection, and a broken build — and it never expands the PR. File the follow-up.
- **Main is recoverable:** squash-only, branch deleted on merge, revert or fix forward within the hour, never debug on a red main.

## Non-interactive shell

`cp`, `mv` and `rm` may be aliased to `-i` and will hang waiting for y/n. Pass `-f` (`cp -f`, `mv -f`, `rm -f`, `rm -rf`). Same class: `scp`/`ssh` need `-o BatchMode=yes`, `apt-get` needs `-y`.

## Escape hatch

When this file contradicts what the code plainly does, the code wins — then say so in your report so the file gets fixed. When a task needs a decision Harsha has not made (turning on strict mode, adding the Convex ESLint plugin, changing a sport's rules), state the options and stop rather than picking one quietly.
