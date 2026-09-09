---
name: shakedown
description: >
  Dedicated usage skill for the `shakedown` MCP tool — GREP the verbatim source
  text of ONE indexed repository. Confirmation tool, not a discovery tool;
  carries a hard call budget. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# shakedown

GREP the raw source text of **one** indexed repository — the on-disk ingestion
snapshot, not the graph and not the LLM analysis. It is the only surface that
sees text the graph never stores: a `typeof x === 'function'` fork, a
copy-pasted helper, a magic string, a TODO.

## Digest

`knowledgeId` (required — ONE repo per call) + `pattern` (required, ≤300 chars,
literal unless `regex: true`). Optional: `regex`, `caseSensitive` (default
false), `pathContains`, `commitHash` (default newest), `scope` (`source` |
`analysis`), `contextLines` (0–5, default 1), `maxMatches` (1–200, default 50).

**A pattern with `|`, groups or quantifiers and no `regex: true` is matched
literally and silently returns 0 hits** — the most common false "this doesn't
exist" on the whole tool surface.

**Confirmation tool, not a discovery tool.** It matches text, so it is
structurally blind to (1) pass-through sites — a wrapper that forwards a value
without naming it contains no matchable text, and these usually outnumber the
explicit sites — and (2) the same idea named differently in another repo. A grep
that returns every fork can still be missing most of the blast radius.

- **Budget: two patterns per repo.** If two have not produced a decisive hit,
  stop — the thing is not written as text there. Watch for the widening spiral
  (`Updater<T>` → `Updater` → `typeof` → `set`) and the repo-by-repo sweep;
  both are the wrong funnel, not slow progress.
- **Read the header.** A capped or timed-out scan says so — treat it as a
  sample, never a complete set. Never enumerate the hit files from memory; diff
  your list against the result before stating "these N files contain it".
- A file present here can be absent from the graph (very large files are dropped
  from analysis) — read those with `the_receipts`, it is a known gap.
- THIN → escalate by what you hold: a seed FILE goes to `collateral_damage`
  (all seven lenses first, then narrow to `types` for a type change); a package /
  address / symbol goes to `cross_repo_lookup`; describe-but-can't-name goes to
  `dragnet`; wrappers grep cannot see go to `manhunt`.

## Schema

| Field           | Type              | Notes                                                        |
| --------------- | ----------------- | ------------------------------------------------------------ |
| `knowledgeId`   | string (required) | Repo to search (from `roll_call`). **One repo per call.**    |
| `pattern`       | string (required) | ≤300 chars. Literal text unless `regex`.                     |
| `regex`         | bool (opt.)       | Treat `pattern` as a JavaScript regex. Default false.        |
| `caseSensitive` | bool (opt.)       | Default false.                                               |
| `pathContains`  | string (opt.)     | Substring of the repo-relative path, e.g. `src/`, `.ts`.     |
| `commitHash`    | string (opt.)     | Prefix ok. Default: newest indexed commit.                   |
| `scope`         | enum (opt.)       | `source` (default) or `analysis` (the analysis artifacts).   |
| `contextLines`  | int 0–5 (opt.)    | Default 1.                                                   |
| `maxMatches`    | int 1–200 (opt.)  | Default 50.                                                  |

A pattern containing `|`, groups, or quantifiers **without `regex: true`** is
matched as literal text and silently returns 0 hits. That silent-zero is the
most common false "this doesn't exist" in the whole tool surface.

## This is a confirmation tool, not a discovery tool

Because it matches text, `shakedown` is exhaustive for the sites that spell the
pattern out — and **structurally blind** to two whole categories:

1. **Pass-through sites.** A wrapper that re-exports someone else's
   `T | ((prev: T) => T)` setter, or forwards the argument onward untouched,
   contains no matchable text. It will never appear, no matter how the pattern
   is worded. For most conventions these outnumber the fork sites.
2. **The same idea named differently.** Another repo implementing the identical
   convention under different identifiers matches nothing.

So a grep that returns every fork can still be missing most of the blast
radius. Use `shakedown` to **prove a site you already suspect**. Use the graph
tools to find the set.

## Budget: two patterns per repo

Re-greping is the most common way to burn an entire investigation, because grep
never reports failure — it returns *something*, and noise reads as progress.

**If two patterns on a repo have not produced a decisive hit, stop.** The thing
you are looking for is not written as text there, and a third pattern will not
change that.

Two failure modes to recognise in your own transcript:

- **The widening spiral** — `Updater<T>` → `Updater` → `typeof` → `set`. Each
  widening trades precision for a page of hits that answer nothing.
- **The repo sweep** — greping 15 repos is 15 calls that still miss every
  pass-through. If you are greping repo-by-repo you are in the wrong funnel.

## Where to go instead

| Situation                                    | Tool                                    |
| -------------------------------------------- | --------------------------------------- |
| You can describe the change but name nothing | `dragnet`                               |
| You have a seed FILE                         | `collateral_damage` — all seven lenses first, then narrow to `types` for a type/interface change |
| You have a package / address / symbol        | `cross_repo_lookup`                     |
| You need wrappers grep cannot see            | `manhunt` `query` mode (declarations + type shapes) |
| You need the whole file a hit landed in      | `the_receipts` · `case_file`            |

## Returns

`{relativePath, line, snippet}` with context lines, plus scan stats in the
header. **Read the header.** A capped or timed-out scan says so rather than
passing as exhaustive — treat a capped scan as a sample, never as a complete
set.

## Rules

- **Never enumerate the hit files from memory.** Before you state "these N
  files contain it", re-read the result and diff it against your list. Long
  flat lists of near-identical single-line hits reliably lose an entry.
- Scope with `pathContains` before raising `maxMatches` — a narrower scan beats
  a bigger cap.
- `commitHash` defaults to the newest indexed commit, so hits line up with the
  other tools. Pin it explicitly for version-scoped questions.
- **A file present here can be absent from the graph.** Very large files are
  dropped from graph analysis, so `case_file` may 404 on a path `shakedown`
  greps happily. That is a known gap, not a contradiction — read such files
  with `the_receipts`.
- First call on a repo may be slow (the snapshot is restored from S3); the rest
  of the org then syncs in the background.
