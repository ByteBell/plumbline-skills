---
name: rap-sheet
description: >
  Dedicated usage skill for the `rap_sheet` MCP tool — what a repository DOES,
  as prose written once at index time, plus the computed shape of its module
  graph. The highest altitude in the server, and the cheapest way to decide
  WHICH repositories a cross-repo question belongs to. Read when the digest
  attached to its first result is not enough.
user-invocable: false
---

# rap_sheet

What a repo **does**, at one commit: a 200-800 word account of the path through
the system — what enters it, what each stage does, what leaves — plus its
one-liner, `kind`, `domain`, and the counted shape of its module graph.

`roll_call` gives identity. `blueprint` gives the parts. `kingpin` gives the
busiest files. None of them says what the system is FOR. This does.

**Written once at index time, not assembled per call.** The same question returns
the same answer every time and can be cited by commit — unlike a search, whose
ranking depends on the words you happened to use.

## Digest

Three ways to call it:

| Arguments | Returns |
| --- | --- |
| `knowledgeId` + `commitHash` | that one commit's description in full, with its shape |
| `knowledgeId` alone | JSON rows for EVERY indexed commit of that repo, newest first |
| neither | JSON rows for every indexed commit of every accessible repo |

Rows are `{knowledgeId, repoSlug, commitHash, analysedAt, brief, oneLiner,
kind, domain, wordCount, hasDescription}`, paginated.

- **ROWS CARRY THE BRIEF, NOT THE FULL DESCRIPTION.** `brief` is what the repo IS
  in at most 150 tokens, written by the public-questions stage. That cap is what
  lets this list every accessible repo in ONE call — the 200-800 word
  `whatItDoes` is 1.5-6 KB each, and twenty of those is ~60 KB and several pages.
  Read the briefs, pick the repo, then ask for that `knowledgeId` +
  `commitHash` to get the full account. `hasDescription` says in advance whether
  that second call has one to give.
- **ROWS ARE PER COMMIT, NOT PER REPO.** A repo indexed twenty times has twenty
  rows, each describing what it was AT THAT COMMIT. That is the point — the
  description is never overwritten, so the history is readable. It also means the
  no-argument call is dominated by whichever repo has the most indexed commits;
  page through it, or ask per repo, rather than assuming page 1 is a repo list.
- `commitHash` without `knowledgeId` is refused: one hash cannot address twenty
  repos.
- **The prose is LLM-written; the shape is not.** Entry points, foundations,
  hubs, layering depth and cycles are COUNTED from the dependency graph. Trust
  the shape at face value; treat the prose as a lead, per RULE 1.

## Use it to choose WHICH repos to search

This is the tool's highest-value use on a cross-repo question, and the one most
runs skip.

A sweep (`stakeout`/`manhunt`/`dragnet`/`cross_repo_lookup` with `repos`
omitted) searches every accessible repo into a fixed number of result slots. Repos
that cannot hold the answer still compete for those slots and win some of them,
because generic vocabulary — cache, store, state, registry, cleanup — appears in
almost every codebase. Ranking alone will not tell you which repo is the right
neighbourhood; `domain` and `oneLiner` will.

**Measured 2026-09-15.** A five-repo question about identity-keyed caches with no
lifetime tie: the run's sweeps DID surface every gold repo, and it then spent its
remaining calls scoping into five OTHER repos that merely used the same words,
finishing 1/6. One `rap_sheet` call would have separated "async state management
and server state caching" from "terminal emulation" before a single search was
spent. On the same corpus a sweep in that vocabulary ranked a Zig terminal
emulator above every in-domain repo.

So, on a question that spans repos you have not searched before:

1. `roll_call` for the ids.
2. `rap_sheet` with NO arguments — read `brief`, `domain`, `kind` and `oneLiner`.
   Decide which repos the question is actually ABOUT. This is one call, and the
   briefs are sized so it stays one call.
3. Sweep, then fold, in those. Leave the rest reachable but unspent.

**Rank, never exclude.** A repo whose `domain` reads wrong can still hold the
other half of a contract — the consumer of a wire surface, the package a fix
propagates into. Let low-relevance repos sink; do not decide they are absent.
A miss caused by wrongly excluding a repo is indistinguishable from bad
retrieval, and nothing downstream will tell you which happened.

## When NOT to reach for it

- **One repo you already know.** Go straight to `blueprint` or `stakeout`; a
  200-800 word essay on a repo whose layout you have is a wasted call.
- **You need files, not orientation.** This never returns a path. It tells you
  where to point the tools that do.

THIN → a repo with a module map but no description had its description phase
skipped at that commit (non-fatal, runs per commit). Fall back to `blueprint`
for the parts, or ask for a different commit of the same repo.

NEXT → `blueprint` for the module map behind this summary · `kingpin` for the
files a change would touch most · `stakeout` / `case_file` to descend into one.
