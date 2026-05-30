---
name: verdux-testing
description: How to test verdux vertices as cohesive units of functionality rather than testing reducers, selectors, and thunks in isolation. Covers per-test graph construction, mocking services via .injectedWith() plus RxJS Subject stubs, asserting on currentState and currentLoadableState, and verifying rerender minimization via pick() emission counters. Use whenever the user is writing tests for a verdux vertex, setting up test fixtures, or asking "how do I test this reducer / loader / side effect".
---

# verdux testing

verdux's testing philosophy differs from classical redux testing. Instead of
unit-testing reducers, selectors, and thunks in isolation, you treat a vertex
as a **cohesive unit of functionality** and test it by interacting with it
the way a UI component would — dispatching actions, then asserting on the
resulting state.

Why this matters: a vertex's behavior emerges from the interplay of its
reducer, computed fields, loaders, and dependencies. Testing any one of
those in isolation misses the bugs that actually ship.

## Canonical setup

Build a fresh graph in `beforeEach` so tests never leak state into each
other.

```ts
import { createGraph, Graph, Vertex } from 'verdux'
import { productPageVertexConfig } from './productPageVertexConfig'

describe('productPageVertex', () => {
   let graph: Graph
   let vertex: Vertex<typeof productPageVertexConfig>

   beforeEach(() => {
      graph = createGraph({ vertices: [productPageVertexConfig] })
      vertex = graph.getVertexInstance(productPageVertexConfig)
   })

   it('starts empty', () => {
      expect(vertex.currentState.product).to.be.undefined
   })
})
```

## Mock dependencies with `.injectedWith` + `Subject` stubs

For anything async, replace the real service with one that returns an RxJS
`Subject` your test controls. This avoids timers, fake schedulers, and the
ceremony of marble tests — the test reads as a linear script.

```ts
import { Subject } from 'rxjs'

describe('productPageVertex', () => {
   let graph: Graph
   let vertex: Vertex<typeof productPageVertexConfig>
   let productLoad$: Subject<Product>

   beforeEach(() => {
      productLoad$ = new Subject<Product>()
      const fakeApiClient = {
         getProduct: () => productLoad$.asObservable()
      }
      graph = createGraph({
         vertices: [
            rootVertexConfig.injectedWith({ apiClient: fakeApiClient as any }),
            productPageVertexConfig
         ]
      })
      vertex = graph.getVertexInstance(productPageVertexConfig)
   })

   it('enters loading state when a product id is dispatched', () => {
      graph.dispatch(productPageActions.selectProduct('abc'))
      expect(vertex.currentLoadableState.status).to.equal('loading')
   })

   it('transitions to loaded when the service emits', () => {
      graph.dispatch(productPageActions.selectProduct('abc'))
      productLoad$.next({ id: 'abc', name: 'Widget' })
      expect(vertex.currentLoadableState.status).to.equal('loaded')
      expect(vertex.currentState.product.name).to.equal('Widget')
   })
})
```

The test reads dispatch → next → assert. That's the point — each step is a
single line of cause and a single line of effect, so failures are easy to
localize.

## Assert on `currentState` vs `currentLoadableState`

- `vertex.currentState` — flat object of loaded field values. Use for
  happy-path value checks.
- `vertex.currentLoadableState` — full `{ status, state, fields, errors }`
  shape. Use when you care about loading transitions, per-field status, or
  errors.

```ts
expect(vertex.currentState.product.name).to.equal('Widget')
expect(vertex.currentLoadableState.status).to.equal('loading')
expect(vertex.currentLoadableState.errors).to.have.length(1)
```

For continuous observation, subscribe and capture in a closure:

```ts
// `VertexLoadableState` is parameterized by a vertex's *fields*, not by the
// vertex itself; `typeof vertex.currentLoadableState` is the ergonomic way to
// name the captured type.
let latest: typeof vertex.currentLoadableState
vertex.loadableState$.subscribe(_ => (latest = _))
```

## Verify rerender minimization with `pick()` emissions

`vertex.pick(['a', 'b'])` returns an observable that only emits when one of
the listed fields changes. Subscribe in a test and count emissions to prove
that unrelated actions don't force a rerender:

```ts
it('does not re-emit when an unrelated field changes', () => {
   let pickEmissions = 0
   vertex.pick(['product']).subscribe(() => pickEmissions++)
   expect(pickEmissions).to.equal(1) // initial

   graph.dispatch(productPageActions.setUnrelatedFlag(true))
   expect(pickEmissions).to.equal(1) // unchanged — product didn't change

   productLoad$.next({ id: 'abc', name: 'Widget' })
   expect(pickEmissions).to.equal(2) // product changed — one more emission
})
```

This is the most reliable way to catch "everything is rerendering"
regressions caused by a stray computed field or an upstream-tracking
mistake.

## Verify side effects

For `.sideEffect(actionCreator, callback)`, flip a captured boolean from
inside the side effect and assert on it:

```ts
let analyticsTracked = false
const trackingClient = {
   track: () => {
      analyticsTracked = true
   }
}

beforeEach(() => {
   graph = createGraph({
      vertices: [rootVertexConfig.injectedWith({ trackingClient })]
   })
})

it('tracks analytics on product view', () => {
   graph.dispatch(productPageActions.productViewed('abc'))
   expect(analyticsTracked).to.be.true
})
```

## Test time-based fields by injecting the operator

A `debounce` / `throttle` / `delay` makes a field resolve asynchronously, which
would otherwise force fake timers or a `TestScheduler`. The verdux answer is to
inject the timing **operator** as a dependency (see the
`verdux-dependency-injection` skill) and override it with an **identity
operator** in the test. The field then resolves synchronously under the same
`Subject.next` / `dispatch` script as everything else:

```ts
import { map } from 'rxjs'

beforeEach(() => {
   graph = createGraph({
      vertices: [
         // production root uses the real debounceTime; the test swaps it for
         // a pass-through so the debounced `results` field resolves at once.
         rootVertexConfig.injectedWith({ time: { debounce: () => map(v => v) } }),
         searchVertexConfig
      ]
   })
   vertex = graph.getVertexInstance(searchVertexConfig)
})

it('loads results without waiting on the debounce', () => {
   graph.dispatch(searchActions.queryChanged('pikachu'))
   expect(vertex.currentState.results).to.deep.equal(['result for pikachu'])
})
```

The runnable version is `verdux-dependency-injection/examples/injectableOperator.test.ts`.

## What you don't need

- **No TestScheduler / marble tests.** `Subject.next(...)` calls inside the
  test body drive time synchronously. For fields whose timing comes from a
  debounce/throttle operator, inject the operator and override it with identity
  (see above) instead of reaching for marble tests. This keeps tests linear and
  debuggable.
- **No isolated reducer tests.** `slice.reducer(state, action)` assertions
  miss the integration with loaders and computed fields. Trust redux-toolkit
  reducers and test the vertex behavior instead.
- **No selector tests.** `vertex.currentState` _is_ the selector output.
- **No thunk or middleware wiring.** The graph wires its own RxJS pipeline.

## Framework notes

The verdux repo itself uses mocha + chai + ts-node (run via `npm test`).
The patterns translate directly to vitest or jest; only the `expect(...)`
flavor changes.

## Anti-patterns

- **Don't share a graph across tests.** Each test builds its own. Shared
  graphs hide ordering-dependent bugs and make failures harder to reproduce.
- **Don't mock `graph.dispatch`.** Let the real graph run — that's the whole
  point of the unit-of-functionality approach.
- **Don't sprinkle `setTimeout` in tests to wait for async work.** Use
  `Subject.next(...)` to control emissions explicitly. If you find yourself
  wanting a timeout, your service stub should be a Subject instead.

## See also

- `examples/` in this skill — a complete vertex test file and a pick-emission
  rerender test.
- `verdux-dependency-injection` skill — the mechanics of `.injectedWith`.
- `verdux-graph-design` skill — designing the graph you're testing.
- `verdux-operations` skill — the operations whose output you assert on.
