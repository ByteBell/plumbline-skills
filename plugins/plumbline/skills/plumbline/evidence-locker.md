---
name: evidence-locker
description: >
  FALLBACK tool — primitive MCP clients only. Returns the same resource list
  that compliant clients get from the standard resources/list request. If
  your client supports MCP resources, do not use this tool.
user-invocable: false
---

# evidence_locker

**FALLBACK ONLY.** This tool exists for MCP clients that only implement the
tools surface (no `resources/list` / `resources/read` support). Compliant
clients should use the native MCP resource methods.

## Digest

Optional `uriPrefix` (return only URIs starting with it, e.g.
`"plumbline://skills/"`). Returns `{uri, name, mimeType, description}` per item —
the same shape as MCP `resources/list`.

**Do not use this if your client supports `resources/list`** — use that instead.
If you already have the URI you want, skip straight to `pull_the_evidence` (or,
better, native `resources/read`).

URIs you will see: `plumbline://skills/index`,
`plumbline://skills/<skill>/<file>.md`, `plumbline://hooks/index`,
`plumbline://hooks/<hook>`.

## When NOT to use this tool

- Your client supports `resources/list` — use that instead.
- You already have the URI you want (e.g. from bootstrap instructions) —
  jump straight to `pull_the_evidence` (or, ideally, native `resources/read`).

## When to use this tool

- Your client cannot enumerate resources natively.
- You need to discover the available `plumbline://...` URIs (skills, hooks,
  indices) before reading them.

## Input

| Field       | Type               | Notes                                                                                           |
| ----------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `uriPrefix` | string (optional)  | Filter — return only resources whose URI starts with this prefix (e.g. `"plumbline://skills/"`). |
| `page`      | int ≥ 1 (optional) | 1-based page. Auto-injected by the pagination middleware.                                       |

## Output

Each item: `{ uri, name, mimeType, description }` — identical shape to
MCP `resources/list` entries. The trailing pagination envelope describes
how many pages of resources exist.

## Typical URIs you'll see

- `plumbline://skills/index` — JSON listing all skills + their files
- `plumbline://skills/<skillName>/<filename>.md` — individual skill files
- `plumbline://hooks/index` — JSON listing all hooks
- `plumbline://hooks/<hookName>` — individual hook JSON
