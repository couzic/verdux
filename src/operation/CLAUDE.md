# src/operation/

Each file here is one **operation**: a small RxJS operator over
`VertexRunData` / `GraphRunData` (one file per operation, plus colocated
`*.test.ts` and, for error paths, `*.error.test.ts`). These are the primitives
behind the fluent config API — change one here to change the semantics of `load`,
`computeFromFields`, `reaction`, etc.

**Before adding or changing any operation, read
[OPERATION_CONTRACT.md](./OPERATION_CONTRACT.md).** It is the single source of truth
for operation error handling. In short:

- An operation must **never** let an error from user-supplied code escape to the
  graph subscription — an escaped error fail-fast-**halts the whole graph**.
- **Field-producing** ops (`computeFromFields[$]`, `load`, `loadFromFields[$]`)
  degrade to an `error`-status field — **no logging** (the field carries the error).
- **Effect/action** ops (`reaction[$]`, `sideEffect`, `fieldsReaction`) **log** a
  `[verdux] … threw` diagnostic and skip — there is no field to carry the error.
- Every operation ships a full-graph error test proving it degrades without killing
  the graph.

See the contract for the exact rules, invariants, out-of-scope cases, and review
checklist.

## Field change-detection: compute, don't assume

A **field-producing** operation must flag a field changed only when it *actually*
changed — never hardcode `changedFields: { [fieldName]: true }`. Compute it with
`compareVertexFields(latestOutputFields, { [fieldName]: field })` (`src/run/`),
the same helper `computeFromFields` uses, which diffs status, value, and errors
against the previous field. A loader re-emitting a **reference-identical** value
therefore produces an **empty** `changedFields`: the downstream gate skips and
change-gated reads (`pick`) do not re-fire. Identical re-emission is a no-op, and
must stay one — `load`, `loadFromFields`, and `loadFromFields$` all share this
rule. See `ARCHITECTURE.md` §5 (the "fourth fact" about the injected emission)
and invariant #2.
