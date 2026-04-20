# verdux Claude Code plugin

A Claude Code plugin that ships React-focused skills for using the
[`verdux`](https://github.com/couzic/verdux) state-management library in web
projects. When you ask Claude questions about designing a verdux graph, wiring
dependencies, writing tests, or binding React components to verdux, the
appropriate skill triggers automatically.

## Skills

| Skill | What it covers |
|---|---|
| `verdux-graph-design` | Decomposing an app into vertices; root-vertex-as-DI-well convention; `configureDownstreamVertex`; when to track `upstreamFields`; nesting vs flat graphs; why the router is a dependency, not a vertex |
| `verdux-dependency-injection` | Declaring root dependencies; `.withDependencies` consumption pattern; deriving child deps; `.injectedWith` for tests and environments |
| `verdux-testing` | Per-test `createGraph` setup; mocking services via `.injectedWith` + RxJS `Subject` stubs; asserting `currentState` / `currentLoadableState`; verifying rerender minimization via `pick()` emissions |
| `verdux-react-integration` | Module-singleton graph; `GraphContext`; Suspense-first `useVertexState` hook (via `observable-hooks`); `useDispatch`; in-band sentinels for empty/error states; fine-grained per-leaf picks |

Each skill includes copy-paste-ready example files under its `examples/`
folder. The skills auto-trigger on verdux-related questions and are also
directly invocable as `/verdux:verdux-graph-design`, etc.

## Installation

Load the plugin from this directory:

```bash
cc --plugin-dir /path/to/verdux/claude-code-plugin
```

Or copy the plugin into your project's `.claude-plugin/` directory for
project-scoped use.
