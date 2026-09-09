---
name: the-receipts
description: >
  Dedicated usage skill for the `the_receipts` MCP tool — read verbatim
  source from an IR-indexed repo's local checkout, by line range or
  search-in-file. The IR-schema tool for reading raw source lines.
  Read when the digest attached to its first result is not enough.
user-invocable: false
---

# the_receipts

Return the **actual source text** of a file in an IR-indexed repo. Every other
ir\_\* tool returns analysis (summaries, signatures, line ranges) — this is the
only one that returns the lines themselves. It works in two modes, chosen by
deployment config:

- **Streaming** (`FILE_STREAMING=true`): bytes are fetched from the file-storage
  server at `{FILE_STORAGE_URL}/files/{orgName}/repo/{knowledgeId}/{commitHash}/{path}`;
  `orgName`/`commitHash` come from the IR graph (no local clone needed).
- **Local disk** (else): bytes are read from the per-commit checkout at
  `<base>/orgs/<org>/github/<owner>/<repo>/<knowledgeId>/<commitHash>/repo/<path>`.

Either way you just pass `knowledgeId` (+ optional `commitHash`) — no path guessing.

## Digest

`knowledgeId` + `relativePath` (both required, exact path from `stakeout` /
`case_file`). Then EITHER range mode — `fromLine` (1-based, default 1),
`toLine` (inclusive; omit → to end, token-capped), `maxTokens` (500–50000,
default 10000) — OR search mode: set `search` (case-insensitive) with
`contextLines` (0–10, default 3), which ignores the range args. Optional
`commitHash` (full or prefix; omit → newest indexed commit).

This is the ONLY tool that returns actual source lines; every other tool
returns analysis. Range mode prefixes each line with its number and reports
`Lines: a-b of TOTAL`, with a `More: re-call with fromLine=N` cursor when the
budget cuts the range.

- **Reach it through the funnel.** Take `relativePath` from a `stakeout` hit
  and the line range from `case_file`/`interrogation` (`startLine`–`endLine`),
  then read exactly that span instead of paging blind.
- Access is org-scoped: a `knowledgeId` outside the session's set is refused.
- "File not found in storage" (streaming) / "No on-disk checkout" (local disk)
  are environment or ingestion gaps, NOT a bad path — do not retry variations.
- **Cite what you read** as `relativePath:fromLine-toLine`, grounded in the
  returned lines rather than the file-level summary.
- THIN → to find a string you cannot place, use `shakedown`, not repeated
  reads here.

## Schema

| Field          | Type              | Notes                                                           |
| -------------- | ----------------- | --------------------------------------------------------------- |
| `knowledgeId`  | string (required) | From `roll_call`.                                               |
| `relativePath` | string (required) | Exact path, as returned by `stakeout` / `case_file`.            |
| `fromLine`     | number (optional) | 1-based start line (range mode). Default 1.                     |
| `toLine`       | number (optional) | 1-based end line, inclusive. Omit → read to end (token-capped). |
| `maxTokens`    | number (optional) | Response cap for range mode (500–50000, default 10000).         |
| `search`       | string (optional) | When set → search mode: only lines containing it + context.     |
| `contextLines` | number (optional) | Context lines around each search match (0–10, default 3).       |
| `commitHash`   | string (optional) | Specific commit (full or prefix). Omit → newest indexed commit. |

## Two modes

- **Range** (default): returns `fromLine`–`toLine`, each line prefixed with its
  number. Header reports `Lines: a-b of TOTAL`; when the range is cut by the
  token budget or runs past the cap, a `More: re-call with fromLine=N` hint
  gives the continuation cursor.
- **Search** (`search` set): scans the whole file, returns every line
  containing the term (case-insensitive) plus `contextLines` around each, with
  a match count. Range args are ignored in this mode.

## Rules

- **Reach this tool through the funnel.** Get `relativePath` from an
  `stakeout` hit and the line range from `case_file` /
  `interrogation` (`startLine`–`endLine`). Then read exactly that span instead
  of paging blind — e.g. a unit at lines 50–68 → `fromLine: 50, toLine: 68`.
- **Commit:** omit `commitHash` to read the newest indexed commit. Pass it
  (full or prefix) only when version-pinned.
- **Access is org-scoped** like every ir\_\* tool: a `knowledgeId` outside the
  session's accessible set is refused — call `roll_call` for valid ids.
- **Source depends on mode.** In streaming mode a missing file reports "file not
  found in storage"; in local-disk mode a missing clone reports "No on-disk
  checkout" — both are environment/ingestion gaps, not a bad path.
- **Cite what you read** as `relativePath:fromLine-toLine`, grounded in the
  returned lines rather than the file-level summary.
