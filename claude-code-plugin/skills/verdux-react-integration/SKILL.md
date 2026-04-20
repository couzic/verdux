---
name: verdux-react-integration
description: How to bind React components to a verdux graph. Covers the module-singleton graph, GraphContext, the Suspense-first useVertexState hook (via observable-hooks), useDispatch, fine-grained per-leaf field picking for rerender minimization, and in-band sentinels for empty or error states. Use whenever the user is wiring verdux into a React app, reading vertex state in a component, handling loading UI, dispatching actions, or trying to minimize rerenders.
---

# verdux React integration

The verdux ↔ React layer is deliberately tiny: a module-singleton graph, a
context, and two hooks. Everything else is product code. This skill teaches
the canonical pattern, **Suspense-first**.

Why Suspense is the happy path: every leaf component can call
`useVertexState` with the fields it uniquely needs, each wrapped in its own
`<Suspense>` boundary. Parts of the page render instantly while slower
fields stream in. No manual `if (loading) return <Spinner />` branching, no
cascading flags through props. This composes with verdux's per-field
loadable model better than any manual alternative.

## The whole binding layer in three files

### `graph.ts` — module singleton

```ts
// src/graph.ts
import { createGraph } from 'verdux'
import { productPageVertexConfig } from './pages/product/productPageVertexConfig'
// ...other vertex configs

export const graph = createGraph({
   vertices: [productPageVertexConfig /* ... */],
   devtools: (window as any).__VERDUX_DEVTOOLS_EXTENSION__
})
```

The graph is created as a side effect of the first import and lives for the
life of the page. Don't recreate it on hot-reload or on route change.

### `GraphContext.ts` — minimal context

```ts
// src/common/GraphContext.ts
import { createContext } from 'react'
import { Graph } from 'verdux'

export const GraphContext = createContext<Graph>(undefined as any)
```

### `App.tsx` — provider at the top

```tsx
// src/App.tsx
import { GraphContext } from './common/GraphContext'
import { graph } from './graph'

export const App = () => (
   <GraphContext.Provider value={graph}>
      <Routes />
   </GraphContext.Provider>
)
```

One graph, one provider, at the top of the tree. No nested providers.

## `useVertexState` — the Suspense-first hook

This is **the** hook components use to read vertex state. It suspends until
the picked fields are loaded, integrates with `<Suspense>`, and returns a
flat object of loaded values. The full source lives in
`examples/useVertexState.ts` — copy it into your project as-is. It depends
on `observable-hooks` (peer-installed alongside React).

The hook's shape: `useVertexState({ vertex, fields }) → { [field]: value }`.
It reads `GraphContext`, calls `graph.getVertexInstance(vertex)`, wraps
`vertex.pick(fields)` in an `ObservableResource` whose "ready" predicate is
`status === 'loaded'`, then uses `useObservableSuspense` so the component
suspends until that predicate is satisfied. See the "Footgun" section below
for the one non-obvious detail.

### Suspense-per-leaf

Call `useVertexState` in each leaf component and wrap each one in
`<Suspense>`. They suspend independently:

```tsx
export const ProductPage = () => (
   <>
      <Header />
      <Suspense fallback={<Spinner />}>
         <ProductDisplay /> {/* waits for `product` */}
      </Suspense>
      <Suspense fallback={<Spinner />}>
         <RelatedProducts /> {/* waits for `relatedProducts` */}
      </Suspense>
   </>
)
```

Both children can read the same vertex, but different fields. The page's
header renders without waiting; the slower fields fill in as they load.

## `useDispatch`

```ts
// src/common/useDispatch.ts
import { useContext } from 'react'
import { UnknownAction } from '@reduxjs/toolkit'
import { GraphContext } from './GraphContext'

export const useDispatch = () => {
   const graph = useContext(GraphContext)
   if (!graph) throw new Error('No verdux graph found in Context')
   return (action: UnknownAction) => graph.dispatch(action)
}
```

Consumers:

```tsx
const ProductSelect = () => {
   const dispatch = useDispatch()
   const { options, selected } = useVertexState({
      vertex: productPageVertexConfig,
      fields: ['options', 'selected']
   })
   return (
      <Select
         value={selected}
         options={options}
         onChange={o => dispatch(productPageActions.select(o))}
      />
   )
}
```

## Fine-grained picks for rerender minimization

`vertex.pick([...])` only emits when one of the listed fields actually
changes. The smaller the list, the fewer rerenders. Call `useVertexState`
multiple times per subtree — one per concern — rather than picking the whole
state once and passing props down:

```tsx
// Prefer:
const Header = () => {
   const { title } = useVertexState({ vertex, fields: ['title'] })
   return <h1>{title}</h1>
}
const Badge = () => {
   const { count } = useVertexState({ vertex, fields: ['count'] })
   return <span>{count}</span>
}

// Over:
const Page = () => {
   const all = useVertexState({
      vertex,
      fields: ['title', 'count', 'disabled']
   })
   return (
      <>
         <Header title={all.title} />
         <Badge count={all.count} />
      </>
   )
}
```

In the first version, `Header` does not rerender when `count` changes. In
the second, the entire subtree rerenders on any field change.

## Empty / error states: in-band sentinels

verdux's loadable model exposes `{ status, errors }`, but in practice
components rarely read `errors`. Instead, the vertex's loader encodes known
empty / missing states as **in-band values**, and the component branches on
them:

```ts
// vertex: 404 becomes null
getProduct: (id: string) =>
   ajax.getJSON(`/api/products/${id}`).pipe(
      catchError(err => (err.status === 404 ? of(null) : throwError(() => err)))
   )
```

```tsx
// component: branch on the sentinel
const ProductDisplay = () => {
   const { product } = useVertexState({ vertex, fields: ['product'] })
   if (product === null) return <NotFound />
   return <article>{product.name}</article>
}
```

This keeps the Suspense contract clean — by the time the component body
runs, the field is always `loaded` — and keeps field types narrow. Reserve
`loadableState$.errors` for true infrastructure errors that genuinely
cannot be mapped to an in-band value; let those bubble to an error
boundary.

## Footgun: `useMemo([])` freezes the fields list

The canonical `useVertexState` uses `useMemo(..., [])` so the
`ObservableResource` is constructed exactly once per component instance. As
a consequence, **changing `options.fields` between renders has no effect** —
the original fields list is what the resource subscribes to.

In practice this rarely bites because components pass a literal array
(`fields: ['product']`). But if you compute fields dynamically, either lift
the selection to a parent that remounts the child with a `key`, or rewrite
the hook to track the fields list as a memo dep.

## Alternative: manual branching (escape hatch)

Occasionally you can't use Suspense — incremental migration, a library
boundary that can't tolerate thrown promises, server-rendered contexts
without Suspense support. In that case, subscribe to `loadableState$`
yourself via `useObservableState` from `observable-hooks` and branch on
status manually:

```ts
const loadable = useObservableState(vertex.loadableState$, vertex.currentLoadableState)
if (loadable.status === 'loading') return <Spinner />
if (loadable.status === 'error') return <ErrorView errors={loadable.errors} />
return <Display state={loadable.state} />
```

This works, but you lose the per-leaf suspension composition. Reach for it
only when Suspense genuinely isn't an option.

## Anti-patterns

- **Don't subscribe manually** in `useEffect`. `useVertexState` already
  handles lifecycle correctly.
- **Don't wrap components in `React.memo` or props in `useMemo` /
  `useCallback` preemptively.** `pick()`-based change detection makes these
  redundant in nearly all cases. Add them only when a profiler says so.
- **Don't create nested `GraphContext.Provider`s.** One per tree.
- **Don't read `vertex.currentState` inside render.** It's a snapshot that
  won't trigger a rerender. Use the hook.
- **Don't put the router in the graph** and feed it to components through
  the hook. Inject it as a dependency and use its own React bindings for
  navigation. See `verdux-graph-design`.

## See also

- `examples/` in this skill — copy-paste `useVertexState.ts`,
  `useDispatch.ts`, `GraphContext.ts`, and a sample page component.
- `verdux-graph-design` skill — where this layer fits in the bigger
  picture.
- `verdux-testing` skill — note that the component layer is not exercised
  by verdux's own test suite; component tests require React Testing Library
  wrapped in the `GraphContext.Provider`.
