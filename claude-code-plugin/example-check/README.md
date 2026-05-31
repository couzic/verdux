# example-check

A small compile/run harness that guards the example code shipped with the
verdux plugin skills. It type-checks every `examples/` file under `../skills/`
against the real library source (`../../src/index.ts`) and runs the example
tests, so a skill edit that introduces non-compiling or broken example code
fails here.

## What it covers

- Every `../skills/*/examples/*.ts` / `*.tsx` file (type-checked).
- The example tests (`../skills/testing/examples/*Test.ts` and
  `../skills/**/examples/*.test.ts`) are executed.
- Extra sample code in this folder, produced by a clean agent given only the
  skills (`../skills/*/SKILL.md` + their `examples/`) and forbidden from reading
  the library `src/` — kept as additional proof that the skills alone yield
  compiling, passing, tree-first-correct verdux code:

  | File | Exercises |
  | --- | --- |
  | `task1.test.ts` | tree-first single-parent vertex + `loadFromFields` + injected-fake test |
  | `task2.test.ts` | multi-parent vertex (the `configureVertex`/`addUpstreamVertex` exception) deriving from two siblings |
  | `task3.test.ts` | `computeFromFields` + `fieldsReaction` |
  | `Task4.tsx` | React Suspense-first, one `useVertexState` pick per leaf (type-checked only) |

## Run

From `claude-code-plugin/example-check/`:

```bash
npm run typecheck   # tsc --noEmit, covers all example + sample files
npm test            # runs the example tests and task*.test.ts
```

Shared deps (rxjs, @reduxjs/toolkit, mocha, ts-node, typescript, chai) resolve
from the repo-root `node_modules`; only the React-side and path-resolution deps
are installed here.
