import { VertexConfig } from './config/VertexConfig'
import { VertexInstance } from './VertexInstance'

export type Vertex<Config extends VertexConfig<any>> =
   Config extends VertexConfig<infer Type> ? VertexInstance<Type> : never
