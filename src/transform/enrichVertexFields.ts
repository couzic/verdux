import { VertexTransformable } from '../graph/Transformable'
import { VertexFieldState } from '../state/VertexFieldState'

export const enrichVertexFields = (
   transformable: VertexTransformable,
   fields: Record<string, VertexFieldState>
): VertexTransformable => ({
   ...transformable,
   vertexFields: {
      ...transformable.vertexFields,
      ...fields
   }
})
