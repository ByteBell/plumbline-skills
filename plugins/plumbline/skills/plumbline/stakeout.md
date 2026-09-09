---
name: stakeout
description: >
  Dedicated usage skill for the `stakeout` MCP tool — locate files in
  IR-indexed repositories by fulltext over LLM file analysis, verbatim code
  declarations, or behavioural substrate, or by path substring, optionally
  scoped to one commit. Read when the digest attached to its first result is
  not enough.
user-invocable: false
---

# stakeout

Locate files. `query` mode runs up to three kinds of index, picked by
`searchIn`:

- **PROSE** (`fileversion_text_ft` over per-commit `purpose` /
  `businessContext` / `canonicalParagraph`, plus `file_summary_ft` over the
  `File` node's richer `summary`) — LLM vocabulary. Query with behaviour
  words ("rate limiting middleware"), not code tokens.
- **DECLARATION** (`typeshape_ft` type-shape text, `codeunit_ft` unit
  names/summaries, `unit_signature_ft` unit signatures) — verbatim CODE
  vocabulary. An identifier query (`setState`, `SetStateAction<Node[]>`)
  lands here even when a file's prose never uses that word.
- **SUBSTRATE** (edge cases, invariants, assumptions, error handling) —
  the BEHAVIOURAL layer. Matches what code DOES, not what it's about.

`searchIn: 'analysis'` (default) unions PROSE + DECLARATION; `'substrate'`
is behavioural only; `'both'` unions everything. Each hit's `matchedIn`
array reports which index(es) matched (`analysis`, `summary`, `type-shape`,
`unit`, `signature`, `edge-case`, `invariant`, `assumption`,
`error-handling`, or `path-guess` / `module` — see the enrichment note below).

## Digest

`query` (fulltext; Lucene syntax allowed) and/or `pathContains`
(case-sensitive substring of `relativePath`) — at least one is required.
`searchIn` picks the layer `query` runs against: `'analysis'` (default,
prose + declaration/code-vocabulary), `'substrate'` (behavioural, rows carry
`evidence` — the matched sentences), `'both'` (union). Optional:
`knowledgeId` (OMIT to sweep every accessible repo in one call),
`commitHash`, `limit` (1–100, default 20).

Prose search misses identifier/code-vocabulary queries — that's what
`searchIn` (default `'analysis'`) already covers via the declaration layer,
not a reason to fall back to `manhunt` first. Reach for `searchIn:
'substrate'` when the question describes what code DOES rather than what
it's about. Returns `{knowledgeId, relativePath, commitHash, language,
purpose (≤300 chars) or evidence, score, matchedIn, tokenCount}`.

- Without `commitHash`, hits span ALL indexed snapshots and the same path can
  appear once per commit where it changed — read each hit's `commitHash` before
  comparing them.
- `matchedIn: ["summary"]` prose reflects the file's NEWEST analysed state, so
  it can describe a later version than a pinned commit. Confirm with `case_file`.
- Fulltext ranks analysis text, not importance — if the top hits are the wrong
  layer, add `pathContains` (`".py"`, `"src/"`) rather than re-querying blind.
- THIN → 0 hits on a reasonable query is usually vocabulary mismatch: try
  `searchIn: 'substrate'` if you were describing behaviour, or `searchIn: 'both'`
  to union every layer, before falling back to `manhunt` or re-phrasing. Next
  stage DOWN is `case_file` on ONE located file.
- **Phrase it in the CODEBASE's register, not the bug report's.** This is the
  single highest-yield habit with this tool. A report names a symptom in the
  user's words; the code names the mechanism in the developer's — the verb and
  object of the operation, in identifier and path casing. The default
  `searchIn: 'analysis'` already searches identifiers, qualified names and
  signatures alongside prose — so query the names you'd *expect the code to
  use*, and try `pathContains` on the kebab/camel form too. The gap this closes
  is large and measured: the content words of a bug-report-register query
  overlap the entire indexed prose of a file the fix touches by only 6–10%.
  **It stops holding at a repo boundary.** In a repo you have not searched yet,
  you do not have its register — you have your prior about what that library is
  famous for, and translating into that prior finds its best-known generic
  utility instead of the structure you were actually asked about (a cache-key
  hasher when the question said "state looked up by an object-derived key").
  For a repo you are reaching into for the first time, query the asked-for
  behaviour in plain wording FIRST, and let the returned paths teach you the
  register before you narrow.
- Every fulltext search that supplies a real `reason` is widened automatically,
  in parallel with the literal query — an LLM translates `query` + `reason` into
  the codebase's own register (identifier guesses and synonyms — "confirmation"
  → `verify`/`totp`), plus likely path fragments, plus candidate module roots
  from this repo's module map when `knowledgeId` is set. A placeholder `reason`
  gets you nothing here. It adds two KINDS of row. A `matchedIn: ["path-guess"]`
  row with no `score` is a path scan — it says "this file sits where the fix
  probably lives", never "this file's text matched"; confirm with `case_file`
  before citing one (RULE 1), and a slice of the page is reserved for these so a
  full page of text matches cannot crowd them out. A row carrying `"module"`
  ALONGSIDE a layer tag (`["unit", "module"]`, `["signature", "module"]`) is a
  real text match with a real score, found by re-running the search scoped
  inside a module the enrichment picked out of this repo's module map; it ranks
  normally, and the layer tag says which index hit.
- **It cannot find a file your query never describes — but a SECOND query in a
  different register usually can.** A fix that newly enforces a value also
  threads that value through every layer that CARRIES it: client store →
  form-to-payload mapper → request-body schema → versioned input DTOs →
  server-side input transform. Those layers speak the PAYLOAD's vocabulary,
  never the symptom's, so no amount of re-phrasing in the symptom's register
  reaches them — asking "what carries this value?" and searching again does.
  `collateral_damage lens=['dependencies']` covers only PART of that: it returns
  what the enforcement point IMPORTS, so it reaches the type or schema the seed
  reads directly. The carrying layers it cannot reach are the ones that
  CONSTRUCT the payload without importing the enforcer — they hold no import
  edge in either direction, which is exactly why a second query in the payload's
  register is the only thing that finds them.

## Schema

| Field          | Type              | Notes                                                                       |
| -------------- | ----------------- | --------------------------------------------------------------------------- |
| `query`        | string (optional) | Fulltext; layer picked by `searchIn`. Lucene syntax allowed.                |
| `pathContains` | string (optional) | Case-sensitive substring of `relativePath`.                                 |
| `searchIn`     | enum (optional)   | `'analysis'` (default) / `'substrate'` / `'both'`. See Digest.              |
| `knowledgeId`  | string (optional) | Restrict to one repo (from `roll_call`).                                    |
| `commitHash`   | string (optional) | Restrict to one indexed snapshot.                                           |
| `limit`        | int 1–100 (opt.)  | Default 20.                                                                 |
| `reason`       | string (optional) | Not just telemetry here — drives the automatic widening pass. See Digest.   |

At least one of `query` / `pathContains` is required. Both together =
fulltext filtered to a subtree.

## Modes — pick deliberately

Two independent axes: HOW you search (`query` vs `pathContains`), and WHICH
layer `query` runs against (`searchIn`).

- **`query` (fulltext, relevance-ranked):** for "which file does X" /
  conceptual questions.
- **`pathContains` (substring scan):** when you already know part of the
  path, a filename, or an extension (`"marc"`, `"auth/"`, `".sql"`).

### `searchIn` — which layer `query` runs against

- **`'analysis'` (default):** prose (behaviour words: "rate limiting
  middleware") UNIONED with the declaration layer (code vocabulary:
  identifiers, type names, signatures). Covers both "what a file is about"
  and "what a file literally names" in one call.
- **`'substrate'`:** the behavioural layer only — edge cases, invariants,
  assumptions, error handling. Use when the question is phrased as a
  BEHAVIOUR ("throws a promise until the observable emits", "suspends until
  X resolves") rather than a topic; prose/declaration search misses these
  because no file's purpose or signature uses those words. Rows carry
  `evidence`, the matched sentences.
- **`'both'`:** unions all three layers. Costs more (every branch runs) —
  reach for it when you are not sure which layer will hit, not as the
  default.

## Returns

`{knowledgeId, relativePath, commitHash, language, purpose (≤300 chars) or
evidence, score, matchedIn, tokenCount}` per hit. `purpose` is truncated —
the full analysis comes from `case_file`, which is the standard next call.
Declaration-layer and substrate hits carry `evidence` (the matched
type-shape/signature/unit text, or matched behavioural sentences) instead of
`purpose`. `matchedIn: ["path-guess"]` with `score: null` means the row came
from the widening pass as a path scan, not a text match — a lead about WHERE the
fix likely lives; confirm with `case_file` before citing it. A slice of the page
is reserved for these, so a full page of text matches cannot crowd them out.
`"module"` appearing alongside a layer tag (`["unit", "module"]`) is different:
that IS a text match, scored and ranked normally, found by re-running the search
scoped inside a module the enrichment selected from this repo's module map.

## Rules

- **Commit semantics:** with `commitHash`, you search one snapshot — results
  reflect that version of the repo. Without it, hits span ALL indexed
  snapshots and the same path can appear once per commit where it changed;
  read each hit's `commitHash` before comparing.
- **`matchedIn: ["summary"]` hits carry one caveat:** the `File` summary
  reflects the file's NEWEST analysed state. With `commitHash` set the hit is
  re-anchored to that snapshot, but the matching prose may describe a later
  version — confirm with `case_file` at the pinned commit.
- **Fulltext ranks analysis text, not importance.** Templates/docs can
  outscore the route handler for UI-flavoured words. If top hits look like
  the wrong layer, add `pathContains` (e.g. `".py"`, `"src/"`) or re-query
  with more behavioural vocabulary.
- **An identifier/code-vocabulary query is not a prose-search miss.** Default
  `searchIn: 'analysis'` already unions the declaration layer (type shapes,
  unit names/summaries, signatures), so `setState` or
  `SetStateAction<Node[]>` lands even when every file's purpose/summary
  avoids that word. 0 hits under `'analysis'` with a genuinely code-shaped
  query means try `manhunt` (which indexes the same declaration vocabulary
  from the unit/type side) before assuming stakeout can't reach it.
- **A behaviour-phrased question needs `searchIn: 'substrate'` or `'both'`.**
  "0 hits" under the default `'analysis'` layer for a question like "throws
  when the queue is full" is not evidence of absence — neither prose nor
  declarations index edge cases/invariants/error-handling; only substrate
  does.
- **Vocabulary register, not index coverage, is what usually fails.** The
  tempting conclusion from a thin prose search — "the indexer's summary for
  that schema never uses my words, so it is unreachable" — is measurably
  wrong. Those files are reachable; nothing asked for them by name. A schema's
  summary may avoid the report's noun entirely while the file is named for the
  operation it validates and declares a type spelled the same way. Re-query in
  the codebase's register before concluding anything is missing from the index.
- **Write a real `reason`, not a placeholder.** `reason` is read here, not just
  logged: an LLM uses `query` + `reason` — and this repo's module list when
  `knowledgeId` scopes the call — to generate the identifier guesses, synonyms,
  path fragments and module roots you did not supply, and those are searched
  alongside your literal query. It runs on every fulltext call that carries a
  reason, concurrently with the main search, and degrades silently to no effect
  if `reason` is empty or the LLM call fails. It is a per-query translation, not
  a semantic index: it cannot retrieve a file whose concept appears nowhere in
  your query at all.
- **When the fix is a GROUP of alike files, raise `limit` rather than re-query.**
  Some changes touch every route page under one settings tree, or every handler
  in one directory. Search ranks two or three of that group and stops, because
  the rest say nothing new — near-identical prose scores alike, so the siblings
  fall off the page together. A `matchedIn: ["subtree"]` row is that group: the
  tool walked up from the files it ranked and took the widest ancestor
  directory still small enough to be one coherent set rather than a package.
  Those rows fill only the page space the ranked hits left EMPTY, so at the
  default `limit: 20` a full page of text matches shows none of them. Asking
  for `limit: 50` is what makes the group visible, and it is the cheapest move
  available when the question is "which files must change" rather than "where
  does this happen".
- A subtree row is a LEAD with no `score` — "this file sits beside one that
  matched", never "this file's text matched". RULE 1 still applies: confirm
  with `case_file` before citing one.
