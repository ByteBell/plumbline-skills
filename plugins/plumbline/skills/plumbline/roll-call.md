---
name: roll-call
description: >
  Dedicated usage skill for the `roll_call` MCP tool — discover
  IR-indexed repositories, their knowledgeIds, and each one's newest indexed
  commit (no full commit list). Read when the digest attached to its first result is not enough.
user-invocable: false
---

# roll_call

Discover IR-indexed repositories. **This is the session's entry point** — every
other ir\_\* tool requires a `knowledgeId` that only this tool provides.

## Digest

No arguments — scope comes from the session's org context.

One row per repository: `knowledgeId` (opaque; the required input for every
other tool — never guess it, and it is NOT `repoId`), `repoId`, `repoSlug`,
`orgId`, `type` (`CODE` | `PDF`), plus for CODE `lastIndexedCommit`,
`lastIndexedAt` (when indexing ran — NOT the commit date) and
`indexedCommitCount`.

Only the NEWEST commit is reported, never the full history. To work at an older
snapshot, supply that commit yourself as the downstream `commitHash`; omit it
for the newest.

- Call ONCE per session and reuse the response — the list does not change
  mid-session.
- Do NOT loop the returned repos one at a time. `stakeout`, `manhunt`,
  `dragnet` and `cross_repo_lookup` each sweep EVERY accessible repo in a
  single call when `knowledgeId` is omitted.
- A stale `lastIndexedAt` means the graph predates recent work — say so rather
  than answering as if it were current.
- THIN → an empty result means the session's org owns no indexed repositories.
  Tell the user; do not retry with other tools.

## Schema

No arguments. Scope comes from the session's org context: you see exactly the
repositories owned by the org(s) your session may read.

## Returns

One item per repository — identity plus its newest indexed snapshot:

```json
{
  "knowledgeId": "<opaque string — input for every other ir_* tool>",
  "repoId": "<owner/name>",
  "orgId": "<owning org>",
  "type": "CODE",
  "lastIndexedCommit": "<full sha of the most recently indexed commit>",
  "lastIndexedAt": "<ISO-8601 UTC — when that indexing ran>",
  "indexedCommitCount": 3
}
```

The last three fields are CODE-only; PDF knowledges omit them.

It reports only the NEWEST commit, never the full list. A repo can be indexed
at thousands of commits, so enumerating them on every call (the startup preload
runs this query too) would be an unbounded response — the query aggregates to
one row per repo instead. `indexedCommitCount` tells you how many snapshots
exist without listing them: `1` means `lastIndexedCommit` is the only commit
you can query at.

To work at an OLDER commit you still supply it yourself — from the task brief,
the user's question, or known context — and pass it as the `commitHash`
parameter of `stakeout`, `case_file`, `interrogation`, `manhunt`, and
`the_receipts`. Omit `commitHash` to target the newest snapshot (graph tools)
or newest checkout (`the_receipts`).

## Rules

- **Call ONCE per session**, then reuse the response. The knowledge list does
  not change mid-session.
- **Never guess a knowledgeId.** It is an opaque string (often a readable
  slug, sometimes a UUID) — `repoId` and `knowledgeId` are different fields
  and not interchangeable.
- **Bring your own commit for anything but the newest.** This tool gives you
  the repo and its latest indexed commit, not its commit history. Pass the
  commit you care about (from the brief/context) on every downstream call, or
  omit it for the newest. If a downstream tool returns nothing at a commit,
  that commit simply isn't indexed — pick another or read source via
  `the_receipts`, which reads any on-disk checkout.
- **`lastIndexedAt` is the index date, not the commit date.** It says when
  Plumbline analysed the repo. A stale `lastIndexedAt` means the graph predates
  recent work — say so rather than answering as if it were current.
- An empty result means the session's org owns no IR-indexed repositories —
  do not retry with other tools; tell the user.

`roll_call` reads the graph spine
(`Organization -[:HAS_KNOWLEDGE]-> Knowledge`) — the IR source of truth.
