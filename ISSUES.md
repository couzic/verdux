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
| [TYPE-1](#type-1--fieldsreaction-mapper-value-type-is-not-status-aware) | `fieldsReaction` mapper value type is not status-aware | `run` (tsc) | config types | Medium |
| [ROB-1](#rob-1--extractreduxstate-assumes-every-downstream-step-exists) | `extractReduxState` assumes every `.downstream[name]` exists | `reasoned` | run | Low |
| [ROB-2](#rob-2--no-cycle-detection) | No cycle detection (not constructible via public API) | `reasoned` | config | Low |
| [API-1](#api-1--internal-surface-leaks-from-the-public-types) | Internal surface leaks from the public types | `static` | public API | Medium |
| [DEAD-1](#dead-1--dead-code) | Dead code | `static` | cleanup | Low |
| [PERF-1](#perf-1--avoidable-recomputation--allocation) | Avoidable recomputation / allocation | `static` + `reasoned` | run/config | Low |
| [DOC-1](#doc-1--stale-doc-symbols--broken-readme-anchor) | Stale doc symbols & broken README anchor | `static` | docs | Low |
| [BUILD-1](#build-1--mocha-glob-has-no-ignore) | Mocha glob has no `--ignore` | `static` | build | Low |
| [TEST-1](#test-1--load--loadfromfields-error-paths-lack-a-full-graph-error-test) | `load` / `loadFromFields` error paths lack a full-graph error test | `static` | testing | Low |

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

## TYPE-1 — `fieldsReaction` mapper value type is not status-aware

- **Verified:** `run` (tsc)
- **Location:** `src/config/VertexConfig.ts:275-283`. The mapper `pickedState` is typed
  `{ [PK in K]: Fields[PK]['value'] }` — non-`undefined` even for loadable fields.
- **Symptom:** For a loadable field that may be `loading`/`error` when the reaction fires,
  the picked value is typed as the loaded value (never `undefined`), so user code can read
  `picked.field.deep` with no compile error and hit a runtime `undefined`.
- **Reproduction (compile-time probe; never called):**
  ```ts
  import { createSlice } from '@reduxjs/toolkit'
  import { Subject } from 'rxjs'
  import { configureRootVertex } from './config/configureRootVertex'

  export function _probe() {
     const data$ = new Subject<{ n: number }>()
     const root = configureRootVertex({
        slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
     }).load({ data: data$ })

     root.fieldsReaction(['data'], picked => {
        const n: number = picked.data.n // compiles, but data is undefined when loading/error
        void n
        return null
     })
  }
  ```
  `npm run typecheck` reports **no error** on `picked.data.n` → the type is too loose.
- **Fix direction:** Type `pickedState` status-aware, mirroring `VertexState` (loadable
  fields → `value | undefined`); reuse `VertexState<Pick<Fields, K>>` if it fits. Guard
  the test with the project's type-safety pattern: a never-called fn holding a
  `@ts-expect-error` (compile-time red, TS2578) plus a runtime parity `it()`.

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

## API-1 — Internal surface leaks from the public types

- **Verified:** `static`
- **Locations & specifics:**
  - `src/vertex/VertexInstance.ts:27-30` — `__pushFields(fields, changedFields)` is a
    member of the **exported** `VertexInstance` interface, pulling run-internal
    `VertexFields` / `VertexChangedFields` into the public surface.
  - `PickedLoadableVertexState` (referenced at `VertexInstance.ts:26` in `pick`'s return)
    and `VertexFieldState` (via `VertexFields`) are part of public types but **not
    exported** from `src/index.ts`, so consumers can't name them.
- **Fix direction:** Move `__pushFields` to an internal interface the instance also
  satisfies (keep it off the public `VertexInstance`), **or** export it deliberately if it
  is truly public. Export `PickedLoadableVertexState` and `VertexFieldState` from
  `src/index.ts` (or stop referencing them in public types). No behaviour change — verify
  with `npm run typecheck` and a check that `src/index.ts` re-exports the names.

## DEAD-1 — Dead code

- **Verified:** `static`
- **Items (all confirmed unused by grep across `src/`):**
  - `src/vertex/VertexData.ts` — obsolete post-refactor type, never imported.
  - `src/config/toVertexName.ts` — parses an obsolete `Symbol(Vertex …)` id format;
    `VertexId` is now `string` (`src/vertex/VertexId.ts`); never imported.
  - `src/util/shallowEquals.ts` — never imported, no test.
  - `src/graph/createGraph.ts:38` — the `store` param of `verduxMiddleware` is never used
    in the middleware body.
- **Fix direction:** Delete the three files; drop the unused `store` param (or `_store`).
  `npm run typecheck` + `npm test` must stay green.

## PERF-1 — Avoidable recomputation / allocation

- **Verified:** `static` (structural cause) + `reasoned` (runtime effect not measured)
- **Items:**
  - `findClosestCommonAncestor` (`src/config/VertexConfigBuilderImpl.ts:78-127`) is
    recursive with nested loops and **no memoization**; called per-vertex from
    `computeGraphCoreInfo.ts:93` — ~O(N³) on deep multi-upstream graphs. `static`.
  - `trackedActionsInSubgraph` accumulates **duplicate** actions:
    `computeGraphCoreInfo.ts:183` does `trackedActions.push(...downstream)` per child with
    no dedup, so a diamond pattern adds the same action twice. Structural cause `static`;
    the runtime effect (extra tracked-action checks) was **not** observed through a public
    read — `reasoned`.
- **Fix direction:** Memoize `findClosestCommonAncestor` (cache by config/pair); dedup
  tracked actions with a `Set`. These are optimizations — guard with existing
  `computeGraphCoreInfo.test.ts` behaviour and, ideally, a test asserting no duplicate
  tracked actions for a diamond graph.

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

## TEST-1 — `load` / `loadFromFields` error paths lack a full-graph error test

- **Verified:** `static`
- **Location:** `src/operation/load.error.test.ts`, `src/operation/loadFromFields.error.test.ts`
  (and the leftover `// TODO when loader throws error` at `src/operation/load.test.ts:240`).
- **Symptom:** [`OPERATION_CONTRACT.md`](src/operation/OPERATION_CONTRACT.md) §Testing
  requirement mandates that **every** operation ship a **full-graph** error test —
  `createGraph` + `dispatch`/loader emission + a public read (`currentLoadableState`) —
  proving the error path degrades to an `error`-status field without killing the graph.
  `load.error.test.ts` and `loadFromFields.error.test.ts` cover the loader-error path
  only at the **operation level**: they feed `VertexRunData` straight through the
  `load()` / `loadFromFields()` operator and read the emitted run data, never going
  through the public API. The sibling field ops already comply
  (`loadFromFields$.error.test.ts`, `computeFromFields.error.test.ts`,
  `computeFromFields$.error.test.ts` all build a graph via `createGraph`). So `load`
  and `loadFromFields` are the two field ops missing the contract-required full-graph
  coverage.
- **Fix direction:** Add a full-graph `createGraph({ vertices: [...] })` error test to
  each — a root vertex with a loader whose source errors, asserting the field degrades
  to `{ status: 'error', value: undefined, errors: [error] }` via `currentLoadableState`
  while siblings and the graph stay alive — mirroring `loadFromFields$.error.test.ts`.
  Remove the `// TODO when loader throws error` placeholder once `load`'s test lands.
  Keep the existing operation-level tests as the narrow complement.
