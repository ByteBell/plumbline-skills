# plumbline-skills

Claude Code skills for the **Plumbline** code knowledge graph MCP server.

Install:

```
/plugin marketplace add ByteBell/plumbline-skills
/plugin install plumbline@plumbline
```

## Source of truth

**These files are a mirror. Do not hand-edit them.**

The authoritative copy lives in the MCP server repo and is what the running server
actually serves as resources:

```
mcp-server/skills/plumbline/          →  plumbline://skills/plumbline/<file>.md
```

Edit the skills there, then mirror into this repo with `./sync-skills.sh`.

### Why this rule exists

This repo previously carried a hand-maintained second copy under the old
`bytebell` name. The two copies drifted:

- every `bytebell://` resource URI in the mirror was dead — the server serves
  `plumbline://`, so a client following the mirror's instructions got `ENOENT`
  on every per-tool skill and on the mandatory session-start workflow recipe;
- the mirror fell four skills behind (`blueprint`, `kingpin`, `mugshot`,
  `paper-trail`) while its own routing and budget tables still referenced them;
- it was missing two guardrails the server had shipped, including the one
  requiring that "which files must change" be answered from more than a single
  search register.

An agent that loaded the mirror ran without the recipe and without those
guardrails, and had no way to tell. Mirroring mechanically is what prevents a
repeat.

## Layout

```
.claude-plugin/marketplace.json     marketplace definition
plugins/plumbline/
  .claude-plugin/plugin.json        plugin manifest
  skills/plumbline/                 24 skill files, mirrored from the server
```

## Licence

MIT
