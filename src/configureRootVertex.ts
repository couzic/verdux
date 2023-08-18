import { Reducer, Slice } from "@reduxjs/toolkit"
import { ReducerWithInitialState } from "@reduxjs/toolkit/dist/createReducer"
import { RootVertexConfigImpl } from './RootVertexConfigImpl'
import { VertexConfig } from "./VertexConfig"
import { IsPlainObject } from "./IsPlainObject"

export const configureRootVertex = <ReduxState extends object, Dependencies extends object = {}>(options: ({
  slice: Slice<ReduxState>,
} | {
  name: string,
  reducer: ReducerWithInitialState<ReduxState>,
}) & {
  dependencies?: { [K in keyof Dependencies]: () => Dependencies[K] }
}): IsPlainObject<Dependencies> extends true
  ? VertexConfig<{
    reduxState: ReduxState,
    readonlyFields: {},
    loadableFields: {},
    dependencies: Dependencies
  }>
  : never => {
  if ('slice' in options) {
    const { slice } = options
    return new RootVertexConfigImpl(slice.name, slice.getInitialState, slice.reducer as Reducer<any>, options.dependencies || {}) as any
  }
  else {
    return new RootVertexConfigImpl(options.name, options.reducer.getInitialState, options.reducer as Reducer<any>, options.dependencies || {}) as any
  }
}