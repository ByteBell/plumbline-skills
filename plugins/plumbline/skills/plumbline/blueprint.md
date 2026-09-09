---
name: blueprint
description: >
  Dedicated usage skill for the `blueprint` MCP tool — read ONE repo's module
  tier (`:Subsystem` / `:SubsystemVersion`) at one commit: every module with
  its role, root, file count, one-line responsibility, provenance, confidence
  and the modules it depends on. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# blueprint

The repo's MODULE map at one commit, in one call. This is the only tool that
reads the module tier — every other code tool reads the FILE tier, where
"what are this repo's parts, and which parts lean on which" costs hundreds of
calls to infer and is never authoritative when you finish.

```
(:Knowledge)-[:HAS_SUBSYSTEM]->(:Subsystem)-[:HAS_VERSION]->(:SubsystemVersion)
                               (:SubsystemVersion)-[:DEPENDS_ON]->(:SubsystemVersion)
                               (:SubsystemVersion)-[:HAS_FILE]->(:FileVersion)
```

Bounded by MODULE count rather than file count: a 1300-file repo is ~90 rows
and arrives in one page. A large monorepo can run to thousands of modules and
paginate — read `pagination.hasNextPage` rather than treating page one as the
whole architecture.

## Digest

`knowledgeId` (required — ONE repo per call; omitting it is invalid here, not a
sweep) + optional `commitHash` (omit → newest indexed module set) + optional
`module` (switches to MEMBERSHIP mode — see below).

**Two modes.** Without `module`: the MAP, one row per module. With `module`
(its `name` or `moduleId`): that module's member FILES —
`{relativePath, commitHash, language, tokenCount, purpose}` — read off the
commit-pinned `HAS_FILE` edge. They are separate calls because the map's value
is being bounded by MODULE count; attaching every module's files would restore
the file-tier blow-up this tier exists to avoid.

One row per module: `{name, role, root, fileCount, responsibility, provenance,
confidence, dependsOn}`. `dependsOn` carries module NAMES that match other rows
in the same response. Three closed vocabularies:

- `role` — structural position, never subject matter: `entrypoint` · `api` ·
  `domain` · `orchestration` · `adapter` · `infrastructure` · `shared` ·
  `tooling` · `config` · `tests`.
- `provenance` — `manifest` (package.json/go.mod/…) · `workspace` · `derived`.
- `confidence` — a claim about the BOUNDARY, not the code: `declared` (a fact) ·
  `high` · `low` (treat the grouping as a reading aid, and say so).

- **This is the orientation call, not a search.** Run it once per repo per
  session, right after `roll_call`, BEFORE the funnel narrows — and skip it when
  you already know which part of the repo the question lives in. Keep the
  response. Its pair at the same altitude is `kingpin`: this says what the
  repo's parts ARE, `kingpin` says which individual files everything routes
  through.
- Pin the same `commitHash` you pass to `stakeout`/`case_file` — an older commit
  returns what the repo looked like THEN, not today's modules filtered.
- **`root` is display, not identity** — a module is a SET of files and can span
  sibling directories, and two modules can share one directory. So
  `pathContains: <root>` is NOT membership; `blueprint {module: <name>}` is, and
  it is exact. Reach for the path approximation only when membership mode reports
  a module with no `HAS_FILE` members.
- A member's `commitHash` is the snapshot the module tier RESOLVED for that path
  — this commit's version if this commit changed the file, else the newest one
  analysed before the run. It legitimately differs from the module's commit, and
  it is the hash to pass to `the_receipts` / `case_file`, not the module's.
- THIN → an empty result is NOT "this repo has no modules". The module phase is
  per-commit and non-fatal; the error names commits that DO have a map. Retry
  against one of those or fall back to the file tier.
- Next: module → files is `blueprint {module: <name>, commitHash}` — exact
  membership, one call. Then `case_file` on a member. A `dependsOn` edge you want
  grounded is `collateral_damage` on a file from either side of it.

## Schema

| Field         | Type              | Notes                                                                     |
| ------------- | ----------------- | ------------------------------------------------------------------------- |
| `knowledgeId` | string (required) | The repo (from `roll_call` or a `stakeout` hit). One repo per call.       |
| `commitHash`  | string (optional) | An indexed commit. Omit for the newest module set indexed for this repo.  |
| `module`      | string (optional) | Switch to MEMBERSHIP mode: this module's member files. Its `name` or `moduleId`. |

## Returns

One item per module, ordered by name, under a header that names the commit
the map describes plus `moduleCount` / `fileCount` / `dependencyEdges` /
`lowConfidenceModules`.

```json
{
  "name": "repo-map",
  "role": "domain",
  "root": "packages/repo-map",
  "fileCount": 23,
  "responsibility": "<one sentence: what this module does for the rest of the system>",
  "provenance": "manifest",
  "confidence": "declared",
  "dependsOn": ["neo4j", "logger"]
}
```

`dependsOn` carries module NAMES, not ids — feed one straight back as the
name of another row in the same response. The edges are written
version→version within a single commit, so what you get is the dependency
graph as of that commit, never a mix of two.

## The three closed vocabularies

**`role` — what the module is FOR, structurally** (position in the system,
never subject matter; "auth" is a domain, and lives in the responsibility
sentence): `entrypoint` · `api` · `domain` · `orchestration` · `adapter` ·
`infrastructure` · `shared` · `tooling` · `config` · `tests`.

**`provenance` — how the module's identity was established:**

- `manifest` — a package.json / go.mod / pyproject / Cargo.toml at its root.
- `workspace` — declared as a workspace member or build target, no manifest.
- `derived` — no declaration; partitioned from the import graph and the tree.

**`confidence` — a claim about the BOUNDARY, not about the code:**

- `declared` — the repo's own manifest drew the line. This is a fact.
- `high` — derived, and the import graph agrees with the directory grouping.
- `low` — derived, and the two disagree, or it is a leftover bucket. Treat
  the grouping as a reading aid, and say so if you repeat it to the user.

## Rules

- **`blueprint` is the orientation call, not a search.** Run it once per repo
  per session, right after `roll_call`, before the funnel starts narrowing —
  and skip it when you already know which part of the repo you are searching.
  The module set does not change mid-session — keep the response.
- **Commit semantics match the rest of the funnel.** `:SubsystemVersion` is
  keyed `(knowledgeId, moduleId, commitHash)`, so an older commit returns
  what the repo looked like THEN, not today's modules filtered. Pin the same
  `commitHash` you are passing to `stakeout` / `case_file`.
- **An empty result is NOT "this repo has no modules."** The module phase
  runs per commit and is non-fatal, so a repo can be fully indexed at the
  file tier with no module map at all. The error names the commits that DO
  have one — retry against one of those, or fall back to the file tier.
- **One repo per call.** Unlike `stakeout` / `manhunt` / `dragnet`, omitting
  `knowledgeId` is not a sweep — it is invalid. Loop repos deliberately, and
  only when the question really is per-repo architecture.
- **`root` is for display, not identity.** A module is a SET of files, and it
  can span sibling directories; `root` is only their longest common prefix.
  Never treat `pathContains: <root>` as equivalent to the module's membership —
  `blueprint {module: <name>}` returns the membership itself, off the
  commit-pinned `HAS_FILE` edge the writer records. The path approximation is a
  fallback for the one case membership mode cannot serve: a module whose files
  were never resolved to `:FileVersion` nodes, which the error names explicitly.
- **`fileCount` is the module's size, not a search result count.** It counts
  the `:FileVersion` nodes the module contained at that commit.

## Where it hands off

| You just read…                       | Next                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| a module you want the files of       | `blueprint {module: <name>, commitHash}` — exact membership via `HAS_FILE` |
| one file inside a module             | `case_file` → `interrogation` → `the_receipts`          |
| a `dependsOn` edge you want grounded | `collateral_damage` on a file in the depending module   |
| a module whose external edge matters | `cross_repo_lookup` on the package/address it publishes |

Going the other way: if `stakeout` keeps returning files from layers you did
not mean (templates when you want handlers, tests when you want the domain),
you are searching without orientation — call `blueprint` and search inside
the module whose `role` matches the question.
