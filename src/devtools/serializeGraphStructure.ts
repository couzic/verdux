import { GraphCoreInfo } from '../graph/GraphCoreInfo'
import {
   SerializedEdgeStructure,
   SerializedGraphStructure,
   SerializedVertexStructure
} from './SerializedGraphStructure'

export const serializeGraphStructure = (
   graphCoreInfo: GraphCoreInfo
): SerializedGraphStructure => {
   const { vertexConfigs, vertexConfigsByClosestCommonAncestorId } =
      graphCoreInfo
   const vertices = vertexConfigs.map(
      (vertexConfig, idx): SerializedVertexStructure => ({
         id: vertexConfig.id,
         name: vertexConfig.name,
         isRoot: idx === 0
      })
   )
   const edges = [] as SerializedEdgeStructure[]
   vertexConfigs.forEach(vertexConfig => {
      const downstreamVertexConfigs =
         vertexConfigsByClosestCommonAncestorId[vertexConfig.id] || []
      downstreamVertexConfigs.forEach(downstreamVertexConfig => {
         edges.push({
            upstream: vertexConfig.id,
            downstream: downstreamVertexConfig.id,
            fields:
               downstreamVertexConfig.builder.fieldsByUpstreamVertexId[
                  vertexConfig.id
               ]
         })
      })
   })
   return {
      vertices,
      edges
   }
}
