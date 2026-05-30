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

`dependencies` is optional. A root (or any vertex) that needs no services omits
it entirely — `configureRootVertex({ slice })`.

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

## Multiple upstreams (the exception to tree-first)

Everything above is **tree-first**: a vertex is created from its single parent
via `parent.configureDownstreamVertex(...)`, and the whole graph is a tree of
those calls. That is the default and covers the large majority of vertices.

Reach for `configureVertex(...)` **only when one parent isn't enough** — when a
vertex must read fields or dependencies from **more than one upstream vertex**,
i.e. a genuine multi-parent DAG node (two sibling sections feeding a combined
view, a summary that joins two unrelated subtrees, etc.). It is the exception,
not a co-equal default.

`configureDownstreamVertex` is in fact just sugar over this builder: it calls
`configureVertex` with a single `addUpstreamVertex(parent)`. The builder form
exposes that wiring so you can add **several** upstreams:

```ts
import { configureVertex } from 'verdux'

// root
//  ├── user     (owns `userId`)
//  ├── filters  (owns `dateRange`)
//  └── dashboard  ← reads from BOTH siblings
export const dashboardVertexConfig = configureVertex(
   { slice: dashboardSlice },
   builder =>
      builder
         .addUpstreamVertex(userVertexConfig, {
            fields: ['userId'],
            dependencies: ['kpiService']
         })
         .addUpstreamVertex(filtersVertexConfig, {
            fields: ['dateRange']
         })
).withDependencies(({ kpiService }, vertex) =>
   vertex.loadFromFields(['userId', 'dateRange'], {
      kpi: ({ userId, dateRange }) => kpiService.fetch(userId, dateRange)
   })
)
```

`addUpstreamVertex(config, { fields, dependencies })` declares one upstream:
`fields` are the upstream fields this vertex reads and change-detects on (the
multi-parent analogue of `upstreamFields`), and `dependencies` selects which of
that upstream's dependencies to pull in.

A multi-parent vertex can also register a **brand-new** dependency of its own —
one not carried by any upstream — with `.addDependencies(...)`, the multi-parent
analogue of a downstream `dependencies` map:

```ts
configureVertex({ slice: dashboardSlice }, builder =>
   builder
      .addUpstreamVertex(userVertexConfig, { fields: ['userId'] })
      .addUpstreamVertex(filtersVertexConfig, { fields: ['dateRange'] })
      .addDependencies({ geoService: createGeoService }) // new dep on this node
)
```

Each provider receives the dependencies accumulated from the upstreams and
returns the new one — exactly like a downstream derived dependency.

### How dependencies resolve across upstreams

This is the one behavior that differs from the single-parent path, so be
deliberate:

- **Single parent (`configureDownstreamVertex`)** — the child inherits the
  parent's **entire** dependency object automatically. A service registered at
  the root therefore reaches every tree-first descendant for free; you never
  list dependencies.
- **Multiple parents (`addUpstreamVertex`)** — pull what you use, per upstream:
  - Pass `dependencies: ['kpiService', ...]` to inherit **only** those keys
    from that upstream.
  - **Omit** the `dependencies` option entirely to inherit **all** of that
    upstream's dependencies.

So a root dependency reaches a multi-parent vertex only through an upstream
that carries it — pulled by name, or inherited wholesale by omitting
`dependencies`. Decide per upstream; there is no graph-wide auto-flow into a
multi-parent node.

The full, compiling example (root `kpiService`, two sibling vertices, and the
combined `dashboard`) is in `examples/multiUpstreamVertexConfig.ts`, with the
dependency-resolution behavior pinned by `examples/multiUpstream.test.ts`.

### Why join: collapse upstream fields into one intent

The *reason* to reach for a multi-parent join is usually to **aggregate several
upstream fields into one semantic value** that downstream loaders consume,
instead of threading three or four fields through every loader. Compute the
combined intent once on the join node:

```ts
.computeFromFields(['selectedKpi', 'dateRange', 'filteredBy'], {
   kpiQuery: ({ selectedKpi, dateRange, filteredBy }) => ({
      kpi: selectedKpi,
      from: dateRange.from,
      to: dateRange.to,
      filteredBy
   })
})
```

Now every downstream loader takes a single `kpiQuery` field. When any
contributing upstream field changes, `kpiQuery` recomputes and the loaders
re-run — and nothing downstream needs to know which of the inputs moved. The
join exists to manufacture that one field.

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
- `verdux-operations` skill — the nine operations each vertex can run, and
  when to reach for each.
- `examples/` in this skill — canonical root, flat, nested, and multi-upstream
  vertex configs.
