# feat/ux-onboarding-consent

- source: (local branch, no worktree)
- branch: feat/ux-onboarding-consent
- HEAD: b4a0bd928f8d731014400a7d76023a7f20d15bca
- last commit: 2026-06-28T15:15:53+05:30 "fix(onboarding): correct username-check mismatch + don't skip a touched step"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 2
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/feat__ux-onboarding-consent b4a0bd928f8d   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__ux-onboarding-consent/commits/*.patch
git apply wip-archive/feat__ux-onboarding-consent/uncommitted.diff
cp -r wip-archive/feat__ux-onboarding-consent/untracked/. .
```
