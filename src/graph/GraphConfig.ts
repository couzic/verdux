import { VertexConfig } from '../config/VertexConfig'
import { VertexId } from '../vertex/VertexId'

export interface GraphConfig {
   /** exhaustive and sorted */
   vertexIds: VertexId[]
   vertexConfigsBySingleUpstreamVertexId: Record<
      VertexId,
      VertexConfig<any, any>[]
   >
   vertexConfigById: Record<VertexId, VertexConfig<any>>
   dependenciesByVertexId: Record<VertexId, Record<string, any>>
}
