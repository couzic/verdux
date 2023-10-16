import { Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { IsPlainObject } from '../util/IsPlainObject'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexConfigImpl } from './VertexConfigImpl'
import { createVertexId } from './createVertexId'

export const configureRootVertex = <
   ReduxState extends object,
   Dependencies extends object = {}
>(
   options: (
      | {
           slice: Slice<ReduxState>
        }
      | {
           name?: string
           reducer: ReducerWithInitialState<ReduxState>
        }
   ) & {
      dependencies?: { [K in keyof Dependencies]: () => Dependencies[K] }
   }
): IsPlainObject<Dependencies> extends true
   ? VertexConfig<{
        reduxState: ReduxState
        readonlyFields: {}
        loadableFields: {}
        dependencies: Dependencies
     }>
   : never => {
   const { name, getInitialState, reducer } =
      'slice' in options ? options.slice : { ...options, ...options.reducer }
   const nameOrDefault = name || 'root'
   const id = createVertexId(nameOrDefault)
   const builder = new VertexConfigBuilderImpl(
      id,
      nameOrDefault
   ).addDependencies(options.dependencies as any)
   return new VertexConfigImpl(
      nameOrDefault,
      id,
      getInitialState,
      reducer as any,
      builder as any
   ) as any
}
