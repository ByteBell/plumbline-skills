---
name: the-receipts
description: >
  Dedicated usage skill for the `the_receipts` MCP tool — get verbatim
  source from an IR-indexed repo: a code unit's line range inline with a
  100-line buffer, a whole file inline, or a search inside a file. The IR-schema tool for reaching raw source.
  Read when the digest attached to its first result is not enough.
user-invocable: false
---

# the_receipts

Reach the **actual source text** of a file in an IR-indexed repo. Every other
ir\_\* tool returns analysis (summaries, signatures, line ranges) — this is the
only one that reaches the bytes themselves — the commit's `repository/` tree
exactly as the ingestion pipeline stored it — and what you get back depends on what you ask for:

- **Range** (`symbol`, or `fromLine`/`toLine` — a code unit): the lines come
  back **inline**, widened by 100 lines on each side so the unit arrives with
  its imports, siblings and call sites, token-budgeted.
- **Whole file** (no line args, no `search`): the file comes back **inline**
  from line 1, under the same token budget.
- **Search** (`search` set, and `bulk_search`): the file is scanned server-side
  and only the matching lines + context come back.

Either way you just pass `knowledgeId` (+ optional `commitHash`) — no path guessing.

## Digest

`knowledgeId`, plus `relativePath` (exact path from `stakeout` / `case_file`)
**or** `symbol`. Optional `commitHash` (full or prefix; omit → newest indexed
commit).

**A code unit by NAME** — pass `symbol`: `addEventListener`, or the qualified
`FragmentInstance.prototype.addEventListener`. The span is resolved in the
graph at this commit and those lines come back inline. With no
`relativePath` it finds the file too; with one, it narrows to that file. The
header names the declaration it resolved and the lines it occupies, so you cite
what you actually got.

**A code unit by NUMBER** — pass `fromLine`/`toLine` from `case_file` /
`interrogation`'s `startLine`–`endLine`. `Requested:` restates your span;
`Lines: a-b of TOTAL` is what was returned; a `More: re-call with fromLine=N`
cursor appears when the budget (`maxTokens`, 500–50000, default 10000) cuts it.

**ASK BY NAME UNLESS THE NUMBERS CAME FROM THIS COMMIT.** A line number only
addresses the snapshot it was read from. One carried in from a pull request's
diff, an editor, a stack trace or an older commit addresses a **different
file** — and nothing in the result says so, because the wrong lines look exactly
like the right ones. A name survives those commits where a number does not.

Two or more declarations of one name come back as a list of
`path:start-end  qualifiedName` — re-call with `relativePath` or the qualified
name. No match says so, and says the symbol may postdate this commit or live in
a test file (those are not indexed).

**A whole file** — no line args — comes back inline from line 1: `Lines: 1-b of
TOTAL`, with a `More: re-call with fromLine=N` cursor when the budget cuts it.

Set `search` (case-insensitive) with `contextLines` (0–10, default 3) to get
matching lines instead; the range args are ignored in that mode.

- **Reach it through the funnel.** Take `relativePath` from a `stakeout` hit,
  then ask for the span by `symbol` — or by the `startLine`–`endLine` that
  `case_file`/`interrogation` reported on this commit — instead of reading blind.
- Access is org-scoped: a `knowledgeId` outside the session's set is refused.
- "File not found" is an ingestion gap for that path at that commit, NOT
  a bad path — do not retry variations.
- **Cite what you read** as `relativePath:fromLine-toLine`, grounded in the
  returned lines rather than the file-level summary.
- THIN → to find a string you cannot place, use `shakedown`, not repeated
  calls here.

## Why `symbol` exists — a measured failure

Measured on `react/react`, 2026-09-20. A pull request whose base was 39 commits
past the indexed snapshot had its changed function sitting ten lines lower than
the diff said. So the diff's `old lines 3063-3074`, handed straight to this
tool, landed inside `removeEventListener` while the caller was reasoning about
`addEventListener`.

The caller — a reviewing agent — noticed the mismatch, could not trust a single
line it had read, and declined to report anything at all. A whole run spent to
produce nothing, and the only signal that anything was wrong was buried in its
own reasoning. Had it *not* noticed, it would have reported confident findings
about code that is not there.

The fix is not to make callers better at arithmetic across commits. It is to
stop asking them to do it: pass the name, and the span is resolved here against
the snapshot that is actually being read.

## Schema

| Field          | Type              | Notes                                                               |
| -------------- | ----------------- | ------------------------------------------------------------------- |
| `knowledgeId`  | string (required) | From `roll_call`.                                                   |
| `operation`    | string (optional) | `single` (default), `bulk_search`, `bulk_retrieve`.                 |
| `relativePath` | string            | Exact path, as returned by `stakeout` / `case_file`. Required for `single` unless `symbol` is given; with `symbol`, narrows it to this file. |
| `symbol`       | string (optional) | `single` only. A declaration's name, bare or qualified. Its span is resolved in the graph at this commit → inline range. Prefer over line args whenever the numbers came from outside this snapshot. |
| `paths`        | string[] (opt.)   | File paths for `bulk_search` / `bulk_retrieve` (max 50).            |
| `fromLine`     | number (optional) | 1-based start of the unit, from `case_file`/`interrogation` ON THIS COMMIT. Either line arg → inline range. |
| `toLine`       | number (optional) | 1-based end line, inclusive. Omit → to end.                         |
| `maxTokens`    | number (optional) | Token cap per file (500–50000, default 10000).                      |
| `search`       | string (optional) | When set → search mode: only lines containing it + context.         |
| `matchOnly`    | boolean (opt.)    | `bulk_search` only: counts + line numbers, no context windows.      |
| `contextLines` | number (optional) | Context lines around each search match (0–10, default 3).           |
| `commitHash`   | string (optional) | Specific commit (full or prefix). Omit → newest indexed commit.     |

## Three modes

- **Range** (`fromLine`/`toLine` set): returns the span plus 100 lines each
  side, each line prefixed with its number. Header reports `Requested:` and
  `Lines: a-b of TOTAL`; when the token budget cuts it, a
  `More: re-call with fromLine=N` hint gives the continuation cursor.
- **Whole file** (no line args): returns the file from line 1, numbered, under
  the token budget, with the same `More:` cursor. `bulk_retrieve` follows the
  same rule per path — line args → inline ranges, none → each whole file —
  with `ERROR:` for a path that is not at that commit.
- **Search** (`search` set): scans the whole file server-side, returns every
  line containing the term (case-insensitive) plus `contextLines` around each,
  with a match count. Range args are ignored in this mode. `bulk_search` does
  the same across `paths` and adds a `noMatch:` list — a definitive "absent"
  signal for those files.

## Rules

- **Reach this tool through the funnel.** Get `relativePath` from an
  `stakeout` hit and the line range from `case_file` /
  `interrogation` (`startLine`–`endLine`). Then ask for exactly that span
  instead of reading blind — e.g. a unit at lines 50–68 →
  `fromLine: 50, toLine: 68`; lines 1–168 come back.
- **Commit:** omit `commitHash` to read the newest indexed commit. Pass it
  (full or prefix) only when version-pinned.
- **Access is org-scoped** like every ir\_\* tool: a `knowledgeId` outside the
  session's accessible set is refused — call `roll_call` for valid ids.
- **"File not found"** means that path is not stored for that
  commit — an ingestion gap, not a bad path.
- **Cite what you read** as `relativePath:fromLine-toLine`, grounded in the
  returned lines rather than the file-level summary.
