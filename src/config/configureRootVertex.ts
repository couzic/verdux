import { Reducer, Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { IsPlainObject } from '../util/IsPlainObject'
import { VertexConfig } from './VertexConfig'
import { SingleUpstreamVertexConfig } from './SingleUpstreamVertexConfig'

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
   if ('slice' in options) {
      const { slice } = options
      return new SingleUpstreamVertexConfig( // TODO NOW NOW return new RootVertexConfig
         slice.name,
         slice.getInitialState,
         slice.reducer as Reducer<any>,
         undefined,
         [],
         null,
         options.dependencies || {}
      ) as any
   } else {
      return new SingleUpstreamVertexConfig( // TODO NOW NOW return new RootVertexConfig
         options.name || 'root',
         options.reducer.getInitialState,
         options.reducer as Reducer<any>,
         undefined,
         [],
         null,
         options.dependencies || {}
      ) as any
   }
}
