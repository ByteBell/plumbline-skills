# Plumbline PDF Documents

Use this skill when searching or reading indexed PDF documents. PDFs use a different graph model and different retrieval tools than code — **never cross them** (`the_receipts` for code, `read_the_fine_print` for PDFs).

This recipe is the STRATEGY. Each tool's schema, returns and guardrails live in its own skill — read the one for the tool you are about to call:
[paper-trail.md](plumbline://skills/plumbline/paper-trail.md) · [read-the-fine-print.md](plumbline://skills/plumbline/read-the-fine-print.md) · [mugshot.md](plumbline://skills/plumbline/mugshot.md).

All three are registered only when the deployment sets `ENABLE_PDF`. If they are absent from `tools/list`, this deployment indexes no documents — say so rather than substituting the code tools.

## How PDF Results Appear

PDFs are a separate graph from code — the code tools (`stakeout`, `manhunt`) do **not** return PDF pages. Discover PDF content with **`paper_trail`**: dedicated PDF search with two parallel tiers (graph, fulltext), fused via Reciprocal Rank Fusion. Results carry `source_type: "pdf"` with a `pdf` sub-object containing `page_number`, `pdf_title`, `chapter_title`, `summary`.

**Routing rule:** `source_type: "pdf"` → read it with `read_the_fine_print`; `source_type: "code"` → read it with `the_receipts`. Never cross them.

## The PDF Search → Read Pattern

```
paper_trail → read_the_fine_print(metadata) → read_the_fine_print(content) → answer
```

### Step by step:

1. **Search** — `paper_trail({ query, knowledgeId? })`. Returns node_ids, page_numbers, summaries, chapter info.
2. **Verify** — `read_the_fine_print({ operation: "metadata", knowledgeId, nodeIds: [...] })`. Returns purpose, summary, headlines, entities, definitions, questions_answered, `hasImages` flag. Verify these are the pages you actually need.
3. **Read** — `read_the_fine_print({ operation: "content", knowledgeId, nodeIds: [...] })`. Returns verbatim text excerpts + definitions + image paths. This is the actual page content.
4. _(optional)_ **Images** — if `hasImages: true` in metadata, call `mugshot({ knowledgeId, nodeIds: [...] })` to get base64-encoded images with descriptions.

**Never use the summary alone as the final answer** — always read the actual content via step 3.

## PDF Graph Model

```
Knowledge (type: "PDF", pdf_title)
  └─ ChapterNode { title, summary, start_page, end_page, keywords, topics }
       └─ PageNode { page_number, purpose, summary, headlines, entities,
                     definitions, keywords, questions_answered, continuation_status,
                     images (JSON), pdf_title }
            ├─ VerbatimExcerptNode { text }     ← the actual quoted text
            ├─ DefinitionNode { text }           ← extracted definitions
            └─ NEXT_PAGE → adjacent PageNode     ← for context windowing
```

OrgKeywords for PDFs have `content_type: "pdf"` and link via `APPEARS_IN_PAGE` (not APPEARS_IN_FILE).

## read_the_fine_print Operations

### metadata — Verify before reading

```
read_the_fine_print({ operation: "metadata", knowledgeId, nodeIds: ["id1", "id2"] })
```

Or by page range: `{ operation: "metadata", knowledgeId, fromPage: 1, toPage: 10 }` (max 10 pages)

Returns per page: purpose, summary, headlines, definitions, entities, keywords, topics, questions_answered, continuation_status, `hasImages` flag, chapterTitle.

### content — Get verbatim text

```
read_the_fine_print({ operation: "content", knowledgeId, nodeIds: ["id1", "id2"] })
```

Or by page range: `{ operation: "content", knowledgeId, fromPage: 5, toPage: 9 }` (max 5 pages)

Returns per page: verbatim text excerpts, definitions, image paths with descriptions, summary for context.

### chapter — Browse chapter structure

```
read_the_fine_print({ operation: "chapter", knowledgeId, chapterTitle: "Introduction" })
```

Returns: chapter summary, start/end page, and all page summaries within the chapter. Use this to understand chapter scope before diving into individual pages.

## paper_trail: Dedicated PDF Search

Runs two parallel search tiers for PDF-specific queries:

| Tier     | What it searches                                                              | Best for                                                   |
| -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| graph    | Chapter keywords/topics, OrgKeywords, entity arrays, questions_answered       | Structured lookups ("definitions of X", "chapter about Y") |
| fulltext | PageNode + ChapterNode purpose/summary, VerbatimExcerpt text, Definition text | Exact phrase matching                                      |

```
paper_trail({ query: "machine learning fundamentals", knowledgeId?, topK: 10, windowSize: 1 })
```

- `windowSize` (default 1, max 5) — includes ±N neighbor pages around each result for context
- `tiers` — optionally limit to specific tiers: `["graph", "fulltext"]`
- Omit `knowledgeId` to search across ALL PDFs in the org

## mugshot: Get Page Images

After confirming `hasImages: true` in metadata:

```
mugshot({ knowledgeId, nodeIds: ["page_node_id"] })
```

Returns base64-encoded image data with descriptions. Max 5 nodeIds per call. Supports PNG, JPG, GIF, WebP, SVG, BMP.

## Limits

| Operation                | Max per call |
| ------------------------ | ------------ |
| metadata (by page range) | 10 pages     |
| content (by page range)  | 5 pages      |
| mugshot                  | 5 nodeIds    |
| paper_trail topK         | 50 results   |

## Quick Reference

| Question                     | Tool call                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Find PDF docs about a topic  | `paper_trail({ query: "..." })`                                                   |
| Search a specific PDF        | `paper_trail({ query: "...", knowledgeId: "<pdf-id>" })`                          |
| Verify pages before reading  | `read_the_fine_print({ operation: "metadata", knowledgeId, nodeIds })`            |
| Read actual page text        | `read_the_fine_print({ operation: "content", knowledgeId, nodeIds })`             |
| Browse a chapter             | `read_the_fine_print({ operation: "chapter", knowledgeId, chapterTitle: "..." })` |
| Get images from a page       | `mugshot({ knowledgeId, nodeIds })` — check `hasImages` first                     |
| Identify PDF knowledge bases | `roll_call` — look for entries with `type: "PDF"`                                 |

## Chapter-Based Exploration

When you need to understand the structure of a PDF before diving in:

1. **paper_trail({ query })** — results include `chapter.title`, `chapter.start_page`, `chapter.end_page`
2. **read_the_fine_print({ operation: "chapter", chapterTitle: "..." })** — get all page summaries in that chapter
3. Pick the most relevant pages from the chapter listing
4. **read_the_fine_print({ operation: "content", nodeIds: [selected pages] })** — read those specific pages
