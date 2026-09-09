---
name: cross-repo-lookup
description: >
  Dedicated usage skill for the `cross_repo_lookup` MCP tool — resolve a global
  coordinate (package / wire address / exported symbol) to the files on each
  side of it. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# cross_repo_lookup

Resolve a **global cross-repo coordinate** to the files on each side of it.

Complements `collateral_damage`: that seeds on a FILE ("what does changing this
break"); this seeds on a coordinate ("who provides / consumes / defines this").

## Digest

Seed EXACTLY ONE of:

- **`package`** (e.g. `@reduxjs/toolkit`) — every repo/file importing it, plus
  who publishes it. Add `symbols` (+ `includeNamespace`, default true) to turn
  "who imports react" into "who imports the changed surface".
- **`address`** (e.g. `POST /api/orders`, `orders.created`, a table name) —
  files that PROVIDE vs CONSUME it, split by role. The only way to pair the two
  sides of a route/event/queue: they share no import edge at all.
- **`symbol`** — the file that actually DEFINES the name, seeing past barrel
  re-exports via `EXPORTS` provenance. A barrel `index.ts` and the real defining
  file look identical to every other tool.

Optional `limit` (1–100, default 20). Results are always org-scoped.

**Harvest and loop — the intended usage.** Package rows carry the importing
file's own `symbols`/`subpaths`, so an import edge names the internals it
depends on: `{package}` → harvest a name → `{symbol: <name>}` → its defining
file → repeat. That loop reaches internals nobody publishes and replaces
guessing names. Run it before reaching for `shakedown`.

- Rows tagged `matchedBy=['namespace']` are whole-module importers — leads that
  *may* use the changed symbol; they sort last.
- THIN → try the OTHER seed kind first. A package can be published under a
  different name (`path`, `node:path`, `path (Node.js built-in)` are distinct
  nodes); a symbol may only be reachable via its exporting package; an older
  snapshot can be invisible as a provider yet visible as a consumer. Still
  nothing → `dragnet`, which harvests coordinates instead of requiring them.
- Not for: "what breaks if I change this file" (`collateral_damage`), a change
  you can only describe in prose (`dragnet`), or a literal string in one repo
  (`shakedown`).

## Schema

Seed **exactly one** of `package` / `address` / `symbol`.

| Field              | Type             | Notes                                                        |
| ------------------ | ---------------- | ------------------------------------------------------------ |
| `package`          | string (opt.)    | Published package name, e.g. `@reduxjs/toolkit`.             |
| `address`          | string (opt.)    | Wire address, e.g. `POST /api/orders`, `orders.created`, a table name. |
| `symbol`           | string (opt.)    | Exported name → the file that actually DEFINES it, past barrel re-exports. |
| `symbols`          | string[] (opt.)  | `package` mode only — narrow to files importing THESE names. |
| `includeNamespace` | bool (opt.)      | With `symbols`: also return whole-module importers. Default true. |
| `limit`            | int 1–100 (opt.) | Default 20.                                                  |

## The three seed kinds

- **`package`** — every repo/file that imports it, plus who publishes it. Add
  `symbols` to turn "who imports react" into "who imports the changed surface".
- **`address`** — files that PROVIDE/serve it vs CONSUME/call it, **split by
  role**. This is the only way to pair the two sides of an HTTP route, event or
  queue: the provider and the consumer share no import edge at all.
- **`symbol`** — the file that actually defines the name, seeing past barrel
  re-exports via `EXPORTS` provenance. A barrel `index.ts` and the real
  defining file look identical to every other tool; this one tells them apart.

## Harvest and loop — the intended usage

Package rows always carry the importing file's own `symbols`/`subpaths`. A
consumer's import edge **names the internals it depends on**.

```text
cross_repo_lookup {package: "…"}   → rows carry symbols: ['QueryObserver', …]
        ↓ harvest a name
cross_repo_lookup {symbol: "QueryObserver"} → its defining file
        ↓ repeat
```

That loop is how you reach internals nobody publishes — and it replaces
guessing names entirely. Run it before reaching for `shakedown`.

## When results are thin

Try the other seed kind before concluding anything:

- A `package` that returns nothing may be published under a different name —
  built-ins and scoped aliases do not always normalise (`path`, `node:path`
  and `path (Node.js built-in)` can be distinct nodes).
- A `symbol` may only be reachable through the package that exports it.
- Only repos indexed with the package layer publish as providers; an older
  snapshot can be invisible as a provider while still visible as a consumer.

Still nothing → `dragnet`, which harvests the coordinates instead of requiring
them.

## Rules

- **Org-scoped, always.** Results are filtered to the session's allowed
  `knowledgeIds`; a lookup never exposes another org's files.
- Rows tagged `matchedBy=['namespace']` are whole-module importers — they *may*
  use the changed symbol, so they sort last. Treat them as leads.
- **Not for**: "what breaks if I change this file" (`collateral_damage`), a
  change you can only describe in prose (`dragnet`), or a literal string inside
  one repo (`shakedown`).
- Next stage: `case_file` on a returned file.
