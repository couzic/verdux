import { VertexFieldState } from './VertexFieldState'
import { VertexLoadableState } from './VertexLoadableState'

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
         state[fieldKey] = undefined
      } else if (field.status === 'loading') {
         loading = true
         state[fieldKey] = undefined
      } else {
         state[fieldKey] = fields[fieldKey].value
      }
   })
   const status = error ? 'error' : loading ? 'loading' : 'loaded'

   return { state, fields, status, errors }
}
