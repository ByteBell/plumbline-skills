---
name: paper-trail
description: >
  Dedicated usage skill for the `paper_trail` MCP tool — search indexed PDF
  documents across two tiers (graph traversal + fulltext) fused by Reciprocal
  Rank Fusion, returning pages with their node_ids, chapters and neighbour
  pages. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# paper_trail

The entry point for the PDF surface — `roll_call` for code is `roll_call` +
`paper_trail` for documents. It searches `:PageNode` / `:ChapterNode`, which
the code tools never reach, and its `node_id`s are the input `read_the_fine_print`
and `mugshot` both require.

Registered only when the deployment sets `ENABLE_PDF`. `roll_call` marks the
knowledges it can search `type: PDF`; the code tools return nothing for them.

## Digest

`query` (required — a term or a natural-language question). Optional:
`knowledgeId` (**omit on the first pass** to search every PDF the session may
read), `tiers` (`["graph"]` / `["fulltext"]` / both — default both), `topK`
(1–50, default 10), `windowSize` (0–5 neighbour pages, default 1).

Two tiers merged by Reciprocal Rank Fusion: **`graph`** searches chapter
keywords/topics, `:OrgKeyword`, entity arrays and image descriptions — pick it
for named things. **`fulltext`** searches page/chapter purpose+summary, verbatim
excerpts and definitions — pick it for an exact phrase. Default to both.

Returns one entry per page with **`node_id` — the handle every follow-up call
needs.** `read_the_fine_print` and `mugshot` both take `nodeIds`; page numbers
are the fallback, not the handle.

- **A hit is a pointer, not an answer.** `summary`/`purpose` are LLM analysis of
  the page. Never answer from them — verify with `read_the_fine_print
  {operation: "metadata"}`, then read the real text with `operation: "content"`.
- Large result sets are **trimmed, not paged**: over budget, the handler drops
  results (keeping ≥3) and says so in `_note`. Add `knowledgeId` or lower
  `topK` — re-requesting will not return the dropped entries.
- Null-heavy hits mean an OLD ingest, not an empty page — documents indexed
  before the page-analysis write match through `:OrgKeyword` while
  `purpose`/`summary` come back empty. Read the page rather than calling it blank.
- Images are described, not delivered: `s3_url` is a pointer, bytes come from
  `mugshot`.
- A PDF `node_id` means nothing to a code tool, and vice versa.

## Schema

| Field         | Type               | Notes                                                                       |
| ------------- | ------------------ | --------------------------------------------------------------------------- |
| `query`       | string (required)  | A search term or a natural-language question.                               |
| `knowledgeId` | string (optional)  | Scope to ONE document. **Omit to search every PDF the session may read.**   |
| `tiers`       | enum[] (optional)  | `["graph"]`, `["fulltext"]`, or both. Default: both.                        |
| `topK`        | int 1–50 (opt.)    | Results kept after the RRF merge. Default 10.                               |
| `windowSize`  | int 0–5 (opt.)     | Neighbour pages included around each hit for reading context. Default 1.    |

## The two tiers, and when to narrow to one

| Tier       | What it actually searches                                                                                       | Pick it for                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `graph`    | Chapter keywords/topics, `:OrgKeyword` (`content_type: 'pdf'`), entity arrays, `questions_answered`, image descriptions | Named things: an entity, a defined term, "chapter about X" |
| `fulltext` | `pagenode_ft` (page purpose + summary) and `chapternode_ft` (chapter title + summary), verbatim excerpts, definitions | An exact phrase you expect on the page                 |

Both run in parallel and merge by Reciprocal Rank Fusion (k=60), so a page
that ranks moderately in both outranks one that spikes in a single tier.
Default to both; narrow only when one tier's noise is drowning the other.

## Returns

`{ results: [...], total, tiers_used }`, one entry per page:

```json
{
  "knowledge_id": "<pdf knowledge id>",
  "pdf_title": "<document title>",
  "page_number": 42,
  "node_id": "<PageNode id — the handle every follow-up call needs>",
  "purpose": "…",
  "summary": "…",
  "headlines": ["…"],
  "entities": ["…"],
  "chapter": { "title": "…", "start_page": 30, "end_page": 55 },
  "context_pages": [{ "page_number": 41, "summary": "…", "continuation_status": "…" }],
  "images": [{ "s3_url": "…", "description": "…" }],
  "verbatim_excerpts": [{ "text": "…", "page_number": 42 }],
  "definitions": [{ "text": "…", "page_number": 42 }],
  "rrf_score": 0.031,
  "tiers_matched": ["graph", "fulltext"],
  "source_type": "pdf"
}
```

**`node_id` is the field to carry forward.** `read_the_fine_print` and
`mugshot` both take `nodeIds`, and page numbers are the fallback, not the
handle.

## Rules

- **A hit is a pointer, not an answer.** `summary` and `purpose` are LLM
  analysis of the page. Never answer from them — verify with
  `read_the_fine_print {operation: "metadata"}`, then read the actual text
  with `operation: "content"`. See
  [read-the-fine-print.md](plumbline://skills/plumbline/read-the-fine-print.md).
- **Omit `knowledgeId` on the first pass.** One call searches every PDF the
  session can read, and each hit carries its own `knowledge_id`. Narrow on
  the second call, once the hits tell you which document matters.
- **`source_type: "pdf"` never crosses to the code tools.** PDFs are read
  with `read_the_fine_print`, code with `the_receipts`. A PDF `node_id` means
  nothing to a code tool and vice versa.
- **Large result sets are trimmed, not paged.** When a response exceeds the
  per-call token budget the handler drops results (keeping at least 3) and
  says so in a `_note` field. That is a signal to add `knowledgeId` or lower
  `topK` — re-requesting will not return the dropped entries.
- **`windowSize` buys context cheaply.** Neighbour pages arrive as summaries
  in `context_pages`, so a hit that starts mid-argument shows what precedes
  it without a second call. Raise it when `continuation_status` says the page
  continues; drop it to 0 when you only need the hit itself.
- **Null-heavy hits mean an old ingest, not an empty page.** Documents
  indexed before the page-analysis write can match through their
  `:OrgKeyword` edges while `purpose` / `summary` come back empty. Read the
  page content rather than concluding the page is blank.
- **Images are described, not delivered.** `images[].description` is
  searchable text and `s3_url` is a pointer; the actual bytes come from
  `mugshot`. See [mugshot.md](plumbline://skills/plumbline/mugshot.md).

## See also

- PDF workflow recipe: [plumbline-pdf.md](plumbline://skills/plumbline/plumbline-pdf.md)
- Page reading: [read-the-fine-print.md](plumbline://skills/plumbline/read-the-fine-print.md)
- Page images: [mugshot.md](plumbline://skills/plumbline/mugshot.md)
