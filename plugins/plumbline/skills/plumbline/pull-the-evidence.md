---
name: pull-the-evidence
description: >
  FALLBACK tool — primitive MCP clients only. Returns the body of a single
  plumbline:// resource. If your client supports MCP resources/read, do not
  use this tool.
user-invocable: false
---

# pull_the_evidence

**FALLBACK ONLY.** This tool exists for MCP clients that only implement the
tools surface (no `resources/list` / `resources/read` support). Compliant
clients should use the native `resources/read` method.

## Digest

`uri` (required, exact). Supported prefixes: `plumbline://hooks/...` and
`plumbline://skills/...`, plus the two index URIs. Returns the resource body
verbatim, prefixed by `# <uri> (<mimeType>)`.

**Do not use this if your client supports `resources/read`** — use that instead.

Errors are specific and final, not retry hints: `unknown hook resource` /
`unknown or invalid skill resource` (file absent, or a rejected path-traversal),
`unsupported resource URI` (there is no fallback to arbitrary disk reads),
`<root> not configured on this server`.

## When NOT to use this tool

- Your client supports `resources/read` — use that instead.

## When to use this tool

- Your client cannot fetch resources natively but can call tools.
- You have the exact URI (from `evidence_locker` or bootstrap instructions).

## Input

| Field | Type              | Notes                                                                                                                                                                             |
| ----- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uri` | string (required) | Exact resource URI. Supported prefixes: `plumbline://hooks/...`, `plumbline://skills/...`. The two index URIs (`plumbline://hooks/index`, `plumbline://skills/index`) are also valid. |

## Output

The resource body verbatim, prefixed by a single line `# <uri> (<mimeType>)`
so the caller can see what they got. The pagination envelope at the end is
trivial (one page) because resources are read whole.

## Errors

- `unknown hook resource: <uri>` / `unknown or invalid skill resource: <uri>` —
  the URI parsed but the underlying file isn't there or violates the safe-path
  check (path traversal attempts are rejected).
- `unsupported resource URI: <uri>` — the URI doesn't match the four known
  shapes. There's no fallback to arbitrary disk reads.
- `<root> not configured on this server` — the server has no hooks/skills
  directory mounted.

## Common URIs

- `plumbline://skills/index` — JSON list of every skill + its files
- `plumbline://skills/plumbline/pagination.md` — the pagination doc
- `plumbline://skills/plumbline/the-receipts.md` — `the_receipts` skill doc
- `plumbline://hooks/index` — JSON list of every hook
- `plumbline://hooks/chat-capture` — chat-capture hook merge fragment
