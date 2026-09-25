# docs/score-easy-audit

- source: (local branch, no worktree)
- branch: docs/score-easy-audit
- HEAD: 43b8e4c7153d6d19198627ec20fc9b826fc0bb7e
- last commit: 2026-06-22T16:04:01+05:30 "docs: add verified backlog + verification addenda (Score Easy audit)"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 2
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/docs__score-easy-audit 43b8e4c7153d   # if the sha still exists locally; else start from origin/master
git am wip-archive/docs__score-easy-audit/commits/*.patch
git apply wip-archive/docs__score-easy-audit/uncommitted.diff
cp -r wip-archive/docs__score-easy-audit/untracked/. .
```
