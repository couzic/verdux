import { VertexStatus } from '../VertexStatus'
import { VertexLoadableFields } from '../state/VertexLoadableFields'

export const statusAndErrorsFromLoadableFields = <
   LoadableFields extends object
>(
   loadableFields: VertexLoadableFields<LoadableFields>
):
   | { status: 'loading' | 'loaded'; errors: [] }
   | { status: 'error'; errors: Error[] } => {
   let status: VertexStatus = 'loaded'
   const errors: Error[] = []

   const fields = Object.values(loadableFields) as any[]

   fields.forEach(field => {
      if (field.status === 'error') {
         status = 'error'
         errors.push(field.error)
      } else if (status !== 'error' && field.status === 'loading') {
         status = 'loading'
      }
   })

   return { status, errors: errors as any }
}
