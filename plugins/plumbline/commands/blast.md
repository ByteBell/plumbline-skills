---
description: Blast radius — who depends on this file, symbol or pasted code, across every indexed repository
argument-hint: "<file[:start-end] | symbol | pasted code>  (empty = your uncommitted changes)"
---
PLUMBLINE BLAST RADIUS — what breaks if this code changes, in this repository and in every
other repository the Plumbline graph holds.

TARGET: $ARGUMENTS

---- 1. WHAT IS THE TARGET ----
Decide which of these the TARGET is, in this order:
  a. A path that exists in this checkout, optionally with :start-end or :line.
     `test -f <path>`. The range narrows the result to the units inside it.
  b. Empty. The target is every file in `git diff --name-only HEAD` (uncommitted work);
     if that is empty too, `git diff --name-only HEAD~1 HEAD`.
  c. One identifier (createOrder, OrderService.submit). A symbol.
  d. Anything else is PASTED CODE. Do not ask where it came from; find it (step 2).

---- 2. PIN IT TO THE GRAPH ----
2.1 roll_call → the knowledgeId of THIS repository (match `git remote get-url origin`)
    and its lastIndexedCommit. A search (stakeout, manhunt) takes them as
    repos=[{knowledgeId, commitHash: <lastIndexedCommit>}]; every other call takes
    knowledgeId and commitHash as arguments. If this repository is
    not on the roster, say so and stop: it has to be indexed before its dependents are
    known.
2.2 Drift: when lastIndexedCommit exists locally, `git rev-list --count
    <lastIndexedCommit>..HEAD`. Report it in the header; never stop on it.
2.3 Resolve the target to FILES and UNITS at the indexed commit:
    a. file   → case_file(relativePath). A range keeps the units whose startLine–endLine
                overlap it.
    b. empty  → case_file on each changed file; units = the enclosing symbols of
                `git diff -U0` hunk headers (the name after @@), matched by NAME, never
                by line number — the graph holds a different commit than your disk.
    c. symbol → manhunt(name) → its file → as a.
    d. pasted → pick the two most specific identifiers or string literals in it and run
                manhunt and shakedown on them, in one turn. The unit whose source matches
                is the target; confirm with the_receipts before you say so.
                Nothing matches → it is NEW code. Its blast radius is what it touches:
                the names it calls, imports or extends. Resolve those with manhunt and
                treat each resolved file as the target, heading the answer
                "New code — not in the graph; impact of what it uses".

---- 3. WHO DEPENDS ON IT ----
3.1 collateral_damage(relativePath, lens=['imports','callers','contracts','types',
    'packages','surfaces','keywords']) on every target file, in one turn.
    Rows are FILES, not lines, and each is a candidate, not yet evidence.
    · `callers` rows carry `via`: the target's functions that row calls. With a unit
      target, keep the rows whose `via` names it, first.
    · CHECK THE PATH ON EVERY ROW. A same-repo row whose path cannot belong to this
      repository leaked from another one: drop it and count it in the footer.
    · Skip upstream rows (the target's own imports, the dependencies lens): they answer
      "what does this use", not "what breaks".
3.2 For a unit exported from a package this repository publishes: cross_repo_lookup on
    the symbol or package name. One call reaches every repository.
3.3 THE LINE. For each dependent file: shakedown for the `via` name (or the target's
    name) in that file, then the_receipts on the hit to read the verbatim line. A row
    you cannot confirm that way goes under Possible with no line number. Never guess a
    line, never drop a row silently.
3.4 RULE 1: the purpose/summary prose the graph returns was written by a model. It says
    where to look, not what the code does. Every line you show was read with the_receipts.

Batch every independent call into one turn.

---- 4. ANSWER — the IDE's Find All References panel ----
Never name a Plumbline tool in the answer. Paths are repo-relative, written path:line,
prefixed with the repository name when more than one repository appears.

Impact of <target> (<path>) — indexed at <short commit>, your HEAD is <n> commits ahead

Direct — <n> references in <m> repos

  <repo>  (<count>)  · same repo
    <path>:<line>            <verbatim source line, trimmed>

Through a published package — <package>
  <repo>  (<count>)
    <path>:<line>            <verbatim source line>

Possible — shared type or keyword, no call confirmed  (<count>)
  <repo>/<path>                                  <why: uses type X / keyword Y>

<n> references · <f> files confirmed · <p> possible · <l> leaked rows dropped

Order: Direct (imports, callers, contracts, surfaces) → Through a published package →
Possible (types, keywords). Within a group, repositories by reference count, descending.
Nothing found: "No references outside <path>. Checked: imports, callers, contracts,
packages, types, keywords." — an empty result is a claim about those edges only.
