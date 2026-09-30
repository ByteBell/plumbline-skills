---
name: case-file
description: >
  Dedicated usage skill for the `case_file` MCP tool — one call
  returning a file's analysis header plus its complete code-unit map
  (signatures, line ranges, summaries) at a chosen commit. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# case_file

Map one located file in a single call: the `FileVersion` analysis header plus
every `CodeUnit` (class / method / function) ordered by line.

## Digest

`knowledgeId` (required, from `roll_call`) + `relativePath` (required, exact —
as returned by `stakeout`/`manhunt`). Optional `commitHash`; omit for the
newest snapshot.

Returns a sticky header (`commitHash`, `commitDate`, `language`, `lineCount`,
`tokenCount`, `totalChunks`, `purpose`, `summary`, `businessContext`) plus one
item per code unit ordered by `startLine`: `{qualifiedName, unitKind, signature,
startLine, endLine, summary}`. On a **big file** (`totalChunks` > 0) the header
also carries `chunks` — every slice the graph holds the file as, with
`chunkIndex`, `startLine`–`endLine` (file lines at this snapshot), and that
slice's own `purpose`, `summary` and `moduleLevelCode` — and the file-level
`purpose`/`summary` are null, because a big file's analysis lives on its chunks.

- **Reach this tool through search.** The `relativePath` must come from a
  `stakeout`/`manhunt` hit or verbatim from the user — paths invented from
  repository-layout priors miss and violate the funnel.
- Unchanged files keep their previous snapshot, so the newest snapshot (the
  default) IS the file's current state. Pass `commitHash` only when the question
  is version-pinned.
- A commit indexes a version of a file only if it CHANGED it, so most commits
  hold no snapshot of any given path. Asking for one there is not a miss: you get
  the file's state AT that commit — its newest snapshot at or before it, never a
  later one. **Read the returned `commitHash`**: it is the snapshot you actually
  got, and the hash to quote and to pass to `the_receipts`.
- A commit this repo never indexed still errors, and that error lists the commits
  that DO have a snapshot of this path — pick from it rather than retrying blind.
- Call once per file per session; the unit map does not change mid-session.
- **Cite `startLine`–`endLine`.** It is the grounding for any claim about the
  file, and the input for `the_receipts`.
- THIN → an empty unit map means the file was not unit-extracted, not that it is
  empty; read it with `the_receipts`.
- BIG FILE → null `purpose`/`summary` on the header is the shape, not a gap: read
  `chunks`. Place a line in its chunk by the chunk ranges and read THAT chunk's
  purpose/summary/moduleLevelCode; the other chunks' purposes are the file's
  map. The unit map below is still the whole file, in file coordinates.
- Next stage DOWN: `interrogation` on ONE qualifiedName of interest — not on
  every unit in the file — or `the_receipts` for the verbatim source.

## Schema

| Field          | Type              | Notes                                      |
| -------------- | ----------------- | ------------------------------------------ |
| `knowledgeId`  | string (required) | From `roll_call`.                          |
| `relativePath` | string (required) | Exact path, as returned by `stakeout`.     |
| `commitHash`   | string (optional) | Full 40-char hash. Omit → newest snapshot. A commit that did not change the file resolves to its state there, never to a later version. |

## Returns

Header (sticky across pages):

```json
{
  "commitHash": "...",
  "commitDate": "...",
  "language": "...",
  "lineCount": 0,
  "tokenCount": 0,
  "totalChunks": 0,
  "purpose": "...",
  "summary": "...",
  "businessContext": "..."
}
```

On a big file (`totalChunks` > 0) the header also has `chunks`, ordered by
`chunkIndex`, and `purpose`/`summary` above are null:

```json
"chunks": [
  {
    "chunkIndex": 0,
    "startLine": 1,
    "endLine": 343,
    "purpose": "<this slice's role>",
    "summary": "<this slice's behaviour>",
    "moduleLevelCode": "<imports and module-level statements in this slice, or null>"
  }
]
```

Items — one per code unit, ordered by `startLine`:

```json
{
  "qualifiedName": "ClassName.method",
  "unitKind": "method",
  "signature": "def method(self, x: int) -> str",
  "startLine": 50,
  "endLine": 68,
  "summary": "<behavioural summary>"
}
```

## Rules

- **Reach this tool through search.** The `relativePath` must come from an
  `stakeout` / `manhunt` hit (or verbatim from the user) —
  paths invented from repository-layout priors miss and violate the funnel
  guardrail.
- **Commit semantics:** unchanged files keep their previous snapshot, so the
  newest snapshot (the default) IS the file's current state. Pass
  `commitHash` only when the question is version-pinned.
- **A repo-level commit is a legitimate argument.** HEAD, `roll_call`'s
  `lastIndexedCommit`, or the `commitHash` another file came back with names no
  snapshot for a path that commit did not touch — that is the normal case, not an
  error. The file's state THERE is returned instead: its newest snapshot at or
  before that commit. The bound is one-directional, so a version written AFTER
  the commit you pinned is never returned.
- **Quote the `commitHash` you got back, not the one you sent.** They differ
  whenever the state was carried forward, and the returned one is what the line
  ranges and analysis below it describe. It is also the hash to hand
  `the_receipts`.
- **A commit this repo never indexed still errors**, and the error lists the
  commits that DO have a snapshot of this path — pick from that list instead of
  retrying blind.
- **Call once per file per session.** The unit map does not change
  mid-session; reuse the response.
- **Cite line ranges.** `startLine`–`endLine` per unit is the grounding for
  any claim about the file ("the bug is in `from_input`, lines 50–68"), and
  the input for `the_receipts` when you need the verbatim source.
- **A big file is read through its chunks.** `chunks` is the file's map: each
  slice's range and its own analysis. A line belongs to the chunk whose
  `startLine`–`endLine` holds it; read that chunk's `purpose`, `summary` and
  `moduleLevelCode` for the context around it, and the other chunks' purposes
  for the rest of the file. Units are unaffected — their spans are already file
  coordinates, whichever chunk they sit in.
- Next stage: `interrogation` on ONE `qualifiedName` of interest — not on
  every unit in the file — or `the_receipts` to read a unit's exact lines.
