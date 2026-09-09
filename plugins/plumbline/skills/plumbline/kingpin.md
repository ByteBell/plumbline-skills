---
name: kingpin
description: >
  Dedicated usage skill for the `kingpin` MCP tool — read ONE repo's hub tier
  (`:FileHub`) at one commit: the files its import graph converges on, ranked
  by PageRank over `IMPORTS_FILE`, each with in/out-degree, a utility-hub flag
  and the file's purpose. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# kingpin

Which files does this repo actually lean on? The ingestion engine answers at
index time — PageRank over the resolved `IMPORTS_FILE` graph, computed per
commit — and stores the head of that ranking as its own tier:

```
(:Knowledge)-[:HAS_HUB]->(:FileHub {knowledgeId, commitHash, relativePath, rank,
                                    pagerank, inDegree, outDegree, utilityHub})
(:FileHub)-[:SCORES]->(:FileVersion)
```

It is a tier rather than a `:FileVersion` property because a version node is
shared by every commit that left the file unchanged, while PageRank belongs to
ONE commit's whole graph.

Together with `blueprint` this is the orientation pair, and they answer
different questions at the same altitude: `blueprint` says what the repo's
parts ARE (modules, roles, dependencies), `kingpin` says which individual files
everything routes through. A module map tells you where to look; a hub ranking
tells you what a change there would shake.

## Digest

`knowledgeId` (required — ONE repo per call; omitting it is invalid here, not a
sweep) + optional `commitHash` (omit → newest indexed hub set) + optional
`excludeUtilityHubs` (default false).

One row per hub, in rank order: `{relativePath, rank, pagerank, inDegree,
outDegree, utilityHub, purpose}`. Only the HEAD of the ranking is stored (top
~50 plus every flagged utility hub) — the tail is uniform noise by construction,
so an absent file is "not a hub", never "not in the repo".

- **This is an orientation call, not a search.** Run it once per repo per
  session alongside `blueprint`, BEFORE the funnel narrows. Keep the response.
- **`utilityHub: true` marks in-degree OUTLIERS** — loggers, config, shared
  types — that top any centrality list while saying nothing about architecture.
  Pass `excludeUtilityHubs: true` for the view with those reflex imports hidden.
  But read the flagged rows themselves when the question IS "what would a change
  to shared code touch": a utility hub is the highest-blast-radius file in the
  repo, which is precisely what the flag is measuring.
- **High rank is a claim about the IMPORT graph, not about importance.** A hub
  is where imports converge; it is not necessarily where the behaviour lives.
  Use it to pick a `collateral_damage` seed and to sanity-check that a candidate
  file is load-bearing — never as evidence of what any file DOES (RULE 1).
- Pin the same `commitHash` you pass to `blueprint` / `stakeout` / `case_file` —
  an older commit returns the ranking as it was THEN.
- THIN → an empty result is NOT "this repo has no hubs". The hub tier is written
  per commit by the module phase and is non-fatal, so a repo can be fully indexed
  at the file tier and have none; the error names the commits that DO have one.
  Retry against one of those, or fall back to `blueprint` for the module tier.
- Next: `case_file` on a hub's `relativePath` to open it · `collateral_damage`
  on it for the blast radius its rank implies · `blueprint` for the same
  altitude one tier up.

## Reading the columns

| Field         | What it means                                                                  |
| ------------- | ------------------------------------------------------------------------------ |
| `rank`        | Position in the stored ranking, 1 = most converged-on.                          |
| `pagerank`    | The raw score. Compare within one response only — it is not normalised across repos or commits. |
| `inDegree`    | How many files import this one. The blast-radius number.                        |
| `outDegree`   | How many files this one imports. High in + high out = a routing/composition point rather than a leaf. |
| `utilityHub`  | In-degree outlier: reflex-imported by most of the repo. Flagged, not dropped.   |
| `purpose`     | The scored `:FileVersion`'s one-paragraph LLM purpose, joined via `SCORES`. A LEAD (RULE 1). |

The in/out pair is the most useful signal and the one most often skipped. A file
with high `inDegree` and near-zero `outDegree` is a leaf everything depends on —
change it carefully, and the change is contained. A file with both high is a
seam: it depends on much and much depends on it, so a change there propagates in
two directions at once.

## Where it fits in a run

`kingpin` carries a small share of both lanes, and that is by design — one call
per repo. It is worth its slice because a hub ranking is the cheapest way to
avoid the two most common orientation errors:

1. **Seeding `collateral_damage` on a leaf.** A leaf utility that half the repo
   reads returns its readers, which answers a different question than the one
   you asked. The hub list tells you, before you spend the call, which of your
   candidates is a utility and which is on the path.
2. **Landing in an unfamiliar repo and searching it like a familiar one.** In a
   repo whose register you do not have, `stakeout` translates your prior about
   the library rather than its actual vocabulary. `kingpin` returns real paths
   and real purposes with no query at all — read the register off them first.

Both matter most in the cross-repo lane's landing stage, where the repo you have
just reached is by definition one you have never searched.
