import { Slice } from '@reduxjs/toolkit'
import { ReducerWithInitialState } from '@reduxjs/toolkit/dist/createReducer'
import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilder } from './VertexConfigBuilder'
import { VertexConfigBuilderImpl } from './VertexConfigBuilderImpl'
import { VertexConfigImpl } from './VertexConfigImpl'
import { VertexFieldsDefinition } from './VertexFieldsDefinition'
import { createVertexId } from './createVertexId'

export function configureVertex<
   ReduxState extends any,
   Fields extends VertexFieldsDefinition,
   Dependencies extends Record<string, any>
>(
   options:
      | {
           slice: Slice<ReduxState>
        }
      | {
           name: string
           reducer: ReducerWithInitialState<ReduxState>
        },
   // & {
   //    dependencies?: {
   //    [K in keyof Dependencies]: () => Dependencies[K]
   // }
   build: (
      builder: VertexConfigBuilder<
         { [K in keyof ReduxState]: { loadable: false; value: ReduxState[K] } },
         {}
      >
   ) => VertexConfigBuilder<Fields, Dependencies>
): VertexConfig<Fields, Dependencies> {
   const { name, getInitialState, reducer } =
      'slice' in options ? options.slice : { ...options, ...options.reducer }
   const id = createVertexId(name)
   const builder = build(new VertexConfigBuilderImpl(id))
   return new VertexConfigImpl(
      name,
      id,
      getInitialState as any,
      reducer as any,
      builder as any
   )
}
