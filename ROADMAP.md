# Roadmap

Forward-looking **planned work** only — features to build and fixes to make. This is the
"what to do next" list. Existing *defects* live in `ISSUES.md`; the operation
error-handling rules live in `src/operation/OPERATION_CONTRACT.md`.

**This file never documents the past.** It holds only work that is *not yet done*. When an
item lands, **delete it** — do not move it to a "done" / "changelog" section, do not leave
it ticked. Completed work is recorded by git history (commits + `git diff`) and by the
code/tests themselves; that is the single source of truth for what shipped. If you find a
"done" list here, it is drift — remove it.

> Context: the operation error-handling contract initiative was started 2026-06-05. The
> graph is driven by a single RxJS subscription, so an error escaping an operation halts
> the whole graph; the graph-level handler is fail-fast observability only. Operations
> must contain their own errors. The pieces below are the remaining work from that
> initiative plus the pre-existing backlog.

## Fixes to make (detail + verified repros in `ISSUES.md`)

- **M3** — devtools multi-upstream edge `fields: undefined`.
- **M4** — diamond DAG runtime test gap.
