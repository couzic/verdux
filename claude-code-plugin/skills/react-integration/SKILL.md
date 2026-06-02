---
name: react-integration
description: How to bind React components to a verdux graph. Covers the module-singleton graph, GraphContext, the Suspense-first useVertexState hook (via observable-hooks) as the one unified read for every vertex — including a vertex with no loadable field, where it simply never suspends rather than being bypassed with state$ — dispatching intents inline via graph.dispatch (with an optional useGraph hook that returns the stable graph, never a useDispatch wrapper), fine-grained per-leaf field picking for rerender minimization, and in-band sentinels for empty or error states. Use whenever the user is wiring verdux into a React app, reading vertex state in a component, handling loading UI, dispatching actions, or trying to minimize rerenders.
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

## Dispatching: `graph.dispatch(...)`, inline

The graph is a module singleton (`graph.ts`). To dispatch an intent, import it
and call `graph.dispatch(...)` inline in the handler — that one call *is* the
React→graph boundary for intents, the mirror of the inline dispatch
`verdux:graph-design` already recommends:

```tsx
import { graph } from '../graph'
import { productPageActions } from './productPageVertexConfig'

const ProductSelect = () => {
   const { options, selected } = useVertexState({
      vertex: productPageVertexConfig,
      fields: ['options', 'selected']
   })
   return (
      <Select
         value={selected}
         options={options}
         onChange={o => graph.dispatch(productPageActions.select(o))}
      />
   )
}
```

No hook, no Context indirection: there is one store, reachable by import.

**`useGraph` — when you want the graph through Context instead.** Some component
tests wrap the tree in a provider carrying a *different* (test) graph; for those,
read the graph from Context so reads (`useVertexState`) and dispatches hit the
**same** instance. The hook returns the stable graph object — never a per-render
dispatch wrapper:

```ts
// src/common/useGraph.ts
import { useContext } from 'react'
import { Graph } from 'verdux'
import { GraphContext } from './GraphContext'

export const useGraph = (): Graph => {
   const graph = useContext(GraphContext)
   if (!graph) throw new Error('No verdux graph found in Context')
   return graph
}
```

Then `const graph = useGraph()` and call `graph.dispatch(...)` /
`graph.getVertexInstance(...)`. Because it returns the graph (a stable
reference), it's safe in effect/memo deps. **Never** wrap `dispatch` itself in a
`useDispatch` hook — see the anti-patterns for why.

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

## A vertex with no loadable field still uses `useVertexState`

You may have a vertex fed **only by actions** — a straight reducer replacement,
an SSE-driven slice, anything with no `load` / `loadFromFields` /
`loadFromFields$` and so no loading phase. Read it with `useVertexState` anyway.
Every field is already `loaded`, so the hook **never suspends** — it returns
values immediately and the `<Suspense>` boundary is simply inert, not wrong.

Resist the urge to "optimize" by reading `state$` + `useObservableState` directly
instead. **The component must not know or care whether a field is loadable** —
that uniformity is the whole point of the hook. Read every field the same way and
the component keeps working unchanged if a field later *becomes* loadable: you add
a `loadFromFields`, and the `<Suspense>` boundary that was inert just starts doing
its job. Special-casing the read to `state$` couples the component to today's
loadable-ness and breaks the instant that changes. So: one hook, everywhere.

## Manual status branching (escape hatch)

When you genuinely can't use Suspense — incremental migration, a library boundary
that can't tolerate thrown promises, server-rendered contexts without Suspense
support — subscribe to `loadableState$` yourself via `useObservableState` from
`observable-hooks` and branch on status manually. This is the real escape hatch
(not the no-loadable-field case above, which still uses `useVertexState`):

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
- **Don't hold singleton feature state in `useState`.** Form drafts, an
  `editing` / `open` flag, a wizard step belong in the vertex slice, dispatched
  via actions — not local state synced back with `useEffect`. `useState` is for
  purely presentational, reusable state (`isHovered`, animation offsets). See
  the `verdux:graph-design` "State boundary" rule.
- **Don't wrap dispatch in a `useDispatch` hook.** It collides by name with
  react-redux's `useDispatch` (easy to auto-import the wrong one and dispatch
  into the wrong store), and the usual body returns a fresh
  `action => graph.dispatch(action)` every render — unstable in effect/memo
  deps. Dispatch inline on the module singleton, or read the stable graph with
  `useGraph`. There is one store; reach it by import, not behind a per-render
  function.
- **Don't bundle a cluster of dispatches in a thin `useXxxActions()` hook.** A
  hook with a single callsite and no logic beyond `dispatch(...)` plus a
  `useVertexState` read is indirection, not abstraction — dispatch inline. You
  can't make such a hook "more testable": the logic worth testing (routing,
  guards, dedup) belongs in the vertex, tested by dispatch (see `verdux:testing`).
  The discriminator is **callsites × own logic** — extract a hook only for a
  *reused* subscription/effect across several components, never as a per-surface
  dispatch bundle.

## See also

- `examples/` in this skill — copy-paste `useVertexState.ts`,
  `useGraph.ts`, `GraphContext.ts`, and a sample page component.
- `verdux:graph-design` skill — where this layer fits in the bigger
  picture.
- `verdux:testing` skill — note that the component layer is not exercised
  by verdux's own test suite; component tests require React Testing Library
  wrapped in the `GraphContext.Provider`.
