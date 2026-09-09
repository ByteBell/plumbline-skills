---
name: collateral-damage
description: >
  Dedicated usage skill for the `collateral_damage` MCP tool — the blast radius
  of a change, within one repo and across repos, over the IR graph's import,
  contract, type, package and concept edges.
  Read when the digest attached to its first result is not enough.
user-invocable: false
---

# collateral_damage

Compute a **blast radius**: given a seed, return the files that a change would
ripple into. It works **within a single repository and across repositories** —
five of its seven lenses (`imports`, `dependencies`, `contracts`, `types`, and
the same-repo half of `surfaces`) never leave the seed's own repo, so a single-repo or monorepo
question is squarely what this tool is for. Do not skip it because the answer
lives in one repo.

**Seed it on your own best candidate.** Once a search has confirmed a file, this
is the tool that turns that one hit into the set of files that must change
_with_ it: the caller that passes a value straight through, the deferred task
that consumes what the seed emits, the file whose signatures reference a type
the seed declares. Those files routinely contain **none of the words you
searched for** — which is precisely why `stakeout`/`manhunt`/`shakedown` cannot
reach them and this can.

**Both directions, and every row says which.** Six lenses run DOWNSTREAM — what
breaks if you change the seed. `dependencies` runs UPSTREAM — the files the seed
itself imports, which is the half of a change set that usually has to move
first: the type it takes, the schema it validates against, the constants it
reads.

**What it still does NOT reach: a chain that BUILDS the seed's input without
importing it.** A request-body schema, a versioned input DTO or a payload mapper
CONSTRUCTS what an enforcement point validates while depending on nothing in it,
so no import edge — in either direction — arrives there. That layer is found by
a second `stakeout` in its own vocabulary; a search that found the symptom site
plus this tool still leaves it unnamed. See step 6 of
[plumbline-code-search.md](plumbline://skills/plumbline/plumbline-code-search.md).

For seeds that are not a file, `cross_repo_lookup` takes a package/address/
symbol and `dragnet` takes a prose change description.

In-repo it rides the repo-scoped edges the funnel never traverses:
`IMPORTS_FILE` (in BOTH directions — `imports` forward, `dependencies` back),
`:Contract`, and the type-reference layer. To leave the repo it
uses a second, **org-global** layer:
`:Package`, `:WireSurface`, `:ExportedSymbol`, `:Keyword`, `:OntologyConcept`,
`:BusinessEntity` and `:SystemCapability` nodes are keyed by name/shape ALONE
(no `knowledgeId`), so the identical string from any file in any repo collapses
to one shared node. `:Contract` is the exception — it is repo-scoped, which is
why the `contracts` lens does not cross repos.

## Digest

Seed with EITHER `keyword` OR (`knowledgeId` + `relativePath`). Optional
`commitHash`, `lens` (subset of the seven; default ALL SEVEN), `scope` (`keywords`
lens only; default `both`), `limit` (1–100 per lens, default 20).

Works IN-REPO and cross-repo. Seven lenses, each reading a DIFFERENT edge:

- In-repo, DOWNSTREAM: **`imports`** (direct importers of the seed) ·
  **`contracts`** (`:Contract` is repo-scoped — do NOT use it for "who else
  consumes this contract" across repos).
- In-repo, UPSTREAM — the only lens that walks this way:
  **`dependencies`** (the files the seed itself imports, same `IMPORTS_FILE`
  edge read backwards). The type it takes, the schema it validates against, the
  constants it reads.
- Cross-repo: **`packages`** (HARD — other repos importing a package yours
  publishes) · **`surfaces`** (HARD — the provider↔consumer sides of an HTTP
  route/event/queue, which share no import edge; also pairs same-repo).
- Both sides: **`types`** (signature-level type coupling) · **`keywords`**
  (SOFT — thematic, a lead, never proof; `scope` picks the side —
  `'same-repo'` for the seed's nearest neighbours, `'cross-repo'`, or `'both'`,
  the default).

Five of the seven therefore fold INWARD, which is why this tool is heavy in the
single-repo budget too: `imports`, `dependencies`, `contracts`, `types` and the
same-repo half of `surfaces` never leave the seed's repo, and
`keywords scope='same-repo'` is the in-repo thematic fold most runs never ask
for.

**Seed this on a file the behaviour RUNS THROUGH**, and seed more than one. The
files that must change alongside a hit usually contain none of the words that
found it — a caller that forwards a value, a task that consumes what the seed
emits. Ranking a file highly and never seeding it here is how a multi-file
change gets reported as one file. But rank 1 is not automatically the right
seed: a leaf utility that half the repo reads (a resolver, a formatter, a
constants module) returns its readers, which answers a different question than
the one you asked. Prefer the service, handler or entry point on the path, and
seed each confirmed hit rather than betting on one.

**Direction matters, and it is the common miss. Read `direction` on every row.**
Six lenses answer "what would a change to the SEED hit" — they fan out to what
depends on the seed (`imports-seed-file`, `consumes-what-seed-provides`,
`signature-references-seed-type`, …). `dependencies` is the one that walks the
other way (`seed-imports-this`): what the seed READS, which usually has to carry
the change first. A change set is normally both halves, and a run that reports
only the downstream half has named only half of it.

**SO: ALWAYS SEARCH `dependencies`.** Not "consider it" — search it, on every
seed you fold. If you narrow `lens` at all, `dependencies` goes in the list.
Leaving it out is the single commonest way a fold comes back half-done, because
the other six lenses all walk the same direction and none of them substitutes
for it: the schema the seed validates against, the type it takes, the constants
it reads and the DTO it builds from are reachable ONLY this way. Measured
2026-09-09 on the cal.com f66fffd1 branding case — an arm narrowed on all four
of its calls (`['imports','types','contracts']`, then `['imports']` three
times), never asked for `dependencies`, and missed `packages/prisma/zod-utils.ts`,
which sits one `dependencies` hop from a file it had already ranked as a hit.

`dependencies` covers the in-repo upstream only, because `IMPORTS_FILE` is the
path-resolved edge. Two upstream gaps remain and neither is a lens:

- **Upstream across the repo boundary** — an import that leaves the repo lands on
  `:ImportedModule`/`:Package`. Take the package or symbol name and resolve it
  with `cross_repo_lookup`.
- **The payload chain that never imports the seed at all** — a client store, a
  form-to-payload mapper, a request-body schema, a versioned input DTO. These
  CONSTRUCT what an enforcement point validates without depending on it, so no
  import edge reaches them; a second `stakeout` in the payload's own vocabulary
  does.

**For a type or interface change, `types` is the lens that carries the answer**
— narrow to `lens=['types']` on a FOLLOW-UP call, never the first one. Type
consumers CALL nothing and hold no import-by-value edge, so
`packages`/`imports`/`contracts` are all blind to them. A file that merely declares or re-exports the changed
type IS impacted, even with zero CodeUnits.

Returns one entry per impacted file, each with
`connections: [{lens, direction, via, strength}]`. Rows carrying a STRUCTURAL
edge sort above rows resting on the soft `keywords` lens alone, `strength`
ordering within each band — so a single hard type edge outranks any number of
shared generic concepts. Read `direction` before acting:
`consumes-what-seed-provides` is a real downstream break; `shares-concepts` is a
lead.

- **Do not narrow with `lens` on the first call** — run all seven, then narrow
  once you have seen which signals fired. Narrowing to `['imports']` is the
  common miss: a consumer that only references the seed's TYPE holds no import
  edge and vanishes.
- **Every narrowed call keeps `dependencies`** — it is the ONLY upstream lens, so
  dropping it is not a narrowing, it is a direction you stopped searching. The
  tool now says so in the response header when you leave it out.
- **An empty lens ≠ no impact.** It proves ONE signal is absent, nothing more.
  Never conclude "nothing depends on this" from a narrowed lens.
- THIN after all seven → you have the wrong SEED, not the wrong tool. Re-seed on
  the file that actually declares the changed surface, or switch to `dragnet`
  (prose) / `cross_repo_lookup` (a coordinate). Do NOT fall through to
  repo-by-repo `shakedown` — it cannot see pass-through sites.

## Schema

| Field          | Type             | Notes                                                              |
| -------------- | ---------------- | ------------------------------------------------------------------ |
| `knowledgeId`  | string (opt.)    | Seed file's repo (from `roll_call`). Required unless `keyword`.    |
| `relativePath` | string (opt.)    | Seed file path (from `stakeout`). File-seed mode.                  |
| `commitHash`   | string (opt.)    | Pin the seed to a snapshot. Omit → newest.                         |
| `keyword`      | string (opt.)    | Keyword-seed mode: exact `:Keyword` name. Excludes `relativePath`. |
| `lens`         | string[] (opt.)  | Subset of the seven below. Default: **all seven**.                     |
| `scope`        | enum (opt.)      | `keywords` lens only. Default `both` (in-repo + cross-repo).       |
| `limit`        | int 1–100 (opt.) | Max impacted files **per lens** (default 20).                      |

Provide **either** `keyword` **or** (`knowledgeId` + `relativePath`).

## The seven lenses — what each proves

Each lens reads a **different edge**. They are not interchangeable, and an
empty lens proves that ONE signal is absent — nothing more. A file with no
`packages` rows can still have many `types` rows.

**Cross-repo (leave the repo boundary):**

- **`packages`** — HARD. Other repos importing a package your repo publishes,
  via `:Package`. Importers of the seed file's **own** package rank first;
  rows are capped per consumer repo so one broad importer cannot eat the whole
  limit, and the header discloses what was dropped.
- **`surfaces`** — HARD. The provider↔consumer sides of a shared HTTP route,
  event, or queue address, via `:WireSurface`. The two sides share no import
  edge, so nothing else pairs them.
- **`types`** — signature-level type coupling: files whose unit signatures
  reference, or that import by symbol, a type/interface the seed file declares
  or own-exports.
- **`keywords`** — SOFT. Thematic overlap across concept nodes (keyword /
  ontology / entity / capability), same-repo and cross-repo (`scope`, default
  `both`). A lead to investigate, never proof — generic concepts like `User` or
  `Organization` link genuinely unrelated files, so these rows rank below every
  structural row no matter how many concepts they share. Narrow `scope` to take
  one side only.

**In-repo only:**

- **`imports`** — DOWNSTREAM. The seed file's direct importers **within its own
  repo**, via the resolved `(:FileVersion|:Chunk)-[:IMPORTS_FILE]->(:File)` edge.
  Intra-repo by construction: the resolved edge targets a repo-scoped `:File`.
- **`dependencies`** — UPSTREAM, and the only lens that walks this way. The files
  the seed ITSELF imports, over that same edge read backwards; rows carry
  `direction: 'seed-imports-this'`. This is where the type the seed takes, the
  schema it validates against and the constants it reads come from — files that
  must usually change BEFORE the seed does, and that no downstream lens can
  reach. Same intra-repo limit: an import that leaves the repo lands on
  `:ImportedModule`/`:Package` and is not returned here — hand that name to
  `cross_repo_lookup` instead.
- **`contracts`** — provide/consume of a `:Contract`, which is **repo-scoped**.
  This lens does NOT cross repos. Do not reach for it to answer "who else
  consumes this contract".

### For a type or interface change, `types` carries the answer

This is the lens that answers "if I tighten/widen this type, what breaks". Type
consumers never CALL anything and hold no import-by-value edge, so they are
invisible to `packages`, `imports`, `dependencies` and `contracts` alike. Narrowing to
`lens=['types']` is a FOLLOW-UP move — run the default all seven first, as the
rule below requires, then isolate. A file that merely
declares or re-exports the changed type IS impacted, even with zero CodeUnits.

`types` is precise for distinctive names and noisier for generic ones — rank by
`strength` and read `via` before promoting a row.

## Returns

One entry per impacted file. Rows with a structural connection sort above
soft-only (`keywords`) rows; total `strength` orders within each band, and the
header says how many rows were demoted:

```
{ knowledgeId, relativePath, strength,
  connections: [ { lens, direction, via: [names], strength } ] }
```

`direction` values: `consumes-what-seed-provides`, `provides-what-seed-consumes`,
`shares-contract`, `imports-seed-file`, `shares-concepts`, `has-keyword`.
`via` lists the shared contract/concept names (≤8) that link the file to the seed.
The header gives a per-repo count breakdown.

## Rules

- **Org-scoped, always.** Shared nodes are database-global; results are filtered
  to the session's allowed `knowledgeIds`. A blast radius never exposes another
  org's files.
- **Read `direction` before acting.** `consumes-what-seed-provides` is a real
  downstream break; `shares-concepts` is a lead to investigate, not proof.
- **An empty lens ≠ no impact.** Each lens reads one edge. A file with no
  modelled contracts still has importers (`imports`), package consumers
  (`packages`), type consumers (`types`) and thematic neighbours (`keywords`).
  Never conclude "nothing depends on this" from a narrowed `lens` — re-run with
  the default all-seven first.
- **Do not narrow with `lens` on the first call.** Default is all seven; narrow
  only once you have seen which signals actually fired.
- **Seed not found** → the tool says so and points you at `stakeout`; it does not
  silently return an empty blast radius for a mistyped path.
- **Thin after all seven lenses** → you have the wrong seed, not the wrong tool.
  Re-seed on the file that actually declares the changed surface, or switch to
  `dragnet` (prose description) / `cross_repo_lookup` (a coordinate). Do NOT
  fall through to repo-by-repo `shakedown` — it cannot see pass-through sites.
- Next stage: `case_file` on an impacted `{knowledgeId, relativePath}` to see
  exactly what there consumes the seed, then `interrogation` on the unit.
