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

const HELP = `plumbline ${VERSION}

  plumbline install   --url <stack url> --key <mcp_ key> [--agents claude,codex,opencode] [--project <dir>]
  plumbline uninstall                                   [--agents claude,codex,opencode] [--project <dir>]

  --url      the Plumbline address, e.g. http://localhost:8081 — the MCP endpoint is <url>/mcp
  --key      an mcp_ key from the dashboard's MCP keys page
  --agents   which agents; default: every one of claude, codex, opencode found on PATH
  --project  install into one repository instead of your user config (Claude Code, OpenCode).
             Codex has no per-project prompts, so it is always installed for your user.

Commands it installs:
  Claude Code, OpenCode   /plumbline-verify   /plumbline-blast   /plumbline-resolve-issue
  Codex                   /prompts:plumbline-verify   /prompts:plumbline-blast   /prompts:plumbline-resolve-issue
`;

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

async function main() {
  const opts = parse(process.argv.slice(2));
  if (opts.action === "--version" || opts.action === "-v") return console.log(VERSION);
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
