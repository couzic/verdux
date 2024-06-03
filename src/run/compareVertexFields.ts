import { VertexChangedFields, VertexFields } from './VertexFields'

export const compareVertexFields = (
   previous: VertexFields | undefined,
   next: VertexFields
) => {
   const changedFields: VertexChangedFields = {}
   Object.keys(next).forEach(fieldName => {
      if (
         !previous ||
         previous[fieldName].status !== next[fieldName].status ||
         previous[fieldName].value !== next[fieldName].value
      ) {
         changedFields[fieldName] = true
      }
   })
   return changedFields
}
