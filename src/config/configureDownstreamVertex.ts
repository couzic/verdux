import { VertexConfig } from './VertexConfig'
import { VertexConfigBuilder } from './VertexConfigBuilder'

// TODO Implement
export function configureDownstreamVertex(
   options: any,
   dependencies: any,
   build: (builder: VertexConfigBuilder<any>) => VertexConfigBuilder<any>
): VertexConfig<any> {
   // const { name, getInitialState, reducer } =
   //    'slice' in options ? options.slice : { ...options, ...options.reducer }
   // const id = createVertexId(name)
   // const builder = build(new VertexConfigBuilderImpl(id, name))
   // return new VertexConfigImpl(
   //    name,
   //    id,
   //    getInitialState,
   //    reducer as any,
   //    builder as any
   // ) as any
   return {} as any
}
