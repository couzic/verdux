# Known issues

This file documents only currently existing issues. Once an issue is resolved,
it is removed from this file.

> The verified, reproduced-on-a-full-graph defects from the 2026-06-02 multi-agent
> review have all been fixed and removed. What remains below are **static-review
> observations that were NOT reproduced** through the public API — hypotheses to confirm
> (per CLAUDE.md) before acting, mostly cleanups/docs rather than behavioural bugs.

## Additional observations (from static review — NOT reproduced on a full graph)

These came out of the code review but were **not** independently demonstrated through
the public API; treat each as a hypothesis to confirm (per CLAUDE.md) before acting.
Most are cleanups/docs rather than behavioural bugs.

- **Dead code:** `src/vertex/VertexData.ts` (obsolete post-refactor type);
  `src/config/toVertexName.ts` (parses an obsolete Symbol-based id format);
  `src/util/shallowEquals.ts` (unused, untested); the unused `store` param +
  `rootVertexConfig` hint in the middleware (`src/graph/createGraph.ts:34`).
- **Robustness edges (off the normal data path, unverified):** no cycle detection — a
  dependency cycle stack-overflows instead of erroring; devtools time-travel
  `provideForceGraphRunOutput` (`createGraph.ts:77-87`) does `Object.keys(fields)` and
  would crash if a forced/replayed run omits a vertex; `extractReduxState` assumes every
  `.downstream[name]` step exists.
- **Loaders mark a field changed on every emission** (`load.ts:79-96`,
  `loadFromFields.ts:132`, `loadFromFields$.ts:127`) even for a reference-identical value
  → a re-emitting loader stream causes needless partial runs. Confirm with a `Subject`
  loader pushed the same object twice, then decide if it's intended.
- **`computeFromFields$` emits a stale computed value before the fresh one** on a
  changed+loaded input (extra `|| fieldsAreLoaded` passthrough clause vs `loadFromFields$`)
  — `computeFromFields$.ts:123-131`.
- **`fieldsReaction` mapper value type** is non-`undefined` for loadable fields that may
  be `loading`/`error` at the time it fires (`VertexConfig.ts:275-283`); make the picked
  value status-aware.
- **Performance:** `findClosestCommonAncestor` recomputed un-memoized (~O(N³) deep
  multi-upstream); duplicate tracked actions accumulate in `trackedActionsInSubgraph`;
  `pickLoadableState` rebuilds a new object reference each emission.
- **Public API surface:** internal `__pushFields` + run-internal types leak into the
  exported `VertexInstance` interface (`VertexInstance.ts:27-30`);
  `PickedLoadableVertexState` and the `VertexFieldState` interfaces are referenced in
  public types but not exported from `src/index.ts`.
- **Docs:** `CLAUDE.md` and ARCHITECTURE.md §4 name pseudo-code symbols that don't exist
  as identifiers (`subgraphShouldRun`, `reduxStateHasChanged`, `childWrapperGraphRun`);
  README TOC has a duplicate `#reaction` anchor so the `reaction$()` link misnavigates.
- **Test harness:** the mocha spec glob `src/**/*.test.ts` (`package.json`) has no
  `--ignore`, so stray/untracked `*.test.ts` files get swept into the run.
