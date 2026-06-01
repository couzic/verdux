# Known issues

This file documents only currently existing issues. Once an issue is resolved,
it is removed from this file.

## 1. `loadFromFields` / `loadFromFields$` strand derived fields in `loading` when an upstream input field errors

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
