---
name: dependency-injection
description: How to wire and override dependencies in a verdux graph. Covers root-level dependency factories, deriving child dependencies, scoping vertex operations to resolved deps via .withDependencies(), injecting an rxjs operator for testable timing, injecting a timer (time.timer) for self-clearing transients tested with a ManualClock, injecting a long-lived external stream (SSE/WebSocket) as an Observable factory scoped to its owning vertex, and overriding dependencies for tests or environments via .injectedWith(). Use whenever the user is adding a service (API client, router, clock, timer, logger, event stream) to a verdux graph, configuring a graph for tests, swapping a real service for a fake, or asking how to pass anything into a vertex operation.
---

# verdux dependency injection

A verdux graph receives its dependencies through the root vertex config and
flows them down the graph. There are four distinct APIs; knowing which one to
reach for makes vertex code much cleaner.

## 1. Declare at the root

Root dependencies are a map of **zero-arg factories** on
`configureRootVertex`:

```ts
export const rootVertexConfig = configureRootVertex({
   slice: rootSlice,
   dependencies: {
      router: () => router, // already-constructed singleton
      apiClient: createApiClient, // factory produces a fresh instance
      clock: () => new Date(),
      locale: () => navigator.language // e.g. 'en-US'
   }
})
```

Each factory runs once when the graph is created. Pass the bare factory
(`createApiClient`), not a call (`() => createApiClient()`) — verdux invokes
it for you.

A dependency is typically a plain object of observable-returning methods:

```ts
export const createApiClient = () => ({
   getProduct: (id: string) =>
      ajax.getJSON(`/api/products/${id}`).pipe(
         catchError(err =>
            err.status === 404 ? of(null) : throwError(() => err)
         )
      ),
   listProducts: () => ajax.getJSON('/api/products').pipe(map(normalize))
})
```

Observables are the contract of choice because verdux's operations
(`load`, `loadFromFields`, `loadFromFields$`) consume them directly.

## 2. Consume with `.withDependencies`

Every non-trivial vertex wraps its operation chain in `.withDependencies`. The
callback receives the resolved dependencies plus the `vertex` config itself
(so you can fluently chain operations inside):

```ts
export const productPageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice: productPageSlice })
   .withDependencies(({ apiClient, router }, vertex) => {
      // A standard router (TanStack, React Router, …) exposes an imperative
      // subscribe(), not an Observable. Adapt it once into a value-stream of
      // the route params, then load off it. Factor this into a `routeParams$`
      // module if more than one vertex needs it.
      const routeParams$ = new Observable<{ id: string }>(subscriber => {
         const current = () => {
            const m = router.state.matches // re-read on every resolve
            return m[m.length - 1].params
         }
         subscriber.next(current())
         return router.subscribe('onResolved', () => subscriber.next(current()))
      })
      return vertex
         .load({
            product: routeParams$.pipe(
               distinctUntilChanged(),
               // switchMap cancels the in-flight fetch when the route id changes
               switchMap(({ id }) => apiClient.getProduct(id))
            )
         })
         .loadFromFields(['product'], {
            relatedProducts: ({ product }) =>
               !product ? of([]) : apiClient.getRelated(product.id)
         })
   })
```

> **The router is not an Observable.** Common routers (TanStack Router, React
> Router) expose an imperative `subscribe()` / `state`, not RxJS streams — there
> is no `match$` / `location$` to inject. A route match *is* a value-stream (its
> latest value is always meaningful), so the clean integration is to adapt
> `subscribe()` into an Observable once, then `load` it — as above. Reserve a
> dispatch bridge for *event* streams (WebSocket, SSE); see the operations
> skill.

Why wrap in `withDependencies` rather than importing services directly?
Because the operations you declare need actual service instances, and you
want those services **injected** rather than imported, so you can override
them in tests or switch them per environment.

The signature is `(deps, vertex) => vertex.<ops>(...)`. The inner `vertex`
exposes all the same operation methods as the outer config. Whatever you
chain inside the callback becomes part of the final vertex behavior.

## 3. Derive at a downstream vertex

`configureDownstreamVertex` accepts its own `dependencies` map. Each derived
factory receives the **parent's** resolved deps and returns the child's:

```ts
export const productDetailVertexConfig = productPageVertexConfig
   .configureDownstreamVertex({
      slice: productDetailSlice,
      upstreamFields: ['product'],
      dependencies: {
         priceFormatter: ({ locale }) =>
            new Intl.NumberFormat(locale, {
               style: 'currency',
               currency: 'USD'
            })
      }
   })
```

Use this when a child needs a specialization of a parent service
(pre-scoped, pre-configured). The child still inherits everything from the
parent's dependency map.

## 4. Override with `.injectedWith` (tests, environments)

To swap a real dependency for a fake at graph-creation time, use
`.injectedWith(partialDeps)`. This returns an "injected config" wrapper that
`createGraph` accepts in place of the raw config:

```ts
beforeEach(() => {
   graph = createGraph({
      vertices: [
         rootVertexConfig.injectedWith({ apiClient: fakeApiClient }),
         productPageVertexConfig
      ]
   })
})
```

Only override what differs; other dependencies resolve normally. Typical
uses:

- **Tests** — inject `Subject`-based stubs so the test drives the service's
  observable emissions directly. See the `verdux:testing` skill.
- **Environment switching** — production vs staging vs a local mock server.
- **Storybook / dev harness** — render a feature in isolation against a
  canned dataset.

`.injectedWith` is applied at graph creation, not at runtime. For runtime
swaps, you'd need a different architecture — e.g. the dependency itself
behaves as a dispatcher and picks its backing implementation internally.

## Inject an rxjs operator for testable timing

A dependency doesn't have to be a service — it can be an **rxjs operator
factory**. This is the idiomatic way to make time-based fields (debounce,
throttle, delay) testable without fake timers or a `TestScheduler`.

Register the operator at the root, alongside your services:

```ts
import { debounceTime } from 'rxjs'

dependencies: {
   time: () => ({ debounce: debounceTime }), // debounce(ms) returns an operator
   apiClient: createApiClient
}
```

Consume it inside a `$`-variant operation like any other dependency:

```ts
.withDependencies(({ time, apiClient }, vertex) =>
   vertex.loadFromFields$(['query'], {
      results: pipe(
         map(({ query }) => query.trim()),
         time.debounce(300),
         distinctUntilChanged(),
         switchMap(q => apiClient.search(q))
      )
   })
)
```

In tests, inject an **identity operator** so the debounced field resolves
synchronously under your `Subject.next` script — you don't fake time, you
inject past it:

```ts
rootVertexConfig.injectedWith({ time: { debounce: () => map(v => v) } })
```

The full example is `examples/injectableOperator.ts`, pinned by
`examples/injectableOperator.test.ts`. The `verdux:testing` skill covers why
this replaces marble tests.

### …and a timer for self-clearing transients

The same `time` dependency is where an injectable **timer** lives — the source a
self-clearing toast / popup / flash `switchMap`s to (see `verdux:operations`,
"Self-clearing transients"). One caveat to flag at the call site: `timer(ms)`
returns an Observable **source** (the thing you `switchMap` *to*), whereas
`debounce(ms)` returns an **operator** (the thing you `.pipe` *through*) — both
sit under `time` because both answer the one question "how does this vertex touch
the clock, and how do I control it in a test?"

```ts
import { debounceTime, timer } from 'rxjs'

dependencies: {
   time: () => ({ debounce: debounceTime, timer }), // operator + source
   apiClient: createApiClient
}
```

**Scope `time` like any other dependency** (see the SSE section below): if only
one vertex touches the clock, put it on that vertex's downstream `dependencies`
— as the runnable example does — and reserve the root for a clock several
vertices share. The block above is the shared case; `apiClient` is the kind of
many-consumer service that justifies the root.

In tests you don't inject identity (a timer must still *emit*, just on command):
inject a **ManualClock** whose `timer(ms)` hands back a controllable stream and
`fire(ms)` triggers it. The `verdux:testing` skill has the ~12-line `ManualClock`;
the runnable example is `verdux:operations`' `examples/selfClearingTransient.ts`.

## Inject a long-lived external stream (SSE / WebSocket)

A persistent push stream — an `EventSource`, a WebSocket — is also a dependency:
an **Observable factory** keyed on whatever identifies the channel. Inject it
rather than `new EventSource(...)` inside the operation, so a `Subject`-backed
fake can stand in for the socket in tests.

```ts
export interface Sse {
   open: (productId: string) => Observable<ServerEvent>
}

export const createSse = (): Sse => ({
   open: productId =>
      new Observable<ServerEvent>(subscriber => {
         const es = new EventSource(`/api/products/${productId}/stock`)
         es.addEventListener('stock-changed', e =>
            subscriber.next({ type: 'stock-changed', data: JSON.parse(e.data) })
         )
         // ...one addEventListener per server event type
         return () => es.close() // teardown = unsubscribe closes the socket
      })
})
```

**Scope it to the vertex that owns it, not the root.** A stream consumed by a
single vertex is a single-consumer dependency, so it belongs on that vertex via
the downstream `dependencies` map — exactly like a feature-local clock or
operator. Single-consumer services on the root pollute the dependency well;
reserve the root for what most vertices use.

```ts
export const productStockVertexConfig = productPageVertexConfig
   .configureDownstreamVertex({
      slice: productStockSlice,
      upstreamFields: ['product'],
      dependencies: { sse: createSse }
   })
```

The **ownership** mechanic — turning `sse.open(id)` into dispatched actions via
`reaction$` + `switchMap`, with the socket's lifecycle bound to a slice field —
lives in the `verdux:operations` skill ("Own a long-lived external
subscription"). In tests, inject a `Subject` factory so the test pushes events
synchronously, no real socket:

```ts
const events$ = new Subject<ServerEvent>()
productStockVertexConfig.injectedWith({ sse: { open: () => events$ } })
```

## Picking between the APIs

| Need                                                | Use                                |
| --------------------------------------------------- | ---------------------------------- |
| Register a service everyone can use                 | Root `dependencies`                |
| Give a child vertex a tailored view of a service    | Downstream `dependencies`          |
| Use a service inside a vertex's operations          | `.withDependencies(deps, vertex)`  |
| Make a debounced / timed field testable             | operator-as-dependency + identity override |
| Feed a vertex an external push stream (SSE/WS)       | Observable-factory dependency, scoped to the owning vertex |
| Swap a service for testing or environment switching | `.injectedWith(...)` in createGraph |

## Anti-patterns

- **Don't import services directly into a vertex file.** It couples the
  vertex to a concrete module and makes `.injectedWith` pointless.
- **Don't call a factory yourself** (`apiClient: () => createApiClient()`).
  Pass the factory and let verdux invoke it.
- **Don't put mutable state in dependencies.** They resolve once; treat them
  as immutable services. Put mutable state in a vertex slice.

## See also

- `examples/` in this skill — root with deps, a `withDependencies` chain, an
  injected-for-test snippet.
- `verdux:testing` skill — how `.injectedWith` plus RxJS `Subject` stubs form
  the canonical test setup.
- `verdux:graph-design` skill — where dependencies fit in the overall graph.
- `verdux:operations` skill — the operations (loaders, reactions) that consume
  the injected services.
