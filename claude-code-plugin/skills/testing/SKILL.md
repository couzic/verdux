---
name: testing
description: How to test verdux vertices as cohesive units of functionality rather than testing reducers, selectors, and thunks in isolation. Covers per-test graph construction, mocking services via .injectedWith() plus RxJS Subject stubs, asserting on currentState and currentLoadableState, why reactions re-dispatch synchronously so tests stay linear (dispatch → assert, no await) and dispatch races can't occur, injecting timing operators instead of fake timers, testing self-clearing transients (toast/popup/flash) with a ManualClock that fires injected timers on command, and verifying rerender minimization via pick() emission counters. Use whenever the user is writing tests for a verdux vertex, setting up test fixtures, reasoning about dispatch ordering or races, testing timer-driven or auto-clearing UI state, or asking "how do I test this reducer / loader / side effect".
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
`verdux:dependency-injection` skill) and override it with an **identity
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

The runnable version is `dependency-injection/examples/injectableOperator.test.ts`.

## Test self-clearing transients with a ManualClock

A `timer`-driven transient (toast, popup, flash — see `verdux:operations`,
"Self-clearing transients") can't use the identity-operator trick: a timer must
still *emit*, just on your command. Inject a **ManualClock** instead — `timer(ms)`
hands back a controllable cold stream, and `fire(ms)` makes every timer at that
delay emit. The whole helper is ~12 lines, no fake timers, no `TestScheduler`:

```ts
class ManualClock {
   private pending: { ms: number; subject: Subject<number> }[] = []
   timer = (ms: number): Observable<number> =>
      new Observable<number>(subscriber => {
         const entry = { ms, subject: new Subject<number>() }
         this.pending.push(entry)
         const inner = entry.subject.subscribe(subscriber)
         return () => {
            inner.unsubscribe()
            const i = this.pending.indexOf(entry)
            if (i >= 0) this.pending.splice(i, 1)
         }
      })
   fire(ms: number) {
      const due = this.pending.filter(p => p.ms === ms)
      this.pending = this.pending.filter(p => p.ms !== ms)
      due.forEach(({ subject }) => {
         subject.next(0)
         subject.complete()
      })
   }
}
```

Inject it and tests read `dispatch → fire → assert`, linearly:

```ts
const clock = new ManualClock()
graph = createGraph({
   vertices: [transientVertexConfig.injectedWith({ time: { timer: clock.timer } })]
})

it('clears the flash after the timer fires', () => {
   graph.dispatch(actions.resultFlashed('Added to cart'))
   expect(vertex.currentState.flash).to.equal('Added to cart')
   clock.fire(3000)
   expect(vertex.currentState.flash).to.be.null
})
```

The assertion that earns this helper its place is **cancellation**: re-trigger the
transient, then fire the stale timer and prove nothing happens. It works *because*
re-dispatch and `switchMap` cancellation are synchronous (next section) — the old
timer is torn down before the `fire`, so there's no stale clear and no leak. That
one assertion is the "beats `useEffect` + `setTimeout`" claim made executable. Full
example: `operations/examples/selfClearingTransient.test.ts`.

## Reactions re-dispatch synchronously

When a `reaction` / `reaction$` / `fieldsReaction` returns an action, verdux
dispatches it back through the store **within the same synchronous call stack**
as the originating `dispatch` — no scheduler, microtask, or timer in between. So
vertex tests read linearly even when one action triggers a cascade of reactions:
`dispatch → assert`, no `await`, no `flushPromises`.

```ts
it('applies the reaction cascade synchronously', () => {
   graph.dispatch(counterActions.incremented())
   // a fieldsReaction on `count` re-dispatched `sizeBucketChanged('big')`;
   // it has already been applied by the time dispatch() returns.
   expect(vertex.currentState.sizeBucket).to.equal('big')
})
```

This is also why you can **assert the absence of a race** rather than guard
against one: in single-threaded JS nothing interleaves between a dispatch and the
reactions it triggers, and `switchMap` cancels synchronously, so a stale reaction
can't land after a newer one. If a review flags a "dispatch race," the answer is
usually a test proving it can't happen, not a runtime guard. See the
`verdux:operations` reactions section for the guarantee in full.

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
- `verdux:dependency-injection` skill — the mechanics of `.injectedWith`.
- `verdux:graph-design` skill — designing the graph you're testing.
- `verdux:operations` skill — the operations whose output you assert on.
