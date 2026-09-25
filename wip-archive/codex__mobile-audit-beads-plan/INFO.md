# codex/mobile-audit-beads-plan

- source: (local branch, no worktree)
- branch: codex/mobile-audit-beads-plan
- HEAD: 5226c715734cbd1aae965da93ffbff80937a2105
- last commit: 2026-05-31T21:28:08+05:30 "docs: track mobile audit issues in beads"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 1
- uncommitted: none
- also covers (their unique commits are a subset of this one): codex/mobile-audit-beads-plan-fixed
- excluded: none

## restore

```
git switch -c restore/codex__mobile-audit-beads-plan 5226c715734c   # if the sha still exists locally; else start from origin/master
git am wip-archive/codex__mobile-audit-beads-plan/commits/*.patch
git apply wip-archive/codex__mobile-audit-beads-plan/uncommitted.diff
cp -r wip-archive/codex__mobile-audit-beads-plan/untracked/. .
```
