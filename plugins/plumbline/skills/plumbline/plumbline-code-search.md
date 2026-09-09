# Plumbline Code Search (IR)

## Two funnels — pick before your first call

**Does the question stay inside one repo, or cross repos?** The answer decides
everything downstream, and getting it wrong is the single most expensive
mistake in this system.

```text
IN-REPO    roll_call → stakeout | manhunt → case_file → interrogation → [loop] → answer
             ↳ "which files must CHANGE" adds a widen-out step to this funnel:
               see Bug-Fix Pattern step 6
CROSS-REPO roll_call → collateral_damage | cross_repo_lookup | dragnet → case_file → answer
```

Anything phrased as "trace this change across…", "what else uses…", "which
repos implement…", or "who depends on…" is **cross-repo** and must not be run
through the in-repo funnel. `stakeout`, `case_file`,
`interrogation` and `the_receipts` never leave the repo they were pointed at;
`shakedown` is one repo per call. Iterating the in-repo funnel once per repo is
not a substitute — it costs N times as much and still misses every file whose
connection is an edge rather than a word. Jump to
[Cross-Repo Investigation](#cross-repo-investigation) for that funnel.

**"Blast radius" is deliberately absent from that list — it is scope-neutral.**
Five of `collateral_damage`'s seven lenses (`imports`, `contracts`, `types`, and
the same-repo half of `surfaces`) never leave the seed's own repo, so "what else
must change with this file" is answerable inside a single repo or a monorepo.
Routing it away because the answer lives in one repo leaves the walk with only
word-matching, in a codebase where the files that must change are joined by
edges — and in a monorepo those files usually sit under a different top-level
directory (`apps/…` vs `packages/…`) whose prose shares almost no vocabulary
with the layer the symptom lives in.

The in-repo funnel follows — read the note on "[loop]" carefully:

### Step by step

1. **`roll_call`** — once per session: knowledgeIds + indexed
   commits. If the question is version-pinned, pick the `commitHash` here and
   pass it on EVERY subsequent call.
2. **Locate.** File-level question ("which file handles X") →
   `stakeout {query}`. Symbol-level question ("where is X defined /
   who handles X") → `manhunt {query | name}`. Partial path or
   extension known → `stakeout {pathContains}`.
3. **`case_file`** on the best hit — analysis header + every unit
   with signature, line range, summary. This is the map; most "what does
   this file do / where in it" questions end here.
4. **`interrogation`** on ONE unit of interest — members with types, call
   edges, edge cases, pre/postconditions, logic steps. Most "why / how /
   what does it assume" questions end here.

**Unfamiliar repo? Put `blueprint` between steps 1 and 2.** It returns the
repo's module map at a commit — each module's `role`, root directory, file
count, one-line responsibility and the modules it depends on — so step 2 aims
at the layer the question lives in instead of guessing. Rows are modules, not
files, so most repos fit one page; on a large monorepo follow
`pagination.hasNextPage`. Skip it only when you already know which part of the
repo you are searching. See
[blueprint.md](plumbline://skills/plumbline/blueprint.md).

### "[loop]" is iterative, not optional

The funnel re-enters until the answer is grounded. Re-entry becomes
**mandatory** when any of these holds after step 4:

- You found an interface/abstract signature but not the concrete
  implementation(s) → `manhunt {name: "<method>"}` enumerates
  implementers across files (each with its own `commits`).
- The user asked "who calls / what depends on this" and you only have the
  definition → the unit's `CALLS` edges point one way; find callers via
  `manhunt {query: "<unit name>"}` and check their `CALLS` in
  `interrogation`.
- Search returned thin (<3 hits) or off-layer results (templates when you
  need handlers) → re-query with behavioural vocabulary or add
  `pathContains` to change layers; or switch search modes (files ↔ units).
- Multiple files matched and you inspected one without a principled reason →
  overview the others before answering.

### Termination

Stop when every claim in your answer cites a CodeUnit line range
(`relativePath:startLine–endLine` at a known commit), or the user's question
is fully grounded — whichever is broader. Purpose text alone is NOT
grounding for "why/how" answers; unit-level evidence is.

**That is the stop rule for "why/how", and a trap for "which files".** Grounding
proves what a file DOES; it says nothing about whether the SET is complete, and
verbatim confirmation feels like completion precisely when it is not. On a
"which files must change" question a fully grounded diagnosis routinely covers a
third of the change set — stop only after step 6 of the Bug-Fix Pattern below.

**Then answer with the set you can defend, not the longest one you can
assemble.** Once the walk stops finding files, it is tempting to pad the list
with plausible neighbours — every additional unconfirmed row costs precision
and buys recall you cannot justify. State the files you confirmed, say which
layers you searched and found nothing in, and stop there.

## knowledgeId: NEVER Guess It

`knowledgeId` is an opaque string — not necessarily a UUID, and not the
`owner/name` repoId. If you don't have it, call `roll_call` (cheap,
once per session).

## Commit Discipline

- Pinned commit → `commitHash` on every call; an empty `manhunt`
  result then genuinely means "absent at that commit".
- No pinned commit → newest snapshot is the current state; read the
  `commits` array on unit hits before claiming existence at any version.

## Bug-Fix Pattern

When investigating a specific bug or failing behaviour:

1. **Locate the suspect surface** — `stakeout {query: "<behaviour>"}`
   at the pinned commit, or `manhunt {name}` when the symbol is named
   in the report.
2. **Map the file** — `case_file`: which unit owns the failing
   behaviour, and its exact line range.
3. **Interrogate the unit** — `interrogation`: CALLS (what it delegates
   to), EDGE_CASES (is the failing input listed?), PRE/POSTCONDITIONS (which
   assumption breaks?).
4. **Check siblings** — implementers/callers via `manhunt` when the
   contract spans classes.
5. **Ground the diagnosis** in unit line ranges before proposing the fix.
6. **If the question is "which files must CHANGE", widen back out.** Steps 1–5
   narrow to the defect; they never enumerate the change set, and stopping at 5
   is the single largest source of missed files. Widen in BOTH directions — they
   reach disjoint sets, and neither substitutes for the other:

   - **Upstream — what the confirmed files READ.** Two disjoint halves, and you
     need both. The half that is an EDGE: `collateral_damage lens=['dependencies']`
     returns the files the seed itself imports — the type it takes, the schema it
     validates against, the constants it reads. That comes free with the default
     all-seven call below; just do not discard the `seed-imports-this` rows. The
     half that is NOT an edge: a fix that newly requires a value threads it
     through client store → form-to-payload mapper → request-body schema →
     versioned input DTOs → server-side input transform, and those layers
     CONSTRUCT the payload without importing the enforcer, so no import edge in
     either direction arrives there. Run one `stakeout` per layer in THAT layer's
     vocabulary, not the bug report's.
   - **Downstream — what depends on the files you confirmed.** Seed
     `collateral_damage` on each confirmed hit, all seven lenses, at the pinned
     commit. Keep the rows carrying a STRUCTURAL connection (`contracts`,
     `imports`, `dependencies`, `types`, `surfaces`); drop the rows resting on
     `keywords` alone.
     A structural row under a different top-level directory is the
     highest-value row on the page — no word-matching step could have reached
     it.

   **Seed choice decides what you get back.** The productive seed is a file the
   behaviour RUNS THROUGH — the service, handler or entry point on the path —
   not whichever file the search happened to rank first. Seeding a leaf utility
   that half the codebase reads (a resolver, a formatter, a constants module)
   returns its readers, which answers a different question than the one you
   asked. Seed several confirmed hits rather than betting the widen-out on one.

   Blast-radius rows are candidates, not answers: confirm each with `case_file`
   (RULE 1) before it enters the set. Appending a blast radius wholesale trades
   one kind of miss for a page of noise.

## Pivot Protocol: When Results Are Thin or Empty

**The rule: a thin result means change the LAYER, not the argument.** Every
tool reads one layer — prose analysis, declarations, source text, graph edges.
Thin output is evidence about that layer only, never about the codebase. Two
consecutive thin results from the same tool means you are on the wrong layer
and re-phrasing the argument will not save you.

Work down this ladder. Do not skip to the bottom, and do not stop on a rung:

1. **`stakeout {query}` → thin.** Switch `searchIn` before re-wording:
   `substrate` when the question describes what code DOES, `analysis` when it
   describes what code is ABOUT, `both` to union. Indexed prose describes a
   file's purpose and frequently contains none of the words a convention is
   known by — that is vocabulary mismatch, not absence.
2. **`manhunt {name}` → 0 or only `type-member` / `exported-symbol` rows.**
   Run `query` mode: the two modes hit different indexes, and interfaces, type
   members and re-exported symbols land in different recall tiers. A `name`
   miss says nothing about fulltext. Types and interfaces are not CodeUnits —
   0 units does NOT mean nothing depends on them.
3. **Still nothing named?** Drop `knowledgeId` and re-run — `stakeout`,
   `manhunt`, `dragnet` and `cross_repo_lookup` each sweep every accessible
   repo in ONE call. Looping repos individually is the most common way to
   waste a run.
4. **Escalate by WHAT YOU HOLD, not by a fixed sequence.** A seed FILE →
   `collateral_damage`. A package, wire address or exported symbol →
   `cross_repo_lookup`. A change you can describe but name nothing in →
   `dragnet`, which harvests the next round of names from the graph instead of
   requiring them, so private internals of other repos surface without ever
   being guessed. **`dragnet` is the one that gets skipped** — it is the only
   entry point when you hold no file and no coordinate, which is the normal
   state at a repo boundary you have not searched yet. If you are about to
   invent another search string, you are in its case.
5. **`shakedown` last, and budgeted.** Two patterns per repo. See below.

### `shakedown` is a confirmation tool — the grep trap

`shakedown` matches raw text, which makes it exhaustive for the sites that
literally spell the pattern out and **structurally blind** to everything else:

- **Pass-through sites.** A wrapper that re-exports or forwards someone else's
  value contains no matchable text and will never appear, however you word the
  pattern.
- **The same idea named differently** in another repo.

So grep proves a site you already suspect; it does not find the set. Two
failure modes to recognise in your own transcript:

- **The widening spiral.** `Updater<T>` → `Updater` → `typeof` → `set`. Each
  widening trades precision for a page of noise that looks like progress
  because grep always returns *something*. Grep never reports "nothing here",
  so it will never tell you to stop — you must.
- **The repo sweep.** Greping 15 repos is 15 calls that still miss every
  pass-through. If you are greping repo-by-repo, you are in the wrong funnel:
  go to `dragnet` / `collateral_damage`.

**Budget: two patterns per repo.** No decisive hit after two means the thing
is not written as text there. Switch tools.

<a id="cross-repo-investigation"></a>

## Cross-Repo Investigation

Omitting `knowledgeId` widens a *search* across repos, but it does not answer
a *dependency* question — searching finds files that mention something, not
files that would break. Three tools leave the single-repo spine:

| You have                          | Tool                | What it returns                                                              |
| --------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| a seed FILE                       | `collateral_damage` | files a change to it would hit, grouped by repo, each tagged with HOW         |
| a PACKAGE / ADDRESS / SYMBOL      | `cross_repo_lookup` | the files on each side of that coordinate (publisher vs importer, provider vs consumer, definer past re-exports) |
| only a CHANGE DESCRIPTION         | `dragnet`           | files reached by walking outward, harvesting names from the graph as it goes  |

### Lenses are not interchangeable

`collateral_damage` runs seven lenses — `packages`, `surfaces`, `imports`,
`contracts`, `keywords`, `types` — and each reads a **different edge**. An
empty lens proves that one signal is absent, nothing more. **Run the default
all seven on the first call**, then narrow once you have seen which signals
actually fired.

**For a type or interface change, `types` is the lens that carries the answer**
— narrow to `lens=['types']` on a FOLLOW-UP call, after the all-seven result has
shown you the shape. Type consumers never CALL anything and hold no
import-by-value edge, so they are invisible to `packages`, `imports` and
`contracts`. A file that merely declares or re-exports the changed type IS
impacted.

### Harvest and loop

`cross_repo_lookup` rows carry the importing file's own `symbols`/`subpaths`.
Feed one back in as `symbol` to resolve it to its defining file, past barrel
re-exports. That loop — look up, harvest a name, look it up — is how you reach
internals nobody publishes, and it replaces guessing.

### Before you answer a "which files / which repos" question

Re-run the search that defined the set and **diff it against your answer**.
Long flat lists of near-identical entries lose items when transcribed from
memory; one extra call closes that failure mode permanently. State any repo
you examined and excluded, and why — a silent omission reads as "not
impacted".
