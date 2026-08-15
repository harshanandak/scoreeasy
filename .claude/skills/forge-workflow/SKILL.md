---
name: forge-workflow
description: 7-stage TDD-first workflow for feature development. Use when building features, fixing bugs, or shipping PRs.
category: Development Workflow
tags: [tdd, workflow, pr, git, testing]
tools: [Bash, Read, Write, Edit, Grep, Glob]
---

# Forge Workflow Skill

A TDD-first workflow for AI coding agents. Ship features with confidence.

## When to Use

Automatically invoke this skill when the user wants to:
- Build a new feature
- Fix a bug
- Create a pull request
- Run the development workflow

## 7 Stages

| Stage | Command | Description |
|-------|---------|-------------|
| utility | `/status` | Check current context, active work, recent completions |
| 1 | `/plan` | Design intent -> research -> branch + worktree + task list |
| 2 | `/dev` | TDD development (implementer -> spec review -> quality review) |
| 3 | `/validate` | Type check, lint, security, tests - all fresh output |
| 4 | `/ship` | Push branch and create PR with full documentation |
| 5 | `/review` | Address ALL PR feedback (GitHub Actions, Greptile, SonarCloud) |
| 6 | `/premerge` | Update docs, hand off PR to user |
| 7 | `/verify` | Post-merge health check (CI on main, close Beads) |

## Workflow Flow

```
/status -> /plan -> /dev -> /validate -> /ship -> /review -> /premerge -> /verify
```

## Core Principles

- **TDD-First**: Write tests BEFORE implementation (RED-GREEN-REFACTOR)
- **Research-First**: Understand before building, document decisions
- **Security Built-In**: OWASP Top 10 analysis for every feature
- **Documentation Progressive**: Update at each stage, verify at end
