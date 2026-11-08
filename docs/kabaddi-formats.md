# Kabaddi formats

New states use `version: 2`, `schemaVersion: 2` and `rulesVersion: rectangular-v2`.
`resolveKabaddiRules()` copies a full profile into the match. Presets never act as
references to future defaults. `assertState()` validates nested rules and compares
the rules with the first journal snapshot after play starts.

Setup defaults to Quick casual: five players, first to 21, players stay, no clocks,
bonus, super tackle or do-or-die. Standard uses seven, two 20-minute halves, a
five-minute interval and a 30-second advisory raid clock. Women/younger uses
15-minute halves. Pro Kabaddi style uses the same rectangular baseline and does
not claim season-specific rules or a shootout. Standard uses the broader
any-raider-out super tackle policy. Physical-tackle-only is an explicit Custom
option; no unverified season rule is silently attributed to Pro style.

Custom supports two to twelve players, target points, equal raids or two timed
halves; optional raid clocks, bonus thresholds, do-or-die, FIFO revival, all-out
points and super-tackle policy. Count-only slots are anonymous; optional names do
not enforce squad, substitution or disciplinary quotas. Beach, Circle and
shootouts are unavailable. Court size and squad limit are metadata.

Targets are evaluated after every effect of a completed non-technical raid. Equal
scores at the target continue. Technical-only points wait for the next completed
raid. Fixed raids end after both teams receive their allocation; replay and
non-turn technical awards do not consume it. Clock expiry never awards points.
Timed play still requires the referee to call time and resolve an active raid.

`migrateKabaddiState(saved)` stages a new graph after validating a v1 club state.
It migrates every event's before/after snapshots and every active raid's before
snapshot. The original object, event IDs, input keys, effects, revisions, undo
targets and administrative IDs remain unchanged. Migrated rules are labelled
`legacy-club`, preserving stored durations and exact club semantics. Unknown
versions throw. The caller must retain the original durable copy before replacing
it; this pure reader does not itself write local or cloud storage.

`kabaddiLegacyEngine.js` is the frozen v1 implementation used to validate saved
club data and construct compatibility fixtures. New matches use `kabaddiEngine.js`.

Profile and migration contracts are in `kabaddiProfiles.test.js`. Tests are run in
CI for this work. Local lint, type-check and a preview build do not establish
offline persistence, cloud sync or production behavior.
