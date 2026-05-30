# Known issues

Tracked source-level issues to fix in `verdux` itself (distinct from the
`claude-code-plugin/` skill docs, which should not work around these).

## 1. `addUpstreamVertex` return type over-reports inherited dependencies

**Type bug — behavior is correct, the type is misleading.**

When building a multi-parent vertex with
`configureVertex(options, b => b.addUpstreamVertex(config, options))`, the
return **type** of `addUpstreamVertex` merges *all* of the upstream's
`Dependencies` into the child's dependency type, regardless of whether
`options.dependencies` restricts which deps are actually pulled.

- **Type** (`src/config/VertexConfigBuilder.ts`): the `addUpstreamVertex`
  return type maps over `keyof UpstreamDependencies | keyof Dependencies`
  unconditionally, so every upstream dependency appears on the child.
- **Runtime** (`src/config/VertexConfigBuilderImpl.ts`, `buildDependencies`):
  when `options.dependencies` is provided, only the listed keys are copied
  from that upstream; when omitted, all are inherited. This runtime behavior
  is the intended one.

**Consequence:** a dependency the user did *not* pull is reported as present
by the compiler (`vertex.dependencies.kpiService` type-checks) but is
`undefined` at runtime — a crash with no compile-time warning.

**Expected fix:** narrow the `addUpstreamVertex` return type so the child's
dependency type includes only the dependencies actually pulled — i.e. when
`options.dependencies` is provided, restrict to that subset (e.g. via
`Pick<UpstreamDependencies, Picked>`); when omitted, include all (current
behavior). Single-parent `configureDownstreamVertex` is unaffected: it calls
`addUpstreamVertex(parent, { fields })` with no `dependencies` option, so it
correctly inherits the whole parent dependency object.

**Reproduction:**
`claude-code-plugin/skills/verdux-graph-design/examples/multiUpstream.test.ts`
— the case _"does NOT auto-flow a root dependency to a multi-parent vertex
when the upstream is pulled with an explicit `dependencies` list omitting
it"_ asserts the runtime `undefined`. After the type fix, referencing the
unpulled dependency without a cast should additionally become a compile
error.

**Severity:** type-safety (misleading types, possible runtime crash). Low
behavioral risk.
