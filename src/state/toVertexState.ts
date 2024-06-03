import { VertexFields } from '../run/VertexFields'
import { VertexState } from './VertexState'

export const toVertexState = (fields: VertexFields): VertexState<any> => {
   const state = {} as any
   Object.keys(fields).forEach(fieldKey => {
      state[fieldKey] = fields[fieldKey].value
   })
   return state
}
