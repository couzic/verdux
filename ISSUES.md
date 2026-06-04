# Known issues

This file documents only currently existing issues. Once an issue is resolved,
it is removed from this file.

> Found by a multi-agent review (2026-06-02) and then **re-verified individually by
> reproducing each one against the public API on a full graph** (`createGraph` +
> `graph.dispatch` + a public read). The standard in CLAUDE.md applies: an entry is
> only kept here if it was demonstrated to misbehave through the public surface —
> several plausible-from-the-code "findings" did NOT reproduce on a full graph and
> were dropped. Each entry below carries the exact repro that currently FAILS (or, for
> the type-safety item, the runtime fact + the compile-time check). Paste a repro into
> a colocated `*.test.ts`, assert the EXPECTED line, and it goes red today / green once
> fixed.

---

## Medium

### H2 — `addUpstreamVertex` mistypes unpulled upstream fields as present (type-safety)

`src/config/VertexConfigBuilder.ts:19-28` types the result over the full
`keyof UpstreamFields` regardless of the `fields` subset actually pulled — and pulls
_none_ when `fields` is omitted (`VertexConfigBuilderImpl.ts:50`; runtime copy at
`extractVertexFields.ts:25-29`). So an unpulled field type-checks but is `undefined`
at runtime — `inst.currentState.b.toUpperCase()` compiles and crashes. Same bug class
already fixed + regression-tested on the dependencies side (`PulledDependencies` +
`multiUpstreamDependencies.test.ts`); the fields side was missed. Single-parent
`configureDownstreamVertex` is unaffected (returns `any`); the hole is the explicit
`configureVertex(...).addUpstreamVertex(...)` builder.

**Fix.** Add a `PulledFields extends keyof UpstreamFields` generic (honest default
`never`, matching the runtime), key the merged `Fields` off it, and reconcile the
omitted-`fields` runtime/type disagreement. Add a fields analog of
`multiUpstreamDependencies.test.ts`.

**Repro (verified).** Runtime fact (passes today, confirming the mismatch):

```ts
const upstream = configureRootVertex({
   slice: createSlice({
      name: 'up',
      initialState: { a: 1, b: 'hello' },
      reducers: {}
   })
})
const down = configureVertex(
   { slice: createSlice({ name: 'down', initialState: {}, reducers: {} }) },
   _ => _.addUpstreamVertex(upstream, { fields: ['a'] }) // pulls ONLY `a`
)
const inst = createGraph({ vertices: [upstream, down] }).getVertexInstance(down)
expect(inst.currentState.a).to.equal(1)
expect('b' in inst.currentState).to.equal(false) // `b` absent at runtime…
```

The actual defect is the **type**: `inst.currentState.b` is typed `string` though it's
`undefined`. Pin it with a compile-time check run via `npx tsc --noEmit` (and the
plugin example-check harness) — after the fix the directive activates:

```ts
// @ts-expect-error  ← currently reported UNUSED (TS2578): `b` wrongly types as string
const b: string = inst.currentState.b
```

### M3 — DevTools graph structure has `fields: undefined` for a multi-upstream edge

`src/devtools/serializeGraphStructure.ts:24-33` walks the redux/execution tree
(`vertexConfigsByClosestCommonAncestorId`) but reads tracked fields from the dependency
DAG (`downstreamVertexConfig.builder.fieldsByUpstreamVertexId[vertexConfig.id]`). For a
multi-upstream vertex C whose closest common ancestor is the root (not a direct
upstream — the diamond in ARCHITECTURE.md §4), that lookup is `undefined`, producing an
edge with no `fields` key and violating the non-optional `SerializedEdgeStructure.fields:
string[]` (`SerializedGraphStructure.ts:17`). A devtools consumer doing `edge.fields.map`
crashes.

**Fix.** `fields: downstreamVertexConfig.builder.fieldsByUpstreamVertexId[vertexConfig.id] || []`.

**Repro (verified — fails on current tree).** Through the public `devtools` hook (no
need to import the internal serializer), in `serializeGraphStructure.test.ts` or a graph
test:

```ts
let captured: any
const devtools: VerduxDevTools = {
   sendGraphStructure: s => {
      captured = s
   },
   sendGraphRunOutput: () => {},
   provideForceGraphRunOutput: () => {},
   provideSerializeGraphRunData: () => {}
}
const root = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
})
const a = root.configureDownstreamVertex({
   slice: createSlice({ name: 'a', initialState: { av: 1 }, reducers: {} })
})
const b = root.configureDownstreamVertex({
   slice: createSlice({ name: 'b', initialState: { bv: 2 }, reducers: {} })
})
const c = configureVertex(
   { slice: createSlice({ name: 'c', initialState: {}, reducers: {} }) },
   _ =>
      _.addUpstreamVertex(a, { fields: ['av'] }).addUpstreamVertex(b, {
         fields: ['bv']
      })
)
createGraph({ vertices: [root, a, b, c], devtools })
const rootToC = captured.edges.find(
   (e: any) => e.downstream === c.name && e.upstream === root.name
)
expect(rootToC.fields).to.deep.equal([]) // ACTUAL: undefined
```

---

## Hardening (latent — no current public-API trigger, but a real structural gap)

### The run pipeline has no error boundary

`graphRunOutput$.subscribe(...)` (`src/graph/createGraph.ts:104`) has only a `next`
handler. There is no `catchError`/resubscribe over the single pipeline, so any
synchronous throw in any operation permanently tears down the one subscription that
drives the whole graph: `graphRunInput$` keeps accepting dispatches but nothing consumes
them, the dispatcher sees no error, and published state silently freezes while Redux
keeps mutating. Throws are currently contained only by per-operation `try/catch`
(`reaction`/`reaction$`/`sideEffect`/`computeFromFields`/now `fieldsReaction`) and the
`compareVertexFields` guard — i.e. whack-a-mole. The two known triggers were just
patched, so there is no _currently reachable_ public-API path that kills the graph; but
the boundary is still absent, so any new/unguarded throw site reintroduces silent
permanent death.

**Demonstrated** by `src/graph/graphErrorResilience.test.ts`, whose blocks are
fail-on-revert guards: temporarily removing any single per-operation guard (e.g. the
`try/catch` now in `fieldsReaction.ts`, or the existence guard in
`compareVertexFields.ts`) makes the corresponding full-graph block go red — the graph
dies and a later, unrelated dispatch is dropped —

```ts
const config = configureRootVertex({
   slice /* {name, other} */
}).fieldsReaction(['name'], ({ name }) => {
   if (name === 'boom') throw new Error('x')
   return slice.actions.setOther('reacted')
})
const vertex = createGraph({ vertices: [config] }).getVertexInstance(config)
graph.dispatch(slice.actions.setName('boom')) // throw inside the mapper
graph.dispatch(slice.actions.setOther('hello'))
expect(vertex.currentState.other).to.equal('hello') // would die with the guard removed
```

Those guards are precisely the whack-a-mole this entry argues against: each closes one
reachable throw site, but the boundary that would contain _any_ throw is still absent.

**Fix.** Add an `error` callback to the subscription that logs and re-subscribes — the
input is a never-completing `Subject`, so re-subscribe only receives future actions and
is loop-safe (same idea `reaction$`'s `catchError` uses). That converts any future
unguarded throw from silent-permanent-death into a logged, recoverable per-run error.

---

## Test gap (not a bug — missing coverage of a verified-working path)

### M4 — Diamond / multi-upstream runtime field flow is untested

The hardest path in the stale-root refactor — a vertex with multiple upstreams whose
closest common ancestor is neither upstream, so its `reduxPathByVertexId` is `root → C`
and `extractReduxState` must walk that while `trackedUpstreamFieldHasChanged` satisfies
the cross-edges — has no runtime coverage. Every `addUpstreamVertex` test asserts only
dependency narrowing; none assert `currentState`/`pick`. **Production is correct** — the
repro below passes today — so this is a regression guard to add, not a defect. Add as
`src/run/diamondDag.test.ts`:

```ts
const root = configureRootVertex({
   slice: createSlice({ name: 'root', initialState: {}, reducers: {} })
})
const a = root.configureDownstreamVertex({
   slice: createSlice({ name: 'a', initialState: { av: 1 }, reducers: {} })
})
const bSlice = createSlice({
   name: 'b',
   initialState: { bv: 10 },
   reducers: {
      setB: (s, x: PayloadAction<number>) => {
         s.bv = x.payload
      }
   }
})
const b = root.configureDownstreamVertex({ slice: bSlice })
const c = configureVertex(
   {
      slice: createSlice({
         name: 'c',
         initialState: { own: 100 },
         reducers: {}
      })
   },
   _ =>
      _.addUpstreamVertex(a, { fields: ['av'] }).addUpstreamVertex(b, {
         fields: ['bv']
      })
).computeFromFields(['av', 'bv', 'own'], {
   sum: ({ av, bv, own }: any) => av + bv + own
})
const cv = createGraph({ vertices: [root, a, b, c] }).getVertexInstance(c)
expect((cv.currentState as any).sum).to.equal(111)
graph.dispatch(bSlice.actions.setB(20))
expect((cv.currentState as any).sum).to.equal(121) // recompute on upstream b change
```

Extend it with an `a`-side loadable emission (a partial run) and assert it recomputes
`c` without reverting `c.own` or `b`'s contribution — the stale-root invariant at a
multi-upstream/CCA vertex, which the unit-level tests structurally cannot reach.

---

## Additional observations (from static review — NOT reproduced on a full graph)

These came out of the code review but were **not** independently demonstrated through
the public API; treat each as a hypothesis to confirm (per CLAUDE.md) before acting.
Most are cleanups/docs rather than behavioural bugs.

- **Dead code:** `src/vertex/VertexData.ts` (obsolete post-refactor type);
  `src/config/toVertexName.ts` (parses an obsolete Symbol-based id format);
  `src/util/shallowEquals.ts` (unused, untested); the unused `store` param +
  `rootVertexConfig` hint in the middleware (`src/graph/createGraph.ts:34`).
- **Robustness edges (off the normal data path, unverified):** no cycle detection — a
  dependency cycle stack-overflows instead of erroring; devtools time-travel
  `provideForceGraphRunOutput` (`createGraph.ts:77-87`) does `Object.keys(fields)` and
  would crash if a forced/replayed run omits a vertex; `extractReduxState` assumes every
  `.downstream[name]` step exists.
- **Loaders mark a field changed on every emission** (`load.ts:79-96`,
  `loadFromFields.ts:132`, `loadFromFields$.ts:127`) even for a reference-identical value
  → a re-emitting loader stream causes needless partial runs. Confirm with a `Subject`
  loader pushed the same object twice, then decide if it's intended.
- **`computeFromFields$` emits a stale computed value before the fresh one** on a
  changed+loaded input (extra `|| fieldsAreLoaded` passthrough clause vs `loadFromFields$`)
  — `computeFromFields$.ts:123-131`.
- **`fieldsReaction` mapper value type** is non-`undefined` for loadable fields that may
  be `loading`/`error` at the time it fires (`VertexConfig.ts:275-283`); make the picked
  value status-aware.
- **Performance:** `findClosestCommonAncestor` recomputed un-memoized (~O(N³) deep
  multi-upstream); duplicate tracked actions accumulate in `trackedActionsInSubgraph`;
  `pickLoadableState` rebuilds a new object reference each emission.
- **Public API surface:** internal `__pushFields` + run-internal types leak into the
  exported `VertexInstance` interface (`VertexInstance.ts:27-30`);
  `PickedLoadableVertexState` and the `VertexFieldState` interfaces are referenced in
  public types but not exported from `src/index.ts`.
- **Docs:** `CLAUDE.md` and ARCHITECTURE.md §4 name pseudo-code symbols that don't exist
  as identifiers (`subgraphShouldRun`, `reduxStateHasChanged`, `childWrapperGraphRun`);
  README TOC has a duplicate `#reaction` anchor so the `reaction$()` link misnavigates.
- **Test harness:** the mocha spec glob `src/**/*.test.ts` (`package.json`) has no
  `--ignore`, so stray/untracked `*.test.ts` files get swept into the run.
