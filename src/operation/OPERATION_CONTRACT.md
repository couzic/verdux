# The operation error-handling contract

This is the single source of truth for how a verdux **operation** must handle
errors.

An *operation* is one of the RxJS operators in `src/operation/` that runs as
part of a vertex's run (`reaction`, `reaction$`, `sideEffect`, `fieldsReaction`,
`computeFromFields`, `computeFromFields$`, `load`, `loadFromFields`,
`loadFromFields$`). Each wraps **user-supplied code** — a mapper, a compute
function, a loader, an inner Observable — which can fail: by throwing
synchronously, or by erroring the Observable it returns. Whether a given failure
is a *containable runtime error* or a *fail-fast programming error* depends on the
callback's **return contract** — see [Out of scope](#out-of-scope).

## Why this matters

The whole graph is driven by a **single** RxJS subscription
(`graphRunOutput$.subscribe` in `createGraph`). RxJS semantics: an error that
reaches the subscriber tears down the *entire* chain, not just the operator that
failed. That subscription's `error` handler is **fail-fast observability only** —
it logs a diagnostic and the graph **stops** (vertices stop reacting while Redux
keeps mutating). It deliberately does **not** recover, because by the time an error
reaches it the run is already torn down and resuming would run the app on
inconsistent state.

So an unguarded throw site is not a localized bug — **it halts the entire graph.**
The graph-level handler is a tripwire, never a fallback. Containment is each
operation's own responsibility.

## The rule

> An operation must **never** let an error from user-supplied code reach
> `graphRunOutput$`. It catches the error and degrades **locally**, according to
> what the operation produces.

There are two kinds of operation, with two degradation modes.

### Field-producing operations

`computeFromFields`, `computeFromFields$`, `load`, `loadFromFields`,
`loadFromFields$` — they produce a vertex **field**.

On any runtime error from user code — a compute function that throws, or a loader /
inner stream that errors:

- Surface the affected field as
  `{ status: 'error', value: undefined, errors: [error] }`.
- **Do not log.** The field's `status: 'error'` and `errors` array **are** the
  report — they are observable through the public API
  (`currentLoadableState` / `loadableState$`). Logging would be redundant console
  noise (a loader hitting a 404 is not a framework fault).
- The stream stays alive — a later input recomputes / reloads normally.
- Only the affected field degrades; sibling fields and other vertices are
  untouched.

**Reference implementation:** `computeFromFields.ts` (the synchronous version is
canonical — see its per-field `try/catch` producing an `error`-status field).

**What counts as the error depends on the callback's return contract.** A
`computeFromFields` computer returns a plain **value**, so throwing synchronously
is its *only* error channel — catch it and degrade the field (the canonical
`try/catch`). A **loader** (or a `computeFromFields$` computer) instead returns an
**Observable**, so its errors must arrive *through* that Observable as an `error`
notification — those degrade the field. A loader that **throws synchronously** or
**returns a non-Observable** never produced an Observable at all: that is not a
runtime data error but a breach of the return contract — a programming bug — and it
**fails fast** (out of scope, see below). Do **not** wrap the factory call or the
`isObservable` check in the containing `try/catch`.

### Effect / action-producing operations

`reaction`, `reaction$`, `sideEffect`, `fieldsReaction` — they produce an action to
re-dispatch or a side effect to run, **not** a field.

On any error from the user's mapper or callback:

- **Log** a diagnostic whose required part is the prefix
  `[verdux] <operation> on <identity> threw an error.` followed by the error object.
  `<identity>` is the tracked action type (e.g. `"root/setName"`) or, for
  `fieldsReaction`, the watched field list (e.g. `fields [name]`). The trailing
  sentence (what was skipped) is free-form — only the prefix and the error object
  are mandated.
- Skip just that action/effect (do not re-dispatch the action / do not run the
  side effect).
- The stream stays alive.

There is no field to carry the error, so the log is the **only** observability —
hence it is required here and forbidden above.

**Reference implementations:** `reaction.ts`, `reaction$.ts`, `sideEffect.ts`.

**The same return-contract split applies here.** `reaction`, `sideEffect` and
`fieldsReaction` return a plain **value** (an action, or `void`), so a synchronous
throw is their only error channel and is logged + skipped. `reaction$`'s mapper
returns an **Observable**, so an error delivered *through* that stream is logged +
skipped (its `catchError`), but a mapper that **throws when called** or **returns a
non-Observable** breached its return contract and **fails fast** (the `isObservable`
check) — exactly like the field-producing factories. See [Out of scope](#out-of-scope).

## Every operation at a glance

What the user callback is contracted to **return** decides how a failure is handled.
A **value**-returning callback can only fail by throwing, so the throw *is* its error
channel and is handled (degraded for field ops, logged + skipped for effect ops). An
**Observable**-returning callback must deliver runtime errors *through* that Observable
(handled the same way); one that instead throws when called, or returns a
non-Observable, breached its return contract and **fails fast**.

| Operation | Callback returns | Throws when called / returns non-Observable | Error via returned Observable |
| --- | --- | --- | --- |
| `computeFromFields` | value | — (throw → error field) | — |
| `reaction` | value (action) | — (throw → logged + skipped) | — |
| `fieldsReaction` | value (action \| null) | — (throw → logged + skipped) | — |
| `sideEffect` | value (void) | — (throw → logged + skipped) | — |
| `computeFromFields$` | Observable | **fail fast** | error field |
| `load` | Observable (given directly) | **fail fast** (non-Observable) | error field |
| `loadFromFields` | Observable | **fail fast** | error field |
| `loadFromFields$` | Observable | **fail fast** | error field |
| `reaction$` | Observable (action) | **fail fast** | logged + skipped |

## Invariants (both kinds)

1. **No containable error reaches `graphRunOutput$`.** Every value-returning
   callback call site is guarded with a synchronous `try/catch`, and every
   user-supplied Observable merged into the output has a `catchError`.
   (Return-contract breaches — a factory that throws or returns a non-Observable —
   are deliberately left **unguarded** so they fail fast; see
   [Out of scope](#out-of-scope).)
2. **The stream stays alive.** The operation never completes or errors out; future
   runs are still processed. (`catchError((e, caught) => …)` returning a recovering
   stream, or a `try/catch` returning a safe value — never a bare rethrow.)
3. **Containment is local.** No sibling field is blanked and no other vertex is
   affected by one operation's failure.

## Out of scope

This contract governs **runtime errors in the data a user callback handles** — a
value-returning computer that throws, or an Observable-returning loader/computer
whose returned stream errors. It does **not** govern **breaches of a callback's
return contract**, which are programming errors and must **fail fast and loud**
(never be contained as an `error`-status field):

- **An Observable-returning callback that throws synchronously or returns a
  non-Observable.** Every callback contracted to return an `Observable` — a loader,
  a `computeFromFields$` computer, or a `reaction$` mapper — that does neither never
  produced one. This is a bug in the developer's code, identical in kind whether it
  threw or returned the wrong type. Surface it loudly:
  - Where the factory runs **once at construction** (`computeFromFields$`,
    `loadFromFields$`, `reaction$`; likewise `load`, whose loaders are Observables
    given directly), the `isObservable` check throws eagerly at `createGraph`,
    before any run.
  - Where the factory **runs per-input** (`loadFromFields`), it can only be caught
    on the offending run, so it throws there and **escapes to the graph-level
    handler** (which logs and stops the graph).

  Either way: do **not** wrap the factory call or the `isObservable` check in the
  `try/catch` that contains a returned stream's error. (Contrast a value-returning
  `computeFromFields` computer, whose synchronous throw *is* its error channel and
  *is* contained — see the field-producing section.)
- **Other construction / config-time validation may throw eagerly** — it runs
  before any run, so failing fast and loud is correct there.
- **The graph-level `error` handler is not part of the contract surface.** It
  exists for observability when the contract is *violated*; an operation that
  relies on it instead of containing its own errors is in breach.

## Testing requirement

Every operation ships **full-graph** coverage of its error path — a colocated
`*.error.test.ts` (or equivalent block in `graphErrorResilience.test.ts`) that,
through the public API only (`createGraph` + `dispatch` + a public read:
`currentState` / `currentLoadableState`, or a `console.error` spy), proves an
erroring callback degrades **as specified above** *without killing the graph*.
Per CLAUDE.md: write the failing full-graph test first, watch it go red, then fix.

A **return-contract breach** (a factory that throws or returns a non-Observable) is
covered the other way: a test asserting it **fails fast** — the graph stops and the
escaped-error diagnostic is logged (see
`loaderError.test.ts` → "a loader that does not return an Observable fails fast").

## Review checklist

For each operation file:

- Every site invoking a **value-returning** callback is wrapped in `try/catch`;
  a site invoking an **Observable-returning** factory is **not** — a throw or
  non-Observable there must fail fast (see Out of scope).
- Every user-supplied Observable merged into the output has a `catchError`.
- **Field op** → degrades to an `error`-status field; **no** logging.
- **Effect op** → logs the `[verdux] … threw` diagnostic and skips; produces no
  field.
- The stream stays alive after containment (no completion, no rethrow).
- Containment is local (siblings / other vertices untouched).
- A full-graph error test exists and asserts the degraded behavior.
