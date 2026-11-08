# Match visibility audit

Decisions needed: none.

The policy for this change is private to the scorer until explicitly shared. Public profile cards retain their existing four display fields; authentication is required for username search/availability, and scorer ownership for history/stats. No new searchable-profile product feature is introduced.

## Scope and evidence

Baseline: fetched `origin/master` (`12a45a0e55ec9866ccc9937d3c5197099c327707`). The inventory covers all 27 registered functions in the four authored endpoint modules under `convex/`: users (8), matches (6), teams (1), live (12). Source inspection included the schema, auth wrappers, generated API inventory, library modules, and registration/HTTP/action/tournament searches. This inventory contains no tournament endpoint, action or HTTP route. Tournaments are local data; their completed results enter through `matches.save`.

The baseline audit below is source evidence (rung 2). Regression execution and exact-head hosted CI are recorded in the PR, not inferred from source. This change does not deploy or reproduce behavior in a live Convex system.

`Q` means `convex/lib/functions.ts:7` (`authedQuery`), and `M` means `convex/lib/functions.ts:23` (`authedMutation`); both check identity before looking up the caller's user record. Line references in the baseline column refer to the fetched baseline. Exposure describes unintended access, excluding the intentionally minimal profile card and explicitly shared spectator data.

| Function | Baseline callers | Identity before private read (baseline evidence) | Returns / writes | Baseline exposure | Change |
|---|---|---|---|---|---|
| `users.store` | Signed-in identity | Yes, `users.ts:119` | Own user ID; insert/update own auth profile | none | Retained |
| `users.claimUsername` | Registered user | Yes, M; `users.ts:149` | Claims caller's username; no profile document | none | Retained |
| `users.checkUsername` | Anyone | No, `users.ts:169` | Availability boolean | leaks to anonymous (enumeration) | Q before lookup |
| `users.search` | Anyone | No, `users.ts:184` | Up to 10 username, display name, avatar, role and user IDs for tagging | leaks to anonymous (user directory) | Q; existing displayed/tagging fields only |
| `users.getByUsername` | Anyone | No, `users.ts:207` | Username, display name, avatar, join date | none: intentional minimal public card | Retained explicit projection; no IDs, email or match data |
| `users.completeOnboarding` | Registered user | Yes, M; `users.ts:215` | Updates own profile; username uniqueness lookup | none | Retained |
| `users.getCurrent` | Anyone; signed-out gets null | Yes, `users.ts:253` | Own profile excluding token/email/migration marker | none | Retained |
| `users.getMe` | Registered user | Yes, Q; `users.ts:261` | Own sanitized profile | none | Retained |
| `matches.save` | Registered user | Yes, M; `matches.ts:66` | New/deduplicated own match ID; team/player association writes | leaks to anonymous indirectly through globally searchable teams; other scorers can change shared counters | Team lookup/count writes scoped to scorer |
| `matches.getByUser` | Requested self | Yes, Q and self check, `matches.ts:178` | Raw match documents via player associations | leaks to any signed-in user tagged in another scorer's private match | Read by scorer index; intersect stats entries with owned matches |
| `matches.getUserStats` | Requested self | Yes, Q and self check, `matches.ts:190` | Match-derived stats | leaks to any signed-in user tagged in another scorer's private match | Same scorer scope |
| `matches.getRecent` | Requested self | Yes, Q and self check, `matches.ts:202` | Up to 10 raw match documents | leaks to any signed-in user tagged in another scorer's private match | Same scorer scope |
| `matches.getPublicUserStatsByUsername` | Anyone | No, `matches.ts:211` | Any username's match-derived stats | leaks to anonymous | Q plus caller username ownership check before match lookup |
| `matches.getPublicRecentByUsername` | Anyone | No, `matches.ts:222` | Any username's raw match list, including arbitrary detail and internal IDs | leaks to anonymous | Q plus caller username ownership check before match lookup |
| `teams.search` | Anyone | No, `teams.ts:4` | Team ID/name/global match count | leaks to anonymous (private match team names/activity) | Q, creator filter; count only caller-owned matches, including legacy shared-team rows |
| `live.create` | Registered user | Yes, M; `live.ts:111` | Own token and match ID; inserts broadcast/meta | leaks to anonymous indirectly: defaults to public; remembered global consent publishes new matches | Default private; explicit nonprivate input records `publishedAt`; app starts private and explicitly publishes after a per-match tap |
| `live.scorePoint` | Match owner | Yes, M; `live.ts:204`; ownership `live.ts:192` | Own event; updates live score | none | Existing ownership retained |
| `live.undo` | Match owner | Yes, M; `live.ts:289`; ownership `live.ts:192` | Own undo event; updates live score | none | Existing ownership retained |
| `live.setVisibility` | Match owner | Yes, M; `live.ts:382`; ownership `live.ts:192` | `{ok}`; updates visibility | none | Records explicit publication; clears marker when private |
| `live.pause` | Match owner | Yes, M; `live.ts:398`; ownership `live.ts:192` | `{ok}`; marks paused | none | Existing ownership retained |
| `live.finalize` | Match owner | Yes, M; `live.ts:407`; ownership `live.ts:192` | Own archive ID/status; finalizes/archives | none | Retained; scorer-index history also finds finalized archives |
| `live.report` | Anyone with token | No, `live.ts:497` | Uniform `{ok}`; records moderation report | No returned private fields; writes accepted for held/expired broadcasts | Apply the shared readable-match gate; no report write for private/legacy/held/removed/expired rows |
| `live.getByToken` | Anyone with token | No, `live.ts:604`; visibility/moderation/expiry gate `live.ts:581` | Validated score/status snapshot | leaks to anonymous for auto-published matches | Also require explicit publication marker |
| `live.getMeta` | Anyone with token | No, `live.ts:651`; same gate | Validated team/roster metadata; youth initials | leaks to anonymous for auto-published matches | Same explicit-publication gate; existing whitelist/redaction retained |
| `live.listLiveFeed` | Anyone | No, `live.ts:709` | Validated public discovery cards with share tokens | leaks to anonymous for auto-published matches; expiry not checked | Explicit publication and expiry plus public/live/clean/fresh/non-youth filters |
| `live.listEvents` | Anyone with token | No, `live.ts:817`; same gate | Paginated validated events without client IDs/meta/player IDs; youth commentary suppressed | leaks to anonymous for auto-published matches | Same explicit-publication gate |
| `live.eventsSince` | Anyone with token | No, `live.ts:853`; same gate | Up to 200 validated events | leaks to anonymous for auto-published matches | Same explicit-publication gate |

## Sharing and compatibility

The existing `liveMatches.visibility` field is the visibility choice: `public` permits discovery, `unlisted` permits link access, and `private` permits no spectator reads. Its existing optional `publishedAt` field now records explicit publication. Visibility alone cannot establish consent on old rows because old code defaulted to public; rows without the marker fail closed until their scorer shares again. There is no database migration or live-system write in this PR.

The default create is private. An owner explicitly supplying public/unlisted visibility opts in for that match. The app creates privately and then calls `setVisibility` after the per-match sharing action; a reused stopped or legacy session must also pass this step. Stop clears the marker; re-share sets it again. Idempotent creation never silently republishes a stopped match. Moderation, expiry, youth redaction, event projections and owner write checks still apply. Expiry is evaluated when a query runs; the existing design does not schedule an expiry timer.

Saved `matches` have no sharing flag or public read contract. They remain scorer-only, including arbitrary detail, archive tokens and player associations. A live share grants the existing spectator projections, never a public saved-match list or profile-derived private stats.

## Screens that depended on exposure

- Other players' profile pages show the existing public card plus a private-history message; no history/stat queries are issued. The scorer's own profile retains its authenticated history and stats.
- Signed-out player pickers skip cloud username search; signed-in search keeps its existing card/tagging fields. Team autocomplete is limited to the scorer's teams and own activity counts.
- Quick match and all five dedicated scorer screens start with sharing off even after remembered consent. A per-match tap is required; a rematch resets the broadcast session. A failed Stop keeps the public status and offers an error instead of claiming privacy. Re-sharing waits for confirmation from the backend.
- Legacy auto-public links and feed cards stop working until their scorer explicitly shares that match again. Existing public profile cards remain readable without authentication.

## Verification contract

`convex/privacy.test.ts` covers owner/other/anonymous access, tagged-player isolation, username bypasses, own team writes/counts, default/legacy visibility, every spectator reader, shared/unlisted access, Stop reversal, moderation/expiry, and all live owner-write guards. Existing live tests explicitly opt their public fixtures in. UI/hook regressions cover per-match consent, profile query skipping, re-publication failures and failed Stop behavior.

Only lint/type-check are run directly. The owner separately authorized tests run by the former pre-push hook. The tests-only commit is preserved; that hook reproduced nine failing regressions and refused its push, so hosted red CI was not possible without bypassing the gate. The branch was subsequently rebased onto the owner-requested hook removal in PR #214 (`9c4f2ba`); subsequent pushes do not run local tests. Final hosted CI is the release gate; neither this document nor local checks claim a deployed fix.
