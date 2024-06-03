import { GraphCore } from '../graph/GraphCore'
import {
   SerializedEdgeStructure,
   SerializedGraphStructure,
   SerializedVertexStructure
} from './SerializedGraphStructure'

export const serializeGraphStructure = (
   graphCore: GraphCore
): SerializedGraphStructure => {
   const { vertexConfigs, vertexConfigsByClosestCommonAncestorId } = graphCore
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
