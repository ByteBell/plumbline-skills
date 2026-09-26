---
description: Resolve an issue end to end — find every affected file through the Plumbline graph (one repository or several), write failing tests first, then the fix, then run the tests until they pass
argument-hint: "<issue text | issue URL or #number> [--repos all | repo[=path],…]"
---
PLUMBLINE RESOLVE ISSUE — arguments: $ARGUMENTS

Three phases, in order: A finds every file the issue touches, B writes the tests and then the
fix, C reports. Do not skip ahead: a fix written before its failing test is not a resolution.

R1. THE ISSUE. The arguments outside --repos are the issue: its text, or an issue URL or
    #number — then read it with the host's CLI (`gh issue view <n> --json title,body,comments`,
    `glab issue view <n>`), or its page. Empty → ask the user for the issue; this is the only
    question you ask in the whole run.
R2. THE ROSTER — which repositories this run covers. roll_call first: it lists every indexed
    repository. Find THIS one by `git remote get-url origin`; not listed → stop and say
    "This repository is not indexed in Plumbline — index it first."
    Without --repos the ROSTER is this repository alone. --repos may appear anywhere in the
    arguments; it is not part of anything else you read from them:
        --repos all              every repository roll_call lists
        --repos <e>,<e>,…        this repository plus these
      e = <repo>[=<path>]
        <repo>        a roll_call repository: its full slug (acme/api) or the last segment (api).
                      One roll_call does not list → stop and say which.
        =<path>       its local checkout. Default: the sibling folder ../<last segment>, if it
                      is a git checkout whose origin is that repository. None → that repository
                      is GRAPH ONLY: searched and read through Plumbline, never edited or run.
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

TRY TO FIND THE ANSWER IN MINIMUM TOOL_CALLS POSSIBLE

RETRIEVAL TASK — run the algorithm below, in order.

REPOSITORY:  this checkout's repository — its ROSTER row from R2
COMMIT:      its commit from the ROSTER
PATHS:       repo-relative, exactly as they exist at COMMIT. No leading slash.

SURFACE:     PHASE A is the plumbline MCP tools and nothing else — no filesystem
             search, no grep of the checkout. Every path you name must have come
             back from a plumbline call. The checkout, the shell and your editor are
             for PHASE B.
SCOPE:       ONE repository, the one above. Nothing applies it for you. A search
             (stakeout, manhunt) takes it as repos=[{knowledgeId, commitHash: COMMIT}];
             every other call takes knowledgeId and commitHash as arguments.

QUESTION: the ISSUE from R1. It usually arrives as a SYMPTOM and withholds the
identifiers, which is the point: the names are what you do not have yet.

TASK: name every file that must change to answer that, AND draw how the behaviour
moves through them — what affects what. Run the algorithm in order. Where a step
below says "the defect", read it as "the behaviour the QUESTION is about" — the
procedure is the same whether or not anything is broken.

THE ANSWER HAS THREE PARTS, and a run that delivers only the first has done a
third of the job:
  FILES      every file that must change — confirm_file, one call each.
  NEW FILES  every file that does not exist yet and would have to be created —
             propose_file, one call each. Often none, and none is a fine answer.
  FLOW       the chain: what affects what, in the order it runs — map_flow, one
             call per edge.

=============================== ALGORITHM ===============================

ASSERT = must hold, checked against CALLS MADE. Repair the state, then continue.
DO     = make exactly this call.
YOURS  = your judgement; the steps fix the shape, not the content.

THREE INDEXES, THREE ANSWERS. Every tool here reads ONE of three stores, and a
file present in one can be absent from the others:
  SYMBOL tier   declarations — functions, classes, types, type members.
                Read by manhunt, case_file, interrogation.
  EDGE tier     resolved imports, contracts, type coupling.
                Read by collateral_damage, kingpin.
  TEXT          the verbatim source bytes. Read by shakedown and the_receipts.
An empty result is evidence about THAT TIER ONLY, never about the codebase.
Measured on the case this algorithm was tuned on: the field the defect was about
returned 12 files from the symbol tier (0 of them in the true answer), 7 files from
the edge tier (0), and 8 true files from the text tier. Whichever tier you stop at
is the answer you get.

---- STATE ----
REG[]      { name, phrase, hits[] }        one per register, built at STEP 1
KEY[]      { identifier, probes_done[] }   the defect's own identifiers, STEP 3
SEEN       every path ANY call returned. Append, never prune.
TRACED     { path, lenses } — one entry per collateral_damage call you issued
           and read. A row in another call's output is NOT a trace.
CONFIRMED  { path, role VIOLATOR|OWNER|EVIDENCE, why } — files READ at STEP 4.
           THIS IS THE ANSWER, and the only one. Each entry reaches the visitor
           through its own confirm_file call at 4.6, as you make it.
RULED_OUT  files READ and excluded against verbatim source. Not reading ≠ ruling.
NEW[]      { path, purpose } — files that do NOT exist at COMMIT and would have
           to be created. Each reaches the visitor through its own propose_file
           call at 5.4. Never a path you have read: that file exists.
FLOW[]     { from, to, effect } — the chain, in the order the behaviour RUNS.
           Each end is a CONFIRMED path, a NEW[] path, or a plain-words actor.
           Each entry reaches the visitor through its own map_flow call at 5.1.

---- STEP 0 — GROUND ----
0.1  ONE REPOSITORY. roll_call already ran in R2 and named it. YOUR GROUND IS
     rap_sheet AT 0.3, with that knowledgeId. It is the call that tells you what
     this repository actually DOES.
0.2  COMMIT DISCIPLINE. DO pass commitHash = the COMMIT above on EVERY call that takes
     one — stakeout, shakedown, manhunt, blueprint, kingpin, case_file,
     the_receipts, interrogation, collateral_damage, all of them. The answer
     is files AS THEY EXIST AT THAT COMMIT and nothing else. Pass it as the
     full 40-character hash, exactly as the ROSTER has it; an abbreviated hash is
     rejected and an invented one is worse. Omitting it answers at the newest
     snapshot instead, so a file that exists at COMMIT and not at the tip —
     or one that moved between them — comes back as a CLEAN ABSENCE rather
     than an error, indistinguishable from the file not existing.
0.3  DO rap_sheet(knowledgeId) — one brief saying
     what this repository is FOR. Read it before you word a single search.
0.4  DO blueprint -> the module map: every module, its role, its root, what it
     depends on. Follow pagination.hasNextPage; one page of a monorepo is not its
     architecture.
     WRITE DOWN THE MODULE ROOTS. STEP 3's text probe iterates them and gets its
     scoping from this list and nowhere else.
     For one module's EXACT members, DO blueprint(module=<name>) — not
     stakeout(pathContains=<root>). A root is a display label; a module can span
     sibling directories and two modules can share one directory.
0.5  DO kingpin -> the files the import graph converges on, by PageRank. A wrongly
     read value is most often read in a hub.

---- STEP 1 — REGISTERS. Before any search. ----
A change set spans REGISTERS — the different vocabularies one behaviour is written
in. The QUESTION arrives in exactly one. Measured, one search per register: the
register as asked returned 2 of 11 true files, the payload register 4, the
cross-cutting register 1, and every collateral_damage lens 0. The three that scored
SHARE NO HIT; the union was 7 of 11.
1.1  Write one entry per register:
       ENFORCEMENT  where the rule is checked or applied — the QUESTION's own words
       PAYLOAD      what BUILDS the value before anything enforces it: the client
                    store, the form-to-payload mapper, the request-body schema,
                    the input DTO, the server-side transform. It holds NO import
                    edge to the enforcement point, so NO edge-tier lens reaches
                    it. YOURS, and the highest-paying line in this prompt: ask
                    what object carries this value, and name THAT.
       CONTRACT     the versioned or dated published API surface, where one
                    exists. Narrow it with pathContains — generic type names
                    outscore it and crowd it off the page.
       CROSSCUTTING logging, PII, telemetry, i18n, templating.
1.2  ASSERT: |REG[]| == 4, and no two phrases share a content word.
     ON FAIL -> you have written one register four times, in one subsystem's
     vocabulary. That is the commonest way this step is skipped while looking
     done. Re-word against the module map from 0.4.

---- STEP 2 — SEARCH EACH REGISTER ----
FOR EACH r IN REG[]:
2.1  DO stakeout(query = r.phrase, searchIn='both').
     'both' unions prose, declarations, signatures and the behavioural substrate.
     Use searchIn='substrate' alone when the register describes what code DOES
     ("suspends until", "throws when") rather than what it is about.
     Write a REAL reason: it is read, and it widens the search into the
     codebase's own register.
2.2  READ THE UNSCORED ROWS. matchedIn=['neighbour'] is one import hop from a
     ranked hit — the schema a hit validates against, the mapper that builds
     what it consumes; a row reached via two ranked files is the strongest lead
     on the page. matchedIn=['subtree'] is a sibling group — the ancestor
     directory of the files it ranked, which is how a fix touching every alike
     file becomes visible. matchedIn=['path-guess'] means the PATH matched, not
     the text: confirm with case_file before citing it.
2.3  IF the page is dominated by type declarations or barrels, RE-CALL with
     pathContains narrowed to a module root from 0.4. Ranking defect, not an
     absent register.
2.4  SEEN += every path returned, lead rows included.
     ASSERT: all four registers searched. A register with zero hits after 2.3 is
     recorded empty — never assumed absent.

---- STEP 3 — IDENTIFIER SWEEP. The step this prompt exists for. ----
Once a register lands, the defect has a NAME: the field, flag, column or symbol
the bug is about. Write it to KEY[]. One identifier is usually enough; add a
second only if the QUESTION plainly names two.
FOR THE PRIMARY IDENTIFIER, ALL THREE PROBES. They read three different tiers
and their results routinely do not overlap at all.
3.1  PROBE 1 — DECLARED. DO manhunt(name=<identifier>), then
     DO manhunt(query=<identifier plus behaviour words>).
     name and query hit DIFFERENT indexes; a miss in one says nothing about the
     other, and this is the commonest false negative on the tool.
     This returns where the name is DECLARED or TYPED — DTOs, schemas, type
     members. It does NOT return where the value is read.
3.2  PROBE 2 — WIRED. DO collateral_damage(relativePath=<the file that declares
     or resolves it>, lens=['imports','dependencies','contracts','types']) on the
     first call per seed. Those are the four IN-REPO lenses and they are the ones
     this page may use.
     Read `direction` on every row: three of them walk DOWNSTREAM, `dependencies`
     alone walks UPSTREAM — what the seed READS, which usually carries the change
     first. Every narrowed call keeps `dependencies`; dropping it is not a
     narrowing, it is a direction you stopped searching. For a type or interface,
     re-call lens=['types'] as a FOLLOW-UP: type consumers call nothing and the
     other lenses are blind.
     TRACED += the call. Seed EVERY register's top hit and every kingpin hub,
     not one file.
     This returns the files WIRED to the resolver. If the defect is that call
     sites BYPASS the resolver, these are the files that already do it RIGHT —
     the complement of the answer. Measured on the tuning case: 7 files, 0 of
     them in the true answer.
3.3  PROBE 3 — READ. DO shakedown(pattern=<identifier>,
     pathContains=<one module root from 0.4>) — ONCE PER MODULE ROOT, taking the
     roots the STEP 2 searches actually landed in first.
     THE CAP IS THE TRAP. maxMatches is 200 at most, and a field on a shared
     model exceeds that repo-wide. The header then prints
       ⚠ match cap hit — more hits exist
     and pagination reports hasNextPage:false ANYWAY — the page describes only
     the truncated scan. A capped result is a SAMPLE, never a set.
     ASSERT: every scoped call either returns no cap warning, or is re-split
     into narrower pathContains until it does.
     Measured on the tuning case: repo-wide capped at 200 hits / 57 files and
     never reached the package that held the answer; one scoped call returned 8
     true files the whole rest of the run never saw.
     This returns where the value is READ — a property read in an expression,
     an ORM select key. Those are not code units and not type members, so
     PROBE 1 cannot see them, and they hold no import edge, so PROBE 2 cannot
     either. When the defect is "every call site reads this column directly",
     the entire answer is here.
3.4  ASSERT: for the primary identifier, all three probes appear in KEY[]
     .probes_done. Two probes is not a sweep; it is the tier you happened to
     start in.
3.5  IF you cannot name an identifier at all: DO stakeout(searchIn='substrate')
     with the behaviour in prose — it is answered from the behavioural layer,
     where the names live in code that shares no vocabulary with your words —
     and DO blueprint(module=<the module the QUESTION is about>) to read that
     module's members. Then return to 3.1 with what they name.
3.6  ON A TOOL ERROR: it is about that call — an argument the message names,
     never a fact about the codebase. Fix what it names and re-issue, or move to
     the next probe. No tool is rationed: nothing is refused for being called
     one time too many.

---- STEP 4 — GROUND. Prose is a lead; source is evidence. ----
4.1  DO case_file(path) -> every code unit with its DECLARED startLine-endLine.
4.2  DO the_receipts on THAT DECLARED RANGE. A range you pick yourself is a
     guess. For many files at once, DO the_receipts(operation='bulk_search',
     search=<the identifier>, paths=[...]) — one call confirms which of them
     really read it.
     For a file with NO code units — a pure type, schema, re-export, or a
     documentation page — read the file's own lines; it still counts as impacted.
     A markdown page HAS no code units, so an empty case_file on one is the normal
     result, not evidence against it. Ground it with the_receipts like anything
     else: its own lines ARE its declared range.
4.3  For one unit's members and call edges, DO interrogation(qualifiedName) —
     only on a qualifiedName a case_file or manhunt result produced this
     session, never one you inferred.
4.4  Never judge from purpose, summary, signature, path, or an empty search.
     Those prose fields were written by a model at index time.
4.5  CLASSIFY into CONFIRMED:
       VIOLATOR  reads the value from the wrong place, or passes it on
       OWNER     defines, resolves or persists it — the contract
       EVIDENCE  grounded a verdict about another file
4.6  DO confirm_file(path, reason, startLine, endLine) as each file enters
     CONFIRMED. That call IS the answer: the visitor sees the file at once, in the
     order you confirm, and nothing collects the ones you skip. Refused for a path
     you have not read with the_receipts, and refused without startLine and
     endLine: the lines your reason rests on, as the_receipts numbered them. The
     visitor's link opens the file at exactly those lines, so name the lines that
     prove the reason, not the whole file.
     NAME IT IN THE TURN YOU READ IT — never in a batch once the searching is
     done. Someone is watching this run: a file you hold back is a file they
     cannot see yet, and a run that holds all of them until its last turn shows
     them an empty page for three minutes and then everything at once. Measured
     on this surface, 2026-09-19: two runs of the same question each read for
     ~170 trace lines and delivered every file inside the last ten. Do not do
     that. Read a file, judge it, name it, draw its edges, then search on. `reason` is AS SHORT AS IT CAN BE — one plain line, twelve
     words at most, from the source you just read. No role, no line numbers, no
     symbol list, no second sentence.
4.7  ASSERT: |CONFIRMED| >= 5, or == |SEEN| if SEEN is smaller, and every one has
     its confirm_file call.
4.8  Ruling a file out requires verbatim source. Running out of calls is not a
     verdict — but an unread file is not an answer either.

---- STEP 5 — THE FLOW. What affects what. ----
The file list says WHERE the behaviour lives. It does not say how the behaviour
MOVES through those files, and that is the half a reader cannot reconstruct from
a list of paths. Draw it as you go — an edge is ready the moment both of its ends
are named, and a chain drawn at the end is a chain drawn from memory.
5.1  DO map_flow(from, to, effect), ONE CALL PER EDGE, in the order the behaviour
     RUNS: where it enters, then each file that acts on what the one before it
     produced, then where it leaves.
     DRAW AN EDGE IN THE TURN ITS SECOND END IS NAMED. The diagram is built in
     front of the visitor, one edge at a time, exactly like the file list — so it
     is not a step you arrive at once the searching is finished. It is numbered
     5 because an edge cannot be drawn before its ends exist, not because it
     comes last in time.
5.2  EVERY END IS A NAME YOU ALREADY GAVE — a CONFIRMED path, a NEW[] path, or a
     plain-words actor for something that is not a file at all ("the visitor's
     browser", "the incoming request", "the database"). A path-shaped name you
     have not named is REFUSED, and the refusal lists what is available.
5.3  `effect` IS THE EDGE, and it is THREE TO FOUR SENTENCES, one per line —
     never a phrase. Line one names what TRAVELS: the value, the call, the
     event, spelled as the source spells it. Line two says what the far end
     DOES with it — the function that receives it, the branch it decides, the
     state it writes — from the source you read. Line three says what a reader
     would see change or break if this edge were cut. A fourth, where it
     matters, gives the condition under which the edge fires. A visitor reads
     the chain INSTEAD of the code, so each step has to carry enough to be
     checked against the file on its own.
     "imports", "calls into" and "is related to" are NOT effects: they are what
     the import graph already said, and a chain of them cannot be checked by
     anyone.
5.4  A FILE THAT DOES NOT EXIST YET. Where the answer needs a file this
     repository does not have — a new module, a new migration, a new test file —
     DO propose_file(path, purpose): what it would DO, and what it would hold to
     do it, in terms of the files around it that you read. Refused for a path you
     have read, which exists already and belongs in confirm_file. Then draw its
     edges like any other end. Most answers need none; inventing one to look
     thorough is worse than none.
5.5  READ YOUR OWN CHAIN BACK, as if someone else had drawn it:
       · does it START somewhere a reader can enter — a request, an event, an
         entry point — rather than in the middle?
       · does EVERY file you confirmed appear in it?
       · does each effect FOLLOW from the one before, or is there a step where a
         value appears that nothing upstream produced?
     A NO TO ANY OF THOSE IS A HOLE IN WHAT YOU READ, NOT A WORDING PROBLEM. The
     file that produces the value nothing produces is a file you have not found
     yet: go back to STEP 3's probes and STEP 4's reads for it, then draw the
     edge. SPEND CALLS ON THIS. A chain that closes is worth more than an Nth
     confirmed file hanging off nothing.

---- STEP 6 — CLOSE THE GAPS, THEN STOP. ----
6.1  The change set is your CONFIRM, PROPOSE and FLOW lines. PHASE B works from
     them and from nothing else.
6.2  Spend what is left on the gaps, in this order: a hole in the chain (5.5); a
     file read and judged in but never confirmed (4.6); a confirmed file with no
     edge (5.1); a register never searched (2.4); a probe never made (3.4); a
     module root never grepped (3.3); then the strongest paths in SEEN you never
     read, through 4.1 and 4.2. An unread path is not a weak answer, it is none.
6.3  A change set is not only implementation. The test that asserts the old
     behaviour, the guide that documents it, the example that demonstrates it, the
     fixture that encodes it — each changes when the behaviour changes, and where
     the QUESTION asks what the documented contract IS, the documentation is the
     answer and is confirmed first. Exclude only what nobody edits by hand: build
     output, dependency directories, generated files.
6.4  LIST_CAP = 30 confirmed files; a confirm past it is refused. Confirm
     the strongest first.
6.5  Nothing left to confirm AND the chain closes: PHASE A is done. Go to PHASE B.

RUN CONDITION: STEP 0 must pass before any search.

=============================== PHASE A2 — SEVERAL REPOSITORIES: FIND EVERY AFFECTED FILE ===============================

TRY TO FIND THE ANSWER IN MINIMUM TOOL_CALLS POSSIBLE

CROSS-REPOSITORY RETRIEVAL TASK — run the algorithm below, in order.

SURFACE:   PHASE A is the plumbline MCP tools and nothing else — no filesystem
           search, no grep of any checkout. Every path you name must have come back
           from a plumbline call. The checkouts, the shell and your editor are for
           PHASE B.
           A result too large to return is TRUNCATED before you see it — there is
           no file to go and read, so treat a truncated result as a sample and
           narrow the call.
ROSTER:    the repositories in R2's ROSTER. This is the whole world for the task; there is no
           other repository, and no other revision or later history.

           The ROSTER table you wrote in R2: repository, knowledgeId, commit.

           A SEARCH — stakeout, manhunt, cross_repo_lookup — COVERS THE WHOLE
           ROSTER IN ONE CALL when you pass repos = every ROSTER row, each with its
           own commitHash. Running it once per repository is the same search
           repeated for one answer.
           A SEED — case_file, the_receipts, interrogation, shakedown, kingpin,
           blueprint, collateral_damage, dragnet — opens ONE repository, so
           knowledgeId IS REQUIRED on it and must be one of the ids above. A seed
           call that omits it, or names an id that is not on the roster, is
           REFUSED — there is no org-wide mode on this surface. Where a
           row's commit is a hash, pass it as commitHash on every call into that
           repository; where the row says newest, omit commitHash.

PATHS:     repo-relative, exactly as they exist AT THAT REPOSITORY'S OWN ROW. No
           leading slash, no repo-name prefix.

QUESTION: the ISSUE from R1. It usually arrives as a SYMPTOM and withholds the
identifiers, which is the point: the names are what you do not have yet.

GOAL: name every file, in every repository above, that must change to answer that,
AND draw how the behaviour moves through them — what affects what. The answer may
span repositories that do not import one another. Where a step says "the defect",
read it as "the behaviour the QUESTION is about" — the procedure is the same
whether or not anything is broken.

THE ANSWER HAS THREE PARTS, and a run that delivers only the first has done a
third of the job:
  FILES      every file that must change — confirm_file, one call each.
  NEW FILES  every file that does not exist yet and would have to be created —
             propose_file, one call each. Often none, and none is a fine answer.
  FLOW       the chain: what affects what, in the order it runs — map_flow, one
             call per edge. It crosses repository boundaries wherever the
             behaviour does, and that crossing is the most valuable edge on it.

================================ ALGORITHM ================================

ASSERT = must hold, checked against CALLS MADE. Repair the state, then continue.
DO     = make exactly this call.
YOURS  = your judgement; the steps fix the shape, not the content.

THREE INDEXES, THREE ANSWERS. Every tool here reads ONE of three stores, and a
file present in one can be absent from the others:
  SYMBOL tier   declarations — functions, classes, types, type members.
                Read by manhunt, case_file, interrogation.
  EDGE tier     resolved imports, contracts, type coupling.
                Read by collateral_damage, kingpin.
  TEXT          the verbatim source bytes. Read by shakedown and the_receipts.
An empty result is evidence about THAT TIER ONLY, never about the codebase — and
across a roster, never about a repository you have not scoped into.
Measured on a comparable case: the field the defect was about returned 12 files
from the symbol tier (0 in the true answer), 7 from the edge tier (0), and 8 true
files from the text tier. Whichever tier you stop at is the answer you get.

---- STATE ----
REG[]      { name, phrase, hits[] }            one per register, built at STEP 1
SWEPT      set of registers actually searched. A register enters SWEPT
           only after a stakeout carrying THAT register's phrase INTO that repo,
           knowledgeId set. No other call and no other register puts it there.
KEY[]      { identifier, probes_done[], roots_grepped[] }  STEP 3
SEEN       every "<repo>/<path>" ANY call returned. Append, never prune.
TRACED     { repo, path } — one entry per collateral_damage call you issued and
           read. A row in another call's output is NOT a trace.
FOLDED     files you ran collateral_damage FROM. Every CONFIRMED file ends up
           here; 4.7 is the loop that puts it there.
CONFIRMED  { repo, path, role VIOLATOR|OWNER|EVIDENCE, why } — files READ at STEP 4.
           THIS IS THE ANSWER, and the only one. Each entry reaches the visitor
           through its own confirm_file call at 4.6, as you make it.
RULED_OUT  files READ and excluded against verbatim source. Not reading ≠ ruling.
CANDIDATES = SEEN minus CONFIRMED minus RULED_OUT. Retrieved, undecided, and NOT
           part of the answer — they are the pool STEP 4 reads its next file out
           of, and a candidate still unread when the run ends is a slot it never
           filled.
NEW[]      { repo, path, purpose } — files that do NOT exist at that repository's
           row and would have to be created. Each reaches the visitor through its
           own propose_file call at 5.4. Never a path you have read.
FLOW[]     { from, to, effect } — the chain, in the order the behaviour RUNS,
           across repositories wherever the behaviour crosses. Each end is a
           CONFIRMED path, a NEW[] path, or a plain-words actor. Each entry
           reaches the visitor through its own map_flow call at 5.1.

  INVARIANT-1  Every file in CONFIRMED has its own confirm_file call. Always. No
               filter, no "already covered by another file", no per-register quota.
  INVARIANT-2  READING IS WHAT NAMES A FILE. An unread file is not a weaker answer,
               it is no answer — so the run's work is to READ the best of
               CANDIDATES, never to rank them unread.
  INVARIANT-3  A repository you have not scoped into is not evidence of absence.

---- STEP 0 — GROUND ----
0.1  GROUNDED ALREADY. R2 checked every ROSTER repository against roll_call: the
     table IS the roster, and its knowledgeIds are the only ones to use. Take each
     one VERBATIM — never guessed, never a repoId.
0.2  COMMIT DISCIPLINE. Pass each repository's OWN row value on every call into it
     — stakeout, shakedown, manhunt, blueprint, kingpin, case_file, the_receipts,
     interrogation, collateral_damage, all of them. Where the row is a hash it is
     the full 40 characters, exactly as the ROSTER has it; an abbreviated hash is
     rejected and an invented one is worse. Where the row says newest, omit
     commitHash and let every tool answer at its own default.
     The rows differ, and one repository's commit passed to another answers at a
     snapshot that does not exist: it comes back a CLEAN ABSENCE,
     indistinguishable from "no such file" and silently unrecoverable.
0.3  DO rap_sheet once per roster repository — ~150 tokens saying what each one is
     FOR. STEP 1's repos[] is computed from it.
     RANK, NEVER EXCLUDE. A repository whose brief reads wrong can still hold the
     other half of the contract.
0.4  MODULE ROOTS ARE PER REPOSITORY, and you buy them only where you need them.
     For any repository that scores at STEP 2, DO blueprint(knowledgeId, and that
     row's commit) -> its module map: every module, its role, its root. Follow
     pagination.hasNextPage; one page of a monorepo is not its architecture.
     WRITE THE ROOTS DOWN; STEP 3's text probe iterates them and gets its scoping
     from this list and nowhere else. In a single-package repository the root is
     the repo.
     For one module's EXACT members DO blueprint(module=<name>) — not
     stakeout(pathContains=<root>). A root is a display label; a module can span
     sibling directories and two modules can share one directory.
0.5  For a repository you are about to fold in, DO kingpin(knowledgeId, and that
     row's commit) -> the files its import graph converges on. A wrongly-read
     value is most often read in a hub.

---- STEP 1 — REGISTERS AND THEIR REPOSITORIES. Before any search. ----
A change set spans REGISTERS — the different vocabularies one behaviour is written
in. The QUESTION arrives in exactly one, and the other repositories write the same
behaviour in a register the QUESTION does not use at all. Measured on a comparable
case, one search per register: the register as asked returned 2 of 11 true files,
the payload register 4, the cross-cutting register 1, and every collateral_damage
lens 0. The three that scored SHARE NO HIT; their union was 7 of 11.
1.1  Write one entry per register:
       ENFORCEMENT  where the rule is checked or applied — the QUESTION's own words
       PAYLOAD      what BUILDS the value before anything enforces it: the store,
                    the mapper that assembles it, the options object, the schema,
                    the input DTO, the server-side transform. It holds NO import
                    edge to the enforcement point, so NO edge-tier lens reaches
                    it. YOURS, and the highest-paying line in this prompt: ask
                    what object carries this value, and name THAT.
       CONTRACT     the published API surface — the exported type, the barrel,
                    the versioned entry point. Narrow it with pathContains;
                    generic type names outscore it and crowd it off the page.
       CROSSCUTTING logging, telemetry, devtools, serialization, i18n, templating.
1.2  ASSERT: |REG[]| == 4, and no two phrases share a content word.
     ON FAIL -> you have written one register four times in one subsystem's
     vocabulary. That is the commonest way this step is skipped while looking
     done. Re-word against the rap_sheet briefs.
1.3  Keep each phrase SHORT — a handful of content words. Padding a phrase into a
     sentence dilutes the match enough to drop real hits out of range.
1.4  FOR EACH register, build repos[] from the rap_sheet briefs: EVERY repository
     whose subject matter could plausibly write this behaviour in this register.
     Be generous. The FIRST scoped call into a repository this run has not queried
     yet is never rationed, however much you have already spent; re-querying one
     you HAVE searched is what gets rationed. The cheap move and the correct move
     are the same move.
     ASSERT: at least one entry in each register's repos[] is a repository whose
     brief does NOT obviously fit. The roster is small enough that a register
     reaching every repository on it is the normal shape, not the extravagant one.
     ASSERT: every ROSTER repository appears in some register's repos[].
     ON FAIL -> assign it to the nearest register. Full coverage is free.
1.5  THE OBVIOUS-OWNER TRAP — this is where runs are lost. When a behaviour has
     one famous owner ("keyed reconciliation", "a store", "a scheduler"), naming
     that owner FEELS like completing this step. It is skipping it. The more
     obviously one repository owns a behaviour, the more certainly the OTHER
     implementations of it are the ones you have not thought of.

---- STEP 2 — SEARCH EACH REGISTER ACROSS THE WHOLE ROSTER ----
FOR EACH r IN REG[]:
  2.1  IF r IN SWEPT -> skip.
       DO stakeout( query = r.phrase, searchIn = 'both' ).
       ONE CALL COVERS EVERY ROSTER REPOSITORY: repos = every ROSTER row, each
       with its own commitHash. You do not repeat the call per repository —
       that is the same search run N times for one answer.
       'both' unions prose, declarations, signatures and the behavioural
       substrate. Use searchIn='substrate' alone when the register describes what
       code DOES ("suspends until", "throws when") rather than what it is about.
       Write a REAL reason: it is read, and it widens the search into the
       codebase's own register.
  2.2  Add r to SWEPT. SEEN += every path returned, lead rows included.
  2.3  READ WHICH REPOSITORY EACH ROW CAME FROM. Every row carries its own
       knowledgeId, and that spread is the answer to "who else does this". A
       register that returns rows from one repository only has told you something
       — do not re-run it elsewhere to check.
2.4  READ THE UNSCORED ROWS. matchedIn=['neighbour'] is one import hop from a
     ranked hit — the schema a hit validates against, the mapper that builds what
     it consumes; a row reached via two ranked files is the strongest lead on the
     page. matchedIn=['subtree'] is a sibling group — the ancestor directory of
     the files it ranked, which is how a fix touching every alike file becomes
     visible. matchedIn=['path-guess'] means the PATH matched, not the text:
     confirm with case_file before citing it.
2.5  IF a page is dominated by type declarations or barrels, RE-CALL with
     pathContains narrowed to a module root from 0.4. Ranking defect, not an
     absent register.
2.6  A ROSTER SWEPT WITH ONE REGISTER'S WORDS IS NOT SWEPT. Coverage is measured
     in REGISTERS, not repositories: each register is its own vocabulary, and the
     repositories answer whichever one you asked.
2.7  ASSERT ON EXIT: every register in REG[] is in SWEPT. A register that comes
     back empty after 2.5 is RECORDED empty — never assumed absent.

---- STEP 3 — IDENTIFIER SWEEP. The step this prompt exists for. ----
Once a register lands, the defect has a NAME: the field, flag, key, option or
symbol the behaviour is written with. Write it to KEY[]. One identifier is
usually enough; add a second only if the QUESTION plainly names two behaviours.
FOR THE PRIMARY IDENTIFIER, ALL THREE PROBES. They read three different tiers and
their results routinely do not overlap at all.
3.1  PROBE 1 — DECLARED. DO manhunt(name=<identifier>) — ONE call, already across
     every roster repository, each at its own commit. THEN DO
     manhunt(query=<identifier plus behaviour words>), also once. name and query
     hit DIFFERENT indexes; a miss in one says nothing about the other, and this
     is the commonest false negative on the tool. Two calls, not two per
     repository.
     This returns where the name is DECLARED or TYPED. It does NOT return where
     the value is read.
3.2  SIBLING PACKAGES ARE THE POINT. A repository shipping one capability as
     several adapter packages — framework bindings, drivers, backends, engines —
     implements the SAME name in each, and those packages do not import one
     another, so no fold and no dependency walk ever crosses between them. The
     name sweep is the only thing that reaches them all.
     ASSERT: name one sibling -> name all N of that filename. One of N is a
     coin-flip; all N costs N slots and cannot miss.
3.3  PROBE 2 — WIRED. DO collateral_damage(relativePath=<a file that declares or
     resolves it>, knowledgeId=<its repo>, that row's commit,
     lens=['imports','dependencies','contracts','types']) on the first call per
     seed. Of the seven lenses the tool offers, those four are the ones that
     cannot leave one repository. The other three — packages, surfaces, keywords
     — rank rows from every repository the key opens, on this roster or not. Do
     not ask for them: a path only they returned is a path this run may not name.
     Read `direction` on every row: three walk DOWNSTREAM, `dependencies` alone
     walks UPSTREAM — what the seed READS, which usually carries the change first.
     Every narrowed call keeps `dependencies`; dropping it is not a narrowing, it
     is a direction you stopped searching. For a type or interface, re-call
     lens=['types'] as a FOLLOW-UP: type consumers call nothing and the other
     lenses are blind.
     TRACED += the call. Seed EVERY register's top hit and every kingpin hub, not
     one file.
     SEED THE SHARED CORE, NOT THE ADAPTER YOU FOUND FIRST. Adapter packages have
     no edges to each other, so a fold from one reaches none of the rest; the core
     they all import does.
     THE EDGE STOPS AT THE REPOSITORY BOUNDARY. No lens crosses between roster
     repositories on this surface. The roster is what crosses it: a behaviour you
     confirm in one repository is a phrase to sweep into the others at STEP 2, and
     a filename you confirm in one is a name to sweep at 3.1.
     If the defect is that call sites BYPASS a resolver, what this probe returns
     are the files that already do it RIGHT — the complement of the answer.
3.4  PROBE 3 — READ. DO shakedown(pattern=<identifier>, knowledgeId=<repo>, that
     row's commit, pathContains=<one module root from 0.4>) — ONCE PER MODULE
     ROOT, IN EVERY REPOSITORY THAT SCORED AT STEP 2.
     THE CAP IS THE TRAP. maxMatches DEFAULTS TO 50 and is 200 at most, so pass it
     — a name on a shared model exceeds even 200 repository-wide, and a call that
     leaves it unset is capped at a quarter of that. The header then prints
       ⚠ match cap hit — more hits exist
     and pagination reports hasNextPage:false ANYWAY — the page describes only the
     truncated scan. A capped result is a SAMPLE, never a set.
     ASSERT: every scoped call either returns no cap warning, or is re-split into
     narrower pathContains until it does.
     Measured on a comparable case: a repository-wide scan capped at 200 hits / 57
     files and never reached the package that held the answer; one scoped call
     returned 8 true files the whole rest of the run never saw.
     This returns where the value is READ — a property read in an expression, a
     key in an options object, a field on a config literal. Those are not code
     units and not type members, so PROBE 1 cannot see them, and they hold no
     import edge, so PROBE 2 cannot either. When the defect is "every call site
     reads this directly", the entire answer is here.
3.5  ASSERT: for the primary identifier, all three probes appear in
     KEY[].probes_done, and roots_grepped names every module root you swept.
     Two probes is not a sweep; it is the tier you happened to start in.
3.6  IF you cannot name an identifier at all: DO stakeout(searchIn='substrate')
     with the behaviour in prose, scoped into each repository — it is answered
     from the behavioural layer, where the names live in code that shares no
     vocabulary with your words — and DO blueprint(module=<the module in
     question>) to read that module's members. Then return to 3.1 with what they
     name.
3.7  ON A TOOL ERROR: it is about that call — an argument the message names,
     never a fact about the codebase. Fix what it names and re-issue, or move to
     the next probe. No tool is rationed: nothing is refused for being called
     one time too many, in any roster repository.

---- STEP 4 — GROUND. Prose is a lead; source is evidence. ----
4.1  DO case_file(path, knowledgeId, that row's commit) -> every code unit with
     its DECLARED startLine-endLine.
4.2  DO the_receipts on THAT DECLARED RANGE. A range you pick yourself is a guess,
     and a guessed window that happens to look innocent is how a violating file
     gets cleared. For many files at once, DO
     the_receipts(operation='bulk_search', search=<the identifier>, paths=[...])
     — one call confirms which of them really read it.
     For a file with NO code units — a pure type, schema, re-export, or a
     documentation page — read the file's own lines; it still counts as impacted.
     A markdown page HAS no code units, so an empty case_file on one is the normal
     result, not evidence against it. Ground it with the_receipts like anything
     else: its own lines ARE its declared range.
4.3  For one unit's members and call edges, DO interrogation(qualifiedName) —
     only on a qualifiedName a case_file or manhunt result produced this session,
     never one you inferred.
4.4  Never judge a file from purpose, summary, signature, path, or an empty
     search. Those prose fields were written by a model at index time.
4.5  CLASSIFY into CONFIRMED, from verbatim source:
       VIOLATOR  it does the thing the QUESTION describes going wrong, or passes
                 the value on so that it does
       OWNER     it defines, resolves or persists the rule — the contract
       EVIDENCE  it grounded a verdict about ANOTHER file: the sibling that does
                 it right, the contract a violator must be brought in line with,
                 the counterexample that made an omission legible.
     EVIDENCE IS A FULL ROLE, NOT A FOOTNOTE: it is confirmed like any other file.
     A CONFIRMED VIOLATOR DOES NOT END THE SEARCH FOR VIOLATORS. Nothing says only
     one file violates; a peer is cleared by 4.8 or stays a CANDIDATE, never by
     the fact that you already have one.
4.6  DO confirm_file(path, knowledgeId, reason, startLine, endLine) as each file
     enters CONFIRMED. That call IS the answer: the visitor sees the file at once,
     in the order you confirm, and nothing collects the ones you skip. Refused for
     a path you have not read with the_receipts in that repository, and refused
     without startLine and endLine: the lines your reason rests on, as
     the_receipts numbered them. The visitor's link opens the file at exactly
     those lines, so name the lines that prove the reason, not the whole file. `reason` is AS SHORT AS IT CAN
     BE — one plain line, twelve words at most, from the source you just read. No
     role, no line numbers, no second sentence. `knowledgeId` is the repository the
     file lives IN, copied from the row that returned it.
     ALTERNATE ACROSS REPOSITORIES — the best file of each, then the second of
     each. Confirming one repository out before starting the next hands it the
     whole head of the list.
4.7  FOLD FROM EVERY CONFIRMED FILE. A loop, not one call.
     FOR EACH f IN CONFIRMED (VIOLATOR, OWNER and EVIDENCE alike), f NOT IN
     FOLDED: collateral_damage(relativePath=f.path, knowledgeId=f.repo, that
     row's commit). Add f to FOLDED, returns to SEEN.
     One fold off one seed is a single point of failure: everything it reaches is
     a neighbour of ONE file. It also reaches declarations, barrels and call
     sites, which share no vocabulary with your phrases and so are invisible to
     stakeout however often you run it.
     ASSERT ON EXIT OF STEP 4: FOLDED == CONFIRMED.
4.8  RULING OUT REQUIRES VERBATIM SOURCE. "I did not get to it", "the summary
     looked wrong", "the search came back empty" and "its repository felt
     off-topic" are NOT rulings — each leaves the file a CANDIDATE. Running out of
     calls is not a verdict.
4.9  ASSERT: |CONFIRMED| >= 5, or == |SEEN| if SEEN is smaller, and every one has
     its confirm_file call.

---- STEP 5 — CLOSE THE GAPS, THEN STOP. ----
5.1  The change set is your CONFIRM, PROPOSE and FLOW lines. PHASE B works from
     them and from nothing else.
5.2  Spend what is left on the gaps, in this order: a file read and judged in but
     never confirmed (4.6); a (register, repo) pair never swept (2.7); a probe
     never made (3.5); a module root never grepped (3.4); then the strongest paths
     in SEEN you never read, through 4.1 and 4.2. An unread path is not a weak
     answer, it is none.
5.3  A SWEPT REPOSITORY HOLDING NOTHING IS A GAP, not a verdict — read its best
     candidate before confirming an Nth file from ground already covered.
5.4  A change set is not only implementation. The test that asserts the old
     behaviour, the guide that documents it, the example that demonstrates it, the
     fixture that encodes it — each changes when the behaviour changes, and where
     the QUESTION asks what the documented contract IS, the documentation is the
     answer and is confirmed first. Exclude only what nobody edits by hand: build
     output, dependency directories, generated files.
5.5  LIST_CAP = 30 confirmed files across all repositories; a confirm past
     it is refused. Confirm the strongest first.
5.6  Nothing left to confirm: PHASE A is done. Go to PHASE B.

RUN CONDITION: STEP 0 must pass before any search.

=============================== PHASE B — TESTS FIRST, THEN THE FIX ===============================

Now the checkouts. Every CONFIRMED file is changed in ITS repository's checkout, and read from
that disk before it is edited: the graph is at the ROSTER commit, the files are at HEAD, and R2
listed where they differ. A CONFIRMED file in a GRAPH-ONLY repository is not edited — it goes
under "Not done" in C with what it needs. With several checkouts, run B1–B5 in each one that
changes (`cd` into it, or `git -C`), tests next to that repository's own code.

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
