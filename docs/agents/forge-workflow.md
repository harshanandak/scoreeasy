<!-- Canonical workflow source; run bun run sync:agents to regenerate harness mirrors. -->
# Project Workflow Instructions

## 7-Stage TDD-First Workflow

This project follows a **TDD-first development workflow** with 7 stages. Stage instructions guide agents; the Git hooks enforce only the checks listed below.

| Stage | Command     | Purpose                                                   | Required For |
|-------|-------------|-----------------------------------------------------------|--------------|
| 1     | `/plan`     | Design intent → research → branch + worktree + task list | Critical, Standard, Refactor |
| 2     | `/dev`      | Subagent-driven TDD per task (spec + quality review)     | All except Docs |
| 3     | `/validate`    | Validate + 4-phase debug mode on failure                    | All types    |
| 4     | `/ship`     | Create PR with documentation                             | All types    |
| 5     | `/review`   | Triage feedback under the four must-fix classes in `AGENTS.md`; file advisory follow-ups | Critical, Standard |
| 6     | `/premerge` | Complete docs on feature branch, hand off PR             | Critical, Standard, Refactor |
| 7     | `/verify`   | Post-merge health check (CI, deployments)                | Critical (after merge) |

**Utility**: `/status` — Context check before starting work (not a numbered stage)

## Automatic Change Classification

When the user requests work, **you MUST automatically classify** the change type:

### Critical (Full 7-stage workflow)
**Triggers:** Security, authentication, payments, breaking changes, new architecture, data migrations
**Example:** "Add OAuth login", "Migrate database schema", "Implement payment gateway"
**Workflow:** plan → dev → validate → ship → review → premerge → verify

### Standard (6-stage workflow)
**Triggers:** Normal features, enhancements, new components
**Example:** "Add user profile page", "Create notification system"
**Workflow:** plan → dev → validate → ship → review → premerge

### Simple (3-stage workflow, skip plan)
**Triggers:** Bug fixes, UI tweaks, small changes, minor refactors
**Example:** "Fix button color", "Update validation message", "Adjust padding"
**Workflow:** dev → validate → ship

### Hotfix (Emergency 3-stage workflow)
**Triggers:** Production emergencies, critical bugs affecting users
**Example:** "Production payment processing down", "Security vulnerability fix"
**Workflow:** dev → validate → ship (immediate merge allowed)

### Docs (Documentation-only workflow)
**Triggers:** Documentation updates, README changes, comment improvements
**Example:** "Update README", "Add API documentation"
**Workflow:** validate → ship
(`/verify` is a *post-merge* health check — it needs a merged PR and switches to the
base branch, so it can never run before `/ship`.)

### Refactor (5-stage workflow for safe cleanup)
**Triggers:** Code cleanup, performance optimization, technical debt reduction
**Example:** "Refactor auth service", "Extract utility functions"
**Workflow:** plan → dev → validate → ship → premerge

## Enforcement Philosophy

**Conversational, not blocking** - Offer solutions when prerequisites are missing:

❌ **Don't:** "ERROR: Research required for critical features"
✅ **Do:** "Before implementation, I should research OAuth best practices. I can:
   1. Auto-research now with parallel-deep-research (~5 min)
   2. Use your research if you have it
   3. Skip (not recommended for security features)

   What would you prefer?"

**Create accountability for skips:**

"Skipping tests creates technical debt. I'll:
 ✓ Allow this commit
 ✓ Create a follow-up issue for tests (`forge issue create`)
 ✓ Document in commit message as [tech-debt]

 Proceed?"

**Dynamic commands — no hardcoded examples:**

Command files (`.claude/commands/*.md` and agent equivalents) must never hardcode example output when a script generates that output dynamically. Reference the script and describe what it does — don't duplicate its output with fake data that becomes stale.

## TDD Development (Stage 2: /dev)

**Subagent-driven per-task implementation loop:**

1. **Read task list** → Pre-made task list from `/plan` Phase 3 at `docs/plans/YYYY-MM-DD-<slug>-tasks.md`
2. **Dispatch implementer subagent per task** → Fresh context, complete task text, relevant design doc sections
3. **TDD inside implementer** → RED-GREEN-REFACTOR enforced by HARD-GATE:
   - RED: Write failing test first (must run test and show failing output)
   - GREEN: Implement minimal code to pass (must show passing output)
   - REFACTOR: Clean up while keeping tests green
4. **Spec compliance review** → Spec reviewer checks every task before quality review
5. **Code quality review** → Quality reviewer checks after spec compliance ✅
6. **Decision gate** → 7-dimension impact scoring when spec gap found; score routes to PROCEED/SPEC-REVIEWER/BLOCKED

**Example execution:**
```
/dev starts:
  ✓ Read task list: docs/plans/2026-02-26-stripe-billing-tasks.md (8 tasks)
  ✓ Created decisions log: docs/plans/2026-02-26-stripe-billing-decisions.md

Task 1: Types and interfaces
  ✓ Implementer: test written → failing → implementation → passing → committed
  ✓ Spec review: ✅
  ✓ Quality review: ✅
  Decision gates: 0

Task 2: Validation logic
  ✓ Implementer: test written → failing → implementation → passing
  ⚠️  Decision gate fired (score: 2/14 — PROCEED)
     Gap: Error message format not specified in design doc
     Choice: Use { code, message } object (conservative, documented)
  ✓ Spec review: ✅
  ✓ Quality review: ✅
```

## State Management (Single Source of Truth)

**Workflow state lives on the Forge issue** (survives compaction): each stage exit adds a
stage-transition comment with `forge issue comment` (format under "Usage in Stage
Transitions" below), so `forge issue show <id>` tells a new session which stage the work
is in, what was decided, and what comes next.

## Git Hooks (Automatic Enforcement)

**Pre-commit hook** (`lefthook.yml`) runs lint, type-check, and `sync:agents --check`.
It does **not** compare changed source against changed tests — there is no automatic
TDD block here. Writing the test first is a rule you follow, not one the hook enforces.

**Pre-push hook** calls `bun scripts/pre-push-tests.mjs`. It runs the full test
suite when tracked source is deleted or renamed, or when test-environment files
change: `package.json`, `bun.lock`, `vite.config.*`, `vitest.config.*`,
`tsconfig*.json`, `src/test/**` (including setup files), or the selection script.
Source includes everything under `src/`, `convex/`, and `scripts/`, plus JS/TS,
CSS, and HTML files elsewhere. The rule covers committed, staged, and unstaged
changes; untracked test-environment files also trigger the full suite.

Otherwise it runs `bun run test --changed origin/master --passWithNoTests`.
Vitest follows source imports to select affected tests and explicitly reports
success if none are related. Native `forceRerunTriggers` also covers the listed
test-environment files. Missing imports and config replacement require the
script's conservative full-suite selection before Vitest loads its graph.
Detached HEAD works with the explicit base. A missing base or common ancestor
blocks the hook with fetch/unshallow recovery instructions. Fetch `origin master`
before validation to keep the comparison current.

**Required CI `verify` check** (`.github/workflows/ci.yml`) is the full-suite gate.
It runs the build, all tests, lint, and type-check on every PR. The local pre-push
hook does not build.

## Documentation Index (Context Pointers)

**Detailed command instructions** are located in:
- [.claude/commands/status.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/status.md) - How to check current context (utility)
- [.claude/commands/plan.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/plan.md) - How to plan features (3 phases: design intent + research + branch/worktree/tasks)
- [.claude/commands/dev.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/dev.md) - How to implement with subagent-driven TDD and decision gate
- [.claude/commands/validate.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/validate.md) - How to run validation (with HARD-GATE exit)
- [.claude/commands/ship.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/ship.md) - How to create PRs
- [.claude/commands/review.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/review.md) - How to address PR feedback (with HARD-GATE exit)
- [.claude/commands/premerge.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/premerge.md) - How to complete docs and hand off PR for merge
- [.claude/commands/verify.md](https://github.com/harshanandak/scoreeasy/blob/master/.claude/commands/verify.md) - How to verify post-merge health

**Planning documents** (created by `/plan`, consumed by `/dev`):
- `docs/plans/YYYY-MM-DD-<slug>-design.md` - Design intent + technical research
- `docs/plans/YYYY-MM-DD-<slug>-tasks.md` - Task list with TDD steps
- `docs/plans/YYYY-MM-DD-<slug>-decisions.md` - Decisions log from /dev

**Comprehensive workflow guide:**
- `AGENTS.md` at the repo root is the single source of truth. **This file is not it** —
  `docs/agents/forge-workflow.md` is one of the sources `bun run sync:agents` composes
  into the harness mirrors.
- Tool setup and enforcement details live in `AGENTS.md` and `CODING_STANDARDS.md`.

## Descriptive Context Convention

Every stage transition should carry structured context so the next stage (or a new session) can resume without re-reading the full design doc. This convention is **advisory** — warnings are informational, not blocking.

### Required Fields at Each Stage Exit

| Stage Exit | Summary | Decisions | Artifacts | Next |
|------------|---------|-----------|-----------|------|
| /plan      | Design approach chosen | Key trade-offs resolved | Design doc, task list paths | First dev task focus |
| /dev       | Tasks completed, gate count | Spec gaps encountered | Changed files, test files | Validation priorities |
| /validate  | All checks pass/fail summary | Failures diagnosed | Scripts/commands run | Ship readiness |
| /ship      | PR created, checks pending | Template sections filled | PR URL, branch name | Review focus areas |
| /review    | All feedback addressed | Comment resolutions | Fixed files, commit SHAs | Doc update needs |
| /premerge  | Docs updated, CI green | N/A | Updated doc files | Merge instructions |

### Validation Command

Run at each stage exit to check for missing context:

```bash
forge issue show <id>
```

Check by eye that: (1) the issue has a description, (2) at least one stage-transition
comment exists, (3) the most recent transition carries a summary, (4) design metadata is
set if the issue is past the plan stage.

`forge issue show` retrieves the issue; it does not automatically validate these context fields.

### Field Definitions

- **Summary**: 1-2 sentence recap of what was accomplished in this stage. Example: `summary: All 5 tasks done, 1 decision gate fired`
- **Decisions**: Key choices made during this stage that affect downstream work. Example: `decisions: Used streaming parser over DOM for memory efficiency`
- **Artifacts**: File paths or URLs produced by this stage. Example: `artifacts: lib/parser.js test/parser.test.js docs/plans/2026-03-26-parser-design.md`
- **Next**: Guidance for the next stage on what to focus on. Example: `next: Run lint first`

### Usage in Stage Transitions

Record the transition as a comment on the issue:

```bash
forge issue comment <id> "stage: dev -> validate
summary: All 5 tasks done, 0 gates fired
decisions: Used approach A per design doc
artifacts: lib/foo.js test/foo.test.js
next: Run type check and lint"
```

### Enforcement Level

This context convention is **advisory only** and is checked by the agent. It is separate from the `/validate` quality checks and is not an automatic CLI gate.

## Issue Tracker

Issues live in Forge's own tracker. Use `forge issue` rather than relying on a particular on-disk storage path.

### Quick Reference

```bash
forge issue ready                                   # Find available work
forge issue show <id>                               # View issue details and stage history
forge issue claim <id>                              # Claim work
forge issue update <id> --status in_progress        # Move an issue along
forge issue comment <id> "stage: plan -> dev ..."   # Record a stage transition
forge issue create "..." --type task                # File a follow-up
forge issue close <id> --reason "..."               # Complete work
```

### Rules

- Use `forge issue` for all issue tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists. Exception: `/plan` Phase 3 generates task lists at `docs/plans/YYYY-MM-DD-<slug>-tasks.md` — these are approved artifacts consumed by `/dev`, but the Forge issue remains the source of truth for issue state and IDs.
- Types are `epic`, `task`, `bug`, `decision`; statuses are `open`, `in_progress`, `review`, `done`, `cancelled`, `backlog`.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
    git fetch origin
    git merge --no-edit origin/master
    git push
    git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- After fixing review feedback, always push the changes and resolve the related GitHub review threads via the GraphQL API before considering the work complete

## Git conventions

**Branch naming**: `feat/<feature-slug>`, `fix/<bug-slug>`, `docs/<doc-slug>`.

**Conventional commits**, one per TDD phase:

```bash
git commit -m "test: add validation tests"     # RED phase
git commit -m "feat: implement validation"     # GREEN phase
git commit -m "refactor: extract helpers"      # REFACTOR phase
```

## MCP servers

`.mcp.json` configures **convex**. Other integrations depend on the harness configuration; inspect the available tools for the current session.
