---
name: mugshot
description: >
  Dedicated usage skill for the `mugshot` MCP tool — fetch the actual images
  on indexed PDF pages as base64 image content blocks you can look at, keyed
  by PageNode node_id. Read when the digest attached to its first result is not enough.
user-invocable: false
---

# mugshot

The only tool that returns pixels. Every other PDF tool returns an image's
*description* and its `s3_url`; this one returns the image itself as an MCP
image content block, so you can read a figure, chart, screenshot or diagram
instead of paraphrasing someone's caption of it.

Registered only when the deployment sets `ENABLE_PDF`.

## Digest

`knowledgeId` (required) + `nodeIds` (required, 1–5 `:PageNode` node_ids from
`paper_trail` / `read_the_fine_print`). **Max 5 enforced** — a sixth id is an
error, not a truncation.

Returns interleaved content blocks ordered by page: a header line, the image
block (base64 + mimeType), then the indexed description. Pages with no images
are skipped silently.

- **Check `hasImages` first** via `read_the_fine_print {operation: "metadata"}`
  or a `paper_trail` hit's `images` array. Fishing costs a round trip.
- **`nodeIds` are PAGE nodes, not image ids** — one page can carry several
  images and you get all of them. Budget your 5 ids per page, not per figure.
- **"No images found" is not proof the page has none.** Bytes are read from this
  server's own disk, so a file never synced to this host is skipped even when
  metadata says `hasImages: true`. Fall back to the stored `description` and say
  the figure was unavailable rather than guessing at its contents.
- **Read the image, don't re-describe the caption.** If the description was
  enough, skip the call.

## Schema

| Field         | Type                     | Notes                                                                  |
| ------------- | ------------------------ | ---------------------------------------------------------------------- |
| `knowledgeId` | string (required)        | The PDF (from `paper_trail` hits or `roll_call`).                      |
| `nodeIds`     | string[] 1–5 (required)  | `:PageNode` `node_id` values from `paper_trail` / `read_the_fine_print`. |

**Max 5 node ids per call, enforced** — images are large, and a sixth id is
an error, not a truncation.

## Returns

Interleaved content blocks, ordered by page number:

```
--- Page 42 (node: <node_id>) ---
<image block: base64 data + mimeType>
Description: <the indexed description of that image>
```

PNG, JPEG, GIF, WebP, SVG and BMP are recognised; anything else is served as
`image/png`. Pages with no images are skipped silently — when nothing at all
resolves you get the single line `No images found for the given pages in
<knowledgeId>`.

## Rules

- **Check `hasImages` first.** Call `read_the_fine_print {operation:
  "metadata"}` (or read a `paper_trail` hit's `images` array) and only pass
  node ids where images actually exist. Fishing costs a round trip and
  returns the "no images" line.
- **`nodeIds` are PAGE nodes, not image ids.** One page can carry several
  images; you get all of them for each id you pass. There is no way to ask
  for one image on a page — budget your 5 ids per page, not per figure.
- **"No images found" is not proof the page has none.** The bytes are read
  from this server's own disk at
  `{KNOWLEDGE_BASE_PATH}/orgs/{orgId}/pdf/v2/{knowledgeId}/meta-output/…`,
  using the relative path stored on the page. A file that was never synced to
  this host — or an ingest whose meta-output has been cleaned up — is skipped
  with a warning in the server log, so a page whose metadata says
  `hasImages: true` can still come back empty. Fall back to the image
  `description` from `paper_trail` / `read_the_fine_print` and say the figure
  was unavailable rather than guessing at its contents.
- **Access is scoped by the API key.** A `knowledgeId` outside the key's
  allowed set is refused by name — take ids from `roll_call` / `paper_trail`
  rather than from memory of another session.
- **Read the image, don't re-describe the caption.** The whole point of the
  call is that the description was insufficient. If the description was
  enough, skip the call.

## Where it sits

```
paper_trail                  → find pages (each hit carries node_id + images[])
read_the_fine_print metadata → confirm hasImages on the pages you care about
mugshot                      → the actual images, ≤5 pages per call
```

## See also

- PDF workflow recipe: [plumbline-pdf.md](plumbline://skills/plumbline/plumbline-pdf.md)
- Page discovery: [paper-trail.md](plumbline://skills/plumbline/paper-trail.md)
- Page text + `hasImages`: [read-the-fine-print.md](plumbline://skills/plumbline/read-the-fine-print.md)
