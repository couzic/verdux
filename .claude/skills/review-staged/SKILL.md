---
name: review-staged
description: Read-only review of the full staged diff through five parallel lenses (correctness, operation-contract, test-integrity, dead-code, doc-sync); reports findings as hypotheses without fixing or reproducing.
disable-model-invocation: true
allowed-tools: Agent, Grep, Read, Bash(git diff *), Bash(git show *), Bash(git ls-files *)
---

# /review-staged

Review the **entire staged** diff for correctness, and additionally audit any
touched `src/operation/` file against the operation-error-handling contract.

The fan-out is **by review dimension, not by file**: each subagent receives the
*whole* staged diff inline but hunts for one class of issue. The agent count is
fixed (it does not scale with the number of staged files), and the two concerns
this repo cares about most — operation-contract compliance and whether each fix
actually ships a test that guards it — are cross-file lenses that a per-file
split could not express.

The command is strictly **read-only — enforced by construction, not by prose.**
Only this orchestrator touches git, and its `allowed-tools` permit *read-only*
git alone (`git diff`, `git show`, `git ls-files`) — no mutation. The review
subagents (up to five) run as the `staged-reviewer` agent, which has **no Bash and no
write tools at all** (`tools: Read, Grep`): they physically cannot run git, run
tests, run the graph, or edit/stash/checkout/reset anything. The orchestrator
feeds each one the staged diff inline. So the read-only guarantee rests on tool
grants on both sides, not on instructions a subagent could ignore.

The command surfaces findings as hypotheses and never reproduces or fixes
anything. Confirming a behavioral hypothesis (reproducing it on a full graph)
and fixing it are deliberate follow-ups you decide on after reading the report.

## Staged diff summary (all files)

!`git diff --cached --stat`

## All staged files

!`git diff --cached --name-only`

## Staged files under `src/operation/`

!`git diff --cached --name-only -- src/operation/`

## Tracked `.md` docs

!`git ls-files '*.md'`

## Full staged diff

This is the single source the subagents review — pass it to each one inline
(they cannot run git themselves).

!`git diff --cached`

## The contract

The operation-error-handling contract — including its **Review checklist** — lives
in `src/operation/OPERATION_CONTRACT.md`. The operation-contract lens (step 2b)
reads it on demand; it is **not** inlined here.

## What to do

1. **Scope.** Use the staged file list above. If nothing is staged, say so and
   stop. Note the subset of staged files under `src/operation/` that are
   operation **implementations** (exclude `*.test.ts`) — the operation-contract
   lens (step 2b) audits exactly those. **If that subset is empty, lens 2b has
   nothing to do: skip it entirely** and fan out only the other four.

2. **Fan out — up to five dimension subagents, all in parallel.** Spawn the
   **applicable** lenses as the `staged-reviewer` agent
   (`subagent_type: staged-reviewer`) in one batch: **2a, 2c, 2d, 2e always; 2b
   only if step 1 found a staged operation implementation** (otherwise omit it —
   don't spawn an agent that has nothing to audit). That agent is
   `tools: Read, Grep` — no Bash — so **you** are the only actor with git access;
   the subagents get their inputs from you.

   Into **every** subagent's prompt, paste:

   - the **Full staged diff** from the section above (their primary source — its
     `-` lines are the pre-change source, its `+` lines the post-change source);
   - the **one lens** below (2a–2e) telling it what to hunt for;
   - for the lenses that name extra inputs (2b the contract path, 2e the doc
     list, 2c any pre-change context), the material that lens calls for — see
     each lens. Where a lens needs code **outside** the diff hunks, fetch it
     yourself with `git show HEAD:<path>` and paste it in; never ask the subagent
     to run git.

   Each subagent does a holistic **whole-diff scan** through its one lens (not an
   exhaustive file-by-file walk), uses Read/Grep for surrounding unchanged code,
   classifies every finding as **behavioral** (wrong runtime behavior — an error
   escapes or is mis-contained, a stream completes when it shouldn't, a field or
   effect degrades wrongly, a wrong value is produced) or **non-behavioral**
   (style, missing test, comment/doc), cites `file:line`, and returns a compact
   structured list — data for the synthesizer, not a human-facing message.

   **2a. Correctness / behavioral.**

   > Scan the full staged diff for correctness bugs and regressions: broken
   > invariants (including ones the diff implicitly relies on), mishandled edge
   > cases and error paths, type-safety holes, races/ordering issues,
   > resource/subscription leaks, and plain wrong values. Report each with
   > `file:line` and a one-line explanation of the wrong behavior.

   **2b. Operation-contract.** *(Only spawned when a `src/operation/`
   implementation is staged — see step 1.)*

   > Read `src/operation/OPERATION_CONTRACT.md`. For each staged
   > `src/operation/` file that is an operation **implementation** (not a
   > `*.test.ts`), run the contract's **Review checklist** against it point by
   > point, reporting PASS / DRIFT / N-A with precise line(s) and a one-line
   > justification per item. Surface every DRIFT as a behavioral finding naming
   > the checklist item it violates.

   **2c. Test integrity.**

   > Judge the staged tests against this repo's testing discipline (CLAUDE.md).
   > For each staged behavioral fix, does it ship a **full-graph public-API**
   > test (`createGraph` + `dispatch` + a public read) that would actually go
   > **red** without the source change — or is the test tautological / asserting
   > nothing real? Reason **statically** from the diff — its `-` lines are the
   > pre-change source. (If judging this needs code outside the hunks, the
   > orchestrator pastes the relevant `git show HEAD:<path>` excerpt in; you never
   > run git yourself.) Flag fixes landing with no guarding test, tests that pass
   > regardless of the fix, and any test carrying issue IDs (C2, O1, H3…) or
   > "pre-fix"/historical narration (violates code-is-timeless). Report each with
   > `file:line`.

   **2d. Dead / redundant code.**

   > Scan the full staged diff for dead or contradictory code (unreachable
   > branches, leftovers, code that contradicts itself) and clear quality issues
   > (duplication, needless complexity, poor naming). Report each with
   > `file:line`, kept separate from correctness.

   **2e. Doc sync.**

   > Using the staged diff you were given and the tracked `.md` docs listed above
   > — the authoritative `git ls-files '*.md'` set the orchestrator pasted in,
   > including but not limited to `ARCHITECTURE.md`, `CLAUDE.md`, `ISSUES.md`,
   > `ROADMAP.md`, `src/operation/OPERATION_CONTRACT.md`,
   > `src/operation/CLAUDE.md`, and any `README*` / `claude-code-plugin/**` docs;
   > open each with Read — decide for each doc whether the staged changes make it
   > **stale, contradicted, or incomplete** — e.g. an operation's error-handling changed
   > but `OPERATION_CONTRACT.md` / the operation CLAUDE.md still describe the old
   > behavior; a runtime change under `src/run/` or `src/operation/` that
   > `ARCHITECTURE.md` documents; a resolved defect still listed in `ISSUES.md`;
   > a landed item still in `ROADMAP.md`; a new command/skill or API not
   > reflected in `README`/`CLAUDE.md`. Report per doc: IN-SYNC or STALE, and
   > for each STALE the specific
   > doc section + the staged change that contradicts it + the one-line edit it
   > needs. Also enforce the repo's doc-discipline rules: `ISSUES.md` lists only
   > **currently existing** issues (resolved ones removed, not ticked);
   > `ROADMAP.md` holds only **not-yet-done** work (landed items deleted, no
   > "done" section).

3. **Synthesize.** Merge the lens reports into one review grouped by file,
   ordered behavioral hypotheses first (including any operation-contract DRIFT),
   then doc staleness, then non-behavioral findings, then a clean-files line.
   **Dedup across lenses** — one defect can surface under more than one lens
   (e.g. a dead branch that is also a bug); collapse those to a single finding.
   Cite `file:line` for every finding, and for a contract DRIFT name the
   checklist item it violates.

4. **Report only — read-only, no reproduction.** This command flags issues; it
   **does not** fix anything, mutate the index/working tree, run tests, or run
   the graph. Per the CLAUDE.md rule, a behavioral finding is only *real* once
   reproduced on a full graph — so every behavioral finding here is a
   **code-reading hypothesis, not a confirmed defect**. Report each as such, with
   a one-line **suggested repro** (the vertices + `dispatch` + public read it
   would take to confirm). Whether to actually reproduce any hypothesis is a
   **separate follow-up the user opts into** — not part of this command. End with:
   behavioral hypotheses (each with its suggested repro), stale docs (section +
   the one-line edit each needs), non-behavioral findings, and clean files.
