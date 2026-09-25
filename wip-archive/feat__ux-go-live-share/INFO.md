# feat/ux-go-live-share

- source: (local branch, no worktree)
- branch: feat/ux-go-live-share
- HEAD: ed63535805a8b56d869e700af0d1e3b008b88243
- last commit: 2026-06-28T15:33:20+05:30 "fix(share): hold copy-confirmation timer in a ref, clear before reschedule"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 3
- uncommitted: none
- also covers (their unique commits are a subset of this one): wf-fix-go-live
- excluded: none

## restore

```
git switch -c restore/feat__ux-go-live-share ed63535805a8   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__ux-go-live-share/commits/*.patch
git apply wip-archive/feat__ux-go-live-share/uncommitted.diff
cp -r wip-archive/feat__ux-go-live-share/untracked/. .
```
