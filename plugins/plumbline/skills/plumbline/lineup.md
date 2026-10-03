---
name: lineup
description: >
  Dedicated usage skill for the `lineup` MCP tool — GREP every repository the
  session's route covers and have a classifier keep the hit FILES that are part
  of the task. A filter that produces fold seeds, not an answer. Read when the
  digest attached to its first result is not enough.
user-invocable: false
---

# lineup

GREP every routed repository in one call, and let a classifier read each new hit
file and keep the ones that are part of the task. Registered only when the server
has a classifier configured. Requires `jurisdiction` first.

## Digest

`pattern` (required, ≤300 chars — a JavaScript regex, case-insensitive unless
`caseSensitive: true`). Optional: `pathContains` (substring on the repo-relative
path).

**COMPULSORY on every task, right after `jurisdiction`** — at least 3 calls,
each with a different pattern built from the task's identifiers, before any
other search. The route `jurisdiction` sets decides which repositories are
searched and which question the classifier is asked.

**Every row is a SEED, not an answer.** The classifier reads one file at a time,
so it cannot see a caller that passes a value through, a type declared elsewhere,
or a barrel re-export. Fold every row with `collateral_damage` (pass the row's
`commitHash`; include the `dependencies` lens).

- **You get a SHORTLIST, not everything it kept.** `kept` rows are each
  repository's best few files (default 3) the classifier judged part of the task
  (p at or above the threshold, default 0.5) that you have not been given before,
  best first. The header counts the kept files held back; a narrower pattern or
  `pathContains` brings them up.
- **Fold every returned row before the next `lineup` call.** The list is short so
  that this is affordable.
- **`quota` rows** (cross-repo route only) are the best files of a repository
  where NOTHING has been kept yet. Fold them too: repositories in a cross-repo
  task do not import one another, so a repository with no seed is unreachable. A
  repository with nothing kept is NOT ruled out.
- **The classifier filters; it does not rank.** `p` says how confident it was, not
  how important the file is. Order your final list on what you read.
- **Aim for tens to a few hundred files.** A pattern matching more than 800 is
  refused before anything is judged — narrow it or add `pathContains`.
- **A file is judged once per session**, however many patterns match it. A file
  the classifier could not judge is reported as unjudged, never as rejected.

NEXT → `collateral_damage` on every row · `the_receipts` / `case_file` to read a
kept file and learn the real identifiers, then `lineup` those.

THIN → the rule is not written with those words. Change vocabulary, or read a
kept file for the real names. Do not widen one pattern until it is refused.

NOT FOR → confirming one literal string in one repository (`shakedown`) · a
question with no task behind it (`stakeout`).

## Choosing patterns

The task usually withholds identifiers, so the first patterns describe code
SHAPES, in several vocabularies.

**Single-repo route** — follow one codebase's layers: the entry points that
trigger the behaviour (routes, handlers, jobs, server actions, UI events); the
shared helper, service or data-access function they call; the setting, schema
field, flag or type it reads and every other place that reads the same one;
sibling entry points that must apply the same rule.

**Cross-repo route** — each repository names the same rule differently. Write
patterns for the shape the behaviour must have (the comparison, the cache or map,
the lifecycle hook, the option or type), not for one library's identifiers, and
include at least one aimed at public types, option shapes and re-exports.

Then read a few kept files and `lineup` the real identifiers you find there.

## Reading the result

```
# lineup — kept 12 of 214 matched file(s) · lane: cross-repo · threshold 0.5
pattern: /…/i · 16 repo(s) searched · 190 newly judged, 24 already judged this session · typesafe/jev-1.13 $0.0312 · 9100ms
per repo (matched/kept): TanStack/query 40/3 · TanStack/router 12/0 · …
session so far: 611 file(s) judged, 41 kept
quota seeds: 18 — each repository's best 5 file(s) where they fell below the threshold. FOLD THESE TOO …
```

Rows are JSON: `{seed, p, repoSlug, knowledgeId, relativePath, commitHash}`.

A `⚠` line means the result is incomplete: a grep hit a cap (that repository's
file list is a sample), a repository's snapshot could not be read, or some files
could not be judged.

## What is not judged

Test paths (the same rule `shakedown` applies), and files that are prose, data,
lockfiles, snapshots, translations or binary assets (`.md`, `.json`, `.lock`,
`.snap`, `.svg`, images, fonts, `locales/`, `i18n/`). They are dropped before the
800-file limit is counted.
