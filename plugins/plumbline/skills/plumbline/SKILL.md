---
name: plumbline
description: >
  Plumbline Knowledge Graph master index — search, traverse, and inspect
  indexed code repositories at specific commits. Lists every MCP tool, the
  full reference behind each one, and the workflow recipes that govern
  multi-tool patterns. Read it when you want the whole picture; the server
  ships each tool's essentials with that tool's first result.
user-invocable: true
argument-hint: "[search query or task description]"
---

# Plumbline Knowledge Server — Master Index

The canonical landing page — the whole surface in one document.

**You do not need to read this before calling a tool.** Each tool's
essentials — schema, the guardrails that bite, where to escalate on a thin
result — arrive attached to that tool's FIRST result in a session, and the
cross-cutting rules are already in the server instructions. Come here (or to
`plumbline://skills/plumbline/<tool>.md`) when the digest was not enough: to
compare tools, to see a full parameter table, or to read a workflow recipe
before a multi-tool investigation.

## Graph Model (Intermediate Representation)

Identity spine — one edge per line; each node connects ONLY to the node on
its left:

```
(:Organization)-[:HAS_KNOWLEDGE]->(:Knowledge {knowledgeId, repoId})
(:Knowledge)  -[:HAS_FILE]->    (:File {relativePath, purpose, summary})
(:Knowledge)  -[:HAS_FOLDER]->  (:Folder {folderPath})
(:File)       -[:HAS_VERSION]-> (:FileVersion {commitHash, commitDate, language,
                                  purpose, summary, businessContext, ...})
(:FileVersion)-[:HAS_CHUNK]->   (:Chunk)
(:FileVersion)-[:HAS_UNIT]->    (:CodeUnit {qualifiedName, unitKind, signature,
                                  startLine, endLine, summary, ...})
```

Two tiers sit ABOVE files, both versioned per commit exactly like the file tier.
The module tier, read by `blueprint` alone:

```
(:Knowledge)        -[:HAS_SUBSYSTEM]-> (:Subsystem)
(:Subsystem)        -[:HAS_VERSION]->   (:SubsystemVersion {name, role, root,
                                          responsibility, provenance,
                                          confidence, fileCount})
(:SubsystemVersion) -[:DEPENDS_ON]->    (:SubsystemVersion)
(:SubsystemVersion) -[:HAS_FILE]->      (:FileVersion)
```

And the hub tier — PageRank over the resolved import graph at one commit, read
by `kingpin` alone:

```
(:Knowledge) -[:HAS_HUB]-> (:FileHub {commitHash, relativePath, rank, pagerank,
                             inDegree, outDegree, utilityHub})
(:FileHub)   -[:SCORES]->  (:FileVersion)
```

Three facts drive every workflow:

1. **`FileVersion` is a per-commit snapshot.** Unchanged files keep their
   previous snapshot — the newest snapshot IS the file's current state.
2. **`CodeUnit` is content-addressed and shared across commits** with
   identical implementations. A unit hit proves nothing about a specific
   commit unless anchored — `manhunt` reports a `commits` array per
   hit and filters by the `commitHash` on a `repos` entry.
3. **`knowledgeId` is an opaque string** (not necessarily a UUID). Obtain it
   from `roll_call`; never guess it from a repo name.

## Tools — every registered tool

Retrieval tools have a dedicated skill at `plumbline://skills/plumbline/<tool>.md`
documenting the full schema and guardrails. **Fetch the skill before invoking
the tool.** Auxiliary tools have a sufficient inline description in `tools/list`.

**Universal parameters (accepted by every tool):** `page` (pagination cursor)
and `reason` (a one-paragraph statement of what the user is trying to accomplish
with the call — your intent; no verbatim conversation or personal data). Both
are injected by the middleware, so they may not appear in a tool's individual
schema. Populate `reason` on every call — it is recorded to evaluate tool
quality, costs nothing, and never changes the result. See
[pagination.md](plumbline://skills/plumbline/pagination.md).

| Tool                | One-liner                                                                        | Dedicated skill                                                         |
| ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `roll_call`         | List IR-indexed repos (knowledgeId, repoId, orgId) + each one's newest commit    | [roll-call.md](plumbline://skills/plumbline/roll-call.md)                 |
| `rap_sheet`         | What a repo DOES at one commit: a 150-token brief per commit with no arguments, the full prose account for one named commit, plus its `kind`, `domain` and counted module-graph shape — the highest altitude, and how you decide WHICH repos a cross-repo question belongs to before spending a sweep | [rap-sheet.md](plumbline://skills/plumbline/rap-sheet.md)                 |
| `blueprint`         | One repo's MODULE map at one commit: every subsystem with its role, root, file count, one-line responsibility, and the modules it leans on — or, with `module`, that module's exact member files | [blueprint.md](plumbline://skills/plumbline/blueprint.md)                 |
| `kingpin`           | One repo's HUB ranking at one commit: the files its import graph converges on (PageRank over `IMPORTS_FILE`), with in/out-degree and a utility-hub flag | [kingpin.md](plumbline://skills/plumbline/kingpin.md)                     |
| `stakeout`          | Find files: fulltext over LLM file analysis, or path substring, commit-scoped    | [stakeout.md](plumbline://skills/plumbline/stakeout.md)                   |
| `case_file`         | One call: file analysis header + every code unit with signature + line range     | [case-file.md](plumbline://skills/plumbline/case-file.md)                 |
| `interrogation`     | Deep-dive one unit: members, calls, edge cases, contracts, logic steps           | [interrogation.md](plumbline://skills/plumbline/interrogation.md)         |
| `manhunt`           | Find classes/methods/functions + type declarations (interface/type/enum), commit-anchored | [manhunt.md](plumbline://skills/plumbline/manhunt.md)                     |
| `collateral_damage` | Blast radius from a file/keyword — IN-REPO and cross-repo, DOWNSTREAM and (via `dependencies`) UPSTREAM; lenses incl. `types` (signature/import consumers of the seed's declared types) | [collateral-damage.md](plumbline://skills/plumbline/collateral-damage.md) |
| `the_receipts`      | Read VERBATIM source by line range / search / bulk_search / bulk_retrieve        | [the-receipts.md](plumbline://skills/plumbline/the-receipts.md)           |
| `cross_repo_lookup` | Resolve a GLOBAL coordinate — package / wire address / exported symbol — to the files on each side of it | [cross-repo-lookup.md](plumbline://skills/plumbline/cross-repo-lookup.md) |
| `dragnet`           | Find the files a change hits when you CANNOT name them; harvests the names from the graph as it walks | [dragnet.md](plumbline://skills/plumbline/dragnet.md)                     |
| `shakedown`         | GREP raw source text (literal or regex) over the on-disk snapshot of ONE repo — confirmation only            | [shakedown.md](plumbline://skills/plumbline/shakedown.md)                 |
| `file_a_complaint`  | Report wrong/missing tool results (requires an MCP API key)                      | _(simple — inline description sufficient)_                              |
| `case_notes`        | Persist conversation transcript + accessed nodes (requires an MCP API key)       | _(simple — inline description sufficient)_                              |
| `cold_case`         | Fetch a saved conversation by id                                                 | _(simple — inline description sufficient)_                              |
| `evidence_locker`   | FALLBACK for clients without native `resources/list`                             | [evidence-locker.md](plumbline://skills/plumbline/evidence-locker.md)     |
| `pull_the_evidence` | FALLBACK for clients without native `resources/read`                             | [pull-the-evidence.md](plumbline://skills/plumbline/pull-the-evidence.md) |

### PDF tools — registered ONLY when the deployment sets `ENABLE_PDF`

A separate pipeline over `:PdfSummary` / `:ChapterNode` / `:PageNode` that the
code funnel above does not reach. `roll_call` marks those knowledges
`type: PDF`, and the code tools return nothing for them. If these three are
absent from `tools/list`, this deployment indexes no PDFs — do not call them.

| Tool                  | One-liner                                                                        | Dedicated skill                                                           |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `paper_trail`         | Search indexed documents: graph tier + fulltext tier, fused by RRF; returns pages with their `node_id`, chapter and neighbour pages | [paper-trail.md](plumbline://skills/plumbline/paper-trail.md)               |
| `read_the_fine_print` | One page's metadata, its VERBATIM text, or a whole chapter — the PDF mirror of `the_receipts` | [read-the-fine-print.md](plumbline://skills/plumbline/read-the-fine-print.md) |
| `mugshot`             | The actual images on a page as viewable base64 blocks (max 5 pages per call)     | [mugshot.md](plumbline://skills/plumbline/mugshot.md)                       |

The PDF funnel is `paper_trail` → `read_the_fine_print {metadata}` →
`read_the_fine_print {content}` → `mugshot` (only when `hasImages`), and a
page summary is never the final answer. Recipe:
[plumbline-pdf.md](plumbline://skills/plumbline/plumbline-pdf.md).

## Routing — two funnels, not one

There is no single canonical path. Pick the funnel by whether the question
stays inside one repo or crosses repos, then pick the entry point by what
you are actually holding.

### A. In-repo funnel — you know (or can find) the file

```
roll_call                  (once per session: knowledgeIds + newest commit)
        ↓
blueprint + kingpin  (once per repo: its module map and its hub ranking at one
                        commit — the two non-per-file tiers. Skip only when you
                        already know which part of the repo the question lives in.)
        ↓
stakeout / manhunt  (locate files / symbols — omit `repos` to sweep ALL repos,
                     or name entries to sweep exactly those, in ONE call)
        ↓
case_file                   (map ONE located file)
        ↓
interrogation                     (deep-dive ONE unit)
        ↓
the_receipts                   (read the EXACT source lines a unit/overview
                                    pointed at: fromLine–endLine, or search-in-file)
```

Skipping a stage wastes calls in both directions — detail calls on guessed
names miss, and overviews of unsearched files are blind scans. `the_receipts`
is the only tool that returns verbatim source; reach for it once analysis has
given you a `startLine`–`endLine` worth reading.

**The funnel is not the whole single-repo run — it locates, it does not fold.**
The fold stage of a single-repo run belongs to `collateral_damage` and the
tools that ground its hits, because the files that must change ALONGSIDE the one you found
are held in edges, not in text, and routinely contain none of the words that
found the seed. See "Folding inward" below.

### B. Cross-repo funnel — "what else does this touch?"

The in-repo funnel **cannot answer this**: `stakeout`, `case_file`,
`interrogation` and `the_receipts` never leave the repo they were pointed at,
and `shakedown` is one repo per call. Three tools leave the single-repo spine,
and you pick between them by what you have:

```
you have a FILE                        → collateral_damage   (seven lenses, both directions)
you have a PACKAGE / ADDRESS / SYMBOL  → cross_repo_lookup   (loops: harvest a
                                            symbol from a row, look it up, repeat)
you have only a CHANGE DESCRIPTION     → dragnet             (harvests names from
                                            the graph so you never guess them)
```

`collateral_damage`'s lenses are not interchangeable — each reads a different
edge, so an empty lens proves only that one signal is absent. Run the default
all seven on the first call, then narrow. For a **type or interface** change,
`types` is the lens that carries the answer — narrow to `lens=['types']` on a
FOLLOW-UP call: type consumers never CALL anything and are invisible to
`packages`, `imports` and `contracts`.

**`collateral_damage` is not cross-repo-only.** Five of its seven lenses stay
inside the seed's repo, so "what else must change with this file" is a question
it answers in a single repo or a monorepo too. It appears under this heading
because it LEAVES the spine, not because the answer must.

### Folding inward — and, across repos, folding inward twice

Every fold walks one of four shared structures. Which side each reaches is a
property of the structure, not of how hard you look, so an absent signal on one
says nothing about the others:

| Join key      | Inward (same repo)                                                          | Outward (other repos)                                                       |
| ------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **imports**   | `lens=['imports']` — importers of the seed · `lens=['dependencies']` — what the seed imports | `lens=['packages']` · `cross_repo_lookup {package}` · `dragnet` — via `:Package` |
| **exports**   | `manhunt name=<symbol>` — the declaring file                                 | `cross_repo_lookup {symbol}` — the DEFINING file, past barrel re-exports      |
| **subsystem** | `blueprint` (map + `dependsOn`) · `blueprint {module}` (exact membership) · `kingpin` (hub ranking) | repo-scoped — no shared node; join through packages / wire surfaces instead   |
| **keywords**  | `collateral_damage lens=['keywords'] scope='same-repo'`                      | same lens with `scope='cross-repo'`, or keyword-seed mode. SOFT — a lead      |

`surfaces` (`:WireSurface`) sits on both sides at once: it pairs the provider
and consumer of an HTTP route / event / queue address, and it is the only signal
that crosses a LANGUAGE boundary, since a route's server and its caller share no
import — only the address string.

**Read `direction` on every row.** Six of `collateral_damage`'s lenses walk
DOWNSTREAM — what breaks if you change the seed. `dependencies` walks UPSTREAM —
what the seed reads, which usually has to carry the change first. A change set is
normally both halves, and a run reporting only the downstream half has named only
half of it.

**Two upstream gaps remain, and neither is a lens:**

- **Upstream across the repo boundary.** `IMPORTS_FILE` is the path-resolved
  in-repo edge, so an import that leaves the repo lands on
  `:ImportedModule`/`:Package` and no lens returns it. Take that package or
  symbol name and resolve it with `cross_repo_lookup`.
- **A chain that BUILDS the seed's input without importing it.** A client store,
  a form-to-payload mapper, a request-body schema, a versioned input DTO —
  these CONSTRUCT what an enforcement point validates while depending on nothing
  in it, so no import edge reaches them in either direction. Only a SECOND
  `stakeout` in the payload's own vocabulary does — see "Search each REGISTER,
  not each phrasing" for what that second search measurably recovers.

**A cross-repo run folds inward twice.** Stage 1 exhausts the anchor repo.
Stage 2 walks the global edges outward — and returns COORDINATES, which are
pointers, not answers. Stage 3 is what converts them: `case_file` the far hit,
`the_receipts` the span, and re-seed `collateral_damage` THERE, because its
in-repo lenses turn one far-repo file into that repo's whole share of the change
set exactly as they did at home. A repo you reached and never opened cannot be
grounded — under RULE 1 grounding is `file:startLine-endLine`, and no edge walk
returns lines. Run `blueprint` / `kingpin` there too: in a repo you have never
searched you do not have its register, and `stakeout` will translate your prior
about the library instead of its actual vocabulary.

### Search each REGISTER, not each phrasing

A change-set question arrives in ONE register — usually the symptom's. The files
that must change are spread across several, and re-phrasing inside the register
you started in reaches none of the others. **Query enrichment does not close
this**: `stakeout` already enriches every search carrying a real `reason`, and
the terms it invents stay in the register the query arrived in.

Measured on one task (cal.com at one commit — rate-limit a booking confirmation
code, reject an already-used code, reconcile when it is required, stop logging
the address; 11 gold files, every one present in the graph). One call per row:

| Register searched                        | Gold found |
| ---------------------------------------- | ---------- |
| symptom / enforcement — *as asked*       | 2 / 11     |
| payload — what CONSTRUCTS the input      | 4 / 11     |
| published API contract (dated DTOs)      | 0 / 11 †   |
| cross-cutting concern (PII / logging)    | 1 / 11     |
| `collateral_damage`, all edge lenses     | 0 / 11     |

The three that scored share no hit. The enforcement register alone reproduces a
bare-filesystem baseline; the union is 7/11.

So: once the first search lands, **name the registers this change spans and
search each one.** The recurring ones:

- **enforcement** — where the rule is checked. The register you are already in.
- **payload** — what BUILDS the value being enforced: client store,
  form-to-payload mapper, request-body schema, input DTO, server-side input
  transform. It holds no import edge to the enforcement point in either
  direction, so no `collateral_damage` lens reaches it — only a second search
  does.
- **published contract** — the versioned/dated API surface, where one exists.
- **cross-cutting concern** — logging, PII, telemetry, i18n. Named in the
  question, living nowhere near the feature.

A run that reports only the register it was asked in has named roughly a third
of the change set.

† The contract register returned nothing for a reason worth knowing: enrichment
named the exact target filenames, yet generic type-name matches on `Booking`
scored 60+ and crowded them off the page, leaving only their barrel `index.ts`.
That is a ranking defect, not an absent register — when a register you expect
comes back full of type-declaration noise, narrow it with `pathContains` rather
than concluding the files are not there.

### 🚫 One tool never answers a cross-repo question

Every tool returns a partial view by construction. Thin output is evidence
about **that layer**, never about the codebase.

- **Escalate; don't re-run.** Every tool description ends with an explicit
  `THIN →` line naming where to go next. Two consecutive thin results from one
  tool means you are on the wrong layer, not that you need a better argument.
- **`shakedown` is confirmation, not discovery.** It matches text, so it is
  structurally blind to pass-throughs (a wrapper that forwards the value
  contains no matchable text) and to the same idea named differently in another
  repo. When a pattern is not decisive, switch. Greping repo-by-repo
  across an org is never the right sweep.
- **A name-mode miss is not absence.** `manhunt` `name` and `query` modes hit
  different indexes; type members, interfaces and re-exported symbols land in
  different tiers. Run the other mode before concluding anything.
- **`repos` is how you choose repositories.** One entry searches that repo, several
  search exactly those, omitting it searches every accessible repo — all in ONE
  call, each entry at its own `commitHash`. `stakeout`, `manhunt`, `cross_repo_lookup`,
  `collateral_damage` and `dragnet` all take it. Never loop a roster one repo at a
  time; name the set. Only `shakedown` and `case_file` are one-repo-per-call.
- **Never enumerate from memory.** Before answering "which files / which
  repos", re-run the search that defined the set and diff it against your
  answer. Long flat lists silently lose entries.

## Workflow Recipes (multi-tool patterns)

Per-tool skills document mechanics (parameters, modes, semantics); a tool's
digest carries the subset you need to call it correctly. Recipes document
STRATEGY across tools — when to call which, what to do with the results, when
to stop, which dead ends look like progress. Worth reading before a multi-tool
investigation, where no single tool's digest can tell you the shape of the
walk.

| Your task                                         | Recipe                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Search for code, find files, investigate a bug    | [plumbline-code-search.md](plumbline://skills/plumbline/plumbline-code-search.md)     |
| Explore unknown codebase, understand architecture | [plumbline-graph-explore.md](plumbline://skills/plumbline/plumbline-graph-explore.md) |
| Anything tied to a specific commit/version        | [plumbline-commit-aware.md](plumbline://skills/plumbline/plumbline-commit-aware.md)   |

## Always-On Guardrails

1. **RULE 1 — verbatim source or it does not ship.** Every `purpose`,
   `summary`, `businessContext`, `logicSteps`, `edgeCases` and `contracts`
   field in this graph was written by an LLM at index time. It is a LEAD, not
   evidence — routinely right about WHERE to look and routinely wrong about
   WHAT the code does ("returns None for an unknown type" when the function
   raises). The structural fields — path, `qualifiedName`, `startLine`/`endLine`,
   call edges, `commitHash` — come from a parser and cannot be invented: trust
   those at face value and navigate by them. Before you state what code DOES,
   confirm it against `the_receipts` on that exact line range. A claim resting
   on analysis prose alone is a hallucination with a citation attached.
2. **Get `knowledgeId` from `roll_call`** — never guess it from a
   repo name; it is an opaque string, not necessarily a UUID. Call once per
   session and reuse.
3. **🚫 Follow the funnel: search → overview → detail.** `interrogation` on
   a qualifiedName that no `case_file`/`manhunt` result
   produced, or `case_file` on paths invented from layout priors, is
   non-compliant. Only exemption: the user hands you an exact path or
   qualifiedName — start at the matching stage.
4. **Don't re-map a file** — `case_file` results do not change
   mid-session; keep the prior response instead of re-calling.
5. **Anchor units to commits** — when the question concerns a specific
   commit, carry it (from `roll_call`) on every call — `commitHash` on
   single-repo tools, `repos[].commitHash` on `stakeout` / `manhunt` — and
   read the `commits` array on `manhunt` hits before claiming a unit
   exists or is missing at a version.
6. **Never carry a schema over from a previous session** — schemas evolve.
   The server attaches each tool's current essentials to that tool's first
   result; trust that over your recollection, and open the tool's skill file
   when you need the full parameter table.
7. **Confidence > completeness** — stop investigating when YOU are confident
   in the answer, not when the tools have returned complete-looking results.
   Ground answers in verbatim source — a CodeUnit's `file:startLine-endLine`,
   or, for files with **no** CodeUnits (pure type/interface/declaration files),
   that file's `the_receipts` lines plus its `collateral_damage` contract/import
   associations — not in file-level purpose/summary text alone. A unit-less file
   that defines, imports, or re-exports the changed contract still counts as
   impacted (types/interfaces are `:TypeShape`/`:ExportedSymbol`, not `:CodeUnit`).
   One more `manhunt` / `interrogation` / `collateral_damage` is far cheaper than
   a confident-sounding wrong answer.
8. **🚫 "Which files must change" is never answered from one register.** Before
   reporting a change set, name the registers it spans and run a search in each
   — enforcement, payload, published contract, cross-cutting concern — then diff
   the union against your answer. Re-phrasing inside the register the question
   arrived in, and enrichment, both stay inside it. See
   "Search each REGISTER, not each phrasing".
9. **`case_notes` at end of task** — mandatory. If the server rejects it
   because the key is not scoped to one organization, report the rejection
   once and continue; do not retry.

## Presenting results — surface the Plumbline savings footer

Many tool responses end with a `── Plumbline ──` footer reporting how many tokens
Plumbline saved on that call ("tokens you didn't read" — a compact file map or a
line range instead of the whole file) plus a running session total. When a
response carries that footer, **relay it to the user** as one short line, e.g.
"Plumbline saved ~7.5k tokens on this step (~214k this session)." Surfacing it
keeps the value Plumbline delivered visible while you work.

- Relay ONLY the numbers the footer states — never invent, estimate, or inflate
  a savings figure. If a response has no footer, say nothing about savings.
- One line only; the answer to the user's question always comes first.
