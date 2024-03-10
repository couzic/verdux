import { VertexConfig } from '../config/VertexConfig'
import { VertexId } from '../vertex/VertexId'

export interface GraphConfig {
   /** exhaustive and sorted */
   vertexIds: VertexId[]
   vertexIdsBySingleUpstreamVertexId: Record<VertexId, VertexId[]>
   vertexConfigById: Record<VertexId, VertexConfig<any>>
   injectedDependenciesByVertexId: Record<VertexId, Record<string, any>>
}
