# feat/ux-shell-routing

- source: (local branch, no worktree)
- branch: feat/ux-shell-routing
- HEAD: 197a6bbd9c4ee6efd64843246aba4421d4c07570
- last commit: 2026-06-28T15:24:28+05:30 "fix(shell): restrict tennis-draft recovery, derive nav label, assert Clerk hit area"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 4
- uncommitted: none
- also covers (their unique commits are a subset of this one): feat/ux-shell-routing-wf2
- excluded: none

## restore

```
git switch -c restore/feat__ux-shell-routing 197a6bbd9c4e   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__ux-shell-routing/commits/*.patch
git apply wip-archive/feat__ux-shell-routing/uncommitted.diff
cp -r wip-archive/feat__ux-shell-routing/untracked/. .
```
