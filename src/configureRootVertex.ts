import { Reducer, Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { IsPlainObject } from './IsPlainObject'
import { VertexConfig } from './VertexConfig'
import { VertexConfigImpl } from './VertexConfigImpl'

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
      return new VertexConfigImpl(
         slice.name,
         slice.getInitialState,
         slice.reducer as Reducer<any>,
         undefined,
         [],
         null,
         options.dependencies || {}
      ) as any
   } else {
      return new VertexConfigImpl(
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
