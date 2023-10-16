import { Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilder } from './VertexConfigBuilder'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexConfigImpl } from './VertexConfigImpl'
import { createVertexId } from './createVertexId'

export function configureDownstreamVertex<
   ReduxState extends object,
   ReadonlyFields extends object,
   LoadableFields extends object,
   Dependencies extends object
>(
   options: (
      | {
           slice: Slice<ReduxState>
        }
      | {
           name: string
           reducer: ReducerWithInitialState<ReduxState>
        }
   ) & {
      dependencies?: {
         [K in keyof Dependencies]: () => Dependencies[K]
      }
   },
   build: (
      builder: VertexConfigBuilder<{
         readonlyFields: {}
         loadableFields: {}
         dependencies: {}
      }>
   ) => VertexConfigBuilder<{
      readonlyFields: ReadonlyFields
      loadableFields: LoadableFields
      dependencies: Dependencies
   }>
): VertexConfig<{
   reduxState: ReduxState
   readonlyFields: ReadonlyFields
   loadableFields: LoadableFields
   dependencies: Dependencies
}> {
   const { name, getInitialState, reducer } =
      'slice' in options ? options.slice : { ...options, ...options.reducer }
   const id = createVertexId(name)
   const builder = build(new VertexConfigBuilderImpl(id, name))
   return new VertexConfigImpl(
      name,
      id,
      getInitialState,
      reducer as any,
      builder as any
   ) as any
}
