# feat/ux-sets-volleyball-scorer

- source: (local branch, no worktree)
- branch: feat/ux-sets-volleyball-scorer
- HEAD: f84a0ab300197d4b3e44cb333435175401e3ac32
- last commit: 2026-06-28T20:48:05+05:30 "fix(scoring): normalize match-id lookup + make deuce-rotation tests reach deuce"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 2
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/feat__ux-sets-volleyball-scorer f84a0ab30019   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__ux-sets-volleyball-scorer/commits/*.patch
git apply wip-archive/feat__ux-sets-volleyball-scorer/uncommitted.diff
cp -r wip-archive/feat__ux-sets-volleyball-scorer/untracked/. .
```
