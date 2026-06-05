---
name: review-staged
description: Read-only review of the full staged diff through five parallel lenses (correctness, operation-contract, test-integrity, dead-code, doc-sync); reports findings as hypotheses without fixing or reproducing.
disable-model-invocation: true
allowed-tools: Bash(git diff --cached *), Bash(git ls-files *), Read, Agent
---

# /review-staged

Review the **entire staged** diff for correctness, and additionally audit any
touched `src/operation/` file against the operation-error-handling contract.

The fan-out is **by review dimension, not by file**: each subagent reads the
*whole* staged diff but hunts for one class of issue. The agent count is fixed
(it does not scale with the number of staged files), and the two concerns this
repo cares about most — operation-contract compliance and whether each fix
actually ships a test that guards it — are cross-file lenses that a per-file
split could not express.

The command is strictly **read-only**: it surfaces findings as hypotheses and
never edits, reproduces, or runs anything. Confirming a behavioral hypothesis
(reproducing it on a full graph) and fixing it are deliberate follow-ups you
decide on after reading the report.

## Staged diff summary (all files)

!`git diff --cached --stat`

## All staged files

!`git diff --cached --name-only`

## Staged files under `src/operation/`

!`git diff --cached --name-only -- src/operation/`

## Tracked `.md` docs

!`git ls-files '*.md'`

## The contract

The operation-error-handling contract — including its **Review checklist** — lives
in `src/operation/OPERATION_CONTRACT.md`. The operation-contract lens (step 2b)
reads it on demand; it is **not** inlined here.

## What to do

1. **Scope.** Use the staged file list above. If nothing is staged, say so and
   stop. Note the subset of staged files under `src/operation/` — the
   operation-contract lens (step 2b) audits those.

2. **Fan out — five dimension subagents, all in parallel.** Each reads the
   **full staged diff** (`git diff --cached`) and reads surrounding code as
   needed. Each is **read-only and static**: it must **not** edit any file,
   **not** run tests or mocha, and **not** run the graph. Each does a
   **whole-diff scan** — read the diff holistically through its one lens and
   report what stands out (not an exhaustive file-by-file walk). Every code-lens
   agent classifies each finding as **behavioral** (wrong runtime behavior — an
   error escapes or is mis-contained, a stream completes when it shouldn't, a
   field or effect degrades wrongly, a wrong value is produced) or
   **non-behavioral** (style, missing test, comment/doc), cites `file:line`, and
   returns a compact structured list — this is data for a synthesizer, not a
   human-facing message.

   **2a. Correctness / behavioral.**

   > Scan the full staged diff for correctness bugs and regressions: broken or
   > unstated invariants, mishandled edge cases and error paths, type-safety
   > holes, races/ordering issues, resource/subscription leaks, and plain wrong
   > values. Report each with `file:line` and a one-line explanation of the
   > wrong behavior.

   **2b. Operation-contract.**

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
   > nothing real? Flag fixes landing with no guarding test, tests that pass
   > regardless of the fix, and any test carrying issue IDs (C2, O1, H3…) or
   > "pre-fix"/historical narration (violates code-is-timeless). Report each with
   > `file:line`.

   **2d. Dead / redundant code.**

   > Scan the full staged diff for dead or contradictory code (unreachable
   > branches, leftovers, code that contradicts itself) and clear quality issues
   > (duplication, needless complexity, poor naming). Report each with
   > `file:line`, kept separate from correctness.

   **2e. Doc sync.**

   > Read the **full staged diff** (`git diff --cached`) and the tracked `.md`
   > docs listed above (the authoritative set from `git ls-files '*.md'` —
   > including but not limited to `ARCHITECTURE.md`, `CLAUDE.md`, `ISSUES.md`,
   > `ROADMAP.md`, `src/operation/OPERATION_CONTRACT.md`,
   > `src/operation/CLAUDE.md`, and any `README*` / `claude-code-plugin/**`
   > docs). For each doc, decide whether the staged changes make it **stale,
   > contradicted, or incomplete** — e.g. an operation's error-handling changed
   > but `OPERATION_CONTRACT.md` / the operation CLAUDE.md still describe the old
   > behavior; a runtime change under `src/run/` or `src/operation/` that
   > `ARCHITECTURE.md` documents; a resolved defect still listed in `ISSUES.md`;
   > a landed item still in `ROADMAP.md`; a new command/skill or API not
   > reflected in `README`/`CLAUDE.md`. Read-only: do not edit any doc, do not
   > run tests. Report per doc: IN-SYNC or STALE, and for each STALE the specific
   > doc section + the staged change that contradicts it + the one-line edit it
   > needs. Also enforce the repo's doc-discipline rules: `ISSUES.md` lists only
   > **currently existing** issues (resolved ones removed, not ticked);
   > `ROADMAP.md` holds only **not-yet-done** work (landed items deleted, no
   > "done" section). This is data for a synthesizer, not a human-facing message.

3. **Synthesize.** Merge the five reports into one review grouped by file,
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
