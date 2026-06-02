---
name: graph-design
description: How to structure a React app's vertex graph in verdux. Covers the DAG mental model (data flows down, events can flow up), mirroring the router as the graph skeleton, one-responsibility-per-vertex and vertical-not-horizontal decomposition, when modals get their own vertex, where state lives (closest common ancestor of its vertex consumers), the root-vertex-as-DI-well convention, when to nest versus stay flat, tracking upstreamFields, multiple upstreams, and why the router is a dependency rather than a vertex. Use whenever the user is designing a verdux graph, adding a vertex, deciding how to decompose features, where to put a piece of state, or asking "should this be a vertex?" — even when they don't explicitly mention verdux.
---

# verdux graph design

verdux models an app's state as a directed acyclic graph of vertices. Each
vertex owns a redux slice plus computed / loadable fields. This skill covers
how to decompose a React app into vertices: where to put things, when to nest,
when to stay flat.

## Vertices are nodes in a DAG, not islands

Before deciding *where* things go, internalize how vertices relate. A vertex is
not a self-contained store — it is a node in a directed acyclic graph with two
channels:

- **Data flows down.** A vertex reads its upstream vertices' fields (via
  `upstreamFields` or a multi-parent edge) and derives its own from them.
- **Events can flow up.** Actions are normally dispatched on the vertex that
  defines them, but a downstream vertex *can* dispatch an action an upstream
  slice owns, pushing a change upward. The downward data channel is the common
  one; the upward channel is there when a child must trigger a parent's change.

The practical consequence governs every decomposition decision below:
**splitting a vertex costs almost nothing in coordination.** A focused child
still reads its parent's data going down and can dispatch the parent's actions
going up. So when you're tempted to pile unrelated responsibilities into one
vertex "so they can talk to each other" — don't. Break them apart by
responsibility; the graph reconnects them.

## Lifecycle belongs to the graph, not to React mount/unmount

A component mounting or unmounting is a UI implementation detail, **not** the
mechanism of a behavior that has to be correct. Opening or closing a socket,
resetting a piece of state, triggering a load — anything that *must* happen —
must never hinge on whether some component stays mounted. Drive it from an
explicit source (the router, an action) and **dispatch**: pure, unit-testable,
explicit. A `useEffect` mount/unmount used as the engine of business logic is
precisely the unmanageable disorder verdux exists to remove.

This is the through-line of the whole skill: every "where does this live?"
question below resolves toward the graph and away from the React lifecycle. The
tell is a critical effect — a fetch, a reset, a subscription open/close — written
in a `useEffect` cleanup. If losing it on a transient remount (a `<Suspense>`
flap, an intermediate navigation) would be a bug, it doesn't belong there. The
route-driven channel below, and `verdux:operations`' "Own a long-lived external
subscription", are applications of this one rule.

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

## Decomposition: mirror the router, one responsibility per vertex

**The router tree is the skeleton of the graph.** The single best heuristic for
shaping a graph is to mirror the app's navigation structure. A shared mental
model between routes and vertices is what makes the graph legible to the next
person who opens it.

- **One vertex per route.** Each routed page gets its own vertex, colocated with
  the page component (`ProductPage.tsx` + `productPageVertexConfig.ts`).
- **Nested routes → nested vertices.** `/products/:id/reviews` and
  `/products/:id/questions` are sub-routes of `/products/:id`, so their vertices
  nest under `productPage` — they are the reviews and Q&A *of a specific,
  already-loaded product*. Mirroring the router makes this nesting obvious; see
  "Nesting" below for the data-dependency that confirms it.
- **The route is the default unit, not the "feature."** A feature spreads across
  the routes (and modals) it touches; don't aggregate a vertex around the
  feature concept. Reasoning "by feature" re-aggregates what the router already
  separated.

> **A route loader fires only on *entry*.** A router (TanStack and friends) has
> no symmetric "onLeave" hook. Don't simulate one with a `useEffect` unmount:
> derive the *current entity id* from the router (`routeParams$`) as a single
> `id | null`, and the transition to `null` on a paramless route is automatic —
> it clears the entity load and closes any realtime channel for free, following
> navigation rather than the React tree. See `verdux:operations`'
> `routeDrivenEntityChannel.ts` for the full route → load + channel composition.

**Split vertically, never horizontally.** Decompose by the slice of the app that
owns its data end-to-end — a route, a feature surface — not by data *nature*.
Coming from Redux, the reflex is a vertex per entity (`productsVertex`,
`reviewsVertex`, `usersVertex`); that is a horizontal silo shared across pages,
the wrong axis. The right axis is vertical: `productPageVertex` owns the product
page's data and behavior end to end, the product and its reviews included.

**Modals and overlays.** A modal earns its own vertex when it carries real state
and behavior — a form, validation, a submission lifecycle, a realtime queue
(e.g. `writeReview`, `editAddress`). A modal whose only state is an `open` flag does
not; that flag rides in the slice of the route vertex that owns the screen. The
test is the same single-responsibility judgment, applied to something the router
doesn't list.

- **Pure presentation has no vertex.** Tabs, buttons, layout scaffolding — if
  they own no data, they own no vertex.
- **Shared services (auth, session, navigation, i18n) are dependencies, not
  vertices.** The router is the canonical example: pass it via `dependencies`,
  do not model it as vertex state.

## State boundary: React `useState` vs the vertex

The default is simple: **state belongs in the vertex, and that is never a bad
choice.** A vertex field is testable, change-detected, and leaves the full
toolbox open — you can later compute, load, or react off it. You deviate into
React `useState` for exactly one reason: **a reusable, multi-instance component**
whose per-instance state can't bind to a single vertex field. The discriminator
is *per-instance vs singleton*, not *trivial vs substantial* — a lone modal
`open` flag is trivial but singleton, so it still belongs in a slice.

> React `useState` is reserved for state that is genuinely **per-instance and
> reusable** — `isHovered`, `isFocused`, an animation offset, an uncontrolled
> tooltip. **Every singleton piece of state tied to a route, a modal, or a
> feature** — form drafts, a wizard's current step, pagination, an
> `open` / `closed` flag, the `editing` flag — **belongs to the vertex and to
> the vertex alone.**

Two corollaries:

- **User events translate to dispatched actions, never to local `setState`.**
  `onChange`, `onSubmit`, `onCancel` each dispatch an action. The component
  holds no copy of the data it is editing.
- **Validation and transformation live in reducers or reactions, not the
  component.** Trimming a name, capping a bio's length, toggling an interest in
  a set — all of that is a reducer. The component is a presentational shell.

**The alarm signal.** If you write a `useEffect` to sync a `useState` with a
vertex field — the classic
`useEffect(() => { if (wasSaving && !saving) setEditing(false) })` — the state
is misplaced. That effect only exists because a local flag is shadowing an
external state machine. The half-measure is *worse*: putting `editing` in the
slice but keeping `displayName` / `bio` in `useState` fragments one form across
two systems. The vertex then knows you are editing but not *what* you are
editing, and the form logic can no longer be tested without mounting React.
When a single flow (editing a form, opening a modal) mixes `dispatch` and
`setState`, push **all** of it into the slice.

A form on a route is a **singleton**: its field values, its validation, and its
user events all belong to one vertex. The worked example
`examples/profileFormVertexConfig.ts` puts `editing`, `displayName`, `bio`,
`interests`, `saving`, and `error` in the slice; the component reads six fields
and dispatches six actions, with **zero `useState` and zero `useEffect`** (the
saved `profile` it edits comes from a loader or upstream vertex — only the edit
buffer lives in this slice):

```tsx
// `graph` is the module singleton; dispatch intents inline on it — no hook.
// See verdux:react-integration, "Dispatching".
import { graph } from '../../graph'

const ProfileForm = ({ profile }: { profile: Profile }) => {
   const { editing, displayName, bio, interests, saving, error } =
      useVertexState({ vertex: profileFormVertexConfig, fields: [
         'editing', 'displayName', 'bio', 'interests', 'saving', 'error'
      ] })

   if (!editing)
      return <button onClick={() => graph.dispatch(editingStarted(profile))}>Edit</button>

   return (
      <form onSubmit={e => { e.preventDefault(); graph.dispatch(submitRequested()) }}>
         <input value={displayName}
            onChange={e => graph.dispatch(displayNameChanged(e.target.value))} />
         <textarea value={bio}
            onChange={e => graph.dispatch(bioChanged(e.target.value))} />
         {/* interests toggled via dispatch(interestToggled(tag)) */}
         {error && <p role="alert">{error}</p>}
         <button disabled={saving}>Save</button>
         <button type="button" onClick={() => graph.dispatch(editingCancelled())}>
            Cancel
         </button>
      </form>
   )
}
```

This is the consistency the model buys: the whole form is testable without
React (dispatch actions, assert on `vertex.currentState`), and the component
cannot drift out of sync with the save lifecycle because it holds no state of
its own.

## Creating a downstream vertex

Chain `.configureDownstreamVertex(...)` off a parent config. This is how almost
every non-root vertex gets built:

```ts
export const productPageVertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice: productPageSlice })
   .withDependencies(({ apiClient, router }, vertex) =>
      // `router` is a dependency, not a vertex. A standard router (TanStack,
      // React Router) exposes an imperative subscribe(), not an Observable, so
      // adapt it once into a value-stream of the route params — `routeParams$` —
      // then load off it. The adapter is the same few lines every time; factor
      // it into a shared helper rather than re-inlining it. Its body lives in
      // the dependency-injection skill and in `examples/nestedVertexConfig.ts`.
      vertex.load({
         product: routeParams$(router).pipe(
            map(({ id }) => id),
            distinctUntilChanged(),
            switchMap(id => apiClient.getProduct(id))
         )
      })
   )
```

The slice lives alongside the vertex config; action creators are exported so
components can dispatch them. (See the dependency-injection skill for why the
router is adapted into a value-stream rather than injected as an Observable, and
for the full `routeParams$` adapter body.)

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

## Nesting: structure is a decision, not a default

Nesting is a deliberate design act, driven by the same router-mirroring and
data-flow forces above — not a cost to minimize. The two forces usually coincide:
a child route typically *specializes data its parent route already loaded*, so
mirroring the router's nesting is the reliable first cut. Data dependency is the
tiebreaker when they diverge (see the failure modes below). The positive rule:

> **Nest a child under a parent as soon as the child consumes the parent's
> fields.** Shared data flowing down *is* the reason to nest, and it buys you
> change-detection granularity for free.

The two failure modes are **symmetric**, and "keep it flat" only warns about one:

- **Gratuitous nesting** — a child nested under a parent whose fields it never
  reads. Pointless indirection.
- **Lazy flatness** — hanging everything off the root when a real parent/child
  data dependency exists. This is the failure "deeper is not better" hides, and
  it's the more common one. `productReviews` and `productQuestions` consume the
  `product` loaded by `productPage`, and their routes are sub-routes of
  `/products/:id` — they belong *under* `productPage` (`upstreamFields:
  ['product']`), not flattened beneath the root.

The mirror image keeps you honest in the other direction: `productPage` does
**not** nest under `productList`. A deep link to `/products/:id` must work without
the catalog, so `productPage` doesn't depend on `productList`'s fields — they're
sibling routes, not parent/child. **Nest on data dependency, not on URL prefix
alone.**

Two shapes recur:

- **Flat app** — most small or mid-sized apps. Feature vertices hang off the
  root, each with its own slice and `.load` / `.loadFromFields` chain pulling
  from the root's shared dependencies. Correct *when no vertex consumes
  another's fields* — flatness here reflects a real absence of data
  dependencies, not a default reached for.
- **Nested subtree for a routed section** — a parent route with shared data and
  child routes that each specialize it. The parent vertex holds the shared
  fields; each child nests with `upstreamFields: [<shared>]`.

## Where state lives: closest common ancestor

A piece of state belongs on the **closest common ancestor of the vertices whose
computations use it** — the lowest vertex sitting above every consumer. "Uses
it" means a `load` / `compute` / `reaction` that takes the value as input; **a
component that merely displays it doesn't count**, because a component can `pick`
from any vertex regardless of where the state lives. Measure the *vertex*
consumers, not the screens.

- Consumed across the whole app → the closest common ancestor is the **root** →
  root state is correct. (This is the one case where meaningful root state earns
  its place — see the root anti-pattern below for the converse.)
- Consumed under one branch → it lives on that branch's parent, root stays clean.
- Consumed by one vertex → it lives there.

Two pragmatic escape valves, both avoiding **pollution**:

- Don't hoist to the **root** for a value only a couple of vertices compute on —
  root state re-triggers every subtree.
- Don't push it into an **intermediary** vertex whose branch is mostly
  descendants that never read it — that pollutes the branch with irrelevant
  state and re-runs.

When the closest common ancestor sits too high for the few consumers it would
serve, draw a **second upstream edge** straight to the owner instead (see
"Multiple upstreams"). The `isMine` case: a product-reviews vertex (under
`productPage`) needs the auth `user`, which lives in a sibling subtree. Their
common ancestor is the root, but only the reviews vertex reads it — so
`addUpstreamVertex(authVertexConfig, { fields: ['user'] })` beats hoisting `user`
all the way to the root.

**Placement and structure co-design each other.** Don't freeze the graph shape
and then slot state into it. Discovering where a piece of state must live can
tell you a vertex should exist, should nest differently, or should carry a second
upstream edge. Structure follows ownership as much as it follows the router.

## Multiple upstreams

Everything above is **tree-first**: a vertex is created from its single parent
via `parent.configureDownstreamVertex(...)`, and the whole graph is a tree of
those calls. That covers the large majority of vertices.

Reach for `configureVertex(...)` when **one parent isn't enough** — when a vertex
must read fields or dependencies from **more than one upstream vertex**: a
genuine multi-parent DAG node (two sibling sections feeding a combined view, the
`isMine` reviews vertex that needs both its product and the auth user). It's less
common than tree-first, but when a vertex genuinely needs another branch's data,
a second upstream edge is the *correct* tool — not a workaround to avoid.

> **The trigger.** If you catch yourself wanting to read another vertex's state
> imperatively from a compute or reaction —
> `graph.getVertexInstance(other).currentState`, a module-singleton getter —
> **stop: that urge is the signal to add an upstream edge.** An imperative
> cross-vertex read is a backdoor dependency: invisible to change detection,
> untestable without the singleton, silently stale. Declaring the edge
> (`addUpstreamVertex`) makes the dependency explicit, change-detected, and
> testable. Data reaches a vertex *through the graph*, never around it.

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

The *reason* to reach for a multi-parent join is usually to **aggregate the
upstream fields into one semantic value** that downstream loaders consume,
instead of threading each one separately through every loader. Continuing the
dashboard above (`userId` from one parent, `dateRange` from the other), compute
the combined intent once on the join node:

```ts
.computeFromFields(['userId', 'dateRange'], {
   kpiQuery: ({ userId, dateRange }) => ({
      userId,
      from: dateRange.from,
      to: dateRange.to
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
  `verdux:react-integration` skill.
- **Don't put meaningful state on the root vertex** unless the root genuinely is
  the closest common ancestor of its vertex consumers — i.e. nearly every
  subtree computes on it. See "Where state lives".
- **Don't create a catch-all vertex.** No generic `ui` / `modals` vertex
  bundling unrelated state by nature, and no over-broad "feature" vertex piling
  up unrelated responsibilities. Split by responsibility — see "Decomposition".
- **Don't read another vertex's state imperatively** from a compute or reaction.
  The urge to is the signal to add an upstream edge — see "Multiple upstreams".
- **Don't source the same value through two paths.** If "the current route
  entity id" is already a route-derived field, don't let a second mechanism — a
  React hook, a second loader, a mirrored slice field — re-introduce the same id
  by another route. Derive it once and let every consumer (entity loader,
  realtime channel) read that single field. Two sources of one id drift apart
  exactly when navigation and a component lifecycle disagree — see "Lifecycle
  belongs to the graph".
- **Don't use `reaction` / `reaction$` for cascade loading.** Use
  `loadFromFields` instead. Reactions are an action-to-action escape hatch,
  not the primary data-flow primitive.
- **Don't include the root in `createGraph({ vertices: [...] })`.** Only
  non-root configs belong in that array; the root is reached transitively.
- **Don't keep singleton route/modal/form state in `useState`.** Drafts, the
  `editing` flag, a wizard step, an `open` flag — all belong in the slice. A
  `useEffect` that syncs `useState` with a vertex field is the tell that state
  is misplaced. See "State boundary" above.

## See also

- `verdux:dependency-injection` skill — details of declaring, deriving, and
  overriding dependencies.
- `verdux:react-integration` skill — how components read the fields a vertex
  produces.
- `verdux:testing` skill — how to test the graph structure you design.
- `verdux:operations` skill — the nine operations each vertex can run, and
  when to reach for each.
- `examples/` in this skill — canonical root, flat, nested, and multi-upstream
  vertex configs.
