/**
 * Render the generated commands from the prompts the services run, so each algorithm has ONE source.
 *
 *   verify.md         ← chat-mcp   mcp-server/src/prompts/reviewPr.ts   (the `review_pr` MCP prompt)
 *   resolve-issue.md  ← public-agent src/prompt.ts                     (the public page's retrieval prompt)
 *
 * Never hand-edit those two files: change the service prompt and run this again. blast.md has no service
 * twin and is edited directly.
 *
 * Each rewrite of a service line must land exactly once. When a service prompt changes shape, this stops
 * instead of shipping a command that silently kept the old wording.
 *
 * Usage: bun sync-commands.ts [path-to-kube-package]
 */
import { join } from "node:path";

const ROOT = process.argv[2] ?? join(process.env.HOME ?? "", "programs/kube-package");
const OUT = join(import.meta.dir, "plugins/plumbline/commands");

function rewriter(name: string, text: string) {
  return {
    swap(from: string, to: string) {
      const n = text.split(from).length - 1;
      if (n !== 1) throw new Error(`${name}: expected 1 of ${JSON.stringify(from.slice(0, 70))}, found ${n}`);
      text = text.replace(from, to);
    },
    get text() {
      return text;
    },
  };
}

// ── verify.md ────────────────────────────────────────────────────────────────
const { reviewPrPrompt } = await import(join(ROOT, "services/chat-mcp/repo/mcp-server/src/prompts/reviewPr.ts"));
const review = rewriter("verify", reviewPrPrompt.messages[0].content.text);
review.swap(
  `THE CHANGE:  the current checkout (HEAD) against BASE. Check out the pull's branch
             first; this prompt reviews whatever HEAD is.`,
  `THE CHANGE:  TO against FROM, both fixed in V1. Never check anything out: every
             HEAD in a command below means TO, and git reads it where it is.`,
);
review.swap(
  `BASE:        {{base}}
             Empty means the remote's default branch: \`git symbolic-ref --short
             refs/remotes/origin/HEAD\` (e.g. origin/main).`,
  `BASE:        FROM, from V1.`,
);

await Bun.write(
  join(OUT, "verify.md"),
  `---
description: Verify the code change between two commits against the Plumbline graph — every hunk checked, every caller in every indexed repository
argument-hint: "[from] [to]  (default: HEAD~1 HEAD)"
---
PLUMBLINE VERIFY — arguments: $ARGUMENTS

V1. FROM and TO. Read the arguments as two commits, tags or branch names, or one FROM..TO
    range. None → FROM=HEAD~1, TO=HEAD. One → FROM=it, TO=HEAD. Do NOT ask the user which
    branch: resolve each with \`git rev-parse --verify <ref>^{commit}\`; if one does not
    resolve, stop and say which. Uncommitted changes are not part of the change — if
    \`git status --porcelain\` is non-empty, say so in one line and continue.
V2. THE REPOSITORY MUST BE INDEXED. roll_call, and find THIS repository on the roster by
    \`git remote get-url origin\`. Not there → stop and say: "This repository is not indexed
    in Plumbline, so its dependents are unknown — index it first." Only the repository has to
    be indexed, not FROM or TO: the review reads the change from git and the dependents from
    the indexed commit, and S5 below reports how far apart they are.
V3. GENERATED FILES ARE NOT REVIEWED. In S2 and S3, leave out lockfiles and other generated
    output — package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lock*, Cargo.lock, go.sum,
    poetry.lock, Gemfile.lock, composer.lock, *.min.js, *.map, dist/, build/ — with a git
    pathspec, e.g. \`-- . ':!package-lock.json' ':!pnpm-lock.yaml'\`. Name each one you
    left out in one line under the review header ("Not reviewed (generated): …"). A version
    change a lockfile records shows up in package.json / Cargo.toml / go.mod, which ARE reviewed.
V4. Run the review below with BASE = FROM and HEAD = TO.

${review.text}
`,
);

// ── resolve-issue.md ─────────────────────────────────────────────────────────
// The single-repository template: an issue is fixed in the checkout the agent stands in. Sentinels fill
// the slots the public runner fills from its request; R2 below tells the agent where each value comes from.
const { buildRetrievalPrompt } = await import(join(ROOT, "services/public-agent/src/prompt.ts"));
const find = rewriter(
  "resolve-issue",
  buildRetrievalPrompt([{ slug: "@@REPO@@", knowledgeId: "@@KID@@", commit: "@@COMMIT@@" }], "@@ISSUE@@"),
);
find.swap("REPOSITORY:  @@REPO@@", "REPOSITORY:  this checkout's repository — its knowledgeId from R2");
find.swap("COMMIT:      @@COMMIT@@", "COMMIT:      the COMMIT R2 settled on");
find.swap(
  `SURFACE:     the plumbline MCP server and nothing else — no filesystem, no shell, no
             web, no other server, no subagents. Every path you name must have come
             back from a plumbline call; reaching the answer by any other route
             voids the run.`,
  `SURFACE:     PHASE A is the plumbline MCP tools and nothing else — no filesystem
             search, no grep of the checkout. Every path you name must have come
             back from a plumbline call. The checkout, the shell and your editor are
             for PHASE B.`,
);
find.swap(
  `SCOPE:       ONE repository, the one above. It is the whole world for this task, and
             it is already applied to every call you make — you never pass a
             repository id, and a result is always about this repository.`,
  `SCOPE:       ONE repository, the one above. Nothing applies it for you. A search
             (stakeout, manhunt) takes it as repos=[{knowledgeId, commitHash: COMMIT}];
             every other call takes knowledgeId and commitHash as arguments.`,
);
find.swap(
  `QUESTION (a visitor's words about this repository — a behaviour, a design, or a
regression. It arrives as a SYMPTOM and withholds every identifier, which is the
point: the names are what you do not have yet):

@@ISSUE@@`,
  `QUESTION: the ISSUE from R1. It usually arrives as a SYMPTOM and withholds the
identifiers, which is the point: the names are what you do not have yet.`,
);
find.swap(
  `0.1  ONE REPOSITORY, APPLIED FOR YOU. There is no roll_call on this surface and you
     do not need one: you are never asked which repository to use, and every call
     you make is scoped to this one for you. It was confirmed to be in the graph
     before you were given this task, and the run would not have started otherwise.
     YOUR GROUND IS rap_sheet AT 0.3, which is scoped to this repository for you. It
     is the call that tells you what this repository actually DOES.`,
  `0.1  ONE REPOSITORY. roll_call already ran in R2 and named it. YOUR GROUND IS
     rap_sheet AT 0.3, with that knowledgeId. It is the call that tells you what
     this repository actually DOES.`,
);
find.swap(`exactly as written above; an abbreviated hash is`, `exactly as R2 settled it; an abbreviated hash is`);
find.swap(
  `0.3  DO rap_sheet, no arguments beyond what is applied for you — one brief saying`,
  `0.3  DO rap_sheet(knowledgeId) — one brief saying`,
);
find.swap(
  `6.1  There is no report. The answer left with your confirm_file, propose_file and
     map_flow calls; nothing you write in a message is read.`,
  `6.1  The change set is your CONFIRM, PROPOSE and FLOW lines. PHASE B works from
     them and from nothing else.`,
);
find.swap(
  `6.5  Nothing left to confirm AND the chain closes: say so in one sentence and make
     no further calls.`,
  `6.5  Nothing left to confirm AND the chain closes: PHASE A is done. Go to PHASE B.`,
);

await Bun.write(
  join(OUT, "resolve-issue.md"),
  `---
description: Resolve an issue end to end — find every affected file through the Plumbline graph, write failing tests first, then the fix, then run the tests until they pass
argument-hint: "<issue text | GitHub issue URL or #number>"
---
PLUMBLINE RESOLVE ISSUE — arguments: $ARGUMENTS

Three phases, in order: A finds every file the issue touches, B writes the tests and then the
fix, C reports. Do not skip ahead: a fix written before its failing test is not a resolution.

R1. THE ISSUE. The arguments are the issue: its text, or a GitHub issue URL or #number — then
    \`gh issue view <n> --json title,body,comments\` in this checkout. Empty → ask the user for
    the issue; this is the only question you ask in the whole run.
R2. THE REPOSITORY MUST BE INDEXED. roll_call, and find THIS repository on the roster by
    \`git remote get-url origin\`: its knowledgeId and lastIndexedCommit. Not there → stop and
    say "This repository is not indexed in Plumbline — index it first."
    THE COMMIT. roll_call names only the newest indexed commit, but older ones may be indexed
    too, and the snapshot to read is the one the checkout stands on. When \`git rev-parse HEAD\`
    is not lastIndexedCommit, DO stakeout(query=<the issue's first words>,
    repos=[{knowledgeId, commitHash: <the full HEAD hash>}]): rows back → HEAD is indexed,
    and COMMIT = HEAD.
    An error or no rows → COMMIT = lastIndexedCommit. Say which in one line.
    When COMMIT is not HEAD and exists locally, \`git diff --stat <COMMIT> HEAD\` lists the
    files that differ between the graph and the checkout; PHASE B reads those from disk.
R3. The graph tools' confirm_file, propose_file and map_flow do NOT exist on this surface.
    Wherever PHASE A says to call one, write a line instead, and keep writing them as you go:
        CONFIRM  <path>:<start>-<end>  <VIOLATOR|OWNER|EVIDENCE>  <reason>
        PROPOSE  <path>  <purpose>
        FLOW     <from> → <to>  <effect>
    Every rule PHASE A sets for them still holds: never CONFIRM a file you have not read with
    the_receipts, never PROPOSE one that exists.

=============================== PHASE A — FIND EVERY AFFECTED FILE ===============================

${find.text}
=============================== PHASE B — TESTS FIRST, THEN THE FIX ===============================

Now the checkout. Read each CONFIRMED file from disk before editing it: the graph is at
lastIndexedCommit, the files are at HEAD, and R2 listed where they differ.

B1. HOW THIS REPOSITORY TESTS. Find the runner and the command from the repository itself
    (package.json scripts, pytest/tox config, go test, cargo test, Makefile, CI workflow) and
    the existing tests closest to the CONFIRMED files — PHASE A usually confirmed some.
    Write the exact command that runs one test file.
B2. WRITE THE TESTS FIRST. Tests that state what the ISSUE says should happen, in the
    repository's own framework and style, next to the tests that already cover those files.
    Cover the case the issue reports and the edges PHASE A's FLOW shows it passes through.
    Change no source file yet.
B3. RUN THEM AND WATCH THEM FAIL. They must fail, and for the issue's reason — a wrong value,
    a missing branch — not an import error, a typo or a missing fixture. Fix the test until
    its failure is the issue.
    They PASS before any fix → the issue does not reproduce as understood. Stop, show the
    test and its output, and say what you expected it to show. Do not write a fix.
B4. THE FIX. Change the CONFIRMED files, and create the PROPOSED ones, the least that makes
    the ISSUE's behaviour right. Follow the FLOW: a change at one end of an edge usually needs
    the other end. Match the code around it.
B5. RUN THE NEW TESTS until they pass, then the existing tests of every file you touched,
    then the repository's typecheck or lint if it has one. A failure is information: fix the
    SOURCE. Change a test you wrote only when it asserts something the issue does not say,
    and say so in C. At most five fix-and-run rounds; then stop and report where it stands.
B6. Nothing is committed and nothing is pushed. The change stays in the working tree.

=============================== PHASE C — REPORT ===============================

Never name a plumbline tool in the report. Paths are written path:line.

Resolved: <yes | partly | no> — <the issue in one line>

Change set — <n> files
  <path>:<start>-<end>   <role>   <reason>
  <path>                 new      <purpose>
Flow
  <from> → <to>   <effect, one line>

Tests written — <n>
  <test file>   <what it asserts>
  before the fix: <command> → <n> failed, because <the reason in the failure output>
  after the fix:  <command> → <n> passed

Fix
  <path>   <what changed and why, one line>

Verified
  <each command run in B5, with its result>

Not done
  <anything left, or "nothing">
`,
);

console.log(`rendered verify.md and resolve-issue.md into ${OUT}`);
