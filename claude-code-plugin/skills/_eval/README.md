# Skill eval / regression suite

These files were produced by **clean agents that were given only the verdux
plugin skills** (`../*/SKILL.md` + their `examples/`) as their source of truth —
explicitly forbidden from reading the library `src/`. They are the Phase 4 eval:
evidence that an agent guided solely by the skills produces compiling,
passing, tree-first-correct verdux code, and a regression guard against future
skill edits that would mislead an agent.

| File | Exercises |
| --- | --- |
| `task1.test.ts` | tree-first single-parent vertex + `loadFromFields` + injected-fake test |
| `task2.test.ts` | multi-parent vertex (the `configureVertex`/`addUpstreamVertex` exception) deriving from two siblings |
| `task3.test.ts` | `computeFromFields` + `fieldsReaction` |
| `Task4.tsx` | React Suspense-first, one `useVertexState` pick per leaf (type-checked only) |

Run: from `claude-code-plugin/skills/`, `npm run typecheck` (covers all) and
`npm test` (runs the `*.test.ts` here alongside the example tests).
