---
description: Verify code against the Plumbline graph — a file, a directory, pasted code, or the change between two commits; every file seeded, every hunk checked, every caller in every indexed repository
argument-hint: "[file | directory | pasted code | from [to]] [--repos all | repo[=path][@from..to],…]"
---
PLUMBLINE VERIFY — arguments: $ARGUMENTS

V1. WHAT TO VERIFY. Read the arguments (after taking out --repos). The FIRST argument is tried
    as a path before anything else:
      a. a FILE that exists (`test -f`)       → the TARGET is that file.
      b. a DIRECTORY that exists (`test -d`)  → the TARGET is every source file under it:
                                               `git ls-files -- <path>`. Write the list
                                               down with its count.
      c. two commits, tags or branch names, or one FROM..TO range → that change.
         One ref → FROM=it, TO=HEAD. Do NOT ask the user which branch: resolve each with
         `git rev-parse --verify <ref>^{commit}`; if one does not resolve, stop and say which.
      d. nothing → FROM=HEAD~1, TO=HEAD.
      e. anything else is PASTED CODE. Do not ask where it came from: run manhunt and
         shakedown on its two most specific identifiers and confirm the unit with
         the_receipts. Its file is the TARGET, and the pasted text is that unit's new
         version — one hunk, F1.H1, judged against the base unit. Nothing matches → it is
         new code: the TARGET is the files of the names it calls, imports or extends.
    WITH A TARGET (a, b, e) there is no FROM..TO to resolve: FROM is this repository's COMMIT
    from the ROSTER (V2) and TO is the working tree. S1's MERGE_BASE is that COMMIT; S2 is
    `git diff --no-renames --name-status <COMMIT> -- <the target's paths>`; S3's DIFF is
    `git diff -U5 <COMMIT> -- <path>`; wherever a command below says HEAD, read the file on
    disk. READ EVERY FILE of the target and SEED EVERY ONE, whether or not it differs from
    the graph: a file with no difference has no hunks to clear, but it is still seeded and
    its dependents are still read. Work through the list to its last file.
    Without a target (c, d), uncommitted changes are not part of the change — if
    `git status --porcelain` is non-empty, say so in one line and continue.
V2. THE ROSTER — which repositories this run covers. roll_call first: it lists every indexed
    repository. Find THIS one by `git remote get-url origin`; not listed → stop and say
    "This repository is not indexed in Plumbline — index it first."
    Without --repos the ROSTER is this repository alone. --repos may appear anywhere in the
    arguments; it is not part of anything else you read from them:
        --repos all              every repository roll_call lists
        --repos <e>,<e>,…        this repository plus these
      e = <repo>[=<path>][@<from>..<to>]
        <repo>        a roll_call repository: its full slug (acme/api) or the last segment (api).
                      One roll_call does not list → stop and say which.
        =<path>       its local checkout. Default: the sibling folder ../<last segment>, if it
                      is a git checkout whose origin is that repository. None → that repository
                      is GRAPH ONLY: searched and read through Plumbline, never edited or run.
        @<from>..<to> that repository's own change, reviewed together with this one's as ONE
                      change. Resolved with git in its checkout, like FROM and TO here.
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
    (`git -C <checkout>`). Where a checkout's HEAD is not its COMMIT, `git -C <checkout> diff
    --stat <COMMIT> HEAD` lists the files that differ between the graph and the disk.
    Only the repositories have to be indexed, not FROM or TO: the review reads each change from
    git and the dependents from the graph, and S5 below reports how far apart they are.
V3. GENERATED FILES ARE NOT REVIEWED. In S2 and S3, leave out lockfiles and other generated
    output — package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lock*, Cargo.lock, go.sum,
    poetry.lock, Gemfile.lock, composer.lock, *.min.js, *.map, dist/, build/ — with a git
    pathspec, e.g. `-- . ':!package-lock.json' ':!pnpm-lock.yaml'`. Name each one you
    left out in one line under the review header ("Not reviewed (generated): …"). A version
    change a lockfile records shows up in package.json / Cargo.toml / go.mod, which ARE reviewed.
V4. SEVERAL CHANGES ARE ONE CHANGE. When more than one ROSTER repository carries a change,
    run S1–S3 below in EACH repository's checkout (`git -C <checkout>`), write its files as
    <repo>/<path> and its hunks as <repo>:F<n>.H<n>, and review them TOGETHER: a hunk in one
    repository is often the consumer, or the contract, of a hunk in another — the pairing is the
    finding nobody reviewing one repository can make. S4 takes each repository's COMMIT from the
    ROSTER instead of roll_call. SCOPE below is the ROSTER when --repos is given.
V5. Run the review below with BASE = FROM and HEAD = TO.

TRY TO FINISH THE REVIEW IN THE MINIMUM TOOL CALLS POSSIBLE.

CODE REVIEW TASK — review ONE pull request against the code graph, running the
algorithm below in order.

THE CHANGE:  TO against FROM, fixed in the header above. Never check anything out:
             every HEAD in a command below means TO, and git reads it where it is.
BASE:        FROM, fixed in the header above.

---- SETUP — run these, in this order. Nothing else is needed to start. ----
S1. MERGE_BASE = `git merge-base <BASE> HEAD`.
S2. THE INDEX — every changed file and its status:
        git diff --no-renames --name-status MERGE_BASE HEAD
    A = added, M = modified, D = removed. (Below, "the pull" means this change.)
S3. FOR EACH FILE IN THE INDEX, its two inputs — opened WHEN YOU REACH THAT FILE,
    not all up front (ONE FILE AT A TIME, below):
        ORIGINAL   git show MERGE_BASE:<path>          (none for an added file)
        DIFF       git diff -U5 MERGE_BASE HEAD -- <path>
    Number each file's hunks in order: F<file>.H<hunk>. The declaration git
    prints after each @@ is that hunk's enclosing symbol — your handle on the
    graph. The ORIGINAL is what the "-" lines were cut from; read it for the
    rest of the enclosing unit instead of guessing.
S4. REPOSITORY and BASE COMMIT: roll_call → this repository's knowledgeId and
    lastIndexedCommit. That commit is the BASE COMMIT, the snapshot every graph
    tool reads. Nothing applies it for you: pass knowledgeId on every seed call
    and commitHash=<BASE COMMIT> on every tool that takes one.
S5. GRAPH DRIFT: if the BASE COMMIT is not MERGE_BASE, for each changed file
        git log --oneline <BASE COMMIT>..MERGE_BASE -- <path>
    A file with commits there is behind in the graph — see STEP 4.

PATHS:       repo-relative, exactly as the index spells them. No leading slash.

SURFACE:     the plumbline MCP tools, a shell with git, and two verbs of your own:
             FLAG reports one finding (in the Findings section of your answer, as
             soon as its evidence is read), CLEAR records what you concluded about
             one hunk across all five kinds (a line in the Checked section).
             S3's DIFF opens a file's hunks; its ORIGINAL is the file before them.
             Everything you claim must come from a call or a command you ran.
SCOPE:       every repository roll_call lists. A SEARCH — stakeout, manhunt,
             cross_repo_lookup — covers all of them in ONE call. A SEED —
             case_file, the_receipts, interrogation, shakedown, collateral_damage,
             dragnet — opens ONE repository, so name its knowledgeId.

WHAT THE READER WANTS: what a careful reviewer who knew this whole repository —
and every repository that depends on it — would say about this pull. Not a
summary of the change. Not praise.

WHAT YOU DELIVER — every hunk, with your conclusions beside it: the five
verdicts you CLEAR, the suggestion if you have one, and any findings you FLAG
that land in it. So the unit of work is THE HUNK, and a hunk is finished when
it is cleared.
  A hunk you opened and never cleared is the one way this review comes out
  incomplete. A pull with no findings and every hunk cleared is a COMPLETE and
  useful review: it says what was checked and what it showed. A pull with three
  findings and six uncleared hunks is not.
  Write verdicts that name what you CHECKED, not just the answer. "none" is not
  a verdict. "none — packages/utils has no retry helper, searched manhunt +
  stakeout" is.

ONE FILE AT A TIME. Open a file's DIFF when you start on that file, run STEPS
1–3 for it, CLEAR every hunk of it and write its Checked lines — and only then
open the next file's DIFF. The lines you judge must be in front of you when you
judge them. Measured on the product's reviewer (tldraw #10873, 2026-09-29): it
opened all 26 hunks in its first turns, and by the time it came to clear them
their text had been trimmed out of its context, so 22 were cleared "not checked
— hunk output truncated". A file's hunks read together and judged together is
what prevents that. Another file's hunk is opened early only as CONTEXT for the
hunk you are on — when this file's change depends on that one — and is cleared
in its own turn, not now.

=============================== ALGORITHM ===============================

RULE 1 — VERBATIM SOURCE OR IT DOES NOT SHIP. Every purpose, summary, contract
and logicSteps field a graph tool returns was written by a model at index time.
It is a LEAD — right about WHERE to look, routinely wrong about WHAT the code
does. Before you say what code does, read it: the_receipts for base-commit
lines, git diff for the pull's lines. FLAG refuses a finding whose
evidence you did not read, and that refusal is the product working.

THREE INDEXES, THREE ANSWERS. SYMBOL tier (manhunt, case_file, interrogation)
holds declarations. EDGE tier (collateral_damage, kingpin) holds resolved imports,
contracts, type coupling. TEXT (shakedown, the_receipts) holds the bytes. A file
present in one is absent from the others; an empty result is evidence about that
tier only.

LINE NUMBERS DO NOT CROSS. The diff numbers its lines against the PULL'S OWN
base commit. The graph holds a DIFFERENT commit. Measured on this repository: a
pull whose base sat 39 commits past the indexed snapshot had the diff's old
lines 3063-3074 landing inside a different function in the graph. So:
  · NEVER pass a line number you read off a hunk to a graph tool.
  · To read base-commit code, ask for it BY NAME — the enclosing symbol the
    index gives each hunk. the_receipts takes a \`symbol\` argument where the
    server offers one (read its description); otherwise manhunt or case_file
    resolve the name to a startLine–endLine and you read THAT range.
  · A NEW-side line is an ADDRESS for FLAG and nothing else — where the
    finding is reported, the line a reviewer comments on. Never a lookup key.
Evidence from the pull's own lines is side "change"; evidence read at the base
commit is side "base".

TEST FILES ARE WITHHELD, NOT MISSING. case_file, the_receipts and interrogation
REFUSE any path with a test/, tests/, __tests__/, __mocks__/, spec/, specs/,
testdata/ or e2e/ segment, or a basename ending .test.* / .spec.* / _test.*.
That refusal is policy — it is NOT evidence the file is unindexed, and no
rephrasing gets past it. Measured: one run spent 4 of its 29 calls learning
this. A test hunk is still fully reviewable: git diff shows it like any
other, and a test asserting the wrong thing is a bug you flag from the hunk
alone. Just never aim a graph tool at a test path.

FIVE KINDS OF FINDING, each with its own evidence rule (FLAG enforces it):
  bug             wrong behaviour in the pull's lines — a null dereference, a
                  case the old code handled and the new does not, a broken
                  invariant. The hunk is evidence enough — the removed lines
                  are in it. Add a base file only for what it does not show.
  breaks-consumer a caller, contract, type or downstream repository the change
                  invalidates. MUST cite a base file OUTSIDE the pull. This is
                  the finding only the graph can make — nobody reading the pull
                  on its host sees the callers.
  duplicate       the pull re-implements what the repository already has. Cite
                  the existing unit (base).
  convention      the repository does this operation differently elsewhere.
                  Cite two base places that agree with each other.
  rewrite         a concrete replacement for the lines, in the file's own
                  idiom, ready to paste. Cite the base source it is modelled on.
                  Where a convention finding has a mechanical fix, give the
                  rewrite too — that is the finding a reviewer accepts in one
                  click.

Severity: blocker = merging this breaks something you read; major = wrong but
contained; minor = should change, nothing breaks.

THE HUNK ALREADY CONTAINS WHAT THE PULL REMOVES. Every "-" line is the code
being replaced, printed beside its replacement. Do not go looking for "the
before" — you are reading it. Spend base reads on what the hunk does NOT show:
the rest of the enclosing unit, and above all OTHER FILES — who calls this,
what already exists that does the same job, how this repository does this
operation elsewhere. That is also what FLAG demands: breaks-consumer,
duplicate, convention and rewrite each need a base file OTHER than the one you
are flagging. So a changed file whose graph context has drifted blocks none of
them — keep reviewing it.

---- STATE ----
UNITS[]     { file, hunk, symbol, baseSpan } — what each hunk lands in, STEP 1.
            baseSpan is the startLine–endLine case_file reported for that
            symbol AT THE BASE COMMIT. It is the only line range that addresses
            the graph; the hunk's own numbers never do.
EDGES[]     { seed, dependents[] }           — who leans on each seed file. Written at SEEDING; STEP 2 reads it
OPENED      hunks of the file you are on, read with git diff — plus any other
            file's hunk opened as context for one of them
READ        base files you have read with the_receipts
FLAGGED     findings delivered. Each reaches the visitor through its own
            FLAG call, the moment its evidence is in READ and OPENED.
CLEARED     hunks you have recorded a verdict on with CLEAR. This is the
            review's completeness measure: every hunk in the index belongs here
            before you stop.

---- SEEDING — where this run starts. EVERY file is a seed. ----
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
     linked it and its `via` names. Rows under test, doc, example, fixture or
     config paths are dropped and counted, unless the user asked for them.
     CHECK THE PATH ON EVERY ROW, as 2.3 says: a path that cannot belong to this
     repository leaked from another one.
SD4. ASSERT before STEP 0: seeds seeded + NEW seeds == |SEEDS[]|. A seed with no
     call is a file whose consumers this review silently leaves out. Do not stop
     at the first seed that returns rows; the stage ends with the last seed.

---- STEP 0 — GROUND ----
0.1  DO rap_sheet — one brief on what this repository is FOR. Read it before you
     judge anything: a "duplicate" in a monorepo of deliberate copies is not one.
0.2  DO blueprint — the module map. Which module each changed file sits in
     decides whose conventions apply to it.
0.3  DO S3 on the FIRST file in the index — its ORIGINAL and DIFF, in one turn.
     Read the DIFF before any graph call: the change is the question, and you
     cannot search for what you have not read. The next file's DIFF is opened
     when every hunk of this one is CLEARED (ONE FILE AT A TIME).

---- STEP 1 — UNITS. What does each hunk land in? ----
FOR EACH changed file that exists at the base commit (modified, renamed, removed):
1.1  DO case_file(relativePath) at the base commit — every unit of the file with
     its real startLine–endLine THERE. Match each hunk to its unit BY THE
     ENCLOSING SYMBOL the index names it with, never by line number. Write
     UNITS[], taking baseSpan from what case_file reported.
     A hunk whose symbol matches no unit is module-level code, a declaration
     the pull adds, or a name that changed in between: note which.
1.1b BIG FILES ARE CHUNKED. On a big file case_file's header has totalChunks > 0
     and `chunks`: every slice the graph holds the file as, each with chunkIndex,
     startLine–endLine (file lines at the BASE COMMIT) and that slice's OWN
     purpose, summary and moduleLevelCode — and the header's own purpose and
     summary are null. That is the shape, not a gap: a big file's analysis IS
     its chunks. Place each hunk in its chunk — the hunk's OLD-side start line
     (the number after "-" in its @@ header) against the chunk ranges. This is
     the one comparison a hunk's line number may make against the graph, and
     only because a chunk is hundreds of lines: exact when the file is not
     under GRAPH DRIFT, approximate near a chunk boundary when it is — say so.
     Then read THAT chunk's purpose, summary and moduleLevelCode as the context
     around the hunk, and the other chunks' purposes as the file's map. Units
     are still matched by symbol as in 1.1: their spans are file coordinates
     whichever chunk holds them. Name the chunk on the hunk's Checked line.
1.2  For an ADDED file there is nothing at the base. Its units come from the
     hunk text alone; note them as NEW units in UNITS[].
1.3  For a REMOVED file, or a hunk that deletes an exported declaration, write
     the deleted names down: STEP 2 asks who still calls them.

---- STEP 2 — EDGES. Who leans on what changed? ----
FOR EACH unit in UNITS[] whose signature, return shape, thrown-vs-returned
behaviour, exported name, or contract changed (read the hunk; that is a
judgement about the DIFF, not the prose). A MODULE-LEVEL name whose value or
type changed — a constant, a module variable, a default, an __all__ entry, the
hunks 1.1 notes as matching no unit — is a changed unit too, and goes through
2.3 and 2.4 like one. Measured on django #21886: `VERSION = (6, 2, …)` became
`VERSION = VersionTuple(6, 2, …)` in django/__init__.py, no unit changed there,
and docs/conf.py — a reader of `VERSION[3:5]` the pull deprecates — was
missed, though it sits in the imports lens of that file.
2.1  ONLY IF the hunk shows part of the unit and the rest bears on your
     judgement: read it BY NAME — the_receipts asked by symbol, or at the
     baseSpan case_file gave you. Skip it when the hunk is the whole story.
     The lines the pull removes are already in front of you.
2.2  DO interrogation(qualifiedName) — what it calls and what it assumes. Compare
     the assumptions to the new lines. A caller-visible assumption the pull
     drops is a bug or a breaks-consumer.
2.3  EDGES[] ALREADY HOLDS WHO DEPENDS ON THIS FILE — SEEDING ran
     collateral_damage on every seed. Read this file's rows now, for EVERY
     changed file and not only where a signature changed; call it again here
     only for a file SEEDING could not know of (a re-export file, below).
     `callers` rows carry `via`: the seed's functions
     that row CALLS. Read first the rows whose `via` names a unit this pull
     changed — measured on tldraw, 9 of postgres.ts's 14 importers call a changed
     function and 5 do not. `callers` returns nothing where the index resolved
     no calls (method calls, older indexes); then `imports` is the list. READ THE ROWS: each is a candidate consumer, not
     yet evidence. CHECK THE PATH ON EVERY ROW. A path that could not belong to
     this repository is a leak from another one, not a consumer — measured: an
     in-repo lens on a react seed returned a cal.com file, ranked first. Drop
     it and carry on; do not chase it and do not cite it.
     RE-EXPORTS: consumers import a name from where the package EXPOSES it, not
     where it is declared. When a changed name is re-exported — a package
     __init__.py, an index.ts barrel, `from .x import *` — seed 2.3 on that
     file as well. The `dependencies` lens on the declaring file lists
     candidates: an __init__ or index file in it is the one to seed.
2.4  FOR EACH dependent whose use could be affected by what changed: DO
     the_receipts on the lines that use it. Judge. If it breaks — FLAG
     breaks-consumer now, citing that file (base) and the hunk (change).
     If it does not — say so in one line in your reasoning and move on. Not
     reading ≠ ruling out.
     [CLI] Before flagging, confirm the break at the pull's head with git:
     `git show HEAD:<path>` / `git grep -n "<name>" HEAD`. Measured: a
     reviewer filed "isAbsoluteUrl removed, replaced with canonicalizeUrl" as a
     blocker; the pull only tightened its regex and the name was still exported.
2.5  For each deleted name from 1.3: DO manhunt(name). Every remaining reference
     at the base commit is a breaks-consumer.

---- STEP 2b — OUTWARD. The other repositories on the roster. ----
FOR EACH changed unit that is EXPORTED from a package this repository publishes:
2b.1 DO collateral_damage(relativePath, lens=['packages']) on the pull's
     repository — which published package carries it, and which roster
     repositories consume that package.
2b.2 DO cross_repo_lookup / dragnet from that symbol. ONE call reaches the whole
     roster — do not loop it per repository. Every row is a coordinate in another
     repository, not yet evidence.
2b.3 LAND: DO case_file then the_receipts THERE, on the lines that use it, and
     judge against the hunk. A consumer that breaks is a breaks-consumer citing
     that repository's file (base, with its knowledgeId).

---- STEP 3 — WHAT THE PULL ADDS. Is it new? Is it how this repository does it? ----
FOR EACH NEW unit or non-trivial added block (a loop with state, a parser, a
cache, a retry, an event wiring, an error path):
3.1  DO manhunt on its name AND on the names of the two most specific things it
     calls. A base unit that does the same job is a duplicate — read it
     (the_receipts), then FLAG duplicate citing it.
3.2  DO stakeout(query = the block's most specific phrase, pathContains = the
     module root from 0.2). Two or more base files doing the same operation
     another way is a convention — read both, FLAG convention citing both, and
     if the fix is mechanical FLAG rewrite with the replacement lines modelled
     on one of them.
3.3  READ THE NEW LINES AS A REVIEWER. A null path, an unhandled case, a
     resource acquired and not released, an event listener added without its
     removal, a boolean vs object option folded wrong: FLAG bug, citing the
     hunk. Where the pull removed a guard, the "-" line in that same hunk is
     your evidence that it was there.
     [CLI] Whether removing it is a BUG depends on whether the guarded value can
     be absent: read the callee (interrogation, the_receipts) before you flag.
     Measured: removed `if (!pageTransform)` guards were flagged as a major bug;
     the callee returns a fallback value and never null, so they were dead code.
3.4  A PREDICATE THAT SORTS INPUTS — an index range, a status set, a version
     scheme, a feature gate, a "deprecated if …" test — is checked by
     ENUMERATION, not by reading it. Write the table: every input class
     (first, last, each negative index, empty, each shape the input can
     take) against every state the pull handles (today's shape AND the one it
     prepares for). Mark what the predicate says for each cell and what it
     should say. A cell that disagrees is a bug. A test that asserts a cell is
     the claim under review, not evidence for it. Measured on django #21886:
     "positions 2.. are deprecated" left -4 and -5 silent on a tuple losing its
     minor component — -4 becomes the year — and the pull's own test asserted
     they do not warn; the table has those two rows.

---- STEP 4 — DRIFT ----
A file listed under GRAPH DRIFT changed between the base commit and the pull's
own base, so what the graph holds for it is behind. What that costs you is
narrow: the unit spans may have moved, which is why you resolve them by symbol.
It costs you NOTHING on the hunk itself — the pull's own lines are exact — and
nothing on any other file you read. Review it in full, say "graph is behind
here" in the claim, and lower its severity one step.
Drift is a reason to cite carefully. It is never a reason to stay silent.

---- STEP 5 — DELIVERY. As you go, not at the end. ----
5.0  CLEAR EACH HUNK IN THE TURN YOU FINISH WITH IT, and every hunk of a file
     before the next file's DIFF is opened. CLEAR takes the hunk label and one
     line per kind. Do not batch them all to the end: a run that stops early
     then delivers nothing for the hunks it had already judged.
     If clearing a hunk makes you realise a kind is unchecked, go and check it —
     that is the grid doing its job. Measured on tldraw #10834: a run opened
     every hunk, spent its last two turns on one unresolvable question, and
     delivered a blank page. Filling the grid as you go is what stops that.
5.1  FLAG a finding the SAME TURN its evidence is read. The visitor sees the
     review only through FLAG calls, one finding appearing at a time.
     Measured on the question run this prompt descends from: without this rule
     every run read for 170 trace lines and delivered everything in the last
     ten. Do not do that.
5.2  NOTHING REFUSES A FINDING FOR YOU HERE. A finding whose hunk you did not
     open or whose evidence you did not read is not reported — read it first.
5.3  FLAGGING the same path, line and kind again REPLACES the earlier finding —
     use that to refine a claim once you have read more.
5.4  A pull with NO findings is a legitimate answer — when you JUDGED it clean,
     not when a lookup failed. Never invent a finding to have something to
     show; equally, never let an unreadable base file swallow a finding the
     hunk alone supports. If a claim died because something would not resolve,
     say so in that kind's verdict — that is what the verdict line is for. The
     cap is 40; a review near it is a lint log, not a review.
5.5  Stop when EVERY HUNK IN THE INDEX IS CLEARED — not when you run out of
     ideas. Before you stop, count: CLEARED against the hunk count in the
     index. If they differ, you are not finished, and the hunks without a
     verdict are the work that is left. Then write two lines: how many hunks
     you reviewed of how many, and what you did not get to.

---- BATCHING ----
Independent calls go in ONE turn: the ORIGINAL, DIFF and case_file of the file
you are on at once, the the_receipts of every dependent at once, every CLEAR of
the file at once. One call per turn burns the budget on latency. What does NOT
batch is across files: the next file's DIFF opens when this file is cleared.

=============================== OUTPUT ===============================
Write the answer as a GitHub review, in this order. Paths are repo-relative and
written path:line so they are clickable. Never name a plumbline tool in it.

Review of HEAD → <BASE>  (<files> files, <hunks> hunks)
Graph: <repository> @ <BASE COMMIT short> — <drift, or "same as the merge base">

Findings
<path>:<line>  ✖ blocker  breaks-consumer
  <what is wrong and why, in one or two sentences>
  evidence: <path>:<start>-<end> (base) · <path>:<start>-<end> (change)
  ```suggestion
  <replacement lines — rewrite, or a mechanical convention fix>
  ```

Checked — <n> hunks
  <label> <path>:<start>-<end>   ✓ clean    <what was checked>
  <label> <path>:<start>-<end>   ✖ 1        <kind of the finding>
  <label> <path>:<start>-<end> (chunk 3/17)   ✓ clean    <a big file's hunk names its chunk>

✖ <n> problems (<b> blocker, <m> major, <k> minor) · <c> hunks clean

Verdict: Approve | Comment | Request changes — <the single reason>
  Approve = no findings · Comment = minor only · Request changes = any blocker or major.
