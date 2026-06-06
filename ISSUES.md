# Known issues

This file documents only **currently existing** issues. When an issue is resolved,
remove it from this file entirely (do not keep it marked "fixed").

The verified, reproduced-on-a-full-graph defects from the 2026-06-02 multi-agent review
have all been fixed and removed. The issues below come from that static review and were
re-checked on **2026-06-05**. One original claim — a dead `rootVertexConfig` in the
middleware — was refuted (it is used at `createGraph.ts:62`) and dropped.

## How each issue was verified

Every issue carries a **Verified** tag describing the strongest evidence gathered so far:

- **`run`** — reproduced by executing code (a throwaway full-graph mocha test driven
  through `createGraph` + the public read API, or `tsc` for type claims). The repro code
  is included below; the throwaway files were not kept.
- **`static`** — a code-level fact established definitively by reading/grep (dead code,
  missing exports, docs, build config). No runtime needed.
- **`reasoned`** — the code clearly *says* this, but it was **not** reproduced through the
  public API (no public trigger exists, or only the structural cause — not its runtime
  effect — was confirmed). Per CLAUDE.md these stay hypotheses until a full-graph failing
  test demonstrates them.

## Working these issues (CLAUDE.md rules — read before fixing)

For every behavioural fix, in this exact order (non-negotiable, see CLAUDE.md):

1. Write the **full-graph public-API** test (`createGraph({ vertices })` → `dispatch` →
   a public read) on the **unmodified** tree.
2. Run it and **watch it fail.** Capture the red assertion output.
3. **Only then** edit the source.
4. Run again; watch it pass.
5. Commit the failing-then-passing test **in the same commit** as the fix. Confirm it goes
   red when the fix is reverted.

A narrow operation-level unit test (feeding `VertexRunData` through one operator) is a good
*complement* but never a substitute for the full-graph test. The repro snippets below are
starting points for step 1, not finished tests.

Operation error-handling semantics live in
[`src/operation/OPERATION_CONTRACT.md`](src/operation/OPERATION_CONTRACT.md).

---

## Summary

| ID | Issue | Verified | Area | Severity |
|----|-------|----------|------|----------|
| [BUG-3](#bug-3--devtools-provideforcegraphrunoutput-crashes-when-a-run-omits-a-vertex) | devtools `provideForceGraphRunOutput` crashes on omitted vertex | `run` | devtools | Medium |
| [ROB-1](#rob-1--extractreduxstate-assumes-every-downstream-step-exists) | `extractReduxState` assumes every `.downstream[name]` exists | `reasoned` | run | Low |
| [ROB-2](#rob-2--no-cycle-detection) | No cycle detection (not constructible via public API) | `reasoned` | config | Low |
| [DOC-1](#doc-1--stale-doc-symbols--broken-readme-anchor) | Stale doc symbols & broken README anchor | `static` | docs | Low |
| [BUILD-1](#build-1--mocha-glob-has-no-ignore) | Mocha glob has no `--ignore` | `static` | build | Low |

---

## BUG-3 — devtools `provideForceGraphRunOutput` crashes when a run omits a vertex

- **Verified:** `run`
- **Location:** `src/graph/createGraph.ts:79-87`.
  ```ts
  devtools.provideForceGraphRunOutput((runOutput: GraphRunData) => {
     vertexConfigs.forEach(config => {
        const fields = runOutput.fieldsByVertexId[config.id]
        const fieldNames = Object.keys(fields)   // throws if fields is undefined
        ...
  ```
- **Symptom:** Time-travel/forced replay that omits a vertex from `fieldsByVertexId` makes
  `fields` undefined; `Object.keys(undefined)` throws
  `TypeError: Cannot convert undefined or null to object`, taking down the forced run.
- **Reproduction:**
  ```ts
  import { createSlice } from '@reduxjs/toolkit'
  import { configureRootVertex } from './config/configureRootVertex'
  import { createGraph } from './graph/createGraph'

  let forceCb: ((runOutput: any) => void) | undefined
  const devtools: any = {
     sendGraphStructure: () => {},
     sendGraphRunOutput: () => {},
     provideForceGraphRunOutput: (cb: any) => { forceCb = cb },
     provideSerializeGraphRunData: () => {}
  }
  const root = configureRootVertex({
     slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
  })
  const child = root.configureDownstreamVertex({
     slice: createSlice({ name: 'child', initialState: {}, reducers: {} })
  })
  createGraph({ vertices: [root, child], devtools })

  forceCb!({ fieldsByVertexId: { [root.id]: {} } }) // child omitted → TypeError
  ```
- **Fix direction:** Guard the lookup — `if (!fields) return` (skip vertices absent from
  the forced output) or default to `{}`. Decide whether an omitted vertex should keep its
  current fields or be cleared.
- **Status — deferred (pending devtools return).** The crash is reachable **only** from the
  devtools forced-replay path (`createGraph.ts:82`). The normal dispatch path is
  structurally immune: every run output rebuilds `fieldsByVertexId` as
  `{ ...latestInputFieldsByVertexId, ...latestOutputFieldsByVertexId }`
  (`runSubgraph.ts:98-105`), so it always carries every vertex, and the `sendGraphRunOutput`
  payload devtools captures is therefore never partial. An omitted vertex is thus never a
  faithfully-captured graph state — so no non-devtools user can hit this, and it stays latent
  until the devtools (currently a prototype in a separate folder) is brought back into this
  repo. The skip-vs-clear choice depends on that devtools' actual replay contract, which we
  can read directly once it lands rather than guessing now. Leaning **skip** (`if (!fields)
  return`): a vertex always has slice-derived state, so clearing to `{}` would push an
  unreachable, invalid empty-fields state through `toVertexLoadableState` into subscribers —
  trading a loud crash for silent corruption. Revisit when the devtools code is in-repo.

## ROB-1 — `extractReduxState` assumes every `.downstream[name]` step exists

- **Verified:** `reasoned` (no public trigger found)
- **Location:** `src/run/extractReduxState.ts:~19` —
  `reduxState = reduxState.downstream[reduxPath[i].name]` with no missing-key guard; a
  missing step yields `undefined` and the next iteration throws on `.downstream`.
- **Status:** The structural gap is real, but no public-API path was found that produces a
  malformed `reduxPath`. Per CLAUDE.md, find a full-graph trigger before treating it as a
  bug; if none exists, this is a defensive hardening, not a defect.
- **Fix direction (if pursued):** add a guard/clear error naming the missing step, or prove
  the path is always well-formed and drop the concern.

## ROB-2 — No cycle detection

- **Verified:** `reasoned` (not reproducible)
- **Location:** the recursive `vertexId` getter
  (`src/config/VertexConfigBuilderImpl.ts:24-29`) would recurse unboundedly on a dependency
  cycle, surfacing as `RangeError: Maximum call stack size exceeded` rather than a clear
  error.
- **Status:** **A cycle is not constructible through the public builder** —
  `addUpstreamVertex` / `configureDownstreamVertex` both take an already-built config, so
  the graph is acyclic by construction. No public trigger exists. Keep only as a note;
  there is nothing to test through the public API.

## DOC-1 — Stale doc symbols & broken README anchor

- **Verified:** `static`
- **Items:**
  - `CLAUDE.md` and `ARCHITECTURE.md` §4 name pseudo-code symbols that don't exist as real
    identifiers: `subgraphShouldRun`, `reduxStateHasChanged`, `childWrapperGraphRun`
    (grep of `src/` finds none).
  - `README.md` TOC has two entries pointing at `#reaction` (for `reaction()` and
    `reaction$()`), so the `reaction$()` link misnavigates — the second should target
    `#reaction-1`.
- **Fix direction:** Either rename the pseudo-code to match real identifiers or clearly
  mark it as illustrative pseudo-code; fix the README anchor. Re-run `doctoc` if it manages
  the TOC.

## BUILD-1 — Mocha glob has no `--ignore`

- **Verified:** `static`
- **Location:** `package.json` mocha config — `spec: ["src/**/*.test.ts"]`, no `--ignore`,
  no `.mocharc`.
- **Symptom:** Any stray/untracked `*.test.ts` under `src/` is swept into the run (e.g. a
  throwaway repro file would execute). Low impact but a footgun.
- **Fix direction:** Decide whether to constrain the glob / add an ignore for scratch
  files, or leave as-is and rely on discipline. Lowest priority.
