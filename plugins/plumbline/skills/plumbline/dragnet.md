---
name: dragnet
description: >
  Dedicated usage skill for the `dragnet` MCP tool — find the files a change
  hits when you CANNOT name them. The standard escalation when manhunt,
  stakeout or shakedown go thin. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# dragnet

Find the files a change hits **when you cannot name them**.

`manhunt`, `stakeout` and `shakedown` all require you to supply a name, a word,
or a literal string. A convention that spans repos is usually called something
different in each one — so all three go thin at exactly the moment the question
gets interesting. `dragnet` requires none of that: it walks the graph outward
and **harvests the next round of names from the graph itself**, which is how
private internals of other repos surface without ever being guessed.

**If you are about to invent another search string, call this instead.**

## Digest

`knowledgeId` (required — the **CHANGED** repo, not the one you are curious
about; the walk is directional and starts at what the seed publishes).
Optional: `repos` (`[{knowledgeId, commitHash?}]` — which repos RESULTS may
come from; the seed stays in scope; omit for all), `symbols` (the changed public
surface — OMIT to sweep every consumer of the seed repo's packages, much
broader), `query` (**strongly recommended**), `hops` (1–3, default 2),
`includeNamespace` (default true), `includeOrigin` (default true — also return
the seed repo's own file that DEFINES one of `symbols`, which no hop reaches),
`limit` (1–100, default 30).

**`query` must stay SHORT** — it is a fulltext query, not a prompt. A handful of
content words: `"throws promise to suspend until value resolves pending
thenable"`. Padding it into a sentence dilutes the score enough to drop real
hits out of range: a target ranked #36 on a tight phrase fell out of the top 300
when the same change was written as a paragraph.

What each hop reaches: **1** — other repos importing your `symbols` (hard
edges). **2** — the symbols THOSE files import, resolved through `EXPORTS` to
their defining files; this is the hop that reaches names that are nobody's
public API. **3** — in-repo neighbours via `IMPORTS_FILE`. The **behaviour
lens** (`query`) reaches files coupled semantically with no import path at all.

- Every row reports `hop`, `via` and `reachedBy` — read them before promoting a
  row to "impacted". A behaviour-lens hit is a lead; an import edge is proof.
- Harvested names are the point: a row's `via` names a package or symbol you can
  hand straight to `cross_repo_lookup`.
- THIN → widen the seed, do NOT fall back to grep: drop `symbols` → add or
  shorten `query` → raise `hops` to 3 or raise `limit` → re-seed with a
  different changed repo.
- Not for: a seed FILE you have (`collateral_damage`), a coordinate you have
  (`cross_repo_lookup`), or a literal string in one repo (`shakedown`).

## Schema

| Field              | Type              | Notes                                                       |
| ------------------ | ----------------- | ----------------------------------------------------------- |
| `knowledgeId`      | string (required) | The CHANGED repo (from `roll_call`). The walk starts at what it publishes. |
| `repos`            | array (optional)  | `[{knowledgeId, commitHash?}]` — which repos RESULTS may come from. The seed stays in scope regardless. Omit for all. |
| `symbols`          | string[] (opt.)   | The changed public surface — names you CAN name. Omit for every consumer of the seed repo's packages (much broader). |
| `query`            | string (opt.)     | Short behavioural phrase describing what the change DOES. Enables the behaviour lens. **Strongly recommended.** |
| `hops`             | int 1–3 (opt.)    | How far to walk. Default 2.                                  |
| `includeNamespace` | bool (opt.)       | Count whole-module imports (`import * as React`) as consumers. Default true. |
| `includeOrigin`    | bool (opt.)       | Also return the seed repo's own file that DEFINES one of `symbols` — its own contract, which hop 1 (other repos only) and hop 2 (never re-harvests the seed) cannot reach. Default true. |
| `limit`            | int 1–100 (opt.)  | Default 30.                                                  |

## `query` must stay SHORT

This is a fulltext query, not a prompt. Keep it to a handful of content words:
`"throws promise to suspend until value resolves pending thenable"`.

Padding it into a full sentence or a paragraph dilutes the score enough to drop
real hits out of range entirely — measured: a target ranked #36 on a tight
phrase fell out of the top 300 when the same change was written as a paragraph.

## The hops — what each one reaches

- **Hop 1** — other repos importing your changed `symbols`. Hard edges.
- **Hop 2** — the symbols THOSE files import, resolved through `EXPORTS` to
  their defining files. This is the hop that reaches names that are nobody's
  public API and that you could not have guessed.
- **Hop 3** — in-repo neighbours via `IMPORTS_FILE`.
- **Behaviour lens** (`query`) — files coupled semantically with **no import
  path at all**. Nothing else in the tool surface reaches these.

Every row reports `hop`, `via` and `reachedBy`, so hard edges stay
distinguishable from soft leads. Read those fields before you promote a row to
"impacted" — a behaviour-lens hit is a lead, an import edge is proof.

## When results are thin

Widen the seed; do **not** fall back to grep.

1. Drop `symbols` → sweeps every consumer of the seed repo's packages.
2. Add or shorten `query` → reaches the semantically coupled files.
3. Raise `hops` to 3, or raise `limit`.
4. Re-seed with a different changed repo — the surface may be published
   elsewhere.

## Rules

- **Seed with the repo that CHANGED**, not the repo you are curious about. The
  walk is directional: it starts at what the seed publishes.
- Harvested names are the point. A row's `via` names a package or symbol you
  can hand straight to `cross_repo_lookup` to find its defining file.
- **Not for**: a seed FILE you already have (`collateral_damage`), a coordinate
  you already have (`cross_repo_lookup`), or confirming a literal string inside
  one repo (`shakedown`).
- Next stage: `case_file` on a returned file, or `cross_repo_lookup` on a
  harvested symbol.
