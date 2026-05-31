---
name: dependency-injection
description: How to wire and override dependencies in a verdux graph. Covers root-level dependency factories, deriving child dependencies, scoping vertex operations to resolved deps via .withDependencies(), and overriding dependencies for tests or environments via .injectedWith(). Use whenever the user is adding a service (API client, router, clock, logger) to a verdux graph, configuring a graph for tests, swapping a real service for a fake, or asking how to pass anything into a vertex operation.
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
      clock: () => new Date()
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
   .withDependencies(({ apiClient, router }, vertex) =>
      vertex
         .load({
            product: router.productPage.match$.pipe(
               filter(Boolean),
               mergeMap(({ params }) => apiClient.getProduct(params.id))
            )
         })
         .loadFromFields(['product'], {
            relatedProducts: ({ product }) =>
               !product ? of([]) : apiClient.getRelated(product.id)
         })
   )
```

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

## Picking between the APIs

| Need                                                | Use                                |
| --------------------------------------------------- | ---------------------------------- |
| Register a service everyone can use                 | Root `dependencies`                |
| Give a child vertex a tailored view of a service    | Downstream `dependencies`          |
| Use a service inside a vertex's operations          | `.withDependencies(deps, vertex)`  |
| Make a debounced / timed field testable             | operator-as-dependency + identity override |
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
