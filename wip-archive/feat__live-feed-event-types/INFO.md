# feat/live-feed-event-types

- source: (local branch, no worktree)
- branch: feat/live-feed-event-types
- HEAD: f69dea18fb7d7fd80731bd7316cbd59f02b7f632
- last commit: 2026-06-28T21:32:30+05:30 "test(live): cover replaying a legacy outbox item that predates the `type` field"
- base: origin/master at archive time (17d6802f53a8f2809a84966f0f331d68f211c65e)
- commits archived: 2
- uncommitted: none
- excluded: none

## restore

```
git switch -c restore/feat__live-feed-event-types f69dea18fb7d   # if the sha still exists locally; else start from origin/master
git am wip-archive/feat__live-feed-event-types/commits/*.patch
git apply wip-archive/feat__live-feed-event-types/uncommitted.diff
cp -r wip-archive/feat__live-feed-event-types/untracked/. .
```
