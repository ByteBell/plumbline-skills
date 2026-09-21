---
name: manhunt
description: >
  Dedicated usage skill for the `manhunt` MCP tool — find
  classes/methods/functions with commit-anchored results (per-hit `commits`
  array). Read when the digest attached to its first result is not enough.
user-invocable: false
---

# manhunt

Find code units (classes / methods / functions). Every hit is re-anchored
through the version spine, so it reports the containing file AND the exact
commits whose snapshot includes it.

## Digest

Exactly ONE of `query` (fulltext over name/qualifiedName/summary — use
behaviour words) or `name` (exact `qualifiedName` or bare name — use exact
identifiers). Optional: `repos` (one entry for one repo, several for exactly those, OMIT to
sweep every accessible repo in one call — each entry pins its own `commitHash`), `limit`
(1–100, default 20).

Returns `{knowledgeId, qualifiedName, unitKind, signature, startLine, endLine,
summary (≤250 chars), relativePath, commits, score}`.

- **Read the `commits` array, always.** CodeUnits are content-addressed, so
  commits with identical implementations SHARE one node — a hit proves the unit
  exists *somewhere*, not at the commit you care about. For a version-pinned
  question put the `commitHash` on that repo's `repos` entry; read `commits`
  when no commit is pinned. These are NOT interchangeable: omitting the
  commit on a pinned question returns hits
  anchored to whichever commits happen to share that implementation — which
  looks like an answer while telling you nothing about yours. If you want both
  the anchor and the introduction history, that is two calls, not one.
- **A miss in one mode says nothing about the other** — `name` and `query` hit
  different indexes. Run the second before concluding a name is absent. This is
  the single most common false negative.
- Check `unitKind` before judging a result thin: `interface`/`type`/`enum`,
  `type-member` (`StoreApi.setState`) and `exported-symbol` are lower-recall but
  real. When nothing matches exactly the tool re-runs the name as fulltext and
  the header labels those rows **fulltext matches, not definitions**.
- Type *consumers* are invisible here — a hit shows where a type is declared,
  never who depends on it. Seed `collateral_damage` on the declaring file (all
  seven lenses first, then narrow to `types`).
- THIN → the other mode first, then drop `repos`, then `stakeout`. Past
  that, escalate by WHAT YOU HOLD: a declaring FILE → `collateral_damage`; a
  package / wire address / exported symbol → `cross_repo_lookup`; only a prose
  description of the change → `dragnet`. Falling through to repo-by-repo
  `shakedown` is the classic dead end: grep cannot see a wrapper that forwards a
  value without naming it.
- Next stage DOWN: `interrogation` on the chosen qualifiedName, or `case_file`
  on the containing file.

## Schema

| Field         | Type              | Notes                                         |
| ------------- | ----------------- | --------------------------------------------- |
| `query`       | string (optional) | Fulltext over name/qualifiedName/summary.     |
| `name`        | string (optional) | Exact `qualifiedName` (or bare name) match.   |
| `repos`       | array (optional)  | `[{knowledgeId, commitHash?}]` — which repos to search, each at its own snapshot. One entry, several, or omit for all. |
| `limit`       | int 1–100 (opt.)  | Default 20.                                   |

Provide **exactly one** of `query` / `name`.

## Modes — pick deliberately

- **`query` (fulltext):** "which unit handles X" — searches behavioural
  summaries as well as names, so behaviour words work.
- **`name` (exact):** "where is X defined", "does X exist at commit C",
  "when was X introduced" — existence and location questions.

## Returns

`{knowledgeId, qualifiedName, unitKind, signature, startLine, endLine,
summary (≤250 chars), relativePath, commits, score}` per hit.

## The `commits` array — read it, always

`CodeUnit` nodes are content-addressed: every commit with an identical
implementation SHARES one node. A hit therefore proves the unit exists
_somewhere_, not at the commit you care about. Two correct usages:

1. **Version-pinned question** → pass `commitHash`. An empty result then
   genuinely means "not present at that commit" (the classic trap this tool
   exists to close: a bare symbol index would have answered "it exists" from
   a different commit's snapshot).
2. **No commit pinned** → read each hit's `commits` array before claiming
   existence. The array doubles as a capability diff: a unit present in
   later commits but not earlier ones was introduced in between.

## Rules

- Use behaviour words in `query` mode ("resolve linked alternate script
  field"), exact identifiers in `name` mode ("MarcBase.get_linkage") — not
  the other way around.
- **A miss in one mode says nothing about the other.** `name` and `query` hit
  different indexes. Always run the second mode before concluding a name is
  absent — this is the single most common false negative.
- **Read `unitKind` before judging a result thin.** Beyond CodeUnits, `name`
  mode has three lower recall tiers, and hits in them are real:
  - `interface` / `type` / `enum` — a type declaration; `signature` carries the
    verbatim shape. This is how "tighten/widen this type" questions find their
    epicenter.
  - `type-member` — the name is a property/method declared INSIDE a type shape,
    reported as `StoreApi.setState`. Pass dotted input `TypeName.member` to
    narrow to one declaring type.
  - `exported-symbol` — a file own-exports the name but its declaration shape
    was not extracted (no signature/lines).

  When nothing matches exactly, the tool re-runs the name as fulltext and the
  header labels those rows as **fulltext matches, not definitions**. Read the
  header before treating them as evidence.
- **Type consumers are invisible here.** A hit tells you where a type is
  declared, never who depends on it — type consumers hold no call edge. For
  that, seed `collateral_damage` on the declaring file: the default all seven
  lenses first, then narrow to `lens=['types']` once you have seen which fired.
  A file that merely defines, imports, or re-exports the changed contract IS
  impacted, even with 0 CodeUnits.
- **Thin ≠ absent — escalate, don't grep.** First the other mode, then drop
  `repos` (one call sweeps every accessible repo), then `stakeout`
  `searchIn='both'`. Past that the next tool is chosen by WHAT YOU HOLD, not by
  a fixed sequence: a seed FILE → `collateral_damage`; a package / wire address
  / exported symbol → `cross_repo_lookup`; a change you can describe but name
  nothing in → `dragnet`. Falling through to repo-by-repo `shakedown` is the
  classic dead end: grep cannot see a wrapper that forwards the value without
  naming it.
- A changed implementation is a NEW CodeUnit node: the same qualifiedName can
  appear once per distinct implementation, each with its own `commits` set.
  That is signal (the unit changed between those commits), not duplication.
- Next stage: `interrogation` on the chosen qualifiedName, or
  `case_file` on the containing file.
