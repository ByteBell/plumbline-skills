#!/usr/bin/env node
// plumbline — install the Plumbline commands and MCP server into Claude Code, Codex and OpenCode.
//
//   plumbline install   --url <stack url> --key <mcp_ key> [--agents claude,codex,opencode] [--project <dir>]
//   plumbline uninstall                                   [--agents claude,codex,opencode] [--project <dir>]
//
// JSON and TOML configs are merged, never replaced: only the entry named "plumbline" is written or removed.
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMANDS = join(PKG, "plugins/plumbline/commands");
const VERSION = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")).version;
const AGENTS = ["claude", "codex", "opencode"];
const WINDOWS = process.platform === "win32";

const HELP = `plumbline ${VERSION} — Plumbline commands for Claude Code, OpenCode and Codex

  plumbline install   --url <stack url> --key <mcp_ key> [--agents claude,codex,opencode] [--project <dir>]
  plumbline uninstall                                   [--agents claude,codex,opencode] [--project <dir>]
  plumbline help [verify | blast | resolve-issue | install]

After installing, inside your agent, in a checkout of an indexed repository:

  /plumbline-verify [from] [to]             review a change against every caller in every indexed repo
  /plumbline-blast <file | symbol | code>   what depends on this code, and what breaks if it changes
  /plumbline-resolve-issue <issue>          find the affected files, write failing tests, fix, test

  Codex names them /prompts:plumbline-verify, /prompts:plumbline-blast, /prompts:plumbline-resolve-issue.

Run \`plumbline help <command>\` for arguments, examples and what the output looks like.
`;

const TOPICS = {
  install: `plumbline install — put the commands and the Plumbline MCP server into your agents

  plumbline install --url <stack url> --key <mcp_ key> [--agents claude,codex,opencode] [--project <dir>]
  plumbline uninstall                                  [--agents claude,codex,opencode] [--project <dir>]

  --url      the Plumbline address you open the dashboard on, e.g. https://plumbline.acme.com.
             The MCP endpoint is <url>/mcp.
  --key      an mcp_ key: dashboard → MCP keys → copy. A login token is refused.
  --agents   which agents; default: every one of claude, codex, opencode on your PATH.
  --project  install into one repository instead of your user config (Claude Code and OpenCode:
             <dir>/.claude/commands + .mcp.json, <dir>/.opencode/command + opencode.json).
             Codex has no per-project prompts, so Codex is always installed for your user.

  The key is checked against <url>/mcp before anything is written. Only the entry named
  "plumbline" is added to, or removed from, each agent's config — nothing else in it changes.
  Restart the agent afterwards so it loads the MCP server.

  Where things go (user install):
    Claude Code   ~/.claude/commands/plumbline-*.md      MCP via \`claude mcp add -s user\`
    OpenCode      ~/.config/opencode/command/            ~/.config/opencode/opencode.json
    Codex         ~/.codex/prompts/                      ~/.codex/config.toml [mcp_servers.plumbline]

  Update:     npm install -g github:ByteBell/plumbline-skills, then run install again
  Remove:     plumbline uninstall

  Errors:
    answered HTTP 401 to that key   wrong or deactivated key — copy it again from MCP keys
    cannot reach …/mcp              wrong --url, or the stack is down
    not plain JSON (comments?)      your opencode.json has comments; add the entry by hand
`,

  verify: `/plumbline-verify [from] [to] — review a change against the code graph

  Codex: /prompts:plumbline-verify [from] [to]

  Arguments (commits, tags or branch names — it never asks which branch):
    (none)              your last commit: HEAD~1 → HEAD
    <from>              <from> → HEAD
    <from> <to>         <from> → <to>
    <from>..<to>        the same, as one range

  Examples:
    /plumbline-verify
    /plumbline-verify main
    /plumbline-verify v5.0.14 v5.0.15
    /plumbline-verify a1b2c3d..HEAD

  What it does:
    1. Reads the change from your checkout with git — every file, every hunk.
    2. Asks the graph who depends on each changed function, file and exported name —
       in this repository and in every other indexed repository.
    3. Reads the real source of those callers before claiming anything breaks.
    4. Gives every hunk a verdict: bug, breaks-consumer, duplicate, convention, rewrite — or clean.
  Lockfiles and generated files (package-lock.json, pnpm-lock.yaml, go.sum, dist/, …) are left
  out and named in the output. Uncommitted changes are not part of the review.

  Output — a GitHub-style review:
    Review of <to> → <from>  (<n> files, <n> hunks)
    Findings        path:line  ✖ severity  kind — why, the evidence read, a \`suggestion\` block
    Checked         every hunk with what was checked
    ✖ n problems (blocker, major, minor) · n hunks clean
    Verdict: Approve | Comment | Request changes

  Needs: this repository indexed in Plumbline. The two commits do not need to be indexed —
  the output says how far the indexed commit is from them.
  Measured on a 15-file, 28-hunk range: about 2 minutes.
`,

  blast: `/plumbline-blast <target> — what depends on this code, and what breaks if it changes

  Codex: /prompts:plumbline-blast <target>

  <target> is one of:
    a file              src/api/orders.ts
    a file + lines      src/api/orders.ts:40-88     (only the functions inside that range)
    a symbol            createOrder    or    OrderService.submit
    pasted code         paste a function or block — it finds where that code lives first
    (nothing)           your uncommitted changes; if there are none, your last commit

  Examples:
    /plumbline-blast src/vanilla.ts
    /plumbline-blast src/middleware/persist.ts:340-360
    /plumbline-blast createStore
    /plumbline-blast export function combine(initialState, create) { … }

  What it does:
    1. Pins the target to the indexed graph (for pasted code: searches for it; code that is not in
       the graph yet is treated as new, and its impact is what it uses).
    2. Finds every file that imports, calls, implements the contract of, or shares a type with it —
       in this repository and every other indexed one, including through published packages.
    3. Reads the exact line in each dependent before listing it; anything it cannot confirm goes
       under "Possible", never with a guessed line number.

  Output — like your IDE's Find All References:
    Impact of <target> — indexed at <commit>, your HEAD is n commits ahead
    Direct                              path:line   the verbatim source line
    Through a published package         other repositories, via the package they import
    Possible                            shared type or keyword, no call confirmed
    n references · n files confirmed · n possible

  Measured: about 1 minute for a file or a pasted function.
`,

  "resolve-issue": `/plumbline-resolve-issue <issue> — from an issue to a tested fix in your working tree

  Codex: /prompts:plumbline-resolve-issue <issue>

  <issue> is one of:
    the issue text      what is wrong, in your words or the reporter's
    a GitHub issue      https://github.com/acme/app/issues/412   or   #412   (read with the gh CLI)
    (nothing)           it asks you for the issue — the only question it asks

  Examples:
    /plumbline-resolve-issue DevTools shows the wrong action name when the path contains a space
    /plumbline-resolve-issue https://github.com/acme/app/issues/412

  What it does, in order:
    A. Finds every file the issue touches through the graph — the code, the payload that builds the
       value, the tests and docs that encode the old behaviour — with the fewest searches, and draws
       how the behaviour flows through them.
    B. Writes tests FIRST, in the repository's own framework, and runs them. They must fail for the
       issue's reason. If they pass, the issue does not reproduce: it stops and shows you the test.
       Then it writes the fix, runs the new tests, the tests of every file it touched, and the
       typecheck/lint — up to five fix-and-run rounds.
    C. Reports.
  The fix is written by the model your agent runs. Nothing is committed or pushed; review the
  working tree and commit it yourself.

  Output:
    Resolved: yes | partly | no
    Change set      every affected file, its role, why — and the flow between them
    Tests written   what each asserts; the failing run before the fix, the passing run after
    Fix             what changed in each file
    Verified        every command it ran, with its result
    Not done        anything left

  Needs: this repository indexed in Plumbline, and its dependencies installed so tests can run.
  Your agent will ask before editing files and running commands unless you have allowed them.
  Measured on a one-file bug: about 6 minutes.
`,
};

const die = (msg) => {
  console.error(`plumbline: ${msg}`);
  process.exit(1);
};

function parse(argv) {
  const [action, ...rest] = argv;
  const opts = { action };
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (!["--url", "--key", "--agents", "--project"].includes(flag) || value === undefined) die(`unknown or empty option ${flag}\n\n${HELP}`);
    opts[flag.slice(2)] = value;
  }
  return opts;
}

const onPath = (bin) => spawnSync(WINDOWS ? "where" : "which", [bin], { stdio: "ignore" }).status === 0;

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: "utf8", shell: WINDOWS });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function readJson(file) {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8").trim();
  if (text === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    die(`${file} is not plain JSON (comments?) — add the plumbline entry by hand, or remove the comments and re-run`);
  }
}

function writePrivate(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  if (!WINDOWS) chmodSync(file, 0o600);
}

// The command files ship as <name>.md; each agent gets them as plumbline-<name>.md.
const commandFiles = () => readdirSync(COMMANDS).filter((f) => f.endsWith(".md"));

function putCommands(dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of commandFiles()) copyFileSync(join(COMMANDS, f), join(dir, `plumbline-${f}`));
}

function removeCommands(dir) {
  for (const f of commandFiles()) rmSync(join(dir, `plumbline-${f}`), { force: true });
}

// Codex: drop any [mcp_servers.plumbline] table (up to the next table header), optionally append ours.
function codexToml(file, table) {
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  const kept = [];
  let skip = false;
  for (const line of lines) {
    if (line.startsWith("[")) skip = line.trim() === "[mcp_servers.plumbline]";
    if (!skip) kept.push(line);
  }
  let text = kept.join("\n").replace(/\n+$/, "");
  if (table) text += `${text ? "\n\n" : ""}${table}`;
  writePrivate(file, `${text}\n`);
}

const tomlString = (s) => JSON.stringify(s); // a JSON string is a valid TOML basic string

async function checkKey(mcp, key) {
  let status;
  try {
    const res = await fetch(mcp, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "plumbline-install", version: VERSION } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    await res.body?.cancel();
  } catch (err) {
    die(`cannot reach ${mcp} (${err.cause?.code ?? err.message}) — is the stack running, and is --url right?`);
  }
  if (status !== 200) die(`${mcp} answered HTTP ${status} to that key — check --key`);
  console.log(`✓ ${mcp} accepts the key`);
}

function claude(action, { mcp, key, project }) {
  if (project) {
    const dir = join(project, ".claude/commands");
    const cfg = join(project, ".mcp.json");
    const json = readJson(cfg);
    json.mcpServers ??= {};
    if (action === "install") {
      putCommands(dir);
      json.mcpServers.plumbline = { type: "http", url: mcp, headers: { Authorization: `Bearer ${key}` } };
    } else {
      removeCommands(dir);
      delete json.mcpServers.plumbline;
    }
    writePrivate(cfg, `${JSON.stringify(json, null, 2)}\n`);
    return `${dir}, ${cfg}`;
  }
  // User scope lives in ~/.claude.json, which Claude Code owns — go through its CLI, never edit it.
  const dir = join(homedir(), ".claude/commands");
  if (!onPath("claude")) die("the claude CLI is not on PATH — install Claude Code, or use --project <dir>");
  run("claude", ["mcp", "remove", "-s", "user", "plumbline"]);
  if (action === "install") {
    putCommands(dir);
    const r = run("claude", ["mcp", "add", "--transport", "http", "-s", "user", "plumbline", mcp, "--header", `Authorization: Bearer ${key}`]);
    if (!r.ok) die(`claude mcp add failed: ${r.out}`);
  } else {
    removeCommands(dir);
  }
  return `${dir}, user MCP config`;
}

function opencode(action, { mcp, key, project }) {
  const base = project ?? join(homedir(), ".config/opencode");
  const dir = project ? join(project, ".opencode/command") : join(base, "command");
  const cfg = join(base, "opencode.json");
  if (!project && existsSync(join(base, "opencode.jsonc")) && !existsSync(cfg)) {
    die(`${join(base, "opencode.jsonc")} holds your OpenCode config — add the plumbline entry by hand`);
  }
  const json = readJson(cfg);
  json.mcp ??= {};
  if (action === "install") {
    putCommands(dir);
    json.mcp.plumbline = { type: "remote", url: mcp, enabled: true, headers: { Authorization: `Bearer ${key}` } };
  } else {
    removeCommands(dir);
    delete json.mcp.plumbline;
  }
  writePrivate(cfg, `${JSON.stringify(json, null, 2)}\n`);
  return `${dir}, ${cfg}`;
}

function codex(action, { mcp, key }) {
  const dir = join(homedir(), ".codex/prompts");
  const cfg = join(homedir(), ".codex/config.toml");
  if (action === "install") {
    putCommands(dir);
    codexToml(cfg, `[mcp_servers.plumbline]\nurl = ${tomlString(mcp)}\nhttp_headers = { Authorization = ${tomlString(`Bearer ${key}`)} }`);
  } else {
    removeCommands(dir);
    codexToml(cfg, null);
  }
  return `${dir}, ${cfg}`;
}

const NAMES = {
  claude: ["Claude Code", "/plumbline-verify /plumbline-blast /plumbline-resolve-issue"],
  opencode: ["OpenCode", "/plumbline-verify /plumbline-blast /plumbline-resolve-issue"],
  codex: ["Codex", "/prompts:plumbline-verify /prompts:plumbline-blast /prompts:plumbline-resolve-issue"],
};

function help(topic) {
  if (topic === undefined) return console.log(HELP);
  const key = topic.replace(/^\/?(prompts:)?(plumbline-)?/, "");
  if (!(key in TOPICS)) die(`no help for "${topic}" — try: ${Object.keys(TOPICS).join(", ")}`);
  console.log(TOPICS[key]);
}

async function main() {
  const argv = process.argv.slice(2);
  if (["help", "--help", "-h"].includes(argv[0])) return help(argv[1]);
  if (argv[0] === "--version" || argv[0] === "-v") return console.log(VERSION);
  const opts = parse(argv);
  if (!["install", "uninstall"].includes(opts.action)) return console.log(HELP);

  const agents = opts.agents ? opts.agents.split(",").map((a) => a.trim()) : AGENTS.filter(onPath);
  for (const a of agents) if (!AGENTS.includes(a)) die(`unknown agent "${a}" — claude, codex or opencode`);
  if (agents.length === 0) die("none of claude, codex, opencode is on PATH — name them with --agents");

  const project = opts.project ? resolve(opts.project) : undefined;
  if (project && !existsSync(project)) die(`--project ${project} does not exist`);

  const ctx = { project };
  if (opts.action === "install") {
    if (!opts.url || !opts.key) die(`install needs --url and --key\n\n${HELP}`);
    if (!opts.key.startsWith("mcp_")) die("--key must be an mcp_ key from the dashboard — a login token is refused by /mcp");
    ctx.mcp = `${opts.url.replace(/\/+$/, "")}/mcp`;
    ctx.key = opts.key;
    await checkKey(ctx.mcp, ctx.key);
  }

  const handlers = { claude, codex, opencode };
  for (const agent of agents) {
    const where = handlers[agent](opts.action, ctx);
    const [name, cmds] = NAMES[agent];
    console.log(opts.action === "install" ? `✓ ${name}: ${cmds}  (${where})` : `✓ ${name}: removed  (${where})`);
  }
  if (opts.action === "install") {
    console.log(
      "\nThe key is stored in plain text in the files above, readable only by you." +
        (project ? " Keep .mcp.json and opencode.json out of git." : ""),
    );
  }
}

await main();
