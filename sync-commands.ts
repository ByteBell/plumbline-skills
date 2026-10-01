/**
 * Render the generated commands from the prompts the services run, so each algorithm has ONE source.
 *
 *   verify.md         ← chat-mcp   mcp-server/src/prompts/reviewPr.ts   (the `review_pr` MCP prompt)
 *   review-pr.md      ← the same review text, with a header that fetches a PR / MR instead
 *   resolve-issue.md  ← public-agent src/prompt.ts                     (the retrieval prompt, both the
 *                                                                        single- and the cross-repository one)
 *
 * Never hand-edit those three files: change the service prompt, or the headers here, and run this again.
 * blast.md has no service twin and is edited directly.
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

// ── Shared header pieces ─────────────────────────────────────────────────────

/** `--repos` and the ROSTER, for every command. `ranges` adds the per-repository change (@from..to). */
const repos = (step: string, ranges: boolean) => `${step}. THE ROSTER — which repositories this run covers. roll_call first: it lists every indexed
    repository. Find THIS one by \`git remote get-url origin\`; not listed → stop and say
    "This repository is not indexed in Plumbline — index it first."
    Without --repos the ROSTER is this repository alone. --repos may appear anywhere in the
    arguments; it is not part of anything else you read from them:
        --repos all              every repository roll_call lists
        --repos <e>,<e>,…        this repository plus these
      e = <repo>[=<path>]${ranges ? "[@<from>..<to>]" : ""}
        <repo>        a roll_call repository: its full slug (acme/api) or the last segment (api).
                      One roll_call does not list → stop and say which.
        =<path>       its local checkout. Default: the sibling folder ../<last segment>, if it
                      is a git checkout whose origin is that repository. None → that repository
                      is GRAPH ONLY: searched and read through Plumbline, never edited or run.${
                        ranges
                          ? `
        @<from>..<to> that repository's own change, reviewed together with this one's as ONE
                      change. Resolved with git in its checkout, like FROM and TO here.`
                          : ""
                      }
    THE COMMIT of each repository: roll_call names only its newest indexed commit, but older
    ones may be indexed too, and the snapshot to read is the one its checkout stands on. When a
    checkout's HEAD is not that newest commit, DO stakeout(query=<a few words of the task>,
    repos=[{knowledgeId, commitHash: <the full HEAD hash>}]): rows back → that HEAD is indexed
    and is the COMMIT; an error or no rows → the newest indexed commit is. Graph-only
    repositories use the newest indexed commit.
    Write the ROSTER once, and say in one line per repository which commit it reads:
        | repository | knowledgeId | commit | checkout |
    CALLS: a SEARCH (stakeout, manhunt, cross_repo_lookup, dragnet) takes repos = EVERY ROSTER
    row, [{knowledgeId, commitHash}, …] — one call covers them all. Every other call opens ONE
    repository: its knowledgeId and its commitHash. git runs in that repository's checkout
    (\`git -C <checkout>\`). Where a checkout's HEAD is not its COMMIT, \`git -C <checkout> diff
    --stat <COMMIT> HEAD\` lists the files that differ between the graph and the disk.`;

const generated = (step: string, where: string) => `${step}. GENERATED FILES ARE NOT REVIEWED. In ${where}, leave out lockfiles and other generated
    output — package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lock*, Cargo.lock, go.sum,
    poetry.lock, Gemfile.lock, composer.lock, *.min.js, *.map, dist/, build/ — with a git
    pathspec, e.g. \`-- . ':!package-lock.json' ':!pnpm-lock.yaml'\`. Name each one you
    left out in one line under the review header ("Not reviewed (generated): …"). A version
    change a lockfile records shows up in package.json / Cargo.toml / go.mod, which ARE reviewed.`;

const several = (step: string) => `${step}. SEVERAL CHANGES ARE ONE CHANGE. When more than one ROSTER repository carries a change,
    run S1–S3 below in EACH repository's checkout (\`git -C <checkout>\`), write its files as
    <repo>/<path> and its hunks as <repo>:F<n>.H<n>, and review them TOGETHER: a hunk in one
    repository is often the consumer, or the contract, of a hunk in another — the pairing is the
    finding nobody reviewing one repository can make. S4 takes each repository's COMMIT from the
    ROSTER instead of roll_call. SCOPE below is the ROSTER when --repos is given.`;

// ── The review text: verify.md and review-pr.md ─────────────────────────────
const { reviewPrPrompt } = await import(join(ROOT, "services/chat-mcp/repo/mcp-server/src/prompts/reviewPr.ts"));
const review = rewriter("review", reviewPrPrompt.messages[0].content.text);
review.swap(
  `THE CHANGE:  the current checkout (HEAD) against BASE. Check out the pull's branch
             first; this prompt reviews whatever HEAD is.`,
  `THE CHANGE:  TO against FROM, fixed in the header above. Never check anything out:
             every HEAD in a command below means TO, and git reads it where it is.`,
);
review.swap(
  `BASE:        {{base}}
             Empty means the remote's default branch: \`git symbolic-ref --short
             refs/remotes/origin/HEAD\` (e.g. origin/main).`,
  `BASE:        FROM, fixed in the header above.`,
);

// The commands START FROM THE SEEDING STAGE: every file is a seed, seeded before any judgement about
// it. The service prompt folds each file when its turn comes (2.3); the commands fold every seed up
// front — a TARGET's unchanged files included — and 2.3 then reads the rows SEEDING wrote.
review.swap(
  `---- STEP 0 — GROUND ----`,
  `---- SEEDING — where this run starts. EVERY file is a seed. ----
SD1. SEEDS[] = every file in the index (S2), whatever its status — and, when the
     header names a TARGET (a file, a directory or pasted code), every file of
     that target, changed or not. Write the list down with its count. No file is
     left out because its change looks cosmetic or internal: that is judged on
     the rows, after seeding, never before it.
SD2. FOR EACH seed the graph holds: DO collateral_damage(relativePath,
     lens=['imports','callers','dependencies','contracts','types','surfaces'],
     limit=100) and follow pagination.hasNextPage to the last page. Independent
     seeds go in ONE turn; a long list goes in batches of about ten, one batch
     after another, until the last seed is done. An ADDED file is not in the
     graph yet: record it as a NEW seed and seed nothing for it.
SD3. Write EDGES[]: one entry per seed — each dependent file, with the lens that
     linked it and its \`via\` names. Rows under test, doc, example, fixture or
     config paths are dropped and counted, unless the user asked for them.
     CHECK THE PATH ON EVERY ROW, as 2.3 says: a path that cannot belong to this
     repository leaked from another one.
SD4. ASSERT before STEP 0: seeds seeded + NEW seeds == |SEEDS[]|. A seed with no
     call is a file whose consumers this review silently leaves out. Do not stop
     at the first seed that returns rows; the stage ends with the last seed.

---- STEP 0 — GROUND ----`,
);
review.swap(
  `EDGES[]     { path, lens, direction, via, verdict } — every file the graph links
            to the file you are on, and what the pair check concluded, STEP 2`,
  `EDGES[]     { seed, path, lens, direction, via, verdict } — every file the graph
            links to each seed. Written at SEEDING; STEP 2's pair check fills in
            the verdict`,
);
review.swap(
  `2.3  FOLD THE SEED. DO collateral_damage(relativePath, lens=['imports',
     'callers','dependencies','contracts','types','surfaces'], limit=100) —
     when you start on the file, beside 1.1: it takes the path, not case_file's
     answer.`,
  `2.3  EDGES[] ALREADY HOLDS THIS FILE'S ROWS — SEEDING folded every seed through
     these six lenses. Read them now; call collateral_damage again here only
     for a file SEEDING could not know of (a re-export file, below).`,
);

await Bun.write(
  join(OUT, "verify.md"),
  `---
description: Verify code against the Plumbline graph — a file, a directory, pasted code, or the change between two commits; every file seeded, every hunk checked, every caller in every indexed repository
argument-hint: "[file | directory | pasted code | from [to]] [--repos all | repo[=path][@from..to],…]"
---
PLUMBLINE VERIFY — arguments: $ARGUMENTS

V1. WHAT TO VERIFY. Read the arguments (after taking out --repos). The FIRST argument is tried
    as a path before anything else:
      a. a FILE that exists (\`test -f\`)       → the TARGET is that file.
      b. a DIRECTORY that exists (\`test -d\`)  → the TARGET is every source file under it:
                                               \`git ls-files -- <path>\`. Write the list
                                               down with its count.
      c. two commits, tags or branch names, or one FROM..TO range → that change.
         One ref → FROM=it, TO=HEAD. Do NOT ask the user which branch: resolve each with
         \`git rev-parse --verify <ref>^{commit}\`; if one does not resolve, stop and say which.
      d. nothing → FROM=HEAD~1, TO=HEAD.
      e. anything else is PASTED CODE. Do not ask where it came from: run manhunt and
         shakedown on its two most specific identifiers and confirm the unit with
         the_receipts. Its file is the TARGET, and the pasted text is that unit's new
         version — one hunk, F1.H1, judged against the base unit. Nothing matches → it is
         new code: the TARGET is the files of the names it calls, imports or extends.
    WITH A TARGET (a, b, e) there is no FROM..TO to resolve: FROM is this repository's COMMIT
    from the ROSTER (V2) and TO is the working tree. S1's MERGE_BASE is that COMMIT; S2 is
    \`git diff --no-renames --name-status <COMMIT> -- <the target's paths>\`; S3's DIFF is
    \`git diff -U5 <COMMIT> -- <path>\`; wherever a command below says HEAD, read the file on
    disk. READ EVERY FILE of the target and SEED EVERY ONE, whether or not it differs from
    the graph: a file with no difference has no hunks to clear, but it is still seeded and
    its dependents are still read. Work through the list to its last file.
    Without a target (c, d), uncommitted changes are not part of the change — if
    \`git status --porcelain\` is non-empty, say so in one line and continue.
${repos("V2", true)}
    Only the repositories have to be indexed, not FROM or TO: the review reads each change from
    git and the dependents from the graph, and S5 below reports how far apart they are.
${generated("V3", "S2 and S3")}
${several("V4")}
V5. Run the review below with BASE = FROM and HEAD = TO.

${review.text}
`,
);

await Bun.write(
  join(OUT, "review-pr.md"),
  `---
description: Review a pull / merge request (GitHub, GitLab or Bitbucket) against the Plumbline graph — several PRs across repositories are reviewed as one change
argument-hint: "<PR URL | #number> [more PR URLs] [--repos all | repo[=path],…]"
---
PLUMBLINE REVIEW PR — arguments: $ARGUMENTS

P1. THE PULL REQUESTS. Every argument outside --repos is one: a URL, or #<n> for this
    checkout's origin. None → ask the user for it; this is the only question you ask.
    The host, from the URL's shape:
        github.com/<o>/<r>/pull/<n>                   GitHub
        …/<group>/<r>/-/merge_requests/<n>            GitLab (gitlab.com or self-hosted)
        bitbucket.org/<ws>/<r>/pull-requests/<n>      Bitbucket
    Each PR belongs to the repository in its URL. Its CHECKOUT is this one when origin is that
    repository, else that repository's ROSTER checkout (P2); no checkout → stop for that PR and
    say: "No local checkout of <repo> — clone it next to this one, or pass --repos <repo>=<path>."
${repos("P2", false)}
    Every repository a PR belongs to is on the ROSTER, --repos or not.
P3. FETCH EACH PR WITHOUT SWITCHING ANYTHING. In its checkout (\`git -C <checkout>\`):
        GitHub     git fetch origin pull/<n>/head:refs/plumbline/pr-<n>
                   base branch: \`gh pr view <url> --json baseRefName,title -q .baseRefName\`
        GitLab     git fetch origin merge-requests/<n>/head:refs/plumbline/pr-<n>
                   base branch: \`glab mr view <n> -F json\` → target_branch
        Bitbucket  curl -s https://api.bitbucket.org/2.0/repositories/<ws>/<r>/pullrequests/<n>
                   (with -H "Authorization: Bearer $BITBUCKET_TOKEN" for a private repository)
                   → source.branch.name, source.repository.full_name, destination.branch.name;
                   git fetch <the source repository's clone URL> <source branch>:refs/plumbline/pr-<n>
    No gh / glab, or the call fails → the base branch is the remote's default
    (\`git symbolic-ref --short refs/remotes/origin/HEAD\`); say so in the review header.
    Then \`git fetch origin <base>\`, and:
        TO   = refs/plumbline/pr-<n>
        FROM = \`git merge-base origin/<base> refs/plumbline/pr-<n>\`
    That FROM..TO is the PR's change in that repository, exactly as its host shows it.
${generated("P4", "S2 and S3")}
${several("P5")}
    Several PR URLs are one change split across repositories — this is that case.
P6. Run the review below with BASE = FROM and HEAD = TO, per PR. The review header names each
    PR by its URL and title instead of "HEAD → <BASE>".
P7. When the review is written, delete the refs you made: \`git -C <checkout> update-ref -d
    refs/plumbline/pr-<n>\`. Nothing else in any checkout changes.

${review.text}
`,
);

// ── resolve-issue.md ─────────────────────────────────────────────────────────
// Both public-agent templates, rendered with sentinels in the slots its runner fills from a request.
const { buildRetrievalPrompt } = await import(join(ROOT, "services/public-agent/src/prompt.ts"));

// A1 — one repository.
const one = rewriter(
  "resolve-issue/A1",
  buildRetrievalPrompt([{ slug: "@@REPO@@", knowledgeId: "@@KID@@", commit: "@@COMMIT@@" }], "@@ISSUE@@"),
);
one.swap("REPOSITORY:  @@REPO@@", "REPOSITORY:  this checkout's repository — its ROSTER row from R2");
one.swap("COMMIT:      @@COMMIT@@", "COMMIT:      its commit from the ROSTER");
one.swap(
  `SURFACE:     the plumbline MCP server and nothing else — no filesystem, no shell, no
             web, no other server, no subagents. Every path you name must have come
             back from a plumbline call; reaching the answer by any other route
             voids the run.`,
  `SURFACE:     PHASE A is the plumbline MCP tools and nothing else — no filesystem
             search, no grep of the checkout. Every path you name must have come
             back from a plumbline call. The checkout, the shell and your editor are
             for PHASE B.`,
);
one.swap(
  `SCOPE:       ONE repository, the one above. It is the whole world for this task, and
             it is already applied to every call you make — you never pass a
             repository id, and a result is always about this repository.`,
  `SCOPE:       ONE repository, the one above. Nothing applies it for you. A search
             (stakeout, manhunt) takes it as repos=[{knowledgeId, commitHash: COMMIT}];
             every other call takes knowledgeId and commitHash as arguments.`,
);
one.swap(
  `QUESTION (a visitor's words about this repository — a behaviour, a design, or a
regression. It arrives as a SYMPTOM and withholds every identifier, which is the
point: the names are what you do not have yet):

@@ISSUE@@`,
  `QUESTION: the ISSUE from R1. It usually arrives as a SYMPTOM and withholds the
identifiers, which is the point: the names are what you do not have yet.`,
);
one.swap(
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
one.swap(`exactly as written above; an abbreviated hash is`, `exactly as the ROSTER has it; an abbreviated hash is`);
one.swap(
  `0.3  DO rap_sheet, no arguments beyond what is applied for you — one brief saying`,
  `0.3  DO rap_sheet(knowledgeId) — one brief saying`,
);
one.swap(
  `6.1  There is no report. The answer left with your confirm_file, propose_file and
     map_flow calls; nothing you write in a message is read.`,
  `6.1  The change set is your CONFIRM, PROPOSE and FLOW lines. PHASE B works from
     them and from nothing else.`,
);
one.swap(
  `6.5  Nothing left to confirm AND the chain closes: say so in one sentence and make
     no further calls.`,
  `6.5  Nothing left to confirm AND the chain closes: PHASE A is done. Go to PHASE B.`,
);

// A2 — several repositories.
const many = rewriter(
  "resolve-issue/A2",
  buildRetrievalPrompt(
    [
      { slug: "@@R1@@", knowledgeId: "@@K1@@", commit: "@@C1@@" },
      { slug: "@@R2@@", knowledgeId: "@@K2@@", commit: "@@C2@@" },
    ],
    "@@ISSUE@@",
  ),
);
many.swap(
  `SURFACE:   the plumbline MCP server. No other MCP server, no network, no subagents,
           no filesystem, no shell. Every path you name must have come back from a
           plumbline call; reaching the answer by any other route voids the run.`,
  `SURFACE:   PHASE A is the plumbline MCP tools and nothing else — no filesystem
           search, no grep of any checkout. Every path you name must have come back
           from a plumbline call. The checkouts, the shell and your editor are for
           PHASE B.`,
);
many.swap(`ROSTER:    2 repositories.`, `ROSTER:    the repositories in R2's ROSTER.`);
many.swap(
  `| repository | knowledgeId | commit |
|---|---|---|
| @@R1@@ | @@K1@@ | @@C1@@ |
| @@R2@@ | @@K2@@ | @@C2@@ |`,
  `           The ROSTER table you wrote in R2: repository, knowledgeId, commit.`,
);
many.swap(
  `           A SEARCH — stakeout, manhunt, cross_repo_lookup — ALREADY COVERS THE
           WHOLE ROSTER IN ONE CALL, each repository at its own commit. You do not
           name a repository on it, and running it once per repository is the same
           search repeated for one answer.`,
  `           A SEARCH — stakeout, manhunt, cross_repo_lookup — COVERS THE WHOLE
           ROSTER IN ONE CALL when you pass repos = every ROSTER row, each with its
           own commitHash. Running it once per repository is the same search
           repeated for one answer.`,
);
many.swap(
  `QUESTION (a visitor's words — it arrives as a SYMPTOM and withholds every
identifier, which is the point: the names are what you do not have yet):

@@ISSUE@@`,
  `QUESTION: the ISSUE from R1. It usually arrives as a SYMPTOM and withholds the
identifiers, which is the point: the names are what you do not have yet.`,
);
many.swap(
  `0.1  GROUNDED ALREADY. Every repository in the ROSTER is in the graph — each was
     confirmed against it before you were given this task, and the run would not
     have started otherwise. There is no roll_call on this surface: the table above
     IS the roster, and its knowledgeIds are the only ones any call will accept.
     Take each one VERBATIM — never guessed, never a repoId.`,
  `0.1  GROUNDED ALREADY. R2 checked every ROSTER repository against roll_call: the
     table IS the roster, and its knowledgeIds are the only ones to use. Take each
     one VERBATIM — never guessed, never a repoId.`,
);
many.swap(`exactly as written above; an abbreviated hash is`, `exactly as the ROSTER has it; an abbreviated hash is`);
many.swap(
  `ONE CALL COVERS EVERY ROSTER REPOSITORY, each at its own commit. You do
       not name a repository and you do not repeat the call per repository —`,
  `ONE CALL COVERS EVERY ROSTER REPOSITORY: repos = every ROSTER row, each
       with its own commitHash. You do not repeat the call per repository —`,
);
many.swap(
  `5.1  There is no report. The answer left with your confirm_file calls; nothing you
     write in a message is read.`,
  `5.1  The change set is your CONFIRM, PROPOSE and FLOW lines. PHASE B works from
     them and from nothing else.`,
);
many.swap(
  `5.6  Nothing left to confirm AND every LIST repository has been through 3.3, 3.4
     and STEP 4: say so in one sentence and make no further calls.`,
  `5.6  Nothing left to confirm AND every LIST repository has been through 3.3, 3.4
     and STEP 4: PHASE A is done. Go to PHASE B.`,
);

await Bun.write(
  join(OUT, "resolve-issue.md"),
  `---
description: Resolve an issue end to end — find every affected file through the Plumbline graph (one repository or several), write failing tests first, then the fix, then run the tests until they pass
argument-hint: "<issue text | issue URL or #number> [--repos all | repo[=path],…]"
---
PLUMBLINE RESOLVE ISSUE — arguments: $ARGUMENTS

Three phases, in order: A finds every file the issue touches, B writes the tests and then the
fix, C reports. Do not skip ahead: a fix written before its failing test is not a resolution.

R1. THE ISSUE. The arguments outside --repos are the issue: its text, or an issue URL or
    #number — then read it with the host's CLI (\`gh issue view <n> --json title,body,comments\`,
    \`glab issue view <n>\`), or its page. Empty → ask the user for the issue; this is the only
    question you ask in the whole run.
${repos("R2", false)}
R3. The graph tools' confirm_file, propose_file and map_flow do NOT exist on this surface.
    Wherever PHASE A says to call one, write a line instead, and keep writing them as you go:
        CONFIRM  <repo>/<path>:<start>-<end>  <VIOLATOR|OWNER|EVIDENCE>  <reason>
        PROPOSE  <repo>/<path>  <purpose>
        FLOW     <from> → <to>  <effect>
    (With a ROSTER of one, drop the <repo>/ prefix.) Every rule PHASE A sets for them still
    holds: never CONFIRM a file you have not read with the_receipts, never PROPOSE one that
    exists.
R4. PHASE A comes in two versions. A ROSTER of ONE repository → run A1. SEVERAL → run A2.
    Run exactly one of them and skip the other entirely.

=============================== PHASE A1 — ONE REPOSITORY: FIND EVERY AFFECTED FILE ===============================

${one.text}
=============================== PHASE A2 — SEVERAL REPOSITORIES: FIND EVERY AFFECTED FILE ===============================

${many.text}
=============================== PHASE B — TESTS FIRST, THEN THE FIX ===============================

Now the checkouts. Every CONFIRMED file is changed in ITS repository's checkout, and read from
that disk before it is edited: the graph is at the ROSTER commit, the files are at HEAD, and R2
listed where they differ. A CONFIRMED file in a GRAPH-ONLY repository is not edited — it goes
under "Not done" in C with what it needs. With several checkouts, run B1–B5 in each one that
changes (\`cd\` into it, or \`git -C\`), tests next to that repository's own code.

B1. HOW EACH REPOSITORY TESTS. Find the runner and the command from the repository itself
    (package.json scripts, pytest/tox config, go test, cargo test, Makefile, CI workflow) and
    the existing tests closest to the CONFIRMED files — PHASE A usually confirmed some.
    Write the exact command that runs one test file.
B2. WRITE THE TESTS FIRST. Tests that state what the ISSUE says should happen, in each
    repository's own framework and style, next to the tests that already cover those files.
    Cover the case the issue reports and the edges PHASE A's FLOW shows it passes through —
    where the FLOW crosses from one repository to another, test each side of that edge in its
    own repository. Change no source file yet.
B3. RUN THEM AND WATCH THEM FAIL. They must fail, and for the issue's reason — a wrong value,
    a missing branch — not an import error, a typo or a missing fixture. Fix the test until
    its failure is the issue.
    They ALL PASS before any fix → the issue does not reproduce as understood. Stop, show the
    tests and their output, and say what you expected them to show. Do not write a fix.
B4. THE FIX. Change the CONFIRMED files, and create the PROPOSED ones, the least that makes
    the ISSUE's behaviour right. Follow the FLOW: a change at one end of an edge usually needs
    the other end, in whichever repository it lives. Match the code around it.
B5. RUN THE NEW TESTS until they pass, then the existing tests of every file you touched,
    then each repository's typecheck or lint if it has one. A failure is information: fix the
    SOURCE. Change a test you wrote only when it asserts something the issue does not say,
    and say so in C. At most five fix-and-run rounds; then stop and report where it stands.
B6. Nothing is committed and nothing is pushed. The change stays in each working tree.

=============================== PHASE C — REPORT ===============================

Never name a plumbline tool in the report. Paths are written path:line, prefixed <repo>/ when
the ROSTER has several repositories.

Resolved: <yes | partly | no> — <the issue in one line>
Repositories: <each ROSTER repository, its commit, and "edited" / "unchanged" / "graph only">

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
  <anything left — including every file in a graph-only repository — or "nothing">
`,
);

console.log(`rendered verify.md, review-pr.md and resolve-issue.md into ${OUT}`);
