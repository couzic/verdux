# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm test` — run the full mocha test suite (dot reporter). Tests are colocated as `*.test.ts` under `src/` and executed via `ts-node/register/transpile-only` — types are **stripped, not checked**, so `npm test` passing does **not** mean the code compiles. This is deliberate: it cuts suite startup from ~18s to ~3s. Type errors are caught separately by `npm run typecheck` (and by `tsc` in `npm run build`).
- `npm run typecheck` — `tsc -p tsconfig.typecheck.json` (`--noEmit` over **all** of `src/`, tests included; `skipLibCheck` on). This is the only thing in the test/check loop that actually validates types. The root `tsconfig.json` only compiles the `src/index.ts` entrypoint, so plain `tsc --noEmit` would silently ignore type errors in test files — always use the `typecheck` script.
- `npm run tdd` — mocha watch mode.
- Run a single test file: `npx mocha src/path/to/thing.test.ts`. Filter by name with `--grep "<pattern>"`.
- `npm run build` — runs `npm test` first, clears `./lib`, then `tsc` + `doctoc`. The build's `tsc` type-checks (and emits) the `src/index.ts` library graph but **not** the tests. There is no separate lint step; Prettier config lives in `.prettierrc` (3-space tabs, no semis, single quotes, no trailing commas).

**Before handing control back to the user, always run BOTH `npm test` and `npm run typecheck`** when you've touched any code — tests no longer type-check, so green tests alone can hide a compile error. The two are independent, so run them **in parallel** (e.g. both in a single batch of tool calls, or `npm test & npm run typecheck & wait`). Report both results.

TS config extends `config/base/tsconfig.json` and only compiles from the `src/index.ts` entrypoint (target es5, lib es2015, strict on). Don't rely on newer lib types without updating the base config. `tsconfig.typecheck.json` widens the include to all of `src/**` for the `typecheck` script.

### Plugin example code is checked separately

The repo also ships a Claude Code plugin under `claude-code-plugin/`. The `examples/` files in its skills are **real compiled code**, not snippets — guarded by a dedicated harness in `claude-code-plugin/example-check/` that type-checks every `../skills/**/examples/*.ts{,x}` against live source (`verdux` → `src/index.ts`) and runs the example tests. Root `npm test` does **not** cover them. After editing any skill or its examples, run the harness from `claude-code-plugin/example-check/`:

```bash
npm run typecheck   # tsc --noEmit over all example + sample files
npm test            # runs the example tests
```

See `claude-code-plugin/example-check/README.md` for what it covers.

## ISSUES.md

`ISSUES.md` documents only **currently existing** issues. Once an issue is resolved, remove it from `ISSUES.md` entirely — do not keep it marked as resolved.

## ROADMAP.md

`ROADMAP.md` tracks **planned work** not yet done — features to build and fixes to make (it points back to `ISSUES.md` for defect detail). Check it at the start of a session to see what was planned but not finished; remove items as they land. The operation error-handling rules it refers to live in `src/operation/OPERATION_CONTRACT.md`.

## Architecture

`verdux` is a state-management library layering a reactive DAG of "vertices" on top of a single `@reduxjs/toolkit` store and `rxjs`. Mental model: one Redux store holds a nested tree of reducer states; an RxJS pipeline transforms each Redux action into a *graph run* that flows through vertices in topological order, producing per-vertex `fields` (state + computed + loaded data).
For a deep dive into the runtime mechanism — the single flat, topologically-ordered RxJS pipeline, the `reduxPathByVertexId` substate derivation, async loadable emissions, and the invariants that keep them from corrupting sibling state — see `ARCHITECTURE.md`. Read it before changing anything under `src/run/` or `src/operation/`.

### Runtime flow (read in this order)

1. `src/graph/createGraph.ts` — entry point. Builds the Redux store, injects `verduxMiddleware` that pushes each dispatched action into `graphRunInput$` (a `Subject<GraphRunData>`). Subscribes to `graphRunOutput$` and (a) drains FIFO queues for `fieldsReactions`, `reactions`, `sideEffects`, re-dispatching reaction actions back through Redux, and (b) calls `vertexInstance.__pushFields(...)` to publish new field values to subscribers. The initial run is kicked off by a synthetic `graphRunInput$.next({ action: undefined, initialRun: true, ... })`.
2. `src/graph/computeGraphCoreInfo.ts` — builds `GraphCoreInfo`: sorted vertex list, `vertexConfigsByClosestCommonAncestorId` (DAG → tree of subgraph nesting), `trackedActionsInSubgraph`, `vertexIdsInSubgraph`, operations/dependencies per vertex, and a nested Redux `rootReducer` shaped as `{ vertex, downstream: { [childName]: ... } }`.
3. `src/run/runSubgraph.ts` + `src/run/runVertex.ts` — construct the RxJS pipeline. Each vertex runs its operations (`computeFromFields`, `load*`, `reaction*`, …) via `operationsByVertexId`. Subgraphs short-circuit when neither the vertex's Redux slice, a tracked upstream field, nor a tracked action changed (`subgraphShouldRun`). This is the mechanism that prevents unnecessary recomputation/re-render.
4. `src/vertex/createVertexInstance.ts` / `VertexInstance.ts` — the public per-vertex handle exposed by `graph.getVertexInstance(config)`: `currentState`, `state$`, `currentLoadableState`, `loadableState$`, `pick(fields)`.

### Config API layering

User-facing config is built fluently but dispatch of operations is deferred so dependencies can be injected at graph-creation time:

- `configureRootVertex` / `configureVertex` (`src/config/`) build a `VertexConfigImpl`. Fluent methods (`computeFromFields`, `load`, `loadFromFields`, `reaction`, `reaction$`, `fieldsReaction`, `sideEffect`, `withDependencies`, …) do **not** run immediately — they push closures into `_operationsToInject`.
- `VertexConfigImpl.resolveOperations(dependencies)` is called once per vertex during `computeGraphCoreInfo`, replaying those closures against a `VertexOperationsBuilder` to produce the actual RxJS operators (`VertexRun[]`) and the list of `trackedActions`.
- `configureDownstreamVertex` on an existing config wires a child with optional `upstreamFields` (tracked for change detection) and `dependencies` (derived from the parent's dependency object). `injectedWith(partialDeps)` wraps a config for test/DI overrides; `createGraph` accepts either bare configs or injected wrappers — see `isInjectedConfig`.
- Individual operation implementations live in `src/operation/`. Each is a small RxJS operator over `VertexRunData` (one file per operation, plus its `.test.ts`). Look here when changing semantics of `load`, `computeFromFields`, etc.

### Operation error-handling contract

**Every operation must contain its own *runtime* errors** — an error from user-supplied code that escapes an operation reaches the single graph subscription, which is fail-fast (it logs, then the **whole graph stops**; it is not a recovery boundary). Field-producing ops degrade to an `error`-status field (no logging); effect/reaction ops log a `[verdux] … threw` diagnostic and skip. All diagnostics (and the fail-fast graph handler) route through `reportError` (`src/graph/VerduxLogger.ts`), which uses the optional `logger` passed to `createGraph({ logger })` and falls back to `console.error` — never call `console.error` directly. The one deliberate exception is a **return-contract breach** — an Observable-returning loader/computer/mapper that throws when called or returns a non-Observable is a programming error and *fails fast* on purpose, never contained. Every operation ships a full-graph error test.

The full rules, invariants, out-of-scope cases, and review checklist live in the single source of truth: **[`src/operation/OPERATION_CONTRACT.md`](src/operation/OPERATION_CONTRACT.md)** (pointed to by `src/operation/CLAUDE.md`).

### Fields vs. Redux state

Redux holds only the slice reducers' state. A vertex's public "fields" are a richer shape (`VertexFieldsDefinition`) that includes loadable fields with `{ status: 'loading' | 'loaded' | 'error', value, ... }`. `src/state/` contains the conversion helpers (`toVertexState`, `toVertexLoadableState`, `pickFields`, `pickLoadableState`). When editing field/state logic, check both the `VertexState` (flat values) and `VertexLoadableState` (status-aware) views — they're both part of the public surface via `VertexInstance`.

### DevTools hook

`createGraph({ devtools })` accepts a `VerduxDevTools` implementation (`src/devtools/VerduxDevTools.ts`). It receives serialized graph structure and every run output (`serializeGraphStructure`, `serializeGraphRunData`) and can push forced field values back via `provideForceGraphRunOutput` (time-travel). Keep these serializers in sync with `GraphRunData` / `GraphCoreInfo` shape changes.

## Testing approach

Per the README, tests treat a vertex as a cohesive unit: build a fresh `graph = createGraph({ vertices: [...] })` in `beforeEach`, `graph.dispatch(...)` actions, then assert against `vertex.currentState` / `currentLoadableState`. Avoid testing reducers/selectors in isolation — the integration between Redux state, computed fields, and loaders is what matters. Operation-level unit tests (`src/operation/*.test.ts`) exist but they feed `VertexRunData` directly through a single RxJS operator; follow that pattern only when adding a new primitive operation.

**A bug is only real if it can be demonstrated against the public API on a full graph.** Before claiming a defect (or writing a regression test for one), reproduce it through `createGraph({ vertices: [...] })` + `graph.dispatch(...)` + a public read (`getVertexInstance(config).currentState` / `currentLoadableState` / `pick(...)`, or the `devtools` hook). Reasoning from the internal code — "this function would throw", "this comparison ignores X" — is a hypothesis, not a finding; the pipeline has internal structure (gating, `share()`, per-operation behavior) that routinely makes an apparent internal defect unobservable, or conversely surfaces it only in specific full-graph configurations. Super-focused unit tests (feeding a single function/operator directly) are a good *complement* once the public-API failure is shown — they pin the root cause and fail fast — but they are not a substitute, and an internal unit test that fails while no full-graph public-API behavior is wrong does not, by itself, justify a change. Write the full-graph failing test first; add the narrow unit test second.

**STRICT ORDER — write the test, SEE IT FAIL, then fix. Never the reverse.** This is non-negotiable and applies to every bug fix, no matter how obvious the one-line fix looks. The required sequence, in order:

1. Write the full-graph public-API test on the **otherwise-unmodified tree** (no source change yet).
2. Run it and **watch it fail.** Paste the red output (the assertion message, e.g. `expected +0 to equal 1`) into your working log/response. This is the proof-of-order artifact — without it you have not followed the rule.
3. **Only now** edit the source.
4. Run again; watch it pass.

**Closing the loophole that has been exploited before:** fixing first and *then* reverting the fix to confirm the test goes red is **NOT compliance** — it is the exact violation this rule exists to stop. Fix-first-then-revert produces an end state *identical* to test-first (test + fix + a test that fails on revert), so no diff, commit, or after-the-fact check can distinguish them; the only thing that proves you reproduced the bug rather than reasoned your way to a plausible fix is observing the failure **first, live, on the clean tree.** Revert-to-red is a useful *additional* check, never a substitute for step 2. If you catch yourself having edited source before seeing red: stash the source change, run the test, see it fail, then reapply — and say so plainly.

**The full-graph public-API test MUST be committed together with the fix.** A bug fix is incomplete without the failing-then-passing public-API test in the *same commit* — otherwise nothing stops the bug from resurfacing. The test must actually guard the fix: confirm it goes red when the fix is reverted and green with it in place (e.g. temporarily restore the pre-fix code, run the test, see it fail, restore the fix). A narrow unit test alone is not enough to close a bug — it proves a function behaves, not that the bug is gone from the live graph (the pipeline's gating/`share()`/single-subscription structure means a unit-level fix can pass while the graph still misbehaves, or vice versa).
