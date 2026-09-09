---
name: pagination
description: >
  Canonical doc for Plumbline's cache-backed pagination envelope. The
  middleware owns pagination end-to-end — handlers always return their full
  result for a given input, and the middleware paginates + caches it. Read
  once when you need to iterate beyond page 1 or want to understand how
  same-input calls become instant.
user-invocable: false
---

# Pagination envelope

Every Plumbline MCP tool response ends with a JSON envelope describing the
current page and whether more pages exist. Find it after a `---` separator
on its own line at the end of the response text:

```
<the actual tool result>

---
{"pagination":{"page":1,"pageSize":3,"totalItems":12,"totalPages":4,"hasNextPage":true,"hasPrevPage":false,"mode":"items"}}
```

## Fields

| Field         | Type   | Meaning                                                                                                   |
| ------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `page`        | int    | 1-based current page.                                                                                     |
| `pageSize`    | int    | Items on this page.                                                                                       |
| `totalItems`  | int    | Total items across all pages of this logical query.                                                       |
| `totalPages`  | int    | Total pages available.                                                                                    |
| `hasNextPage` | bool   | If true, call again with `page: N+1` to fetch more.                                                       |
| `hasPrevPage` | bool   | If true, prior pages are available via `page: N-1`.                                                       |
| `mode`        | string | `items` — paginated by middleware token-packing; `passthrough` — single fixed response (always one page). |

## How to iterate

1. Read the envelope on the response you got.
2. If `hasNextPage` is true, re-call the same tool with the same arguments
   plus `page: pagination.page + 1`.
3. Stop when `hasNextPage` is false.

Out-of-range pages are clamped to the last valid page rather than returning
empty — `page: 9999` on a 4-page result returns page 4 with `hasNextPage:
false`.

## Session cache — the speed win

The pagination middleware caches every paginated response in a per-session
LRU keyed by `(sessionId, toolName, canonicalInput-without-page)`. What this
means for you, the agent:

- **First call** with a given logical input → handler runs, full result is
  cached.
- **Every subsequent page of that same input is a free memory lookup.** The
  handler does **not** run again for `page: 2`, `page: 3`, etc. — the
  middleware slices from the cached full result.
- Cache is **session-scoped** — entries never bleed across sessions.
- TTL is **5 minutes by default** (override: `MCP_PAGINATION_CACHE_TTL_MS`).
  After that the handler runs again.
- Errors are **never cached** — a failed page request retries cleanly.

This is why dropping a `page: 2` request after `page: 1` is essentially
free, while a `pageSize` change or any other input edit creates a new cache
entry and re-runs the handler.

## What changes a cache key

Identical inputs hit the same cache entry; any of these miss:

- A different `knowledgeId`, `query`, `operation`, or any other tool param
- A different commit hash
- Inputs that differ only in key order — these normalize to the same key

The `page` field is **always excluded** from the cache key, so pages 1, 2,
3, … of the same logical query share one cache entry. The `reason` field
(see below) is **also excluded** — it never affects caching or results.

## Universal parameters (`page`, `reason`)

Two parameters are accepted by **every** Plumbline tool and injected by the
middleware — you won't see them in each tool's individual schema, but you can
always pass them:

- **`page`** (int, optional) — pagination cursor, described above.
- **`reason`** (string, optional) — one small paragraph stating what the user is
  trying to accomplish with this call (your intent). No verbatim conversation,
  no personal data. It is recorded alongside the call to evaluate and improve
  tool quality; it does not change the result and is excluded from the cache
  key. Populate it on every call when you can — it costs nothing and makes the
  tool's behavior auditable.

## Result-set safety caps

Because handlers no longer slice by page, each handler caps the size of the
result set it returns. When a cap is hit the response surfaces a notice in
the body header (e.g. "Result-set safety cap hit. Narrow your query…").
This is not a pagination boundary — you cannot page past the cap by
incrementing `page`. The fix is to narrow the query (more specific
`folderPath`, `glob`, `path`, `semanticFilter`, etc.).

Handlers bound their result sets three different ways, and the fix differs:

- **An argument you control** — `limit` on the search tools, `topK` on
  `paper_trail`. Raise it (within its max) or narrow the query.
- **A hard cap inside the tool** — `the_receipts` reads at most 50 paths per
  bulk call and truncates each file at its token budget, reporting
  `Truncated: yes` in the body header. Split the call; paging cannot reach
  past it.
- **A token-budget trim** — `paper_trail` drops results (keeping at least 3)
  when a response would exceed the per-call budget and says so in a `_note`.
  Scope with `knowledgeId` or lower `topK`; the dropped entries are gone, not
  on page 2.

Datasets already bounded by their own tier (`roll_call`, `blueprint` — one row
per module, not per file — and `evidence_locker`) need none of this.

## When to look for the envelope

You only need to read it when the tool's prose suggests more data exists,
or when you want to fetch a specific page. For short fixed responses (acks,
errors, single records) the envelope will say `mode: passthrough` with one
page — safe to ignore.

## Tools that paginate (items mode)

- `roll_call` (indexed-repo list)
- `blueprint` (one repo's modules at a commit)
- `stakeout` (file matches)
- `manhunt` (class/method/function matches, tagged by kind)
- `case_file` (code units within one file)
- `interrogation` (one unit's substrate rows)
- `collateral_damage`, `cross_repo_lookup`, `dragnet` (cross-repo hits)
- `shakedown` (raw-source grep matches) and `evidence_locker` (resource list)
- `the_receipts` in `search` / `bulk_search` mode (multiple hits)

## Tools that don't really paginate (passthrough mode)

`file_a_complaint`, `case_notes`, `cold_case`, `pull_the_evidence`,
`paper_trail`, `read_the_fine_print`, `mugshot`, and `the_receipts` when
reading a single fixed line range — these return one page. The envelope is
appended for uniformity; `hasNextPage` is always false. The response's `mode`
field is always authoritative.
