# chore/agent-config-and-ci

- source: C:/tmp/se-consolidate
- branch: chore/agent-config-and-ci
- HEAD: 37072426c1fc68451db787a6a9066634f92d1ec2
- last commit: 2026-08-16T13:27:45+05:30 "docs: finish the fixes whose examples and gates were left stale"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 15
- uncommitted: 1 entries (1 untracked); untracked copied: 1
- also covers (their unique commits are a subset of this one): ci/speed-and-reliability
- excluded: none

## restore

```
git switch -c restore/chore__agent-config-and-ci 37072426c1fc   # if the sha still exists locally; else start from origin/master
git am wip-archive/chore__agent-config-and-ci/commits/*.patch
git apply wip-archive/chore__agent-config-and-ci/uncommitted.diff
cp -r wip-archive/chore__agent-config-and-ci/untracked/. .
```
