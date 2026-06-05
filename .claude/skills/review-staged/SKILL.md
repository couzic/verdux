---
name: review-staged
description: Review the staged diff and audit any touched src/operation/ file against OPERATION_CONTRACT.md, reporting contract drift.
disable-model-invocation: true
allowed-tools: Bash(git diff --cached *), Bash(cat *), Bash(grep *), Bash(find *), Bash(git ls-files *), Read, Agent
---

# /review-staged

Audit the **staged** diff for operation-contract drift.

## Full staged diff (all files)

!`git diff --cached --stat`

## Staged files under `src/operation/`

!`git diff --cached --name-only -- src/operation/`

## Tracked `.md` docs

!`git ls-files '*.md'`

## The contract

!`cat src/operation/OPERATION_CONTRACT.md`

## What to do

1. **Scope.** Use the staged file list above. Consider only files under
   `src/operation/` (ignore everything else in the staged diff). Skip `*.md`,
   `*.test.ts`, and `*.error.test.ts` — audit the **operation implementation**
   files. If no operation implementation files are staged, say so and stop.

2. **Fan out — one subagent per touched operation file.** For each staged
   operation file, spawn one `Agent` subagent with this brief:

   > Read `src/operation/OPERATION_CONTRACT.md` and the file `<path>` (its staged
   > content — read the file from disk). Run the contract's **Review checklist**
   > against the file, point by point. The auditor is **read-only and static**:
   > do **not** edit any file, do **not** run tests or mocha, do **not** run the
   > graph. For each checklist item report PASS / DRIFT / N-A with the precise
   > line(s) and a one-line justification. Classify each DRIFT as either
   > **behavioral** (the operation would mis-handle an error at runtime — escape,
   > wrong containment, missing `catchError`, completing the stream, wrong
   > field/effect degradation) or **non-behavioral** (style, missing test,
   > comment/doc). Return a compact structured list of findings; this is data for
   > a synthesizer, not a human-facing message.

   Run the subagents in parallel (independent files).

3. **Fan out — one doc-sync subagent (always, in parallel with the above).**
   The whole staged diff — not just `src/operation/` — may make a `.md` doc
   stale. Spawn one `Agent` subagent with this brief:

   > Read the **full staged diff** (`git diff --cached`) and the tracked `.md`
   > docs listed above (`ARCHITECTURE.md`, `CLAUDE.md`, `ISSUES.md`,
   > `ROADMAP.md`, `src/operation/OPERATION_CONTRACT.md`, `src/operation/CLAUDE.md`,
   > `README*.md`, and any others). For each doc, decide whether the staged
   > changes make it **stale, contradicted, or incomplete** — e.g. an operation's
   > error-handling changed but `OPERATION_CONTRACT.md` / the operation CLAUDE.md
   > still describe the old behavior; a runtime change under `src/run/` or
   > `src/operation/` that `ARCHITECTURE.md` documents; a resolved defect still
   > listed in `ISSUES.md`; a landed item still in `ROADMAP.md`; a new
   > command/skill or API not reflected in `README`/`CLAUDE.md`. You are
   > **read-only**: do not edit any doc, do not run tests. Report per doc:
   > IN-SYNC or STALE, and for each STALE the specific doc section + the staged
   > change that contradicts it + the one-line edit it needs. This is data for a
   > synthesizer, not a human-facing message.

   Also enforce the repo's doc-discipline rules while judging staleness:
   `ISSUES.md` lists only **currently existing** issues (resolved ones must be
   removed, not ticked); `ROADMAP.md` holds only **not-yet-done** work (landed
   items must be deleted, no "done" section).

4. **Synthesize.** Merge the operation auditors' and the doc-sync subagent's
   reports into one drift report grouped by file, ordered behavioral-DRIFT first,
   then doc staleness, then non-behavioral, then a clean-files line. For each
   behavioral DRIFT cite file:line and the checklist item it violates.

5. **Reproduce before reporting any behavioral finding (CLAUDE.md rule).** A
   subagent's behavioral DRIFT is a **code-reading hypothesis, not a finding**.
   Before stating it as real, reproduce it on a full graph in the **main thread**
   — `createGraph({ vertices: [...] })` + `graph.dispatch(...)` + a public read
   (`getVertexInstance(config).currentState` / `currentLoadableState` / `pick`).
   Verify repros **one at a time** in the main thread: mocha's `src/**/*.test.ts`
   spec glob has no `--ignore`, so parallel runs sweep the whole suite and
   collide. Demote any behavioral DRIFT you cannot reproduce to "unconfirmed
   hypothesis" and label it as such.

6. **Report only.** This command **does not fix anything** — it reports drift.
   End with: confirmed behavioral drift (with repro), unconfirmed hypotheses,
   stale docs (with the section + the one-line edit each needs), non-behavioral
   drift, and clean files.
