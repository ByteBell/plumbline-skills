# Plumbline Graph Exploration (IR)

Use this skill when you're entering an unfamiliar codebase, need to understand
architecture, or are investigating a bug that spans multiple files. The key
insight: **orient first, search second** — searching an unknown codebase
without orientation tends to surface irrelevant files and forces repeated
re-searches.

## When to Use Exploration (vs Code Search)

| Situation                         | Use graph-explore              | Use code-search         |
| --------------------------------- | ------------------------------ | ----------------------- |
| "What does this repo do?"         | Yes — knowledge + top files    | No                      |
| "How is the project structured?"  | Yes — `blueprint`, one call    | No                      |
| "What are this repo's modules?"   | Yes — `blueprint`              | No                      |
| "Find where auth is handled"      | No                             | Yes — stakeout          |
| "This bug touches 5+ files"       | Yes — map the unit graph first | Then targeted overviews |
| "I keep finding irrelevant files" | Yes — step back and orient     | Then resume search      |
| "What does this change break?"    | No — orientation won't answer  | Yes — cross-repo funnel |

**If the question is "what else does this touch?"** — "trace this change
across…", "what else uses this", "which repos implement…", "who depends on…",
or a blast radius in ONE repo — orientation is not the answer and neither is
this recipe. Go straight to the cross-repo
funnel in
[plumbline-code-search.md](plumbline://skills/plumbline/plumbline-code-search.md):
`collateral_damage` (you have a file — it answers in-repo and monorepo
questions too, not only cross-repo ones), `cross_repo_lookup` (you have a
package, wire address, or symbol), `dragnet` (you can describe the change but
name nothing). Orienting in each repo one at a time costs N times as much and
still misses every file whose connection is a graph edge rather than a word.

## First Contact: The 4-Step Orientation

When you've never seen this codebase before:

```
roll_call → blueprint (module map) → stakeout (targeted sweep) → case_file (entry points) → [ready to search]
```

1. **`roll_call`** — what repos exist, their knowledgeIds, how many
   commits are indexed and how recent they are (`commitDate`).
2. **`blueprint {knowledgeId}`** — the repo's module tier, bounded by module
   count rather than file count (a monorepo with thousands of modules
   paginates, so check `pagination.hasNextPage` before calling page one the
   whole picture):
   every module with its `role` (`entrypoint` / `api` / `domain` /
   `adapter` / `infrastructure` / …), its `root` directory, its file count,
   a one-line responsibility, and the modules it depends on. This is the
   structural answer the old folder-sweep only approximated — read it before
   deciding where to search, and let `role` pick the layer the question
   lives in. Empty result → the module phase never ran for this commit; fall
   through to step 3 and orient on paths as before.
3. **Targeted sweep with `stakeout`** — now aimed by step 2, not blind:
   - `blueprint {module: "<name>"}` to see what is inside one module — exact
     membership via `HAS_FILE`. (`stakeout {pathContains: <root>}` only
     approximates it: `root` is the longest common prefix, and a module can span
     sibling directories.);
   - `{query: "<domain words from the user's question>"}` to see which
     modules the analysis text clusters around. Each hit's `purpose` is a
     one-paragraph orientation for free.
4. **`case_file` on 1–3 entry-point files** (mains, routers, core
   modules surfaced by steps 2–3) — the unit maps tell you the central
   classes and their responsibilities.

After these calls you know: what the repo does, what its parts are, which
files are central, and where things live. NOW you can search effectively.

**Cap rule:** orientation is ≤5 calls. Don't keep exploring — you have
enough context; switch to the code-search funnel.

### "[ready to search]" is a checkpoint, not a finish line

If after step 3 you still don't have (a) the specific files the question
targets and (b) evidence — not a guess — that each is the right one, re-enter:

- Bug spans multiple files? → **Multi-File Bug Investigation** below.
- Found an interface/base class in an entry file but not its implementers? →
  `manhunt {name: "<method>"}` enumerates implementers across files.
  **Mandatory, not optional**, when the question is "who implements /
  overrides / depends on X".

## Multi-File Bug Investigation

When a bug touches many interconnected files, map the unit graph before
reading anything broadly:

1. **`manhunt {name: "BuggyClass"}`** — where it lives, which
   commits contain it, and (via multiple hits) whether its implementation
   changed across commits.
2. **`interrogation`** on the suspect unit — `CALLS` edges name its
   delegates; `EDGE_CASES`/`PRECONDITIONS` name the assumptions that break.
3. **Follow the chain** — for each suspicious callee, `manhunt
{name}` → `interrogation`. For callers, `manhunt {query:
"BuggyClass"}` (summaries mention collaborators).
4. **`case_file`** ONLY on files in the mapped chain — don't scan
   broadly.

The exploration-first pattern maps the territory before reading any files;
the wasteful pattern overviews files one-by-one hoping to stumble onto the
right ones.

## Cross-Repo Exploration

When investigating how services interact across repositories:

1. Omit `knowledgeId` — `stakeout`/`manhunt` then span every
   repo the session may read; each hit carries its own `knowledgeId`.
2. Search the surface from both sides: the producer's vocabulary ("publishes
   order event") and the consumer's ("subscribes order event") — analysis
   text usually names both.
3. Continue the normal funnel per repo with the hit's `knowledgeId`.

## Exploration → Search Transition

Don't over-explore. The point of exploration is to make subsequent searches
precise. Once you can name (a) what the repo does, (b) which files are
central, and (c) where the relevant module lives, stop exploring and switch
to [plumbline-code-search.md](plumbline://skills/plumbline/plumbline-code-search.md)
patterns with the knowledge you gained.
