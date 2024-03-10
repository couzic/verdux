import { VertexLoadableState } from '../old/state/VertexLoadableState'
import { VertexFieldState } from './VertexFieldState'

export const combineFields = (
   fields: Record<string, VertexFieldState>
): VertexLoadableState<any> => {
   const state = {} as any
   let loading = false
   let error = false
   const errors: Error[] = []
   Object.keys(fields).forEach(fieldKey => {
      const field = fields[fieldKey]
      if (field.status === 'error') {
         error = true
         field.errors.forEach(error => errors.push(error))
      } else if (field.status === 'loading') {
         loading = true
      } else {
         state[fieldKey] = fields[fieldKey].value
      }
   })
   const status = error ? 'error' : loading ? 'loading' : 'loaded'

   return { state, fields, status, errors }
}
