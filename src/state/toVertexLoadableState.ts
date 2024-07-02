import { VertexFields } from '../run/VertexFields'
import { VertexLoadableState } from './VertexLoadableState'
import { VertexStatus } from '../vertex/VertexStatus'
import { VertexFieldsDefinition } from '../config/VertexFieldsDefinition'

export const toVertexLoadableState = <Fields extends VertexFieldsDefinition>(
   fields: VertexFields
): VertexLoadableState<Fields> => {
   const state = {} as any
   let loading = false
   let error = false
   const errors: Error[] = []
   Object.keys(fields).forEach(fieldKey => {
      const field = fields[fieldKey]
      if (field.status === 'error') {
         error = true
         field.errors.forEach(error => errors.push(error))
         state[fieldKey] = undefined
      } else if (field.status === 'loading') {
         loading = true
         state[fieldKey] = undefined
      } else {
         state[fieldKey] = fields[fieldKey].value
      }
   })
   const status: VertexStatus = error ? 'error' : loading ? 'loading' : 'loaded'

   return { state, fields: fields as any, status: status as any, errors }
}
