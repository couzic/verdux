import { VertexConfigImpl } from '../config/VertexConfigImpl'
import { GraphCoreInfo } from '../graph/GraphCoreInfo'
import { VertexReduxState } from '../state/VertexReduxState'
import { extractReduxState } from './extractReduxState'
import { GraphRunData } from './RunData'
import { VertexFields } from './VertexFields'

export const extractVertexFields = (
   config: VertexConfigImpl,
   coreInfo: GraphCoreInfo,
   getRootReduxState: () => VertexReduxState
) => {
   const reduxPath = coreInfo.reduxPathByVertexId[config.id]
   return (data: GraphRunData): VertexFields => {
      const state = extractReduxState(getRootReduxState(), reduxPath).vertex
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
}
