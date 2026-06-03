import { VertexChangedFields, VertexFields } from './VertexFields'

export const compareVertexFields = (
   previous: VertexFields | undefined,
   next: VertexFields
) => {
   const changedFields: VertexChangedFields = {}
   Object.keys(next).forEach(fieldName => {
      const prev = previous && previous[fieldName]
      if (
         !prev ||
         prev.status !== next[fieldName].status ||
         prev.value !== next[fieldName].value
      ) {
         changedFields[fieldName] = true
      }
   })
   return changedFields
}
