import { Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { IsPlainObject } from '../util/IsPlainObject'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexConfigImpl } from './VertexConfigImpl'
import { createVertexId } from './createVertexId'

export const configureRootVertex = <
   ReduxFields extends Record<string, any>,
   Dependencies extends Record<string, any> = {}
>(
   options: (
      | {
           slice: Slice<ReduxFields>
        }
      | {
           name?: string
           reducer: ReducerWithInitialState<ReduxFields>
        }
   ) & {
      dependencies?: { [K in keyof Dependencies]: () => Dependencies[K] }
   }
): IsPlainObject<Dependencies> extends true
   ? VertexConfig<{
        fields: ReduxFields
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
