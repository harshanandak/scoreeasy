# chore/coderabbit-config

- source: C:/Users/harsha_befach/Downloads/Personal-Projects/scoreeasy/.worktrees/scoreeasy-coderabbit
- branch: chore/coderabbit-config
- HEAD: b7b667b306c85dcd427ef10b10cd9ae42b531063
- last commit: 2026-08-18T10:52:45+05:30 "fix: synchronize agent policy mirrors"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 4
- uncommitted: 21 entries (21 untracked); untracked copied: 21
- excluded: none

## restore

```
git switch -c restore/chore__coderabbit-config b7b667b306c8   # if the sha still exists locally; else start from origin/master
git am wip-archive/chore__coderabbit-config/commits/*.patch
git apply wip-archive/chore__coderabbit-config/uncommitted.diff
cp -r wip-archive/chore__coderabbit-config/untracked/. .
```
