# Known issues

This file documents only currently existing issues. Once an issue is resolved,
it is removed from this file.

## 1. `reaction$` swallows errors — an errored reaction silently dies

**Behavioral gap — a failing reaction is `console.error`-ed and dropped, never surfaced.**

`reaction$` (`src/operation/reaction$.ts:51-54`) handles a failing reaction
stream with `catchError(error => { console.error(error); return NEVER })` — the
reaction silently terminates (flagged with a literal `// TODO Ouput error`).
Nothing reaches the vertex state or an error field, so the application cannot
observe that a reaction failed.

This is the remaining outlier in the operation error-policy story. The other
asynchronous operations surface per-field, recoverable errors, while
`reaction$` does not:

- `computeFromFields` (`src/operation/computeFromFields.ts:24-30`): per-field
  `{ status: 'error', errors: [e] }`, recomputed each run → recoverable.
- `load` / `loadFromFields` / `loadFromFields$`: per-field error, the vertex
  stays alive → recoverable.
- `reaction$`: `console.error` + `NEVER` → **silent death**. ← still open.

**Expected fix:** adopt a consistent, surfaced error policy for reactions
instead of only logging — e.g. propagate the error so it is observable rather
than swallowed.

**Severity:** behavioral. Reaction failures are invisible to the application
and harder to diagnose than a thrown error.

## 2. `loadFromFields` / `loadFromFields$` strand derived fields in `loading` when an upstream input field errors

**Behavioral gap — an upstream `error` is not propagated; the dependent fields sit in `loading` forever instead of `error`.**

Both operations only run their loaders once every tracked input field is
`loaded`. When a tracked input field is in `error`, they fall back to the
`loading` branch and never surface the upstream failure:

- `loadFromFields` (`src/operation/loadFromFields.ts:62-67`): computes the
  aggregate `status` (and `errors`) of the picked input fields via
  `toVertexLoadableState`, then `if (status !== 'loaded')` forces every derived
  field to `loading` — the collected `errors` are discarded (flagged with a
  literal `// TODO Pass down errors`).
- `loadFromFields$` (`src/operation/loadFromFields$.ts:83-92`): the loader feed
  is filtered by `fields.every(status === 'loaded')`, so an errored input means
  the loader never runs and `loading$` leaves the field in `loading`.

**Consequence:** a downstream `loadFromFields` reading an upstream field that
definitively failed reports its derived fields as `loading` indefinitely (until
the upstream recovers), rather than `error`. Verified on the public surface:
upstream `a.status === 'error'` yields downstream `b.status === 'loading'`.

This is broader since the per-field loader error policy landed: any upstream
field can now be in `error` (not just `computeFromFields`), so a failed
`load` / `loadFromFields` / `loadFromFields$` flowing downstream now triggers
this. It is the input-side complement to the loader-stream error handling those
operations already do — the loader's *own* error is captured, but an error in a
dependency the loader *needs* is not.

**Expected fix:** when the aggregate input status is `error`, propagate it —
set the derived fields to `{ status: 'error', value: undefined, errors }` using
the upstream `errors`, instead of resetting them to `loading`. Apply to both
operations.

**Severity:** behavioral. Derived fields are stuck in a perpetual loading state
with no way to observe the upstream failure.
