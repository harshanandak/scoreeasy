# backup/offline-local-actions-amended

- source: (local branch, no worktree)
- branch: backup/offline-local-actions-amended
- HEAD: d2181b66e3ab0a34c4b8aaeeeede2f1538442c55
- last commit: 2026-05-21T04:58:32+05:30 "fix: add offline local actions"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 1
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/backup__offline-local-actions-amended d2181b66e3ab   # if the sha still exists locally; else start from origin/master
git am wip-archive/backup__offline-local-actions-amended/commits/*.patch
git apply wip-archive/backup__offline-local-actions-amended/uncommitted.diff
cp -r wip-archive/backup__offline-local-actions-amended/untracked/. .
```
