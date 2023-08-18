import { Reducer, Slice } from "@reduxjs/toolkit"
import { ReducerWithInitialState } from "@reduxjs/toolkit/dist/createReducer"
import { RootVertexConfigImpl } from './RootVertexConfigImpl'
import { VertexConfig } from "./VertexConfig"

export const configureRootVertex = <ReduxState extends object>(options: {
  slice: Slice<ReduxState>,
} | {
  name: string,
  reducer: ReducerWithInitialState<ReduxState>,
}):
  VertexConfig<{
    reduxState: ReduxState,
    readonlyFields: {},
    loadableFields: {},
    dependencies: {}
  }> => {
  if ('slice' in options) {
    const { slice } = options
    return new RootVertexConfigImpl(slice.name, slice.getInitialState, slice.reducer as Reducer<any>) as any
  }
  else {
    return new RootVertexConfigImpl(options.name, options.reducer.getInitialState, options.reducer as Reducer<any>) as any
  }
}