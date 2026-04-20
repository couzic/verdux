# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm test` — run the full mocha test suite (dot reporter). Tests are colocated as `*.test.ts` under `src/` and executed via `ts-node/register`.
- `npm run tdd` — mocha watch mode.
- Run a single test file: `npx mocha --require ts-node/register src/path/to/thing.test.ts`. Filter by name with `--grep "<pattern>"`.
- `npm run build` — runs `npm test` first, clears `./lib`, then `tsc` + `doctoc`. There is no separate lint step; Prettier config lives in `.prettierrc` (3-space tabs, no semis, single quotes, no trailing commas).

TS config extends `config/base/tsconfig.json` and only compiles from the `src/index.ts` entrypoint (target es5, lib es2015, strict on). Don't rely on newer lib types without updating the base config.

## Architecture

`verdux` is a state-management library layering a reactive DAG of "vertices" on top of a single `@reduxjs/toolkit` store and `rxjs`. Mental model: one Redux store holds a nested tree of reducer states; an RxJS pipeline transforms each Redux action into a *graph run* that flows through vertices in topological order, producing per-vertex `fields` (state + computed + loaded data).

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

### Fields vs. Redux state

Redux holds only the slice reducers' state. A vertex's public "fields" are a richer shape (`VertexFieldsDefinition`) that includes loadable fields with `{ status: 'loading' | 'loaded' | 'error', value, ... }`. `src/state/` contains the conversion helpers (`toVertexState`, `toVertexLoadableState`, `pickFields`, `pickLoadableState`). When editing field/state logic, check both the `VertexState` (flat values) and `VertexLoadableState` (status-aware) views — they're both part of the public surface via `VertexInstance`.

### DevTools hook

`createGraph({ devtools })` accepts a `VerduxDevTools` implementation (`src/devtools/VerduxDevTools.ts`). It receives serialized graph structure and every run output (`serializeGraphStructure`, `serializeGraphRunData`) and can push forced field values back via `provideForceGraphRunOutput` (time-travel). Keep these serializers in sync with `GraphRunData` / `GraphCoreInfo` shape changes.

## Testing approach

Per the README, tests treat a vertex as a cohesive unit: build a fresh `graph = createGraph({ vertices: [...] })` in `beforeEach`, `graph.dispatch(...)` actions, then assert against `vertex.currentState` / `currentLoadableState`. Avoid testing reducers/selectors in isolation — the integration between Redux state, computed fields, and loaders is what matters. Operation-level unit tests (`src/operation/*.test.ts`) exist but they feed `VertexRunData` directly through a single RxJS operator; follow that pattern only when adding a new primitive operation.
