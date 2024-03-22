import { GraphTransformable } from '../graph/GraphTransformable'
import { VertexFieldState } from '../state/VertexFieldState'
import { VertexId } from '../vertex/VertexId'

export const enrichVertexFields = (
   transformable: GraphTransformable,
   vertexId: VertexId,
   fields: Record<string, VertexFieldState>
): GraphTransformable => ({
   ...transformable,
   graphData: {
      ...transformable.graphData,
      vertices: {
         ...transformable.graphData.vertices,
         [vertexId]: {
            ...transformable.graphData.vertices[vertexId],
            fields
         }
      }
   }
})
