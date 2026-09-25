# feat/ux-tennis-scorer

- source: (local branch, no worktree)
- branch: feat/ux-tennis-scorer
- HEAD: 8953f0cb34496aa4739f21d242755dfd87f7f0e9
- last commit: 2026-06-28T14:45:22+05:30 "test: de-brittle the tennis canScoreCurrentSet source assertion"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 3
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/feat__ux-tennis-scorer 8953f0cb3449   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__ux-tennis-scorer/commits/*.patch
git apply wip-archive/feat__ux-tennis-scorer/uncommitted.diff
cp -r wip-archive/feat__ux-tennis-scorer/untracked/. .
```
