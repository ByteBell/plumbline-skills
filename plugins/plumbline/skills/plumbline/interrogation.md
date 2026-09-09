---
name: interrogation
description: >
  Dedicated usage skill for the `interrogation` MCP tool — full property map
  plus the behavioural substrate (calls, members, edge cases, contracts) of
  one class/method/function. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# interrogation

Deep-dive ONE code unit. Returns everything the graph knows about it: the
full `CodeUnit` property map and all outgoing substrate edges.

## Digest

`knowledgeId` (required) + `qualifiedName` (required, e.g. `ClassName.method`;
a bare name works as fallback). Optional `relativePath` (pin when the name
exists in several files) and `commitHash` (omit → newest snapshot).

Returns the unit's full property map as a header, then substrate edges as
`{rel, label, detail, dtype}`: `CALLS`, `MEMBERS` (with declared `dtype`),
`PARAMETERS`, `EDGE_CASES`, `PRECONDITIONS`/`POSTCONDITIONS`/`INVARIANTS`,
`LOGIC_STEPS`, `DECORATORS`/`MODIFIERS`/`THROWS`/`CHILD_OF`.

- **The qualifiedName must come from the graph** — a `case_file` or `manhunt`
  result in THIS session. Guessed names miss.
- **One unit at a time.** Deep-diving every unit of a file is the blind-scan
  anti-pattern; `case_file`'s summaries already answer breadth questions.
- **Use the substrate to decide WHAT to read, not as the last word.** "What does
  X assume / call / contain", "what type is field Y", "which edge cases are
  handled" — the substrate answers these fast and points at the exact span. But
  `EDGE_CASES`, `PRE`/`POSTCONDITIONS`, `INVARIANTS` and `LOGIC_STEPS` were
  written by an LLM at index time: under RULE 1 they are leads, not evidence.
  Before you STATE what the unit does, confirm it against `the_receipts` on its
  `startLine`–`endLine`. The structural fields — signature, line range,
  `CALLS`, `MEMBERS` `dtype` — come from a parser and can be trusted as they
  stand.
- Names common to several files (`__init__`, `get`, …) resolve newest-first
  across all matches — pin `relativePath` to disambiguate.
- THIN → on a miss, locate the unit with `manhunt` first rather than trying
  another spelling here.

## Schema

| Field           | Type              | Notes                                                       |
| --------------- | ----------------- | ----------------------------------------------------------- |
| `knowledgeId`   | string (required) | From `roll_call`.                                           |
| `qualifiedName` | string (required) | e.g. `"ClassName.method"`; bare name works as fallback.     |
| `relativePath`  | string (optional) | Pin to one file when the name exists in several.            |
| `commitHash`    | string (optional) | Inspect the unit as of this commit. Omit → newest snapshot. |

## Returns

Header: containing file + commit + the unit's full property map (signature,
startLine/endLine, unitKind, visibility, isAsync/isStatic/isAbstract,
returnType, mutability, summary, ...).

Items — substrate edges as `{rel, label, detail, dtype}`:

| `rel`                                              | What it tells you                                     |
| -------------------------------------------------- | ----------------------------------------------------- |
| `CALLS`                                            | Callees — resolved `CodeUnit`s or `UnresolvedCallee`s |
| `MEMBERS`                                          | Fields/attributes; `dtype` carries the declared type  |
| `PARAMETERS`                                       | Ordered parameters                                    |
| `EDGE_CASES`                                       | Known input edge cases and their behaviour            |
| `PRECONDITIONS` / `POSTCONDITIONS` / `INVARIANTS`  | Behavioural contracts                                 |
| `LOGIC_STEPS`                                      | Step-by-step behavioural description                  |
| `DECORATORS` / `MODIFIERS` / `THROWS` / `CHILD_OF` | Structure and modifiers                               |

## Rules

- **The qualifiedName must come from the graph** — an `case_file` or
  `manhunt` result in this session. Guessed names miss; on a miss,
  the error tells you to locate the unit via `manhunt` first.
- **One unit at a time.** Deep-diving every unit of a file is the blind-scan
  anti-pattern; the file-level map (`case_file` summaries) already
  answers breadth questions.
- **Use the substrate to decide what to read, not as the last word.** "What
  does X assume / call / contain", "what type is field Y", "which edge cases
  are handled" — the substrate answers these fast and names the exact span to
  read. It does not discharge RULE 1: the behavioural rows are LLM-written and
  are routinely right about WHERE and wrong about WHAT, so ground any claim you
  ship in `the_receipts` over the unit's line range. The parser-derived fields
  (signature, `startLine`/`endLine`, `CALLS`, `MEMBERS` `dtype`) need no such
  confirmation.
- **Commit semantics:** CodeUnits are content-addressed and shared across
  commits with identical implementations. The response is anchored to a
  concrete `{relativePath, commitHash}` (newest by default) — pass
  `commitHash` when the question is version-pinned.
- Names that exist in several files (common for `__init__`, `get`, …) are
  resolved newest-first across all matches — pin `relativePath` to
  disambiguate.
