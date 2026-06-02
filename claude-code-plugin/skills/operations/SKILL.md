---
name: operations
description: Reference for the nine vertex operations in verdux and when to reach for each. Covers the field-producing operations (computeFromFields, computeFromFields$, load, loadFromFields, loadFromFields$) and the action-reacting operations (reaction, reaction$, fieldsReaction, sideEffect), with a decision table, the sync-vs-stream and loadable-vs-plain distinctions, loader error policy, bringing an external system in (value-stream vs event-stream), owning a long-lived external subscription (SSE/WebSocket) keyed on a field via reaction$ + switchMap, and self-clearing transients (toast/popup/flash that auto-clear) via reaction$ + switchMap over an injected timer. Use whenever the user is working on a single vertex's behavior — deriving a field, loading data, cascading one load off another, reacting to an action, consuming an SSE/WebSocket stream, building an auto-clearing toast/popup/flash, or asking "which operation should I use" / "how do I use load / loadFromFields / computeFromFields / reaction / sideEffect".
---

# verdux operations

A vertex's behavior is built from **operations** chained onto its config (or
onto the `vertex` handle inside `.withDependencies`). There are nine. They fall
into two families:

- **Field-producing** — add a field to the vertex's output: `computeFromFields`,
  `computeFromFields$`, `load`, `loadFromFields`, `loadFromFields$`.
- **Action-reacting** — respond to an action or a field change:
  `reaction`, `reaction$`, `fieldsReaction`, `sideEffect`.

Each operation is chainable and returns the config, so later operations can
read fields produced by earlier ones.

## Attaching operations (with or without dependencies)

Operations chain **directly** on a vertex config:

```ts
export const vertexConfig = configureRootVertex({ slice })
   .computeFromFields(['count'], { doubled: ({ count }) => count * 2 })
   .load({ greeting: of('hello') })
```

Wrap them in `.withDependencies((deps, vertex) => vertex.<ops>(...))` **only
when an operation needs an injected service** (an API client, a router). The
callback hands you the resolved dependencies plus a `vertex` handle exposing
the same operations:

```ts
export const vertexConfig = rootVertexConfig
   .configureDownstreamVertex({ slice })
   .withDependencies(({ apiClient }, vertex) =>
      vertex.loadFromFields(['userId'], {
         user: ({ userId }) => apiClient.getUser(userId)
      })
   )
```

If none of your operations call a service, skip `.withDependencies` entirely
and chain directly. See the `verdux:dependency-injection` skill for the
service-injection mechanics.

## Which operation? (decision table)

| Need                                                              | Operation            |
| ----------------------------------------------------------------- | -------------------- |
| Derive a field synchronously from other fields                    | `computeFromFields`  |
| Derive a field with rxjs operators (debounce, scan, combine…)     | `computeFromFields$` |
| Load a field from a standalone observable (no field inputs)       | `load`               |
| Load a field from other fields' values (incl. cascade loads)      | `loadFromFields`     |
| Load from fields with rxjs operators (debounce + switchMap, …)    | `loadFromFields$`    |
| Turn one tracked action into another action                       | `reaction`           |
| Turn a stream of a tracked action into a stream of actions        | `reaction$`          |
| Dispatch an action when picked fields change                      | `fieldsReaction`     |
| Run an effect on a tracked action, dispatching nothing            | `sideEffect`         |
| Own a long external subscription keyed on a field (SSE/WS)        | `reaction$` + `switchMap` over an injected source |
| Show something, then auto-clear it after a delay (toast/popup)    | `reaction$` + `switchMap` over an injected `time.timer` |

Two recurring choices:

- **Plain function vs `$` variant.** The non-`$` form takes a plain function of
  the picked values. The `$` form takes an **rxjs operator** over an observable
  of those values — reach for it only when you need time/stream behavior
  (`debounceTime`, `distinctUntilChanged`, `switchMap`, `scan`, `combineLatest`).
- **`compute*` vs `load*`.** `compute*` produces a plain field that mirrors the
  loadable-ness of its inputs (sync, derived from already-present values).
  `load*` always produces a **loadable** field (`status: 'loading' | 'loaded' |
  'error'`) fed by an observable.

## Field-producing operations

All five are demonstrated together in
`examples/computeAndLoadOperations.ts`.

### `computeFromFields(fields, computers)`

Synchronous derived field. The computer receives the picked values and returns
the derived value.

```ts
.computeFromFields(['count'], {
   doubled: ({ count }) => count * 2
})
```

### `computeFromFields$(fields, computers)`

Same intent, but the computer is an rxjs operator over the stream of picked
values. Use it for derivations that need stream context.

```ts
.computeFromFields$(['count'], {
   tripled: count$ => count$.pipe(map(({ count }) => count * 3))
})
```

### `load(loaders)`

A loadable field fed by a standalone observable — no field inputs. Reach for it
when a field's value comes straight from a dependency's stream and the **latest
value is what the field always means**: a *value-stream* like a route match, a
live price, a presence flag, or a one-shot fetch.

```ts
.load({
   greeting: of('hello')
})
```

> **Value-stream, not event-stream.** `load` is for streams whose latest value
> *is* the field. It is the wrong tool for a stream of **discrete events** — a
> WebSocket message, a session revocation, a notification trigger — where each
> occurrence drives a *consequence* rather than naming a current value. A
> "last event" field is an anti-pattern: it can't fire on two identical
> consecutive events and can't carry an imperative effect (navigation, a
> toast). Bridge an event stream to a **dispatched action** instead, then
> handle it with `reaction` / `sideEffect` — see "Bridging an external stream"
> below.

### `loadFromFields(fields, loaders)`

A loadable field whose loader receives the picked values and returns an
observable. This is the **cascade-load** primitive: load B from the value of
A. The loader re-runs whenever a listed field changes.

```ts
.loadFromFields(['count'], {
   countLabel: ({ count }) => of(`count=${count}`)
})
```

### `loadFromFields$(fields, loaders)`

The streaming form of `loadFromFields`: the loader is an operator over the
picked-values stream. This is where debounce + `switchMap` search-style loaders
live.

```ts
.loadFromFields$(['query'], {
   upperQuery: query$ => query$.pipe(map(({ query }) => query.toUpperCase()))
})
```

A realistic debounced search loader (from `verdux:graph-design`'s
`flatVertexConfig.ts`):

```ts
.loadFromFields$(['query'], {
   results: pipe(
      map(_ => _.query.trim().toLowerCase()),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => (q.length === 0 ? of([]) : apiClient.search(q)))
   )
})
```

> **Imported vs injected timing.** The operator is **imported** here — the
> simple default, and the right choice until timing gets in your way. The one
> reason to switch: **testing** the debounced field. Inject the timing operator
> as a dependency instead and swap it for an identity operator in tests, so the
> field resolves synchronously with no fake timers. That's the only trade — for
> a field you won't test on timing, keep the import. See the injectable-operator
> pattern in `verdux:dependency-injection`.

## Loader errors

A loadable field is `status: 'loading' | 'loaded' | 'error'`. When a loader's
observable **errors**, that one field is parked at `status: 'error'` (with the
error in its `errors` array); every sibling field and the vertex itself stay
alive. There is no verdux-specific error channel — a loader signals failure the
standard rxjs way, by erroring its stream.

Recovery differs by operation, and it follows directly from when each rebuilds
its loader:

- **`load`** — the loader is a standalone observable, subscribed once. An error
  is terminal: the field stays in `error` for the life of the graph (nothing
  re-triggers it).
- **`loadFromFields`** — the loader is rebuilt on every change of a listed
  field. An error parks the field, and the **next input change re-runs the
  loader**, so a later success restores `loaded`. This is automatic
  refetch-on-input.
- **`loadFromFields$`** — you own the stream. An rxjs stream that errors is
  terminated, so the field stays in `error` even as inputs keep changing —
  verdux will not resurrect a stream you defined. To let a transient failure
  recover, handle it **inside** your operator (`retry`, `catchError`, or a
  `switchMap` whose inner observable catches), exactly as in any rxjs pipeline.

## Action-reacting operations

All four are demonstrated in `examples/reactionOperations.ts`. `reaction`,
`reaction$`, and `fieldsReaction` **re-dispatch** their result back through the
store; `sideEffect` dispatches nothing.

> **Re-dispatch is synchronous.** When a reaction returns an action, verdux
> dispatches it back through the store **within the same synchronous call stack**
> as the originating `dispatch` — no scheduler, microtask, or timer sits between
> an action and the reactions it triggers, and `switchMap` (and friends) cancel
> synchronously. This is a load-bearing correctness guarantee: in single-threaded
> JS there is **no interleaving** between a dispatch and its reactions, so a stale
> reaction cannot land after a newer one and there are **no dispatch races** to
> guard against: don't add `popupId`-style guards; prove the safety with a test
> instead. Ordering is deterministic: `fieldsReaction`s drain before
> `reaction` / `reaction$`, one action at a time, FIFO.

> **Common trap — these take an action creator, not an Observable.**
> `reaction(actionCreator, …)`, `reaction$(actionCreator, …)`, and
> `sideEffect(actionCreator, …)` all key off a **tracked action**. `reaction$`
> is the easy mistake: it *manipulates* an `action$` stream, so it looks like
> it could *consume* an external one — but the stream it hands your mapper is
> the stream **of that action creator**, never an Observable you supply. You
> can't make an SSE / WebSocket / router stream the *tracked action*. You bring
> the external stream in through **an action** that triggers it: bridge each
> event (or each "open this channel" intent) to a dispatched action, then — for
> a field-indexed subscription — `switchMap` *to* the external source inside the
> mapper. See "Bringing an external system in" and "Own a long-lived external
> subscription" below.

### `reaction(actionCreator, mapper)`

Map one occurrence of a tracked action to a new action. The mapper receives the
vertex's loadable state plus the action `payload`.

```ts
.reaction(incremented, () => echo('incremented'))
```

### `reaction$(actionCreator, mapper)`

Map a **stream** of the tracked action to a stream of actions — for debouncing,
buffering, or async work between the action and its consequence.

```ts
.reaction$(queryChanged, action$ =>
   action$.pipe(map(({ payload }) => echo(payload)))
)
```

### `fieldsReaction(fields, mapper)`

Dispatch an action when one of the picked fields changes. Return `null` to skip
a dispatch. (Does not fire on the initial run — only on subsequent changes.)

```ts
.fieldsReaction(['count'], ({ count }) =>
   count >= 3 ? sizeBucketChanged('big') : sizeBucketChanged('small')
)
```

### `sideEffect(actionCreator, callback)`

Run an effect on a tracked action without producing an action. The escape hatch
for things that must not feed back into the store: logging, analytics,
imperative navigation.

```ts
.sideEffect(incremented, () => {
   analytics.track('incremented')
})
```

## Bringing an external system in: value-stream vs event-stream

Every external input enters the graph one of two ways, decided by its nature —
not by what API the source happens to expose.

- **Value-stream → `load*`.** The source's *latest value is the field*: a route
  match, a live price, a presence flag, the result of a fetch. Adapt it to an
  Observable (if it isn't one already) and `load` it. A router that only
  exposes an imperative `subscribe()` is still a value-stream — wrap it once
  (`new Observable(sub => router.subscribe(() => sub.next(current())))`) and
  load off that.

- **Event-stream → bridge to a dispatched action.** The source emits *discrete
  events*, each driving a consequence: a WebSocket message, an SSE
  `auth-revoked`, a push notification. No operation auto-subscribes you to an
  external stream — you map each event to an action and `dispatch` it; the
  vertex reacts to that *action*, not to the stream. **Who owns the subscription
  depends on what governs its lifecycle:**

  - **App-lifetime / global stream → subscribe once at bootstrap.** A stream
    that's simply "on" for the whole session and isn't keyed by any state — a
    global `auth-revoked` channel — is owned by a single module-level
    subscription at app start. This is *not* a React `useEffect` (which opens
    one socket per component mount); it's one subscription for the app:

    ```ts
    // bootstrap (outside any vertex): one subscription → dispatch
    sse.on('auth-revoked', () => graph.dispatch(authRevoked()))

    // the vertex reacts to the ACTION, not to the stream
    .sideEffect(authRevoked, () => router.navigate('/login'))
    ```

  - **Field-indexed / data-scoped stream → `reaction$` owns it.** When the
    stream's lifecycle follows a slice field — open the channel for *this*
    `productId`, re-key when it changes, close on navigate-away — own it inside
    the graph with `reaction$` + `switchMap` over an injected source. The next
    section is this pattern in full.

## Own a long-lived external subscription

A persistent push stream whose lifecycle follows a slice field — a per-`productId`
SSE channel, a per-`orderId` WebSocket — is owned **inside the graph**, not by a React
`useEffect`. A hook owns a socket *per component mount*, so mounting two readers
of the same channel opens two sockets; the bug is structural. Bind the socket to
the **data** instead and there is exactly one per `id`, regardless of how many
components read the resulting state.

This is a `reaction$`, not a `load*`: a heterogeneous channel fans one stream out
into *many* actions (≈30 named server events → ≈30 reducers), whereas `load*`
produces a single field. The source is an **injected Observable factory** (see
`verdux:dependency-injection`, "Inject a long-lived external stream").

Model the whole lifecycle with **one action carrying `id | null`**, and let
`switchMap` do the open / re-key / close:

```ts
// channelChanged(productId) opens or re-keys; channelChanged(null) closes.
.reaction$(channelChanged, in$ =>
   in$.pipe(
      switchMap(({ payload: id }) =>
         id == null ? EMPTY : sse.open(id).pipe(map(toAction))
      )
   )
)
```

Why this exact shape:

- **`switchMap` makes the socket follow the `id`.** On a new `id` it unsubscribes
  the previous `sse.open(prevId)`, whose teardown (`() => es.close()`) closes the
  old socket before opening the new one. One socket per `id`, always.
- **Close is a value, not a second action.** Dispatching `channelChanged(null)`
  on navigate-away maps to `EMPTY`, so `switchMap` tears the live socket down and
  opens nothing. A *separate* `closed` action would never reach this
  reaction (it keys on `channelChanged` only), so the socket would leak — fold
  open, re-key, and close into the single `id | null` action.
- **`map(toAction)`** turns each server event into the slice action that handles
  it; those actions re-dispatch through the store like any other.

The `reaction$` mapper is subscribed once for the graph's life, so the `switchMap`
stays live across every `channelChanged` — there's no re-subscription gap. The
subscription is owned by the vertex, injected, and therefore testable: inject a
`Subject` for `sse.open` and the test pushes events synchronously.

## Self-clearing transients (show, wait, clear)

A toast, popup, or flash that shows and then clears itself after a delay is the
canonical win over `useEffect` + `setTimeout`: model it as a `reaction$` whose
`switchMap` runs an **injected timer** (`time.timer(ms)`, a sibling of
`time.debounce` — see `verdux:dependency-injection`). Showing the transient again
**resets** the timer for free, because `switchMap` cancels the in-flight one; and
the timing is testable because the timer is a dependency, not a real `setTimeout`.

Single-phase — a flash that clears after 3 s; a new flash restarts the timer:

```ts
.reaction$(resultFlashed, in$ =>
   in$.pipe(switchMap(() => time.timer(3000).pipe(map(() => flashCleared()))))
)
```

Multi-phase — a popup that animates out before it clears (show → 2 s → exiting →
0.5 s → gone). The whole timeline is one `concat` inside one `switchMap`, so a
re-show cancels a *mid-sequence* phase and starts over:

```ts
.reaction$(bonusShown, in$ =>
   in$.pipe(
      switchMap(({ payload }) =>
         concat(
            time.timer(2000).pipe(map(() => bonusExiting(payload.id))),
            time.timer(500).pipe(map(() => bonusCleared(payload.id)))
         )
      )
   )
)
```

Because re-dispatch and `switchMap` cancellation are synchronous (see the
reactions note above), there are no stray timers to leak, and the tests read
`dispatch → fire → assert` with no fake timers. The runnable version is
`examples/selfClearingTransient.ts`, with its `ManualClock` test (covered in
`verdux:testing`) asserting both the lifecycle and the reset-cancels-the-old-timer
guarantee.

**Scaling to independent instances.** For N transients in flight at once (a
per-row toast, a per-id flash), key the stream by id so each instance resets only
its own timer. Lift the per-instance pipeline into `groupBy` + `mergeMap`:

```ts
.reaction$(flashed, in$ =>
   in$.pipe(
      groupBy(({ payload }) => payload.id),
      mergeMap(group$ =>
         group$.pipe(
            switchMap(() =>
               time.timer(3000).pipe(map(() => flashCleared(group$.key)))
            )
         )
      )
   )
)
```

`mergeMap` keeps every id's pipeline alive in parallel; the inner `switchMap`
gives each id its own latest-wins reset. This is generic rxjs fan-out — no new
verdux mechanic — so it stays a pointer, not a worked example.

## Rules of thumb

- **Prefer `loadFromFields` over `reaction` for data flow.** Reactions are an
  action-to-action escape hatch, not the primary way to move data between
  fields. If field B is a function of field A, load it with `loadFromFields`,
  don't wire a reaction.
- **Reach for a `$` variant only when you need stream behavior.** A plain
  function is simpler and the default; add `$` when you genuinely need rxjs
  operators.
- **`sideEffect` is the only operation that must not dispatch.** If your effect
  needs to update state, it should be a `reaction`/`fieldsReaction` returning an
  action instead.
- **Operations chain in order.** A field must be produced before a later
  operation can list it in its `fields` array.

## See also

- `examples/computeAndLoadOperations.ts` — the five field-producing operations,
  with `examples/operations.test.ts` asserting their runtime behavior.
- `examples/reactionOperations.ts` — the four action-reacting operations.
- `examples/selfClearingTransient.ts` — self-clearing transients via `reaction$`
  + `switchMap` over an injected `time.timer`, with a `ManualClock` test.
- `verdux:graph-design` skill — where these operations sit in the larger graph,
  and how `.withDependencies(...)` injects services into a loader.
- `verdux:dependency-injection` skill — supplying the services that loaders call.
- `verdux:testing` skill — asserting on the fields these operations produce.
