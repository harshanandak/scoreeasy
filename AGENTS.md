# Score Easy — agent instructions

Score Easy is a universal sports scorecard app: you pick a game (volleyball, cricket, tennis, badminton), set up the board, and score a live match on a phone or in a browser. It is a Vite + React 18 SPA in plain JS/JSX, with Convex for persistence and live sync, Clerk for auth, and Capacitor wrapping it as Android and iOS apps. Think Cricbuzz's scorecard without the media business, or a digital version of the paper scoresheet a club scorer fills in courtside.

Everything below is a good default. Where a task genuinely needs otherwise, do the better thing and say in your report which default you overrode and why.

## What we can never compromise on

Reject your own diff if it breaks one of these.

- **The scorer never loses a point.** A tap that scores must survive a refresh, a backgrounded app, and a flaky court wifi connection. Optimistic UI is fine; silently dropping the write is not.
- **The board stays truthful.** Score, serve, set/innings state and undo history must agree with each other on every screen. A display that disagrees with the rules of the game is a P0, however pretty it is.
- **One-handed, courtside, in sunlight.** Touch targets stay thumb-sized and contrast stays legible outdoors. A layout that only works on a desktop viewport is not done.
- **A match is private to its scorer until shared.** Private match/history/stat queries require identity and scorer ownership; tagging a player does not grant access. Live spectator reads require explicit publication plus visibility/moderation/expiry gates. Creating a broadcast always keeps it private, including legacy public/unlisted inputs; explicit publication synchronizes the current score. Reopening restores sharing status and Stop without publishing. Public profile cards expose only username, display name, avatar and join date; username search requires authentication.
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
3. **Writing TypeScript into `src/`.** `src/` uses JS/JSX, not TypeScript. `tsconfig.json` sets `checkJs: false`, so the JS you write is not type-checked — but it also sets `strict: true` and includes `src/**/*.ts(x)`, so a `.tsx` file you add *is* checked, strictly. Either way it breaks the plain-JS convention; don't add one.
4. **Editing `prototype/` when asked to change the app**, or the reverse. They are separate surfaces.
5. **Assuming the folder name.** The project is Score Easy (`scoreeasy`); a worktree's directory name can differ. Volleyball is one sport among several.
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

A required check still queued with no jobs 15 minutes after a push is stuck. Cancel and re-run it once; if it queues again, report it under Decisions needed. Never end a turn waiting for a runner without a time limit.

## Standards and workflow

- **Code standards** — `CODING_STANDARDS.md`, read before writing `convex/` code and at review time.
- **Feature workflow** — the `forge-workflow` skill (7-stage, TDD-first) plus the slash commands in `.claude/commands/`.
- **Issue tracking** — `forge issue`. `forge issue ready` to find work, `forge issue show <id>` for context, `forge issue comment <id> "…"` at each stage transition, `forge issue create` for follow-ups. Use it instead of TodoWrite or markdown TODO lists.
- **Open items** — the lead keeps a local, untracked `.overseer/open-items.md` (owner decisions with their default and first-asked time, plus owed checks) and re-reads it after every compaction and before writing "Decisions needed". An item leaves only when the owner answers, the lead takes the default and says so, or the check passes. Do not ask what no owner rule gates: take the default and say so. When more than three decisions are open, start with "Reply yes to take every default" and give one line per item.
- **Home decisions** — `docs/plans/2026-11-12-home-decisions.md` lists what the owner rejected on Home. Every Home brief and review names it under "Read first".

## Shipping regime (pre-user)

Score Easy has no users yet, so a feature PR is reviewed as a feature, not as a diff.

- The merge artifact is a **demo** — a recording or screenshots of the board on a phone viewport — plus the plan's acceptance checklist walked out loud, plus a description that leads with the problem. Line-level correctness belongs to the agent loop inside the PR.
- **A visible change is rendered by the agent before anyone else sees it.** Render the real component, not a mock, at 390x844 and 360x780, once with web fonts loaded and once with them blocked, next to the picked mock or the previous look. The pictures and the head SHA go in the PR description under "Phone evidence (head <sha>)", redone on every push that changes the look. Harsha's look on a real phone is the acceptance, never the first test. If no render tool works, say so under Decisions needed and wait: no link, no merge. An element mounted in the app shell (banner, toast, pill, nav) is rendered on every screen family it can sit over: each sport's board, setup, the lists and the spectator page.
- **Completeness gates the merge, size does not.** Every state and transition the plan named (including undo and the reverse path) gets walked before ship.
- **Bot and review feedback is advisory** except four classes that must be fixed in the PR: secrets, injection, a broken build, and **documentation that asserts something the code does not do**. That last one is not scope creep — a doc promising an enforcement, a command, or a config that does not exist makes every future agent stop checking, and it has bitten us repeatedly. Everything else valid gets filed, never built here. Feedback never expands the PR.
- **Main recovery policy:** use squash merges, revert or fix forward within the hour, never debug on a red main. GitHub deletes merged branches automatically but also permits merge and rebase merges; squash is our policy, not a repository restriction.

## Non-interactive shell

`cp`, `mv` and `rm` may be aliased to `-i` and will hang waiting for y/n. Pass `-f` (`cp -f`, `mv -f`, `rm -f`, `rm -rf`). Same class: `scp`/`ssh` need `-o BatchMode=yes`, `apt-get` needs `-y`.

## Escape hatch

When this file contradicts what the code plainly does, the code wins — then say so in your report so the file gets fixed. When a task needs a decision Harsha has not made (enabling JavaScript checking with `checkJs`, changing a sport's rules), state the options and stop rather than picking one quietly. TypeScript strict mode and the Convex ESLint plugin are already enabled.
