# plumbline

Three commands for your coding agent, backed by the **Plumbline** code knowledge graph:

| Command | What it does |
| --- | --- |
| `/plumbline-verify [file \| directory \| pasted code \| from [to]]` | Reviews a file, every file of a directory, pasted code, or the change between two commits (default: your last commit) against every caller in every indexed repository. Every file is seeded. Output is a GitHub-style review. |
| `/plumbline-review-pr <PR URL \| #n> [more PRs]` | The same review for a GitHub, GitLab or Bitbucket pull request, fetched without switching your branch. Every file the PR changes is seeded. Several PRs across repositories are reviewed as one change. |
| `/plumbline-blast <file[:lines] \| directory \| symbol \| pasted code>` | What depends on this code, and what breaks if it changes — in the shape of your IDE's Find All References. A directory seeds every file under it. |
| `/plumbline-resolve-issue <issue text \| issue URL>` | Finds every file the issue touches, writes failing tests first, then the fix, then runs the tests until they pass. Nothing is committed. |

They work in **Claude Code**, **OpenCode** and **Codex**, with whatever model your agent runs.
`verify`, `review-pr` and `resolve-issue` take `--repos all | api,web | api=<path>` to work across
repositories — the search covers all of them, and edits and tests happen in each one's checkout
(`plumbline help repos`).

## Install

You need Node 18+, a running Plumbline stack, and an MCP key from its dashboard (**MCP keys**).
The repository you run the commands in must be indexed in that stack.

```sh
npm install -g github:ByteBell/plumbline-skills
plumbline install --url http://localhost:8081 --key mcp_…
```

That installs into every agent it finds on your PATH, for your user — so the commands are in every
session, in any directory; they work wherever the repository is indexed. `npm install -g` alone only
puts the `plumbline` tool on your PATH: `plumbline install` is what adds the commands, and it copies
them, so after updating the package run `plumbline install` again. To point at a different stack or
use a new key, run `plumbline install` again with the new `--url` / `--key` and restart the agent. Options:

```sh
plumbline install --url … --key … --agents claude,opencode     # only these agents
plumbline install --url … --key … --project ~/code/my-repo     # only this repository
plumbline uninstall                                            # remove everything it added
```

Then, in your agent:

| Agent | Run |
| --- | --- |
| Claude Code | `/plumbline-verify`, `/plumbline-blast src/api.ts`, `/plumbline-resolve-issue <issue>` |
| OpenCode | the same names |
| Codex | `/prompts:plumbline-verify`, `/prompts:plumbline-blast`, `/prompts:plumbline-resolve-issue` |

Restart the agent after installing so it picks up the MCP server.

`plumbline help` lists everything; `plumbline help verify`, `plumbline help blast` and
`plumbline help resolve-issue` give each command's arguments, examples, what it does and what the
output looks like. In Claude Code, typing `/plumbline-` shows the three with their argument hints.

The key is written in plain text into your agent's config, readable only by you. With `--project`,
keep `.mcp.json` and `opencode.json` out of git.

## For maintainers

`verify.md` and `resolve-issue.md` are **generated — never edit them**. Each is a service prompt with
a header for a local agent:

```text
verify.md         ← services/chat-mcp/repo/mcp-server/src/prompts/reviewPr.ts   (review_pr)
resolve-issue.md  ← services/public-agent/src/prompt.ts                         (retrieval prompt)
```

Change the service prompt, then `bun sync-commands.ts [path-to-kube-package]`. `blast.md` is edited
directly. Developers install straight from this repository, so a pushed commit is a release.

The skills under `plugins/plumbline/skills/` are the Claude Code plugin (`/plugin marketplace add
ByteBell/plumbline-skills`, then `/plugin install plumbline@plumbline`). They mirror the MCP server's
`skills/plumbline/` — update them with `./sync-skills.sh`, never by hand: a hand-edited copy drifted
once and shipped dead `bytebell://` URIs.

```text
bin/plumbline.mjs                   the installer (npm bin)
sync-commands.ts                    renders the generated commands
plugins/plumbline/commands/         verify.md, blast.md, resolve-issue.md
plugins/plumbline/skills/plumbline/ skill files, mirrored from the server
plugins/plumbline/.claude-plugin/   plugin manifest
.claude-plugin/marketplace.json     marketplace definition
```

## Licence

MIT
