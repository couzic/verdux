import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { GraphRunData } from './RunData'

export const trackedUpstreamFieldHasChanged = (
   vertexConfig: VertexConfigImpl,
   data: GraphRunData
) =>
   vertexConfig.upstreamVertices.some(upstreamVertex => {
      const changedFields =
         data.changedFieldsByVertexId[upstreamVertex.id] || {}
      return vertexConfig.builder.fieldsByUpstreamVertexId[
         upstreamVertex.id
      ].some(fieldName => changedFields[fieldName])
   })
