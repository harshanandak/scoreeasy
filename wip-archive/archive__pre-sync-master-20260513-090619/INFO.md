# archive/pre-sync-master-20260513-090619

- source: (local branch, no worktree)
- branch: archive/pre-sync-master-20260513-090619
- HEAD: cb81780f6e3c304205584fff6b690d2563f0b318
- last commit: 2026-05-11T13:04:50+05:30 "bd init: initialize beads issue tracking"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 1
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/archive__pre-sync-master-20260513-090619 cb81780f6e3c   # if the sha still exists locally; else start from origin/master
git am wip-archive/archive__pre-sync-master-20260513-090619/commits/*.patch
git apply wip-archive/archive__pre-sync-master-20260513-090619/uncommitted.diff
cp -r wip-archive/archive__pre-sync-master-20260513-090619/untracked/. .
```
