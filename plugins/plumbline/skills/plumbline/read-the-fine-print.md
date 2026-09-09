---
name: read-the-fine-print
description: >
  Dedicated usage skill for the `read_the_fine_print` MCP tool — verify PDF
  page metadata, fetch verbatim text, or browse a chapter.
  Read when the digest attached to its first result is not enough.
user-invocable: false
---

# read_the_fine_print

Mirror of `the_receipts` for indexed PDF documents. Two-pass pattern:
verify pages with `metadata`, then read verbatim text with `content`. Never
cross with `the_receipts` — code uses `the_receipts`, PDFs use this tool.

## Digest

`operation` (required: `metadata` | `content` | `chapter`) + `knowledgeId`
(required). Address pages with `nodeIds` (max 10, **preferred** — from
`paper_trail`) or `fromPage`/`toPage`. For `chapter`: `chapterId` or
`chapterTitle` (case-insensitive substring).

- `metadata` — verify pages BEFORE reading: purpose, summary, headlines,
  definitions, entities, keywords, topics, `hasImages`, chapterTitle. Max 10
  pages per call.
- `content` — verbatim excerpts, definitions, image paths + descriptions. Max 5
  pages per call.
- `chapter` — chapter summary, start/end page, all page summaries within.

**The two-pass pattern is the point:** always `metadata` first to confirm
relevance, then `content`. Don't pay tokens for pages that turn out to be wrong.

- **NEVER answer from a page summary.** The summary is LLM analysis; the answer
  must come from verbatim text via `content`.
- `hasImages: true` and you need the figure → follow up with `mugshot`.
- `source_type: "pdf"` → this tool. `source_type: "code"` → `the_receipts`.
  Never cross them.

## Schema

| Field          | Type                     | Notes                                                         |
| -------------- | ------------------------ | ------------------------------------------------------------- |
| `operation`    | enum (required)          | `metadata`, `content`, `chapter`                              |
| `knowledgeId`  | string (required)        | PDF knowledge ID (from `paper_trail` / `roll_call`).          |
| `nodeIds`      | array (max 10, optional) | Page node_ids — preferred over `fromPage`/`toPage`.           |
| `fromPage`     | int ≥ 1 (optional)       | 1-based start page (alternative to `nodeIds`).                |
| `toPage`       | int ≥ 1 (optional)       | metadata: max 10 pages, content: max 5 pages.                 |
| `chapterId`    | string (optional)        | Chapter node_id (chapter operation).                          |
| `chapterTitle` | string (optional)        | Case-insensitive chapter title substring (chapter operation). |

## Operations

| Operation  | Purpose                       | Returns                                                                                         |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| `metadata` | Verify pages before reading   | purpose, summary, headlines, definitions, entities, keywords, topics, `hasImages`, chapterTitle |
| `content`  | Verbatim text                 | verbatim_excerpts, definitions, image paths + descriptions, summary for context                 |
| `chapter`  | Browse all pages in a chapter | Chapter summary, start/end page, all page summaries within                                      |

## Examples

```json
// Verify pages from a search result
{ "operation": "metadata", "knowledgeId": "<pdf-uuid>", "nodeIds": ["id1", "id2"] }

// Read verbatim text
{ "operation": "content", "knowledgeId": "<pdf-uuid>", "nodeIds": ["id1", "id2"] }

// Page-range alternative
{ "operation": "content", "knowledgeId": "<pdf-uuid>", "fromPage": 5, "toPage": 9 }

// Browse a chapter
{ "operation": "chapter", "knowledgeId": "<pdf-uuid>", "chapterTitle": "Introduction" }
```

## Guardrails

1. ALWAYS call `metadata` first to verify relevance before fetching `content`. Don't pay tokens for pages that turn out to be wrong.
2. NEVER use the page summary alone as the final answer — always read verbatim text via `content`.
3. `metadata` max 10 pages per call; `content` max 5 pages per call.
4. If `metadata` reports `hasImages: true` and you need the figures, follow up with `mugshot`.
5. `source_type: "pdf"` from any search result → use this tool. `source_type: "code"` → use `the_receipts`.

## See also

- PDF workflow recipe: [plumbline-pdf.md](plumbline://skills/plumbline/plumbline-pdf.md)
- File retrieval (code): [the-receipts.md](plumbline://skills/plumbline/the-receipts.md)
