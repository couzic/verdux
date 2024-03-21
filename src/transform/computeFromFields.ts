import { map } from 'rxjs'
import { GraphTransformation } from '../graph/GraphTransformation'
import { combineFields } from '../state/combineFields'
import { pickFields } from '../state/pickFields'
import { VertexId } from '../vertex/VertexId'

export const computeFromFields = (
   vertexId: VertexId,
   fields: string[],
   computers: any
): GraphTransformation =>
   map(transformable => {
      const vertexFields = transformable.graphData.vertices[vertexId].fields
      // TODO Memoize
      const { state, status, errors } = combineFields(
         pickFields(fields, vertexFields)
      )
      if (status === 'loaded') {
         Object.keys(computers).forEach(computedField => {
            vertexFields[computedField] = {
               status: 'loaded',
               value: computers[computedField](state),
               errors: []
            }
         })
      } else if (status === 'loading') {
         Object.keys(computers).forEach(computedField => {
            vertexFields[computedField] = {
               status: 'loading',
               value: undefined,
               errors: []
            }
         })
      } else if (status === 'error') {
         Object.keys(computers).forEach(computedField => {
            vertexFields[computedField] = {
               status: 'error',
               value: undefined,
               errors
            }
         })
      }
      // TODO make sure adequate references have changed
      return transformable
   })
