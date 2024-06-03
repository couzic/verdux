import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { GraphRunData } from './RunData'
import { VertexFields } from './VertexFields'

export const extractVertexFields =
   (config: VertexConfigImpl) =>
   (data: GraphRunData): VertexFields => {
      const state = data.reduxStateByVertexId[config.id].vertex
      let fields: VertexFields = {}
      Object.keys(state).forEach(fieldName => {
         fields[fieldName] = {
            status: 'loaded',
            value: state[fieldName],
            errors: []
         }
      })
      const { fieldsByUpstreamVertexId } = config.builder
      config.upstreamVertices.forEach(upstreamVertex => {
         const upstreamVertexFields = data.fieldsByVertexId[upstreamVertex.id]
         fieldsByUpstreamVertexId[upstreamVertex.id].forEach(fieldName => {
            fields[fieldName] = upstreamVertexFields[fieldName]
         })
      })
      return fields
   }
