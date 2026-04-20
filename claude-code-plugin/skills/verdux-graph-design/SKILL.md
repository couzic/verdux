---
name: verdux-graph-design
description: How to structure a React app's vertex graph in verdux. Covers the root-vertex-as-DI-well convention, when to create a downstream vertex via configureDownstreamVertex, when to track upstreamFields for change detection, nesting versus flat layouts, and why the router is a dependency rather than a vertex. Use whenever the user is designing a verdux graph, adding a vertex, deciding how to decompose features, or asking "should this be a vertex?" — even when they don't explicitly mention verdux.
---

# verdux graph design

verdux models an app's state as a directed acyclic graph of vertices. Each
vertex owns a redux slice plus computed / loadable fields. This skill covers
how to decompose a React app into vertices: where to put things, when to nest,
when to stay flat.

## The root vertex is a dependency well

Every verdux graph has exactly one root vertex. The idiomatic convention is:
**the root vertex has an empty slice and exists solely to hold dependencies**
that every other vertex will consume.

```ts
// rootVertexConfig.ts
export const rootVertexConfig = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} }),
   dependencies: {
      router: () => router,
      apiClient: createApiClient
   }
})
```

Why empty state on the root? State on the root is state on every subgraph's
ancestor chain — changing it potentially re-triggers every subgraph. An empty
root avoids this. Put real state on a dedicated downstream vertex instead.

## One vertex per route is a good default

- **Route-per-vertex.** Each routed page gets its own vertex, colocated in the
  same folder as the page component (e.g. `ProductPage.tsx` +
  `productPageVertexConfig.ts`).
- **Nested routes → nested vertices** when the child route genuinely consumes
  parent state. Otherwise keep them flat under the root.
- **Pure presentation components have no vertex.** Tabs, buttons, layout
  scaffolding — if they don't own data, they don't need a vertex.
- **Shared concerns (auth, session, navigation, i18n) live as dependencies,
  not vertices.** The router is the canonical example: pass it via
  `dependencies`, do not model it as vertex state.

## Creating a downstream vertex

Chain `.configureDownstreamVertex(...)` off a parent config. This is how almost
every non-root vertex gets built:

```ts
export const productPageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({
      slice: productPageSlice
   })
   .withDependencies(({ apiClient, router }, vertex) =>
      vertex.load({
         product: router.productPage.match$.pipe(
            filter(Boolean),
            map(({ params }) => params.id),
            distinctUntilChanged(),
            switchMap(id => apiClient.getProduct(id))
         )
      })
   )
```

The slice lives alongside the vertex config; action creators are exported so
components can dispatch them.

## When to track `upstreamFields`

`upstreamFields` is verdux's change-detection contract for a subgraph: the
subgraph re-runs only when (a) its own slice changes, (b) a tracked action
fires, or (c) a listed upstream field changes. If you omit `upstreamFields`,
the child subgraph **will not react to parent field changes**.

Track a field when its value is consumed by the child's computation:

```ts
export const productDetailVertexConfig = productPageVertexConfig
   .configureDownstreamVertex({
      slice: productDetailSlice,
      upstreamFields: ['product'] // detail subgraph re-runs when product changes
   })
```

A vertex with no reducers and only `upstreamFields` acts as a "pure projection
vertex" — it doesn't own state, but it establishes a subgraph boundary so its
own children can change-detect on the tracked fields independently of
siblings. This is useful when a section of the UI has a natural parent/child
structure with shared data.

## Nesting vs staying flat

Nesting is cheap and adds change-detection granularity, but adds a layer of
indirection. Rule of thumb: nest only when a subgraph boundary **buys you
something** — cleaner re-run semantics, shared parent data, per-subroute
encapsulation. Otherwise keep graphs flat. Deeper is not better.

Two patterns that work well:

- **Flat app** — most small or mid-sized apps. All feature vertices hang off
  the root, each with its own slice and its own `.load` / `.loadFromFields`
  chain pulling from the root's shared dependencies.
- **Nested subtree for a routed section** — when you have a parent route with
  shared data and several child routes that each specialize that data. Model
  the parent route as a vertex holding the shared fields; model each child
  route as a nested vertex with `upstreamFields: [<shared>]`.

## Registration

Every non-root config is passed to `createGraph({ vertices: [...] })` as a
flat array. The root is reached transitively through each config's
`.rootVertex` chain and de-duplicated internally, so you don't include it:

```ts
export const graph = createGraph({
   vertices: [
      productPageVertexConfig,
      productDetailVertexConfig,
      cartVertexConfig
      // ...
   ],
   devtools: (window as any).__VERDUX_DEVTOOLS_EXTENSION__
})
```

## Anti-patterns

- **Don't model the router as a vertex.** It's a dependency. Inject the
  router at the root, consume its observables inside `.load(...)` and
  `.withDependencies(...)`.
- **Don't share selectors across components.** Each component calls
  `vertex.pick([...])` with the exact fields it needs — see the
  `verdux-react-integration` skill.
- **Don't put meaningful state on the root vertex** unless every subgraph
  genuinely needs to re-run when it changes.
- **Don't use `reaction` / `reaction$` for cascade loading.** Use
  `loadFromFields` instead. Reactions are an action-to-action escape hatch,
  not the primary data-flow primitive.
- **Don't include the root in `createGraph({ vertices: [...] })`.** Only
  non-root configs belong in that array; the root is reached transitively.

## See also

- `verdux-dependency-injection` skill — details of declaring, deriving, and
  overriding dependencies.
- `verdux-react-integration` skill — how components read the fields a vertex
  produces.
- `verdux-testing` skill — how to test the graph structure you design.
- `examples/` in this skill — canonical root, flat, and nested vertex configs.
