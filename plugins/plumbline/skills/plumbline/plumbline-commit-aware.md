# Plumbline Commit-Aware Analysis (IR)

## When This Skill Applies

Any query that references a specific commit, version, PR, or point in time.
"At commit abc123...", "in the version where bug X was introduced", "before
the refactor...", "when was Y added?"

## Rule: Carry commitHash Through EVERY Call

1. Establish which commit you mean. `roll_call` gives each repo's
   `lastIndexedCommit` + `lastIndexedAt` and an `indexedCommitCount` — enough
   to resolve "the latest indexed version" and to know whether older snapshots
   even exist (`indexedCommitCount: 1` means they don't). It does NOT list the
   older commits: take those from the user's reference, the task brief, or the
   commit list `case_file` reports back when asked for a commit this repo never
   indexed.
2. Pass `commitHash` to ALL subsequent calls: `blueprint`, `stakeout`,
   `case_file`, `interrogation`, `manhunt`.
3. If you omit it, you get the NEWEST snapshot — which may be FIXED code,
   not the version under investigation.

## How commitHash Works in Each Tool

| Tool            | What commitHash does                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `blueprint`     | The module set AS OF that commit, not today's modules filtered; if none is indexed there, the error lists ones that are   |
| `stakeout`      | Searches only FileVersion snapshots of that commit                                                                        |
| `case_file`     | Returns the file's snapshot + unit map AT that commit — the version that commit wrote, or, when it changed nothing there, the newest one before it (never a later one). Check the returned `commitHash` for which. A commit the repo never indexed errors, listing commits that do |
| `interrogation` | Resolves the unit through that commit's snapshot                                                                          |
| `manhunt`       | Only units present in that commit's snapshot — empty = genuinely absent there                                             |

## Snapshot & Content-Addressing Semantics

- Only files CHANGED in a commit get a new FileVersion; unchanged files keep
  their previous snapshot, which remains valid for later commits. So a commit
  hash names a snapshot for only a fraction of the repo's paths — `case_file`
  resolves the rest to the version in force at that commit, while `stakeout` and
  `manhunt` search that commit's snapshots literally and return nothing for the
  paths it did not touch. An empty result from those two is a statement about the
  commit, not about the repo.
- CodeUnits are content-addressed and SHARED by every commit with an
  identical implementation. Without `commitHash`, a unit hit proves
  existence _somewhere_, not at your commit — read the per-hit `commits`
  array.
- "When was X introduced?" → `manhunt {name: "X"}` WITHOUT
  commitHash; the `commits` array brackets the introduction. `roll_call` dates
  only the newest index run, so it bounds the search but cannot date the
  individual commits in that array.
- The same qualifiedName can return several hits with disjoint `commits`
  sets — that means the implementation CHANGED between those commits; each
  hit is one distinct implementation.

## If Results Look Wrong

Re-check: did you include `commitHash`? If not, re-fetch with it before
concluding. Code at commit X may differ significantly from the newest
snapshot — and a unit you "found" may not exist there at all.
