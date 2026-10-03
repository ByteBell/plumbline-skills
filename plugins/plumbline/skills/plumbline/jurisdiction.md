---
name: jurisdiction
description: >
  Dedicated usage skill for the `jurisdiction` MCP tool — decide whether a TASK
  is single-repo or cross-repo before any search, and which repositories to
  search. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# jurisdiction

Decide a task's **lane** before searching: is the work inside ONE repository, or
spread across several that each implement the same rule? A classifier reads every
accessible repository's brief (the same ≤150-token briefs `rap_sheet` lists) and
answers. Registered only when the server has a classifier configured.

## Digest

`task` (required, 20–6000 chars — the task or defect description, verbatim).
Optional: `repos` (`[{knowledgeId, commitHash?}]`) to narrow the roster and pin
commits; omit to route across every repository this session can read.

**COMPULSORY FIRST STEP for every task** — a pull request to review, an issue to
fix, a change set to find — right after `roll_call` and before any other search,
**even when you already know the repository.** `lineup` cannot run without the
route this sets. A cross-repo task searched as single-repo silently loses every
file outside the first repository that answers.

- **It returns the lane, the repositories to search, and that lane's search
  instructions.** Follow the instructions it returns — they differ by lane.
- **The route is remembered for the session.** `lineup` searches exactly those
  repositories. Calling `jurisdiction` again re-routes and discards `lineup`'s
  verdicts.
- **It leans cross-repo when unsure.** A cross-repo route on a task that turns
  out single-repo costs calls, not answers.
- **A single-repo route names one repository, or the few candidates when the
  home is ambiguous.** Several repositories can claim the work when their briefs
  cannot tell them apart; the lane stays single-repo and `lineup` searches all
  of them. The first kept files show which one is the home.
- **It does not search and does not fold.** You drive everything after it.

NEXT (COMPULSORY) → `lineup` at least 3 times, each with a different pattern
built from the task's identifiers (grep the routed repositories; the classifier
keeps the hits that belong), then `collateral_damage` on EVERY row it returns.

NOT FOR → reading descriptions yourself to choose a repo (`rap_sheet`).

## How the verdict is reached

1. **Router** — one decision over a document listing every repository in scope
   with its brief: _does resolving this task require changing files in more than
   one of these?_ The task is routed cross-repo when p(yes) is at or above the
   route threshold (default 0.3).
2. **Home repository** — single-repo lane only. One decision per repository:
   _is this the repository whose files must change?_ The highest-scoring one is
   the home repository. If more than one scores 0.5 or more, the home is
   ambiguous: every repository at or above 0.5 is routed, still on the
   single-repo lane.

A repository with no indexed description is still in the roster and still
searched; the classifier is told it has no description.

## Reading the result

```
# jurisdiction — cross-repo (p(cross-repo) = 0.62, threshold 0.3)
classifier: typesafe/jev-1.13 · 1 decision(s) · $0.0004 · 812ms

REPOSITORIES TO SEARCH (16 of 16 in scope):
- TanStack/query  knowledgeId=…  commit=newest
…
LANE: cross-repo. …numbered search instructions…
```

`commit=newest` means the repository's newest indexed commit; a pinned commit is
shown when you passed one in `repos`.
