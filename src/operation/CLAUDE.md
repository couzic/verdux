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
